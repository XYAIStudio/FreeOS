from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from octop.infra.host_apps.register import import_mcp


class _FakeConnectors:
    def __init__(self) -> None:
        self.servers: dict[str, Any] = {}

    def get_custom_servers(self, user_id: int) -> dict[str, Any]:
        del user_id
        return dict(self.servers)

    def put_custom_servers(self, user_id: int, servers: dict[str, Any]) -> dict[str, Any]:
        del user_id
        self.servers = dict(servers)
        return self.servers


def test_import_mcp_copies_into_freeos(tmp_path: Path) -> None:
    cursor = tmp_path / ".cursor"
    cursor.mkdir()
    (cursor / "mcp.json").write_text(
        json.dumps({"mcpServers": {"notes": {"command": "npx", "args": ["-y", "notes"]}}}),
        encoding="utf-8",
    )
    svc = _FakeConnectors()
    result = import_mcp(
        host_id="cursor",
        item_id="notes",
        connector_service=svc,
        user_id=1,
        home=tmp_path,
    )
    assert result["name"] == "cursor-notes"
    assert "cursor-notes" in svc.servers
    assert svc.servers["cursor-notes"]["command"] == "npx"
    assert (cursor / "mcp.json").read_text(encoding="utf-8").find("notes") > 0
