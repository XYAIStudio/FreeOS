"""In-process openXYOS-shaped HTTP harness for apply+import roundtrip tests."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from typing import Any
from urllib.parse import urlparse


class ControlPlaneState:
    def __init__(self) -> None:
        self.employees: list[dict[str, Any]] = []
        self.talent: list[dict[str, Any]] = []
        self.plugins: list[dict[str, Any]] = []
        self.skills: list[dict[str, Any]] = []
        self.module_settings: dict[str, Any] = {}
        self.ingest_token: str = ""
        self.ingested: dict[str, Any] = {}
        self.permissions: list[dict[str, Any]] = [
            {"category": "delete", "allow": False, "reason": "harness deny"}
        ]
        self.posts: list[str] = []


def start_control_plane(state: ControlPlaneState | None = None) -> tuple[str, ThreadingHTTPServer]:
    store = state or ControlPlaneState()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: object) -> None:  # noqa: A003
            return

        def _json(self, status: int, payload: Any) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _read_json(self) -> Any:
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0:
                return {}
            raw = self.rfile.read(length)
            try:
                return json.loads(raw.decode("utf-8"))
            except json.JSONDecodeError:
                return {}

        def _ingest_ok(self) -> bool:
            if not store.ingest_token:
                return True
            return self.headers.get("X-FreeOS-Ingest-Token") == store.ingest_token

        def do_GET(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            if path == "/api/health/livez":
                self._json(200, {"ok": True})
                return
            if path == "/api/freeos/health":
                self._json(200, {"success": True, "data": {"ok": True, "ingest": True}})
                return
            if path == "/api/freeos/export":
                if not self._ingest_ok():
                    self._json(401, {"success": False, "error": "invalid ingest token"})
                    return
                self._json(
                    200,
                    {
                        "success": True,
                        "data": {
                            "employees": store.employees,
                            "talent": store.talent,
                            "plugins": store.plugins,
                            "skills": store.skills,
                            "counts": {
                                "employees": len(store.employees),
                                "talent": len(store.talent),
                                "plugins": len(store.plugins),
                                "skills": len(store.skills),
                            },
                        },
                    },
                )
                return
            if path == "/api/employees":
                self._json(200, {"success": True, "data": store.employees})
                return
            if path == "/api/talent":
                self._json(200, {"success": True, "data": store.talent})
                return
            if path == "/api/plugins":
                self._json(200, {"success": True, "data": store.plugins})
                return
            if path == "/api/module-settings":
                self._json(200, {"success": True, "data": store.module_settings})
                return
            if path == "/api/governance/permissions":
                self._json(200, {"success": True, "data": store.permissions})
                return
            self._json(404, {"success": False, "error": "not found"})

        def do_POST(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            payload = self._read_json()
            store.posts.append(path)
            if path == "/api/freeos/ingest":
                if not self._ingest_ok():
                    self._json(401, {"success": False, "error": "invalid ingest token"})
                    return
                if isinstance(payload, dict):
                    store.ingested = payload
                    if isinstance(payload.get("employees"), list):
                        store.employees.extend(
                            item for item in payload["employees"] if isinstance(item, dict)
                        )
                    if isinstance(payload.get("talent"), list):
                        store.talent.extend(
                            item for item in payload["talent"] if isinstance(item, dict)
                        )
                    if isinstance(payload.get("plugins"), list):
                        store.plugins.extend(
                            item for item in payload["plugins"] if isinstance(item, dict)
                        )
                    if isinstance(payload.get("skills"), list):
                        store.skills.extend(
                            item for item in payload["skills"] if isinstance(item, dict)
                        )
                self._json(
                    200,
                    {
                        "success": True,
                        "data": {
                            "landed": {
                                "employees": {"created": len(store.employees)},
                                "talent": {"created": len(store.talent)},
                                "plugins": {"created": len(store.plugins)},
                                "skills": {"created": len(store.skills)},
                            },
                            "counts": {
                                "employees": len(store.employees),
                                "talent": len(store.talent),
                                "plugins": len(store.plugins),
                                "skills": len(store.skills),
                            },
                        },
                    },
                )
                return
            if path == "/api/employees":
                if isinstance(payload, dict) and isinstance(payload.get("employees"), list):
                    store.employees.extend(
                        item for item in payload["employees"] if isinstance(item, dict)
                    )
                elif isinstance(payload, dict) and payload.get("name"):
                    store.employees.append(payload)
                self._json(200, {"success": True, "data": {"id": len(store.employees)}})
                return
            if path == "/api/talent":
                if isinstance(payload, dict) and isinstance(payload.get("talent"), list):
                    store.talent.extend(
                        item for item in payload["talent"] if isinstance(item, dict)
                    )
                self._json(200, {"success": True, "data": {"ok": True}})
                return
            if path == "/api/plugins":
                if isinstance(payload, dict) and isinstance(payload.get("plugins"), list):
                    store.plugins.extend(
                        item for item in payload["plugins"] if isinstance(item, dict)
                    )
                self._json(200, {"success": True, "data": {"ok": True}})
                return
            if path == "/api/governance/validate":
                self._json(200, {"success": True, "data": {"allowed": False, "reason": "harness"}})
                return
            self._json(404, {"success": False, "error": "not found"})

        def do_PUT(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            payload = self._read_json()
            store.posts.append(path)
            if path == "/api/module-settings":
                if isinstance(payload, dict):
                    store.module_settings = payload
                self._json(200, {"success": True, "data": store.module_settings})
                return
            self._json(404, {"success": False, "error": "not found"})

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address[:2]
    return f"http://{host}:{port}", server
