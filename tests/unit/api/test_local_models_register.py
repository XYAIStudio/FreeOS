from __future__ import annotations

from octop.api.routers.local_models import _merge_registered, register_failure
from octop.infra.errors import ErrorCode


def test_register_failure_is_user_facing_400() -> None:
    err = register_failure(AttributeError("'ListResponse' object has no attribute 'get'"))
    assert err.code is ErrorCode.LOCAL_MODEL_REGISTER_FAILED
    assert err.status == 400
    assert "ListResponse" in err.details["reason"]
    envelope = err.to_envelope(locale="zh")
    assert envelope["error"]["code"] == "LOCAL_MODEL_REGISTER_FAILED"
    assert "无法注册本地模型" in envelope["error"]["message"]
    assert "ListResponse" in envelope["error"]["message"]


def test_register_failure_keeps_cli_reason() -> None:
    err = register_failure(OSError("Weight file not found: C:\\Models\\a.gguf"))
    assert err.status == 400
    assert "Weight file not found" in err.details["reason"]


def test_merge_registered_marks_matching_ollama_tags() -> None:
    probe = {
        "installed": [
            {"name": "llama3.2:1b", "path": "", "source": "ollama", "registerable": True},
            {"name": "other", "path": "/tmp/other.gguf", "source": "gguf", "registerable": True},
        ]
    }
    merged = _merge_registered(
        probe,
        [{"name": "llama3.2:1b", "path": "", "registered": True}],
    )
    by_name = {item["name"]: item for item in merged["installed"]}
    assert by_name["llama3.2:1b"]["registered"] is True
    assert by_name["llama3.2:1b"]["registerable"] is False
    assert by_name["other"].get("registered") is not True
