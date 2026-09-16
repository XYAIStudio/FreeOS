"""Register a discovered local weight so chat can switch to it."""

from __future__ import annotations

import json
import re
from typing import Any

from octop.infra.agents.providers.model_flags import is_ollama_local_provider
from octop.infra.utils.ollama_manager import OllamaModelManager, create_from_weight

_SETTINGS_KEY = "local_registered_weights"
_NAME_SAFE = re.compile(r"[^a-z0-9._-]+")


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


def remember_weight(settings_repo: Any, entry: dict[str, Any]) -> None:
    rows = load_registered(settings_repo)
    path = str(entry.get("path") or "")
    kept = [item for item in rows if str(item.get("path") or "") != path]
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
        provider_repo.create(
            name="Ollama (Local)",
            kind="ollama",
            base_url="http://127.0.0.1:11434",
            api_key="ollama",
            models_json=json.dumps([model]),
        )
        return "Ollama (Local)"
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
        base_url=row.base_url or "http://127.0.0.1:11434",
    )
    return str(row.name)


def register_local_weight(
    *,
    path: str,
    name: str | None,
    source: str,
    size: int,
    provider_repo: Any,
    settings_repo: Any,
) -> dict[str, Any]:
    """Import a GGUF/GGML file into Ollama and enable it on the local provider."""
    if source not in {"gguf", "ggml"}:
        return {
            "ok": False,
            "action": "manual",
            "next_step": (
                "This layout is not an Ollama GGUF/GGML file. Convert it to GGUF "
                "or use the vendor tool that created it, then search again."
            ),
        }
    model_id = sanitize_model_name(name or path)
    create_from_weight(model_id, path)
    info = None
    for item in OllamaModelManager.list_models():
        if item.name == model_id or item.name.startswith(f"{model_id}:"):
            info = item
            break
    provider_name = _upsert_ollama_model(provider_repo, model_id, model_id)
    entry = {
        "name": model_id,
        "path": path,
        "size": int(info.size) if info is not None else size,
        "source": "ollama",
        "registerable": False,
        "registered": True,
        "imported_from": source,
    }
    remember_weight(settings_repo, entry)
    return {
        "ok": True,
        "action": "registered",
        "name": model_id,
        "path": path,
        "provider_name": provider_name,
        "source": "ollama",
    }
