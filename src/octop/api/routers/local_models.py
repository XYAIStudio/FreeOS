"""Desktop local-model probe and one-click Ollama install."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from octop.api.deps import current_user, get_server, require_permission
from octop.infra.agents.providers.local_probe import probe_local_models
from octop.infra.server import OctopServer
from octop.infra.utils.ollama_manager import OllamaModelManager

router = APIRouter()


class LocalInstallBody(BaseModel):
    name: str = Field(min_length=1, max_length=120, description="Ollama model tag to pull")


@router.get("/probe", summary="Scan hardware and already-installed local models")
async def local_models_probe(
    _: Any = Depends(current_user),
) -> dict[str, Any]:
    return await asyncio.to_thread(probe_local_models)


def _register_ollama_model(server: OctopServer, name: str) -> bool:
    services = getattr(server, "services", None)
    repo = getattr(services, "provider_repo", None) if services is not None else None
    if repo is None:
        return False
    model = {"id": name, "name": name, "enabled": True, "input": ["text"]}
    row = repo.get_by_name("ollama")
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
