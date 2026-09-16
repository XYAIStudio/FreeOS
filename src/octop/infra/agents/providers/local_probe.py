"""Detect local hardware and already-installed desktop LLMs (Ollama / LM Studio)."""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Any

from octop.infra.agents.providers.local_weights import common_model_roots, scan_weight_roots
from octop.infra.agents.providers.ollama_install import install_plan
from octop.infra.utils.ollama_manager import OllamaModelManager, is_ollama_reachable
from octop.infra.utils.ollama_paths import find_ollama_binary, ollama_is_installed


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


def _deps(*, ollama_installed: bool, ollama_up: bool) -> list[dict[str, Any]]:
    deps: list[dict[str, Any]] = []
    plan = install_plan()
    if not ollama_installed:
        deps.append(
            {
                "id": "ollama",
                "kind": "runtime",
                "automatable": bool(plan.get("automatable")),
                "method": plan.get("method"),
                "docs_url": plan.get("docs_url"),
                "next_step": plan.get("next_step")
                or "Install Ollama from https://ollama.com/download.",
            }
        )
    elif not ollama_up:
        deps.append(
            {
                "id": "ollama_daemon",
                "kind": "runtime",
                "automatable": True,
                "method": "start",
                "docs_url": "https://ollama.com/download",
                "next_step": "Ollama is installed. Start the local service to pull or chat with models.",
            }
        )
    return deps


def probe_local_models() -> dict[str, Any]:
    ram = _ram_gb()
    gpu = _gpu_name()
    ollama_up, ollama_models = _ollama_models()
    ollama_installed = ollama_is_installed()
    discovered = list(ollama_models)
    discovered.extend(
        scan_weight_roots(
            common_model_roots(),
            full_disk=False,
            user_picked=False,
            max_files=40,
        )
    )
    return {
        "hardware": {
            "os": platform.system(),
            "arch": platform.machine(),
            "cpu_count": os.cpu_count() or 0,
            "ram_gb": ram,
            "gpu": gpu,
            "ollama_binary": bool(find_ollama_binary() or ollama_installed),
            "ollama_installed": ollama_installed,
            "ollama_reachable": ollama_up,
            "ollama_path": find_ollama_binary() or "",
        },
        "deps": _deps(ollama_installed=ollama_installed, ollama_up=ollama_up),
        "installed": discovered,
        "recommended": recommend_models(ram, bool(gpu)),
    }
