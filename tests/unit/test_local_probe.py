import urllib.error

import pytest

from octop.infra.agents.providers.local_probe import (
    http_endpoint_reachable,
    probe_local_models,
)


def test_probe_local_models_shape() -> None:
    payload = probe_local_models()
    assert "hardware" in payload
    assert "installed" in payload
    assert "recommended" in payload
    assert "deps" in payload
    hw = payload["hardware"]
    assert "os" in hw
    assert "cpu_count" in hw
    assert "ram_gb" in hw
    assert "ollama_installed" in hw
    assert "ollama_reachable" in hw
    assert payload["reachable_provider"] is bool(
        hw["ollama_reachable"] or hw.get("llamacpp_reachable")
    )


def test_http_endpoint_reachable_treats_auth_failure_as_up(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _denied(*_args: object, **_kwargs: object) -> None:
        raise urllib.error.HTTPError("http://127.0.0.1:11434/models", 401, "no", hdrs=None, fp=None)

    monkeypatch.setattr(
        "octop.infra.agents.providers.local_probe.urllib.request.urlopen",
        _denied,
    )
    assert http_endpoint_reachable("http://127.0.0.1:11434") is True


def test_http_endpoint_reachable_rejects_connection_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _down(*_args: object, **_kwargs: object) -> None:
        raise urllib.error.URLError("refused")

    monkeypatch.setattr(
        "octop.infra.agents.providers.local_probe.urllib.request.urlopen",
        _down,
    )
    assert http_endpoint_reachable("http://127.0.0.1:9") is False
