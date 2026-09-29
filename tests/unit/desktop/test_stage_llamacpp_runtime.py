from __future__ import annotations

import hashlib
import importlib.util
import json
import zipfile
from pathlib import Path

import pytest


def _module():
    path = Path(__file__).parents[3] / "desktop" / "portable" / "stage-llamacpp-runtime.py"
    spec = importlib.util.spec_from_file_location("stage_llamacpp_runtime", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _manifest(tmp_path: Path, archive: Path, digest: str) -> Path:
    path = tmp_path / "runtime.json"
    path.write_text(
        json.dumps(
            {
                "version": "test",
                "license": "MIT",
                "source": "https://example.invalid",
                "platforms": {
                    "windows-amd64": {
                        "archive": archive.name,
                        "url": archive.as_uri(),
                        "sha256": digest,
                    }
                },
            }
        ),
        encoding="utf-8",
    )
    return path


def test_stage_verifies_and_extracts_runtime(tmp_path: Path) -> None:
    archive = tmp_path / "runtime.zip"
    with zipfile.ZipFile(archive, "w") as bundle:
        bundle.writestr("llama-server.exe", b"runtime")
        bundle.writestr("LICENSE", "MIT")
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    result = _module().stage(
        "windows-amd64",
        tmp_path / "staging",
        manifest_path=_manifest(tmp_path, archive, digest),
    )
    assert result is not None
    assert (result / "llama-server.exe").read_bytes() == b"runtime"
    metadata = json.loads((result / "FREEOS_RUNTIME.json").read_text(encoding="utf-8"))
    assert metadata["sha256"] == digest


def test_stage_rejects_checksum_mismatch(tmp_path: Path) -> None:
    archive = tmp_path / "runtime.zip"
    with zipfile.ZipFile(archive, "w") as bundle:
        bundle.writestr("llama-server.exe", b"runtime")
    with pytest.raises(ValueError, match="checksum mismatch"):
        _module().stage(
            "windows-amd64",
            tmp_path / "staging",
            manifest_path=_manifest(tmp_path, archive, "0" * 64),
        )


def test_safe_extract_rejects_parent_traversal(tmp_path: Path) -> None:
    archive = tmp_path / "runtime.zip"
    with zipfile.ZipFile(archive, "w") as bundle:
        bundle.writestr("../escape.txt", "bad")
    with pytest.raises(ValueError, match="unsafe archive member"):
        _module()._safe_extract(archive, tmp_path / "out")
