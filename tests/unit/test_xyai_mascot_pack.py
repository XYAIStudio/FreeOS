"""User-facing mascot files must be the XYAI robot pack, not the octopus."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PUBLIC = REPO / "dashboard" / "public"
DESKTOP = REPO / "desktop" / "src" / "assets"
OPENXYOS = REPO / "modules" / "openxyos" / "frontend" / "public" / "assets"

POSES = ("welcome", "empty", "peek", "think", "type", "tasks")


def test_dashboard_ships_xyai_mascot_stills() -> None:
    leftovers = sorted(PUBLIC.glob("octop-mascot*"))
    assert leftovers == [], f"octopus mascots still shipped: {leftovers}"
    for pose in POSES:
        path = PUBLIC / f"xyai-mascot-{pose}.webp"
        assert path.is_file(), f"missing {path.name}"
        assert path.stat().st_size > 1024


def test_desktop_splash_ships_xyai_mascot_stills() -> None:
    leftovers = sorted(DESKTOP.glob("octop-mascot*"))
    assert leftovers == [], f"octopus mascots still shipped: {leftovers}"
    for pose in ("welcome", "peek", "think", "type"):
        path = DESKTOP / f"xyai-mascot-{pose}.webp"
        assert path.is_file(), f"missing {path.name}"


def test_openxyos_hero_uses_xyai_mascot() -> None:
    path = OPENXYOS / "xyai-mascot.webp"
    assert path.is_file()
    assert path.stat().st_size > 1024
