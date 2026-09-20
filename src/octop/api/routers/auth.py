"""Login / logout / me / change-password."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field

from octop.api.deps import current_user, get_server, sign_token
from octop.infra.errors import ErrorCode, OctopError
from octop.infra.users.local_session import (
    claim_local_account,
    ensure_local_user,
    is_desktop_process,
    is_unclaimed_local_user,
    request_looks_local,
)
from octop.infra.users.permissions import effective_permissions
from octop.infra.utils.locale import normalize_locale, resolve_request_locale

router = APIRouter()
logger = logging.getLogger(__name__)


def _is_local_client(request: Request) -> bool:
    return request_looks_local(
        client_host=(request.client.host if request.client else "") or "",
        forwarded_for=request.headers.get("x-forwarded-for") or "",
        http_host=request.headers.get("host") or "",
        origin=request.headers.get("origin") or "",
        referer=request.headers.get("referer") or "",
    )


def _user_json(
    user: Any, server: Any | None = None, *, locale: str | None = None
) -> dict[str, Any]:
    loc = normalize_locale(locale)
    is_local = bool(server is not None and is_unclaimed_local_user(server, user))
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role.value,
        "display_name": user.display_name,
        "locale": loc,
        "permissions": effective_permissions(user),
        "is_local": is_local,
        "organization_id": getattr(user, "organization_id", None),
        "organization_user_id": getattr(user, "organization_user_id", None),
        "organization_role": getattr(user, "organization_role", None),
    }


def _login_payload(server: Any, user: Any) -> dict[str, Any]:
    secret = server.services.secret_repo.get("jwt")
    ttl = server.services.config.access_token_ttl_seconds
    token = sign_token(
        secret, sub=user.id, uname=user.username, role=user.role.value, ttl_seconds=ttl
    )
    return {
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": ttl,
        "user": _user_json(user, server, locale=user.locale),
    }


class LoginBody(BaseModel):
    username: str
    password: str


class ChangePasswordBody(BaseModel):
    old_password: str
    new_password: str


@router.post("/login", summary="Sign in")
async def login(body: LoginBody, server: Any = Depends(get_server)) -> dict[str, Any]:
    """Exchange username (or email) and password for a JWT access token and user profile."""
    if server.user_manager.count() == 0:
        raise OctopError(ErrorCode.SETUP_REQUIRED, "initial admin not created")
    user = await server.user_manager.authenticate(body.username, body.password)
    if user is None:
        raise OctopError(ErrorCode.AUTH_FAILED, "invalid credentials")
    return _login_payload(server, user)


class RegisterBody(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=200)
    display_name: str | None = None


@router.post("/local-session", summary="Open a local guest or single-user session")
async def local_session(request: Request, server: Any = Depends(get_server)) -> dict[str, Any]:
    """Issue a JWT without a login form on desktop / loopback first launch."""
    if not _is_local_client(request):
        logger.warning(
            "local-session denied client=%s host=%s origin=%s forwarded=%s desktop=%s",
            request.client.host if request.client else "",
            request.headers.get("host"),
            request.headers.get("origin"),
            request.headers.get("x-forwarded-for"),
            is_desktop_process(),
        )
        raise OctopError(ErrorCode.FORBIDDEN, "local session is only available on this device")
    locale = normalize_locale(resolve_request_locale(request))
    user = await ensure_local_user(server, locale=locale)
    return _login_payload(server, user)


@router.post("/register", summary="Claim the local guest session")
async def register(
    body: RegisterBody,
    request: Request,
    user: Any = Depends(current_user),
    server: Any = Depends(get_server),
) -> dict[str, Any]:
    """Set username and password on the auto-provisioned local user."""
    locale = normalize_locale(resolve_request_locale(request))
    claimed = await claim_local_account(
        server,
        user,
        username=body.username,
        password=body.password,
        display_name=body.display_name,
        locale=locale,
    )
    return _login_payload(server, claimed)


@router.post("/logout", status_code=204, summary="Sign out")
async def logout(user: Any = Depends(current_user), server: Any = Depends(get_server)) -> Response:
    """Record an audit event for the current session. JWTs are stateless and not revoked server-side."""
    server.services.audit_repo.write(actor=user.username, action="auth.logout")
    return Response(status_code=204)


@router.get("/me", summary="Current user profile")
async def me(
    user: Any = Depends(current_user), server: Any = Depends(get_server)
) -> dict[str, Any]:
    """Return the authenticated user's id, username, role, display name, and locale."""
    return _user_json(user, server, locale=user.locale)


@router.post("/change-password", status_code=204, summary="Change password")
async def change_password(
    body: ChangePasswordBody,
    user: Any = Depends(current_user),
    server: Any = Depends(get_server),
) -> Response:
    """Verify the old password and set a new one for the current user."""
    await server.user_manager.change_password(user.username, body.old_password, body.new_password)
    return Response(status_code=204)


class UpdateMeBody(BaseModel):
    display_name: str | None = None
    locale: str | None = None


@router.patch("/me", summary="Update profile")
async def update_me(
    body: UpdateMeBody,
    user: Any = Depends(current_user),
    server: Any = Depends(get_server),
) -> dict[str, Any]:
    """Update the current user's display name and/or locale.

    Use ``model_dump(exclude_unset=True)`` so an explicitly-provided ``null``
    (e.g. ``{"display_name": null}``) clears the field, while an omitted field
    leaves the current value untouched.
    """
    provided = body.model_dump(exclude_unset=True)
    if "display_name" in provided:
        await server.user_manager.set_display_name(user.username, body.display_name)
    if "locale" in provided:
        await server.user_manager.set_locale(user.username, body.locale)
    updated = server.user_manager.get(user.username)
    assert updated is not None
    return _user_json(updated, server, locale=updated.locale)
