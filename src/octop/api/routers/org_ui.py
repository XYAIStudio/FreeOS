"""Same-origin delivery of the complete organization application."""

from __future__ import annotations

import asyncio
from contextlib import suppress
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Request, Response, WebSocket, WebSocketDisconnect
from websockets.typing import Subprotocol

from octop.infra.errors import ErrorCode, OctopError
from octop.modules.org_os.integration import integrated_organization
from octop.modules.org_os.proxy import proxy_request
from octop.modules.org_os.service import org_module_from_paths

router = APIRouter()


async def _organization_ui(request: Request, path: str) -> Response:
    if not integrated_organization():
        raise OctopError(ErrorCode.NOT_FOUND, "organization integration is disabled", status=404)
    server = request.app.state.octop_server
    try:
        return await proxy_request(
            request,
            base_url=org_module_from_paths(server.paths).sidecar_url(),
            path=path,
            timeout=60,
        )
    except httpx.HTTPError as exc:
        raise OctopError(
            ErrorCode.INTERNAL_ERROR, "organization application unavailable", status=503
        ) from exc


@router.get("/organization-app", include_in_schema=False)
async def organization_root(request: Request) -> Response:
    return await _organization_ui(request, "")


@router.get("/organization-app/{path:path}", include_in_schema=False)
async def organization_page(path: str, request: Request) -> Response:
    return await _organization_ui(request, path)


@router.websocket("/organization-app/ws")
async def organization_websocket(websocket: WebSocket) -> None:
    """Keep the organization real-time protocol on the FreeOS origin.

    The Node service still validates its signed organization token.  FreeOS
    only bridges frames to its private loopback process, so a browser never
    learns the sidecar port.
    """
    from websockets.asyncio.client import connect  # noqa: PLC0415

    server = websocket.app.state.octop_server
    if not integrated_organization():
        await websocket.close(code=4404, reason="organization integration is disabled")
        return
    offered = [
        Subprotocol(item.strip())
        for item in websocket.headers.get("sec-websocket-protocol", "").split(",")
        if item.strip()
    ]
    if not any(
        item.startswith("xyos-auth.") or item.startswith("xyos-ws-ticket.") for item in offered
    ):
        await websocket.close(code=4401, reason="organization authentication required")
        return
    base = org_module_from_paths(server.paths).sidecar_url()
    parsed = urlparse(base)
    scheme = "wss" if parsed.scheme == "https" else "ws"
    upstream_url = f"{scheme}://{parsed.netloc}/ws"
    try:
        async with connect(upstream_url, subprotocols=offered, open_timeout=10) as upstream:
            await websocket.accept(subprotocol=upstream.subprotocol)

            async def client_to_upstream() -> None:
                while True:
                    frame = await websocket.receive()
                    if frame.get("type") == "websocket.disconnect":
                        return
                    payload = frame.get("text")
                    await upstream.send(payload if payload is not None else frame.get("bytes", b""))

            async def upstream_to_client() -> None:
                async for payload in upstream:
                    if isinstance(payload, bytes):
                        await websocket.send_bytes(payload)
                    else:
                        await websocket.send_text(payload)

            tasks = [
                asyncio.create_task(client_to_upstream()),
                asyncio.create_task(upstream_to_client()),
            ]
            _done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for task in pending:
                task.cancel()
            for task in pending:
                with suppress(asyncio.CancelledError):
                    await task
    except (OSError, TimeoutError):
        await websocket.close(code=1013, reason="organization service unavailable")
    except WebSocketDisconnect:
        return
