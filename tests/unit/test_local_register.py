from __future__ import annotations

from types import SimpleNamespace

import pytest

from octop.infra.agents.providers.local_register import (
    register_local_weight,
    remember_weight,
    sanitize_model_name,
)


class _Settings:
    def __init__(self) -> None:
        self.data: dict[str, str] = {}

    def get(self, key: str) -> str | None:
        return self.data.get(key)

    def set(self, key: str, value: str) -> None:
        self.data[key] = value


class _Providers:
    def __init__(self) -> None:
        self.rows: list[SimpleNamespace] = []

    def list_all(self) -> list[SimpleNamespace]:
        return self.rows

    def get_by_name(self, name: str) -> SimpleNamespace | None:
        return next((row for row in self.rows if row.name == name), None)

    def create(self, **kwargs: object) -> int:
        models_json = kwargs.get("models_json")

        def _models() -> list[dict[str, object]]:
            import json

            if not isinstance(models_json, str):
                return []
            data = json.loads(models_json)
            return data if isinstance(data, list) else []

        row = SimpleNamespace(
            id=1,
            name=kwargs["name"],
            kind=kwargs["kind"],
            base_url=kwargs.get("base_url"),
            api_key=kwargs.get("api_key"),
            models_json=models_json,
            get_models=_models,
        )
        self.rows.append(row)
        return 1

    def update(self, provider_id: int, **kwargs: object) -> None:
        del provider_id, kwargs


def test_sanitize_model_name() -> None:
    assert sanitize_model_name("Qwen 2.5 / Chat.gguf") == "qwen-2.5-chat.gguf"
    assert sanitize_model_name("@@@") == "local-model"
    assert sanitize_model_name("llama3.2:1b") == "llama3.2:1b"


def test_register_refuses_safetensors() -> None:
    result = register_local_weight(
        path="/tmp/model",
        name="model",
        source="safetensors",
        size=1,
        provider_repo=_Providers(),
        settings_repo=_Settings(),
    )
    assert result["ok"] is False
    assert result["action"] == "manual"


def test_register_imports_gguf(monkeypatch: pytest.MonkeyPatch) -> None:
    created: list[tuple[str, str]] = []
    monkeypatch.setattr(
        "octop.infra.agents.providers.local_register.create_from_weight",
        lambda name, path: created.append((name, path)),
    )
    listed = {"n": 0}

    def _list() -> list[SimpleNamespace]:
        listed["n"] += 1
        if listed["n"] == 1:
            return []
        return [SimpleNamespace(name="tiny", size=12)]

    monkeypatch.setattr(
        "octop.infra.agents.providers.local_register.OllamaModelManager.list_models",
        _list,
    )
    providers = _Providers()
    settings = _Settings()
    result = register_local_weight(
        path="/tmp/tiny.gguf",
        name="tiny",
        source="gguf",
        size=12,
        provider_repo=providers,
        settings_repo=settings,
    )
    assert result["ok"] is True
    assert created == [("tiny", "/tmp/tiny.gguf")]
    assert providers.rows[0].name == "Ollama (Local)"
    assert providers.rows[0].base_url == "http://127.0.0.1:11434/v1"
    assert "tiny.gguf" in settings.data.get("local_registered_weights", "")


def test_register_ollama_source_skips_create(monkeypatch: pytest.MonkeyPatch) -> None:
    created: list[tuple[str, str]] = []
    monkeypatch.setattr(
        "octop.infra.agents.providers.local_register.create_from_weight",
        lambda name, path: created.append((name, path)),
    )
    monkeypatch.setattr(
        "octop.infra.agents.providers.local_register.OllamaModelManager.list_models",
        lambda: [SimpleNamespace(name="llama3.2:1b", size=99)],
    )
    result = register_local_weight(
        path="",
        name="llama3.2:1b",
        source="ollama",
        size=99,
        provider_repo=_Providers(),
        settings_repo=_Settings(),
    )
    assert result["ok"] is True
    assert result["name"] == "llama3.2:1b"
    assert created == []


def test_register_skips_create_when_ollama_already_has_tag(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created: list[tuple[str, str]] = []
    monkeypatch.setattr(
        "octop.infra.agents.providers.local_register.create_from_weight",
        lambda name, path: created.append((name, path)),
    )
    monkeypatch.setattr(
        "octop.infra.agents.providers.local_register.OllamaModelManager.list_models",
        lambda: [SimpleNamespace(name="tiny:latest", size=12)],
    )
    result = register_local_weight(
        path=r"C:\Users\x\Downloads\tiny.gguf",
        name="tiny",
        source="gguf",
        size=12,
        provider_repo=_Providers(),
        settings_repo=_Settings(),
    )
    assert result["ok"] is True
    assert created == []


def test_register_missing_weight_path_is_ok_false() -> None:
    result = register_local_weight(
        path="",
        name="tiny",
        source="gguf",
        size=1,
        provider_repo=_Providers(),
        settings_repo=_Settings(),
    )
    assert result["ok"] is False
    assert "path" in str(result["next_step"]).lower()


def test_register_create_failure_is_ok_false(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "octop.infra.agents.providers.local_register.create_from_weight",
        lambda name, path: (_ for _ in ()).throw(OSError("FROM path is invalid")),
    )
    monkeypatch.setattr(
        "octop.infra.agents.providers.local_register.OllamaModelManager.list_models",
        lambda: [],
    )
    result = register_local_weight(
        path=r"C:\Users\x\model.gguf",
        name="model",
        source="gguf",
        size=1,
        provider_repo=_Providers(),
        settings_repo=_Settings(),
    )
    assert result["ok"] is False
    assert result["error"] == "FROM path is invalid"
    assert "FROM path is invalid" in str(result["next_step"])


def test_register_survives_list_models_attribute_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created: list[tuple[str, str]] = []
    monkeypatch.setattr(
        "octop.infra.agents.providers.local_register.create_from_weight",
        lambda name, path: created.append((name, path)),
    )

    def _boom() -> list[object]:
        raise AttributeError("'ListResponse' object has no attribute 'get'")

    monkeypatch.setattr(
        "octop.infra.agents.providers.local_register.OllamaModelManager.list_models",
        _boom,
    )
    result = register_local_weight(
        path="/tmp/tiny.gguf",
        name="tiny",
        source="gguf",
        size=12,
        provider_repo=_Providers(),
        settings_repo=_Settings(),
    )
    assert result["ok"] is True
    assert created == [("tiny", "/tmp/tiny.gguf")]


def test_remember_weight_keys_ollama_rows_by_name() -> None:
    settings = _Settings()
    remember_weight(settings, {"name": "a", "path": "", "source": "ollama"})
    remember_weight(settings, {"name": "b", "path": "", "source": "ollama"})
    rows = __import__("json").loads(settings.data["local_registered_weights"])
    assert {row["name"] for row in rows} == {"a", "b"}
