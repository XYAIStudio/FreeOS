from __future__ import annotations

import hashlib
import io
from pathlib import Path

from octop.infra.agents.providers import local_catalog, local_download


class _Response(io.BytesIO):
    headers = {"Content-Length": "11"}

    def __enter__(self) -> _Response:
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()


def test_catalog_recommends_smaller_model_for_low_memory() -> None:
    low = local_catalog.recommended_catalog(8)
    high = local_catalog.recommended_catalog(16)

    assert low[0]["id"] == "qwen2.5-1.5b-instruct-q4-k-m"
    assert high[0]["id"] == "qwen2.5-3b-instruct-q4-k-m"
    assert all(item["install"] == "freeos" for item in low)


def test_download_verifies_hash_and_moves_to_models(tmp_path: Path, monkeypatch: object) -> None:
    content = b"hello gguf!"
    entry = {
        "id": "test-model",
        "name": "test-model",
        "filename": "test.gguf",
        "url": "https://example.invalid/test.gguf",
        "sha256": hashlib.sha256(content).hexdigest(),
        "size": len(content),
    }
    monkeypatch.setenv("FREEOS_HOME", str(tmp_path))  # type: ignore[attr-defined]
    monkeypatch.setattr(local_download, "catalog_entry", lambda _model_id: dict(entry))  # type: ignore[attr-defined]
    monkeypatch.setattr(
        local_download.urllib.request, "urlopen", lambda *_a, **_k: _Response(content)
    )  # type: ignore[attr-defined]
    job = local_download.DownloadJob(job_id="job", catalog_id="test-model")

    local_download._run(job)

    assert job.status == "completed"
    assert Path(job.path).read_bytes() == content
    assert not Path(f"{job.path}.part").exists()
