"""First-start with --home must not touch a populated OS profile."""

from __future__ import annotations

import hashlib
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest

from octop.api.app import build_app
from octop.api.routers.chat.models import ChatTurnBody
from octop.api.routers.chat.turn import prepare_dashboard_turn
from octop.infra.agents.providers.llamacpp_runtime import _log_path
from octop.infra.server import OctopServer
from octop.infra.setup.password_file import WIZARD_FILE_NAME, read_password
from octop.infra.utils.paths import PathLayout
from octop.modules.org_os.service import org_module_from_paths
from octop.modules.org_os.sidecar_launch import restart_sidecar
from tests.support.app import ensure_control_plane_bound
from tests.support.auth import TEST_PASSWORD
from tests.support.harness import patch_harness


def _snapshot(root: Path) -> dict[str, tuple[str, int]]:
    found: dict[str, tuple[str, int]] = {}
    if not root.exists():
        return found
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        stat = path.stat()
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        found[path.relative_to(root).as_posix()] = (digest, stat.st_mtime_ns)
    return found


def _seed_profile(root: Path) -> None:
    workspace = root / ".octop" / "workspaces" / "main"
    workspace.mkdir(parents=True)
    (workspace / "SOUL.md").write_text("user soul\n", encoding="utf-8")
    (workspace / "manifest.json").write_text("{}\n", encoding="utf-8")
    (workspace / "memory.sqlite").write_bytes(b"sqlite")
    (workspace / "memory.sqlite-wal").write_bytes(b"wal")
    (workspace / "memory.sqlite-shm").write_bytes(b"shm")
    skill_a = workspace / "skills" / "one"
    skill_b = workspace / ".octop" / "skills" / "two"
    skill_a.mkdir(parents=True)
    skill_b.mkdir(parents=True)
    (skill_a / "SKILL.md").write_text("# one\n", encoding="utf-8")
    (skill_b / "SKILL.md").write_text("# two\n", encoding="utf-8")
    (skill_b / "manage_skills.py").write_text("print('keep')\n", encoding="utf-8")
    freeos = root / ".freeos"
    freeos.mkdir()
    (freeos / "config.json").write_text("{}\n", encoding="utf-8")
    (freeos / "octop.db").write_bytes(b"db")


class _QuietProc:
    pid = 0

    def poll(self) -> int:
        return 0

    def wait(self, timeout: float | None = None) -> int:
        return 0

    def __enter__(self) -> _QuietProc:
        return self

    def __exit__(self, *args: object) -> None:
        return None


async def test_first_start_with_home_does_not_touch_profile(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    sentinel = tmp_path / "sentinel-profile"
    isolated = tmp_path / "isolated-home"
    _seed_profile(sentinel)
    before = _snapshot(sentinel)

    monkeypatch.setenv("HOME", str(sentinel))
    monkeypatch.setenv("USERPROFILE", str(sentinel))
    monkeypatch.setenv("FREEOS_HOME", str(isolated))
    monkeypatch.delenv("OCTOP_HOME", raising=False)
    monkeypatch.delenv("OCTOP_DESKTOP", raising=False)
    monkeypatch.delenv("FREEOS_DESKTOP", raising=False)
    monkeypatch.setattr(
        "octop.infra.agents.providers.llamacpp_runtime.find_llama_server",
        lambda: None,
    )

    assert PathLayout.from_env().root.resolve() == isolated.resolve()
    log_path = _log_path()
    assert log_path.is_relative_to(isolated.resolve())

    with patch_harness(None):
        server = OctopServer()
        await server.start()
        await ensure_control_plane_bound(server)
        if server.app_runtime is not None:
            await server.app_runtime.proactive_scheduler.shutdown()
            server.app_runtime.proactive_scheduler.suspend()
        app = build_app(server)
        try:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://testserver",
            ) as client:
                assert (isolated / WIZARD_FILE_NAME).is_file()
                assert not (sentinel / WIZARD_FILE_NAME).exists()
                password = read_password(isolated)
                assert password
                token = (
                    await client.post("/api/setup/verify-password", json={"password": password})
                ).json()["wizard_token"]
                admin = await client.post(
                    "/api/setup/initial-admin",
                    json={"username": "admin", "password": TEST_PASSWORD},
                    headers={"Authorization": f"Bearer {token}"},
                )
                assert admin.status_code == 201, admin.text
                finished = await client.post(
                    "/api/setup/finish",
                    json={"provider_draft": None},
                    headers={"Authorization": f"Bearer {token}"},
                )
                assert finished.status_code == 200, finished.text
                auth = {
                    "Authorization": f"Bearer {admin.json()['access_token']}",
                }
                created = await client.post(
                    "/api/admin/providers",
                    headers=auth,
                    json={
                        "name": "Ollama",
                        "kind": "openai",
                        "base_url": "http://127.0.0.1:11434/v1",
                        "api_key": "ollama",
                        "models": [
                            {
                                "id": "llama3.2",
                                "name": "llama3.2",
                                "enabled": True,
                                "input": ["text"],
                            }
                        ],
                    },
                )
                assert created.status_code in {200, 201}, created.text
                user = server.user_manager.get("admin")
                assert user is not None
                prepared = await prepare_dashboard_turn(
                    server,
                    agent_id="main",
                    user=user,
                    turn=ChatTurnBody(
                        messages=[{"role": "user", "content": "hello"}],
                        default_model="Ollama/llama3.2",
                    ),
                )
                assert prepared.model_ref == "Ollama/llama3.2"

            service = org_module_from_paths(server.paths)
            service.set_enabled(True)
            with patch(
                "octop.modules.org_os.sidecar_launch.subprocess.Popen",
                return_value=_QuietProc(),
            ):
                restart_sidecar(service, wait=0.4)
        finally:
            await server.stop()

    workspace = isolated / ".octop" / "workspaces" / "main"
    assert (workspace / "SOUL.md").is_file()
    assert _snapshot(sentinel) == before
    assert not any(sentinel.rglob("*.tmp"))
