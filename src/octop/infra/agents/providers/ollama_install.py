"""Best-effort Ollama install. Honest when the host cannot automate it."""

from __future__ import annotations

import logging
import os
import platform
import shutil
import subprocess
from typing import Any

from octop.infra.utils.ollama_manager import (
    is_ollama_reachable,
    start_ollama_service_result,
)
from octop.infra.utils.ollama_paths import find_ollama_binary, ollama_is_installed

logger = logging.getLogger(__name__)

_DOCS_URL = "https://ollama.com/download"
_INSTALL_TIMEOUT_SEC = 300


def _winget() -> str | None:
    return shutil.which("winget")


def _brew() -> str | None:
    return shutil.which("brew")


def _can_sudo_n() -> bool:
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        return True
    sudo = shutil.which("sudo")
    if sudo is None:
        return False
    try:
        result = subprocess.run(
            [sudo, "-n", "true"],
            check=False,
            capture_output=True,
            timeout=5,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    return result.returncode == 0


def install_plan() -> dict[str, Any]:
    """What this host can actually automate for Ollama."""
    system = platform.system()
    if ollama_is_installed():
        return {
            "needed": False,
            "automatable": False,
            "method": None,
            "docs_url": _DOCS_URL,
        }
    if system == "Windows" and _winget():
        return {
            "needed": True,
            "automatable": True,
            "method": "winget",
            "command": "winget install --id Ollama.Ollama -e --accept-package-agreements --accept-source-agreements",
            "docs_url": _DOCS_URL,
        }
    if system == "Darwin" and _brew():
        return {
            "needed": True,
            "automatable": True,
            "method": "brew",
            "command": "brew install --cask ollama",
            "docs_url": _DOCS_URL,
        }
    if system == "Linux" and _can_sudo_n() and shutil.which("curl"):
        return {
            "needed": True,
            "automatable": True,
            "method": "install_sh",
            "command": "curl -fsSL https://ollama.com/install.sh | sh",
            "docs_url": _DOCS_URL,
        }
    return {
        "needed": True,
        "automatable": False,
        "method": "manual",
        "docs_url": _DOCS_URL,
        "next_step": (
            "FreeOS cannot install Ollama automatically on this machine. "
            "Download the official installer from https://ollama.com/download "
            "and run it, then return here."
        ),
    }


def _run(argv: list[str], *, shell: bool = False) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            argv if not shell else argv[0],
            check=False,
            capture_output=True,
            text=True,
            timeout=_INSTALL_TIMEOUT_SEC,
            shell=shell,
        )
    except subprocess.TimeoutExpired:
        return False, "Install timed out"
    except OSError as exc:
        return False, str(exc)
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()
        return False, err[:500] or f"exit {result.returncode}"
    return True, ""


def try_install_ollama() -> dict[str, Any]:
    """Run the one automated installer this host supports, or explain why not."""
    plan = install_plan()
    if not plan["needed"]:
        return {"ok": True, "installed": True, "action": "already_installed", **plan}
    if not plan["automatable"]:
        return {
            "ok": False,
            "installed": False,
            "action": "manual",
            **plan,
        }
    method = str(plan.get("method") or "")
    ok = False
    error = ""
    if method == "winget":
        winget = _winget()
        assert winget is not None
        ok, error = _run(
            [
                winget,
                "install",
                "--id",
                "Ollama.Ollama",
                "-e",
                "--accept-package-agreements",
                "--accept-source-agreements",
            ]
        )
    elif method == "brew":
        brew = _brew()
        assert brew is not None
        ok, error = _run([brew, "install", "--cask", "ollama"])
    elif method == "install_sh":
        ok, error = _run(["curl -fsSL https://ollama.com/install.sh | sh"], shell=True)
    else:
        return {"ok": False, "installed": False, "action": "manual", **plan}

    installed = ollama_is_installed()
    if not ok and not installed:
        return {
            "ok": False,
            "installed": False,
            "action": "install_failed",
            "error": error,
            "docs_url": _DOCS_URL,
            "next_step": (
                "Automatic install failed. Download Ollama from "
                "https://ollama.com/download and install it yourself, then retry."
            ),
            **{k: v for k, v in plan.items() if k not in {"needed"}},
        }
    return {
        "ok": True,
        "installed": installed or ok,
        "action": "installed",
        "docs_url": _DOCS_URL,
        "method": method,
    }


def ensure_ollama_runtime(*, install: bool = False) -> dict[str, Any]:
    """Start Ollama if present; optionally try one-click install when missing."""
    if is_ollama_reachable():
        return {
            "ok": True,
            "installed": True,
            "running": True,
            "action": "already_running",
            "binary": find_ollama_binary(),
            "docs_url": _DOCS_URL,
        }
    if ollama_is_installed():
        started = start_ollama_service_result()
        return started
    if not install:
        plan = install_plan()
        return {
            "ok": False,
            "installed": False,
            "running": False,
            "action": "not_installed",
            "automatable": bool(plan.get("automatable")),
            "method": plan.get("method"),
            "command": plan.get("command"),
            "docs_url": _DOCS_URL,
            "next_step": plan.get("next_step")
            or "Install Ollama from https://ollama.com/download, then click Start Ollama.",
        }
    installed = try_install_ollama()
    if not installed.get("ok"):
        return {**installed, "running": False}
    started = start_ollama_service_result()
    return {
        **started,
        "install_action": installed.get("action"),
        "method": installed.get("method"),
    }
