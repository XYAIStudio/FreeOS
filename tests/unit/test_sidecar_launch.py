"""Sidecar launcher discovery and Windows spawn argv."""

from __future__ import annotations

from pathlib import Path

import pytest

from octop.modules.org_os.service import OrgModuleService
from octop.modules.org_os.sidecar_launch import (
    SidecarRuntime,
    ensure_sidecar,
    find_sidecar_runtime,
    launch_sidecar_argv,
    portable_root,
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
    monkeypatch.setattr(sidecar_launch, "find_sidecar_runtime", lambda: None)
    monkeypatch.setattr(sidecar_launch, "find_sidecar_launcher", lambda: None)
    result = sidecar_launch.start_sidecar(service, wait=0.1)
    assert result.already is True
    assert result.reachable is True
    assert result.started is False


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


def test_sidecar_launch_env_writes_secrets(tmp_path: Path) -> None:
    env = sidecar_launch_env(tmp_path, dashboard_port=8099)
    assert env["DATABASE_PATH"] == str(tmp_path / "org-os" / "xiongyuan.db")
    assert "http://127.0.0.1:8099" in env["CORS_ORIGIN"]
    secrets = (tmp_path / "org-os" / "sidecar.env").read_text(encoding="utf-8")
    assert "JWT_SECRET=" in secrets
    assert "COOKIE_SECRET=" in secrets
