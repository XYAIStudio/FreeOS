from octop.infra.agents.providers.local_probe import probe_local_models


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
