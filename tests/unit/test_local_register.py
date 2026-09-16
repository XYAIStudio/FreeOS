from __future__ import annotations

from types import SimpleNamespace

from octop.infra.agents.providers.local_register import (
    register_local_weight,
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

    def create(self, **kwargs: object) -> int:
        row = SimpleNamespace(
            id=1,
            name=kwargs["name"],
            kind=kwargs["kind"],
            base_url=kwargs.get("base_url"),
            api_key=kwargs.get("api_key"),
            models_json=kwargs.get("models_json"),
            get_models=lambda: [],
        )
        self.rows.append(row)
        return 1

    def update(self, provider_id: int, **kwargs: object) -> None:
        del provider_id, kwargs


def test_sanitize_model_name() -> None:
    assert sanitize_model_name("Qwen 2.5 / Chat.gguf") == "qwen-2.5-chat.gguf"
    assert sanitize_model_name("@@@") == "local-model"


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


def test_register_imports_gguf(monkeypatch) -> None:
    created: list[tuple[str, str]] = []
    monkeypatch.setattr(
        "octop.infra.agents.providers.local_register.create_from_weight",
        lambda name, path: created.append((name, path)),
    )
    monkeypatch.setattr(
        "octop.infra.agents.providers.local_register.OllamaModelManager.list_models",
        lambda: [SimpleNamespace(name="tiny", size=12)],
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
    assert "tiny.gguf" in settings.data.get("local_registered_weights", "")
