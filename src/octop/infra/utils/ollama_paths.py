"""Locate an existing Ollama install without inventing one.

PATH is checked first. Windows/macOS known vendor paths are probed only
when the binary is already on disk. Missing software yields ``None``.
"""

from __future__ import annotations

import os
import platform
import shutil
from pathlib import Path


def _windows_candidate_dirs() -> list[Path]:
    dirs: list[Path] = []
    for env_name in ("LOCALAPPDATA", "PROGRAMFILES", "PROGRAMFILES(X86)"):
        raw = os.environ.get(env_name, "").strip()
        if raw:
            dirs.append(Path(raw) / "Programs" / "Ollama")
            dirs.append(Path(raw) / "Ollama")
    home = Path.home()
    dirs.extend(
        [
            home / "AppData" / "Local" / "Programs" / "Ollama",
            home / "AppData" / "Local" / "Ollama",
        ]
    )
    seen: set[str] = set()
    unique: list[Path] = []
    for item in dirs:
        key = os.path.normcase(str(item))
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def _darwin_candidates() -> list[Path]:
    return [
        Path("/usr/local/bin/ollama"),
        Path("/opt/homebrew/bin/ollama"),
        Path("/Applications/Ollama.app/Contents/Resources/ollama"),
        Path("/Applications/Ollama.app/Contents/MacOS/ollama"),
    ]


def _linux_candidates() -> list[Path]:
    home = Path.home()
    return [
        Path("/usr/local/bin/ollama"),
        Path("/usr/bin/ollama"),
        home / ".local" / "bin" / "ollama",
    ]


def _existing_file(path: Path) -> Path | None:
    try:
        if path.is_file():
            return path
    except OSError:
        return None
    return None


def find_ollama_binary() -> str | None:
    """Return an executable ``ollama`` path, or ``None`` if it is not installed."""
    which = shutil.which("ollama")
    if which:
        return which
    system = platform.system()
    candidates: list[Path] = []
    if system == "Windows":
        for folder in _windows_candidate_dirs():
            candidates.append(folder / "ollama.exe")
            candidates.append(folder / "ollama")
    elif system == "Darwin":  # pragma: no cover - Darwin CI rare
        candidates.extend(_darwin_candidates())
    else:
        candidates.extend(_linux_candidates())
    for path in candidates:
        found = _existing_file(path)
        if found is not None:
            return str(found)
    return None


def find_ollama_app() -> str | None:
    """Return the Windows/macOS GUI app path when present.

    Used to launch the tray app on Windows when ``ollama serve`` alone is
    not how the vendor install is meant to start.
    """
    if platform.system() == "Windows":
        for folder in _windows_candidate_dirs():
            for name in ("Ollama.exe", "ollama app.exe"):
                found = _existing_file(folder / name)
                if found is not None:
                    return str(found)
        return None
    app = Path("/Applications/Ollama.app")
    try:
        if app.is_dir():
            return str(app)
    except OSError:
        return None
    return None


def ollama_is_installed() -> bool:
    """True when a vendor binary or GUI app is already on disk."""
    return find_ollama_binary() is not None or find_ollama_app() is not None
