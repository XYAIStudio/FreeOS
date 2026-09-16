"""HTTP surface for local AI-app skill / plugin / MCP discovery."""

from __future__ import annotations

import asyncio
from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from octop.api.deps import current_user, get_server
from octop.infra.connectors.service import ConnectorService
from octop.infra.errors import ErrorCode, OctopError
from octop.infra.host_apps.register import import_mcp, import_plugin, import_skill
from octop.infra.host_apps.scan import scan_host_apps
from octop.infra.server import OctopServer
from octop.infra.skills.skill_package_store import SkillPackageStore
from octop.infra.users.identity import User

router = APIRouter()


class ImportBody(BaseModel):
    host_id: str = Field(min_length=1)
    item_id: str = Field(min_length=1)
    kind: Literal["skill", "plugin", "mcp"]


def _package_store(server: OctopServer) -> SkillPackageStore:
    if server.services is None:
        raise OctopError(ErrorCode.INTERNAL_ERROR, "services not initialized")
    return SkillPackageStore(
        repo=server.services.skill_package_repo,
        root=server.paths.skill_packages_dir,
    )


def _connector_service(server: OctopServer) -> ConnectorService:
    if server.services is None:
        raise OctopError(ErrorCode.INTERNAL_ERROR, "services not initialized")
    return ConnectorService(
        repo=server.services.repos.connector_repo,
        secret_repo=server.services.secret_repo,
        settings_repo=server.services.settings_repo,
        config=server.services.config,
    )


@router.get("/host-apps", summary="Scan local AI apps for skills, plugins, and MCP configs")
async def list_host_apps(
    _: User = Depends(current_user),
) -> dict[str, Any]:
    reports = await asyncio.to_thread(lambda: [row.to_dict() for row in scan_host_apps()])
    return {"hosts": reports, "readonly": True}


@router.post("/host-apps/import", summary="Register a discovered skill, plugin, or MCP into FreeOS")
async def import_host_app_item(
    body: ImportBody,
    user: User = Depends(current_user),
    server: OctopServer = Depends(get_server),
) -> dict[str, Any]:
    """Copy or register into FreeOS only. Never writes the third-party install."""

    def _run() -> dict[str, Any]:
        if body.kind == "mcp":
            return import_mcp(
                host_id=body.host_id,
                item_id=body.item_id,
                connector_service=_connector_service(server),
                user_id=user.id,
            )
        store = _package_store(server)
        if body.kind == "skill":
            return import_skill(
                host_id=body.host_id,
                item_id=body.item_id,
                store=store,
                created_by=str(user.id),
            )
        if server.plugin_manager is None:
            raise OctopError(ErrorCode.INTERNAL_ERROR, "plugin manager not initialized")
        return import_plugin(
            host_id=body.host_id,
            item_id=body.item_id,
            plugin_manager=server.plugin_manager,
            store=store,
            created_by=str(user.id),
        )

    return await asyncio.to_thread(_run)
