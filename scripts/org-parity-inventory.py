"""Inventory both openXYOS route trees without claiming feature parity.

Run with ``uv run python scripts/org-parity-inventory.py``. The generated
report records source dependencies and API references, not runtime acceptance.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "modules/openxyos/frontend/src"
IMPORT = re.compile(r"(?:from\s*|import\s*\()\s*[\"\'](\.[^\"\']+)[\"\']")
PAGE_IMPORT = re.compile(r"import\(\s*[\"\'](\./pages/[^\"\']+)[\"\']\s*\)")
ROUTE = re.compile(r'<Route\s+path="([^"]+)"\s+element=\{(.*?)\}\s*/>', re.S)
API = re.compile(r"[\"\'`](/api/[A-Za-z0-9_-]+[^\"\'`\s]*)")


def resolve_import(parent: Path, spec: str) -> Path | None:
    candidate = parent / spec
    for item in (
        candidate,
        Path(f"{candidate}.tsx"),
        Path(f"{candidate}.ts"),
        candidate / "index.tsx",
        candidate / "index.ts",
    ):
        if item.is_file() and item.suffix in {".ts", ".tsx"}:
            return item.resolve()
    return None


def dependencies(entry: Path) -> list[Path]:
    seen: set[Path] = set()
    pending = [entry.resolve()]
    while pending:
        path = pending.pop()
        if path in seen:
            continue
        seen.add(path)
        for spec in IMPORT.findall(path.read_text(encoding="utf-8-sig")):
            target = resolve_import(path.parent, spec)
            if target and target.is_relative_to(SOURCE):
                pending.append(target)
    return sorted(seen)


def inventory() -> dict[str, object]:
    server = (ROOT / "modules/openxyos/backend/server.ts").read_text(encoding="utf-8")
    mounts = sorted(set(re.findall(r'app\.use\("(/api/[^\"]+)",\s*\w+Routes\)', server)))
    host = (ROOT / "dashboard/src/routes/index.tsx").read_text(encoding="utf-8")
    host_routes = set(re.findall(r'path:\s*"(/organization[^\"]*)"', host))
    entries: list[dict[str, object]] = []
    routed_pages: set[Path] = set()
    aliases = {"/": "dashboard", "/app": "workspace"}
    for name in ("App.tsx", "OpenApp.tsx"):
        text = (SOURCE / name).read_text(encoding="utf-8")
        # Match lazy declarations, including the compact comma-separated OpenApp.
        components = dict(
            re.findall(r'(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\("(\./pages/[^\"]+)"\)', text)
        )
        for route, expression in ROUTE.findall(text):
            symbols = re.findall(r"<(\w+)", expression)
            component = next((symbol for symbol in symbols if symbol in components), None)
            if not component:
                continue  # Public auth/marketing/legal routes are recorded separately.
            page = resolve_import(SOURCE, components[component])
            if page is None:
                raise ValueError(f"Unresolved page: {name} {route} {component}")
            routed_pages.add(page)
            files = dependencies(page)
            apis = sorted(
                {api for file in files for api in API.findall(file.read_text(encoding="utf-8-sig"))}
            )
            api_roots = sorted({"/".join(api.split("/")[:3]).split("?")[0] for api in apis})
            destination = "/organization/" + aliases.get(route, route.lstrip("/"))
            entries.append(
                {
                    "source_shell": name,
                    "source_route": route,
                    "component": component,
                    "source_file": page.relative_to(ROOT).as_posix(),
                    "target_route": destination,
                    "host_route_exists": destination in host_routes,
                    "parity": "not_accepted",
                    "dependencies": [file.relative_to(ROOT).as_posix() for file in files],
                    "api_references": apis,
                    "unmounted_api_roots": [api for api in api_roots if api not in mounts],
                }
            )
    return {
        "scope": "All business routes in App.tsx and OpenApp.tsx, including chat and commercial modules",
        "limitation": "Static inventory only. Dynamic URLs, internal controls, permissions and data relations require manual/runtime review. Route existence is not parity.",
        "mounted_api_roots": mounts,
        "routes": entries,
        "pages_without_direct_business_route": sorted(
            file.relative_to(ROOT).as_posix()
            for file in (SOURCE / "pages").glob("*.tsx")
            if file.resolve() not in routed_pages
        ),
    }


def main() -> None:
    report = inventory()
    destination = ROOT / "docs/org-full-parity-inventory.json"
    destination.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    routes = report["routes"]
    assert isinstance(routes, list)
    print(f"Recorded {len(routes)} route entries; no feature marked accepted: {destination}")


if __name__ == "__main__":
    main()
