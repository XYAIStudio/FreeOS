"""Release hygiene: FreeOS branding, not Octop/Tencent advisory or image URLs."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[3]


def test_security_policy_targets_freeos() -> None:
    text = (REPO / "SECURITY.md").read_text(encoding="utf-8")
    assert "https://github.com/XYAIStudio/FreeOS/security/advisories/new" in text
    assert "https://github.com/TencentCloud/Octop/security/advisories/new" not in text


def test_issue_template_targets_freeos() -> None:
    text = (REPO / ".github" / "ISSUE_TEMPLATE" / "config.yml").read_text(encoding="utf-8")
    assert "XYAIStudio/FreeOS/security/policy" in text
    assert "TencentCloud/Octop/security/policy" not in text
    assert "XYAIStudio/FreeOS/tree/main/docs" in text


def test_docker_publish_documents_freeos_ghcr() -> None:
    text = (REPO / ".github" / "workflows" / "docker-publish.yml").read_text(encoding="utf-8")
    assert "ghcr.io/xyaistudio/freeos" in text
    assert "ghcr.io/tencentcloud/octop" not in text
    assert "DOCKERHUB_USERNAME unset" in text or "publishing GHCR only" in text


def test_fnos_compose_pulls_freeos_image() -> None:
    compose = (REPO / "fnos" / "docker" / "app" / "docker" / "docker-compose.yaml").read_text(
        encoding="utf-8"
    )
    assert "ghcr.io/xyaistudio/freeos" in compose
    assert "ghcr.io/tencentcloud/octop" not in compose


def test_node_runtime_doc_exists() -> None:
    en = (REPO / "docs" / "node-runtime.md").read_text(encoding="utf-8")
    zh = (REPO / "docs" / "node-runtime.zh-CN.md").read_text(encoding="utf-8")
    for body in (en, zh):
        assert "SHIP_OPENXYOS_RUNTIME" in body
        assert "FREEOS_ORG_SIDECAR" in body
        assert "ghcr.io/xyaistudio/freeos" in body
    assert "zero-Node" in en
    assert "零 Node" in zh
