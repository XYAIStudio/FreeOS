"""OpenAPI metadata for Scalar API docs."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

from octop.api.deps import is_jwt_exempt_path

API_DESCRIPTION = """\
**FreeOS** is a self-hosted multi-agent assistant. All routes are served under `/api`.

## Authentication

Most endpoints require a JWT bearer token:

1. On desktop or loopback first launch, `POST /api/auth/local-session` issues a
   guest JWT so the UI can open without a login wall. Register later via
   `POST /api/auth/register` when a save needs an account.
2. Complete the optional setup wizard via `/api/setup/*` when a remote install
   still has no users. Desktop (`OCTOP_DESKTOP`) auto-binds local SQLite and
   provisions the guest session, so that wizard is skipped; the UI may still
   offer a one-step model / API-key screen.
3. `POST /api/auth/login` with `username` and `password`, or complete the OIDC flow
   with `/api/auth/oidc/start` and `/api/auth/oidc/exchange` when SSO is enabled.
4. Send `Authorization: Bearer <access_token>` on subsequent requests.

Access tokens use sliding renewal: when less than one-third of
`access_token_ttl_seconds` remains, authenticated responses may include a fresh
token in the `X-Octop-Access-Token` header. Clients should replace the stored
token when present.

Public endpoints (no token): `/api/docs`, `/api/openapi.json`, `/api/health`,
`/api/setup/*`, `/api/auth/login`, `/api/auth/local-session`, `/api/auth/oidc/status`, `/api/auth/oidc/start`,
`/api/auth/oidc/callback`, `/api/auth/oidc/exchange`, `/api/auth/invite/validate`,
`/api/auth/invite/redeem`, `/api/connectors/oauth/callback`,
and `/api/internal/mcp/*`.

## Agent scope

Many agent-scoped routes use the agent ID in the URL path (`/api/agents/{agent_id}/…`).
The caller must own the agent unless they are an admin.

## Streaming chat

Dashboard live turns use **WebSocket** at `/api/agents/{agent_id}/chat/ws` (pass JWT as
`?token=` query param). Send `{"type":"user_turn", ...}` frames; the server replies with JSON
chunks matching the harness stream format, ending with `{"type":"done"}` or
`{"type":"error","message":"..."}`.

Text-type dashboard pushes (cron reminders, proactive care) also emit
`{"type":"dashboard_push", ...}` on `/api/notifications/ws` (same `?token=` auth) so the
SPA can show a toast even when the chat socket is not subscribed.

HITL resume still uses `POST /api/agents/{agent_id}/chat/hitl/resume` (SSE).
"""

OPENAPI_TAGS: list[dict[str, str]] = [
    {
        "name": "setup",
        "description": "First-run wizard: create the admin user and optional LLM provider.",
    },
    {"name": "auth", "description": "Sign in, sign out, and manage the current user profile."},
    {"name": "health", "description": "Liveness probe for load balancers and monitoring."},
    {"name": "users", "description": "Admin user management (create, disable, reset passwords)."},
    {
        "name": "agents",
        "description": "Create and configure AI agents; start, stop, and inspect runtime status.",
    },
    {
        "name": "chat",
        "description": "Dashboard chat: WebSocket streaming, threads, conversation history, trajectory ledger, and text-push toasts.",
    },
    {
        "name": "slash",
        "description": "Slash command metadata for composer menus and inline help.",
    },
    {
        "name": "connectors",
        "description": "Third-party integrations (Notion, Figma, …) exposed as MCP servers.",
    },
    {
        "name": "knowledge",
        "description": "Private, shareable document knowledge bases and their indexing capability.",
    },
    {
        "name": "projects",
        "description": "User projects grouping conversations, tasks, and an optional work directory.",
    },
    {
        "name": "local-models",
        "description": "Desktop hardware scan, local LLM discovery (Ollama / GGUF), speed test, and default-model selection.",
    },
    {
        "name": "internal-mcp",
        "description": "Internal MCP gateway used by harness agents (no dashboard auth).",
    },
    {
        "name": "channels",
        "description": "Instant-messaging bridges (WeCom, Feishu, Telegram, …) per agent.",
    },
    {
        "name": "cron",
        "description": "Scheduled prompts that run against an agent on a cron trigger.",
    },
    {
        "name": "settings",
        "description": "Process-level settings (timezone, upload size limit from config.json).",
    },
    {
        "name": "envs",
        "description": "Global environment variables (~/.octop/env) inherited by every agent.",
    },
    {
        "name": "search",
        "description": "Web-search provider API key probes (Tavily, Brave, Google, Kimi).",
    },
    {"name": "providers", "description": "LLM provider configuration and active model selection."},
    {"name": "voice", "description": "Speech-to-text and text-to-speech provider configuration."},
    {
        "name": "observability",
        "description": "LLM observability integrations (Langfuse tracing).",
    },
    {
        "name": "tls",
        "description": "Let's Encrypt HTTPS certificate issuance and status.",
    },
    {
        "name": "security",
        "description": "Agent security policy: tool approval (HITL), command guard rules, filesystem rules, PII redaction.",
    },
    {"name": "admin", "description": "Server-wide admin operations (audit log, storage, usage)."},
    {"name": "storage-backends", "description": "User-visible remote storage backend connections."},
    {
        "name": "filesystem",
        "description": "Host filesystem directory browsing for dashboard forms.",
    },
    {"name": "mbti", "description": "MBTI persona presets applied to agent personality."},
    {"name": "experts", "description": "Bundled expert templates for creating specialized agents."},
    {"name": "workspace", "description": "Agent workspace file tree: list, read, write, upload."},
    {"name": "agent_files", "description": "Agent-owned configuration files (SOUL.md, skills, …)."},
    {"name": "usage", "description": "Token usage summaries for billing and dashboards."},
    {
        "name": "skill-packages",
        "description": "Instance-global skill package catalog and package skill content.",
    },
    {
        "name": "host-apps",
        "description": "Read-only scan of local AI desktop apps (Claude, Codex, Cursor, WorkBuddy, …) and import of their skills / plugins / MCP into FreeOS.",
    },
    {"name": "skills", "description": "Per-agent skills and Skill Hub marketplace search."},
    {
        "name": "subagents",
        "description": "Per-agent subagent definitions (agents/*.md) and bundled catalog install.",
    },
    {"name": "terminal", "description": "AI-assisted remote terminal sessions."},
    {
        "name": "update",
        "description": "In-place FreeOS update checks against XYAIStudio/FreeOS GitHub Releases.",
    },
    {
        "name": "org-module",
        "description": "Organization OS: FreeOS data plane ↔ openXYOS control plane, in-host announcements, org chart, employees, skills, agents, governance, knowledge, tasks, reflections, and settings, sidecar, and growth loop.",
    },
    {
        "name": "browser",
        "description": "Remote browser: env/install, harness sessions, live stream, record/replay.",
    },
    {
        "name": "mobile",
        "description": "Remote Phone stream and adb control (mobile permission).",
    },
    {
        "name": "desktop",
        "description": "Remote OS desktop stream and input injection (admin only).",
    },
    {"name": "ollama", "description": "Local Ollama model discovery and download management."},
    {
        "name": "onnx",
        "description": "Local ONNX / fastembed embedding service: enable, catalog, and download.",
    },
]

_BEARER_SCHEME = {
    "type": "http",
    "scheme": "bearer",
    "bearerFormat": "JWT",
    "description": "JWT from `POST /api/auth/login` (`access_token` field).",
}


def uniquify_operation_ids(schema: dict[str, Any]) -> dict[str, Any]:
    """Give each HTTP method its own operationId (FastAPI reuses the function name)."""
    seen: set[str] = set()
    for path_item in schema.get("paths", {}).values():
        if not isinstance(path_item, dict):
            continue
        for method, operation in path_item.items():
            if not isinstance(operation, dict):
                continue
            op_id = operation.get("operationId")
            if not isinstance(op_id, str) or not op_id:
                continue
            unique = op_id if op_id not in seen else f"{op_id}_{method.lower()}"
            seen.add(unique)
            operation["operationId"] = unique
    return schema


def configure_openapi(app: FastAPI) -> None:
    """Attach tag descriptions, API intro, and Bearer security to the OpenAPI schema."""

    def custom_openapi() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema

        schema = get_openapi(
            title=app.title,
            version=app.version,
            description=API_DESCRIPTION,
            routes=app.routes,
            tags=OPENAPI_TAGS,
        )
        components = schema.setdefault("components", {})
        components.setdefault("securitySchemes", {})["BearerAuth"] = _BEARER_SCHEME
        uniquify_operation_ids(schema)

        for path, path_item in schema.get("paths", {}).items():
            if not path.startswith("/api/") or is_jwt_exempt_path(path):
                continue
            if not isinstance(path_item, dict):
                continue
            for operation in path_item.values():
                if isinstance(operation, dict) and "security" not in operation:
                    operation["security"] = [{"BearerAuth": []}]

        app.openapi_schema = schema
        return schema

    app.openapi = custom_openapi  # type: ignore[method-assign]
