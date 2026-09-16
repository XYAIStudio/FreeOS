"""Desktop local-model probe and one-click Ollama install."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from octop.api.deps import current_user, require_permission
from octop.infra.agents.providers.local_probe import probe_local_models
from octop.infra.utils.ollama_manager import OllamaModelManager

router = APIRouter()


class LocalInstallBody(BaseModel):
    name: str = Field(min_length=1, max_length=120, description="Ollama model tag to pull")


@router.get("/probe", summary="Scan hardware and already-installed local models")
async def local_models_probe(
    _: Any = Depends(current_user),
) -> dict[str, Any]:
    return await asyncio.to_thread(probe_local_models)


@router.post("/install", summary="Download and register a recommended Ollama model")
async def local_models_install(
    body: LocalInstallBody,
    _: Any = Depends(require_permission("ollama_models")),
) -> dict[str, Any]:
    try:
        info = await asyncio.to_thread(OllamaModelManager.pull_model, body.name)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "ok": True,
        "name": info.name,
        "size": info.size,
        "source": "ollama",
    }
