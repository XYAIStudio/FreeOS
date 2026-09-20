from octop.modules.org_os.notes import localize_note, localize_notes


def test_localize_loop_notes_zh() -> None:
    notes = localize_notes(
        [
            "generated 12 module skills from the openXYOS catalog",
            "started but not reachable yet; check logs/org-sidecar.log",
            "openXYOS sidecar is offline — reconnecting the install-time local console.",
            "Local mirror is the durable record. HTTP apply is best-effort.",
            "control plane accepted the FreeOS ingest",
            "Loop produced colleagues, published an asset pack, applied department employees, and imported back.",
            "skipped promotion for ops-coordinator: already active",
            "skipped illegal transition for policy-analyst: cannot move active → market",
            "Assets land on this organization's Employees, Talent, Skills, and Plugins lists.",
            "imported openXYOS skill org-governance",
            "Host directory and talent market updated without Node.",
            "The organization room is arranged on its own; everyday studio login stays a separate space.",
            "Catalog enablement, announcement readers, task files, and reporting lines stay in this room.",
        ],
        "zh",
    )
    assert notes[0] == "已从 openXYOS 目录生成 12 个模块技能"
    assert "尚未可达" in notes[1]
    assert "正在自动连接安装期本机控制台" in notes[2]
    assert "本地镜像" in notes[3]
    assert "控制面已接受" in notes[4]
    assert "循环已生成同事" in notes[5]
    assert "ops-coordinator" in notes[6] and "active" in notes[6]
    assert "policy-analyst" in notes[7] and "market" in notes[7]
    assert "本组织" in notes[8]
    assert "org-governance" in notes[9]
    assert "不依赖 Node" in notes[10]
    assert "组织房间" in notes[11]
    assert "任务附件" in notes[12]


def test_localize_unknown_note_passthrough() -> None:
    assert localize_note("custom operator note", "zh") == "custom operator note"
