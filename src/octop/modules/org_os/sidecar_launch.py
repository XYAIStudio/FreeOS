"""Start the bundled openXYOS sidecar when the desktop portable ships it."""

from __future__ import annotations

import logging
import os
import subprocess
import sys
import time
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from octop.infra.utils.paths import PathLayout
from octop.modules.org_os.service import OrgModuleService

logger = logging.getLogger(__name__)

# Windows: hide the console and detach from the host so closing the dashboard
# does not tear the sidecar down with a ctrl-c on the parent console.
_WIN_CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
_WIN_DETACHED = getattr(subprocess, "DETACHED_PROCESS", 0x00000008)
_WIN_NEW_GROUP = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0x00000200)


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


@dataclass(frozen=True)
class SidecarRuntime:
    node: Path
    app: Path
    root: Path

    @property
    def server(self) -> Path:
        return self.app / "backend" / "server.ts"

    @property
    def frontend(self) -> Path:
        return self.app / "dist" / "index.html"

    @property
    def compiled_server(self) -> Path:
        for candidate in (
            self.app / "backend-dist" / "server.js",
            self.app / "dist-server" / "server.js",
        ):
            if candidate.is_file():
                return candidate
        return self.app / "backend-dist" / "server.js"


def _explicit_openxyos_home() -> Path | None:
    raw = (os.environ.get("FREEOS_OPENXYOS_HOME") or "").strip()
    if not raw:
        return None
    path = Path(raw).expanduser()
    return path if path.is_dir() else None


def _localappdata_openxyos() -> Path | None:
    base = (os.environ.get("LOCALAPPDATA") or "").strip()
    if not base:
        return None
    path = Path(base) / "FreeOS" / "openxyos"
    return path if path.is_dir() else None


def portable_root() -> Path | None:
    green = (os.environ.get("OCTOP_GREEN_PACKAGES") or "").strip()
    if green:
        parent = Path(green).expanduser().resolve().parent
        if (parent / "org-sidecar").is_dir():
            return parent
    home = PathLayout.from_env().root
    for candidate in (home / "portable", home):
        if (candidate / "org-sidecar").is_dir():
            return candidate
    return None


def sidecar_bundle_dir() -> Path | None:
    for candidate in (
        _explicit_openxyos_home(),
        _localappdata_openxyos(),
        PathLayout.from_env().root / "openxyos",
    ):
        if candidate is None:
            continue
        if _bundle_looks_complete(candidate):
            return candidate
        nested = candidate / "org-sidecar"
        if _bundle_looks_complete(nested):
            return nested
    root = portable_root()
    if root is None:
        return None
    bundled = root / "org-sidecar"
    return bundled if bundled.is_dir() else None


def _bundle_looks_complete(path: Path) -> bool:
    if not path.is_dir():
        return False
    node = path / "node" / "node.exe"
    posix = path / "node" / "bin" / "node"
    app = path / "openxyos"
    return (node.is_file() or posix.is_file()) and (app / "backend" / "server.ts").is_file()


def find_sidecar_runtime() -> SidecarRuntime | None:
    bundled = sidecar_bundle_dir()
    if bundled is None:
        return None
    node_candidates = (
        bundled / "node" / "node.exe",
        bundled / "node" / "bin" / "node",
    )
    node = next((path for path in node_candidates if path.is_file()), None)
    if node is None:
        return None
    app = bundled / "openxyos"
    runtime = SidecarRuntime(node=node, app=app, root=bundled)
    if not runtime.server.is_file():
        return None
    return runtime


def find_sidecar_launcher() -> Path | None:
    bundled = sidecar_bundle_dir()
    if bundled is not None:
        names = (
            ("start-sidecar.bat", "start-sidecar.sh")
            if sys.platform == "win32"
            else ("start-sidecar.sh", "start-sidecar.bat")
        )
        for name in names:
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


def sidecar_can_start() -> bool:
    return find_sidecar_runtime() is not None or find_sidecar_launcher() is not None


def sidecar_start_command() -> str:
    runtime = find_sidecar_runtime()
    if runtime is not None:
        return sidecar_node_command(runtime)
    launcher = find_sidecar_launcher()
    if launcher is not None:
        return str(launcher)
    if sys.platform == "win32":
        return r"org-sidecar\start-sidecar.bat"
    return "bash scripts/run-org-sidecar.sh"


def sidecar_node_argv(runtime: SidecarRuntime) -> list[str]:
    compiled = runtime.compiled_server
    if compiled.is_file():
        rel = str(compiled.relative_to(runtime.app))
        return [str(runtime.node), rel]
    return [str(runtime.node), "--import", "tsx", "backend/server.ts"]


def sidecar_node_command(runtime: SidecarRuntime) -> str:
    return " ".join(sidecar_node_argv(runtime))


def _load_or_create_secrets(data_dir: Path) -> tuple[str, str]:
    env_path = data_dir / "sidecar.env"
    jwt = ""
    cookie = ""
    if env_path.is_file():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            if key.strip() == "JWT_SECRET":
                jwt = value.strip()
            elif key.strip() == "COOKIE_SECRET":
                cookie = value.strip()
    if not jwt:
        jwt = os.urandom(32).hex()
    if not cookie:
        cookie = os.urandom(32).hex()
    data_dir.mkdir(parents=True, exist_ok=True)
    env_path.write_text(
        f"JWT_SECRET={jwt}\nCOOKIE_SECRET={cookie}\n",
        encoding="utf-8",
    )
    with suppress(OSError):
        env_path.chmod(0o600)
    return jwt, cookie


def sidecar_launch_env(home: Path, *, dashboard_port: int | None = None) -> dict[str, str]:
    data_dir = Path(os.environ.get("FREEOS_ORG_DATA") or (home / "org-os"))
    jwt, cookie = _load_or_create_secrets(data_dir)
    port = (os.environ.get("FREEOS_ORG_SIDECAR_PORT") or "3780").strip() or "3780"
    if dashboard_port is None:
        raw = (os.environ.get("OCTOP_PORT") or "").strip()
        dashboard_port = int(raw) if raw.isdigit() else 8088
    origin = (
        f"http://127.0.0.1:{dashboard_port},http://localhost:{dashboard_port},"
        "http://127.0.0.1:18900,http://localhost:18900,"
        "http://127.0.0.1:8088,http://localhost:8088"
    )
    env = os.environ.copy()
    env.update(
        {
            "NODE_ENV": "production",
            "PORT": port,
            "DB_DIALECT": "sqlite",
            "DATABASE_PATH": str(data_dir / "xiongyuan.db"),
            "AIR_GAP_MODE": "true",
            "ALLOW_PUBLIC_REGISTRATION": env.get("ALLOW_PUBLIC_REGISTRATION") or "false",
            "SEED_DEMO_DATA": env.get("SEED_DEMO_DATA") or "false",
            "JWT_SECRET": jwt,
            "COOKIE_SECRET": cookie,
            "CORS_ORIGIN": env.get("CORS_ORIGIN") or origin,
            "FREEOS_HOME": str(home),
            "OCTOP_HOME": str(home),
            "FREEOS_ORG_SIDECAR_PORT": port,
        }
    )
    return env


def sidecar_log_path(home: Path | None = None) -> Path:
    root = home or PathLayout.from_env().root
    log_dir = root / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir / "org-sidecar.log"


def launch_sidecar_argv(runtime: SidecarRuntime | None, launcher: Path | None) -> list[str]:
    """Argv used to spawn the sidecar. Prefer bundled Node over .bat/.sh."""
    if runtime is not None:
        return sidecar_node_argv(runtime)
    if launcher is None:
        return []
    if sys.platform == "win32" and launcher.suffix.lower() in {".bat", ".cmd"}:
        return ["cmd", "/c", str(launcher)]
    if launcher.suffix == ".sh" or launcher.name.endswith(".sh"):
        return ["bash", str(launcher)]
    return [str(launcher)]


def _popen_kwargs(cwd: Path, env: dict[str, str], log_file: Any) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "cwd": str(cwd),
        "env": env,
        "stdout": log_file,
        "stderr": subprocess.STDOUT,
    }
    if sys.platform == "win32":
        kwargs["creationflags"] = _WIN_CREATE_NO_WINDOW | _WIN_DETACHED | _WIN_NEW_GROUP
        kwargs["close_fds"] = True
    else:
        kwargs["start_new_session"] = True
    return kwargs


def _spawn(service: OrgModuleService) -> tuple[list[str], str]:
    runtime = find_sidecar_runtime()
    launcher = find_sidecar_launcher()
    argv = launch_sidecar_argv(runtime, launcher)
    if not argv:
        return [], "no bundled sidecar runtime or launcher"
    if runtime is not None:
        cwd = runtime.app
    elif launcher is not None:
        cwd = launcher.parent
    else:
        return [], "no bundled sidecar runtime or launcher"
    home = service.home
    env = sidecar_launch_env(home)
    if runtime is not None and not runtime.frontend.is_file():
        logger.warning("openXYOS frontend build missing at %s", runtime.frontend)
    log_path = sidecar_log_path(home)
    command = " ".join(argv)
    log_file = log_path.open("a", encoding="utf-8")
    log_file.write(f"\n--- start {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())} ---\n")
    log_file.flush()
    # NOCA:DangerousSubprocessUseAudit(argv list; launcher/node is a bundled binary we own)
    subprocess.Popen(argv, **_popen_kwargs(cwd, env, log_file))
    return argv, command


def _wait_reachable(service: OrgModuleService, wait: float) -> Any:
    deadline = time.time() + max(wait, 1.0)
    last = service.probe_sidecar()
    while time.time() < deadline and not last.reachable:
        time.sleep(0.4)
        last = service.probe_sidecar()
    return last


def start_sidecar(service: OrgModuleService, *, wait: float = 8.0) -> SidecarStartResult:
    health = service.probe_sidecar()
    command = sidecar_start_command()
    runtime = find_sidecar_runtime()
    launcher = find_sidecar_launcher()
    launcher_label = str(runtime.node if runtime is not None else launcher or "")
    if health.reachable:
        return SidecarStartResult(
            started=False,
            already=True,
            reachable=True,
            url=health.url,
            command=command,
            detail="sidecar already reachable",
            launcher=launcher_label,
        )
    if not sidecar_can_start():
        return SidecarStartResult(
            started=False,
            already=False,
            reachable=False,
            url=health.url,
            command=command,
            detail="no bundled sidecar runtime",
            launcher=launcher_label,
        )
    try:
        argv, command = _spawn(service)
    except OSError as exc:
        logger.exception("failed to spawn openXYOS sidecar")
        return SidecarStartResult(
            started=False,
            already=False,
            reachable=False,
            url=health.url,
            command=command,
            detail=f"spawn failed: {exc}",
            launcher=launcher_label,
        )
    last = _wait_reachable(service, wait)
    missing_fe = runtime is not None and not runtime.frontend.is_file()
    if last.reachable:
        detail = "ok"
    elif missing_fe:
        detail = (
            "started but frontend build (dist/index.html) is missing; "
            "sidecar may still come up — check logs/org-sidecar.log"
        )
    else:
        detail = "started but not reachable yet; check logs/org-sidecar.log"
    logger.info("openXYOS sidecar spawn argv=%s reachable=%s", argv, last.reachable)
    return SidecarStartResult(
        started=True,
        already=False,
        reachable=last.reachable,
        url=last.url,
        command=command,
        detail=detail,
        launcher=launcher_label,
    )


def ensure_sidecar(service: OrgModuleService, *, wait: float = 8.0) -> SidecarStartResult:
    """Keep the bundled sidecar up on desktop / first launch.

    Only auto-starts when the portable ``org-sidecar`` runtime is present.
    A source-tree ``scripts/run-org-sidecar.sh`` is left for an explicit
    Start click so host boot never runs ``npm start`` in tests or unpackaged trees.
    """
    health = service.probe_sidecar()
    command = sidecar_start_command()
    if health.reachable:
        return SidecarStartResult(
            started=False,
            already=True,
            reachable=True,
            url=health.url,
            command=command,
            detail="sidecar already reachable",
        )
    if find_sidecar_runtime() is None:
        return SidecarStartResult(
            started=False,
            already=False,
            reachable=False,
            url=health.url,
            command=command,
            detail="no bundled sidecar runtime",
        )
    return start_sidecar(service, wait=wait)
