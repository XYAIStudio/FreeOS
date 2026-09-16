"""One-click FreeOS ↔ openXYOS empowerment actions."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from octop.infra.utils.host_dirs import assert_safe_host_path
from octop.modules.org_os.apply.apply import apply_asset_pack
from octop.modules.org_os.assets.importer import import_openxyos_assets
from octop.modules.org_os.assets.pack import publish_asset_pack
from octop.modules.org_os.compiler.compile import compile_blueprint
from octop.modules.org_os.lifecycle.store import LifecycleStore
from octop.modules.org_os.lifecycle.transitions import register_compiled
from octop.modules.org_os.loop.fixtures import blueprint_fixture, extra_blueprint_fixtures
from octop.modules.org_os.runtime.spawn import list_spawned_agents, spawn_colleague_agent
from octop.modules.org_os.service import OrgModuleService


def _corpus_dest(home: Path) -> str:
    """Return ``{FREEOS_HOME}/org-corpus/default`` only — no user path fragments."""
    home_s = os.path.realpath(os.fspath(home))
    dest_s = os.path.realpath(os.path.join(home_s, "org-corpus", "default"))
    if dest_s != home_s and not dest_s.startswith(home_s + os.sep):
        raise ValueError("corpus dest is outside FREEOS_HOME")
    dest = assert_safe_host_path(dest_s, restrict_to_root=home_s)
    dest_s = os.path.realpath(os.fspath(dest))
    os.makedirs(dest_s, exist_ok=True)
    return dest_s


def _corpus_excerpts(dest_s: str) -> list[dict[str, str]]:
    references: list[dict[str, str]] = []
    if not os.path.isdir(dest_s):
        return references
    for child in sorted(os.listdir(dest_s)):
        if not child.endswith(".md") or child in {".", ".."}:
            continue
        if os.sep in child or "/" in child or "\\" in child:
            continue
        path_s = os.path.realpath(os.path.join(dest_s, child))
        if not path_s.startswith(dest_s + os.sep) or not os.path.isfile(path_s):
            continue
        try:
            with open(path_s, encoding="utf-8") as handle:
                excerpt = handle.read()[:1500]
        except OSError:
            continue
        references.append({"name": os.path.splitext(child)[0], "excerpt": excerpt})
        if len(references) >= 12:
            break
    return references


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
    """Build an expert / assistant from a local/cloud knowledge mount (ima pointer OK)."""
    from octop.infra.knowledge.local_mount import (
        attach_cloud_pointer,
        distill_readonly,
        load_mounts,
    )

    # Caller-supplied distill_path is accepted but never joined into filesystem
    # paths — only ``{FREEOS_HOME}/org-corpus/<safe-id>`` is written.
    _ = distill_path
    tid = service.tenant_id() or "default"
    dest_s = _corpus_dest(service.home)
    notes: list[str] = []
    copied = 0
    mounts = load_mounts(service.home)
    mount = mounts.get(kb_id) if kb_id else None
    cloud = ima_url or (mount.cloud_url if mount is not None else "")
    if cloud:
        pointer = attach_cloud_pointer(cloud, dest_s, provider="ima")
        copied = int(pointer.get("copied") or 0)
        notes.append(f"attached cloud corpus pointer → {dest_s}")
    elif mount is not None and mount.source_path:
        distilled = distill_readonly(mount.source_path, dest_s)
        copied = int(distilled.get("copied") or 0)
        notes.append(f"distilled {copied} corpus files → {dest_s}")
    else:
        notes.append("no knowledge mount; producing a corpus-ready expert workspace")

    references = _corpus_excerpts(dest_s)
    capabilities = [item["name"] for item in references] or ["corpus-research", "org-writing"]
    expert = name.strip() or (kb_id.replace("_", " ").strip() if kb_id else "Corpus Analyst")
    compiled = compile_blueprint(
        {
            "schema": "openxyos.agent-blueprint.v1",
            "name": expert,
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
        name=expert,
        workspace=compiled.workspace,
        lifecycle="draft",
    )
    record = store.get(compiled.slug)
    if record is None:
        raise RuntimeError(f"failed to register expert {compiled.slug}")
    spawned = spawn_colleague_agent(service.home, record)
    notes.append(f"compiled blueprint → {compiled.workspace}")
    notes.append(f"spawned FreeOS assistant {spawned.agent_id}")
    return {
        "slug": compiled.slug,
        "workspace": str(compiled.workspace),
        "distill_path": dest_s,
        "copied": copied,
        "spawned": spawned.to_dict(),
        "notes": notes,
    }
