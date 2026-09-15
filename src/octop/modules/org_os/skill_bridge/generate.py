"""Generate FreeOS/Octop SKILL.md trees from the openXYOS module catalog."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from octop.modules.org_os.catalog import OPENXYOS_MODULES, OrgCapability
from octop.modules.org_os.skill_bridge.endpoints import MODULE_ENDPOINTS, ModuleEndpoint

BFF_PREFIX = "/api/org-module/sidecar"
TENANT_HEADERS = (
    "X-FreeOS-Tenant-Id",
    "X-FreeOS-User",
    "X-FreeOS-User-Id",
    "X-FreeOS-Role",
)

_CALL_MODULE_PY = '''\
"""Call an openXYOS module API through the FreeOS BFF (or sidecar).

High-risk methods are gated by xyos-governance-mcp. A blocked decision
exits non-zero and must not be retried without a human approval_id.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


def _home() -> Path:
    raw = os.environ.get("FREEOS_HOME") or os.environ.get("OCTOP_HOME")
    if raw:
        return Path(raw)
    freeos = Path.home() / ".freeos"
    octop = Path.home() / ".octop"
    if freeos.exists():
        return freeos
    if octop.exists():
        return octop
    return freeos


def _gate(method: str, path: str, risk: str, approval_id: str) -> None:
    if risk in {"", "low"}:
        return
    try:
        from octop.modules.org_os.governance.interceptor import (
            GovernanceBlockedError,
            gate_tool_call,
        )
    except ImportError:
        print("governance interceptor unavailable; refusing high-risk call", file=sys.stderr)
        raise SystemExit(2) from None
    sidecar = os.environ.get("FREEOS_ORG_SIDECAR_URL", "")
    try:
        gate_tool_call(
            home=_home(),
            tool_name=f"{method} {path}",
            category=risk,
            action=f"{method} {path}",
            tenant_id=os.environ.get("FREEOS_ORG_TENANT_ID", ""),
            actor_id=os.environ.get("FREEOS_USER", ""),
            args={"method": method, "path": path},
            approval_id=approval_id,
            sidecar_url=sidecar,
        )
    except GovernanceBlockedError as exc:
        print(json.dumps(exc.decision.to_dict(), ensure_ascii=False, indent=2))
        raise SystemExit(3) from exc


def _headers() -> dict[str, str]:
    mapping = {
        "X-FreeOS-Tenant-Id": os.environ.get("FREEOS_ORG_TENANT_ID", ""),
        "X-FreeOS-User": os.environ.get("FREEOS_USER", os.environ.get("OCTOP_USER", "")),
        "X-FreeOS-User-Id": os.environ.get("FREEOS_USER_ID", ""),
        "X-FreeOS-Role": os.environ.get("FREEOS_ROLE", ""),
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    return {key: value for key, value in mapping.items() if value}


def main() -> None:
    parser = argparse.ArgumentParser(description="Call an openXYOS module API")
    parser.add_argument("--method", required=True)
    parser.add_argument("--path", required=True, help="Sidecar path, e.g. /api/employees")
    parser.add_argument("--risk", default="low")
    parser.add_argument("--approval-id", default="")
    parser.add_argument("--body", default="")
    args = parser.parse_args()
    _gate(args.method.upper(), args.path, args.risk, args.approval_id)

    base = os.environ.get("FREEOS_ORG_BFF_URL", "http://127.0.0.1:18900")
    sidecar = os.environ.get("FREEOS_ORG_SIDECAR_URL", "http://127.0.0.1:3780")
    use_bff = os.environ.get("FREEOS_ORG_USE_BFF", "1") != "0"
    if use_bff:
        url = base.rstrip("/") + "/api/org-module/sidecar" + args.path
    else:
        url = sidecar.rstrip("/") + args.path
    data = args.body.encode("utf-8") if args.body else None
    request = urllib.request.Request(url, data=data, method=args.method.upper(), headers=_headers())
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            sys.stdout.write(response.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as exc:
        sys.stderr.write(exc.read().decode("utf-8", errors="replace"))
        raise SystemExit(exc.code) from exc


if __name__ == "__main__":
    main()
'''


@dataclass
class GeneratedSkill:
    slug: str
    module_key: str
    directory: Path
    skill_md: Path
    script: Path
    endpoints: list[ModuleEndpoint] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "slug": self.slug,
            "module_key": self.module_key,
            "directory": str(self.directory),
            "skill_md": str(self.skill_md),
            "script": str(self.script),
            "endpoints": list(self.endpoints),
        }


def skill_slug(module_key: str) -> str:
    return f"org-{module_key}"


def render_skill_md(module: OrgCapability, endpoints: tuple[ModuleEndpoint, ...]) -> str:
    slug = skill_slug(module["key"])
    lines = [
        "---",
        f"name: {slug}",
        f"description: Call the openXYOS {module['label']} module "
        f"({module['key']}) through FreeOS tenant headers and real /api routes.",
        "metadata:",
        "  freeos:",
        "    source: openxyos-module",
        f"    module_key: {module['key']}",
        "    label:",
        f"      en: {module['label']}",
        f"      zh: {module['label_zh']}",
        "---",
        "",
        f"# {module['label']} (`{module['key']}`)",
        "",
        module["description"],
        "",
        "This skill talks to the **openXYOS control plane** via the FreeOS BFF.",
        "It does **not** start a second agent chat runtime.",
        "",
        "## Tenant isolation",
        "",
        "One tenant = one FreeOS workspace/sandbox. Always send:",
        "",
    ]
    for header in TENANT_HEADERS:
        lines.append(f"- `{header}`")
    lines.extend(
        [
            "",
            "Set `FREEOS_ORG_TENANT_ID` on this instance. Never share a workspace",
            "across tenants.",
            "",
            "## API calls",
            "",
            "Prefer the BFF (host JWT, module must be enabled):",
            "",
            f"`{{FREEOS_HOST}}{BFF_PREFIX}{{sidecar_path}}`",
            "",
            "Direct sidecar origin is `FREEOS_ORG_SIDECAR_URL` (default",
            "`http://127.0.0.1:3780`). Mutating org routes still need a sidecar",
            "session; the BFF forwards identity headers only.",
            "",
            "| Method | Path | Risk | Summary |",
            "|---|---|---|---|",
        ]
    )
    for item in endpoints:
        lines.append(
            f"| `{item['method']}` | `{item['path']}` | `{item['risk']}` | {item['summary']} |"
        )
    if not endpoints:
        lines.append("| — | — | — | No routes mapped yet |")
    lines.extend(
        [
            "",
            "## Run",
            "",
            "```bash",
            "python scripts/call_module.py --method GET --path /api/... --risk low",
            "```",
            "",
            "For `outbound` / `delete` / `pay` / `prod` the script calls",
            "`xyos-governance-mcp` / `gate_tool_call` first. If the decision is",
            "`pending` or `deny`, **stop**. Ask a human to",
            "`freeos org governance approve <pause_id>` and retry with",
            "`--approval-id`. Do not execute the HTTP call yourself.",
            "",
            "## Publish back",
            "",
            "When this skill is polished:",
            "",
            "```bash",
            f"uv run freeos org skills publish {slug}",
            "```",
            "",
            "That writes a tenant-toggleable plugin draft. It does not enable",
            "the module for every tenant.",
            "",
        ]
    )
    return "\n".join(lines)


def generate_module_skills(
    out_dir: Path,
    *,
    module_keys: list[str] | None = None,
) -> list[GeneratedSkill]:
    out_dir.mkdir(parents=True, exist_ok=True)
    wanted = set(module_keys) if module_keys else None
    generated: list[GeneratedSkill] = []
    for module in OPENXYOS_MODULES:
        key = module["key"]
        if wanted is not None and key not in wanted:
            continue
        endpoints = MODULE_ENDPOINTS.get(key, ())
        slug = skill_slug(key)
        directory = out_dir / slug
        scripts = directory / "scripts"
        scripts.mkdir(parents=True, exist_ok=True)
        skill_md = directory / "SKILL.md"
        script = scripts / "call_module.py"
        skill_md.write_text(render_skill_md(module, endpoints), encoding="utf-8")
        script.write_text(_CALL_MODULE_PY, encoding="utf-8")
        generated.append(
            GeneratedSkill(
                slug=slug,
                module_key=key,
                directory=directory,
                skill_md=skill_md,
                script=script,
                endpoints=list(endpoints),
            )
        )
    return generated
