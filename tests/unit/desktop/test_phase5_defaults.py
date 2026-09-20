"""Phase 5: default install is one FreeOS process; sidecar stays opt-in."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[3]


def test_package_scripts_default_skip_org_sidecar() -> None:
    package = (REPO / "desktop" / "portable" / "package.sh").read_text(encoding="utf-8")
    assert "SHIP_OPENXYOS_RUNTIME:-0" in package or '"${SHIP_OPENXYOS_RUNTIME:-0}"' in package
    assert "SKIP_ORG_SIDECAR:-1" in package or "SKIP_ORG_SIDECAR=1" in package
    task = (REPO / "desktop" / "src" / "build" / "windows" / "Taskfile.yml").read_text(
        encoding="utf-8"
    )
    assert 'SHIP_OPENXYOS_RUNTIME | default "0"' in task
    workflow = (REPO / ".github" / "workflows" / "octop-desktop.yml").read_text(encoding="utf-8")
    assert 'SKIP_ORG_SIDECAR: "0"' in workflow
    assert "SHIP_OPENXYOS_RUNTIME=1" in workflow
    assert "transitional" in workflow.lower()
    assert "must not embed org-sidecar" not in workflow


def test_nsis_default_macro_does_not_create_openxyos_dir() -> None:
    nsh = (REPO / "desktop" / "src" / "build" / "windows" / "nsis" / "wails_tools.nsh").read_text(
        encoding="utf-8"
    )
    provision = nsh[
        nsh.index("!macro wails.provisionOpenXYOS") : nsh.index("!macro wails.openxyosFailDetail")
    ]
    assert "nsExec::Exec" not in provision
    assert "Abort" not in provision
    absent = provision[provision.index("OPENXYOS_OPTIONAL_ABSENT") :]
    assert "CreateDirectory" not in absent
    assert 'File "/oname=openxyos-runtime.zip"' not in absent


def test_docs_do_not_require_bundled_openxyos() -> None:
    readme_cn = (REPO / "README_CN.md").read_text(encoding="utf-8")
    assert "内置 openXYOS" not in readme_cn
    assert "宿主内 Organization" in readme_cn
    assert "docs/org-export.md" in readme_cn
    readme = (REPO / "README.md").read_text(encoding="utf-8")
    assert "docs/org-export.md" in readme
    assert "FREEOS_ORG_SIDECAR=1" in readme
    desktop = (REPO / "desktop" / "README.md").read_text(encoding="utf-8")
    assert "including the sidecar" not in desktop
    assert "with openXYOS" not in desktop
    assert "SHIP_OPENXYOS_RUNTIME=1" in desktop
    export_doc = (REPO / "docs" / "org-export.md").read_text(encoding="utf-8")
    assert "**不** 捆绑 Node" in export_doc
    assert "不** 自动拉起 openXYOS" in export_doc
    assert "Phase 5" in export_doc
    plan = (REPO / "docs" / "org-merge-plan.md").read_text(encoding="utf-8")
    assert "Phase 5 默认安装器瘦身已完成" in plan or "**已完成**" in plan
    table = plan[plan.index("| **5**") : plan.index("| **5**") + 240]
    assert "已完成" in table
    assert "未开始" not in table
    changelog = (REPO / "CHANGELOG.md").read_text(encoding="utf-8")
    assert "Organization Phase 5" in changelog
    assert "单进程 FreeOS" in changelog


def test_adr_001_and_003_record_zero_node_default() -> None:
    adr001 = (REPO / "docs" / "adr" / "001-single-process-model.md").read_text(encoding="utf-8")
    assert "FREEOS_ORG_SIDECAR=1" in adr001
    assert "SHIP_OPENXYOS_RUNTIME=1" in adr001
    adr003 = (REPO / "docs" / "adr" / "003-org-ui-single-source-dual-delivery.md").read_text(
        encoding="utf-8"
    )
    assert "zero-Node" in adr003
    assert "org-export.md" in adr003


def test_docker_compose_stays_single_python_process() -> None:
    compose_text = (REPO / "docker" / "docker-compose.yml").read_text(encoding="utf-8")
    assert "services:\n  octop:" in compose_text
    assert "openxyos:" not in compose_text
    assert "3780" not in compose_text
    assert "FREEOS_HOME" in compose_text
    assert "single Python process" in compose_text
    readme = (REPO / "docker" / "README.md").read_text(encoding="utf-8")
    readme_cn = (REPO / "docker" / "README_CN.md").read_text(encoding="utf-8")
    for body in (readme, readme_cn):
        assert "FREEOS_HOME" in body
        assert "OCTOP_HOME" in body
        assert "sidecar" in body.lower() or "边车" in body


def test_org_enable_does_not_require_sidecar() -> None:
    source = (REPO / "src" / "octop" / "cli" / "commands" / "org.py").read_text(encoding="utf-8")
    assert "Organization module enabled (in-host)." in source
    assert "Start the sidecar with:" not in source
    assert "FREEOS_ORG_SIDECAR=1" in source
    export = (REPO / "src" / "octop" / "modules" / "org_os" / "export_standalone.py").read_text(
        encoding="utf-8"
    )
    assert "slim default installer" not in export
