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
from octop.modules.org_os.catalog import catalog_keys


def _load_json(path: Path) -> Any:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def _module_settings_payload(tenant_id: str) -> dict[str, Any]:
    updates = dict.fromkeys(catalog_keys(), False)
    return {
        "enabled_by_default": False,
        "tenant_id": tenant_id,
        "updates": updates,
        "note": "Drafts only. Operator must toggle each module on.",
    }


def apply_asset_pack(
    pack_dir: Path,
    *,
    home: Path,
    tenant_id: str = "",
    base_url: str = "",
    headers: dict[str, str] | None = None,
) -> ApplyResult:
    """Write local mirror + POST/PUT drafts to module-settings/plugins/employees/talent."""
    dest = pack_dir if pack_dir.is_dir() else Path(pack_dir)
    tid = tenant_id or "default"
    mirror = mirror_root(home, tid)
    mirror.mkdir(parents=True, exist_ok=True)
    client = OpenXyosControlClient(base_url, headers=headers)
    result = ApplyResult(
        pack_dir=dest,
        mirror_dir=mirror,
        control_plane_url=client.base_url,
        notes=[
            "Local mirror is the durable record. HTTP apply is best-effort.",
            "Nothing is auto-enabled on the control plane.",
        ],
    )

    employees_src = dest / "openxyos" / "org-employees.publish.json"
    employees = _load_json(employees_src) or {"employees": []}
    emp_mirror = client.write_mirror(mirror / "employees.json", employees)
    emp_items = employees.get("employees") if isinstance(employees, dict) else []
    if not isinstance(emp_items, list):
        emp_items = []
    http = client.request(
        "POST",
        "/api/employees",
        payload={
            "employees": emp_items,
            "enabled_by_default": False,
            "source": "freeos.asset-pack.v1",
        },
    )
    if emp_items and client.base_url:
        # Also upsert each employee the way openXYOS POST /api/employees expects.
        for item in emp_items:
            if isinstance(item, dict):
                client.request("POST", "/api/employees", payload=item)
    result.receipts.append(
        ApplyReceipt(
            surface="employees",
            endpoint="/api/employees",
            mirrored=str(emp_mirror),
            http=http,
            item_count=len(emp_items),
        )
    )

    talent_src = dest / "openxyos" / "org-talent.publish.json"
    talent = _load_json(talent_src) or {"talent": []}
    talent_mirror = client.write_mirror(mirror / "talent.json", talent)
    talent_items = talent.get("talent") if isinstance(talent, dict) else []
    if not isinstance(talent_items, list):
        talent_items = []
    http = client.request(
        "POST",
        "/api/talent",
        payload={
            "talent": talent_items,
            "enabled_by_default": False,
            "source": "freeos.asset-pack.v1",
        },
    )
    result.receipts.append(
        ApplyReceipt(
            surface="talent",
            endpoint="/api/talent",
            mirrored=str(talent_mirror),
            http=http,
            item_count=len(talent_items),
        )
    )

    plugin_payloads: list[dict[str, Any]] = []
    openxyos_dir = dest / "openxyos"
    if openxyos_dir.is_dir():
        for path in sorted(openxyos_dir.glob("*.publish.json")):
            if path.name.startswith("org-employees") or path.name.startswith("org-talent"):
                continue
            raw = _load_json(path)
            if isinstance(raw, dict):
                plugin_payloads.append(raw)
    plugins_doc = {"enabled_by_default": False, "plugins": plugin_payloads}
    plugins_mirror = client.write_mirror(mirror / "plugins.json", plugins_doc)
    http = client.request("POST", "/api/plugins", payload=plugins_doc)
    result.receipts.append(
        ApplyReceipt(
            surface="plugins",
            endpoint="/api/plugins",
            mirrored=str(plugins_mirror),
            http=http,
            item_count=len(plugin_payloads),
        )
    )

    settings = _module_settings_payload(tid)
    settings_mirror = client.write_mirror(mirror / "module-settings.json", settings)
    http = client.request("PUT", "/api/module-settings", payload=settings)
    result.receipts.append(
        ApplyReceipt(
            surface="module-settings",
            endpoint="/api/module-settings",
            mirrored=str(settings_mirror),
            http=http,
            item_count=len(settings.get("updates") or {}),
        )
    )

    receipt_path = mirror / "apply-receipt.json"
    client.write_mirror(receipt_path, result.to_dict())
    if client.base_url and not result.remote_applied:
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
    client = OpenXyosControlClient(base_url)
    remote: dict[str, Any] = {}
    if client.base_url:
        for key, path in (
            ("employees", "/api/employees"),
            ("talent", "/api/talent"),
            ("plugins", "/api/plugins"),
            ("module_settings", "/api/module-settings"),
            ("permissions", "/api/governance/permissions"),
        ):
            fetched = client.get_json(path)
            if fetched is not None:
                remote[key] = fetched
                client.write_mirror(mirror / f"imported-{key}.json", fetched)

    local: dict[str, Any] = {}
    for name in ("employees", "talent", "plugins", "module-settings", "apply-receipt"):
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
