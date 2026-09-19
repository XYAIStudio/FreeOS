"""Shared org-ui / org-contract keys (Phase 2 seam; not a separate package yet)."""

from __future__ import annotations

from octop.modules.org_os.catalog import catalog_keys

# Pages extracted into dashboard/src/org-ui and listed by export-standalone.
SHARED_ORG_UI_MODULES: tuple[str, ...] = (
    "announcements",
    "organization",
    "employees",
    "skills",
    "governance",
    "knowledge",
    "tasks",
    "reflections",
    "settings",
)


def shared_org_ui_modules() -> list[str]:
    return list(SHARED_ORG_UI_MODULES)


def assert_shared_modules_in_catalog() -> None:
    keys = set(catalog_keys())
    missing = [key for key in SHARED_ORG_UI_MODULES if key not in keys]
    if missing:
        raise ValueError(f"shared org-ui modules missing from catalog: {missing}")
