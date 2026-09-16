"""Register a discovered local weight so chat can switch to it."""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

from octop.infra.agents.providers.model_flags import is_ollama_local_provider
from octop.infra.utils.ollama_manager import OllamaModelManager, create_from_weight

logger = logging.getLogger(__name__)

_SETTINGS_KEY = "local_registered_weights"
# Keep Ollama tags (``llama3.2:1b``) while sanitizing Windows paths / file stems.
_NAME_SAFE = re.compile(r"[^a-z0-9._:-]+")
_OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1"
_WEIGHT_SOURCES = frozenset({"gguf", "ggml"})
_REGISTER_SOURCES = frozenset({*_WEIGHT_SOURCES, "ollama"})


def sanitize_model_name(raw: str) -> str:
    name = _NAME_SAFE.sub("-", raw.strip().lower()).strip("-._")
    if not name:
        name = "local-model"
    if len(name) > 80:
        name = name[:80].rstrip("-._")
    return name


def load_registered(settings_repo: Any) -> list[dict[str, Any]]:
    raw = settings_repo.get(_SETTINGS_KEY)
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    return [item for item in data if isinstance(item, dict)]


def save_registered(settings_repo: Any, rows: list[dict[str, Any]]) -> None:
    settings_repo.set(_SETTINGS_KEY, json.dumps(rows, ensure_ascii=False))


def _entry_key(entry: dict[str, Any]) -> str:
    return str(entry.get("path") or entry.get("name") or "")


def remember_weight(settings_repo: Any, entry: dict[str, Any]) -> None:
    rows = load_registered(settings_repo)
    key = _entry_key(entry)
    kept = [item for item in rows if _entry_key(item) != key]
    kept.append(entry)
    save_registered(settings_repo, kept)


def _find_ollama_row(provider_repo: Any) -> Any | None:
    for row in provider_repo.list_all():
        if is_ollama_local_provider(
            row.name,
            provider_api_key=row.api_key,
            provider_base_url=row.base_url,
        ):
            return row
    return None


def _upsert_ollama_model(provider_repo: Any, model_id: str, display: str) -> str:
    row = _find_ollama_row(provider_repo)
    model = {
        "id": model_id,
        "name": display,
        "enabled": True,
        "input": ["text"],
    }
    if row is None:
        try:
            provider_repo.create(
                name="Ollama (Local)",
                kind="ollama",
                base_url=_OLLAMA_BASE_URL,
                api_key="ollama",
                models_json=json.dumps([model]),
            )
            return "Ollama (Local)"
        except Exception as exc:
            existing = getattr(provider_repo, "get_by_name", None)
            row = existing("Ollama (Local)") if callable(existing) else None
            if row is None:
                raise OSError(f"Could not save the Ollama provider: {exc}") from exc
    models = row.get_models()
    existing = next((item for item in models if str(item.get("id") or "") == model_id), None)
    if existing is None:
        models.append(model)
    else:
        existing["enabled"] = True
        existing["name"] = display
    provider_repo.update(
        row.id,
        models_json=json.dumps(models),
        enabled=True,
        base_url=row.base_url or _OLLAMA_BASE_URL,
    )
    return str(row.name)


def _model_id_for(*, name: str | None, path: str, source: str) -> str:
    if name and name.strip():
        raw = name.strip()
        if source == "ollama":
            return raw[:80]
        if ":" in raw and "/" not in raw and "\\" not in raw:
            return raw[:80]
        return sanitize_model_name(raw)
    if path:
        return sanitize_model_name(Path(path).stem or path)
    return sanitize_model_name("")


def _ollama_has_model(model_id: str) -> bool | None:
    """True/False when the daemon answers; ``None`` when the list call fails."""
    try:
        rows = OllamaModelManager.list_models()
    except Exception as exc:
        logger.warning("Could not list Ollama models while registering %s: %s", model_id, exc)
        return None
    for item in rows:
        listed = getattr(item, "name", "") or ""
        if listed == model_id or listed.startswith(f"{model_id}:"):
            return True
    return False


def _fail(message: str, *, action: str = "error") -> dict[str, Any]:
    return {
        "ok": False,
        "action": action,
        "next_step": message,
        "error": message,
    }


def register_local_weight(
    *,
    path: str,
    name: str | None,
    source: str,
    size: int,
    provider_repo: Any,
    settings_repo: Any,
) -> dict[str, Any]:
    """Import a GGUF/GGML file into Ollama, or enable an already-pulled tag."""
    kind = (source or "gguf").strip().lower()
    if kind not in _REGISTER_SOURCES:
        return {
            "ok": False,
            "action": "manual",
            "next_step": (
                "This layout is not an Ollama GGUF/GGML file. Convert it to GGUF "
                "or use the vendor tool that created it, then search again."
            ),
        }
    model_id = _model_id_for(name=name, path=path, source=kind)
    if kind in _WEIGHT_SOURCES:
        if not (path or "").strip():
            return _fail("Weight file path is required.")
        already = _ollama_has_model(model_id)
        if already is not True:
            try:
                create_from_weight(model_id, path)
            except (OSError, ValueError, RuntimeError, UnicodeError, TimeoutError) as exc:
                return _fail(str(exc).strip() or "ollama create failed")
    elif kind == "ollama":
        if not (name or path or "").strip():
            return _fail("Ollama model name is required.")
    info = None
    try:
        for item in OllamaModelManager.list_models():
            listed = getattr(item, "name", "") or ""
            if listed == model_id or listed.startswith(f"{model_id}:"):
                info = item
                break
    except Exception as exc:
        logger.warning("Ollama list after register failed for %s: %s", model_id, exc)
    try:
        provider_name = _upsert_ollama_model(provider_repo, model_id, model_id)
    except Exception as exc:
        return _fail(f"Could not save the model provider: {exc}")
    entry = {
        "name": model_id,
        "path": path or "",
        "size": int(getattr(info, "size", 0) or size),
        "source": "ollama",
        "registerable": False,
        "registered": True,
        "imported_from": kind,
    }
    try:
        remember_weight(settings_repo, entry)
    except Exception as exc:
        return _fail(f"Could not remember the registered model: {exc}")
    return {
        "ok": True,
        "action": "registered",
        "name": model_id,
        "path": path or "",
        "provider_name": provider_name,
        "source": "ollama",
    }
