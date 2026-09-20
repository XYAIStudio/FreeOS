"""Owned Node business process: private port, restart, and host-bound shutdown.

The listening origin is written to ``{FREEOS_HOME}/org-os/runtime.json`` so CLI
and ``/api/org-module/*`` can ingest into the same control plane without
hard-coding ``127.0.0.1:3780`` or requiring the caller to export
``OPENXYOS_BASE_URL``.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import shutil
import socket
import subprocess
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from octop.modules.org_os.sidecar_launch import (
    find_sidecar_runtime,
    sidecar_launch_env,
    sidecar_node_argv,
)

logger = logging.getLogger(__name__)

RUNTIME_JSON_NAME = "runtime.json"


def runtime_json_path(home: Path) -> Path:
    return Path(home) / "org-os" / RUNTIME_JSON_NAME


def _pid_looks_dead(pid: int) -> bool:
    if pid <= 0:
        return True
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return True
    except (PermissionError, OSError, ValueError):
        return False
    return False


def _clean_base_url(raw: str) -> str:
    cleaned = (raw or "").strip().rstrip("/")
    parsed = urlparse(cleaned)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    return cleaned


def read_runtime_base_url(home: Path) -> str:
    """Return the managed control-plane origin, or empty when none is live."""
    path = runtime_json_path(home)
    if not path.is_file():
        return ""
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeError):
        return ""
    if not isinstance(raw, dict):
        return ""
    pid = raw.get("pid")
    if isinstance(pid, int) and _pid_looks_dead(pid):
        return ""
    url = raw.get("base_url")
    if isinstance(url, str):
        return _clean_base_url(url)
    return ""


def write_runtime_record(
    home: Path,
    *,
    base_url: str,
    port: int | None = None,
    pid: int | None = None,
    managed: bool = True,
) -> Path:
    """Persist the live control-plane origin for host/CLI ingest."""
    cleaned = _clean_base_url(base_url)
    if not cleaned:
        raise ValueError("managed runtime URL is not an http(s) origin")
    path = runtime_json_path(home)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = {"base_url": cleaned, "managed": bool(managed)}
    if port is not None:
        payload["port"] = int(port)
    if pid is not None:
        payload["pid"] = int(pid)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return path


def update_runtime_pid(home: Path, pid: int) -> None:
    path = runtime_json_path(home)
    data: dict[str, Any] = {}
    if path.is_file():
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError, UnicodeError):
            raw = {}
        if isinstance(raw, dict):
            data = raw
    data["pid"] = int(pid)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def clear_runtime_record(home: Path) -> None:
    path = runtime_json_path(home)
    with contextlib.suppress(OSError):
        path.unlink()


def resolve_organization_command() -> tuple[list[str], Path] | None:
    """Return ``(argv, cwd)`` for the transitional Node process, or ``None``.

    ``uv run`` / Docker / source checkouts stay zero-Node: missing runtime is
    skip, not host abort. Desktop with a bundled sidecar still resolves.
    """
    source = Path(__file__).resolve().parents[4] / "modules" / "openxyos"
    source_ready = (source / "node_modules" / "tsx").is_dir()
    # A checkout must exercise the source it is changing.  Installed desktop
    # runs set OCTOP_GREEN_PACKAGES and use the bundled, versioned runtime.
    if source_ready and not os.environ.get("OCTOP_GREEN_PACKAGES"):
        node = shutil.which("node")
        if not node:
            return None
        return [node, "--import", "tsx", "backend/server.ts"], source
    bundle = find_sidecar_runtime()
    if not bundle:
        return None
    return sidecar_node_argv(bundle), bundle.app


class ManagedOrganizationRuntime:
    def __init__(self, home: Path) -> None:
        self.home = home
        self.process: asyncio.subprocess.Process | None = None
        self.task: asyncio.Task[None] | None = None
        self.base_url: str = ""

    async def start(self) -> None:
        resolved = await asyncio.to_thread(resolve_organization_command)
        if resolved is None:
            logger.warning(
                "managed Organization Node skipped (transitional bridge; host stays "
                "zero-Node). Bundle a sidecar or set SHIP_OPENXYOS_RUNTIME=1 for "
                "the desktop iframe flavor."
            )
            return
        command, cwd = resolved
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        self.base_url = f"http://127.0.0.1:{port}"
        os.environ["FREEOS_ORG_SIDECAR_PORT"] = str(port)
        os.environ["OPENXYOS_BASE_URL"] = self.base_url
        await asyncio.to_thread(
            write_runtime_record,
            self.home,
            base_url=self.base_url,
            port=port,
        )
        env = await asyncio.to_thread(sidecar_launch_env, self.home)
        env.update(
            {
                "FREEOS_ORG_INTEGRATED": "1",
                "FREEOS_ORG_LOCAL_TEST": "1",
                "HOST": "127.0.0.1",
            }
        )
        log_path = self.home / "logs" / "organization-runtime.log"
        await asyncio.to_thread(log_path.parent.mkdir, parents=True, exist_ok=True)

        async def supervise() -> None:
            delay = 1
            while True:
                with log_path.open("ab") as log:
                    self.process = await asyncio.create_subprocess_exec(
                        *command,
                        cwd=cwd,
                        env=env,
                        stdout=log,
                        stderr=log,
                        creationflags=int(getattr(subprocess, "CREATE_NO_WINDOW", 0)),
                    )
                    if self.process.pid:
                        await asyncio.to_thread(
                            update_runtime_pid, self.home, int(self.process.pid)
                        )
                    result = await self.process.wait()
                logger.error("Organization runtime exited (%s); restarting in %ss", result, delay)
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30)

        self.task = asyncio.create_task(supervise(), name="organization-runtime")

    async def stop(self) -> None:
        if self.task:
            self.task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self.task
        if self.process and self.process.returncode is None:
            self.process.terminate()
            try:
                await asyncio.wait_for(self.process.wait(), timeout=10)
            except TimeoutError:
                self.process.kill()
                await self.process.wait()
        await asyncio.to_thread(clear_runtime_record, self.home)
        self.base_url = ""
