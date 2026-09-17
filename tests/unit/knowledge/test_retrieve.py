"""Unit tests for knowledge retrieval during a chat turn."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

from octop.infra.db.migrate import run_migrations
from octop.infra.db.pool import SqlitePool
from octop.infra.db.repos.knowledge import KnowledgeRepo
from octop.infra.db.repos.settings import SettingsRepo
from octop.infra.db.repos.users import UserRepo
from octop.infra.knowledge import retrieve as retrieve_module
from octop.infra.knowledge.citations import CITATIONS_MARKER_PREFIX
from octop.infra.knowledge.index import KnowledgeIndex


def test_retrieve_context_filters_unreadable_knowledge_base(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("OCTOP_HOME", str(tmp_path / "home"))
    pool = SqlitePool(tmp_path / "octop.db")
    run_migrations(pool)
    services = SimpleNamespace(
        knowledge_repo=KnowledgeRepo(pool),
        settings_repo=SettingsRepo(pool),
        user_repo=UserRepo(pool),
    )
    reader = services.user_repo.create(username="reader", password_hash="h", role="user")
    owner = services.user_repo.create(username="owner", password_hash="h", role="user")
    allowed = services.knowledge_repo.create_base(owner_user_id=reader, name="Allowed")
    hidden = services.knowledge_repo.create_base(owner_user_id=owner, name="Hidden")
    allowed_doc = services.knowledge_repo.create_document(
        kb_id=allowed.id,
        filename="allowed.md",
        content_type="text/markdown",
        byte_size=1,
        status="ready",
    )
    hidden_doc = services.knowledge_repo.create_document(
        kb_id=hidden.id,
        filename="hidden.md",
        content_type="text/markdown",
        byte_size=1,
        status="ready",
    )
    KnowledgeIndex(allowed.id).replace_doc_chunks(allowed_doc.id, ["allowed fact"], [[1.0, 0.0]])
    KnowledgeIndex(hidden.id).replace_doc_chunks(hidden_doc.id, ["secret fact"], [[1.0, 0.0]])
    services.settings_repo.set("knowledge_embedding_model", "test-model")
    monkeypatch.setattr(retrieve_module, "assert_knowledge_usable", lambda *_args: None)
    monkeypatch.setattr(
        retrieve_module, "embed_knowledge_texts", lambda _services, _texts: [[1.0, 0.0]]
    )

    context = asyncio.run(
        retrieve_module.retrieve_context(
            services,
            user_id=reader,
            is_admin=False,
            query="What facts are available?",
            knowledge_base_ids=[allowed.id, hidden.id],
        )
    )

    assert "allowed fact" in context
    assert "allowed.md" in context
    assert CITATIONS_MARKER_PREFIX in context
    assert "secret fact" not in context
    assert "hidden.md" not in context


def test_retrieve_context_skips_empty_non_text_turn() -> None:
    context = asyncio.run(
        retrieve_module.retrieve_context(
            SimpleNamespace(),
            user_id=1,
            is_admin=False,
            query=None,  # type: ignore[arg-type]
            knowledge_base_ids=["kb-1"],
        )
    )

    assert context == ""


def test_retrieve_context_includes_ima_selection(monkeypatch) -> None:
    from octop.infra.knowledge.local_mount import KnowledgeMount

    base = SimpleNamespace(id="kb-1", name="Cloud")
    services = SimpleNamespace(
        knowledge_repo=SimpleNamespace(
            list_visible=lambda _uid: [base],
            list_documents=lambda _id: [],
        ),
        settings_repo=SimpleNamespace(get=lambda _key: "model"),
        connector_repo=object(),
        secret_repo=object(),
    )
    monkeypatch.setattr(retrieve_module, "assert_knowledge_usable", lambda *_args: None)
    monkeypatch.setattr(retrieve_module, "embed_knowledge_texts", lambda *_a, **_k: [])
    monkeypatch.setattr(
        "octop.infra.knowledge.local_mount.load_mounts",
        lambda: {
            "kb-1": KnowledgeMount(
                kb_id="kb-1",
                kind="cloud",
                cloud_provider="ima",
                connector_instance_id="inst-1",
                selected_bases=({"id": "ima-kb", "name": "工作库"},),
                selected_docs=(
                    {
                        "knowledge_base_id": "ima-kb",
                        "media_id": "m1",
                        "title": "纪要",
                    },
                ),
            )
        },
    )
    monkeypatch.setattr(
        "octop.infra.knowledge.ima.load_ima_connector_credentials",
        lambda *_a, **_k: {"client_id": "c", "api_key": "k"},
    )
    monkeypatch.setattr(
        "octop.infra.knowledge.ima.search_selected_knowledge",
        lambda *_a, **_k: [
            {
                "knowledge_base_id": "ima-kb",
                "knowledge_base_name": "工作库",
                "media_id": "m1",
                "title": "纪要",
                "text": "ima selected hit",
            }
        ],
    )

    context = asyncio.run(
        retrieve_module.retrieve_context(
            services,
            user_id=1,
            is_admin=False,
            query="周报",
            knowledge_base_ids=["kb-1"],
        )
    )

    assert "ima selected hit" in context
    assert "工作库" in context
    assert "纪要" in context
