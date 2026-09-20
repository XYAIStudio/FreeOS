"""Fail CI if packaged config templates embed cloud API keys."""

from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]

# Real DeepSeek keys are ``sk-`` + 32+ hex. Generic vendor keys are longer ``sk-`` tokens.
_DEEPSEEK_LIKE = re.compile(r"\bsk-[a-fA-F0-9]{32,}\b")
_GENERIC_SK = re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b")
_ENV_KEY_ASSIGN = re.compile(
    r"(?im)^[ \t]*(?:export[ \t]+)?(?:LLM_API_KEY|DEEPSEEK_API_KEY|OPENAI_API_KEY|DASHSCOPE_API_KEY)"
    r"[ \t]*=[ \t]*([^\s#]+)"
)
_JSON_API_KEY = re.compile(
    r'(?i)"(?:api_key|llm_api_key|secret_key)"\s*:\s*"(sk-[A-Za-z0-9_-]{16,})"'
)

_SKIP_DIR_NAMES = frozenset(
    {
        "node_modules",
        "dist",
        "backend-dist",
        ".git",
        "coverage",
        "__pycache__",
    }
)
_SCAN_SUFFIXES = frozenset(
    {
        ".json",
        ".yml",
        ".yaml",
        ".env",
        ".example",
        ".nsi",
        ".nsh",
        ".ps1",
        ".sh",
        ".bat",
        ".cmd",
        ".ts",
        ".tsx",
        ".js",
        ".go",
        ".py",
        ".txt",
        ".toml",
        ".md",
    }
)
# Documented placeholders / test fakes — never a live quota key.
_ALLOWED_SK_PREFIXES = (
    "sk-test",
    "sk-draft",
    "sk-new",
    "sk-secret",
    "sk-keep",
    "sk-user",
    "sk-invalid",
    "sk-other",
    "sk-xxx",
    "sk-lf-",
    "sk-ap-",
    "sk-orphan",
    "sk-disconnected",
)
_ALLOWED_ENV_VALUES = frozenset(
    {
        "",
        '""',
        "''",
        "${OPENAI_API_KEY:-}",
        "${LLM_API_KEY:-}",
        "${DEEPSEEK_API_KEY:-}",
    }
)


def _packaged_roots() -> list[Path]:
    return [
        REPO / "desktop",
        REPO / "modules" / "openxyos" / ".env.example",
        REPO / "modules" / "openxyos" / "deploy",
        REPO / "modules" / "openxyos" / "backend",
        REPO / "modules" / "openxyos" / "frontend" / "src" / "llm-providers.ts",
        REPO / "modules" / "openxyos" / "frontend" / "src" / "pages" / "OpenHomePage.tsx",
        REPO / "src" / "octop" / "infra" / "agents" / "providers" / "presets.py",
        REPO / "scripts" / "org-export" / "template",
        REPO / ".env.example",
    ]


def _iter_scan_files() -> list[Path]:
    files: list[Path] = []
    for root in _packaged_roots():
        if root.is_file():
            files.append(root)
            continue
        if not root.is_dir():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if any(part in _SKIP_DIR_NAMES for part in path.parts):
                continue
            if path.suffix.lower() not in _SCAN_SUFFIXES and path.name not in {
                ".env",
                ".env.example",
            }:
                continue
            files.append(path)
    return files


def _is_allowed_sk(token: str) -> bool:
    lower = token.lower()
    return any(lower.startswith(prefix) for prefix in _ALLOWED_SK_PREFIXES)


def _is_placeholder_env_value(raw: str) -> bool:
    value = raw.strip().strip("\"'")
    if value in _ALLOWED_ENV_VALUES or value == "":
        return True
    lowered = value.lower()
    if lowered.startswith("${") or lowered.startswith("<"):
        return True
    return any(part in lowered for part in ("replace-me", "changeme", "your-key", "example"))


def _findings_in(path: Path, text: str) -> list[str]:
    hits: list[str] = []
    for match in _DEEPSEEK_LIKE.finditer(text):
        hits.append(f"{path}: DeepSeek-like key {match.group(0)[:8]}…")
    for match in _GENERIC_SK.finditer(text):
        token = match.group(0)
        if _is_allowed_sk(token) or _DEEPSEEK_LIKE.fullmatch(token):
            continue
        hits.append(f"{path}: credential-like token {token[:8]}…")
    for match in _ENV_KEY_ASSIGN.finditer(text):
        if _is_placeholder_env_value(match.group(1)):
            continue
        hits.append(f"{path}: non-empty {match.group(0).split('=', 1)[0].strip()} assignment")
    for match in _JSON_API_KEY.finditer(text):
        token = match.group(1)
        if _is_allowed_sk(token):
            continue
        hits.append(f"{path}: json api_key looks like a live secret")
    return hits


def test_packaged_templates_have_no_embedded_cloud_keys() -> None:
    findings: list[str] = []
    scanned = 0
    for path in _iter_scan_files():
        scanned += 1
        text = path.read_text(encoding="utf-8", errors="replace")
        findings.extend(_findings_in(path, text))
    assert scanned > 0
    assert findings == []


def test_sidecar_packaging_excludes_dotenv() -> None:
    script = (REPO / "desktop" / "portable" / "bundle-org-sidecar.sh").read_text(encoding="utf-8")
    assert "--exclude '.env'" in script
    assert ".env.example" in script
    assert 'item.name == ".env"' in script


def test_secret_patterns_catch_deepseek_like_defaults() -> None:
    fake = (
        "LLM_API_KEY=sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n"
        '{"api_key": "sk-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}\n'
    )
    hits = _findings_in(Path("fixture.env"), fake)
    assert hits
    assert any(
        "DeepSeek-like" in hit or "json api_key" in hit or "LLM_API_KEY" in hit for hit in hits
    )
