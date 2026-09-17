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
from octop.infra.utils.win_utf8 import repair_utf8_mojibake

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
    connector_instance_id: str = ""
    selected_bases: tuple[dict[str, str], ...] = ()
    selected_docs: tuple[dict[str, str], ...] = ()

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["selected_bases"] = [dict(item) for item in self.selected_bases]
        payload["selected_docs"] = [dict(item) for item in self.selected_docs]
        return payload


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
        connector_instance_id = str(value.get("connector_instance_id") or "")
        kind = str(
            value.get("kind") or ("cloud" if cloud_url or connector_instance_id else "local")
        )
        if kind == "local" and not source:
            continue
        if kind == "cloud" and not cloud_url and not connector_instance_id:
            continue
        out[str(key)] = KnowledgeMount(
            kb_id=str(key),
            source_path=source,
            distill_path=str(value.get("distill_path") or ""),
            readonly=True,
            kind=kind,
            cloud_url=cloud_url,
            cloud_provider=str(value.get("cloud_provider") or ""),
            connector_instance_id=connector_instance_id,
            selected_bases=_normalize_selected_bases(value.get("selected_bases")),
            selected_docs=_normalize_selected_docs(value.get("selected_docs")),
        )
    return out


def save_cloud_mount(mount: KnowledgeMount, home: Path | None = None) -> KnowledgeMount:
    provider = mount.cloud_provider.strip() or "ima"
    url = mount.cloud_url.strip()
    instance_id = mount.connector_instance_id.strip()
    selected_bases = _normalize_selected_bases(mount.selected_bases)
    selected_docs = _normalize_selected_docs(mount.selected_docs)
    if provider == "ima":
        if not instance_id and not url.startswith(("http://", "https://")):
            raise ValueError("IMA mount requires Agent Interface credentials")
        if url and not url.startswith(("http://", "https://")):
            raise ValueError("cloud_url must be an http(s) URL")
    elif not url.startswith(("http://", "https://")):
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
        cloud_provider=provider,
        connector_instance_id=instance_id,
        selected_bases=selected_bases,
        selected_docs=selected_docs,
    )
    rows = load_mounts(home)
    rows[mount.kb_id] = stored
    _store_path(home).write_text(
        json.dumps({k: v.to_dict() for k, v in rows.items()}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return stored


def attach_cloud_pointer(
    cloud_url: str,
    distill_path: str,
    *,
    provider: str = "ima",
    selected_bases: object = (),
    selected_docs: object = (),
    interface_url: str = "https://ima.qq.com/agent-interface",
) -> dict[str, Any]:
    """Write a pointer file for corpus distillation. Does not fetch or parse the cloud KB."""
    assert_safe_host_path(distill_path)
    dest = Path(distill_path).expanduser().resolve()
    dest.mkdir(parents=True, exist_ok=True)
    pointer = dest / "CLOUD_SOURCE.md"
    bases = _normalize_selected_bases(selected_bases)
    docs = _normalize_selected_docs(selected_docs)
    lines = [
        "# Cloud knowledge mount",
        "",
        f"provider: {provider}",
        f"url: {cloud_url or interface_url}",
        f"interface: {interface_url}",
        "parse: none",
    ]
    if bases:
        lines.append("selected_bases:")
        lines.extend(f"- {item['id']}: {item['name']}" for item in bases)
    if docs:
        lines.append("selected_docs:")
        lines.extend(
            f"- {item['knowledge_base_id']}/{item['media_id']}: {item['title']}" for item in docs
        )
    pointer.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return {
        "cloud_url": cloud_url or interface_url,
        "cloud_provider": provider,
        "distill_path": str(dest),
        "copied": 0,
        "no_local_parse": True,
        "readonly_source": True,
        "selected_bases": [dict(item) for item in bases],
        "selected_docs": [dict(item) for item in docs],
    }


def _normalize_selected_bases(value: object) -> tuple[dict[str, str], ...]:
    if not isinstance(value, (list, tuple)):
        return ()
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, dict):
            continue
        kid = str(item.get("id") or item.get("knowledge_base_id") or "").strip()
        if not kid or kid in seen:
            continue
        seen.add(kid)
        out.append({"id": kid, "name": str(item.get("name") or kid).strip() or kid})
    return tuple(out)


def _normalize_selected_docs(value: object) -> tuple[dict[str, str], ...]:
    if not isinstance(value, (list, tuple)):
        return ()
    out: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for item in value:
        if not isinstance(item, dict):
            continue
        kb_id = str(item.get("knowledge_base_id") or "").strip()
        media_id = str(item.get("media_id") or "").strip()
        if not kb_id or not media_id or (kb_id, media_id) in seen:
            continue
        seen.add((kb_id, media_id))
        out.append(
            {
                "knowledge_base_id": kb_id,
                "knowledge_base_name": str(item.get("knowledge_base_name") or "").strip(),
                "media_id": media_id,
                "title": str(item.get("title") or media_id).strip() or media_id,
            }
        )
    return tuple(out)


def save_mount(mount: KnowledgeMount, home: Path | None = None) -> KnowledgeMount:
    if mount.kind == "cloud" or mount.cloud_url.strip():
        return save_cloud_mount(mount, home)
    source_path = repair_utf8_mojibake(mount.source_path)
    assert_safe_host_path(source_path)
    source = Path(source_path).expanduser().resolve()
    if not source.is_dir():
        raise ValueError("source_path must be an existing directory")
    distill = repair_utf8_mojibake(mount.distill_path).strip()
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


def scan_mount(
    source_path: str, *, max_docs: int = _MAX_DOCS, preview: bool = False
) -> list[MountEntry]:
    """List subdirectories and files. Read-only; does not copy or write.

    When *preview* is false (distill), only parseable text suffixes are included.
    Mount list preview includes every non-hidden entry so Chinese image names
    stay visible before embeddings are ready.
    """
    source_path = repair_utf8_mojibake(source_path)
    assert_safe_host_path(source_path)
    root = Path(source_path).expanduser().resolve()
    if not root.is_dir():
        raise ValueError("source_path must be an existing directory")
    entries: list[MountEntry] = []
    for child in sorted(root.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
        if child.name.startswith("."):
            continue
        name = repair_utf8_mojibake(child.name)
        path_text = repair_utf8_mojibake(str(child))
        if child.is_dir():
            entries.append(MountEntry(path=path_text, name=name, is_dir=True, size=0))
            continue
        if not preview and child.suffix.lower() not in _PARSEABLE:
            continue
        try:
            size = child.stat().st_size
        except OSError:
            size = 0
        entries.append(MountEntry(path=path_text, name=name, is_dir=False, size=size))
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
    source_path = repair_utf8_mojibake(source_path)
    distill_path = repair_utf8_mojibake(distill_path)
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
