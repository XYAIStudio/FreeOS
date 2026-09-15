"""Demo fixture dataset for the finished FreeOS self-growth loop."""

from __future__ import annotations

from pathlib import Path

_PACKAGED = Path(__file__).resolve().parent / "data"


def _repo_root() -> Path | None:
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "tests" / "fixtures").is_dir() and (parent / "pyproject.toml").is_file():
            return parent
    return None


def _repo_loop_dir() -> Path | None:
    root = _repo_root()
    if root is None:
        return None
    path = root / "tests" / "fixtures" / "org-loop"
    return path if path.is_dir() else None


def blueprint_fixture() -> Path:
    for candidate in (
        _PACKAGED / "agent-blueprint.v1.json",
        (_repo_loop_dir() or Path()) / "agent-blueprint.v1.json",
    ):
        if candidate.is_file():
            return candidate
    raise FileNotFoundError("bundled agent-blueprint.v1.json is missing")


def policies_fixture() -> Path:
    for candidate in (
        _PACKAGED / "policies.json",
        (_repo_loop_dir() or Path()) / "policies.json",
    ):
        if candidate.is_file():
            return candidate
    raise FileNotFoundError("bundled policies.json is missing")


def extra_blueprint_fixtures() -> list[Path]:
    found: list[Path] = []
    seen_names: set[str] = set()
    for path in sorted(_PACKAGED.glob("*.blueprint.json")):
        if path.name in seen_names:
            continue
        seen_names.add(path.name)
        found.append(path)
    return found


def fixture_dir() -> Path:
    return _repo_loop_dir() or _PACKAGED
