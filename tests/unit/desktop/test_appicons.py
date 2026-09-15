"""Windows shortcut icons must be full-bleed, not a tiny mark on a white square."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[3]
APPICON = REPO / "desktop" / "src" / "build" / "appicon.png"
MACICON = REPO / "desktop" / "src" / "build" / "appicon-macos.png"


def _content_width_ratio(path: Path) -> float:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    minx, maxx = w, -1
    for y in range(h):
        for x in range(w):
            r, g, b, a = im.getpixel((x, y))
            if a < 16:
                continue
            if r > 245 and g > 245 and b > 245:
                continue
            minx = min(minx, x)
            maxx = max(maxx, x)
    assert maxx >= 0, f"{path} has no visible artwork"
    return (maxx - minx + 1) / w


def test_windows_appicon_fills_the_canvas() -> None:
    assert APPICON.is_file()
    ratio = _content_width_ratio(APPICON)
    assert ratio >= 0.80, f"appicon.png fill {ratio:.1%} is too small for shortcuts"


def test_macos_appicon_follows_dock_grid() -> None:
    ratio = _content_width_ratio(MACICON)
    assert 0.75 <= ratio <= 0.86, f"appicon-macos.png fill {ratio:.1%} want ~80.5%"
