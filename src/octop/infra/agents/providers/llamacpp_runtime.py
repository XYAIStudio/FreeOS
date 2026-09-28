"""Lifecycle and provider registration for the bundled llama.cpp server."""

from __future__ import annotations

import atexit
import json
import os
import re
import subprocess
import sys
import threading
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

LLAMACPP_PROVIDER_NAME = "FreeOS Local (llama.cpp)"
LLAMACPP_HOST = "127.0.0.1"
LLAMACPP_PORT = 11435
LLAMACPP_BASE_URL = f"http://{LLAMACPP_HOST}:{LLAMACPP_PORT}/v1"
_ALIAS_SAFE = re.compile(r"[^A-Za-z0-9._:-]+")
_PROCESS: subprocess.Popen[bytes] | None = None
_PROCESS_MODEL: str | None = None
_LOCK = threading.RLock()


def _binary_name() -> str:
    return "llama-server.exe" if os.name == "nt" else "llama-server"


def binary_candidates() -> list[Path]:
    """Return ordered, explicit locations; never search writable model folders."""
    name = _binary_name()
    configured = os.environ.get("FREEOS_LLAMA_SERVER", "").strip()
    roots = [Path(sys.executable).resolve().parent, Path(__file__).resolve().parents[5]]
    candidates: list[Path] = []
    if configured:
        candidates.append(Path(configured).expanduser())
    for root in roots:
        candidates.extend(
            [
                root / "llama.cpp" / name,
                root / "runtime" / "llama.cpp" / name,
                root / "tools" / "llama.cpp" / name,
                root / name,
            ]
        )
    seen: set[str] = set()
    out: list[Path] = []
    for candidate in candidates:
        key = str(candidate)
        if key not in seen:
            seen.add(key)
            out.append(candidate)
    return out


def find_llama_server() -> Path | None:
    for candidate in binary_candidates():
        try:
            if candidate.is_file():
                return candidate.resolve()
        except OSError:
            continue
    return None


def _request_json(path: str, *, timeout: float = 1.0) -> dict[str, Any] | None:
    try:
        with urllib.request.urlopen(  # noqa: S310 - fixed loopback endpoint
            f"http://{LLAMACPP_HOST}:{LLAMACPP_PORT}{path}", timeout=timeout
        ) as response:
            if response.status >= 500:
                return None
            raw = response.read(1024 * 1024)
    except (OSError, TimeoutError, urllib.error.URLError):
        return None
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def is_llamacpp_reachable() -> bool:
    return _request_json("/health") is not None or _request_json("/v1/models") is not None


def _safe_alias(raw: str, model_path: Path) -> str:
    alias = _ALIAS_SAFE.sub("-", raw.strip()).strip("-._")
    if not alias:
        alias = _ALIAS_SAFE.sub("-", model_path.stem).strip("-._")
    if not alias:
        alias = "freeos-local"
    return alias[:80]


def _validated_model_path(raw: str) -> Path:
    model = Path(raw).expanduser()
    if not model.is_absolute():
        raise ValueError("GGUF model path must be absolute")
    resolved = model.resolve(strict=True)
    if not resolved.is_file() or resolved.suffix.lower() != ".gguf":
        raise ValueError("llama.cpp sidecar requires an existing .gguf file")
    return resolved


def _log_path() -> Path:
    configured = os.environ.get("OCTOP_HOME", "").strip()
    root = Path(configured).expanduser() if configured else Path.home() / ".octop"
    path = root / "logs" / "llama-sidecar.log"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def status() -> dict[str, Any]:
    binary = find_llama_server()
    with _LOCK:
        proc = _PROCESS
        model = _PROCESS_MODEL
        owned_running = proc is not None and proc.poll() is None
    reachable = is_llamacpp_reachable()
    return {
        "ok": bool(binary and reachable),
        "runtime": "llamacpp",
        "installed": binary is not None,
        "running": reachable,
        "managed_by_freeos": owned_running,
        "binary": str(binary) if binary else "",
        "base_url": LLAMACPP_BASE_URL,
        "model_path": model or "",
        "action": "ready" if reachable else "start" if binary else "install_runtime",
    }


def start(
    *,
    model_path: str,
    alias: str = "",
    context_size: int = 8192,
    gpu_layers: int = -1,
) -> dict[str, Any]:
    binary = find_llama_server()
    if binary is None:
        return {
            **status(),
            "error": "Bundled llama.cpp runtime is not installed.",
            "next_step": "Repair or update FreeOS to install the llama.cpp runtime.",
        }
    if not 512 <= context_size <= 262_144:
        raise ValueError("context_size must be between 512 and 262144")
    if not -1 <= gpu_layers <= 999:
        raise ValueError("gpu_layers must be between -1 and 999")
    model = _validated_model_path(model_path)
    model_alias = _safe_alias(alias, model)

    global _PROCESS, _PROCESS_MODEL
    with _LOCK:
        if _PROCESS is not None and _PROCESS.poll() is None:
            if str(model) == _PROCESS_MODEL and is_llamacpp_reachable():
                return {**status(), "alias": model_alias}
            stop()
        if is_llamacpp_reachable():
            return {
                **status(),
                "error": "Port 11435 is already served by another process.",
                "next_step": "Stop the other local runtime or configure a different port.",
            }
        args = [
            str(binary),
            "--model",
            str(model),
            "--alias",
            model_alias,
            "--host",
            LLAMACPP_HOST,
            "--port",
            str(LLAMACPP_PORT),
            "--ctx-size",
            str(context_size),
            "--n-gpu-layers",
            str(gpu_layers),
        ]
        flags = int(getattr(subprocess, "CREATE_NO_WINDOW", 0)) if os.name == "nt" else 0
        log_handle = _log_path().open("ab")
        try:
            _PROCESS = subprocess.Popen(  # noqa: S603 - fixed binary and argument vector
                args,
                stdin=subprocess.DEVNULL,
                stdout=log_handle,
                stderr=subprocess.STDOUT,
                creationflags=flags,
            )
        finally:
            log_handle.close()
        _PROCESS_MODEL = str(model)

    for _ in range(40):
        if is_llamacpp_reachable():
            return {**status(), "alias": model_alias}
        with _LOCK:
            if _PROCESS is None or _PROCESS.poll() is not None:
                break
        threading.Event().wait(0.25)
    failed = status()
    stop()
    return {
        **failed,
        "ok": False,
        "running": False,
        "error": "llama.cpp did not become ready within 10 seconds.",
        "next_step": f"Review {_log_path()} for the startup error.",
    }


def stop() -> dict[str, Any]:
    global _PROCESS, _PROCESS_MODEL
    with _LOCK:
        proc = _PROCESS
        _PROCESS = None
        _PROCESS_MODEL = None
    if proc is not None and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=3)
    return status()


def _shutdown() -> None:
    """Terminate only the process owned by this interpreter during shutdown."""
    global _PROCESS, _PROCESS_MODEL
    with _LOCK:
        proc = _PROCESS
        _PROCESS = None
        _PROCESS_MODEL = None
    if proc is not None and proc.poll() is None:
        proc.terminate()


def upsert_provider(provider_repo: Any, *, alias: str, model_path: str) -> str:
    """Expose the currently served GGUF through the existing provider abstraction."""
    model = _validated_model_path(model_path)
    model_id = _safe_alias(alias, model)
    row = provider_repo.get_by_name(LLAMACPP_PROVIDER_NAME)
    model_data = {
        "id": model_id,
        "name": model_id,
        "enabled": True,
        "input": ["text"],
    }
    extra = json.dumps({"runtime": "llamacpp", "model_path": str(model)})
    if row is None:
        provider_repo.create(
            name=LLAMACPP_PROVIDER_NAME,
            kind="openai",
            base_url=LLAMACPP_BASE_URL,
            api_key="local",
            extra_json=extra,
            models_json=json.dumps([model_data]),
            note="Managed by the bundled FreeOS llama.cpp sidecar",
        )
    else:
        provider_repo.update(
            row.id,
            kind="openai",
            base_url=LLAMACPP_BASE_URL,
            api_key=row.api_key or "local",
            extra_json=extra,
            models_json=json.dumps([model_data]),
            enabled=True,
        )
    return LLAMACPP_PROVIDER_NAME


atexit.register(_shutdown)
