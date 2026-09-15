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


def identity_headers(user: Any) -> dict[str, str]:
    """Map a FreeOS/Octop user onto sidecar request headers (MVP, not SSO)."""
    headers: dict[str, str] = {}
    if user is None:
        return headers
    username = getattr(user, "username", None) or getattr(user, "uname", None)
    user_id = getattr(user, "id", None)
    role = getattr(user, "role", None)
    if username:
        headers["X-FreeOS-User"] = str(username)
    if user_id is not None:
        headers["X-FreeOS-User-Id"] = str(user_id)
    if role:
        headers["X-FreeOS-Role"] = str(role)
    return headers


def _filter_request_headers(
    incoming: Mapping[str, str], extra: Mapping[str, str]
) -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in incoming.items():
        if key.lower() in _HOP_BY_HOP or key.lower() == "authorization":
            # Sidecar has its own session; do not forward the FreeOS JWT.
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
