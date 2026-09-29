"""Background downloads for the pinned FreeOS GGUF catalog."""

from __future__ import annotations

import hashlib
import json
import shutil
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
_DISK_RESERVE_BYTES = 256 * 1024 * 1024


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
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "resumable": self.status != "completed" and Path(f"{self.path}.part").is_file()
            if self.path
            else False,
        }


_lock = threading.Lock()
_jobs: dict[str, DownloadJob] = {}


def _state_dir() -> Path:
    return PathLayout.from_env().root / "models" / ".downloads"


def _state_path(job_id: str) -> Path:
    return _state_dir() / f"{job_id}.json"


def _save_job(job: DownloadJob) -> None:
    directory = _state_dir()
    directory.mkdir(parents=True, exist_ok=True)
    target = _state_path(job.job_id)
    temporary = target.with_suffix(f".json.{threading.get_ident()}.tmp")
    temporary.write_text(json.dumps(job.snapshot(), ensure_ascii=False), encoding="utf-8")
    temporary.replace(target)


def _load_job(job_id: str) -> DownloadJob | None:
    path = _state_path(job_id)
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        job = DownloadJob(job_id=str(data["job_id"]), catalog_id=str(data["catalog_id"]))
        job.status = str(data.get("status") or "failed")
        if job.status in {"pending", "running"}:
            job.status = "interrupted"
            job.error = "FreeOS stopped before the download completed. Retry to continue."
        else:
            job.error = str(data["error"]) if data.get("error") else None
        job.downloaded_bytes = int(data.get("downloaded_bytes") or 0)
        job.total_bytes = int(data.get("total_bytes") or 0)
        job.path = str(data.get("path") or "")
        job.created_at = float(data.get("created_at") or path.stat().st_mtime)
        job.updated_at = float(data.get("updated_at") or path.stat().st_mtime)
        return job
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
        return None


def get_download_job(job_id: str) -> DownloadJob | None:
    with _lock:
        job = _jobs.get(job_id)
        if job is not None:
            return job
        job = _load_job(job_id)
        if job is not None:
            _jobs[job_id] = job
        return job


def list_download_jobs() -> list[DownloadJob]:
    """Return recent jobs from memory and durable state, newest first."""
    state_ids = [path.stem for path in _state_dir().glob("*.json")] if _state_dir().is_dir() else []
    for job_id in state_ids:
        get_download_job(job_id)
    with _lock:
        return sorted(_jobs.values(), key=lambda item: item.updated_at, reverse=True)[:_MAX_JOBS]


def cancel_download_job(job_id: str) -> bool:
    job = get_download_job(job_id)
    if job is None:
        return False
    job.cancel.set()
    if job.status in {"pending", "running"}:
        job.status = "cancelled"
        job.updated_at = time.time()
        _save_job(job)
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
    job.error = None
    _save_job(job)
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.is_file() and _sha256(destination) == entry["sha256"]:
            job.downloaded_bytes = destination.stat().st_size
            job.status = "completed"
            return
        existing = partial.stat().st_size if partial.is_file() else 0
        if existing > job.total_bytes:
            partial.unlink(missing_ok=True)
            existing = 0
        if existing == job.total_bytes and existing > 0:
            if _sha256(partial) == entry["sha256"]:
                partial.replace(destination)
                job.downloaded_bytes = destination.stat().st_size
                job.status = "completed"
                return
            partial.unlink(missing_ok=True)
            existing = 0
        remaining = max(job.total_bytes - existing, 0)
        free = shutil.disk_usage(destination.parent).free
        if free < remaining + _DISK_RESERVE_BYTES:
            raise OSError(
                f"Not enough disk space: need {remaining + _DISK_RESERVE_BYTES} bytes "
                f"including safety reserve, only {free} bytes available."
            )
        headers = {"User-Agent": "FreeOS/0.0.7"}
        if existing:
            headers["Range"] = f"bytes={existing}-"
        request = urllib.request.Request(str(entry["url"]), headers=headers)
        with urllib.request.urlopen(request, timeout=60) as response:
            resumed = existing > 0 and int(getattr(response, "status", 200)) == 206
            mode = "ab" if resumed else "wb"
            if not resumed:
                existing = 0
            job.downloaded_bytes = existing
            header_size = int(response.headers.get("Content-Length") or 0)
            if header_size:
                job.total_bytes = existing + header_size
            with partial.open(mode) as output:
                while not job.cancel.is_set():
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    output.write(chunk)
                    job.downloaded_bytes += len(chunk)
                    job.updated_at = time.time()
                    _save_job(job)
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
        job.updated_at = time.time()
        _save_job(job)


def start_download_job(catalog_id: str) -> DownloadJob:
    if catalog_entry(catalog_id) is None:
        raise ValueError("model is not in the trusted catalog")
    with _lock:
        active = next(
            (
                item
                for item in _jobs.values()
                if item.catalog_id == catalog_id and item.status in {"pending", "running"}
            ),
            None,
        )
        if active is not None:
            return active
        job = DownloadJob(job_id=str(uuid.uuid4()), catalog_id=catalog_id)
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
