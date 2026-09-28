"""Background downloads for the pinned FreeOS GGUF catalog."""

from __future__ import annotations

import hashlib
import threading
import time
import urllib.request
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from octop.infra.agents.providers.local_catalog import catalog_entry
from octop.infra.utils.paths import PathLayout

_MAX_JOBS = 8


@dataclass
class DownloadJob:
    job_id: str
    catalog_id: str
    status: str = "pending"
    downloaded_bytes: int = 0
    total_bytes: int = 0
    path: str = ""
    error: str | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    cancel: threading.Event = field(default_factory=threading.Event)

    def snapshot(self) -> dict[str, Any]:
        percent = (
            round(self.downloaded_bytes * 100 / self.total_bytes, 1) if self.total_bytes else 0
        )
        entry = catalog_entry(self.catalog_id) or {}
        return {
            "job_id": self.job_id,
            "catalog_id": self.catalog_id,
            "name": entry.get("name", ""),
            "status": self.status,
            "downloaded_bytes": self.downloaded_bytes,
            "total_bytes": self.total_bytes,
            "percent": percent,
            "path": self.path,
            "error": self.error,
        }


_lock = threading.Lock()
_jobs: dict[str, DownloadJob] = {}


def get_download_job(job_id: str) -> DownloadJob | None:
    with _lock:
        return _jobs.get(job_id)


def cancel_download_job(job_id: str) -> bool:
    job = get_download_job(job_id)
    if job is None:
        return False
    job.cancel.set()
    if job.status in {"pending", "running"}:
        job.status = "cancelled"
        job.updated_at = time.time()
    return True


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _run(job: DownloadJob) -> None:
    entry = catalog_entry(job.catalog_id)
    if entry is None:
        job.status, job.error = "failed", "model is not in the trusted catalog"
        return
    destination = PathLayout.from_env().root / "models" / str(entry["filename"])
    partial = destination.with_suffix(destination.suffix + ".part")
    job.path = str(destination)
    job.total_bytes = int(entry["size"])
    job.status = "running"
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.is_file() and _sha256(destination) == entry["sha256"]:
            job.downloaded_bytes = destination.stat().st_size
            job.status = "completed"
            return
        partial.unlink(missing_ok=True)
        request = urllib.request.Request(str(entry["url"]), headers={"User-Agent": "FreeOS/0.0.6"})
        with urllib.request.urlopen(request, timeout=60) as response, partial.open("wb") as output:
            header_size = int(response.headers.get("Content-Length") or 0)
            if header_size:
                job.total_bytes = header_size
            while not job.cancel.is_set():
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
                job.downloaded_bytes += len(chunk)
                job.updated_at = time.time()
        if job.cancel.is_set():
            job.status = "cancelled"
            return
        if _sha256(partial) != entry["sha256"]:
            raise ValueError("download checksum mismatch")
        partial.replace(destination)
        job.downloaded_bytes = destination.stat().st_size
        job.status = "completed"
    except Exception as exc:  # noqa: BLE001 - surfaced to the polling UI
        job.status, job.error = "failed", str(exc)
    finally:
        if job.status != "completed":
            partial.unlink(missing_ok=True)
        job.updated_at = time.time()


def start_download_job(catalog_id: str) -> DownloadJob:
    if catalog_entry(catalog_id) is None:
        raise ValueError("model is not in the trusted catalog")
    job = DownloadJob(job_id=str(uuid.uuid4()), catalog_id=catalog_id)
    with _lock:
        _jobs[job.job_id] = job
        terminal = sorted(_jobs.values(), key=lambda item: item.created_at)
        for stale in terminal:
            if len(_jobs) <= _MAX_JOBS:
                break
            if stale.status not in {"pending", "running"}:
                _jobs.pop(stale.job_id, None)
    threading.Thread(
        target=_run, args=(job,), daemon=True, name=f"model-download-{job.job_id}"
    ).start()
    return job
