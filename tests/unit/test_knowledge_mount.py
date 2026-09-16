from pathlib import Path

import pytest

from octop.infra.knowledge.local_mount import (
    KnowledgeMount,
    attach_cloud_pointer,
    distill_readonly,
    save_cloud_mount,
    save_mount,
    scan_mount,
)


def test_scan_is_read_only(tmp_path: Path) -> None:
    source = tmp_path / "src"
    source.mkdir()
    (source / "notes.md").write_text("hello", encoding="utf-8")
    (source / "nested").mkdir()
    (source / "nested" / "skip.bin").write_bytes(b"xx")
    before = (source / "notes.md").read_text(encoding="utf-8")
    entries = scan_mount(str(source))
    names = {item.name for item in entries}
    assert "notes.md" in names
    assert "nested" in names
    assert (source / "notes.md").read_text(encoding="utf-8") == before
    assert list(source.rglob("*"))  # source tree still present


def test_distill_writes_only_outside_source(tmp_path: Path) -> None:
    source = tmp_path / "src"
    dest = tmp_path / "out"
    source.mkdir()
    (source / "a.md").write_text("one", encoding="utf-8")
    result = distill_readonly(str(source), str(dest))
    assert result["copied"] == 1
    assert result["readonly_source"] is True
    assert (dest / "a.md").read_text(encoding="utf-8") == "one"
    assert (source / "a.md").read_text(encoding="utf-8") == "one"


def test_distill_rejects_nested_destination(tmp_path: Path) -> None:
    source = tmp_path / "src"
    source.mkdir()
    (source / "a.md").write_text("one", encoding="utf-8")
    with pytest.raises(ValueError, match="outside"):
        distill_readonly(str(source), str(source / "nested"))


def test_cloud_mount_skips_local_parse(tmp_path: Path) -> None:
    stored = save_cloud_mount(
        KnowledgeMount(
            kb_id="kb-cloud",
            kind="cloud",
            cloud_url="https://ima.example/kb/1",
            cloud_provider="ima",
        ),
        tmp_path,
    )
    assert stored.kind == "cloud"
    dest = tmp_path / "distill-cloud"
    result = attach_cloud_pointer(stored.cloud_url, str(dest), provider="ima")
    assert result["no_local_parse"] is True
    assert (dest / "CLOUD_SOURCE.md").is_file()


def test_save_mount_persists(tmp_path: Path) -> None:
    source = tmp_path / "docs"
    source.mkdir()
    stored = save_mount(
        KnowledgeMount(kb_id="kb1", source_path=str(source), distill_path=""),
        tmp_path,
    )
    assert stored.readonly is True
    assert stored.source_path.endswith("docs")


def test_scan_preview_lists_unicode_image_names(tmp_path: Path) -> None:
    source = tmp_path / "资料"
    source.mkdir()
    (source / "项目结构.png").write_bytes(b"png")
    (source / "notes.md").write_text("hi", encoding="utf-8")
    preview = {item.name for item in scan_mount(str(source), preview=True)}
    distill = {item.name for item in scan_mount(str(source))}
    assert preview == {"项目结构.png", "notes.md"}
    assert distill == {"notes.md"}


def test_save_mount_repairs_cp1252_mojibake_path(tmp_path: Path) -> None:
    source = tmp_path / "项目"
    source.mkdir()
    (source / "说明.md").write_text("ok", encoding="utf-8")
    garbled = str(source).encode().decode("cp1252")
    assert garbled != str(source)
    stored = save_mount(
        KnowledgeMount(kb_id="kb-zh", source_path=garbled, distill_path=""),
        tmp_path,
    )
    assert Path(stored.source_path) == source.resolve()
    names = {item.name for item in scan_mount(garbled, preview=True)}
    assert names == {"说明.md"}
