"""HTTP reverse-proxy helpers for the openXYOS sidecar."""

from __future__ import annotations

from collections.abc import AsyncIterator, Mapping
from typing import TYPE_CHECKING, Any
from urllib.parse import quote

if TYPE_CHECKING:
    from fastapi import Request, Response
    from fastapi.responses import StreamingResponse

_HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
}
# Studio cookies / JWT must not become the organization-room session.
_STRIP_INCOMING = _HOP_BY_HOP | {"authorization", "cookie", "cookie2"}


def sidecar_target(base_url: str, path: str, query: str = "") -> str:
    """Join sidecar origin with a proxied path (no ``..`` segments)."""
    parts = [p for p in path.split("/") if p and p != "."]
    if any(p == ".." for p in parts):
        raise ValueError("refusing path traversal")
    suffix = "/".join(quote(p, safe="") for p in parts)
    url = f"{base_url.rstrip('/')}/{suffix}" if suffix else base_url.rstrip("/")
    if query:
        url = f"{url}?{query}"
    return url


def identity_headers(user: Any, *, tenant_id: str | None = None) -> dict[str, str]:
    """Map a FreeOS/Octop user onto sidecar request headers (MVP, not SSO).

    Studio guests keep a host session; they must not appear as organization-room
    admins. Room roles travel in ``organization_role`` after a real org login.
    """
    headers: dict[str, str] = {}
    if user is not None:
        username = getattr(user, "username", None) or getattr(user, "uname", None)
        user_id = getattr(user, "id", None)
        org_user_id = getattr(user, "organization_user_id", None)
        if username:
            headers["X-FreeOS-User"] = str(username)
        if user_id is not None:
            headers["X-FreeOS-User-Id"] = str(user_id)
        role = str(getattr(user, "organization_role", None) or "user") if org_user_id else "guest"
        headers["X-FreeOS-Role"] = role
        user_tenant = getattr(user, "tenant_id", None) or getattr(user, "organization_id", None)
        if user_tenant is not None and str(user_tenant).strip():
            headers["X-FreeOS-Tenant-Id"] = str(user_tenant)
    if tenant_id and str(tenant_id).strip():
        headers["X-FreeOS-Tenant-Id"] = str(tenant_id).strip()
    return headers


def _filter_request_headers(
    incoming: Mapping[str, str], extra: Mapping[str, str]
) -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in incoming.items():
        lowered = key.lower()
        if lowered in _STRIP_INCOMING or lowered.startswith("x-freeos-"):
            # Sidecar has its own login; do not forward FreeOS JWT, cookies,
            # or host identity headers from the dashboard origin.
            continue
        out[key] = value
    out.update(extra)
    return out


async def proxy_request(
    request: Request,
    *,
    base_url: str,
    path: str,
    extra_headers: Mapping[str, str] | None = None,
    timeout: float = 30.0,
) -> Response:
    """Stream a request to the sidecar and return the upstream response."""
    import httpx
    from fastapi import Response

    target = sidecar_target(base_url, path, request.url.query)
    headers = _filter_request_headers(request.headers, extra_headers or {})
    body = await request.body()
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        upstream = await client.request(
            request.method,
            target,
            headers=headers,
            content=body or None,
        )
    response_headers = {
        key: value for key, value in upstream.headers.items() if key.lower() not in _HOP_BY_HOP
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )


async def iter_upstream(response: Any) -> AsyncIterator[bytes]:
    async for chunk in response.aiter_bytes():
        yield chunk


def streaming_response(upstream: Any) -> StreamingResponse:
    from fastapi.responses import StreamingResponse

    headers = {
        key: value for key, value in upstream.headers.items() if key.lower() not in _HOP_BY_HOP
    }
    return StreamingResponse(
        iter_upstream(upstream),
        status_code=upstream.status_code,
        headers=headers,
        media_type=upstream.headers.get("content-type"),
    )
