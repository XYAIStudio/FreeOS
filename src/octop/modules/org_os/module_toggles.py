"""Persist openXYOS catalog module on/off flags for the embedded preview."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from octop.modules.org_os.catalog import catalog_keys, is_locked

_TOGGLE_NAME = "module-toggles.json"


def _path(home: Path) -> Path:
    root = Path(home) / "org-os"
    root.mkdir(parents=True, exist_ok=True)
    return root / _TOGGLE_NAME


def load_module_toggles(home: Path) -> dict[str, bool]:
    known = set(catalog_keys())
    defaults = dict.fromkeys(known, True)
    path = _path(home)
    if not path.is_file():
        return defaults
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return defaults
    if not isinstance(raw, dict):
        return defaults
    for key, value in raw.items():
        if key in known and isinstance(value, bool) and not is_locked(key):
            defaults[key] = value
    return defaults


def save_module_toggles(home: Path, updates: dict[str, Any]) -> dict[str, bool]:
    current = load_module_toggles(home)
    known = set(catalog_keys())
    for key, value in updates.items():
        if key not in known or is_locked(key) or not isinstance(value, bool):
            continue
        current[key] = value
    path = _path(home)
    path.write_text(json.dumps(current, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return current


def disabled_module_keys(home: Path) -> list[str]:
    return [key for key, enabled in load_module_toggles(home).items() if not enabled]
