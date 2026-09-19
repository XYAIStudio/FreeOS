"""Durable pause/resume + JSONL audit under the FreeOS home directory."""

from __future__ import annotations

import json
import secrets
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Literal

from octop.modules.org_os.governance.types import PauseStatus


def _pause_status(raw: Any) -> PauseStatus:
    mapping: dict[str, PauseStatus] = {
        "pending": "pending",
        "approved": "approved",
        "rejected": "rejected",
        "expired": "expired",
    }
    return mapping.get(str(raw or ""), "pending")


_DEFAULT_TTL_SECONDS = 30 * 60


@dataclass
class PauseRecord:
    pause_id: str
    tool_name: str
    category: str
    action: str
    actor_id: str
    tenant_id: str
    args_digest: str
    reason: str
    status: PauseStatus = "pending"
    created_at: float = field(default_factory=time.time)
    resolved_at: float | None = None
    ttl_seconds: float = _DEFAULT_TTL_SECONDS

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PauseRecord:
        return cls(
            pause_id=str(data.get("pause_id") or ""),
            tool_name=str(data.get("tool_name") or ""),
            category=str(data.get("category") or ""),
            action=str(data.get("action") or ""),
            actor_id=str(data.get("actor_id") or ""),
            tenant_id=str(data.get("tenant_id") or ""),
            args_digest=str(data.get("args_digest") or ""),
            reason=str(data.get("reason") or ""),
            status=_pause_status(data.get("status")),
            created_at=float(data.get("created_at") or time.time()),
            resolved_at=data.get("resolved_at"),
            ttl_seconds=float(data.get("ttl_seconds") or _DEFAULT_TTL_SECONDS),
        )


class DurableGovernanceStore:
    """Disk-backed pauses. A restart must not silently resume a high-risk call."""

    def __init__(self, root: Path, *, ttl_seconds: float = _DEFAULT_TTL_SECONDS) -> None:
        self.root = root
        self.pauses_dir = root / "pauses"
        self.audit_file = root / "audit.jsonl"
        self.ttl_seconds = ttl_seconds
        self.pauses_dir.mkdir(parents=True, exist_ok=True)
        self.root.mkdir(parents=True, exist_ok=True)

    def create_pause(
        self,
        *,
        tool_name: str,
        category: str,
        action: str,
        actor_id: str,
        tenant_id: str,
        args_digest: str,
        reason: str,
    ) -> PauseRecord:
        pause_id = secrets.token_hex(8)
        record = PauseRecord(
            pause_id=pause_id,
            tool_name=tool_name,
            category=category,
            action=action,
            actor_id=actor_id,
            tenant_id=tenant_id,
            args_digest=args_digest,
            reason=reason,
            ttl_seconds=self.ttl_seconds,
        )
        self._write_pause(record)
        return record

    def get(self, pause_id: str) -> PauseRecord | None:
        path = self._pause_path(pause_id)
        if not path.is_file():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        if not isinstance(data, dict):
            return None
        record = PauseRecord.from_dict(data)
        if record.status == "pending" and time.time() - record.created_at > record.ttl_seconds:
            record.status = "expired"
            record.resolved_at = time.time()
            self._write_pause(record)
        return record

    def resolve(self, pause_id: str, status: Literal["approved", "rejected"]) -> PauseRecord | None:
        record = self.get(pause_id)
        if record is None or record.status != "pending":
            return record
        record.status = status
        record.resolved_at = time.time()
        self._write_pause(record)
        return record

    def is_approved_for(self, pause_id: str, *, args_digest: str, tool_name: str) -> bool:
        record = self.get(pause_id)
        if record is None or record.status != "approved":
            return False
        return record.args_digest == args_digest and record.tool_name == tool_name

    def append_audit(self, event: dict[str, Any]) -> str:
        audit_id = str(event.get("audit_id") or secrets.token_hex(8))
        row = dict(event)
        row["audit_id"] = audit_id
        row.setdefault("ts", time.time())
        self.audit_file.parent.mkdir(parents=True, exist_ok=True)
        with self.audit_file.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
        return audit_id

    def list_pauses(self, status: str | None = None) -> list[PauseRecord]:
        """List durable pauses. ``get()`` applies TTL so expired rows surface."""
        if not self.pauses_dir.is_dir():
            return []
        rows: list[PauseRecord] = []
        for path in self.pauses_dir.glob("*.json"):
            record = self.get(path.stem)
            if record is None:
                continue
            if status and record.status != status:
                continue
            rows.append(record)
        rows.sort(key=lambda item: item.created_at, reverse=True)
        return rows

    def tail_audit(self, limit: int = 50) -> list[dict[str, Any]]:
        if not self.audit_file.is_file():
            return []
        lines = self.audit_file.read_text(encoding="utf-8").splitlines()
        rows: list[dict[str, Any]] = []
        for line in lines[-max(1, limit) :]:
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict):
                rows.append(data)
        return rows

    def _pause_path(self, pause_id: str) -> Path:
        safe = Path(pause_id).name
        return self.pauses_dir / f"{safe}.json"

    def _write_pause(self, record: PauseRecord) -> None:
        path = self._pause_path(record.pause_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(record.to_dict(), indent=2) + "\n", encoding="utf-8")
