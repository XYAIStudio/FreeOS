"""Start the bundled openXYOS sidecar when the desktop portable ships it."""

from __future__ import annotations

import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from octop.infra.utils.paths import PathLayout
from octop.modules.org_os.service import OrgModuleService


@dataclass(frozen=True)
class SidecarStartResult:
    started: bool
    already: bool
    reachable: bool
    url: str
    command: str
    detail: str
    launcher: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "started": self.started,
            "already": self.already,
            "reachable": self.reachable,
            "url": self.url,
            "command": self.command,
            "detail": self.detail,
            "launcher": self.launcher,
        }


def portable_root() -> Path | None:
    green = (os.environ.get("OCTOP_GREEN_PACKAGES") or "").strip()
    if green:
        return Path(green).expanduser().resolve().parent
    home = PathLayout.from_env().root
    candidate = home / "portable"
    if (candidate / "org-sidecar").is_dir():
        return candidate
    return None


def find_sidecar_launcher() -> Path | None:
    root = portable_root()
    if root is not None:
        bundled = root / "org-sidecar"
        for name in ("start-sidecar.bat", "start-sidecar.sh"):
            path = bundled / name
            if path.is_file():
                if name.endswith(".bat") and sys.platform != "win32":
                    continue
                if name.endswith(".sh") and sys.platform == "win32":
                    continue
                return path
    here = Path(__file__).resolve()
    for parent in here.parents:
        script = parent / "scripts" / "run-org-sidecar.sh"
        if script.is_file() and sys.platform != "win32":
            return script
    return None


def start_sidecar(service: OrgModuleService, *, wait: float = 12.0) -> SidecarStartResult:
    health = service.probe_sidecar()
    launcher = find_sidecar_launcher()
    command = str(launcher) if launcher is not None else service.status().start_command
    if health.reachable:
        return SidecarStartResult(
            started=False,
            already=True,
            reachable=True,
            url=health.url,
            command=command,
            detail="sidecar already reachable",
            launcher=str(launcher or ""),
        )
    if launcher is None or not launcher.is_file():
        return SidecarStartResult(
            started=False,
            already=False,
            reachable=False,
            url=health.url,
            command=command,
            detail="no bundled sidecar launcher; run scripts/run-org-sidecar.sh from a source tree",
        )
    popen_kwargs: dict[str, Any] = {
        "cwd": str(launcher.parent),
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
        "start_new_session": True,
    }
    if sys.platform == "win32":
        cmd: list[str] = [str(launcher)]
    else:
        cmd = ["bash", str(launcher)]
    # NOCA:DangerousSubprocessUseAudit(argv list; launcher is a bundled script we own)
    subprocess.Popen(cmd, **popen_kwargs)
    deadline = time.time() + max(wait, 1.0)
    last = service.probe_sidecar()
    while time.time() < deadline and not last.reachable:
        time.sleep(0.4)
        last = service.probe_sidecar()
    return SidecarStartResult(
        started=True,
        already=False,
        reachable=last.reachable,
        url=last.url,
        command=command,
        detail="ok" if last.reachable else "started but not reachable yet",
        launcher=str(launcher),
    )
