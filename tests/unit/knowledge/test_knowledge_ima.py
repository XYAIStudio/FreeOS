"""Unit tests for official IMA Agent Interface knowledge helpers."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from octop.infra.connectors.gateway.adapters.tencent_ima import unwrap_openapi_data
from octop.infra.knowledge.ima import (
    parse_knowledge_bases,
    parse_knowledge_list,
    preview_client_id,
    search_selected_knowledge,
)
from octop.infra.knowledge.local_mount import KnowledgeMount, load_mounts, save_cloud_mount


def test_unwrap_official_retcode_payload() -> None:
    data = unwrap_openapi_data(
        {
            "retcode": 0,
            "errmsg": "成功",
            "data": {"info_list": [{"id": "kb1", "name": "工作"}]},
        }
    )
    assert data["info_list"][0]["id"] == "kb1"


def test_unwrap_legacy_code_payload() -> None:
    data = unwrap_openapi_data({"code": 0, "data": {"info_list": []}})
    assert data == {"info_list": []}


def test_unwrap_rejects_official_error() -> None:
    with pytest.raises(ValueError, match="没有权限"):
        unwrap_openapi_data({"retcode": 110030, "errmsg": "没有权限"})


def test_parse_knowledge_bases_and_docs() -> None:
    bases, cursor, ended = parse_knowledge_bases(
        {
            "info_list": [{"id": "kb1", "name": "工作库", "cover_url": "https://x"}],
            "next_cursor": "n1",
            "is_end": False,
        }
    )
    assert bases == [{"id": "kb1", "name": "工作库", "cover_url": "https://x", "description": ""}]
    assert cursor == "n1"
    assert ended is False

    docs, folders, path, _cursor, is_end = parse_knowledge_list(
        {
            "knowledge_list": [
                {"media_id": "m1", "title": "纪要", "parent_folder_id": "kb1"},
                {"folder_id": "fd1", "name": "归档", "file_number": 2},
                {"media_id": "folder_abc", "title": "设计文档"},
                {
                    "folder_info": {"folder_id": "folder_nested", "name": "会议纪要"},
                    "title": "会议纪要",
                },
            ],
            "current_path": [{"folder_id": "kb1", "name": "工作库"}],
            "is_end": True,
        }
    )
    assert [item["media_id"] for item in docs] == ["m1"]
    assert [item["folder_id"] for item in folders] == ["fd1", "folder_abc", "folder_nested"]
    assert path[0]["name"] == "工作库"
    assert is_end is True


def test_ima_mount_persists_selection_without_url(tmp_path) -> None:
    stored = save_cloud_mount(
        KnowledgeMount(
            kb_id="kb-ima",
            kind="cloud",
            cloud_provider="ima",
            connector_instance_id="inst-1",
            selected_bases=({"id": "ima-kb", "name": "工作库"},),
            selected_docs=(
                {
                    "knowledge_base_id": "ima-kb",
                    "knowledge_base_name": "工作库",
                    "media_id": "m1",
                    "title": "纪要",
                },
            ),
        ),
        tmp_path,
    )
    assert stored.cloud_url == ""
    assert stored.connector_instance_id == "inst-1"
    loaded = load_mounts(tmp_path)["kb-ima"]
    assert loaded.selected_bases[0]["id"] == "ima-kb"
    assert loaded.selected_docs[0]["media_id"] == "m1"


def test_ima_mount_rejects_disconnected(tmp_path) -> None:
    with pytest.raises(ValueError, match="Agent Interface"):
        save_cloud_mount(
            KnowledgeMount(kb_id="kb-ima", kind="cloud", cloud_provider="ima"),
            tmp_path,
        )


def test_list_knowledge_bases_hydrates_via_get_knowledge_base(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from octop.infra.knowledge.ima import list_knowledge_bases

    calls: list[dict[str, object]] = []

    def fake_openapi(
        _creds: dict[str, object], path: str, body: dict[str, object]
    ) -> dict[str, object]:
        calls.append({"path": path, "body": body})
        if path.endswith("search_knowledge_base"):
            assert body["limit"] == 20
            return {"info_list": [{"id": "kb1", "name": "工作"}], "is_end": True}
        assert path.endswith("get_knowledge_base")
        assert body == {"ids": ["kb1"]}
        return {
            "infos": {
                "kb1": {
                    "id": "kb1",
                    "name": "工作库",
                    "description": "产品资料",
                    "cover_url": "https://x",
                }
            }
        }

    monkeypatch.setattr("octop.infra.knowledge.ima.openapi_data", fake_openapi)
    result = list_knowledge_bases({"client_id": "c", "api_key": "k"}, limit=50)
    assert result["items"][0] == {
        "id": "kb1",
        "name": "工作库",
        "cover_url": "https://x",
        "description": "产品资料",
    }


def test_list_knowledge_documents_search_uses_official_search(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from octop.infra.knowledge.ima import list_knowledge_documents

    captured: list[dict[str, object]] = []

    def fake_openapi(
        _creds: dict[str, object], path: str, body: dict[str, object]
    ) -> dict[str, object]:
        captured.append({"path": path, "body": body})
        return {
            "info_list": [
                {"media_id": "keep", "title": "周报"},
                {"media_id": "folder_skip", "title": "归档"},
            ],
            "is_end": True,
        }

    monkeypatch.setattr("octop.infra.knowledge.ima.openapi_data", fake_openapi)
    result = list_knowledge_documents(
        {"client_id": "c", "api_key": "k"},
        "kb1",
        query="周报",
        folder_id="folder_ignored",
    )
    assert captured[0]["path"] == "openapi/wiki/v1/search_knowledge"
    assert captured[0]["body"] == {
        "query": "周报",
        "knowledge_base_id": "kb1",
        "cursor": "",
    }
    assert [item["media_id"] for item in result["items"]] == ["keep"]
    assert result["folders"][0]["folder_id"] == "folder_skip"
    assert result["folder_id"] == ""
    assert result["query"] == "周报"


def test_search_selected_knowledge_filters_docs(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: list[dict[str, object]] = []

    def fake_openapi(
        _creds: dict[str, object], path: str, body: dict[str, object]
    ) -> dict[str, object]:
        captured.append({"path": path, "body": body})
        return {
            "info_list": [
                {"media_id": "keep", "title": "保留", "highlight_content": "命中保留"},
                {"media_id": "skip", "title": "跳过", "highlight_content": "不该出现"},
                {
                    "media_id": "folder_skip",
                    "title": "归档",
                    "highlight_content": "文件夹不应作为文档命中",
                },
            ]
        }

    monkeypatch.setattr("octop.infra.knowledge.ima.openapi_data", fake_openapi)
    passages = search_selected_knowledge(
        {"client_id": "c", "api_key": "k"},
        "周报",
        [{"id": "kb1", "name": "工作库"}],
        [{"knowledge_base_id": "kb1", "media_id": "keep", "title": "保留"}],
    )
    assert captured[0]["path"] == "openapi/wiki/v1/search_knowledge"
    assert [item["media_id"] for item in passages] == ["keep"]
    assert passages[0]["text"] == "命中保留"


def test_preview_client_id() -> None:
    assert preview_client_id("abcd1234efgh") == "abcd…efgh"


def test_connector_summaries_skip_foreign() -> None:
    from octop.infra.knowledge.ima import list_ima_connector_summaries

    rows = [
        SimpleNamespace(
            kind="tencent-ima",
            has_credentials=True,
            user_id=2,
            shared=False,
            instance_id="x",
            display_name="other",
            credential_blob=None,
        ),
        SimpleNamespace(
            kind="tencent-ima",
            has_credentials=True,
            user_id=1,
            shared=False,
            instance_id="mine",
            display_name="mine",
            credential_blob=None,
        ),
    ]
    services = SimpleNamespace(connector_repo=SimpleNamespace(list_visible=lambda _uid: rows))
    out = list_ima_connector_summaries(services, 1)
    assert [item["instance_id"] for item in out] == ["mine"]
