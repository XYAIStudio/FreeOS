"""Local anonymous / single-user session for desktop and loopback first-run."""

from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Any

from octop.config import DatabaseConfig
from octop.infra.agents.default_agent import SETUP_DEFAULT_AGENT_ID, try_bootstrap_default_agent
from octop.infra.db.rebind import persist_database_config
from octop.infra.errors import ErrorCode, OctopError
from octop.infra.users.identity import Role, User
from octop.infra.users.password import hash_password, validate_password_policy
from octop.infra.utils.locale import normalize_locale

logger = logging.getLogger(__name__)

LOCAL_USERNAME = "local"
LOCAL_SESSION_SETTING = "local_session.unclaimed"
_USERNAME_ALLOWED = re.compile(r"^[a-zA-Z0-9_.-]{1,64}$")
_provision_lock = asyncio.Lock()


def is_desktop_process() -> bool:
    raw = (os.environ.get("OCTOP_DESKTOP") or "").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def is_unclaimed_local_user(server: Any, user: User) -> bool:
    """True while the auto-provisioned local user has not registered."""
    if server.services is None:
        return False
    if user.username != LOCAL_USERNAME:
        return False
    return bool(server.services.settings_repo.get(LOCAL_SESSION_SETTING) == "1")


def require_claimed_account(server: Any, user: User) -> None:
    """Block persist/export actions that need a real account."""
    if is_unclaimed_local_user(server, user):
        raise OctopError(
            ErrorCode.ACCOUNT_REQUIRED,
            "register or sign in to save",
            status=403,
        )


async def _provision_local_user(server: Any, *, locale: str) -> User:
    assert server.user_manager is not None
    assert server.services is not None
    uid = server.services.user_repo.create(
        username=LOCAL_USERNAME,
        password_hash=None,
        role=Role.ADMIN.value,
        display_name="FreeOS",
        locale=locale,
    )
    user = User(
        id=uid,
        username=LOCAL_USERNAME,
        role=Role.ADMIN,
        display_name="FreeOS",
        locale=locale,
    )
    server.user_manager.register_cached_user(user)
    server.services.settings_repo.set(LOCAL_SESSION_SETTING, "1")
    server.services.audit_repo.write(
        actor=LOCAL_USERNAME, action="user.local_session", target=LOCAL_USERNAME
    )
    await try_bootstrap_default_agent(
        server, user_id=user.id, locale=locale, agent_id=SETUP_DEFAULT_AGENT_ID
    )
    logger.info("provisioned local guest session user_id=%s", user.id)
    return user


def _single_user(server: Any) -> User | None:
    um = server.user_manager
    if um is None or um.count() != 1:
        return None
    users = um.list()
    return users[0] if users else None


async def ensure_local_user(server: Any, *, locale: str) -> User:
    """Bind SQLite if needed, provision a local guest, or return the only user."""
    loc = normalize_locale(locale)
    async with _provision_lock:
        if not server.database_bound:
            persist_database_config(server.paths.config, DatabaseConfig())
            await server.bind_control_plane()

        um = server.user_manager
        if um is None:
            raise OctopError(ErrorCode.SETUP_REQUIRED, "user manager not ready", status=503)

        if um.count() == 0:
            return await _provision_local_user(server, locale=loc)

        user = _single_user(server)
        if user is None:
            raise OctopError(ErrorCode.FORBIDDEN, "interactive login required")
        return user


async def claim_local_account(
    server: Any,
    user: User,
    *,
    username: str,
    password: str,
    display_name: str | None = None,
    locale: str | None = None,
) -> User:
    """Turn the unclaimed local guest into a password account."""
    if not is_unclaimed_local_user(server, user):
        raise OctopError(ErrorCode.FORBIDDEN, "account already registered")
    assert server.services is not None
    assert server.user_manager is not None

    new_username = (username or "").strip()
    if not _USERNAME_ALLOWED.match(new_username):
        raise OctopError(ErrorCode.USERNAME_TAKEN, "username must not be empty")
    validate_password_policy(password)

    repo = server.services.user_repo
    if new_username != user.username and repo.get_by_username(new_username) is not None:
        raise OctopError(ErrorCode.USERNAME_TAKEN, f"username {new_username!r} already exists")

    loc = normalize_locale(locale or user.locale)
    name = display_name.strip() if isinstance(display_name, str) and display_name.strip() else None
    if new_username != user.username:
        repo.set_username(user.id, new_username)
    repo.set_password_hash(user.id, hash_password(password))
    repo.set_display_name(user.id, name)
    repo.set_locale(user.id, loc)
    server.services.settings_repo.delete(LOCAL_SESSION_SETTING)

    claimed = User(
        id=user.id,
        username=new_username,
        role=user.role,
        display_name=name,
        locale=loc,
        permissions=list(user.permissions),
    )
    server.user_manager.replace_cached_user(user.username, claimed)
    server.services.audit_repo.write(
        actor=new_username, action="user.register", target=new_username
    )
    return claimed
