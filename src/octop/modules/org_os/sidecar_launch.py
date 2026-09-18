"""Start the bundled openXYOS sidecar when the desktop portable ships it."""

from __future__ import annotations

import contextlib
import logging
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from octop.infra.utils.paths import PathLayout
from octop.modules.org_os.service import OrgModuleService
from octop.modules.org_os.sidecar_secrets import (
    INGEST_TOKEN_KEY,
    load_or_create_sidecar_secrets,
    sidecar_data_dir,
)

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


def _install_openxyos() -> Path | None:
    """#21 installer tree: $INSTDIR\\openxyos or FREEOS_OPENXYOS_INSTALL."""
    raw = (os.environ.get("FREEOS_OPENXYOS_INSTALL") or "").strip()
    if raw:
        path = Path(raw).expanduser()
        return path if path.is_dir() else None
    green = (os.environ.get("OCTOP_GREEN_PACKAGES") or "").strip()
    if not green:
        return None
    # portable/packages → sibling ../openxyos (installer) or ../org-sidecar
    parent = Path(green).expanduser().resolve().parent
    for candidate in (parent / "openxyos", parent.parent / "openxyos"):
        if candidate.is_dir():
            return candidate
    return None


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
        _install_openxyos(),
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


def _app_looks_complete(app: Path) -> bool:
    if not (app / "dist" / "index.html").is_file():
        return False
    return (app / "backend-dist" / "server.js").is_file() or (
        app / "backend" / "server.ts"
    ).is_file()


def _bundle_looks_complete(path: Path) -> bool:
    if not path.is_dir():
        return False
    node = path / "node" / "node.exe"
    posix = path / "node" / "bin" / "node"
    if not (node.is_file() or posix.is_file()):
        return False
    return _app_looks_complete(path / "openxyos") or _app_looks_complete(path)


def _copy_tree(src: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    for child in src.iterdir():
        target = dest / child.name
        if child.is_dir():
            _copy_tree(child, target)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(child.read_bytes())


def heal_openxyos_layout(root: Path) -> bool:
    """Promote a nested ``openxyos\\`` tree so start helpers find FE+BE."""
    if not root.is_dir():
        return False
    nested = root / "openxyos"
    need_flat = (
        (nested / "dist" / "index.html").is_file() and not (root / "dist" / "index.html").is_file()
    ) or (
        (nested / "backend-dist" / "server.js").is_file()
        and not (root / "backend-dist" / "server.js").is_file()
    )
    if need_flat:
        _copy_tree(nested, root)
    if _bundle_looks_complete(root):
        return True
    candidates: list[Path] = [
        nested,
        root / "org-sidecar",
        nested / "openxyos",
        nested / "org-sidecar",
    ]
    try:
        children = [child for child in root.iterdir() if child.is_dir()]
    except OSError:
        children = []
    for child in children:
        candidates.extend((child, child / "openxyos", child / "org-sidecar"))
    seen: set[Path] = set()
    for candidate in candidates:
        try:
            clean = candidate.resolve()
        except OSError:
            continue
        if clean in seen or clean == root.resolve():
            continue
        seen.add(clean)
        if not _bundle_looks_complete(clean):
            continue
        _copy_tree(clean, root)
        need_flat = (nested / "dist" / "index.html").is_file() and not (
            root / "dist" / "index.html"
        ).is_file()
        if need_flat:
            _copy_tree(nested, root)
        return _bundle_looks_complete(root)
    return _bundle_looks_complete(root)


def _sidecar_app_dir(bundled: Path) -> Path:
    """Prefer the healed live root when FE+BE exist there.

    A leftover nested ``openxyos/openxyos`` tree must not win: Node started
    from that cwd exits immediately with empty stdout/stderr.
    """
    if _app_looks_complete(bundled):
        return bundled
    nested = bundled / "openxyos"
    if _app_looks_complete(nested):
        return nested
    return bundled


def find_sidecar_runtime() -> SidecarRuntime | None:
    for candidate in sidecar_candidate_roots():
        heal_openxyos_layout(candidate)
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
    app = _sidecar_app_dir(bundled)
    runtime = SidecarRuntime(node=node, app=app, root=bundled)
    if not runtime.server.is_file():
        return None
    return runtime


def find_sidecar_launcher() -> Path | None:
    bundled = sidecar_bundle_dir()
    if bundled is not None:
        names = (
            ("start-sidecar.ps1", "start-sidecar.cmd", "start-sidecar.bat", "start-sidecar.sh")
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
                if name.endswith(".ps1") and sys.platform != "win32":
                    continue
                return path
    here = Path(__file__).resolve()
    for parent in here.parents:
        script = parent / "scripts" / "run-org-sidecar.sh"
        if script.is_file() and sys.platform != "win32":
            return script
    return None


def sidecar_candidate_roots() -> list[Path]:
    """Live / install / portable roots that may carry ``.install-ready``."""
    roots: list[Path] = []
    seen: set[Path] = set()

    def add(path: Path | None) -> None:
        if path is None:
            return
        try:
            clean = path.expanduser()
        except OSError:
            return
        if clean in seen:
            return
        seen.add(clean)
        roots.append(clean)

    add(_explicit_openxyos_home())
    add(_localappdata_openxyos())
    base = (os.environ.get("LOCALAPPDATA") or "").strip()
    if base:
        add(Path(base) / "FreeOS" / "openxyos")
    add(_install_openxyos())
    add(PathLayout.from_env().root / "openxyos")
    root = portable_root()
    if root is not None:
        add(root / "org-sidecar")
    return roots


def sidecar_install_ready() -> bool:
    """True when Setup wrote ``.install-ready`` on a live openXYOS tree."""
    for root in sidecar_candidate_roots():
        if (root / ".install-ready").is_file():
            return True
        if (root / "org-sidecar" / ".install-ready").is_file():
            return True
    return False


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


def sidecar_launch_env(home: Path, *, dashboard_port: int | None = None) -> dict[str, str]:
    secrets = load_or_create_sidecar_secrets(home)
    jwt = secrets["JWT_SECRET"]
    cookie = secrets["COOKIE_SECRET"]
    ingest = secrets[INGEST_TOKEN_KEY]
    port = (os.environ.get("FREEOS_ORG_SIDECAR_PORT") or "3780").strip() or "3780"
    if dashboard_port is None:
        raw = (os.environ.get("OCTOP_PORT") or "").strip()
        dashboard_port = int(raw) if raw.isdigit() else 8088
    origin = (
        f"http://127.0.0.1:{dashboard_port},http://localhost:{dashboard_port},"
        "http://127.0.0.1:18900,http://localhost:18900,"
        "http://127.0.0.1:8088,http://localhost:8088,"
        f"http://127.0.0.1:{port},http://localhost:{port},http://[::1]:{port}"
    )
    env = os.environ.copy()
    configured = (env.get("CORS_ORIGIN") or "").strip()
    cors_origin = (
        ",".join(item for item in f"{configured},{origin}".split(",") if item.strip())
        if configured
        else origin
    )
    env.update(
        {
            "NODE_ENV": "production",
            "PORT": port,
            "DB_DIALECT": "sqlite",
            "DATABASE_PATH": str(sidecar_data_dir(home) / "xiongyuan.db"),
            "AIR_GAP_MODE": "true",
            "ALLOW_PUBLIC_REGISTRATION": env.get("ALLOW_PUBLIC_REGISTRATION") or "false",
            "SEED_DEMO_DATA": env.get("SEED_DEMO_DATA") or "false",
            "JWT_SECRET": jwt,
            "COOKIE_SECRET": cookie,
            INGEST_TOKEN_KEY: ingest,
            "CORS_ORIGIN": cors_origin,
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
    """Argv used to spawn the sidecar.

    Windows prefers the shipped ``start-sidecar.ps1`` so CORS/env always match
    the current helper (and so a stale Node is replaced first).
    """
    if launcher is not None and sys.platform == "win32" and launcher.suffix.lower() == ".ps1":
        return [
            "powershell",
            "-NoProfile",
            "-WindowStyle",
            "Hidden",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(launcher),
        ]
    if runtime is not None:
        return sidecar_node_argv(runtime)
    if launcher is None:
        return []
    if sys.platform == "win32" and launcher.suffix.lower() in {".bat", ".cmd"}:
        return ["cmd", "/c", str(launcher)]
    if launcher.suffix == ".sh" or launcher.name.endswith(".sh"):
        return ["bash", str(launcher)]
    return [str(launcher)]


def stop_stale_openxyos(root: Path) -> None:
    """Stop a previous FreeOS-openxyos Node that still owns the live dir."""
    pid_file = root / "start.pid"
    if pid_file.is_file():
        raw = pid_file.read_text(encoding="utf-8", errors="replace").strip()
        if raw.isdigit():
            pid = int(raw)
            if pid > 0:
                with contextlib.suppress(OSError):
                    os.kill(pid, 15)
                if sys.platform == "win32":
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(pid)],
                        check=False,
                        capture_output=True,
                    )
        with contextlib.suppress(OSError):
            pid_file.unlink()
    node = root / "node" / "node.exe"
    if sys.platform == "win32" and node.is_file():
        script = (
            "$want = [IO.Path]::GetFullPath('" + str(node).replace("'", "''") + "'); "
            "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" -ErrorAction SilentlyContinue | "
            "ForEach-Object { if ($_.ExecutablePath) { "
            "try { if ([IO.Path]::GetFullPath($_.ExecutablePath) -eq $want) { "
            "Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } } catch {} } }"
        )
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", script],
            check=False,
            capture_output=True,
        )


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
    if launcher is not None and launcher.suffix.lower() == ".ps1":
        cwd = launcher.parent
        heal_openxyos_layout(cwd)
        stop_stale_openxyos(cwd)
    elif runtime is not None:
        cwd = runtime.app
        heal_openxyos_layout(runtime.root)
        stop_stale_openxyos(runtime.root)
    elif launcher is not None:
        cwd = launcher.parent
        heal_openxyos_layout(cwd)
        stop_stale_openxyos(cwd)
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


def _embed_ok(service: OrgModuleService) -> bool:
    probe = getattr(service, "probe_sidecar_embed", None)
    if not callable(probe):
        return True
    try:
        return bool(probe())
    except Exception:
        return True


def start_sidecar(
    service: OrgModuleService, *, wait: float = 20.0, force: bool = False
) -> SidecarStartResult:
    health = service.probe_sidecar()
    command = sidecar_start_command()
    runtime = find_sidecar_runtime()
    launcher = find_sidecar_launcher()
    launcher_label = str(runtime.node if runtime is not None else launcher or "")
    if health.reachable and _embed_ok(service) and not force:
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


def _bundled_start_helper() -> Path | None:
    """``start-sidecar.*`` shipped with the live / portable tree (not source npm)."""
    launcher = find_sidecar_launcher()
    if launcher is None:
        return None
    if launcher.name.startswith("start-sidecar"):
        return launcher
    return None


def sidecar_runtime_root() -> Path | None:
    runtime = find_sidecar_runtime()
    if runtime is not None:
        return runtime.root
    helper = _bundled_start_helper()
    if helper is not None:
        return helper.parent
    for root in sidecar_candidate_roots():
        if (root / ".install-ready").is_file():
            return root
        if (root / "org-sidecar" / ".install-ready").is_file():
            return root / "org-sidecar"
    return None


def _wait_until_down(service: OrgModuleService, wait: float = 8.0) -> None:
    deadline = time.time() + max(wait, 0.4)
    while time.time() < deadline and service.probe_sidecar().reachable:
        time.sleep(0.3)


def restart_sidecar(service: OrgModuleService, *, wait: float = 45.0) -> SidecarStartResult:
    """Stop the live openXYOS Node, then start FE+BE again and wait for livez."""
    root = sidecar_runtime_root()
    if root is not None:
        heal_openxyos_layout(root)
        stop_stale_openxyos(root)
        _wait_until_down(service)
    result = start_sidecar(service, wait=wait, force=True)
    if result.reachable:
        return SidecarStartResult(
            started=True,
            already=False,
            reachable=True,
            url=result.url,
            command=result.command,
            detail="restarted openXYOS frontend and backend",
            launcher=result.launcher,
        )
    if result.started:
        return SidecarStartResult(
            started=True,
            already=False,
            reachable=False,
            url=result.url,
            command=result.command,
            detail="restarted but not reachable yet; check logs/org-sidecar.log",
            launcher=result.launcher,
        )
    return result


def ensure_sidecar(service: OrgModuleService, *, wait: float | None = None) -> SidecarStartResult:
    """Keep the bundled sidecar up on desktop / first launch.

    Auto-starts a portable / install-time runtime or ``start-sidecar.*``.
    A source-tree ``scripts/run-org-sidecar.sh`` is left for an explicit
    Start click so host boot never runs ``npm start`` in tests or unpackaged trees.
    """
    if wait is None:
        wait = 30.0 if sidecar_install_ready() else 8.0
    health = service.probe_sidecar()
    command = sidecar_start_command()
    if health.reachable and _embed_ok(service):
        return SidecarStartResult(
            started=False,
            already=True,
            reachable=True,
            url=health.url,
            command=command,
            detail="sidecar already reachable",
        )
    can_auto = find_sidecar_runtime() is not None or (
        sidecar_install_ready() and _bundled_start_helper() is not None
    )
    if not can_auto:
        return SidecarStartResult(
            started=False,
            already=False,
            reachable=False,
            url=health.url,
            command=command,
            detail="no bundled sidecar runtime",
        )
    return start_sidecar(service, wait=wait)
