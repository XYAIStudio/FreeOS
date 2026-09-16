from __future__ import annotations

from pathlib import Path

from octop.infra.utils import ollama_paths


def test_find_ollama_binary_uses_path(monkeypatch, tmp_path: Path) -> None:
    binary = tmp_path / "ollama"
    binary.write_text("", encoding="utf-8")
    monkeypatch.setattr(
        ollama_paths.shutil, "which", lambda name: str(binary) if name == "ollama" else None
    )
    assert ollama_paths.find_ollama_binary() == str(binary)


def test_find_ollama_binary_windows_known_path(monkeypatch, tmp_path: Path) -> None:
    local = tmp_path / "Local"
    exe = local / "Programs" / "Ollama" / "ollama.exe"
    exe.parent.mkdir(parents=True)
    exe.write_text("", encoding="utf-8")
    monkeypatch.setattr(ollama_paths.shutil, "which", lambda name: None)
    monkeypatch.setattr(ollama_paths.platform, "system", lambda: "Windows")
    monkeypatch.setenv("LOCALAPPDATA", str(local))
    monkeypatch.delenv("PROGRAMFILES", raising=False)
    monkeypatch.delenv("PROGRAMFILES(X86)", raising=False)
    assert ollama_paths.find_ollama_binary() == str(exe)


def test_ollama_not_installed_when_missing(monkeypatch) -> None:
    monkeypatch.setattr(ollama_paths.shutil, "which", lambda name: None)
    monkeypatch.setattr(ollama_paths.platform, "system", lambda: "Linux")
    monkeypatch.setattr(ollama_paths, "_linux_candidates", lambda: [])
    monkeypatch.setattr(ollama_paths, "_darwin_candidates", lambda: [])
    monkeypatch.setattr(ollama_paths, "_windows_candidate_dirs", lambda: [])
    assert ollama_paths.find_ollama_binary() is None
    assert ollama_paths.ollama_is_installed() is False


def test_find_ollama_app_windows(monkeypatch, tmp_path: Path) -> None:
    local = tmp_path / "Local"
    app = local / "Programs" / "Ollama" / "Ollama.exe"
    app.parent.mkdir(parents=True)
    app.write_text("", encoding="utf-8")
    monkeypatch.setattr(ollama_paths.platform, "system", lambda: "Windows")
    monkeypatch.setenv("LOCALAPPDATA", str(local))
    monkeypatch.delenv("PROGRAMFILES", raising=False)
    monkeypatch.delenv("PROGRAMFILES(X86)", raising=False)
    assert ollama_paths.find_ollama_app() == str(app)
