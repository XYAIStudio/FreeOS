"""Subset Adobe Source Han Sans Bold for the wordmark; rename the OFL derivative."""
from fontTools import subset
from fontTools.ttLib import TTFont
from pathlib import Path

root = Path(__file__).resolve().parent.parent
font = TTFont(root / "artifacts/SourceHanSansSC-Bold.otf")
subsetter = subset.Subsetter()
subsetter.populate(text="openXYOS")
subsetter.subset(font)
names = {1: "OpenXYOS Brand", 2: "Bold", 3: "OpenXYOSBrand-Bold-Subset", 4: "OpenXYOS Brand Bold", 6: "OpenXYOSBrand-Bold", 16: "OpenXYOS Brand", 17: "Bold"}
for record in font["name"].names:
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())
cff = font["CFF "].cff
cff.fontNames = ["OpenXYOSBrand-Bold"]
cff.topDictIndex[0].FamilyName = "OpenXYOS Brand"
cff.topDictIndex[0].FullName = "OpenXYOS Brand Bold"
font.save(root / "frontend/public/fonts/openxyos-source-han-bold.otf")
