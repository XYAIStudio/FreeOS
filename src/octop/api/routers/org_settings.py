"""In-host organization-module settings — catalog toggles + org-local prefs.

This is **not** FreeOS system settings (LLM keys, users, timezone, models).
Module on/off flags reuse ``GET/PUT /api/org-module/modules``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from octop.api.deps import current_user, get_server
from octop.i18n import tr
from octop.infra.server import OctopServer
from octop.infra.utils.locale import resolve_request_locale
from octop.modules.org_os.catalog import OPENXYOS_MODULES
from octop.modules.org_os.module_toggles import load_module_toggles
from octop.modules.org_os.prefs import load_org_prefs, save_org_prefs
from octop.modules.org_os.service import org_module_from_paths

router = APIRouter()

SYSTEM_SETTINGS = {
    "overview": "/system-settings",
    "models": "/system-settings/models",
    "users": "/system-settings/users",
}

NOT_ON_THIS_PAGE = ("llm_keys", "users", "timezone", "models", "security")


class OrgPrefsBody(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=800)


def _locale(request: Request) -> str:
    return resolve_request_locale(request)


def _fail(request: Request, key: str, status: int) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"success": False, "error": tr(key, _locale(request))},
    )


def _ok(data: Any = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"success": True}
    if data is not None:
        payload["data"] = data
    return payload


def _home(server: OctopServer) -> Path:
    return Path(org_module_from_paths(server.paths).home)


def _can_write(user: Any) -> bool:
    return bool(getattr(user, "is_admin", False))


def _snapshot(server: OctopServer) -> dict[str, Any]:
    home = _home(server)
    return {
        "scope": "org_module",
        "catalog": list(OPENXYOS_MODULES),
        "modules": load_module_toggles(home),
        "prefs": load_org_prefs(home),
        "system_settings": dict(SYSTEM_SETTINGS),
        "not_on_this_page": list(NOT_ON_THIS_PAGE),
    }


@router.get("/settings", summary="Organization-module settings snapshot")
async def get_org_settings(
    server: OctopServer = Depends(get_server),
    _user: Any = Depends(current_user),
) -> dict[str, Any]:
    """Catalog, module toggles, and org-local prefs. Not FreeOS system settings."""
    return _ok(_snapshot(server))


@router.put("/prefs", summary="Save organization-local preferences", response_model=None)
async def put_org_prefs(
    body: OrgPrefsBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any] | JSONResponse:
    if not _can_write(user):
        return _fail(request, "org.settings.forbidden", 403)
    try:
        saved = save_org_prefs(_home(server), body.model_dump(exclude_unset=True))
    except ValueError:
        return _fail(request, "org.settings.invalid", 400)
    return _ok(saved)
