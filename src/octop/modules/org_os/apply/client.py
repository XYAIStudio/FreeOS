"""openXYOS control-plane HTTP client with a durable local mirror.

Live HTTP is used when ``OPENXYOS_BASE_URL`` / ``FREEOS_ORG_SIDECAR_URL`` is a
real origin. A down sidecar never fails the loop open: every payload is written
under ``{FREEOS_HOME}/openxyos-mirror/<tenant>/`` first.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

DEFAULT_CONTROL_URL = "http://127.0.0.1:3780"


def resolve_control_plane_url(*candidates: str) -> str:
    """Prefer ``OPENXYOS_BASE_URL``, then explicit args, then sidecar env."""
    ordered = [
        os.environ.get("OPENXYOS_BASE_URL", "").strip(),
        *candidates,
        os.environ.get("FREEOS_ORG_SIDECAR_URL", "").strip(),
    ]
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
        timeout: float = 3.0,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.base_url = resolve_control_plane_url(base_url)
        self.timeout = timeout
        self.headers = dict(headers or {})

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
        try:
            with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                response = client.request(
                    method.upper(),
                    url,
                    json=payload,
                    headers=self.headers or None,
                )
        except httpx.HTTPError as exc:
            return HttpResult(
                ok=False,
                reached=False,
                method=method,
                path=path,
                reason=f"control plane unreachable: {exc}",
            )
        body: Any
        try:
            body = response.json()
        except ValueError:
            body = response.text
        return HttpResult(
            ok=response.status_code < 400,
            reached=True,
            method=method,
            path=path,
            status_code=response.status_code,
            reason="" if response.status_code < 400 else f"HTTP {response.status_code}",
            body=body,
        )

    def get_json(self, path: str) -> Any | None:
        result = self.request("GET", path)
        if not result.ok:
            return None
        body = result.body
        if isinstance(body, dict) and "data" in body:
            return body["data"]
        return body


@dataclass
class ApplyReceipt:
    surface: str
    endpoint: str
    mirrored: str
    http: HttpResult
    item_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "surface": self.surface,
            "endpoint": self.endpoint,
            "mirrored": self.mirrored,
            "item_count": self.item_count,
            "http": self.http.to_dict(),
        }


@dataclass
class ApplyResult:
    pack_dir: Path
    mirror_dir: Path
    receipts: list[ApplyReceipt] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    control_plane_url: str = ""

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
            "receipts": [item.to_dict() for item in self.receipts],
            "notes": list(self.notes),
        }
