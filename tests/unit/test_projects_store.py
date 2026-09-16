from pathlib import Path

import pytest

from octop.infra.projects.store import (
    add_link,
    create_project,
    delete_project,
    get_project,
    list_projects,
    update_project,
)


def test_project_crud_and_links(tmp_path: Path) -> None:
    row = create_project(owner_user_id=1, name="Alpha", work_dir=str(tmp_path), home=tmp_path)
    assert row.name == "Alpha"
    assert list_projects(1, tmp_path)[0].id == row.id
    assert list_projects(2, tmp_path) == []

    linked = add_link(row.id, 1, kind="conversation", ref_id="thr_1", home=tmp_path)
    linked = add_link(row.id, 1, kind="task", ref_id="cron_1", home=tmp_path)
    assert linked.conversation_ids == ["thr_1"]
    assert linked.task_ids == ["cron_1"]

    updated = update_project(row.id, 1, name="Beta", home=tmp_path)
    assert updated.name == "Beta"
    assert get_project(row.id, 1, tmp_path) is not None

    delete_project(row.id, 1, tmp_path)
    assert get_project(row.id, 1, tmp_path) is None


def test_create_rejects_empty_name(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        create_project(owner_user_id=1, name="  ", home=tmp_path)
