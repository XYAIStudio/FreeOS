#!/usr/bin/env python3
"""Scale the FreeOS circular mark to full-bleed desktop icons.

Windows shortcuts use appicon.png → .ico. A centered 144px mark on a 512
canvas reads as a tiny logo in a white square. This crops the mark and
fills ~92% of the Windows/Linux canvas (macOS keeps the 824/1024 grid).
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT.parent / "assets"
MARK = ASSETS / "freeos-logo.png"

# Near-white / transparent treated as padding, not artwork.
WHITE = 245
ALPHA = 16


def load_mark() -> Image.Image:
    src = Image.open(MARK).convert("RGBA")
    bbox = content_bbox(src)
    if bbox is None:
        raise SystemExit(f"no visible mark in {MARK}")
    return src.crop(bbox)


def content_bbox(im: Image.Image) -> tuple[int, int, int, int] | None:
    w, h = im.size
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            r, g, b, a = im.getpixel((x, y))
            if a < ALPHA:
                continue
            if r > WHITE and g > WHITE and b > WHITE:
                continue
            minx = min(minx, x)
            miny = min(miny, y)
            maxx = max(maxx, x)
            maxy = max(maxy, y)
    if maxx < 0:
        return None
    return (minx, miny, maxx + 1, maxy + 1)


def place(mark: Image.Image, canvas: int, fill: float, bg: tuple[int, int, int, int]) -> Image.Image:
    out = Image.new("RGBA", (canvas, canvas), bg)
    target = max(1, int(canvas * fill))
    mw, mh = mark.size
    scale = target / max(mw, mh)
    nw, nh = max(1, int(mw * scale)), max(1, int(mh * scale))
    fitted = mark.resize((nw, nh), Image.Resampling.LANCZOS)
    out.paste(fitted, ((canvas - nw) // 2, (canvas - nh) // 2), fitted)
    return out


def main() -> None:
    mark = load_mark()
    white = (255, 255, 255, 255)
    # Windows / Linux shortcut: opaque full-bleed square, mark near the edges.
    place(mark, 512, 0.92, white).save(ROOT / "appicon.png", "PNG")
    # macOS Dock: Apple 824/1024 grid, transparent corners.
    place(mark, 1024, 824 / 1024, (0, 0, 0, 0)).save(ROOT / "appicon-macos.png", "PNG")
    # Tray / window icon: already small; keep the mark large on an opaque tile.
    place(mark, 128, 0.92, white).save(ASSETS / "tray-icon.png", "PNG")
    print("wrote appicon.png, appicon-macos.png, tray-icon.png")


if __name__ == "__main__":
    main()
