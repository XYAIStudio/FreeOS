from __future__ import annotations

import json
from pathlib import Path

from octop.infra.agents.providers.local_weights import (
    common_model_roots,
    default_scan_roots,
    is_local_llm_safetensors_dir,
    scan_weight_roots,
)


def test_scan_finds_gguf_and_ggml(tmp_path: Path) -> None:
    models = tmp_path / "models"
    models.mkdir()
    (models / "tiny.gguf").write_bytes(b"gguf")
    (models / "old.ggml").write_bytes(b"ggml")
    (models / "notes.txt").write_text("nope", encoding="utf-8")
    found = scan_weight_roots([models])
    sources = {item["source"] for item in found}
    names = {item["name"] for item in found}
    assert sources == {"gguf", "ggml"}
    assert names == {"tiny", "old"}
    assert all(item["registerable"] for item in found)


def test_scan_skips_random_safetensors(tmp_path: Path) -> None:
    folder = tmp_path / "weights"
    folder.mkdir()
    (folder / "model.safetensors").write_bytes(b"x")
    assert scan_weight_roots([tmp_path]) == []


def test_scan_accepts_clear_local_llm_folder(tmp_path: Path) -> None:
    folder = tmp_path / "qwen-local"
    folder.mkdir()
    (folder / "config.json").write_text(
        json.dumps({"model_type": "qwen2", "architectures": ["Qwen2ForCausalLM"]}),
        encoding="utf-8",
    )
    (folder / "tokenizer.json").write_text("{}", encoding="utf-8")
    (folder / "model.safetensors").write_bytes(b"weight")
    assert is_local_llm_safetensors_dir(folder) is True
    found = scan_weight_roots([tmp_path])
    assert len(found) == 1
    assert found[0]["source"] == "safetensors"
    assert found[0]["registerable"] is False


def test_scan_skips_inaccessible_and_node_modules(tmp_path: Path) -> None:
    hidden = tmp_path / "node_modules" / "pkg"
    hidden.mkdir(parents=True)
    (hidden / "vendor.gguf").write_bytes(b"no")
    visible = tmp_path / "ok.gguf"
    visible.write_bytes(b"yes")
    found = scan_weight_roots([tmp_path])
    assert [item["name"] for item in found] == ["ok"]


def test_scan_cancel_stops(tmp_path: Path) -> None:
    (tmp_path / "a.gguf").write_bytes(b"a")
    found = scan_weight_roots([tmp_path], should_cancel=lambda: True)
    assert found == []


def test_default_roots_include_home_and_known_dirs(tmp_path: Path) -> None:
    (tmp_path / "models").mkdir()
    (tmp_path / "Downloads").mkdir()
    roots = default_scan_roots(home=tmp_path)
    assert tmp_path in roots
    assert tmp_path / "models" in roots
    assert tmp_path / "Downloads" in roots
    common = common_model_roots(home=tmp_path)
    assert tmp_path not in common
    assert tmp_path / "models" in common
