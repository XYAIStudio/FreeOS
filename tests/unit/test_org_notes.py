from octop.modules.org_os.notes import localize_note, localize_notes


def test_localize_loop_notes_zh() -> None:
    notes = localize_notes(
        [
            "generated 12 module skills from the openXYOS catalog",
            "started but not reachable yet; check logs/org-sidecar.log",
            "Local mirror is the durable record. HTTP apply is best-effort.",
        ],
        "zh",
    )
    assert notes[0] == "已从 openXYOS 目录生成 12 个模块技能"
    assert "尚未可达" in notes[1]
    assert "本地镜像" in notes[2]


def test_localize_unknown_note_passthrough() -> None:
    assert localize_note("custom operator note", "zh") == "custom operator note"
