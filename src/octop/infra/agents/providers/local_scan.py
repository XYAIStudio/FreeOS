"""Background local-weight scan jobs (progress + cancel, never blocks the UI)."""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from octop.infra.agents.providers.local_weights import (
    default_scan_roots,
    full_disk_roots,
    scan_weight_roots,
)

_MAX_JOBS = 8


@dataclass
class ScanJob:
    job_id: str
    status: str = "pending"
    roots: list[str] = field(default_factory=list)
    full_disk: bool = False
    dirs_scanned: int = 0
    files_found: int = 0
    current: str = ""
    found: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    cancel: threading.Event = field(default_factory=threading.Event)

    def snapshot(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "roots": list(self.roots),
            "full_disk": self.full_disk,
            "dirs_scanned": self.dirs_scanned,
            "files_found": self.files_found,
            "current": self.current,
            "found": list(self.found),
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


_lock = threading.Lock()
_jobs: dict[str, ScanJob] = {}


def _remember(job: ScanJob) -> None:
    with _lock:
        _jobs[job.job_id] = job
        if len(_jobs) <= _MAX_JOBS:
            return
        oldest = sorted(_jobs.values(), key=lambda item: item.created_at)
        for stale in oldest:
            if stale.status in {"running", "pending"}:
                continue
            _jobs.pop(stale.job_id, None)
            if len(_jobs) <= _MAX_JOBS:
                break


def get_scan_job(job_id: str) -> ScanJob | None:
    with _lock:
        return _jobs.get(job_id)


def latest_scan_job() -> ScanJob | None:
    with _lock:
        if not _jobs:
            return None
        return max(_jobs.values(), key=lambda item: item.created_at)


def cancel_scan_job(job_id: str) -> bool:
    job = get_scan_job(job_id)
    if job is None:
        return False
    job.cancel.set()
    if job.status in {"pending", "running"}:
        job.status = "cancelled"
        job.updated_at = time.time()
    return True


def _resolve_roots(root: str | None, *, full_disk: bool) -> tuple[list[Path], bool]:
    if full_disk:
        return full_disk_roots(), False
    if root and root.strip():
        return [Path(root.strip()).expanduser()], True
    return default_scan_roots(), False


def _run_job(job: ScanJob) -> None:
    job.status = "running"
    job.updated_at = time.time()
    try:
        roots, user_picked = _resolve_roots(
            job.roots[0] if job.roots else None,
            full_disk=job.full_disk,
        )
        if job.full_disk or not job.roots:
            job.roots = [str(item) for item in roots]

        def on_progress(current: str, dirs_scanned: int, files_found: int) -> None:
            job.current = current
            job.dirs_scanned = dirs_scanned
            job.files_found = files_found
            job.updated_at = time.time()

        found = scan_weight_roots(
            roots,
            full_disk=job.full_disk,
            user_picked=user_picked,
            should_cancel=job.cancel.is_set,
            on_progress=on_progress,
        )
        job.found = found
        job.files_found = len(found)
        if job.cancel.is_set():
            job.status = "cancelled"
        else:
            job.status = "completed"
    except Exception as exc:  # noqa: BLE001 — surface scan failure to the UI
        job.status = "failed"
        job.error = str(exc)
    finally:
        job.updated_at = time.time()


def start_scan_job(*, root: str | None = None, full_disk: bool = False) -> ScanJob:
    """Start a background walk. Existing running jobs are cancelled first."""
    with _lock:
        for existing in _jobs.values():
            if existing.status in {"pending", "running"}:
                existing.cancel.set()
                existing.status = "cancelled"
                existing.updated_at = time.time()
    job = ScanJob(
        job_id=str(uuid.uuid4()),
        roots=[root] if root and root.strip() else [],
        full_disk=full_disk,
    )
    _remember(job)
    thread = threading.Thread(
        target=_run_job, args=(job,), name=f"local-weight-scan-{job.job_id}", daemon=True
    )
    thread.start()
    return job
