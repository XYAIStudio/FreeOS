from __future__ import annotations

import json
from pathlib import Path

import pytest

from octop.infra.agents.providers import llamacpp_runtime


class _ProviderRepo:
    def __init__(self) -> None:
        self.row = None
        self.created: dict[str, object] | None = None
        self.updated: dict[str, object] | None = None

    def get_by_name(self, _name: str):
        return self.row

    def create(self, **values: object) -> int:
        self.created = values
        return 1

    def update(self, provider_id: int, **values: object) -> None:
        self.updated = {"provider_id": provider_id, **values}


def test_find_binary_prefers_explicit_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    binary = tmp_path / "llama-server.exe"
    binary.write_bytes(b"runtime")
    monkeypatch.setenv("FREEOS_LLAMA_SERVER", str(binary))
    assert llamacpp_runtime.find_llama_server() == binary.resolve()


def test_upsert_provider_registers_openai_compatible_model(tmp_path: Path) -> None:
    model = tmp_path / "Qwen 3.gguf"
    model.write_bytes(b"model")
    repo = _ProviderRepo()
    name = llamacpp_runtime.upsert_provider(repo, alias="Qwen 3", model_path=str(model))
    assert name == llamacpp_runtime.LLAMACPP_PROVIDER_NAME
    assert repo.created is not None
    assert repo.created["base_url"] == llamacpp_runtime.LLAMACPP_BASE_URL
    models = json.loads(str(repo.created["models_json"]))
    assert models[0]["id"] == "Qwen-3"


def test_start_uses_argument_vector_and_loopback(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    binary = tmp_path / "llama-server.exe"
    binary.write_bytes(b"runtime")
    model = tmp_path / "tiny.gguf"
    model.write_bytes(b"model")
    calls: list[list[str]] = []

    class _Process:
        def poll(self):
            return None

        def terminate(self) -> None:
            pass

        def wait(self, timeout: int):
            return 0

    def popen(args: list[str], **_kwargs: object):
        calls.append(args)
        return _Process()

    reachable = iter([False, True, True])
    monkeypatch.setattr(llamacpp_runtime, "find_llama_server", lambda: binary)
    monkeypatch.setattr(llamacpp_runtime, "is_llamacpp_reachable", lambda: next(reachable))
    monkeypatch.setattr(llamacpp_runtime.subprocess, "Popen", popen)
    monkeypatch.setenv("OCTOP_HOME", str(tmp_path / "home"))
    monkeypatch.setattr(llamacpp_runtime, "_PROCESS", None)
    monkeypatch.setattr(llamacpp_runtime, "_PROCESS_MODEL", None)

    result = llamacpp_runtime.start(model_path=str(model), alias="tiny")
    assert result["ok"] is True
    assert calls
    assert calls[0][calls[0].index("--host") + 1] == "127.0.0.1"
    assert calls[0][calls[0].index("--model") + 1] == str(model.resolve())


def test_start_rejects_non_gguf(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    binary = tmp_path / "llama-server.exe"
    binary.write_bytes(b"runtime")
    model = tmp_path / "model.bin"
    model.write_bytes(b"model")
    monkeypatch.setattr(llamacpp_runtime, "find_llama_server", lambda: binary)
    with pytest.raises(ValueError, match=".gguf"):
        llamacpp_runtime.start(model_path=str(model))
