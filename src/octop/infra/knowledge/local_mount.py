"""Read-only local directory mounts for knowledge bases.

Source trees are never written, deleted, or renamed. Parse/distill output
must go to a user-chosen destination folder outside the mount.
"""

from __future__ import annotations

import json
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from octop.infra.utils.host_dirs import assert_safe_host_path
from octop.infra.utils.paths import PathLayout

_FILE = "knowledge-mounts.json"
_PARSEABLE = {".md", ".txt", ".markdown", ".rst", ".csv", ".json", ".html", ".htm"}
_MAX_DOCS = 400


@dataclass(frozen=True)
class KnowledgeMount:
    kb_id: str
    source_path: str = ""
    distill_path: str = ""
    readonly: bool = True
    kind: str = "local"
    cloud_url: str = ""
    cloud_provider: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class MountEntry:
    path: str
    name: str
    is_dir: bool
    size: int


def _store_path(home: Path | None = None) -> Path:
    root = Path(home) if home is not None else PathLayout.from_env().root
    root.mkdir(parents=True, exist_ok=True)
    return root / _FILE


def load_mounts(home: Path | None = None) -> dict[str, KnowledgeMount]:
    path = _store_path(home)
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(raw, dict):
        return {}
    out: dict[str, KnowledgeMount] = {}
    for key, value in raw.items():
        if not isinstance(value, dict):
            continue
        source = str(value.get("source_path") or "")
        cloud_url = str(value.get("cloud_url") or "")
        kind = str(value.get("kind") or ("cloud" if cloud_url else "local"))
        if kind == "local" and not source:
            continue
        if kind == "cloud" and not cloud_url:
            continue
        out[str(key)] = KnowledgeMount(
            kb_id=str(key),
            source_path=source,
            distill_path=str(value.get("distill_path") or ""),
            readonly=True,
            kind=kind,
            cloud_url=cloud_url,
            cloud_provider=str(value.get("cloud_provider") or ""),
        )
    return out


def save_cloud_mount(mount: KnowledgeMount, home: Path | None = None) -> KnowledgeMount:
    url = mount.cloud_url.strip()
    if not url.startswith(("http://", "https://")):
        raise ValueError("cloud_url must be an http(s) URL")
    distill = mount.distill_path.strip()
    if distill:
        assert_safe_host_path(distill)
    stored = KnowledgeMount(
        kb_id=mount.kb_id,
        source_path="",
        distill_path=str(Path(distill).expanduser().resolve()) if distill else "",
        readonly=True,
        kind="cloud",
        cloud_url=url,
        cloud_provider=mount.cloud_provider.strip() or "ima",
    )
    rows = load_mounts(home)
    rows[mount.kb_id] = stored
    _store_path(home).write_text(
        json.dumps({k: v.to_dict() for k, v in rows.items()}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return stored


def attach_cloud_pointer(
    cloud_url: str, distill_path: str, *, provider: str = "ima"
) -> dict[str, Any]:
    """Write a pointer file for corpus distillation. Does not fetch or parse the cloud KB."""
    assert_safe_host_path(distill_path)
    dest = Path(distill_path).expanduser().resolve()
    dest.mkdir(parents=True, exist_ok=True)
    pointer = dest / "CLOUD_SOURCE.md"
    pointer.write_text(
        f"# Cloud knowledge mount\n\nprovider: {provider}\nurl: {cloud_url}\nparse: none\n",
        encoding="utf-8",
    )
    return {
        "cloud_url": cloud_url,
        "cloud_provider": provider,
        "distill_path": str(dest),
        "copied": 0,
        "no_local_parse": True,
        "readonly_source": True,
    }


def save_mount(mount: KnowledgeMount, home: Path | None = None) -> KnowledgeMount:
    if mount.kind == "cloud" or mount.cloud_url.strip():
        return save_cloud_mount(mount, home)
    assert_safe_host_path(mount.source_path)
    source = Path(mount.source_path).expanduser().resolve()
    if not source.is_dir():
        raise ValueError("source_path must be an existing directory")
    distill = mount.distill_path.strip()
    if distill:
        assert_safe_host_path(distill)
        dest = Path(distill).expanduser().resolve()
        if dest == source or source in dest.parents:
            raise ValueError("distill_path must be outside the mounted source directory")
    rows = load_mounts(home)
    stored = KnowledgeMount(
        kb_id=mount.kb_id,
        source_path=str(source),
        distill_path=str(Path(distill).expanduser().resolve()) if distill else "",
        readonly=True,
        kind="local",
    )
    rows[mount.kb_id] = stored
    _store_path(home).write_text(
        json.dumps({k: v.to_dict() for k, v in rows.items()}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return stored


def clear_mount(kb_id: str, home: Path | None = None) -> None:
    rows = load_mounts(home)
    rows.pop(kb_id, None)
    _store_path(home).write_text(
        json.dumps({k: v.to_dict() for k, v in rows.items()}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def scan_mount(source_path: str, *, max_docs: int = _MAX_DOCS) -> list[MountEntry]:
    """List subdirectories and parseable files. Read-only; does not copy or write."""
    assert_safe_host_path(source_path)
    root = Path(source_path).expanduser().resolve()
    if not root.is_dir():
        raise ValueError("source_path must be an existing directory")
    entries: list[MountEntry] = []
    for child in sorted(root.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
        if child.name.startswith("."):
            continue
        if child.is_dir():
            entries.append(MountEntry(path=str(child), name=child.name, is_dir=True, size=0))
            continue
        if child.suffix.lower() not in _PARSEABLE:
            continue
        try:
            size = child.stat().st_size
        except OSError:
            size = 0
        entries.append(MountEntry(path=str(child), name=child.name, is_dir=False, size=size))
        if len(entries) >= max_docs:
            break
    return entries


def distill_readonly(
    source_path: str,
    distill_path: str,
    *,
    max_docs: int = _MAX_DOCS,
) -> dict[str, Any]:
    """Copy parseable text into a new folder. Never writes back to the source."""
    assert_safe_host_path(source_path)
    assert_safe_host_path(distill_path)
    source = Path(source_path).expanduser().resolve()
    dest = Path(distill_path).expanduser().resolve()
    if dest == source or source in dest.parents:
        raise ValueError("distill_path must be outside the mounted source directory")
    dest.mkdir(parents=True, exist_ok=True)
    copied = 0
    skipped = 0
    for entry in scan_mount(str(source), max_docs=max_docs):
        if entry.is_dir:
            continue
        src = Path(entry.path)
        target = dest / src.name
        if target.exists():
            skipped += 1
            continue
        shutil.copy2(src, target)
        copied += 1
    return {
        "source_path": str(source),
        "distill_path": str(dest),
        "copied": copied,
        "skipped": skipped,
        "readonly_source": True,
    }
