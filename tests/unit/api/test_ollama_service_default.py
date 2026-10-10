"""Unit tests for Ollama local service enablement defaults."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from octop.api.routers import ollama_models


def test_ollama_service_defaults_to_disabled_when_unset() -> None:
    server = SimpleNamespace(services=SimpleNamespace(settings_repo=MagicMock()))
    server.services.settings_repo.get.return_value = None
    assert ollama_models._ollama_service_enabled(server) is False


def test_ollama_service_respects_stored_true() -> None:
    server = SimpleNamespace(services=SimpleNamespace(settings_repo=MagicMock()))
    server.services.settings_repo.get.return_value = "true"
    assert ollama_models._ollama_service_enabled(server) is True


@pytest.mark.asyncio
async def test_list_uses_running_daemon_when_service_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from octop.infra.utils import ollama_manager as om
    from octop.infra.utils.ollama_manager import OllamaModelInfo

    monkeypatch.setattr(om, "is_ollama_reachable", lambda: True)
    listed = MagicMock(return_value=[OllamaModelInfo(name="llama3.2:latest")])
    monkeypatch.setattr(om.OllamaModelManager, "list_models", listed)
    server = SimpleNamespace(services=SimpleNamespace(settings_repo=MagicMock()))
    server.services.settings_repo.get.return_value = "false"

    result = await ollama_models.list_ollama_models(server=server, _=None)

    assert [model.name for model in result] == ["llama3.2:latest"]
    listed.assert_called_once_with(start_if_needed=False)


@pytest.mark.asyncio
async def test_list_does_not_start_unreachable_daemon_when_service_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from octop.infra.utils import ollama_manager as om

    monkeypatch.setattr(om, "is_ollama_reachable", lambda: False)
    listed = MagicMock()
    monkeypatch.setattr(om.OllamaModelManager, "list_models", listed)
    server = SimpleNamespace(services=SimpleNamespace(settings_repo=MagicMock()))
    server.services.settings_repo.get.return_value = "false"

    with pytest.raises(HTTPException) as exc_info:
        await ollama_models.list_ollama_models(server=server, _=None)

    assert exc_info.value.status_code == 503
    listed.assert_not_called()
