"""Official IMA Agent Interface helpers for knowledge-base mount.

Auth and endpoints follow https://ima.qq.com/agent-interface and the
official ima-skill 1.1.9 Wiki OpenAPI (``openapi/wiki/v1``):

- Headers ``ima-openapi-clientid`` / ``ima-openapi-apikey``
- POST JSON to ``https://ima.qq.com/openapi/wiki/v1/*``
- List bases: ``search_knowledge_base`` (limit 1–20), then hydrate with
  ``get_knowledge_base``
- Browse docs: ``get_knowledge_list``; search docs: ``search_knowledge``
- Folders in those lists use ``media_id`` prefixed ``folder_``
"""

from __future__ import annotations

from typing import Any

from octop.infra.connectors.builder import mcp_server_name, validate_create_credentials
from octop.infra.connectors.crypto import decrypt_credentials, encrypt_credentials
from octop.infra.connectors.default_open import build_instance_config_json
from octop.infra.connectors.gateway.adapters.tencent_ima import (
    openapi_data,
    probe_credentials,
)
from octop.infra.utils.ulid import new_ulid

IMA_KIND = "tencent-ima"
IMA_AGENT_INTERFACE_URL = "https://ima.qq.com/agent-interface"
IMA_DISPLAY_NAME = "腾讯 IMA"


def preview_client_id(client_id: str) -> str:
    text = client_id.strip()
    if len(text) <= 8:
        return text
    return f"{text[:4]}…{text[-4:]}"


def list_ima_connector_summaries(services: Any, user_id: int) -> list[dict[str, str]]:
    repo = getattr(services, "connector_repo", None)
    if repo is None:
        return []
    out: list[dict[str, str]] = []
    for row in repo.list_visible(user_id):
        if row.kind != IMA_KIND or not row.has_credentials:
            continue
        if int(row.user_id) != int(user_id) and not row.shared:
            continue
        out.append(
            {
                "instance_id": row.instance_id,
                "display_name": row.display_name,
                "client_id_preview": _preview_from_row(services, row),
            }
        )
    return out


def resolve_ima_credentials(
    services: Any,
    user_id: int,
    *,
    instance_id: str = "",
    client_id: str = "",
    api_key: str = "",
    persist: bool = False,
) -> tuple[str, dict[str, str]]:
    """Return ``(instance_id, creds)`` using official Client ID + API Key.

    New credentials are probed against ``search_knowledge_base`` before persist.
    """
    client_id = client_id.strip()
    api_key = api_key.strip()
    instance_id = instance_id.strip()
    if client_id and api_key:
        creds = {"client_id": client_id, "api_key": api_key}
        try:
            probe_credentials(creds)
        except ValueError as exc:
            raise ValueError(f"IMA credentials: {exc}") from exc
        stored_id = (
            upsert_ima_connector(services, user_id, creds, instance_id=instance_id)
            if persist
            else instance_id
        )
        return stored_id, creds
    creds = load_ima_connector_credentials(services, user_id, instance_id=instance_id)
    if persist:
        try:
            probe_credentials(creds)
        except ValueError as exc:
            raise ValueError(f"IMA credentials: {exc}") from exc
    return instance_id or _first_ima_instance_id(services, user_id), creds


def load_ima_connector_credentials(
    services: Any,
    user_id: int,
    *,
    instance_id: str = "",
) -> dict[str, str]:
    repo = getattr(services, "connector_repo", None)
    secret = getattr(services, "secret_repo", None)
    if repo is None or secret is None:
        raise ValueError("IMA credentials: connector store is unavailable")
    row_id = instance_id.strip() or _first_ima_instance_id(services, user_id)
    if not row_id:
        raise ValueError("IMA credentials: Client ID and API Key are required")
    row = repo.get(row_id)
    if row is None or row.kind != IMA_KIND or not row.credential_blob:
        raise ValueError("IMA credentials: connector not found")
    if int(row.user_id) != int(user_id) and not row.shared:
        raise PermissionError("not your IMA connector")
    raw = decrypt_credentials(secret, row.credential_blob)
    client_id = str(raw.get("client_id") or "").strip()
    api_key = str(raw.get("api_key") or "").strip()
    if not client_id or not api_key:
        raise ValueError("IMA credentials: Client ID and API Key are required")
    return {"client_id": client_id, "api_key": api_key}


def upsert_ima_connector(
    services: Any,
    user_id: int,
    creds: dict[str, str],
    *,
    instance_id: str = "",
) -> str:
    repo = services.connector_repo
    secret = services.secret_repo
    payload = validate_create_credentials(IMA_KIND, dict(creds))
    stored_id = instance_id.strip()
    if stored_id:
        row = repo.get(stored_id)
        if row is None or row.kind != IMA_KIND:
            raise ValueError("IMA credentials: connector not found")
        if int(row.user_id) != int(user_id):
            raise PermissionError("not your IMA connector")
    else:
        stored_id = _matching_ima_instance_id(services, user_id, str(creds.get("client_id") or ""))
        if not stored_id:
            stored_id = new_ulid()
            repo.create(
                instance_id=stored_id,
                user_id=user_id,
                kind=IMA_KIND,
                display_name=_unique_display_name(repo, user_id),
                mcp_server_name=mcp_server_name(IMA_KIND, stored_id),
                config_json=build_instance_config_json(
                    kind=IMA_KIND,
                    description="IMA Agent Interface knowledge mount",
                ),
            )
    repo.upsert_credentials(
        instance_id=stored_id,
        blob=encrypt_credentials(secret, payload),
    )
    return stored_id


def list_knowledge_bases(
    creds: dict[str, Any],
    *,
    query: str = "",
    cursor: str = "",
    limit: int = 20,
) -> dict[str, Any]:
    # Official ima-skill 1.1.9: search_knowledge_base limit is 1–20.
    limit = max(1, min(int(limit or 20), 20))
    try:
        data = openapi_data(
            creds,
            "openapi/wiki/v1/search_knowledge_base",
            {"query": query, "cursor": cursor, "limit": limit},
        )
    except ValueError as exc:
        raise ValueError(f"IMA API: {exc}") from exc
    items, next_cursor, is_end = parse_knowledge_bases(data)
    _hydrate_knowledge_bases(creds, items)
    return {"items": items, "next_cursor": next_cursor, "is_end": is_end}


def list_knowledge_documents(
    creds: dict[str, Any],
    knowledge_base_id: str,
    *,
    folder_id: str = "",
    cursor: str = "",
    limit: int = 20,
    query: str = "",
) -> dict[str, Any]:
    kb_id = knowledge_base_id.strip()
    if not kb_id:
        raise ValueError("IMA API: knowledge_base_id is required")
    limit = max(1, min(int(limit or 20), 50))
    folder = folder_id.strip()
    q = query.strip()
    try:
        if q:
            data = openapi_data(
                creds,
                "openapi/wiki/v1/search_knowledge",
                {"query": q, "knowledge_base_id": kb_id, "cursor": cursor},
            )
        else:
            body: dict[str, Any] = {
                "knowledge_base_id": kb_id,
                "cursor": cursor,
                "limit": limit,
            }
            if folder:
                body["folder_id"] = folder
            data = openapi_data(creds, "openapi/wiki/v1/get_knowledge_list", body)
    except ValueError as exc:
        raise ValueError(f"IMA API: {exc}") from exc
    items, folders, current_path, next_cursor, is_end = parse_knowledge_list(data)
    return {
        "items": items,
        "folders": folders,
        "current_path": current_path,
        "next_cursor": next_cursor,
        "is_end": is_end,
        "knowledge_base_id": kb_id,
        "folder_id": "" if q else folder,
        "query": q,
    }


def search_selected_knowledge(
    creds: dict[str, Any],
    query: str,
    selected_bases: list[dict[str, str]] | tuple[dict[str, str], ...],
    selected_docs: list[dict[str, str]] | tuple[dict[str, str], ...],
    *,
    limit_per_base: int = 8,
) -> list[dict[str, str]]:
    """Search official IMA knowledge for the user's persisted selection."""
    q = query.strip()
    if not q:
        return []
    names: dict[str, str] = {}
    kb_ids: list[str] = []
    allow: dict[str, set[str]] = {}
    for base in selected_bases:
        kid = str(base.get("id") or "").strip()
        if not kid:
            continue
        kb_ids.append(kid)
        names[kid] = str(base.get("name") or kid).strip() or kid
    for doc in selected_docs:
        kid = str(doc.get("knowledge_base_id") or "").strip()
        media_id = str(doc.get("media_id") or "").strip()
        if not kid or not media_id:
            continue
        if kid not in names:
            kb_ids.append(kid)
            names[kid] = str(doc.get("knowledge_base_name") or kid).strip() or kid
        allow.setdefault(kid, set()).add(media_id)
    seen: set[str] = set()
    passages: list[dict[str, str]] = []
    for kb_id in kb_ids:
        if kb_id in seen:
            continue
        seen.add(kb_id)
        try:
            data = openapi_data(
                creds,
                "openapi/wiki/v1/search_knowledge",
                {"query": q, "knowledge_base_id": kb_id, "cursor": ""},
            )
        except ValueError:
            continue
        allowed = allow.get(kb_id)
        added = 0
        for item in _as_dicts(data.get("info_list") or data.get("knowledge_list")):
            media_id = str(item.get("media_id") or "").strip()
            if not media_id or _is_folder_entry(item):
                continue
            if allowed is not None and media_id not in allowed:
                continue
            text = str(item.get("highlight_content") or item.get("title") or "").strip()
            if not text:
                continue
            passages.append(
                {
                    "knowledge_base_id": kb_id,
                    "knowledge_base_name": names.get(kb_id, kb_id),
                    "media_id": media_id,
                    "title": str(item.get("title") or media_id).strip() or media_id,
                    "text": text,
                }
            )
            added += 1
            if added >= limit_per_base:
                break
    return passages


def parse_knowledge_bases(data: dict[str, Any]) -> tuple[list[dict[str, str]], str, bool]:
    raw = (
        data.get("info_list")
        or data.get("knowledge_base_list")
        or data.get("addable_knowledge_base_list")
        or []
    )
    items: list[dict[str, str]] = []
    for item in _as_dicts(raw):
        kid = str(item.get("id") or item.get("knowledge_base_id") or "").strip()
        if not kid:
            continue
        items.append(
            {
                "id": kid,
                "name": str(item.get("name") or kid).strip() or kid,
                "cover_url": str(item.get("cover_url") or ""),
                "description": str(item.get("description") or ""),
            }
        )
    return items, _next_cursor(data), _is_end(data)


def parse_knowledge_list(
    data: dict[str, Any],
) -> tuple[list[dict[str, str]], list[dict[str, Any]], list[dict[str, Any]], str, bool]:
    docs: list[dict[str, str]] = []
    folders: list[dict[str, Any]] = []
    seen_folders: set[str] = set()
    for item in _as_dicts(data.get("knowledge_list") or data.get("info_list")):
        if _is_folder_entry(item):
            folder_id = _folder_id_of(item)
            if folder_id and folder_id not in seen_folders:
                seen_folders.add(folder_id)
                folders.append(_folder_item(item, folder_id))
            continue
        media_id = str(item.get("media_id") or "").strip()
        if media_id:
            docs.append(
                {
                    "media_id": media_id,
                    "title": str(item.get("title") or item.get("name") or media_id).strip()
                    or media_id,
                    "parent_folder_id": str(item.get("parent_folder_id") or ""),
                }
            )
    for item in _as_dicts(data.get("folder_list") or data.get("folders")):
        folder_id = _folder_id_of(item)
        if folder_id and folder_id not in seen_folders:
            seen_folders.add(folder_id)
            folders.append(_folder_item(item, folder_id))
    path = [
        _folder_item(item, fid)
        for item in _as_dicts(data.get("current_path"))
        if (fid := _folder_id_of(item))
    ]
    return docs, folders, path, _next_cursor(data), _is_end(data)


def _folder_item(item: dict[str, Any], folder_id: str) -> dict[str, Any]:
    nested = item.get("folder_info")
    src = nested if isinstance(nested, dict) else item
    return {
        "folder_id": folder_id,
        "name": str(src.get("name") or item.get("title") or item.get("name") or folder_id).strip()
        or folder_id,
        "parent_folder_id": str(src.get("parent_folder_id") or item.get("parent_folder_id") or ""),
        "file_number": int(src.get("file_number") or item.get("file_number") or 0),
        "folder_number": int(src.get("folder_number") or item.get("folder_number") or 0),
        "is_folder": True,
    }


def _folder_id_of(item: dict[str, Any]) -> str:
    nested = item.get("folder_info")
    if isinstance(nested, dict):
        nested_id = str(nested.get("folder_id") or nested.get("id") or "").strip()
        if nested_id:
            return nested_id
    folder_id = str(item.get("folder_id") or item.get("id") or "").strip()
    if folder_id.startswith("folder_") or (
        folder_id and not str(item.get("media_id") or "").strip()
    ):
        return folder_id
    media_id = str(item.get("media_id") or "").strip()
    if media_id.startswith("folder_"):
        return media_id
    return folder_id if folder_id.startswith("folder_") else ""


def _is_folder_entry(item: dict[str, Any]) -> bool:
    """Official lists mix files and folders; folders use ``folder_`` ids."""
    media_id = str(item.get("media_id") or "").strip()
    if media_id.startswith("folder_"):
        return True
    if item.get("is_folder") is True:
        return True
    if isinstance(item.get("folder_info"), dict):
        return True
    folder_id = str(item.get("folder_id") or "").strip()
    return bool(folder_id and not media_id)


def _hydrate_knowledge_bases(creds: dict[str, Any], items: list[dict[str, str]]) -> None:
    ids = [item["id"] for item in items if item.get("id")]
    if not ids:
        return
    try:
        data = openapi_data(creds, "openapi/wiki/v1/get_knowledge_base", {"ids": ids[:20]})
    except ValueError:
        return
    infos = data.get("infos")
    if not isinstance(infos, dict):
        return
    by_id = {str(key): value for key, value in infos.items() if isinstance(value, dict)}
    for item in items:
        info = by_id.get(item["id"])
        if info is None:
            continue
        name = str(info.get("name") or "").strip()
        if name:
            item["name"] = name
        item["cover_url"] = str(info.get("cover_url") or item.get("cover_url") or "")
        item["description"] = str(info.get("description") or item.get("description") or "")


def _as_dicts(raw: object) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    return [item for item in raw if isinstance(item, dict)]


def _next_cursor(data: dict[str, Any]) -> str:
    return str(data.get("next_cursor") or "")


def _is_end(data: dict[str, Any]) -> bool:
    if "is_end" in data:
        return bool(data.get("is_end"))
    return not bool(data.get("next_cursor"))


def _first_ima_instance_id(services: Any, user_id: int) -> str:
    summaries = list_ima_connector_summaries(services, user_id)
    return summaries[0]["instance_id"] if summaries else ""


def _matching_ima_instance_id(services: Any, user_id: int, client_id: str) -> str:
    owned = [row for row in services.connector_repo.list_by_user(user_id) if row.kind == IMA_KIND]
    if client_id:
        secret = services.secret_repo
        for row in owned:
            if not row.credential_blob:
                continue
            old = decrypt_credentials(secret, row.credential_blob)
            if str(old.get("client_id") or "").strip() == client_id:
                return str(row.instance_id)
    if len(owned) == 1:
        return str(owned[0].instance_id)
    return ""


def _unique_display_name(repo: Any, user_id: int) -> str:
    if not repo.name_exists(user_id, IMA_DISPLAY_NAME):
        return IMA_DISPLAY_NAME
    for index in range(2, 20):
        candidate = f"{IMA_DISPLAY_NAME} {index}"
        if not repo.name_exists(user_id, candidate):
            return candidate
    return f"{IMA_DISPLAY_NAME} {new_ulid()[-4:]}"


def _preview_from_row(services: Any, row: Any) -> str:
    secret = getattr(services, "secret_repo", None)
    if secret is None or not row.credential_blob:
        return ""
    try:
        raw = decrypt_credentials(secret, row.credential_blob)
    except Exception:
        return ""
    return preview_client_id(str(raw.get("client_id") or ""))
