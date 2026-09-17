"""Desktop local-model probe, Ollama start/install, and weight discovery."""

from __future__ import annotations

import asyncio
import logging
import subprocess
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from octop.api.deps import current_user, get_server, require_permission
from octop.infra.agents.providers.local_default import (
    annotate_local_models,
    provider_base_url,
    resolve_local_model_ref,
    resolve_registered_or_usable,
)
from octop.infra.agents.providers.local_probe import probe_local_models
from octop.infra.agents.providers.local_register import (
    ensure_ollama_service_flag,
    find_ollama_row,
    load_registered,
    register_local_weight,
    upsert_ollama_model,
)
from octop.infra.agents.providers.local_scan import (
    cancel_scan_job,
    get_scan_job,
    latest_scan_job,
    start_scan_job,
)
from octop.infra.agents.providers.local_speed import speed_test_local_model
from octop.infra.agents.providers.ollama_install import ensure_ollama_runtime
from octop.infra.errors import ErrorCode, OctopError
from octop.infra.server import OctopServer
from octop.infra.utils.ollama_manager import OllamaModelManager, start_ollama_service_result

logger = logging.getLogger(__name__)

_REGISTER_FAIL_TYPES = (
    OSError,
    UnicodeError,
    TimeoutError,
    ValueError,
    RuntimeError,
    TypeError,
    AttributeError,
    ImportError,
    subprocess.SubprocessError,
)

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
        default="",
        max_length=1024,
        description="Absolute path to a GGUF/GGML file; empty for an already-pulled Ollama tag",
    )
    name: str | None = Field(default=None, max_length=80, description="Ollama model name to create")
    source: str = Field(
        default="gguf",
        max_length=32,
        description="gguf, ggml, safetensors, or ollama",
    )
    size: int = Field(default=0, ge=0, description="Size in bytes from the scan result")


class LocalEnsureBody(BaseModel):
    install: bool = Field(
        default=False,
        description="When true, try one automated Ollama install if the binary is missing",
    )


class LocalSpeedTestBody(BaseModel):
    name: str = Field(min_length=1, max_length=120, description="Local model tag to ping")


class LocalDefaultBody(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=120,
        description="Registered local model to use as the chat default",
    )


def register_failure(exc: BaseException) -> OctopError:
    """Map a recoverable register/import failure to a 400 the UI can show."""
    reason = str(exc).strip() or exc.__class__.__name__
    return OctopError(
        ErrorCode.LOCAL_MODEL_REGISTER_FAILED,
        reason,
        details={"reason": reason},
    )


def _merge_registered(probe: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any]:
    installed = list(probe.get("installed") or [])
    registered_names = {str(row.get("name") or "") for row in rows if row.get("name")}
    registered_paths = {str(row.get("path") or "") for row in rows if row.get("path")}
    seen = {str(item.get("path") or item.get("name") or "") for item in installed}
    for item in installed:
        name = str(item.get("name") or "")
        path = str(item.get("path") or "")
        if name in registered_names or (path and path in registered_paths):
            item["registered"] = True
            item["registerable"] = False
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
    user: Any = Depends(current_user),
    server: Any = Depends(get_server),
) -> dict[str, Any]:
    payload = await asyncio.to_thread(probe_local_models)
    registered = await asyncio.to_thread(load_registered, server.services.settings_repo)
    merged = _merge_registered(payload, registered)
    user_row = server.services.user_repo.get(user.id)
    return annotate_local_models(
        merged,
        provider_repo=server.services.provider_repo,
        settings_repo=server.services.settings_repo,
        user_preferences_json=user_row.preferences_json if user_row else None,
    )


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


def _register_installed_ollama(server: OctopServer, name: str) -> str:
    """Persist *name* on the shared Ollama provider and mark the runtime on."""
    services = getattr(server, "services", None)
    repo = getattr(services, "provider_repo", None) if services is not None else None
    if repo is None:
        raise OSError("provider store is not available")
    provider_name = upsert_ollama_model(repo, name, name)
    settings = getattr(services, "settings_repo", None)
    if settings is not None:
        ensure_ollama_service_flag(settings)
    return provider_name


async def _reload_after_register(server: OctopServer, provider_name: str, model_name: str) -> None:
    if server.app_runtime is None:
        return
    try:
        await server.app_runtime.agent_registry.on_provider_changed(provider_name=provider_name)
    except Exception as exc:
        logger.warning("Registered %s but provider reload failed: %s", model_name, exc)


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
        raise register_failure(exc) from exc
    model_name = info.name or body.name
    try:
        provider_name = _register_installed_ollama(server, model_name)
    except Exception as exc:
        raise register_failure(exc) from exc
    await _reload_after_register(server, provider_name, model_name)
    return {
        "ok": True,
        "name": model_name,
        "size": info.size,
        "source": "ollama",
        "registered": True,
        "provider_name": provider_name,
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
    except _REGISTER_FAIL_TYPES as exc:
        raise register_failure(exc) from exc
    if result.get("ok"):
        await _reload_after_register(
            server,
            str(result.get("provider_name") or "Ollama (Local)"),
            str(result.get("name") or body.name or ""),
        )
    return result


def _local_runtime_url(server: Any) -> str | None:
    return provider_base_url(find_ollama_row(server.services.provider_repo))


async def _apply_local_default(
    server: Any,
    user: Any,
    *,
    provider_name: str,
    model_id: str,
) -> None:
    ref = f"{provider_name}/{model_id}"
    await server.user_manager.set_model_preferences(user.username, preferred_model=ref)
    server.services.settings_repo.set_active_model(provider_name, model_id)
    if server.app_runtime is not None:
        await server.app_runtime.agent_registry.on_provider_changed(active_model_changed=True)


@router.post("/speed-test", summary="Measure latency and tokens/sec for a local model")
async def local_models_speed_test(
    body: LocalSpeedTestBody,
    server: Any = Depends(get_server),
    _: Any = Depends(require_permission("ollama_models")),
) -> dict[str, Any]:
    """Ping Ollama ``/api/generate`` (or chat completions) with a tiny fixed prompt."""
    resolved = resolve_local_model_ref(server.services.provider_repo, body.name)
    model_id = resolved[1] if resolved is not None else body.name.strip()
    result = await speed_test_local_model(name=model_id, base_url=_local_runtime_url(server))
    result["name"] = model_id
    if resolved is not None:
        result["provider_name"] = resolved[0]
    return result


@router.put("/default", summary="Set a registered local model as the chat default")
async def local_models_set_default(
    body: LocalDefaultBody,
    user: Any = Depends(require_permission("ollama_models")),
    server: Any = Depends(get_server),
) -> dict[str, Any]:
    """Store the model as the user preferred model and the global active model.

    Allowed when the tag is registered or already enabled on the local provider.
    Ollama does not need to be running.
    """
    resolved = resolve_registered_or_usable(
        provider_repo=server.services.provider_repo,
        settings_repo=server.services.settings_repo,
        name=body.name,
    )
    if resolved is None:
        return {
            "ok": False,
            "action": "not_registered",
            "error": "Register this local model before setting it as the default.",
            "next_step": "Register this local model before setting it as the default.",
            "name": body.name,
        }
    provider_name, model_id = resolved
    await _apply_local_default(server, user, provider_name=provider_name, model_id=model_id)
    ref = f"{provider_name}/{model_id}"
    return {
        "ok": True,
        "action": "default",
        "name": model_id,
        "provider_name": provider_name,
        "ref": ref,
        "preferred_model": ref,
    }


@router.delete("/default", summary="Clear the local model as the chat default")
async def local_models_clear_default(
    name: str | None = Query(default=None, description="Clear only when the active model matches"),
    user: Any = Depends(require_permission("ollama_models")),
    server: Any = Depends(get_server),
) -> dict[str, Any]:
    """Clear the per-user preferred model; also drop the global active model if it matches."""
    await server.user_manager.set_model_preferences(user.username, preferred_model=None)
    active_name, active_model = server.services.settings_repo.get_active_model()
    should_clear_active = True
    if name and name.strip():
        resolved = resolve_local_model_ref(server.services.provider_repo, name.strip())
        should_clear_active = active_model == name.strip() or resolved == (
            active_name,
            active_model,
        )
    if should_clear_active and active_name and active_model:
        server.services.settings_repo.delete("active_model")
    if server.app_runtime is not None:
        await server.app_runtime.agent_registry.on_provider_changed(active_model_changed=True)
    return {
        "ok": True,
        "action": "cleared",
        "name": name,
    }
