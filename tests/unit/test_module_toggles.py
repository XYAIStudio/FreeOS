from pathlib import Path

from octop.modules.org_os.module_toggles import (
    disabled_module_keys,
    load_module_toggles,
    save_module_toggles,
)


def test_locked_modules_stay_on(tmp_path: Path) -> None:
    saved = save_module_toggles(tmp_path, {"workspace": False, "chat": False})
    assert saved["workspace"] is True
    assert saved["chat"] is False
    assert "chat" in disabled_module_keys(tmp_path)
    loaded = load_module_toggles(tmp_path)
    assert loaded["chat"] is False
    assert loaded["workspace"] is True
