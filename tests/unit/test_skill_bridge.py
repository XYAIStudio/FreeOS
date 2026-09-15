"""Module ↔ skill generator and reverse publish path."""

from __future__ import annotations

from pathlib import Path

from octop.modules.org_os.catalog import catalog_keys
from octop.modules.org_os.skill_bridge.endpoints import MODULE_ENDPOINTS
from octop.modules.org_os.skill_bridge.generate import (
    TENANT_HEADERS,
    generate_module_skills,
    skill_slug,
)
from octop.modules.org_os.skill_bridge.publish import publish_skill


def test_every_catalog_key_has_endpoint_map() -> None:
    assert set(MODULE_ENDPOINTS) == set(catalog_keys())


def test_generate_writes_frontmatter_tenant_headers_and_api_paths(tmp_path: Path) -> None:
    generated = generate_module_skills(tmp_path, module_keys=["employees"])
    assert len(generated) == 1
    item = generated[0]
    assert item.slug == "org-employees"
    text = item.skill_md.read_text(encoding="utf-8")
    assert text.startswith("---\n")
    assert "name: org-employees" in text
    assert "module_key: employees" in text
    for header in TENANT_HEADERS:
        assert header in text
    assert "/api/employees" in text
    assert "/api/org-module/sidecar" in text
    assert item.script.is_file()
    script = item.script.read_text(encoding="utf-8")
    assert "X-FreeOS-Tenant-Id" in script
    assert "gate_tool_call" in script


def test_generate_all_catalog_modules(tmp_path: Path) -> None:
    generated = generate_module_skills(tmp_path)
    assert [item.module_key for item in generated] == catalog_keys()
    for item in generated:
        assert (item.directory / "SKILL.md").is_file()
        assert item.slug == skill_slug(item.module_key)


def test_publish_is_tenant_toggle_draft_not_auto_enabled(tmp_path: Path) -> None:
    generated = generate_module_skills(tmp_path, module_keys=["governance"])
    draft = publish_skill(generated[0].directory, out_dir=tmp_path / "out.plugin")
    assert draft.plugin_id == "org-governance"
    yaml_text = draft.plugin_yaml.read_text(encoding="utf-8")
    assert "id: org-governance" in yaml_text
    payload = draft.payload_path.read_text(encoding="utf-8")
    assert '"enabled": false' in payload
    assert "tenant_toggleable" in payload
    assert "/api/plugins" in payload
    assert "/api/module-settings" in payload
    assert (tmp_path / "out.plugin" / "main.py").is_file()
    assert (tmp_path / "out.plugin" / "ui" / "manifest.json").is_file()
