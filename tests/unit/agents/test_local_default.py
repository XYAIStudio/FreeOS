from __future__ import annotations

import json
from types import SimpleNamespace

from octop.infra.agents.providers.local_default import (
    annotate_local_models,
    current_default_ref,
    is_local_default_ref,
    resolve_local_model_ref,
    resolve_registered_or_usable,
    usable_local_model_ids,
)
from octop.infra.agents.providers.local_register import remember_weight
from octop.infra.users.preferences import merge_model_preferences_json


class _Settings:
    def __init__(self) -> None:
        self.data: dict[str, str] = {}

    def get(self, key: str) -> str | None:
        return self.data.get(key)

    def set(self, key: str, value: str) -> None:
        self.data[key] = value

    def get_active_model(self) -> tuple[str, str]:
        raw = self.data.get("active_model") or ""
        name, _, model = raw.partition("/")
        return name, model


class _Providers:
    def __init__(self, models: list[dict[str, object]] | None = None) -> None:
        payload = json.dumps(models or [{"id": "tiny", "name": "tiny", "enabled": True}])
        self.rows = [
            SimpleNamespace(
                name="Ollama (Local)",
                api_key="ollama",
                base_url="http://127.0.0.1:11434/v1",
                get_models=lambda: json.loads(payload),
            )
        ]

    def list_all(self) -> list[SimpleNamespace]:
        return self.rows


def test_resolve_local_model_ref() -> None:
    repo = _Providers()
    assert resolve_local_model_ref(repo, "tiny") == ("Ollama (Local)", "tiny")
    assert resolve_local_model_ref(repo, "missing") is None


def test_usable_ids_and_registered_fallback() -> None:
    repo = _Providers()
    settings = _Settings()
    remember_weight(settings, {"name": "other", "path": "", "registered": True})
    assert "tiny" in usable_local_model_ids(repo)
    assert resolve_registered_or_usable(
        provider_repo=repo, settings_repo=settings, name="other"
    ) == ("Ollama (Local)", "other")


def test_is_local_default_ref_aliases() -> None:
    assert is_local_default_ref("Ollama (Local)/tiny", "Ollama (Local)", "tiny")
    assert is_local_default_ref("ollama/tiny", "Ollama (Local)", "tiny")
    assert not is_local_default_ref("openai/tiny", "Ollama (Local)", "tiny")


def test_annotate_marks_usable_and_default() -> None:
    repo = _Providers()
    settings = _Settings()
    settings.set("active_model", "Ollama (Local)/tiny")
    prefs = merge_model_preferences_json(None, preferred_model="Ollama (Local)/tiny")
    probe = {
        "installed": [
            {"name": "tiny", "path": "", "source": "ollama", "registerable": True},
            {"name": "other", "path": "", "source": "gguf", "registerable": True},
        ]
    }
    annotated = annotate_local_models(
        probe,
        provider_repo=repo,
        settings_repo=settings,
        user_preferences_json=prefs,
    )
    by_name = {item["name"]: item for item in annotated["installed"]}
    assert by_name["tiny"]["registered"] is True
    assert by_name["tiny"]["is_default"] is True
    assert by_name["tiny"]["provider_name"] == "Ollama (Local)"
    assert by_name["other"].get("registered") is not True
    assert annotated["default_model"] == "tiny"


def test_current_default_ref_prefers_user_preference() -> None:
    assert (
        current_default_ref(
            preferred="Ollama (Local)/tiny",
            active_name="openai",
            active_model="gpt-4o",
        )
        == "Ollama (Local)/tiny"
    )
    assert current_default_ref(preferred=None, active_name="openai", active_model="gpt-4o") == (
        "openai/gpt-4o"
    )
