"""Apply a ``freeos.asset-pack.v1`` onto openXYOS-shaped surfaces."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from octop.infra.utils.host_dirs import assert_safe_host_path
from octop.modules.org_os.apply.client import (
    ApplyReceipt,
    ApplyResult,
    OpenXyosControlClient,
    mirror_root,
)


def _safe_name(name: str) -> bool:
    if not name or name in {".", ".."}:
        return False
    return os.sep not in name and "/" not in name and "\\" not in name


def _load_json(path_s: str) -> Any:
    if not os.path.isfile(path_s):
        return None
    try:
        with open(path_s, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None


def _items(doc: Any, key: str) -> list[dict[str, Any]]:
    if isinstance(doc, dict) and isinstance(doc.get(key), list):
        return [item for item in doc[key] if isinstance(item, dict)]
    if isinstance(doc, list):
        return [item for item in doc if isinstance(item, dict)]
    return []


def apply_asset_pack(
    pack_dir: Path,
    *,
    home: Path,
    tenant_id: str = "",
    base_url: str = "",
    headers: dict[str, str] | None = None,
) -> ApplyResult:
    """Write local mirror + ingest drafts to the control plane when reachable.

    *pack_dir* is accepted for callers but never joined into filesystem
    paths — only ``{FREEOS_HOME}/asset-packs/latest`` is read (the loop
    and Organization page always publish there).
    """
    _ = pack_dir
    home_s = os.path.realpath(os.fspath(home))
    dest_s = os.path.realpath(os.path.join(home_s, "asset-packs", "latest"))
    if dest_s != home_s and not dest_s.startswith(home_s + os.sep):
        raise ValueError("asset pack is outside FREEOS_HOME")
    try:
        dest = assert_safe_host_path(dest_s, restrict_to_root=home_s)
    except ValueError as exc:
        raise ValueError("asset pack is outside FREEOS_HOME") from exc
    dest_s = os.path.realpath(os.fspath(dest))
    tid = tenant_id or "default"
    mirror = mirror_root(home, tid)
    mirror.mkdir(parents=True, exist_ok=True)
    client = OpenXyosControlClient(base_url, headers=headers, home=home)
    employees_s = os.path.realpath(os.path.join(dest_s, "openxyos", "org-employees.publish.json"))
    talent_s = os.path.realpath(os.path.join(dest_s, "openxyos", "org-talent.publish.json"))
    employees = (
        _items(_load_json(employees_s), "employees")
        if employees_s.startswith(dest_s + os.sep)
        else []
    )
    talent = _items(_load_json(talent_s), "talent") if talent_s.startswith(dest_s + os.sep) else []

    plugins: list[dict[str, Any]] = []
    openxyos_s = os.path.realpath(os.path.join(dest_s, "openxyos"))
    if openxyos_s.startswith(dest_s + os.sep) and os.path.isdir(openxyos_s):
        for child in sorted(os.listdir(openxyos_s)):
            if not _safe_name(child) or not child.endswith(".publish.json"):
                continue
            if child.startswith("org-employees") or child.startswith("org-talent"):
                continue
            path_s = os.path.realpath(os.path.join(openxyos_s, child))
            if not path_s.startswith(openxyos_s + os.sep) or not os.path.isfile(path_s):
                continue
            raw = _load_json(path_s)
            if isinstance(raw, dict):
                plugins.append(raw)

    skills: list[dict[str, Any]] = []
    skills_s = os.path.realpath(os.path.join(dest_s, "skills"))
    if skills_s.startswith(dest_s + os.sep) and os.path.isdir(skills_s):
        for child in sorted(os.listdir(skills_s)):
            if not _safe_name(child):
                continue
            skill_s = os.path.realpath(os.path.join(skills_s, child))
            if not skill_s.startswith(skills_s + os.sep) or not os.path.isdir(skill_s):
                continue
            manifest_s = os.path.realpath(os.path.join(skill_s, "SKILL.md"))
            if not manifest_s.startswith(skill_s + os.sep) or not os.path.isfile(manifest_s):
                continue
            try:
                with open(manifest_s, encoding="utf-8") as handle:
                    content = handle.read()[:8000]
            except OSError:
                continue
            skills.append(
                {
                    "name": child,
                    "slug": child,
                    "category": "FreeOS",
                    "content": content,
                    "source": "FreeOS",
                }
            )

    mcp: list[dict[str, Any]] = []
    mcp_s = os.path.realpath(os.path.join(dest_s, "mcps"))
    if mcp_s.startswith(dest_s + os.sep) and os.path.isdir(mcp_s):
        for child in sorted(os.listdir(mcp_s)):
            if not _safe_name(child) or not child.endswith(".json"):
                continue
            path_s = os.path.realpath(os.path.join(mcp_s, child))
            if not path_s.startswith(mcp_s + os.sep) or not os.path.isfile(path_s):
                continue
            raw = _load_json(path_s)
            if isinstance(raw, dict):
                mcp.append(
                    {
                        "name": os.path.splitext(child)[0],
                        "slug": os.path.splitext(child)[0],
                        "config_json": json.dumps(raw),
                    }
                )

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
            "Assets are visible on the logged-in tenant's Employees, Talent, Skills, and Plugins lists.",
        ],
    )

    ui_tenant = client.ui_tenant_id() if client.base_url else None
    if ui_tenant is not None:
        ingest_tenant: int | None = ui_tenant
    elif tid.isdigit() and int(tid) > 0:
        ingest_tenant = int(tid)
    else:
        ingest_tenant = None
    result.tenant_id = ingest_tenant

    ingest_payload: dict[str, Any] = {
        "employees": employees,
        "talent": talent,
        "plugins": plugins,
        "skills": skills,
        "mcp": mcp,
    }
    if ingest_tenant is not None:
        ingest_payload["tenant_id"] = ingest_tenant
    ingest = client.ingest(ingest_payload)
    if ingest.ok:
        landed = ingest.body.get("data") if isinstance(ingest.body, dict) else {}
        result.landed = landed if isinstance(landed, dict) else {}
        raw_tid = result.landed.get("tenant_id")
        if isinstance(raw_tid, int) and raw_tid > 0:
            result.tenant_id = raw_tid
        preview = result.landed.get("preview")
        if isinstance(preview, str) and preview.startswith("/"):
            result.preview_path = preview
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
    mirror_s = os.path.realpath(os.fspath(mirror))
    home_s = os.path.realpath(os.fspath(home))
    if mirror_s != home_s and not mirror_s.startswith(home_s + os.sep):
        mirror_s = ""
    for name in ("employees", "talent", "plugins", "skills", "apply-receipt"):
        if not mirror_s or not _safe_name(f"{name}.json"):
            continue
        path_s = os.path.realpath(os.path.join(mirror_s, f"{name}.json"))
        if not path_s.startswith(mirror_s + os.sep):
            continue
        raw = _load_json(path_s)
        if raw is not None:
            local[name.replace("-", "_")] = raw
    return {
        "tenant_id": tid,
        "mirror_dir": str(mirror),
        "control_plane_url": client.base_url,
        "local": local,
        "remote": remote,
    }
