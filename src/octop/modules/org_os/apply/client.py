"""openXYOS control-plane HTTP client with a durable local mirror.

Live HTTP uses the FreeOS ingest token when present (``/api/freeos/ingest``).
A down sidecar never fails the loop open: every payload is written under
``{FREEOS_HOME}/openxyos-mirror/<tenant>/`` first.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from octop.modules.org_os.sidecar_secrets import INGEST_TOKEN_KEY, resolve_ingest_token

DEFAULT_CONTROL_URL = "http://127.0.0.1:3780"


def resolve_control_plane_url(*candidates: str, home: Path | None = None) -> str:
    """Prefer ``OPENXYOS_BASE_URL``, then explicit args, sidecar env, runtime.json."""
    ordered = [
        os.environ.get("OPENXYOS_BASE_URL", "").strip(),
        *candidates,
        os.environ.get("FREEOS_ORG_SIDECAR_URL", "").strip(),
    ]
    home_path = home
    if home_path is None:
        raw_home = (os.environ.get("FREEOS_HOME") or os.environ.get("OCTOP_HOME") or "").strip()
        if raw_home:
            home_path = Path(raw_home)
    if home_path is not None:
        from octop.modules.org_os.managed_runtime import read_runtime_base_url  # noqa: PLC0415

        ordered.append(read_runtime_base_url(home_path))
    for raw in ordered:
        cleaned = (raw or "").strip().rstrip("/")
        parsed = urlparse(cleaned)
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            return cleaned
    return ""


def mirror_root(home: Path, tenant_id: str) -> Path:
    tid = tenant_id or "default"
    return home / "openxyos-mirror" / tid


@dataclass
class HttpResult:
    ok: bool
    reached: bool
    method: str
    path: str
    status_code: int = 0
    reason: str = ""
    body: Any = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "reached": self.reached,
            "method": self.method,
            "path": self.path,
            "status_code": self.status_code,
            "reason": self.reason,
        }


class OpenXyosControlClient:
    """POST/PUT/GET openXYOS-shaped surfaces. Always persist a local mirror."""

    def __init__(
        self,
        base_url: str = "",
        *,
        timeout: float = 8.0,
        headers: dict[str, str] | None = None,
        home: Path | None = None,
        retries: int = 4,
    ) -> None:
        self.timeout = timeout
        self.retries = max(retries, 1)
        self.home = Path(home) if home is not None else None
        self.base_url = resolve_control_plane_url(base_url, home=self.home)
        self.headers = dict(headers or {})
        token = self.headers.get("X-FreeOS-Ingest-Token") or resolve_ingest_token(self.home)
        env_token = (os.environ.get(INGEST_TOKEN_KEY) or "").strip()
        token = str(token or env_token).strip()
        if token:
            self.headers["X-FreeOS-Ingest-Token"] = token

    @property
    def ingest_token(self) -> str:
        return str(self.headers.get("X-FreeOS-Ingest-Token") or "")

    def write_mirror(self, dest: Path, payload: Any) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        return dest

    def request(
        self,
        method: str,
        path: str,
        *,
        payload: Any | None = None,
        mirror_path: Path | None = None,
    ) -> HttpResult:
        if mirror_path is not None and payload is not None:
            self.write_mirror(mirror_path, payload)
        if not self.base_url:
            return HttpResult(
                ok=False,
                reached=False,
                method=method,
                path=path,
                reason="control-plane URL unset; local mirror only",
            )
        url = f"{self.base_url}{path if path.startswith('/') else '/' + path}"
        last = HttpResult(
            ok=False,
            reached=False,
            method=method,
            path=path,
            reason="control plane unreachable",
        )
        for attempt in range(self.retries):
            try:
                with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                    response = client.request(
                        method.upper(),
                        url,
                        json=payload,
                        headers=self.headers or None,
                    )
            except httpx.HTTPError as exc:
                last = HttpResult(
                    ok=False,
                    reached=False,
                    method=method,
                    path=path,
                    reason=f"control plane unreachable: {exc}",
                )
                time.sleep(0.4 * (attempt + 1))
                continue
            body: Any
            try:
                body = response.json()
            except ValueError:
                body = response.text
            last = HttpResult(
                ok=response.status_code < 400,
                reached=True,
                method=method,
                path=path,
                status_code=response.status_code,
                reason="" if response.status_code < 400 else f"HTTP {response.status_code}",
                body=body,
            )
            if last.ok or last.status_code in {400, 401, 403, 404}:
                return last
            time.sleep(0.4 * (attempt + 1))
        return last

    def get_json(self, path: str) -> Any | None:
        result = self.request("GET", path)
        if not result.ok:
            return None
        body = result.body
        if isinstance(body, dict) and "data" in body:
            return body["data"]
        return body

    def ingest(self, payload: dict[str, Any]) -> HttpResult:
        return self.request("POST", "/api/freeos/ingest", payload=payload)

    def export(self) -> Any | None:
        return self.get_json("/api/freeos/export")

    def ui_tenant_id(self) -> int | None:
        """Tenant the embedded openXYOS login is using, when the sidecar reports it."""
        for path in ("/api/freeos/session", "/api/freeos/health"):
            body = self.get_json(path)
            if not isinstance(body, dict):
                continue
            raw = body.get("ui_tenant_id")
            if isinstance(raw, int) and raw > 0:
                return raw
            if isinstance(raw, str) and raw.isdigit() and int(raw) > 0:
                return int(raw)
        return None

    def bridge_ready(self) -> bool:
        body = self.get_json("/api/freeos/health")
        return isinstance(body, dict) and bool(body.get("ok"))


@dataclass
class ApplyReceipt:
    surface: str
    endpoint: str
    mirrored: str
    http: HttpResult
    item_count: int = 0
    landed: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "surface": self.surface,
            "endpoint": self.endpoint,
            "mirrored": self.mirrored,
            "item_count": self.item_count,
            "landed": dict(self.landed),
            "http": self.http.to_dict(),
        }


@dataclass
class ApplyResult:
    pack_dir: Path
    mirror_dir: Path
    receipts: list[ApplyReceipt] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    control_plane_url: str = ""
    landed: dict[str, Any] = field(default_factory=dict)
    tenant_id: int | None = None
    preview_path: str = "/employees"
    host_landed: dict[str, Any] = field(default_factory=dict)

    @property
    def remote_applied(self) -> bool:
        return any(item.http.ok for item in self.receipts)

    @property
    def mirrored(self) -> bool:
        return self.mirror_dir.is_dir() and any(self.mirror_dir.rglob("*.json"))

    def to_dict(self) -> dict[str, Any]:
        return {
            "pack_dir": str(self.pack_dir),
            "mirror_dir": str(self.mirror_dir),
            "control_plane_url": self.control_plane_url,
            "remote_applied": self.remote_applied,
            "mirrored": self.mirrored,
            "tenant_id": self.tenant_id,
            "preview_path": self.preview_path,
            "landed": dict(self.landed),
            "host_landed": dict(self.host_landed),
            "receipts": [item.to_dict() for item in self.receipts],
            "notes": list(self.notes),
        }
