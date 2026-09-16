from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest

from octop.infra.utils import ollama_manager


def test_modelfile_from_instruction_quotes_windows_path() -> None:
    weight = Path(r"C:/Users/Alice/My Models/Qwen 2.5.gguf")
    line = ollama_manager.modelfile_from_instruction(weight)
    assert line.startswith("FROM ")
    assert line.endswith("\n")
    assert '"C:/Users/Alice/My Models/Qwen 2.5.gguf"' in line
    assert "\\" not in line


def test_resolve_weight_file_missing(tmp_path: Path) -> None:
    with pytest.raises(OSError, match="not found"):
        ollama_manager.resolve_weight_file(str(tmp_path / "missing.gguf"))


def test_resolve_weight_file_empty() -> None:
    with pytest.raises(OSError, match="required"):
        ollama_manager.resolve_weight_file("  ")


def test_create_from_weight_writes_quoted_from_and_utf8(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    weight = tmp_path / "Qwen 2.5.gguf"
    weight.write_bytes(b"gguf")
    ran: dict[str, object] = {}

    monkeypatch.setattr(ollama_manager, "find_ollama_binary", lambda: "/usr/bin/ollama")
    monkeypatch.setattr(ollama_manager, "_ensure_ollama_server", lambda: None)

    def _run(argv: list[str], **kwargs: object) -> SimpleNamespace:
        ran["argv"] = argv
        ran["kwargs"] = kwargs
        ran["modelfile"] = Path(argv[-1]).read_text(encoding="utf-8")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(ollama_manager.subprocess, "run", _run)
    ollama_manager.create_from_weight("qwen-2.5", str(weight))
    assert ran["modelfile"] == f'FROM "{weight.resolve().as_posix()}"\n'
    argv = ran["argv"]
    assert isinstance(argv, list)
    assert argv[:3] == ["/usr/bin/ollama", "create", "qwen-2.5"]
    kwargs = ran["kwargs"]
    assert isinstance(kwargs, dict)
    assert kwargs["encoding"] == "utf-8"
    assert kwargs["errors"] == "replace"
    assert Path(str(kwargs["cwd"])) == weight.parent


def test_create_from_weight_maps_unicode_decode_error(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    weight = tmp_path / "model.gguf"
    weight.write_bytes(b"gguf")
    monkeypatch.setattr(ollama_manager, "find_ollama_binary", lambda: "/usr/bin/ollama")
    monkeypatch.setattr(ollama_manager, "_ensure_ollama_server", lambda: None)

    def _run(*args: object, **kwargs: object) -> SimpleNamespace:
        del args, kwargs
        raise UnicodeDecodeError("gbk", b"\x80", 0, 1, "invalid")

    monkeypatch.setattr(ollama_manager.subprocess, "run", _run)
    with pytest.raises(OSError, match="codec"):
        ollama_manager.create_from_weight("model", str(weight))


def test_create_from_weight_surfaces_cli_stderr(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    weight = tmp_path / "model.gguf"
    weight.write_bytes(b"gguf")
    monkeypatch.setattr(ollama_manager, "find_ollama_binary", lambda: "/usr/bin/ollama")
    monkeypatch.setattr(ollama_manager, "_ensure_ollama_server", lambda: None)
    monkeypatch.setattr(
        ollama_manager.subprocess,
        "run",
        lambda *a, **k: SimpleNamespace(returncode=1, stdout="", stderr="parser error"),
    )
    with pytest.raises(OSError, match="parser error"):
        ollama_manager.create_from_weight("model", str(weight))


def test_iter_ollama_list_models_accepts_pydantic_payload() -> None:
    model = SimpleNamespace(
        model="llama3.2:1b",
        size=11,
        digest="abc",
        modified_at="now",
        model_dump=lambda: {
            "model": "llama3.2:1b",
            "size": 11,
            "digest": "abc",
            "modified_at": "now",
        },
    )
    raw = SimpleNamespace(models=[model])
    rows = ollama_manager._iter_ollama_list_models(raw)
    assert rows[0]["model"] == "llama3.2:1b"
    assert rows[0]["size"] == 11


def test_list_models_accepts_sdk_object(monkeypatch: pytest.MonkeyPatch) -> None:
    model = SimpleNamespace(model="qwen2.5:7b", size=7, digest=None, modified_at=None)
    payload = SimpleNamespace(models=[model])
    monkeypatch.setattr(
        ollama_manager,
        "_ensure_ollama",
        lambda: SimpleNamespace(list=lambda: payload),
    )
    rows = ollama_manager.OllamaModelManager.list_models()
    assert rows[0].name == "qwen2.5:7b"
    assert rows[0].size == 7


def test_list_models_accepts_legacy_dict(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = {"models": [{"model": "tiny", "size": 3, "digest": None, "modified_at": None}]}
    monkeypatch.setattr(
        ollama_manager,
        "_ensure_ollama",
        lambda: SimpleNamespace(list=lambda: payload),
    )
    rows = ollama_manager.OllamaModelManager.list_models()
    assert rows[0].name == "tiny"
