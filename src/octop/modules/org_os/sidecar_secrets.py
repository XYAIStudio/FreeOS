"""Shared sidecar secrets (JWT / cookie / FreeOS ingest token)."""

from __future__ import annotations

import os
from contextlib import suppress
from pathlib import Path

INGEST_TOKEN_KEY = "FREEOS_INGEST_TOKEN"


def sidecar_data_dir(home: Path) -> Path:
    return Path(os.environ.get("FREEOS_ORG_DATA") or (home / "org-os"))


def sidecar_env_path(home: Path) -> Path:
    return sidecar_data_dir(home) / "sidecar.env"


def _parse_env_file(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        out[key.strip()] = value.strip()
    return out


def _write_env_file(path: Path, values: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"{key}={values[key]}"
        for key in ("JWT_SECRET", "COOKIE_SECRET", INGEST_TOKEN_KEY)
        if values.get(key)
    ]
    extra = [
        f"{key}={value}"
        for key, value in values.items()
        if key not in {"JWT_SECRET", "COOKIE_SECRET", INGEST_TOKEN_KEY}
    ]
    path.write_text("\n".join([*lines, *extra]) + "\n", encoding="utf-8")
    with suppress(OSError):
        path.chmod(0o600)


def load_or_create_sidecar_secrets(home: Path) -> dict[str, str]:
    """Read `{home}/org-os/sidecar.env`, generating missing secrets."""
    path = sidecar_env_path(home)
    values = _parse_env_file(path)
    if not values.get("JWT_SECRET"):
        values["JWT_SECRET"] = os.urandom(32).hex()
    if not values.get("COOKIE_SECRET"):
        values["COOKIE_SECRET"] = os.urandom(32).hex()
    if not values.get(INGEST_TOKEN_KEY):
        values[INGEST_TOKEN_KEY] = os.urandom(32).hex()
    _write_env_file(path, values)
    return values


def resolve_ingest_token(home: Path | None = None) -> str:
    """Prefer the process env, then the durable sidecar.env file."""
    env = (os.environ.get(INGEST_TOKEN_KEY) or "").strip()
    if env:
        return env
    if home is None:
        return ""
    return load_or_create_sidecar_secrets(home).get(INGEST_TOKEN_KEY, "")
