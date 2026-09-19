"""Owned Node business process: private port, restart, and host-bound shutdown."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import shutil
import socket
import subprocess
from pathlib import Path

from octop.modules.org_os.sidecar_launch import (
    find_sidecar_runtime,
    sidecar_launch_env,
    sidecar_node_argv,
)

logger = logging.getLogger(__name__)


class ManagedOrganizationRuntime:
    def __init__(self, home: Path) -> None:
        self.home = home
        self.process: asyncio.subprocess.Process | None = None
        self.task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        source = Path(__file__).resolve().parents[4] / "modules" / "openxyos"
        source_ready = (source / "node_modules" / "tsx").is_dir()
        # A checkout must exercise the source it is changing.  Installed desktop
        # runs set OCTOP_GREEN_PACKAGES and use the bundled, versioned runtime.
        if source_ready and not os.environ.get("OCTOP_GREEN_PACKAGES"):
            node = shutil.which("node")
            if not node:
                raise RuntimeError(
                    "Organization runtime missing; install the complete FreeOS package"
                )
            command, cwd = [node, "--import", "tsx", "backend/server.ts"], source
        else:
            bundle = await asyncio.to_thread(find_sidecar_runtime)
            if not bundle:
                raise RuntimeError(
                    "Organization runtime missing; install the complete FreeOS package"
                )
            command, cwd = sidecar_node_argv(bundle), bundle.app
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        os.environ["FREEOS_ORG_SIDECAR_PORT"] = str(port)
        os.environ["OPENXYOS_BASE_URL"] = f"http://127.0.0.1:{port}"
        env = await asyncio.to_thread(sidecar_launch_env, self.home)
        env.update({"FREEOS_ORG_INTEGRATED": "1", "HOST": "127.0.0.1"})
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
                        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
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
