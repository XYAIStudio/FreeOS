"""Discover local LLM weight files with precision over noisy false positives."""

from __future__ import annotations

import json
import os
import string
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Any

WEIGHT_FILES = {".gguf", ".ggml"}
_SKIP_DIR_NAMES = {
    "$recycle.bin",
    "system volume information",
    "recovery",
    "windows",
    "program files",
    "program files (x86)",
    "programdata",
    "node_modules",
    ".git",
    ".hg",
    ".svn",
    "__pycache__",
    ".venv",
    "venv",
    "temp",
    "tmp",
    "cache",
}
_SKIP_DIR_NAMES_ALWAYS = {
    "$recycle.bin",
    "system volume information",
    "recovery",
    "node_modules",
    ".git",
    ".hg",
    ".svn",
    "__pycache__",
    ".venv",
    "venv",
    "appdata",
    "library",
}
_SKIP_FULL_DISK_WINDOWS = {
    "windows",
    "program files",
    "program files (x86)",
    "programdata",
    "temp",
}
_CAUSAL_HINTS = (
    "llama",
    "mistral",
    "qwen",
    "gemma",
    "phi",
    "gpt",
    "mpt",
    "falcon",
    "bloom",
    "yi",
    "deepseek",
    "internlm",
    "chatglm",
    "baichuan",
    "glm",
    "stablelm",
    "olmo",
)
_POSIX_DENIED = ("/proc", "/sys", "/dev", "/etc", "/root", "/boot", "/run")


def common_model_roots(*, home: Path | None = None) -> list[Path]:
    """Well-known desktop model folders only (fast automatic probe)."""
    root = home if home is not None else Path.home()
    extras = [
        root / "models",
        root / ".models",
        root / ".cache" / "huggingface",
        root / ".cache" / "lm-studio",
        root / ".lmstudio" / "models",
        root / ".cache" / "lm-studio" / "models",
        root / "Documents" / "LM Studio" / "models",
        root / "jan" / "models",
    ]
    local = os.environ.get("LOCALAPPDATA", "").strip()
    if local:
        extras.append(Path(local) / "nomic.ai" / "GPT4All")
        extras.append(Path(local) / "Programs" / "Ollama")
    roaming = os.environ.get("APPDATA", "").strip()
    if roaming:
        extras.append(Path(roaming) / "nomic.ai" / "GPT4All")
    seen: set[str] = set()
    out: list[Path] = []
    for path in extras:
        key = os.path.normcase(str(path))
        if key in seen:
            continue
        seen.add(key)
        try:
            if path.is_dir():
                out.append(path)
        except OSError:
            continue
    return out


def default_scan_roots(*, home: Path | None = None) -> list[Path]:
    """User profile plus well-known desktop model folders (manual search)."""
    root = home if home is not None else Path.home()
    extras = [
        root / "Downloads",
        root / "Documents",
        *common_model_roots(home=root),
    ]
    seen: set[str] = set()
    out: list[Path] = []
    for path in [root, *extras]:
        key = os.path.normcase(str(path))
        if key in seen:
            continue
        seen.add(key)
        try:
            if path.is_dir():
                out.append(path)
        except OSError:
            continue
    return out


def windows_drives() -> list[Path]:
    drives: list[Path] = []
    for letter in string.ascii_uppercase:
        candidate = Path(f"{letter}:\\")
        try:
            if candidate.exists():
                drives.append(candidate)
        except OSError:
            continue
    return drives


def full_disk_roots() -> list[Path]:
    if os.name == "nt":
        return windows_drives()
    return [Path("/")]


def _skip_dir(name: str, *, full_disk: bool, user_root: bool) -> bool:
    lowered = name.lower()
    if lowered in _SKIP_DIR_NAMES_ALWAYS:
        return True
    if user_root:
        return False
    if full_disk and lowered in _SKIP_FULL_DISK_WINDOWS:
        return True
    return lowered in _SKIP_DIR_NAMES


def _posix_denied(path: Path) -> bool:
    if os.name != "posix":
        return False
    text = path.as_posix()
    return any(text == denied or text.startswith(f"{denied}/") for denied in _POSIX_DENIED)


def is_weight_file(path: Path) -> bool:
    return path.suffix.lower() in WEIGHT_FILES


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None


def is_local_llm_safetensors_dir(path: Path) -> bool:
    """True only for a Hugging Face-style causal-LM folder."""
    try:
        if not path.is_dir():
            return False
    except OSError:
        return False
    config_path = path / "config.json"
    if not config_path.is_file():
        return False
    has_weight = False
    has_tokenizer = False
    try:
        for child in path.iterdir():
            name = child.name.lower()
            if name.endswith(".safetensors"):
                has_weight = True
            if name in {"tokenizer.json", "tokenizer.model", "tokenizer_config.json"}:
                has_tokenizer = True
    except OSError:
        return False
    if not (has_weight and has_tokenizer):
        return False
    data = _read_json(config_path)
    if not isinstance(data, dict):
        return False
    model_type = str(data.get("model_type") or "").lower()
    architectures = data.get("architectures")
    arch_text = (
        " ".join(str(item) for item in architectures) if isinstance(architectures, list) else ""
    )
    blob = f"{model_type} {arch_text.lower()}"
    return any(hint in blob for hint in _CAUSAL_HINTS)


def weight_entry(path: Path, *, source: str) -> dict[str, Any]:
    try:
        size = path.stat().st_size if path.is_file() else _dir_size(path)
    except OSError:
        size = 0
    return {
        "name": path.stem if path.is_file() else path.name,
        "path": str(path),
        "size": size,
        "source": source,
        "registerable": source in {"gguf", "ggml"},
    }


def _dir_size(path: Path, *, limit: int = 12) -> int:
    total = 0
    try:
        children = list(path.iterdir())
    except OSError:
        return 0
    counted = 0
    for child in children:
        if counted >= limit:
            break
        try:
            if child.is_file() and child.suffix.lower() == ".safetensors":
                total += child.stat().st_size
                counted += 1
        except OSError:
            continue
    return total


ProgressFn = Callable[[str, int, int], None]


def scan_weight_roots(
    roots: Iterable[Path],
    *,
    full_disk: bool = False,
    user_picked: bool = False,
    max_files: int = 400,
    should_cancel: Callable[[], bool] | None = None,
    on_progress: ProgressFn | None = None,
) -> list[dict[str, Any]]:
    """Walk *roots* looking for GGUF/GGML files and clear local-LLM folders."""
    found: list[dict[str, Any]] = []
    seen: set[str] = set()
    dirs_scanned = 0

    def add(entry: dict[str, Any]) -> None:
        key = os.path.normcase(str(entry["path"]))
        if key in seen:
            return
        seen.add(key)
        found.append(entry)

    for root in roots:
        if should_cancel and should_cancel():
            break
        try:
            if not root.exists():
                continue
        except OSError:
            continue
        if _posix_denied(root):
            continue
        if root.is_file() and is_weight_file(root):
            add(weight_entry(root, source=root.suffix.lower().lstrip(".")))
            continue
        for dirpath, dirnames, filenames in os.walk(root, topdown=True, followlinks=False):
            if should_cancel and should_cancel():
                return found
            current = Path(dirpath)
            if _posix_denied(current):
                dirnames[:] = []
                continue
            dirs_scanned += 1
            if on_progress is not None:
                on_progress(str(current), dirs_scanned, len(found))
            keep: list[str] = []
            for name in dirnames:
                if _skip_dir(name, full_disk=full_disk, user_root=user_picked):
                    continue
                keep.append(name)
            dirnames[:] = keep
            if is_local_llm_safetensors_dir(current):
                add(weight_entry(current, source="safetensors"))
                dirnames[:] = []
                if len(found) >= max_files:
                    return found
                continue
            for name in filenames:
                suffix = Path(name).suffix.lower()
                if suffix not in WEIGHT_FILES:
                    continue
                path = current / name
                add(weight_entry(path, source=suffix.lstrip(".")))
                if len(found) >= max_files:
                    return found
    return found
