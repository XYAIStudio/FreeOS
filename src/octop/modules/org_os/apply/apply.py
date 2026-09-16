"""Apply a ``freeos.asset-pack.v1`` onto openXYOS-shaped surfaces."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from octop.modules.org_os.apply.client import (
    ApplyReceipt,
    ApplyResult,
    OpenXyosControlClient,
    mirror_root,
)


def _load_json(path: Path) -> Any:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def _items(doc: Any, key: str) -> list[dict[str, Any]]:
    if isinstance(doc, dict) and isinstance(doc.get(key), list):
        return [item for item in doc[key] if isinstance(item, dict)]
    if isinstance(doc, list):
        return [item for item in doc if isinstance(item, dict)]
    return []


def _plugin_payloads(dest: Path) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []
    openxyos_dir = dest / "openxyos"
    if not openxyos_dir.is_dir():
        return payloads
    for path in sorted(openxyos_dir.glob("*.publish.json")):
        if path.name.startswith("org-employees") or path.name.startswith("org-talent"):
            continue
        raw = _load_json(path)
        if isinstance(raw, dict):
            payloads.append(raw)
    return payloads


def _skill_payloads(dest: Path) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    skills_root = dest / "skills"
    if not skills_root.is_dir():
        return out
    for skill_dir in sorted(path for path in skills_root.iterdir() if path.is_dir()):
        manifest = skill_dir / "SKILL.md"
        if not manifest.is_file():
            continue
        out.append(
            {
                "name": skill_dir.name,
                "slug": skill_dir.name,
                "category": "FreeOS",
                "content": manifest.read_text(encoding="utf-8")[:8000],
                "source": "FreeOS",
            }
        )
    return out


def _mcp_payloads(dest: Path) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    mcp_root = dest / "mcps"
    if not mcp_root.is_dir():
        return out
    for path in sorted(mcp_root.glob("*.json")):
        raw = _load_json(path)
        if isinstance(raw, dict):
            out.append({"name": path.stem, "slug": path.stem, "config_json": json.dumps(raw)})
    return out


def apply_asset_pack(
    pack_dir: Path,
    *,
    home: Path,
    tenant_id: str = "",
    base_url: str = "",
    headers: dict[str, str] | None = None,
) -> ApplyResult:
    """Write local mirror + ingest drafts to the control plane when reachable."""
    dest = pack_dir if pack_dir.is_dir() else Path(pack_dir)
    tid = tenant_id or "default"
    mirror = mirror_root(home, tid)
    mirror.mkdir(parents=True, exist_ok=True)
    client = OpenXyosControlClient(base_url, headers=headers, home=home)
    employees = _items(_load_json(dest / "openxyos" / "org-employees.publish.json"), "employees")
    talent = _items(_load_json(dest / "openxyos" / "org-talent.publish.json"), "talent")
    plugins = _plugin_payloads(dest)
    skills = _skill_payloads(dest)
    mcp = _mcp_payloads(dest)

    employees_doc = {
        "employees": employees,
        "enabled_by_default": False,
        "source": "freeos.asset-pack.v1",
    }
    talent_doc = {"talent": talent, "enabled_by_default": False, "source": "freeos.asset-pack.v1"}
    plugins_doc = {"enabled_by_default": False, "plugins": plugins}
    emp_mirror = client.write_mirror(mirror / "employees.json", employees_doc)
    talent_mirror = client.write_mirror(mirror / "talent.json", talent_doc)
    plugins_mirror = client.write_mirror(mirror / "plugins.json", plugins_doc)
    skills_mirror = client.write_mirror(mirror / "skills.json", {"skills": skills})

    result = ApplyResult(
        pack_dir=dest,
        mirror_dir=mirror,
        control_plane_url=client.base_url,
        notes=[
            "Local mirror is the durable record.",
            "Nothing is auto-enabled on the control plane.",
        ],
    )

    ingest_payload = {
        "tenant_id": tid if tid.isdigit() else 1,
        "employees": employees,
        "talent": talent,
        "plugins": plugins,
        "skills": skills,
        "mcp": mcp,
    }
    ingest = client.ingest(ingest_payload)
    if ingest.ok:
        landed = ingest.body.get("data") if isinstance(ingest.body, dict) else {}
        result.landed = landed if isinstance(landed, dict) else {}
        result.receipts.append(
            ApplyReceipt(
                surface="ingest",
                endpoint="/api/freeos/ingest",
                mirrored=str(emp_mirror),
                http=ingest,
                item_count=len(employees) + len(talent) + len(plugins) + len(skills) + len(mcp),
                landed=result.landed,
            )
        )
        result.notes.append("control plane accepted the FreeOS ingest")
        client.write_mirror(mirror / "apply-receipt.json", result.to_dict())
        return result

    if (
        client.base_url
        and ingest.reached
        and ingest.status_code in {401, 403}
        and client.ingest_token
    ):
        result.receipts.append(
            ApplyReceipt(
                surface="ingest",
                endpoint="/api/freeos/ingest",
                mirrored=str(emp_mirror),
                http=ingest,
                item_count=len(employees) + len(talent) + len(plugins) + len(skills) + len(mcp),
            )
        )
        result.notes.append("sidecar rejected the ingest token; mirror is complete")
        client.write_mirror(mirror / "apply-receipt.json", result.to_dict())
        return result
    if client.base_url and ingest.reached and ingest.status_code == 404:
        result.notes.append(
            "sidecar is up but FreeOS ingest API is missing; falling back to public routes"
        )
    elif client.base_url and ingest.reached and ingest.status_code in {401, 403}:
        result.notes.append("sidecar rejected the ingest token; falling back to public routes")

    for surface, endpoint, payload, mirrored, count in (
        ("employees", "/api/employees", employees_doc, emp_mirror, len(employees)),
        ("talent", "/api/talent", talent_doc, talent_mirror, len(talent)),
        ("plugins", "/api/plugins", plugins_doc, plugins_mirror, len(plugins)),
        ("skills", "/api/skills", {"skills": skills}, skills_mirror, len(skills)),
    ):
        http = client.request("POST", endpoint, payload=payload)
        if surface == "employees" and employees and client.base_url and not http.ok:
            for item in employees:
                client.request("POST", "/api/employees", payload=item)
        result.receipts.append(
            ApplyReceipt(
                surface=surface,
                endpoint=endpoint,
                mirrored=str(mirrored),
                http=http,
                item_count=count,
            )
        )

    receipt_path = mirror / "apply-receipt.json"
    client.write_mirror(receipt_path, result.to_dict())
    if result.remote_applied:
        result.notes.append("control plane accepted drafts on public routes")
    elif client.base_url and not result.remote_applied:
        result.notes.append(
            f"control plane at {client.base_url} did not accept drafts; mirror is complete"
        )
    elif not client.base_url:
        result.notes.append("OPENXYOS_BASE_URL unset; applied to local mirror only")
    return result


def import_applied_surfaces(
    home: Path,
    *,
    tenant_id: str = "",
    base_url: str = "",
) -> dict[str, Any]:
    """Read the durable mirror (and live HTTP when up) after apply.

    This is the inbound half of the apply+import roundtrip harness.
    """
    tid = tenant_id or "default"
    mirror = mirror_root(home, tid)
    client = OpenXyosControlClient(base_url, home=home)
    remote: dict[str, Any] = {}
    exported = client.export()
    if isinstance(exported, dict):
        remote = exported
        client.write_mirror(mirror / "imported-export.json", exported)
    elif client.base_url:
        for key, path in (
            ("employees", "/api/employees"),
            ("talent", "/api/talent"),
            ("plugins", "/api/plugins"),
            ("skills", "/api/skills"),
            ("module_settings", "/api/module-settings"),
            ("permissions", "/api/governance/permissions"),
        ):
            fetched = client.get_json(path)
            if fetched is not None:
                remote[key] = fetched
                client.write_mirror(mirror / f"imported-{key}.json", fetched)

    local: dict[str, Any] = {}
    for name in ("employees", "talent", "plugins", "skills", "apply-receipt"):
        raw = _load_json(mirror / f"{name}.json")
        if raw is not None:
            local[name.replace("-", "_")] = raw
    return {
        "tenant_id": tid,
        "mirror_dir": str(mirror),
        "control_plane_url": client.base_url,
        "local": local,
        "remote": remote,
    }
