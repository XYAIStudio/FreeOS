"""Auth / splash surfaces must not ship Octop wordmarks."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[3]

AUTH_SURFACES = (
    "dashboard/src/pages/Login/index.tsx",
    "dashboard/src/pages/Setup/index.tsx",
    "dashboard/src/components/BrandMark.tsx",
    "dashboard/src/context/AuthPromptContext.tsx",
    "dashboard/index.html",
    "desktop/src/assets/index.html",
)

FORBIDDEN = ("logo_name.png", "logo_name_dark.png")


def test_auth_surfaces_use_xyai_mark_not_octop_wordmark() -> None:
    for rel in AUTH_SURFACES:
        text = (REPO / rel).read_text(encoding="utf-8")
        for needle in FORBIDDEN:
            assert needle not in text, f"{rel} still references {needle}"
        if rel.endswith("BrandMark.tsx") or rel == "dashboard/index.html":
            assert "xyai-mark.png" in text or "freeos-logo.png" in text, (
                f"{rel} is missing the circular XYAI / FreeOS mark"
            )
        if rel == "desktop/src/assets/index.html":
            assert "xyai-mascot-welcome.webp" in text, (
                f"{rel} is missing the XYAI robot splash mascot"
            )
        assert 'alt="Octop"' not in text
        assert ">Octop<" not in text


def test_package_script_stamps_freeos_and_requires_xyai_dashboard() -> None:
    text = (REPO / "desktop" / "portable" / "package.sh").read_text(encoding="utf-8")
    assert "FREEOS_STAMP" in text
    assert "xyai-mark.png" in text
    assert "exit 1" in text
