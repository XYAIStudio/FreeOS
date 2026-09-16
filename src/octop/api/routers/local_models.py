"""Desktop local-model probe, Ollama start/install, and weight discovery."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from octop.api.deps import current_user, get_server, require_permission
from octop.infra.agents.providers.local_probe import probe_local_models
from octop.infra.agents.providers.local_register import load_registered, register_local_weight
from octop.infra.agents.providers.local_scan import (
    cancel_scan_job,
    get_scan_job,
    latest_scan_job,
    start_scan_job,
)
from octop.infra.agents.providers.model_flags import is_ollama_local_provider
from octop.infra.agents.providers.ollama_install import ensure_ollama_runtime
from octop.infra.errors import ErrorCode, OctopError
from octop.infra.server import OctopServer
from octop.infra.utils.ollama_manager import OllamaModelManager, start_ollama_service_result

router = APIRouter()


class LocalInstallBody(BaseModel):
    name: str = Field(min_length=1, max_length=120, description="Ollama model tag to pull")


class LocalScanBody(BaseModel):
    root: str | None = Field(default=None, max_length=1024, description="Optional folder to scan")
    full_disk: bool = Field(
        default=False,
        description="Walk every drive / filesystem root. Slow; skip unless the user opts in.",
    )


class LocalRegisterBody(BaseModel):
    path: str = Field(
        min_length=1, max_length=1024, description="Absolute path to a GGUF/GGML file"
    )
    name: str | None = Field(default=None, max_length=80, description="Ollama model name to create")
    source: str = Field(default="gguf", max_length=32, description="gguf, ggml, or safetensors")
    size: int = Field(default=0, ge=0, description="Size in bytes from the scan result")


class LocalEnsureBody(BaseModel):
    install: bool = Field(
        default=False,
        description="When true, try one automated Ollama install if the binary is missing",
    )


def _merge_registered(probe: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any]:
    installed = list(probe.get("installed") or [])
    seen = {str(item.get("path") or item.get("name") or "") for item in installed}
    for row in rows:
        key = str(row.get("path") or row.get("name") or "")
        if key and key in seen:
            continue
        installed.append(row)
        if key:
            seen.add(key)
    probe["installed"] = installed
    return probe


@router.get("/probe", summary="Scan hardware and already-installed local models")
async def local_models_probe(
    _: Any = Depends(current_user),
    server: Any = Depends(get_server),
) -> dict[str, Any]:
    payload = await asyncio.to_thread(probe_local_models)
    registered = await asyncio.to_thread(load_registered, server.services.settings_repo)
    return _merge_registered(payload, registered)


@router.post("/start-ollama", summary="Start the installed Ollama app or daemon")
async def local_models_start_ollama(
    _: Any = Depends(require_permission("ollama_models")),
) -> dict[str, Any]:
    """Launch Ollama only when it is already installed. Does not download it."""
    return await asyncio.to_thread(start_ollama_service_result)


@router.post(
    "/ensure-deps", summary="Start Ollama, or one-click install when FreeOS can automate it"
)
async def local_models_ensure_deps(
    body: LocalEnsureBody,
    _: Any = Depends(require_permission("ollama_models")),
) -> dict[str, Any]:
    return await asyncio.to_thread(ensure_ollama_runtime, install=body.install)


def _register_ollama_model(server: OctopServer, name: str) -> bool:
    services = getattr(server, "services", None)
    repo = getattr(services, "provider_repo", None) if services is not None else None
    if repo is None:
        return False
    model = {"id": name, "name": name, "enabled": True, "input": ["text"]}
    row = None
    for candidate in repo.list_all():
        if is_ollama_local_provider(
            candidate.name,
            provider_api_key=candidate.api_key,
            provider_base_url=candidate.base_url,
        ):
            row = candidate
            break
    if row is None:
        repo.create(
            name="ollama",
            kind="ollama",
            base_url="http://127.0.0.1:11434/v1",
            api_key="ollama",
            models_json=json.dumps([model]),
            note="Registered by one-click local model install",
        )
        return True
    models = row.get_models()
    if any(str(item.get("id") or "") == name for item in models if isinstance(item, dict)):
        return False
    models.append(model)
    repo.update(row.id, models_json=json.dumps(models))
    return True


@router.post("/install", summary="Download and register a recommended Ollama model")
async def local_models_install(
    body: LocalInstallBody,
    server: OctopServer = Depends(get_server),
    _: Any = Depends(require_permission("ollama_models")),
) -> dict[str, Any]:
    runtime = await asyncio.to_thread(ensure_ollama_runtime, install=False)
    if not runtime.get("running"):
        return {
            "ok": False,
            "name": body.name,
            **runtime,
        }
    try:
        info = await asyncio.to_thread(OllamaModelManager.pull_model, body.name)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    registered = _register_ollama_model(server, info.name or body.name)
    return {
        "ok": True,
        "name": info.name,
        "size": info.size,
        "source": "ollama",
        "registered": registered,
    }


@router.post("/scan", summary="Start a background scan for local GGUF / GGML weights")
async def local_models_scan(
    body: LocalScanBody,
    _: Any = Depends(require_permission("ollama_models")),
) -> dict[str, Any]:
    job = start_scan_job(root=body.root, full_disk=body.full_disk)
    return job.snapshot()


@router.get("/scan", summary="Latest local-weight scan job")
async def local_models_scan_latest(
    _: Any = Depends(require_permission("ollama_models")),
) -> dict[str, Any]:
    job = latest_scan_job()
    if job is None:
        return {"job_id": None, "status": "idle", "found": []}
    return job.snapshot()


@router.get("/scan/{job_id}", summary="Poll a local-weight scan job")
async def local_models_scan_status(
    job_id: str,
    _: Any = Depends(require_permission("ollama_models")),
) -> dict[str, Any]:
    job = get_scan_job(job_id)
    if job is None:
        raise OctopError(ErrorCode.NOT_FOUND, "scan job not found")
    return job.snapshot()


@router.delete("/scan/{job_id}", summary="Cancel a running local-weight scan")
async def local_models_scan_cancel(
    job_id: str,
    _: Any = Depends(require_permission("ollama_models")),
) -> dict[str, Any]:
    if not cancel_scan_job(job_id):
        raise OctopError(ErrorCode.NOT_FOUND, "scan job not found")
    job = get_scan_job(job_id)
    return job.snapshot() if job is not None else {"job_id": job_id, "status": "cancelled"}


@router.post("/register", summary="Import a discovered GGUF/GGML file into Ollama")
async def local_models_register(
    body: LocalRegisterBody,
    server: Any = Depends(get_server),
    _: Any = Depends(require_permission("ollama_models")),
) -> dict[str, Any]:
    try:
        result = await asyncio.to_thread(
            register_local_weight,
            path=body.path,
            name=body.name,
            source=body.source,
            size=body.size,
            provider_repo=server.services.provider_repo,
            settings_repo=server.services.settings_repo,
        )
    except OSError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if server.app_runtime is not None and result.get("ok"):
        await server.app_runtime.agent_registry.on_provider_changed(
            provider_name=str(result.get("provider_name") or "Ollama (Local)")
        )
    return result
