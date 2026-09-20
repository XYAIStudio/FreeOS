"""In-host Organization workspace overview is a catalog/org-ui seam only."""

from __future__ import annotations

from octop.modules.org_os.catalog import catalog_with_host_delivery
from octop.modules.org_os.contract import (
    SHARED_ORG_UI_MODULES,
    assert_shared_modules_in_catalog,
)


def test_shared_workspace_module_is_in_catalog() -> None:
    assert "workspace" in SHARED_ORG_UI_MODULES
    assert "chat" not in SHARED_ORG_UI_MODULES
    assert_shared_modules_in_catalog()
    overlay = catalog_with_host_delivery()
    workspace = next(row for row in overlay if row["key"] == "workspace")
    assert workspace["host_path"] == "/organization/workspace"
    employees = next(row for row in overlay if row["key"] == "employees")
    assert employees["host_path"] == "/organization/employees"
    assert employees["delivery"] == "org_ui_slice"
