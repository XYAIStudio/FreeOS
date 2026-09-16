"""Detect local hardware and already-installed desktop LLMs (Ollama / LM Studio)."""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Any

from octop.infra.utils.ollama_manager import OllamaModelManager, is_ollama_reachable


def _ram_gb() -> float:
    if os.name == "nt":
        import ctypes

        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]

        stat = MEMORYSTATUSEX()
        stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
        windll = getattr(ctypes, "windll", None)
        if windll is not None and windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
            return float(round(stat.ullTotalPhys / (1024**3), 1))
        return 0.0
    try:
        text = Path("/proc/meminfo").read_text(encoding="utf-8")
    except OSError:
        return 0.0
    for line in text.splitlines():
        if line.startswith("MemTotal:"):
            return round(int(line.split()[1]) / (1024**2), 1)
    return 0.0


def _gpu_name() -> str:
    nvidia = shutil.which("nvidia-smi")
    if nvidia:
        try:
            proc = subprocess.run(
                [nvidia, "--query-gpu=name,memory.total", "--format=csv,noheader"],
                capture_output=True,
                text=True,
                timeout=4,
                check=False,
            )
        except (OSError, subprocess.SubprocessError):
            return ""
        line = (proc.stdout or "").strip().splitlines()
        if line:
            return line[0].strip()
    return ""


def _scan_gguf(roots: list[Path]) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    seen: set[str] = set()
    for root in roots:
        if not root.is_dir():
            continue
        for path in root.rglob("*.gguf"):
            key = str(path.resolve())
            if key in seen:
                continue
            seen.add(key)
            try:
                size = path.stat().st_size
            except OSError:
                size = 0
            found.append({"name": path.stem, "path": str(path), "size": size, "source": "gguf"})
            if len(found) >= 40:
                return found
    return found


def _lmstudio_roots() -> list[Path]:
    home = Path.home()
    return [
        home / ".lmstudio" / "models",
        home / ".cache" / "lm-studio" / "models",
        home / "Documents" / "LM Studio" / "models",
    ]


def _ollama_models() -> tuple[bool, list[dict[str, Any]]]:
    if not is_ollama_reachable():
        return False, []
    try:
        rows = OllamaModelManager.list_models()
    except Exception:
        return True, []
    models: list[dict[str, Any]] = []
    for item in rows:
        name = getattr(item, "name", "") or ""
        if not name:
            continue
        models.append(
            {
                "name": str(name),
                "path": "",
                "size": int(getattr(item, "size", 0) or 0),
                "source": "ollama",
            }
        )
    return True, models


def recommend_models(ram_gb: float, has_gpu: bool) -> list[dict[str, str]]:
    picks: list[tuple[str, str]]
    if ram_gb and ram_gb < 8:
        picks = [("llama3.2:1b", "1B chat model for 8 GB or less")]
    elif ram_gb < 16:
        picks = [
            ("llama3.2:3b", "3B chat model for 8–16 GB RAM"),
            ("qwen2.5:3b", "Compact Qwen for everyday tasks"),
        ]
    elif ram_gb < 32:
        picks = [
            ("llama3.1:8b", "8B general chat"),
            ("qwen2.5:7b", "7B Qwen for Chinese + English"),
        ]
    else:
        picks = [
            ("qwen2.5:14b", "14B when you have 32 GB+ RAM"),
            ("llama3.1:8b", "8B fallback if the larger pull is too heavy"),
        ]
    if has_gpu and ram_gb >= 16:
        picks = [("qwen2.5:14b", "GPU present — 14B is usable"), *picks]
    return [{"id": mid, "reason": reason, "install": "ollama"} for mid, reason in picks]


def probe_local_models() -> dict[str, Any]:
    ram = _ram_gb()
    gpu = _gpu_name()
    ollama_up, ollama_models = _ollama_models()
    discovered = list(ollama_models)
    discovered.extend(_scan_gguf(_lmstudio_roots()))
    return {
        "hardware": {
            "os": platform.system(),
            "arch": platform.machine(),
            "cpu_count": os.cpu_count() or 0,
            "ram_gb": ram,
            "gpu": gpu,
            "ollama_binary": bool(shutil.which("ollama")),
            "ollama_reachable": ollama_up,
        },
        "installed": discovered,
        "recommended": recommend_models(ram, bool(gpu)),
    }
