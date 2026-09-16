from __future__ import annotations

from octop.infra.agents.providers import ollama_install
from octop.infra.utils import ollama_manager


def test_start_result_when_not_installed(monkeypatch) -> None:
    monkeypatch.setattr(ollama_manager, "_is_ollama_reachable", lambda: False)
    monkeypatch.setattr(ollama_manager, "ollama_is_installed", lambda: False)
    result = ollama_manager.start_ollama_service_result()
    assert result["ok"] is False
    assert result["action"] == "not_installed"
    assert "ollama.com/download" in str(result["docs_url"])


def test_start_result_when_already_running(monkeypatch) -> None:
    monkeypatch.setattr(ollama_manager, "_is_ollama_reachable", lambda: True)
    monkeypatch.setattr(ollama_manager, "find_ollama_binary", lambda: "/usr/bin/ollama")
    result = ollama_manager.start_ollama_service_result()
    assert result["ok"] is True
    assert result["action"] == "already_running"


def test_start_result_launches_windows_app(monkeypatch) -> None:
    monkeypatch.setattr(ollama_manager, "_is_ollama_reachable", lambda: False)
    monkeypatch.setattr(ollama_manager, "ollama_is_installed", lambda: True)
    monkeypatch.setattr(ollama_manager.platform, "system", lambda: "Windows")
    monkeypatch.setattr(ollama_manager, "find_ollama_app", lambda: r"C:\Ollama\Ollama.exe")
    monkeypatch.setattr(ollama_manager, "find_ollama_binary", lambda: r"C:\Ollama\ollama.exe")
    launched: list[list[str]] = []

    def _popen(argv: list[str], **kwargs: object) -> None:
        del kwargs
        launched.append(argv)

    monkeypatch.setattr(ollama_manager.subprocess, "Popen", _popen)
    monkeypatch.setattr(ollama_manager, "_START_WAIT_SEC", 1)
    sleeps = {"n": 0}

    def _sleep(_sec: float) -> None:
        sleeps["n"] += 1
        if sleeps["n"] >= 1:
            monkeypatch.setattr(ollama_manager, "_is_ollama_reachable", lambda: True)

    monkeypatch.setattr(ollama_manager.time, "sleep", _sleep)
    result = ollama_manager.start_ollama_service_result()
    assert launched
    assert launched[0][0].endswith("Ollama.exe") or launched[0][-1] in {"app", "serve"}
    assert result["ok"] is True
    assert result["action"] == "started"


def test_ensure_runtime_without_install_is_honest(monkeypatch) -> None:
    monkeypatch.setattr(ollama_install, "is_ollama_reachable", lambda: False)
    monkeypatch.setattr(ollama_install, "ollama_is_installed", lambda: False)
    monkeypatch.setattr(
        ollama_install,
        "install_plan",
        lambda: {
            "needed": True,
            "automatable": False,
            "method": "manual",
            "docs_url": "https://ollama.com/download",
            "next_step": "Download the official installer",
        },
    )
    result = ollama_install.ensure_ollama_runtime(install=False)
    assert result["ok"] is False
    assert result["action"] == "not_installed"
    assert result["automatable"] is False


def test_install_plan_windows_winget(monkeypatch) -> None:
    monkeypatch.setattr(ollama_install, "ollama_is_installed", lambda: False)
    monkeypatch.setattr(ollama_install.platform, "system", lambda: "Windows")
    monkeypatch.setattr(ollama_install, "_winget", lambda: "winget")
    plan = ollama_install.install_plan()
    assert plan["automatable"] is True
    assert plan["method"] == "winget"
