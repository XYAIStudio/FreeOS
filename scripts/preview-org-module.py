#!/usr/bin/env python3
"""Standalone FreeOS branding + organization-module preview (no full host)."""

from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "dashboard" / "public"
sys.path.insert(0, str(ROOT / "src"))

from octop.modules.org_os.catalog import OPENXYOS_MODULES  # noqa: E402
from octop.modules.org_os.service import OrgModuleService  # noqa: E402

PREVIEW_HOME = Path.home() / ".freeos-preview"
PREVIEW_HOME.mkdir(parents=True, exist_ok=True)
SERVICE = OrgModuleService(config_path=PREVIEW_HOME / "config.json", home=PREVIEW_HOME)


def _status_payload() -> dict:
    data = SERVICE.status().to_dict()
    data["catalog"] = list(OPENXYOS_MODULES)
    return data


HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>FreeOS — Organization module</title>
  <link rel="icon" href="/logo.png"/>
  <style>
    :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; }
    body { margin: 0; background: #f7f8fa; }
    header { display: flex; align-items: center; gap: 16px; padding: 20px 28px; background: #fff; border-bottom: 1px solid #e5e7eb; }
    header img.word { height: 40px; }
    main { max-width: 960px; margin: 24px auto; padding: 0 20px 48px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #f3f4f6; }
    button { padding: 8px 14px; border-radius: 8px; border: 1px solid #d1d5db; background: #111827; color: #fff; cursor: pointer; }
    .muted { color: #6b7280; }
    code { background: #f3f4f6; padding: 1px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <header>
    <img class="word" src="/logo_name.png" alt="FreeOS"/>
  </header>
  <main>
    <div class="card">
      <h1>Organization OS</h1>
      <p class="muted">Enable the openXYOS organization module as a FreeOS sidecar.</p>
      <p>Status: <strong id="state">…</strong> · Sidecar: <span id="sidecar">…</span></p>
      <p>Home: <code id="home"></code></p>
      <button id="toggle" type="button">Toggle module</button>
    </div>
    <div class="card">
      <h2>Capability catalog</h2>
      <table>
        <thead><tr><th>Key</th><th>Module</th><th>Description</th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  </main>
  <script>
    async function load() {
      const s = await (await fetch("/api/org-module/status")).json();
      document.getElementById("state").textContent = s.enabled ? "enabled" : "disabled";
      document.getElementById("sidecar").textContent = s.sidecar.reachable ? "reachable" : s.sidecar.url + " offline";
      document.getElementById("home").textContent = s.home;
      const rows = document.getElementById("rows");
      rows.innerHTML = "";
      for (const item of (s.catalog || [])) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td><code>${item.key}</code></td><td>${item.label}</td><td class="muted">${item.description}</td>`;
        rows.appendChild(tr);
      }
      document.getElementById("toggle").dataset.enabled = s.enabled ? "1" : "0";
    }
    document.getElementById("toggle").onclick = async () => {
      const enabled = document.getElementById("toggle").dataset.enabled !== "1";
      await fetch("/api/org-module", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      await load();
    };
    load();
  </script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path in {"/", "/organization"}:
            self._send(200, HTML.encode("utf-8"), "text/html; charset=utf-8")
            return
        if path == "/api/org-module/status":
            self._send(
                200,
                json.dumps(_status_payload()).encode("utf-8"),
                "application/json",
            )
            return
        rel = path.lstrip("/")
        raw_path = Path(rel)
        if raw_path.is_absolute() or ".." in raw_path.parts:
            self._send(404, b"not found", "text/plain")
            return
        candidate = (PUBLIC / Path(*raw_path.parts)).resolve()
        try:
            candidate.relative_to(PUBLIC.resolve())
        except ValueError:
            self._send(404, b"not found", "text/plain")
            return
        if candidate.is_file():
            ctype = "application/octet-stream"
            if candidate.suffix == ".png":
                ctype = "image/png"
            elif candidate.suffix == ".svg":
                ctype = "image/svg+xml"
            self._send(200, candidate.read_bytes(), ctype)
            return
        self._send(404, b"not found", "text/plain")

    def do_PATCH(self) -> None:  # noqa: N802
        if urlparse(self.path).path != "/api/org-module":
            self._send(404, b"not found", "text/plain")
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        body = json.loads(raw.decode("utf-8") or "{}")
        SERVICE.set_enabled(bool(body.get("enabled")))
        self._send(200, json.dumps(_status_payload()).encode("utf-8"), "application/json")

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"FreeOS org-module preview → http://127.0.0.1:{port}/organization")
    server.serve_forever()


if __name__ == "__main__":
    main()
