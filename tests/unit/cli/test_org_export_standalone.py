"""``freeos org export-standalone`` writes the shared org-ui seam."""

from __future__ import annotations

import json
from pathlib import Path

from click.testing import CliRunner

from octop.cli.main import cli


def test_export_standalone_lists_shared_org_ui_modules(tmp_path: Path) -> None:
    out = tmp_path / "openxyos-web"
    runner = CliRunner()
    result = runner.invoke(cli, ["org", "export-standalone", "--out", str(out)])
    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["modules"] == [
        "announcements",
        "organization",
        "employees",
        "governance",
    ]
    modules = json.loads((out / "src" / "modules.json").read_text(encoding="utf-8"))
    assert modules["shared_org_ui_modules"] == [
        "announcements",
        "organization",
        "employees",
        "governance",
    ]
    assert modules["pages"]["announcements"]["component"] == "AnnouncementPage"
    assert modules["pages"]["announcements"]["embedded_route"] == "/organization/announcements"
    assert modules["pages"]["organization"]["component"] == "OrgChartPage"
    assert modules["pages"]["organization"]["embedded_route"] == "/organization/org"
    assert modules["pages"]["employees"]["component"] == "EmployeesPage"
    assert modules["pages"]["employees"]["embedded_route"] == "/organization/employees"
    assert modules["pages"]["employees"]["api"] == "/api/org-module/org/employees"
    assert modules["pages"]["governance"]["component"] == "GovernancePage"
    assert modules["pages"]["governance"]["embedded_route"] == "/organization/governance"
    assert modules["pages"]["governance"]["api"] == "/api/org-module/governance"
    app = (out / "src" / "App.tsx").read_text(encoding="utf-8")
    assert "AnnouncementPage" in app
    assert "OrgChartPage" in app
    assert "EmployeesPage" in app
    assert "EmployeeDetailPage" in app
    assert "GovernancePage" in app
    assert 'from "org-ui"' in app
    readme = (out / "README.md").read_text(encoding="utf-8")
    assert "Phase 5" in readme
    assert "AnnouncementPage" in readme
    assert "OrgChartPage" in readme
    assert "EmployeesPage" in readme
    assert "GovernancePage" in readme
