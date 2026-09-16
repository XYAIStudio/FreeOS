from __future__ import annotations

import contextlib
import logging
import os
import platform
import subprocess
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, field_validator

from octop.infra.utils.ollama_paths import (
    find_ollama_app,
    find_ollama_binary,
    ollama_is_installed,
)

logger = logging.getLogger(__name__)

_OLLAMA_SERVER_STARTED = False
_OLLAMA_DOCS_URL = "https://ollama.com/download"
_START_WAIT_SEC = 30 if os.name == "nt" else 15


def _popen_kwargs() -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
    }
    if os.name == "nt":
        flags = 0
        flags |= int(getattr(subprocess, "CREATE_NO_WINDOW", 0))
        flags |= int(getattr(subprocess, "DETACHED_PROCESS", 0))
        flags |= int(getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0))
        kwargs["creationflags"] = flags
        kwargs["close_fds"] = True
    else:
        kwargs["start_new_session"] = True
    return kwargs


def _launch_argv_candidates() -> list[list[str]]:
    """Vendor-supported ways to bring the local daemon up.

    Windows installs are typically started via the tray app (``Ollama.exe`` or
    ``ollama app``). ``ollama serve`` remains the fallback on every OS.
    """
    argv: list[list[str]] = []
    app = find_ollama_app()
    binary = find_ollama_binary()
    if platform.system() == "Windows":
        if app:
            argv.append([app])
        if binary:
            argv.append([binary, "app"])
            argv.append([binary, "serve"])
        return argv
    if app and os.path.isdir(app):
        opener = "open"
        argv.append([opener, "-a", app])
    if binary:
        argv.append([binary, "serve"])
    return argv


class OllamaModelInfo(BaseModel):
    """Metadata for a single Ollama model returned by ``ollama.list()``."""

    name: str = Field(..., description="Model name, e.g. 'llama3:8b'")
    size: int = Field(0, description="Approximate size in bytes (if provided)")
    digest: str | None = Field(default=None, description="Model digest/id")
    modified_at: str | None = Field(
        default=None,
        description="Last modified time string (from Ollama, if present)",
    )

    @field_validator("modified_at", mode="before")
    @classmethod
    def convert_datetime_to_str(
        cls,
        v: str | datetime | None,
    ) -> str | None:
        """Convert datetime objects to ISO format strings."""
        if v is None:
            return None
        if isinstance(v, datetime):
            return v.isoformat()
        return str(v)


# ── SDK bootstrap ────────────────────────────────────────────────


def _ensure_ollama_sdk() -> Any:
    """Import the ollama Python SDK, raising ``ImportError`` if missing."""
    try:
        import ollama
    except ImportError:
        raise ImportError(
            "The 'ollama' Python package is not installed. Please install it manually: pip install ollama"
        ) from None
    return ollama


def is_ollama_sdk_available() -> bool:
    """Return ``True`` if the ollama SDK can be imported, without side-effects."""
    try:
        import ollama  # noqa: F401

        return True
    except ImportError:
        return False


# ── Server bootstrap ────────────────────────────────────────────


def _is_ollama_reachable() -> bool:
    """Quick connectivity check to the Ollama HTTP endpoint."""
    import urllib.error
    import urllib.request

    try:
        req = urllib.request.Request(
            "http://127.0.0.1:11434",
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=3):
            return True
    except Exception:
        return False


def _start_ollama_server() -> None:
    """Try to start the vendor Ollama daemon in the background."""
    result = start_ollama_service_result()
    if not result.get("running"):
        raise OSError(str(result.get("next_step") or result.get("error") or "Ollama did not start"))


def start_ollama_service_result() -> dict[str, Any]:
    """Start Ollama when it is already installed. Never invents an install.

    Returns a structured payload the dashboard can render without guessing.
    """
    global _OLLAMA_SERVER_STARTED
    if _is_ollama_reachable():
        _OLLAMA_SERVER_STARTED = True
        return {
            "ok": True,
            "installed": True,
            "running": True,
            "action": "already_running",
            "binary": find_ollama_binary(),
        }
    if not ollama_is_installed():
        return {
            "ok": False,
            "installed": False,
            "running": False,
            "action": "not_installed",
            "docs_url": _OLLAMA_DOCS_URL,
            "next_step": (
                "Ollama is not installed. Install it from https://ollama.com/download "
                "then click Start Ollama."
            ),
        }

    launched = False
    last_error = ""
    for argv in _launch_argv_candidates():
        logger.info("Starting Ollama via %s", argv)
        try:
            subprocess.Popen(argv, **_popen_kwargs())
            launched = True
        except OSError as exc:
            last_error = str(exc)
            logger.warning("Ollama launch failed (%s): %s", argv, exc)
            continue
        for _ in range(_START_WAIT_SEC):
            time.sleep(1)
            if _is_ollama_reachable():
                logger.info("Ollama daemon is now running.")
                _OLLAMA_SERVER_STARTED = True
                return {
                    "ok": True,
                    "installed": True,
                    "running": True,
                    "action": "started",
                    "binary": find_ollama_binary(),
                }

    next_step = (
        "Ollama is installed but the API at http://127.0.0.1:11434 did not come up. "
        "Open the Ollama app from the Start menu, wait until the tray icon appears, "
        "then click Start Ollama again."
    )
    if last_error:
        next_step = f"{next_step} ({last_error})"
    return {
        "ok": False,
        "installed": True,
        "running": False,
        "action": "start_failed" if launched else "launch_failed",
        "docs_url": _OLLAMA_DOCS_URL,
        "error": last_error or None,
        "next_step": next_step,
        "binary": find_ollama_binary(),
    }


def _ensure_ollama_server() -> None:
    """Make sure the Ollama daemon is reachable, starting it if needed."""
    if _is_ollama_reachable():
        return
    _start_ollama_server()


def _ensure_ollama() -> Any:
    """Bootstrap both the SDK and the server, then return the module."""
    sdk = _ensure_ollama_sdk()
    _ensure_ollama_server()
    return sdk


def is_ollama_reachable() -> bool:
    """Public wrapper: True when the Ollama HTTP endpoint responds."""
    return _is_ollama_reachable()


def start_ollama_service() -> None:
    """Ensure the Ollama daemon is running (start if needed)."""
    _ensure_ollama_server()


def resolve_weight_file(weight_path: str) -> Path:
    """Return an existing weight file path, or raise ``OSError``."""
    raw = (weight_path or "").strip()
    if not raw:
        raise OSError("Weight file path is required.")
    source = Path(raw).expanduser()
    try:
        source = source.resolve()
    except OSError as exc:
        raise OSError(f"Weight file not found: {weight_path}") from exc
    try:
        if not source.is_file():
            raise OSError(f"Weight file not found: {weight_path}")
    except OSError as exc:
        if "not found" in str(exc).lower():
            raise
        raise OSError(f"Cannot read weight file {weight_path}: {exc}") from exc
    return source


def modelfile_from_instruction(weight: Path) -> str:
    """Build a Modelfile ``FROM`` line that works on Windows absolute paths.

    Unquoted ``FROM C:\\Users\\...\\file.gguf`` breaks Ollama's parser (backslashes
    and spaces). Use a quoted POSIX path, or a same-directory relative name.
    """
    posix = weight.as_posix()
    return f'FROM "{posix}"\n'


def _iter_ollama_list_models(raw: Any) -> list[dict[str, Any]]:
    """Normalize ``ollama.list()`` payloads (dict or pydantic ``ListResponse``)."""
    if raw is None:
        return []
    models = getattr(raw, "models", None)
    if models is None and isinstance(raw, dict):
        models = raw.get("models")
    if not models:
        return []
    out: list[dict[str, Any]] = []
    for item in models:
        if isinstance(item, dict):
            out.append(item)
            continue
        dumped: dict[str, Any] = {}
        dump = getattr(item, "model_dump", None)
        if callable(dump):
            try:
                maybe = dump()
            except Exception:
                maybe = None
            if isinstance(maybe, dict):
                dumped = maybe
        name = dumped.get("model") or dumped.get("name") or getattr(item, "model", None)
        if name is None:
            name = getattr(item, "name", "")
        out.append(
            {
                "model": name or "",
                "size": dumped.get("size", getattr(item, "size", 0)) or 0,
                "digest": dumped.get("digest", getattr(item, "digest", None)),
                "modified_at": dumped.get("modified_at", getattr(item, "modified_at", None)),
            }
        )
    return out


def create_from_weight(name: str, weight_path: str) -> None:
    """Import a local GGUF/GGML file into Ollama via ``ollama create``."""
    binary = find_ollama_binary()
    if binary is None:
        raise OSError(
            "Ollama is not installed. Install it from https://ollama.com/download "
            "before registering a local weight file."
        )
    _ensure_ollama_server()
    source = resolve_weight_file(weight_path)

    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        suffix=".Modelfile",
        delete=False,
    ) as handle:
        handle.write(modelfile_from_instruction(source))
        modelfile = handle.name
    run_kwargs: dict[str, Any] = {
        "check": False,
        "capture_output": True,
        "text": True,
        "encoding": "utf-8",
        "errors": "replace",
        "timeout": 600,
        "cwd": str(source.parent),
    }
    if os.name == "nt":
        run_kwargs["creationflags"] = int(getattr(subprocess, "CREATE_NO_WINDOW", 0))
    try:
        try:
            completed = subprocess.run(
                [binary, "create", name, "-f", modelfile],
                **run_kwargs,
            )
        except (OSError, subprocess.SubprocessError, UnicodeError, TimeoutError) as exc:
            raise OSError(str(exc).strip() or "ollama create failed") from exc
    finally:
        with contextlib.suppress(OSError):
            os.unlink(modelfile)
    if completed.returncode != 0:
        err = (completed.stderr or completed.stdout or "").strip() or "ollama create failed"
        raise OSError(err)


def stop_ollama_service() -> bool:
    """Best-effort stop of an Ollama daemon we started; returns True if stopped."""
    global _OLLAMA_SERVER_STARTED
    if not _OLLAMA_SERVER_STARTED and not _is_ollama_reachable():
        return True
    import os

    stopped = False
    try:
        # Prefer polite terminate of `ollama serve` we may have spawned.
        # Cross-platform: try pkill on POSIX; on Windows skip process kill.
        if os.name == "posix":
            subprocess.run(
                ["pkill", "-f", "ollama serve"],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            # wait briefly
            for _ in range(20):
                if not _is_ollama_reachable():
                    stopped = True
                    break
                time.sleep(0.25)
        else:
            # Windows: leave daemon running; preference flag still gates auto-start.
            stopped = not _is_ollama_reachable()
    except Exception as exc:
        logger.warning("Failed to stop ollama serve: %s", exc)
    _OLLAMA_SERVER_STARTED = False
    return stopped or not _is_ollama_reachable()


class OllamaModelManager:
    """High-level wrapper around the Ollama SDK for model lifecycle."""

    @staticmethod
    def list_models() -> list[OllamaModelInfo]:
        """Return the current model list from ``ollama.list()``."""
        ollama = _ensure_ollama()
        models: list[OllamaModelInfo] = []
        for m in _iter_ollama_list_models(ollama.list()):
            name = str(m.get("model") or m.get("name") or "")
            if not name:
                continue
            models.append(
                OllamaModelInfo(
                    name=name,
                    size=m.get("size", 0) or 0,
                    digest=m.get("digest"),
                    modified_at=m.get("modified_at"),
                ),
            )
        return models

    @staticmethod
    def pull_model(name: str) -> OllamaModelInfo:
        """Pull/download a model via ``ollama.pull``."""
        ollama = _ensure_ollama()
        logger.info("Pulling Ollama model: %s", name)
        ollama.pull(name)
        logger.info("Pull completed: %s", name)

        for model in OllamaModelManager.list_models():
            if model.name == name:
                return model

        raise ValueError(f"Ollama model '{name}' not found after pull.")

    @staticmethod
    def delete_model(name: str) -> None:
        """Delete a model from the local Ollama instance."""
        ollama = _ensure_ollama()
        logger.info("Deleting Ollama model: %s", name)
        ollama.delete(name)
        logger.info("Ollama model deleted: %s", name)
