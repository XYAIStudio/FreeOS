"""Map openXYOS catalog keys to real sidecar /api routes.

Paths are relative to the sidecar origin (or the FreeOS BFF prefix
``/api/org-module/sidecar``). Risk tags drive the governance gate.
"""

from __future__ import annotations

from typing import TypedDict


class ModuleEndpoint(TypedDict):
    method: str
    path: str
    summary: str
    risk: str


MODULE_ENDPOINTS: dict[str, tuple[ModuleEndpoint, ...]] = {
    "workspace": (
        {
            "method": "GET",
            "path": "/api/dashboard",
            "summary": "Organization operations overview",
            "risk": "low",
        },
    ),
    "announcements": (
        {
            "method": "GET",
            "path": "/api/announcements",
            "summary": "List notices",
            "risk": "low",
        },
        {
            "method": "POST",
            "path": "/api/announcements",
            "summary": "Publish a notice",
            "risk": "outbound",
        },
    ),
    "organization": (
        {
            "method": "GET",
            "path": "/api/org",
            "summary": "Org tree, groups, departments",
            "risk": "low",
        },
    ),
    "employees": (
        {
            "method": "GET",
            "path": "/api/employees",
            "summary": "List people and AI employees",
            "risk": "low",
        },
        {
            "method": "POST",
            "path": "/api/employees",
            "summary": "Create an employee record",
            "risk": "prod",
        },
        {
            "method": "DELETE",
            "path": "/api/employees/{id}",
            "summary": "Delete an employee record",
            "risk": "delete",
        },
        {
            "method": "GET",
            "path": "/api/talent",
            "summary": "Talent market listings",
            "risk": "low",
        },
    ),
    "skills": (
        {
            "method": "GET",
            "path": "/api/skills",
            "summary": "Control-plane skill catalog",
            "risk": "low",
        },
        {
            "method": "POST",
            "path": "/api/plugins",
            "summary": "Register a tenant-toggleable plugin",
            "risk": "prod",
        },
    ),
    "chat": (
        {
            "method": "GET",
            "path": "/api/chats",
            "summary": "List control-plane rooms (do not replace Octop chat)",
            "risk": "low",
        },
    ),
    "agents": (
        {
            "method": "GET",
            "path": "/api/ai",
            "summary": "Advisor agents / studio listing",
            "risk": "low",
        },
    ),
    "tasks": (
        {
            "method": "GET",
            "path": "/api/tasks",
            "summary": "List tasks",
            "risk": "low",
        },
        {
            "method": "POST",
            "path": "/api/tasks",
            "summary": "Create a task",
            "risk": "prod",
        },
        {
            "method": "DELETE",
            "path": "/api/tasks/{id}",
            "summary": "Delete a task",
            "risk": "delete",
        },
    ),
    "knowledge": (
        {
            "method": "GET",
            "path": "/api/knowledge",
            "summary": "List knowledge documents",
            "risk": "low",
        },
        {
            "method": "POST",
            "path": "/api/knowledge",
            "summary": "Upload / create a knowledge document",
            "risk": "prod",
        },
    ),
    "reflections": (
        {
            "method": "GET",
            "path": "/api/reflections",
            "summary": "List retrospectives",
            "risk": "low",
        },
        {
            "method": "POST",
            "path": "/api/reflections",
            "summary": "Capture a reflection",
            "risk": "prod",
        },
    ),
    "governance": (
        {
            "method": "GET",
            "path": "/api/governance/stats",
            "summary": "Governance overview",
            "risk": "low",
        },
        {
            "method": "GET",
            "path": "/api/governance/permissions",
            "summary": "Permission matrix",
            "risk": "low",
        },
        {
            "method": "POST",
            "path": "/api/governance/validate",
            "summary": "Validate an action against the matrix",
            "risk": "low",
        },
        {
            "method": "POST",
            "path": "/api/governance/permissions",
            "summary": "Replace permission rules (admin)",
            "risk": "prod",
        },
    ),
    "settings": (
        {
            "method": "GET",
            "path": "/api/module-settings",
            "summary": "Tenant module toggles",
            "risk": "low",
        },
        {
            "method": "PUT",
            "path": "/api/module-settings",
            "summary": "Update tenant module toggles",
            "risk": "prod",
        },
        {
            "method": "GET",
            "path": "/api/settings",
            "summary": "Tenant settings",
            "risk": "low",
        },
    ),
}


def endpoints_for(module_key: str) -> tuple[ModuleEndpoint, ...]:
    return MODULE_ENDPOINTS.get(module_key, ())
