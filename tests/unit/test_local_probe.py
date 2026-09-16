from octop.infra.agents.providers.local_probe import probe_local_models, recommend_models


def test_recommend_models_scales_with_ram() -> None:
    tiny = recommend_models(4, False)
    mid = recommend_models(16, False)
    big = recommend_models(64, True)
    assert tiny[0]["id"] == "llama3.2:1b"
    assert any(item["id"].startswith("llama3.1") or item["id"].startswith("qwen") for item in mid)
    assert any("14b" in item["id"] for item in big)


def test_probe_local_models_shape() -> None:
    payload = probe_local_models()
    assert "hardware" in payload
    assert "installed" in payload
    assert "recommended" in payload
    hw = payload["hardware"]
    assert "os" in hw
    assert "cpu_count" in hw
    assert "ram_gb" in hw
