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


def _plugin_payloads(dest_s: str) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []
    openxyos_s = os.path.realpath(os.path.join(dest_s, "openxyos"))
    if openxyos_s != dest_s and not openxyos_s.startswith(dest_s + os.sep):
        return payloads
    if not os.path.isdir(openxyos_s):
        return payloads
    for name in sorted(os.listdir(openxyos_s)):
        if not _safe_name(name) or not name.endswith(".publish.json"):
            continue
        if name.startswith("org-employees") or name.startswith("org-talent"):
            continue
        path_s = os.path.realpath(os.path.join(openxyos_s, name))
        if not path_s.startswith(openxyos_s + os.sep):
            continue
        if not os.path.isfile(path_s):
            continue
        raw = _load_json(path_s)
        if isinstance(raw, dict):
            payloads.append(raw)
    return payloads


def _skill_payloads(dest_s: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    skills_s = os.path.realpath(os.path.join(dest_s, "skills"))
    if skills_s != dest_s and not skills_s.startswith(dest_s + os.sep):
        return out
    if not os.path.isdir(skills_s):
        return out
    for name in sorted(os.listdir(skills_s)):
        if not _safe_name(name):
            continue
        skill_s = os.path.realpath(os.path.join(skills_s, name))
        if not skill_s.startswith(skills_s + os.sep):
            continue
        if not os.path.isdir(skill_s):
            continue
        manifest_s = os.path.realpath(os.path.join(skill_s, "SKILL.md"))
        if not manifest_s.startswith(skill_s + os.sep):
            continue
        if not os.path.isfile(manifest_s):
            continue
        try:
            with open(manifest_s, encoding="utf-8") as handle:
                content = handle.read()[:8000]
        except OSError:
            continue
        out.append(
            {
                "name": name,
                "slug": name,
                "category": "FreeOS",
                "content": content,
                "source": "FreeOS",
            }
        )
    return out


def _mcp_payloads(dest_s: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    mcp_s = os.path.realpath(os.path.join(dest_s, "mcps"))
    if mcp_s != dest_s and not mcp_s.startswith(dest_s + os.sep):
        return out
    if not os.path.isdir(mcp_s):
        return out
    for name in sorted(os.listdir(mcp_s)):
        if not _safe_name(name) or not name.endswith(".json"):
            continue
        path_s = os.path.realpath(os.path.join(mcp_s, name))
        if not path_s.startswith(mcp_s + os.sep):
            continue
        if not os.path.isfile(path_s):
            continue
        raw = _load_json(path_s)
        if isinstance(raw, dict):
            out.append(
                {
                    "name": os.path.splitext(name)[0],
                    "slug": os.path.splitext(name)[0],
                    "config_json": json.dumps(raw),
                }
            )
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
    try:
        dest = assert_safe_host_path(os.fspath(pack_dir), restrict_to_root=os.fspath(home))
    except ValueError as exc:
        raise ValueError("asset pack is outside FREEOS_HOME") from exc
    dest_s = os.path.realpath(os.fspath(dest))
    home_s = os.path.realpath(os.fspath(home))
    if dest_s != home_s and not dest_s.startswith(home_s + os.sep):
        raise ValueError("asset pack is outside FREEOS_HOME")
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
    plugins = _plugin_payloads(dest_s)
    skills = _skill_payloads(dest_s)
    mcp = _mcp_payloads(dest_s)

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
