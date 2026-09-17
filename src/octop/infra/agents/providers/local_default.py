"""Resolve and annotate the default local (Ollama) chat model."""

from __future__ import annotations

from typing import Any

from octop.infra.agents.providers.local_register import find_ollama_row, load_registered
from octop.infra.agents.providers.model_flags import (
    OLLAMA_PROVIDER_DISPLAY_NAME,
    is_ollama_local_provider,
)
from octop.infra.users.preferences import get_preferred_model_from_json


def provider_base_url(row: Any | None) -> str | None:
    if row is None:
        return None
    return getattr(row, "base_url", None)


def usable_local_model_ids(provider_repo: Any) -> set[str]:
    row = find_ollama_row(provider_repo)
    if row is None:
        return set()
    ids: set[str] = set()
    for model in row.get_models() if hasattr(row, "get_models") else []:
        if not isinstance(model, dict) or not model.get("enabled", True):
            continue
        model_id = str(model.get("id") or "").strip()
        if model_id:
            ids.add(model_id)
    return ids


def resolve_local_model_ref(provider_repo: Any, name: str) -> tuple[str, str] | None:
    """Return ``(provider_name, model_id)`` when *name* is on the local provider."""
    model_id = name.strip()
    if not model_id:
        return None
    row = find_ollama_row(provider_repo)
    if row is None:
        return None
    for model in row.get_models() if hasattr(row, "get_models") else []:
        if not isinstance(model, dict):
            continue
        listed = str(model.get("id") or "").strip()
        if listed == model_id or listed.startswith(f"{model_id}:"):
            return str(row.name or OLLAMA_PROVIDER_DISPLAY_NAME), listed
    return None


def resolve_registered_or_usable(
    *,
    provider_repo: Any,
    settings_repo: Any,
    name: str,
) -> tuple[str, str] | None:
    """Resolve a registered weight or an already-enabled local provider model."""
    resolved = resolve_local_model_ref(provider_repo, name)
    if resolved is not None:
        return resolved
    model_id = name.strip()
    if not model_id:
        return None
    for row in load_registered(settings_repo):
        listed = str(row.get("name") or "").strip()
        if listed == model_id:
            provider = find_ollama_row(provider_repo)
            provider_name = (
                str(provider.name) if provider is not None else OLLAMA_PROVIDER_DISPLAY_NAME
            )
            return provider_name, listed
    return None


def current_default_ref(
    *,
    preferred: str | None,
    active_name: str,
    active_model: str,
) -> str:
    if preferred:
        return preferred
    if active_name and active_model:
        return f"{active_name}/{active_model}"
    return ""


def is_local_default_ref(default_ref: str, provider_name: str, model_id: str) -> bool:
    if not default_ref or not model_id:
        return False
    if default_ref == f"{provider_name}/{model_id}":
        return True
    pref_provider, _, pref_model = default_ref.partition("/")
    if pref_model != model_id:
        return False
    return is_ollama_local_provider(pref_provider) and is_ollama_local_provider(provider_name)


def annotate_local_models(
    probe: dict[str, Any],
    *,
    provider_repo: Any,
    settings_repo: Any,
    user_preferences_json: str | None,
) -> dict[str, Any]:
    """Mark usable local models and which one is the current default."""
    row = find_ollama_row(provider_repo)
    provider_name = str(row.name) if row is not None else OLLAMA_PROVIDER_DISPLAY_NAME
    usable = usable_local_model_ids(provider_repo)
    registered_names = {
        str(item.get("name") or "") for item in load_registered(settings_repo) if item.get("name")
    }
    preferred = get_preferred_model_from_json(user_preferences_json)
    active_name, active_model = ("", "")
    getter = getattr(settings_repo, "get_active_model", None)
    if callable(getter):
        active_name, active_model = getter()
    default_ref = current_default_ref(
        preferred=preferred, active_name=active_name, active_model=active_model
    )
    for item in probe.get("installed") or []:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "")
        if name and (name in usable or name in registered_names):
            item["registered"] = True
            item["registerable"] = False
            item["provider_name"] = provider_name
        elif item.get("registered"):
            item["provider_name"] = item.get("provider_name") or provider_name
        if name:
            item["is_default"] = is_local_default_ref(default_ref, provider_name, name)
    probe["default_ref"] = default_ref
    probe["default_provider_name"] = default_ref.partition("/")[0] if default_ref else ""
    probe["default_model"] = default_ref.partition("/")[2] if default_ref else ""
    return probe
