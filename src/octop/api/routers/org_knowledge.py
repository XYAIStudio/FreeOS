"""In-host org knowledge BFF — lists FreeOS knowledge bases, not a sidecar notes DB.

Organization Knowledge is a view over the same Octop ``knowledge_bases`` /
``knowledge_documents`` rows that Chat and Agents retrieve from. It does **not**
clone openXYOS ``/api/knowledge`` (SQL.js notes + files). Sidecar knowledge
remains optional compat.
"""

from __future__ import annotations

from contextlib import suppress
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from octop.api.deps import current_user, get_server, require_permission
from octop.api.routers.knowledge_bases import _map_knowledge_error
from octop.infra.knowledge.gate import get_capability
from octop.infra.knowledge.service import KnowledgeService
from octop.infra.server import OctopServer
from octop.infra.users.identity import User
from octop.infra.utils.locale import resolve_request_locale

router = APIRouter()

_HOST_ROUTE = "/knowledge-bases"
_TEXT_TYPES = {"text/plain", "text/markdown"}


class KnowledgeCreateBaseBody(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    shared: bool = False


class KnowledgeCreateNoteBody(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(default="")


def _is_admin(user: User) -> bool:
    return bool(user.is_admin)


def _knowledge_service(server: OctopServer) -> KnowledgeService | None:
    services = getattr(server, "services", None)
    if services is None or getattr(services, "knowledge_repo", None) is None:
        return None
    return KnowledgeService(services)


def _capability(server: OctopServer) -> dict[str, Any]:
    services = getattr(server, "services", None)
    settings = getattr(services, "settings_repo", None) if services is not None else None
    if settings is None:
        return {
            "feature_enabled": False,
            "usable": False,
            "prerequisites_ok": False,
            "selected_model": "",
            "backend": "onnx",
        }
    cap = get_capability(settings.get, getattr(services, "provider_repo", None))
    return {
        "feature_enabled": bool(cap.get("feature_enabled")),
        "usable": bool(cap.get("usable")),
        "prerequisites_ok": bool(cap.get("prerequisites_ok")),
        "selected_model": str(cap.get("selected_model") or ""),
        "backend": str(cap.get("backend") or "onnx"),
    }


def _base_payload(row: Any, *, actor_user_id: int) -> dict[str, Any]:
    owner = int(getattr(row, "owner_user_id", 0) or 0)
    return {
        "id": row.id,
        "knowledge_base_id": row.id,
        "name": row.name,
        "description": getattr(row, "description", "") or "",
        "shared": bool(getattr(row, "shared", False)),
        "default_open": bool(getattr(row, "default_open", False)),
        "icon_name": getattr(row, "icon_name", "") or "",
        "document_count": int(getattr(row, "doc_count", 0) or 0),
        "owner_user_id": owner,
        "owned": owner == int(actor_user_id),
    }


def _doc_payload(row: Any) -> dict[str, Any]:
    content_type = str(getattr(row, "content_type", "") or "")
    return {
        "id": row.id,
        "document_id": row.id,
        "kb_id": row.kb_id,
        "filename": row.filename,
        "path": getattr(row, "path", "") or row.filename,
        "content_type": content_type,
        "byte_size": int(getattr(row, "byte_size", 0) or 0),
        "is_dir": bool(getattr(row, "is_dir", False)),
        "status": getattr(row, "status", "") or "",
        "chunk_count": int(getattr(row, "chunk_count", 0) or 0),
        "created_at": int(getattr(row, "created_at", 0) or 0),
        "kind": "note" if content_type in _TEXT_TYPES else "file",
    }


def _stats(bases: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "bases": len(bases),
        "documents": sum(int(row.get("document_count") or 0) for row in bases),
        "shared": sum(1 for row in bases if row.get("shared")),
        "owned": sum(1 for row in bases if row.get("owned")),
    }


@router.get("/knowledge", summary="List host knowledge bases visible to the current user")
async def knowledge_list(
    server: OctopServer = Depends(get_server),
    user: User = Depends(current_user),
) -> dict[str, Any]:
    svc = _knowledge_service(server)
    bases: list[dict[str, Any]] = []
    if svc is not None:
        bases = [
            _base_payload(row, actor_user_id=user.id)
            for row in svc.list_visible_bases(actor_user_id=user.id, is_admin=_is_admin(user))
        ]
    return {
        "host_route": _HOST_ROUTE,
        "store": "host_knowledge_bases",
        "capability": _capability(server),
        "bases": bases,
        "stats": _stats(bases),
    }


@router.get("/knowledge/{kb_id}", summary="Get a host knowledge base and its documents")
async def knowledge_get(
    kb_id: str,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: User = Depends(current_user),
) -> dict[str, Any]:
    locale = resolve_request_locale(request)
    svc = _knowledge_service(server)
    if svc is None:
        raise _map_knowledge_error(LookupError("knowledge base not found"), locale=locale)
    try:
        base = svc.get_readable_base(kb_id, actor_user_id=user.id, is_admin=_is_admin(user))
        documents = [
            _doc_payload(row)
            for row in svc.list_documents(kb_id, actor_user_id=user.id, is_admin=_is_admin(user))
            if not getattr(row, "is_dir", False)
        ]
    except Exception as exc:
        raise _map_knowledge_error(exc, locale=locale, server=server) from exc
    payload = _base_payload(base, actor_user_id=user.id)
    payload["document_count"] = len(documents)
    payload["documents"] = documents
    return payload


@router.get(
    "/knowledge/{kb_id}/documents/{doc_id}",
    summary="Preview a host knowledge document (notes use extracted text)",
)
async def knowledge_preview(
    kb_id: str,
    doc_id: str,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: User = Depends(current_user),
) -> dict[str, Any]:
    locale = resolve_request_locale(request)
    svc = _knowledge_service(server)
    if svc is None:
        raise _map_knowledge_error(LookupError("knowledge document not found"), locale=locale)
    try:
        with suppress(ValueError, LookupError):
            text_doc = svc.read_text_document(
                kb_id, doc_id, actor_user_id=user.id, is_admin=_is_admin(user)
            )
            return {
                "id": text_doc["id"],
                "document_id": text_doc["id"],
                "kb_id": kb_id,
                "filename": text_doc["filename"],
                "content_type": text_doc.get("content_type") or "text/markdown",
                "text": text_doc["text"],
                "kind": "note",
            }
        preview = svc.preview_document(
            kb_id, doc_id, actor_user_id=user.id, is_admin=_is_admin(user)
        )
        return {
            "id": preview["id"],
            "document_id": preview["id"],
            "kb_id": kb_id,
            "filename": preview["filename"],
            "content_type": "",
            "text": preview["text"],
            "kind": "file",
        }
    except Exception as exc:
        raise _map_knowledge_error(exc, locale=locale, server=server) from exc


@router.post("/knowledge", summary="Create a host knowledge base (same store as /knowledge-bases)")
async def knowledge_create_base(
    body: KnowledgeCreateBaseBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: User = Depends(require_permission("knowledge_bases")),
) -> dict[str, Any]:
    locale = resolve_request_locale(request)
    svc = _knowledge_service(server)
    if svc is None:
        raise _map_knowledge_error(
            RuntimeError("knowledge services are not initialized"), locale=locale
        )
    try:
        base = svc.create_base(
            owner_user_id=user.id,
            name=body.name.strip(),
            description=body.description.strip(),
            shared=body.shared,
        )
    except Exception as exc:
        raise _map_knowledge_error(exc, locale=locale, server=server) from exc
    return _base_payload(base, actor_user_id=user.id)


@router.post(
    "/knowledge/{kb_id}/notes",
    summary="Create a markdown note in a host knowledge base",
)
async def knowledge_create_note(
    kb_id: str,
    body: KnowledgeCreateNoteBody,
    request: Request,
    server: OctopServer = Depends(get_server),
    user: User = Depends(require_permission("knowledge_bases")),
) -> dict[str, Any]:
    locale = resolve_request_locale(request)
    svc = _knowledge_service(server)
    if svc is None:
        raise _map_knowledge_error(
            RuntimeError("knowledge services are not initialized"), locale=locale
        )
    try:
        document = svc.create_text_document(
            kb_id,
            actor_user_id=user.id,
            name=body.title.strip(),
            format="md",
            content=body.content,
            is_admin=_is_admin(user),
        )
    except Exception as exc:
        raise _map_knowledge_error(exc, locale=locale, server=server) from exc
    if server.services is not None:
        with suppress(Exception):
            from octop.infra.knowledge.jobs import enqueue_index_document

            enqueue_index_document(server.services, kb_id, document.id)
    return _doc_payload(document)
