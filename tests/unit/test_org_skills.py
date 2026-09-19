"""In-host org skills list/read BFF used by the org-ui Skills page."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from octop.api.deps import current_user, get_server
from octop.api.routers.org_module import router
from octop.infra.errors import OctopError
from octop.infra.users.identity import Role, User
from octop.modules.org_os.catalog import catalog_keys
from octop.modules.org_os.contract import (
    SHARED_ORG_UI_MODULES,
    assert_shared_modules_in_catalog,
)
from octop.modules.org_os.skill_bridge.generate import generate_module_skills
from octop.modules.org_os.skill_bridge.inventory import (
    catalog_coverage,
    list_generated_skills,
    read_generated_skill,
    validate_skill_slug,
)
from octop.modules.org_os.skill_bridge.publish import publish_skill


def _admin() -> User:
    return User(id=1, username="admin", role=Role.ADMIN, display_name="Ada")


def _member() -> User:
    return User(id=2, username="member", role=Role.USER, display_name="Mo")


def _client(tmp_path: Path, user: User, *, packages: list[object] | None = None) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/org-module")

    @app.exception_handler(OctopError)
    async def _octop(_request: object, exc: OctopError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content=exc.to_envelope())

    services = None
    if packages is not None:
        services = SimpleNamespace(skill_package_repo=SimpleNamespace(list_all=lambda: packages))
    server = SimpleNamespace(
        paths=SimpleNamespace(config=tmp_path / "config.json", root=tmp_path),
        services=services,
    )
    app.dependency_overrides[current_user] = lambda: user
    app.dependency_overrides[get_server] = lambda: server
    return TestClient(app)


def test_shared_skills_module_is_in_catalog() -> None:
    assert "skills" in SHARED_ORG_UI_MODULES
    assert "governance" in SHARED_ORG_UI_MODULES
    assert_shared_modules_in_catalog()


def test_inventory_lists_and_reads_generated_skills(tmp_path: Path) -> None:
    root = tmp_path / "org-skills"
    generated = generate_module_skills(root, module_keys=["employees", "skills"])
    assert {item.slug for item in generated} == {"org-employees", "org-skills"}
    rows = list_generated_skills(root)
    assert [row.slug for row in rows] == ["org-employees", "org-skills"]
    assert all(not row.published for row in rows)
    detail = read_generated_skill(root, "org-employees")
    assert detail.module_key == "employees"
    assert "name: org-employees" in detail.content
    assert detail.skill_md.is_file()
    coverage = catalog_coverage(root)
    assert {row["key"] for row in coverage} == set(catalog_keys())
    employees = next(row for row in coverage if row["key"] == "employees")
    assert employees["generated"] is True
    assert employees["slug"] == "org-employees"


def test_inventory_marks_published_plugin_draft(tmp_path: Path) -> None:
    root = tmp_path / "org-skills"
    generated = generate_module_skills(root, module_keys=["governance"])
    publish_skill(generated[0].directory)
    listed = list_generated_skills(root)
    assert listed[0].published is True
    assert listed[0].plugin_dir is not None
    assert (listed[0].plugin_dir / "plugin.yaml").is_file()


def test_validate_skill_slug_rejects_traversal() -> None:
    try:
        validate_skill_slug("../etc/passwd")
        raise AssertionError("expected ValueError")
    except ValueError:
        pass
    try:
        validate_skill_slug("org/employees")
        raise AssertionError("expected ValueError")
    except ValueError:
        pass


def test_api_lists_generated_and_host_packages(tmp_path: Path) -> None:
    generate_module_skills(tmp_path / "org-skills", module_keys=["employees"])
    pkg = SimpleNamespace(id="pkg-1", name="Ops", description="Host pack", skill_count=2)
    admin = _client(tmp_path, _admin(), packages=[pkg])
    listed = admin.get("/api/org-module/skills")
    assert listed.status_code == 200
    body = listed.json()
    assert body["out_dir"].endswith("org-skills")
    slugs = {row["slug"] for row in body["skills"]}
    assert "org-employees" in slugs
    assert body["host_packages"] == [
        {"id": "pkg-1", "name": "Ops", "description": "Host pack", "skill_count": 2}
    ]
    employees = next(row for row in body["catalog"] if row["key"] == "employees")
    assert employees["generated"] is True

    detail = admin.get("/api/org-module/skills/org-employees")
    assert detail.status_code == 200
    assert "name: org-employees" in detail.json()["content"]
    missing = admin.get("/api/org-module/skills/org-missing")
    assert missing.status_code == 404
    bad = admin.get("/api/org-module/skills/../secret")
    assert bad.status_code == 400


def test_api_member_can_read_but_cannot_generate_or_publish(tmp_path: Path) -> None:
    generate_module_skills(tmp_path / "org-skills", module_keys=["employees"])
    member = _client(tmp_path, _member())
    listed = member.get("/api/org-module/skills")
    assert listed.status_code == 200
    assert listed.json()["skills"][0]["slug"] == "org-employees"
    denied_gen = member.post("/api/org-module/skills/generate", json={})
    assert denied_gen.status_code == 403
    denied_pub = member.post(
        "/api/org-module/skills/publish",
        json={"slug": "org-employees"},
    )
    assert denied_pub.status_code == 403


def test_api_admin_generate_and_publish_by_slug(tmp_path: Path) -> None:
    admin = _client(tmp_path, _admin())
    generated = admin.post(
        "/api/org-module/skills/generate",
        json={"modules": ["announcements"]},
    )
    assert generated.status_code == 200
    assert generated.json()["skills"][0]["slug"] == "org-announcements"
    listed = admin.get("/api/org-module/skills")
    assert any(row["slug"] == "org-announcements" for row in listed.json()["skills"])

    published = admin.post(
        "/api/org-module/skills/publish",
        json={"slug": "org-announcements"},
    )
    assert published.status_code == 200
    assert published.json()["plugin_id"] == "org-announcements"
    assert published.json()["notes"]
    after = admin.get("/api/org-module/skills/org-announcements")
    assert after.json()["published"] is True
