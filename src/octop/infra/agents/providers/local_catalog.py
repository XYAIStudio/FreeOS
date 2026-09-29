"""Pinned, redistributable-friendly GGUF starter catalog for first-run setup."""

from __future__ import annotations

from typing import Any

_CATALOG: tuple[dict[str, Any], ...] = (
    {
        "id": "qwen2.5-1.5b-instruct-q4-k-m",
        "name": "qwen2.5-1.5b-instruct",
        "display_name": "Qwen2.5 1.5B Instruct (Q4_K_M)",
        "filename": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "url": "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/91cad51170dc346986eccefdc2dd33a9da36ead9/qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "sha256": "6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e",
        "size": 1_117_320_736,
        "min_ram_gb": 6,
        "license": "Apache-2.0",
        "source_url": "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF",
    },
    {
        "id": "qwen2.5-3b-instruct-q4-k-m",
        "name": "qwen2.5-3b-instruct",
        "display_name": "Qwen2.5 3B Instruct (Q4_K_M)",
        "filename": "qwen2.5-3b-instruct-q4_k_m.gguf",
        "url": "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/7dabda4d13d513e3e842b20f0d435c732f172cbe/qwen2.5-3b-instruct-q4_k_m.gguf",
        "sha256": "626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d",
        "size": 2_104_932_768,
        "min_ram_gb": 10,
        "license": "Apache-2.0",
        "source_url": "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF",
    },
)


def catalog() -> list[dict[str, Any]]:
    return [dict(item) for item in _CATALOG]


def catalog_entry(catalog_id: str) -> dict[str, Any] | None:
    return next((dict(item) for item in _CATALOG if item["id"] == catalog_id), None)


def recommended_catalog(ram_gb: float) -> list[dict[str, Any]]:
    preferred = _CATALOG[1] if ram_gb >= 12 else _CATALOG[0]
    other = _CATALOG[0] if preferred is _CATALOG[1] else _CATALOG[1]
    return [
        {**dict(preferred), "reason": "recommended_for_hardware", "install": "freeos"},
        {**dict(other), "reason": "lighter_or_stronger_alternative", "install": "freeos"},
    ]
