from __future__ import annotations

import time
from pathlib import Path

from octop.infra.agents.providers import local_scan


def test_start_scan_finds_file_and_can_cancel(tmp_path: Path, monkeypatch) -> None:
    (tmp_path / "chat.gguf").write_bytes(b"gguf")
    monkeypatch.setattr(local_scan, "default_scan_roots", lambda: [tmp_path])
    job = local_scan.start_scan_job()
    deadline = time.time() + 5
    while job.status in {"pending", "running"} and time.time() < deadline:
        time.sleep(0.05)
    assert job.status == "completed"
    assert any(item["name"] == "chat" for item in job.found)
    snapshot = local_scan.get_scan_job(job.job_id)
    assert snapshot is not None
    assert snapshot.files_found >= 1


def test_full_disk_false_uses_optional_root(tmp_path: Path) -> None:
    nested = tmp_path / "only-here"
    nested.mkdir()
    (nested / "solo.gguf").write_bytes(b"x")
    job = local_scan.start_scan_job(root=str(nested), full_disk=False)
    deadline = time.time() + 5
    while job.status in {"pending", "running"} and time.time() < deadline:
        time.sleep(0.05)
    assert job.status == "completed"
    assert [item["name"] for item in job.found] == ["solo"]


def test_cancel_unknown_job() -> None:
    assert local_scan.cancel_scan_job("missing") is False
