"""Organization and Docker binds stay on loopback unless explicitly opted in."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def test_compose_publishes_loopback_and_documents_container_bind() -> None:
    compose = (REPO / "docker" / "docker-compose.yml").read_text(encoding="utf-8")
    assert "127.0.0.1}:${OCTOP_PORT:-8088}:${OCTOP_PORT:-8088}" in compose
    assert "OCTOP_BIND_HOST=0.0.0.0" in compose
    assert "container-internal" in compose
    mobile = (REPO / "docker" / "docker-compose.mobile.yml").read_text(encoding="utf-8")
    assert "OCTOP_BIND_HOST=${OCTOP_BIND_HOST:-127.0.0.1}" in mobile
    assert "network_mode: host" in mobile
    entry = (REPO / "docker" / "docker-entrypoint.sh").read_text(encoding="utf-8")
    assert 'BIND_HOST="${OCTOP_BIND_HOST:-127.0.0.1}"' in entry
    assert "--host 0.0.0.0" not in entry
    org = (REPO / "modules" / "openxyos" / "deploy" / "docker-compose.yml").read_text(encoding="utf-8")
    assert "127.0.0.1:3000:3000" in org
    assert 'FREEOS_ORG_BIND_HOST: "0.0.0.0"' in org
