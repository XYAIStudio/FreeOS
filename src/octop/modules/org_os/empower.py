"""One-click FreeOS ↔ openXYOS empowerment actions."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from octop.modules.org_os.apply.apply import apply_asset_pack
from octop.modules.org_os.assets.importer import import_openxyos_assets
from octop.modules.org_os.assets.pack import publish_asset_pack
from octop.modules.org_os.compiler.compile import compile_blueprint
from octop.modules.org_os.lifecycle.store import LifecycleStore
from octop.modules.org_os.lifecycle.transitions import register_compiled
from octop.modules.org_os.loop.fixtures import blueprint_fixture, extra_blueprint_fixtures
from octop.modules.org_os.runtime.spawn import list_spawned_agents, spawn_colleague_agent
from octop.modules.org_os.service import OrgModuleService


def assemble_from_blueprint(service: OrgModuleService) -> dict[str, Any]:
    """Import control-plane catalog/policies (when live) and compile real blueprints."""
    tid = service.tenant_id() or "default"
    sidecar = service.probe_sidecar()
    notes: list[str] = []
    employees: list[str] = []
    imported: dict[str, Any] | None = None
    if sidecar.reachable:
        inbound = import_openxyos_assets(
            service.home,
            tenant_id=tid,
            sidecar_url=service.sidecar_url(),
            catalog=True,
            from_sidecar=True,
        )
        imported = inbound.to_dict()
        employees.extend(inbound.employees)
        notes.extend(inbound.notes)
        notes.append("imported openXYOS catalog/policies from the live sidecar")
    else:
        notes.append("sidecar offline; compiling bundled openXYOS blueprint fixtures")

    store = LifecycleStore(service.home, tid)
    paths = [blueprint_fixture(), *extra_blueprint_fixtures()]
    for path in paths:
        compiled = compile_blueprint(
            path,
            home=service.home,
            tenant_id=tid,
            sidecar_url=service.sidecar_url(),
        )
        register_compiled(
            store,
            slug=compiled.slug,
            name=compiled.slug,
            workspace=compiled.workspace,
            lifecycle="draft",
        )
        employees.append(compiled.slug)
        notes.append(f"compiled blueprint {path.name} → {compiled.slug}")

    already = {row.slug for row in list_spawned_agents(service.home)}
    spawned: list[dict[str, Any]] = []
    for record in store.list():
        if record.slug in already:
            continue
        spawned.append(spawn_colleague_agent(service.home, record).to_dict())
    return {
        "sidecar_reachable": sidecar.reachable,
        "employees": list(dict.fromkeys(employees)),
        "spawned": spawned,
        "imported": imported,
        "notes": notes,
    }


def pack_to_openxyos(service: OrgModuleService) -> dict[str, Any]:
    """Publish a FreeOS asset pack and apply it to the local / live control plane."""
    pack = publish_asset_pack(service.home, tenant_id=service.tenant_id())
    sidecar = service.probe_sidecar()
    applied = apply_asset_pack(
        pack.directory,
        home=service.home,
        tenant_id=service.tenant_id() or "default",
        base_url=service.sidecar_url() if sidecar.reachable else "",
    )
    return {"pack": pack.to_dict(), "applied": applied.to_dict()}


def produce_from_corpus(
    service: OrgModuleService,
    *,
    kb_id: str = "",
    distill_path: str = "",
    ima_url: str = "",
    name: str = "",
) -> dict[str, Any]:
    """Build a digital employee from a local/cloud knowledge mount (ima pointer OK)."""
    from octop.infra.knowledge.local_mount import (
        attach_cloud_pointer,
        distill_readonly,
        load_mounts,
    )

    tid = service.tenant_id() or "default"
    dest = (
        Path(distill_path) if distill_path else (service.home / "org-corpus" / (kb_id or "default"))
    )
    dest.mkdir(parents=True, exist_ok=True)
    notes: list[str] = []
    copied = 0
    mounts = load_mounts(service.home)
    mount = mounts.get(kb_id) if kb_id else None
    cloud = ima_url or (mount.cloud_url if mount is not None else "")
    if cloud:
        pointer = attach_cloud_pointer(cloud, str(dest), provider="ima")
        copied = int(pointer.get("copied") or 0)
        notes.append(f"attached cloud corpus pointer → {dest}")
    elif mount is not None and mount.source_path:
        distilled = distill_readonly(mount.source_path, str(dest))
        copied = int(distilled.get("copied") or 0)
        notes.append(f"distilled {copied} corpus files → {dest}")
    else:
        notes.append("no knowledge mount; producing a corpus-ready colleague workspace")

    references: list[dict[str, str]] = []
    for path in sorted(dest.glob("*.md"))[:12]:
        excerpt = path.read_text(encoding="utf-8", errors="replace")[:1500]
        references.append({"name": path.stem, "excerpt": excerpt})
    capabilities = [item["name"] for item in references] or ["corpus-research", "org-writing"]
    colleague = name.strip() or (kb_id.replace("_", " ").strip() if kb_id else "Corpus Analyst")
    compiled = compile_blueprint(
        {
            "schema": "openxyos.agent-blueprint.v1",
            "name": colleague,
            "positioning": "Produces work from a distilled local or ima corpus.",
            "industry": "knowledge",
            "capabilities": capabilities,
            "ima": {"url": cloud, "status": "pointer"} if cloud else None,
            "references": references,
        },
        home=service.home,
        tenant_id=tid,
        sidecar_url=service.sidecar_url(),
    )
    store = LifecycleStore(service.home, tid)
    register_compiled(
        store,
        slug=compiled.slug,
        name=colleague,
        workspace=compiled.workspace,
        lifecycle="draft",
    )
    record = store.get(compiled.slug)
    if record is None:
        raise RuntimeError(f"failed to register colleague {compiled.slug}")
    spawned = spawn_colleague_agent(service.home, record)
    notes.append(f"compiled blueprint → {compiled.workspace}")
    notes.append(f"spawned FreeOS agent {spawned.agent_id}")
    return {
        "slug": compiled.slug,
        "workspace": str(compiled.workspace),
        "distill_path": str(dest),
        "copied": copied,
        "spawned": spawned.to_dict(),
        "notes": notes,
    }
