from octop.infra.utils.win_utf8 import repair_utf8_mojibake


def test_repair_utf8_mojibake_restores_chinese_filename() -> None:
    garbled = "项目结构.png".encode().decode("cp1252")
    assert garbled != "项目结构.png"
    assert repair_utf8_mojibake(garbled) == "项目结构.png"


def test_repair_utf8_mojibake_leaves_real_unicode_and_ascii() -> None:
    assert repair_utf8_mojibake("项目结构.png") == "项目结构.png"
    assert repair_utf8_mojibake(r"D:\docs\notes") == r"D:\docs\notes"
    assert repair_utf8_mojibake("") == ""
