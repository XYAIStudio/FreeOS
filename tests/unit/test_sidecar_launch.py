"""Sidecar launcher discovery and Windows spawn argv."""

from __future__ import annotations

from pathlib import Path

import pytest

from octop.modules.org_os.service import OrgModuleService
from octop.modules.org_os.sidecar_launch import (
    SidecarRuntime,
    _sidecar_app_dir,
    ensure_sidecar,
    find_sidecar_runtime,
    launch_sidecar_argv,
    portable_root,
    sidecar_bundle_dir,
    sidecar_can_start,
    sidecar_launch_env,
)


def _write_runtime(root: Path) -> SidecarRuntime:
    bundled = root / "org-sidecar"
    win_node = bundled / "node" / "node.exe"
    posix_node = bundled / "node" / "bin" / "node"
    win_node.parent.mkdir(parents=True, exist_ok=True)
    posix_node.parent.mkdir(parents=True, exist_ok=True)
    win_node.write_text("node", encoding="utf-8")
    posix_node.write_text("node", encoding="utf-8")
    app = bundled / "openxyos"
    (app / "backend").mkdir(parents=True)
    (app / "backend" / "server.ts").write_text("// sidecar", encoding="utf-8")
    (app / "dist").mkdir()
    (app / "dist" / "index.html").write_text("<html></html>", encoding="utf-8")
    return SidecarRuntime(node=win_node, app=app, root=bundled)


def test_portable_root_follows_green_packages(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    staging = tmp_path / "portable"
    (staging / "org-sidecar").mkdir(parents=True)
    (staging / "packages").mkdir()
    monkeypatch.setenv("OCTOP_GREEN_PACKAGES", str(staging / "packages"))
    assert portable_root() == staging.resolve()


def test_find_sidecar_runtime_from_green_packages(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    staging = tmp_path / "portable"
    runtime = _write_runtime(staging)
    monkeypatch.setenv("OCTOP_GREEN_PACKAGES", str(staging / "packages"))
    (staging / "packages").mkdir(exist_ok=True)
    found = find_sidecar_runtime()
    assert found is not None
    assert found.node == runtime.node
    assert found.frontend.is_file()
    assert sidecar_can_start() is True


def test_launch_argv_prefers_bundled_node(tmp_path: Path) -> None:
    runtime = _write_runtime(tmp_path)
    launcher = tmp_path / "org-sidecar" / "start-sidecar.bat"
    launcher.write_text("echo", encoding="utf-8")
    argv = launch_sidecar_argv(runtime, launcher)
    assert argv[0] == str(runtime.node)
    assert argv[1:] == ["--import", "tsx", "backend/server.ts"]


def test_launch_argv_windows_bat(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr("octop.modules.org_os.sidecar_launch.sys.platform", "win32")
    launcher = tmp_path / "start-sidecar.bat"
    launcher.write_text("echo", encoding="utf-8")
    argv = launch_sidecar_argv(None, launcher)
    assert argv == ["cmd", "/c", str(launcher)]


def test_start_sidecar_already_reachable(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from octop.modules.org_os import sidecar_launch
    from octop.modules.org_os.service import SidecarHealth

    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    monkeypatch.setattr(
        service,
        "probe_sidecar",
        lambda timeout=2.0: SidecarHealth(reachable=True, url="http://127.0.0.1:3780"),
    )
    monkeypatch.setattr(service, "probe_sidecar_embed", lambda timeout=2.0: True)
    monkeypatch.setattr(sidecar_launch, "find_sidecar_runtime", lambda: None)
    monkeypatch.setattr(sidecar_launch, "find_sidecar_launcher", lambda: None)
    result = sidecar_launch.start_sidecar(service, wait=0.1)
    assert result.already is True
    assert result.reachable is True
    assert result.started is False


def test_start_sidecar_restarts_when_embed_blocked(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from octop.modules.org_os import sidecar_launch
    from octop.modules.org_os.service import SidecarHealth

    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    monkeypatch.setattr(
        service,
        "probe_sidecar",
        lambda timeout=2.0: SidecarHealth(reachable=True, url="http://127.0.0.1:3780"),
    )
    monkeypatch.setattr(service, "probe_sidecar_embed", lambda timeout=2.0: False)
    monkeypatch.setattr(sidecar_launch, "find_sidecar_runtime", lambda: None)
    monkeypatch.setattr(sidecar_launch, "find_sidecar_launcher", lambda: None)
    result = sidecar_launch.start_sidecar(service, wait=0.1)
    assert result.already is False
    assert result.detail == "no bundled sidecar runtime"


def test_restart_sidecar_stops_then_starts(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from octop.modules.org_os import sidecar_launch

    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    live = tmp_path / "live"
    live.mkdir()
    stopped: list[Path] = []
    monkeypatch.setattr(sidecar_launch, "sidecar_runtime_root", lambda: live)
    monkeypatch.setattr(sidecar_launch, "heal_openxyos_layout", lambda root: True)
    monkeypatch.setattr(sidecar_launch, "stop_stale_openxyos", lambda root: stopped.append(root))
    monkeypatch.setattr(sidecar_launch, "_wait_until_down", lambda service, wait=8.0: None)
    monkeypatch.setattr(
        sidecar_launch,
        "start_sidecar",
        lambda service, wait=20.0, force=False: sidecar_launch.SidecarStartResult(
            started=True,
            already=False,
            reachable=True,
            url="http://127.0.0.1:3780",
            command="start-sidecar",
            detail="ok",
            launcher="node",
        ),
    )
    result = sidecar_launch.restart_sidecar(service, wait=0.1)
    assert stopped == [live]
    assert result.started is True
    assert result.reachable is True
    assert result.detail == "restarted openXYOS frontend and backend"


def test_ensure_sidecar_uses_install_ready_helper(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from octop.modules.org_os import sidecar_launch
    from octop.modules.org_os.service import SidecarHealth

    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    helper = tmp_path / "start-sidecar.sh"
    helper.write_text("#!/bin/sh\n", encoding="utf-8")
    started: list[object] = []
    monkeypatch.setattr(
        service,
        "probe_sidecar",
        lambda timeout=2.0: SidecarHealth(reachable=False, url="http://127.0.0.1:3780"),
    )
    monkeypatch.setattr(sidecar_launch, "find_sidecar_runtime", lambda: None)
    monkeypatch.setattr(sidecar_launch, "sidecar_install_ready", lambda: True)
    monkeypatch.setattr(sidecar_launch, "find_sidecar_launcher", lambda: helper)
    monkeypatch.setattr(
        sidecar_launch,
        "start_sidecar",
        lambda service, wait=8.0, force=False: (
            started.append(wait)
            or sidecar_launch.SidecarStartResult(
                started=True,
                already=False,
                reachable=True,
                url="http://127.0.0.1:3780",
                command=str(helper),
                detail="ok",
            )
        ),
    )
    result = ensure_sidecar(service, wait=0.1)
    assert started == [0.1]
    assert result.started is True


def test_ensure_sidecar_skips_source_tree_script(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from octop.modules.org_os import sidecar_launch
    from octop.modules.org_os.service import SidecarHealth

    service = OrgModuleService(config_path=tmp_path / "config.json", home=tmp_path)
    monkeypatch.setattr(
        service,
        "probe_sidecar",
        lambda timeout=2.0: SidecarHealth(reachable=False, url="http://127.0.0.1:3780"),
    )
    monkeypatch.setattr(sidecar_launch, "find_sidecar_runtime", lambda: None)
    spawned: list[object] = []
    monkeypatch.setattr(
        sidecar_launch, "_spawn", lambda service: spawned.append(service) or ([], "")
    )
    result = ensure_sidecar(service, wait=0.1)
    assert result.started is False
    assert result.detail == "no bundled sidecar runtime"
    assert spawned == []


def test_sidecar_install_ready_reads_marker(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from octop.modules.org_os.sidecar_launch import sidecar_install_ready

    live = tmp_path / "local" / "FreeOS" / "openxyos"
    live.mkdir(parents=True)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "local"))
    monkeypatch.delenv("FREEOS_OPENXYOS_HOME", raising=False)
    monkeypatch.delenv("OCTOP_GREEN_PACKAGES", raising=False)
    monkeypatch.setenv("FREEOS_HOME", str(tmp_path / "unused-home"))
    assert sidecar_install_ready() is False
    (live / ".install-ready").write_text("live=1\n", encoding="utf-8")
    assert sidecar_install_ready() is True


def test_bundle_rejects_readme_only_workdir(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    work = tmp_path / "openxyos-home"
    work.mkdir()
    (work / "README.txt").write_text("stub", encoding="utf-8")
    monkeypatch.setenv("FREEOS_OPENXYOS_HOME", str(work))
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "local"))
    monkeypatch.delenv("OCTOP_GREEN_PACKAGES", raising=False)
    monkeypatch.setenv("FREEOS_HOME", str(tmp_path / "unused-home"))
    assert find_sidecar_runtime() is None


def test_sidecar_bundle_dir_prefers_openxyos_home(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    work = tmp_path / "openxyos-home"
    _write_runtime(work)
    bundle = work / "org-sidecar"
    monkeypatch.setenv("FREEOS_OPENXYOS_HOME", str(bundle))
    monkeypatch.delenv("OCTOP_GREEN_PACKAGES", raising=False)
    monkeypatch.setenv("FREEOS_HOME", str(tmp_path / "unused-home"))
    found = find_sidecar_runtime()
    assert found is not None
    assert found.root == bundle


def test_sidecar_bundle_dir_finds_install_tree(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    install = tmp_path / "INSTDIR" / "openxyos"
    _write_runtime(install)
    bundle = install / "org-sidecar"
    monkeypatch.delenv("FREEOS_OPENXYOS_HOME", raising=False)
    monkeypatch.delenv("OCTOP_GREEN_PACKAGES", raising=False)
    monkeypatch.setenv("FREEOS_OPENXYOS_INSTALL", str(bundle))
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "local"))
    monkeypatch.setenv("FREEOS_HOME", str(tmp_path / "unused-home"))
    assert sidecar_bundle_dir() == bundle


def test_sidecar_launch_env_writes_secrets(tmp_path: Path) -> None:
    env = sidecar_launch_env(tmp_path, dashboard_port=8099)
    assert env["DATABASE_PATH"] == str(tmp_path / "org-os" / "xiongyuan.db")
    assert "http://127.0.0.1:8099" in env["CORS_ORIGIN"]
    assert "http://127.0.0.1:3780" in env["CORS_ORIGIN"]
    assert "http://localhost:3780" in env["CORS_ORIGIN"]
    secrets = (tmp_path / "org-os" / "sidecar.env").read_text(encoding="utf-8")
    assert "JWT_SECRET=" in secrets
    assert "COOKIE_SECRET=" in secrets
    assert "FREEOS_INGEST_TOKEN=" in secrets
    assert env["FREEOS_INGEST_TOKEN"]


def test_sidecar_launch_env_merges_existing_cors(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("CORS_ORIGIN", "http://127.0.0.1:9000")
    env = sidecar_launch_env(tmp_path, dashboard_port=8099)
    assert "http://127.0.0.1:9000" in env["CORS_ORIGIN"]
    assert "http://127.0.0.1:3780" in env["CORS_ORIGIN"]


def test_launch_argv_windows_prefers_ps1(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr("octop.modules.org_os.sidecar_launch.sys.platform", "win32")
    runtime = _write_runtime(tmp_path)
    launcher = tmp_path / "org-sidecar" / "start-sidecar.ps1"
    launcher.write_text("# start", encoding="utf-8")
    argv = launch_sidecar_argv(runtime, launcher)
    assert argv[0] == "powershell"
    assert str(launcher) in argv


def test_sidecar_app_dir_prefers_top_level_when_both_exist(tmp_path: Path) -> None:
    live = tmp_path / "openxyos"
    nested = live / "openxyos"
    for folder in (live, nested):
        (folder / "dist").mkdir(parents=True)
        (folder / "backend-dist").mkdir(parents=True)
        (folder / "dist" / "index.html").write_text("<html></html>", encoding="utf-8")
        (folder / "backend-dist" / "server.js").write_text("/* compiled */", encoding="utf-8")
    assert _sidecar_app_dir(live) == live
    (live / "backend-dist" / "server.js").unlink()
    (live / "backend" / "server.ts").unlink(missing_ok=True)
    assert _sidecar_app_dir(live) == nested


def test_heal_openxyos_layout_promotes_nested(tmp_path: Path) -> None:
    from octop.modules.org_os.sidecar_launch import heal_openxyos_layout

    inner = tmp_path / "openxyos"
    _write_runtime(inner)
    assert heal_openxyos_layout(tmp_path) is True
    assert (tmp_path / "node" / "node.exe").is_file() or (
        tmp_path / "node" / "bin" / "node"
    ).is_file()
    assert (tmp_path / "openxyos" / "dist" / "index.html").is_file() or (
        tmp_path / "dist" / "index.html"
    ).is_file()


def test_heal_openxyos_layout_copies_nested_frontend(tmp_path: Path) -> None:
    from octop.modules.org_os.sidecar_launch import heal_openxyos_layout

    bundled = tmp_path / "live"
    _write_runtime(bundled)
    live = bundled / "org-sidecar"
    assert (live / "openxyos" / "dist" / "index.html").is_file()
    assert not (live / "dist" / "index.html").is_file()
    assert heal_openxyos_layout(live) is True
    assert (live / "dist" / "index.html").is_file()
