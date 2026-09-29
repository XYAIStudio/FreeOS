from __future__ import annotations

import hashlib
import io
from pathlib import Path

from octop.infra.agents.providers import local_catalog, local_download


class _Response(io.BytesIO):
    def __init__(self, content: bytes, *, status: int = 200) -> None:
        super().__init__(content)
        self.status = status
        self.headers = {"Content-Length": str(len(content))}

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


def test_download_resumes_existing_partial_file(tmp_path: Path, monkeypatch: object) -> None:
    content = b"hello gguf!"
    prefix = b"hello "
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
    partial = tmp_path / "models" / "test.gguf.part"
    partial.parent.mkdir(parents=True)
    partial.write_bytes(prefix)
    seen_range: list[str | None] = []

    def open_range(request: object, **_kwargs: object) -> _Response:
        seen_range.append(getattr(request, "headers", {}).get("Range"))
        return _Response(content[len(prefix) :], status=206)

    monkeypatch.setattr(local_download.urllib.request, "urlopen", open_range)  # type: ignore[attr-defined]
    job = local_download.DownloadJob(job_id="resume", catalog_id="test-model")

    local_download._run(job)

    assert seen_range == [f"bytes={len(prefix)}-"]
    assert job.status == "completed"
    assert Path(job.path).read_bytes() == content


def test_download_job_survives_process_memory_reset(tmp_path: Path, monkeypatch: object) -> None:
    entry = {
        "id": "test-model",
        "name": "test-model",
        "filename": "test.gguf",
        "url": "https://example.invalid/test.gguf",
        "sha256": "unused",
        "size": 12,
    }
    monkeypatch.setenv("FREEOS_HOME", str(tmp_path))  # type: ignore[attr-defined]
    monkeypatch.setattr(local_download, "catalog_entry", lambda _model_id: dict(entry))  # type: ignore[attr-defined]
    job = local_download.DownloadJob(
        job_id="persisted", catalog_id="test-model", status="running", downloaded_bytes=5
    )
    job.path = str(tmp_path / "models" / "test.gguf")
    Path(f"{job.path}.part").parent.mkdir(parents=True)
    Path(f"{job.path}.part").write_bytes(b"12345")
    local_download._save_job(job)
    local_download._jobs.clear()

    restored = local_download.get_download_job("persisted")

    assert restored is not None
    assert restored.status == "interrupted"
    assert restored.downloaded_bytes == 5
    assert restored.snapshot()["resumable"] is True
