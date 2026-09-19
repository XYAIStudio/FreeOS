"""In-host org knowledge BFF — lists FreeOS knowledge bases, not a sidecar DB."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from octop.api.deps import current_user, get_server
from octop.api.routers import org_knowledge
from octop.api.routers.org_module import router
from octop.infra.errors import OctopError
from octop.infra.users.identity import Role, User
from octop.modules.org_os.contract import (
    SHARED_ORG_UI_MODULES,
    assert_shared_modules_in_catalog,
)


@dataclass
class _Base:
    id: str = "kb-1"
    pk: int = 1
    owner_user_id: int = 1
    name: str = "Policies"
    description: str = "Host knowledge"
    default_open: bool = False
    shared: bool = True
    icon_name: str = ""
    embedding_model: str = "bge"
    embedding_dim: int = 0
    doc_count: int = 1
    max_documents: int = 100
    created_at: int = 1
    updated_at: int = 1


@dataclass
class _Document:
    id: str = "doc-1"
    pk: int = 1
    kb_id: str = "kb-1"
    path: str = "handbook.md"
    filename: str = "handbook.md"
    is_dir: bool = False
    content_type: str = "text/markdown"
    byte_size: int = 12
    content_hash: str = ""
    status: str = "ready"
    error_message: str = ""
    chunk_count: int = 1
    created_at: int = 1
    updated_at: int = 1


class _FakeKnowledge:
    def __init__(self) -> None:
        self.bases = [_Base()]
        self.documents = [_Document()]
        self.created_bases: list[str] = []
        self.created_notes: list[tuple[str, str]] = []

    def list_visible_bases(self, *, actor_user_id: int, is_admin: bool = False) -> list[_Base]:
        if is_admin:
            return list(self.bases)
        return [row for row in self.bases if row.owner_user_id == actor_user_id or row.shared]

    def get_readable_base(self, kb_id: str, *, actor_user_id: int, is_admin: bool = False) -> _Base:
        for row in self.list_visible_bases(actor_user_id=actor_user_id, is_admin=is_admin):
            if row.id == kb_id:
                return row
        raise LookupError("knowledge base not found")

    def list_documents(
        self, kb_id: str, *, actor_user_id: int, is_admin: bool = False, prefix: str | None = None
    ) -> list[_Document]:
        self.get_readable_base(kb_id, actor_user_id=actor_user_id, is_admin=is_admin)
        return [row for row in self.documents if row.kb_id == kb_id]

    def create_base(
        self,
        *,
        owner_user_id: int,
        name: str,
        description: str = "",
        default_open: bool = False,
        shared: bool = False,
        icon_name: str = "",
        max_documents: int = 100,
    ) -> _Base:
        created = _Base(
            id="kb-2",
            owner_user_id=owner_user_id,
            name=name,
            description=description,
            shared=shared,
            doc_count=0,
        )
        self.bases.append(created)
        self.created_bases.append(name)
        return created

    def create_text_document(
        self,
        kb_id: str,
        *,
        actor_user_id: int,
        name: str,
        format: str,
        content: str = "",
        is_admin: bool = False,
        path: str | None = None,
    ) -> _Document:
        self.get_readable_base(kb_id, actor_user_id=actor_user_id, is_admin=is_admin)
        created = _Document(
            id="doc-2",
            kb_id=kb_id,
            path=f"{name}.md",
            filename=f"{name}.md",
            byte_size=len(content),
            status="pending",
            chunk_count=0,
        )
        self.documents.append(created)
        self.created_notes.append((kb_id, name))
        return created

    def read_text_document(
        self, kb_id: str, doc_id: str, *, actor_user_id: int, is_admin: bool = False
    ) -> dict[str, str]:
        self.get_readable_base(kb_id, actor_user_id=actor_user_id, is_admin=is_admin)
        return {
            "id": doc_id,
            "filename": "handbook.md",
            "content_type": "text/markdown",
            "text": "# Handbook",
        }

    def preview_document(
        self, kb_id: str, doc_id: str, *, actor_user_id: int, is_admin: bool = False
    ) -> dict[str, str]:
        return self.read_text_document(
            kb_id, doc_id, actor_user_id=actor_user_id, is_admin=is_admin
        )


def _admin() -> User:
    return User(id=1, username="admin", role=Role.ADMIN, display_name="Ada")


def _member() -> User:
    return User(id=2, username="member", role=Role.USER, display_name="Mo")


def _client(
    tmp_path: Path,
    user: User,
    monkeypatch: pytest.MonkeyPatch,
    *,
    knowledge: _FakeKnowledge | None = None,
    with_repo: bool = True,
) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/org-module")

    @app.exception_handler(OctopError)
    async def _octop(_request: object, exc: OctopError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content=exc.to_envelope())

    fake = knowledge if knowledge is not None else _FakeKnowledge()
    services = None
    if with_repo:
        services = SimpleNamespace(
            knowledge_repo=SimpleNamespace(),
            settings_repo=SimpleNamespace(get=lambda _key: "true"),
            provider_repo=None,
        )
    server = SimpleNamespace(
        paths=SimpleNamespace(config=tmp_path / "config.json", root=tmp_path),
        services=services,
    )
    app.dependency_overrides[current_user] = lambda: user
    app.dependency_overrides[get_server] = lambda: server
    monkeypatch.setattr(
        org_knowledge,
        "_knowledge_service",
        lambda _server: fake if with_repo else None,
    )
    monkeypatch.setattr(
        org_knowledge,
        "_capability",
        lambda _server: {
            "feature_enabled": True,
            "usable": True,
            "prerequisites_ok": True,
            "selected_model": "bge",
            "backend": "onnx",
        },
    )
    return TestClient(app)


def test_shared_knowledge_module_is_in_catalog() -> None:
    assert "knowledge" in SHARED_ORG_UI_MODULES
    assert "skills" in SHARED_ORG_UI_MODULES
    assert_shared_modules_in_catalog()


def test_api_lists_host_knowledge_bases(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    admin = _client(tmp_path, _admin(), monkeypatch)
    listed = admin.get("/api/org-module/knowledge")
    assert listed.status_code == 200
    body = listed.json()
    assert body["store"] == "host_knowledge_bases"
    assert body["host_route"] == "/knowledge-bases"
    assert body["stats"]["bases"] == 1
    assert body["bases"][0]["name"] == "Policies"
    assert body["bases"][0]["owned"] is True
    assert body["capability"]["usable"] is True


def test_api_lists_empty_when_knowledge_repo_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = _client(tmp_path, _admin(), monkeypatch, with_repo=False)
    listed = admin.get("/api/org-module/knowledge")
    assert listed.status_code == 200
    body = listed.json()
    assert body["bases"] == []
    assert body["stats"]["bases"] == 0


def test_api_reads_documents_and_preview(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    admin = _client(tmp_path, _admin(), monkeypatch)
    detail = admin.get("/api/org-module/knowledge/kb-1")
    assert detail.status_code == 200
    assert detail.json()["documents"][0]["kind"] == "note"
    preview = admin.get("/api/org-module/knowledge/kb-1/documents/doc-1")
    assert preview.status_code == 200
    assert "# Handbook" in preview.json()["text"]
    missing = admin.get("/api/org-module/knowledge/kb-missing")
    assert missing.status_code == 404


def test_api_member_can_read_but_cannot_create(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake = _FakeKnowledge()
    member = _client(tmp_path, _member(), monkeypatch, knowledge=fake)
    listed = member.get("/api/org-module/knowledge")
    assert listed.status_code == 200
    assert listed.json()["bases"][0]["name"] == "Policies"
    denied_base = member.post("/api/org-module/knowledge", json={"name": "Nope"})
    assert denied_base.status_code == 403
    denied_note = member.post(
        "/api/org-module/knowledge/kb-1/notes",
        json={"title": "Nope", "content": "x"},
    )
    assert denied_note.status_code == 403


def test_api_admin_creates_host_base_and_note(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake = _FakeKnowledge()
    admin = _client(tmp_path, _admin(), monkeypatch, knowledge=fake)
    created = admin.post(
        "/api/org-module/knowledge",
        json={"name": "Playbooks", "description": "ops", "shared": True},
    )
    assert created.status_code == 200
    assert created.json()["name"] == "Playbooks"
    assert fake.created_bases == ["Playbooks"]

    note = admin.post(
        "/api/org-module/knowledge/kb-1/notes",
        json={"title": "Standup", "content": "notes"},
    )
    assert note.status_code == 200
    assert note.json()["kind"] == "note"
    assert fake.created_notes == [("kb-1", "Standup")]
