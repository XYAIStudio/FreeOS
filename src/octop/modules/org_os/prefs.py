"""Persist org-local preferences (not FreeOS system settings).

Lives next to catalog module toggles under ``{FREEOS_HOME}/org-os/``.
LLM keys, users, timezone, and models stay on FreeOS system settings.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_PREFS_NAME = "prefs.json"
_LIMITS = {"name": 120, "description": 500}


def _path(home: Path) -> Path:
    root = Path(home) / "org-os"
    root.mkdir(parents=True, exist_ok=True)
    return root / _PREFS_NAME


def default_org_prefs() -> dict[str, str]:
    return {"name": "", "description": ""}


def load_org_prefs(home: Path) -> dict[str, str]:
    prefs = default_org_prefs()
    path = _path(home)
    if not path.is_file():
        return prefs
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return prefs
    if not isinstance(raw, dict):
        return prefs
    for key, limit in _LIMITS.items():
        value = raw.get(key)
        if isinstance(value, str):
            prefs[key] = value.strip()[:limit]
    return prefs


def save_org_prefs(home: Path, updates: dict[str, Any]) -> dict[str, str]:
    current = load_org_prefs(home)
    for key, limit in _LIMITS.items():
        if key not in updates or updates[key] is None:
            continue
        if not isinstance(updates[key], str):
            raise ValueError(key)
        value = updates[key].strip()
        if len(value) > limit:
            raise ValueError(key)
        current[key] = value
    path = _path(home)
    path.write_text(json.dumps(current, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return current
