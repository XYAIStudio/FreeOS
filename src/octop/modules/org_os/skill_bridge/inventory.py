"""List / read generated org-module skills on the host (no second runtime)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from octop.modules.org_os.catalog import OPENXYOS_MODULES
from octop.modules.org_os.skill_bridge.generate import skill_slug

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,79}$")
_FRONTMATTER_NAME = re.compile(r"^name:\s*([a-z0-9][a-z0-9._-]*)\s*$", re.MULTILINE)
_MODULE_KEY = re.compile(r"module_key:\s*([a-z0-9-]+)")
_DESCRIPTION = re.compile(r"^description:\s*(.+)$", re.MULTILINE)
_LABEL_EN = re.compile(r"^\s+en:\s*(.+)$", re.MULTILINE)
_LABEL_ZH = re.compile(r"^\s+zh:\s*(.+)$", re.MULTILINE)


def default_org_skills_dir(home: Path) -> Path:
    return Path(home) / "org-skills"


def validate_skill_slug(slug: str) -> str:
    cleaned = (slug or "").strip()
    if not _SLUG_RE.fullmatch(cleaned):
        raise ValueError("invalid skill slug")
    return cleaned


@dataclass(frozen=True)
class OrgSkillRecord:
    slug: str
    module_key: str
    name: str
    description: str
    label_en: str
    label_zh: str
    directory: Path
    skill_md: Path
    published: bool
    plugin_dir: Path | None
    content: str = ""

    def to_list_dict(self) -> dict[str, Any]:
        return {
            "slug": self.slug,
            "module_key": self.module_key,
            "name": self.name,
            "description": self.description,
            "label_en": self.label_en,
            "label_zh": self.label_zh,
            "directory": str(self.directory),
            "skill_md": str(self.skill_md),
            "published": self.published,
            "plugin_dir": str(self.plugin_dir) if self.plugin_dir else None,
        }

    def to_detail_dict(self) -> dict[str, Any]:
        payload = self.to_list_dict()
        payload["content"] = self.content
        return payload


def _plugin_dir_for(skill_dir: Path, slug: str) -> Path | None:
    sibling = skill_dir.parent / f"{slug}.plugin"
    if sibling.is_dir() and (sibling / "plugin.yaml").is_file():
        return sibling
    return None


def _parse_skill_md(text: str, fallback_slug: str, fallback_module: str) -> dict[str, str]:
    name_match = _FRONTMATTER_NAME.search(text)
    module_match = _MODULE_KEY.search(text)
    desc_match = _DESCRIPTION.search(text)
    en_match = _LABEL_EN.search(text)
    zh_match = _LABEL_ZH.search(text)
    slug = name_match.group(1) if name_match else fallback_slug
    module_key = module_match.group(1) if module_match else fallback_module
    return {
        "slug": slug,
        "module_key": module_key,
        "name": slug,
        "description": (desc_match.group(1).strip() if desc_match else ""),
        "label_en": (en_match.group(1).strip() if en_match else module_key),
        "label_zh": (zh_match.group(1).strip() if zh_match else module_key),
    }


def _record_from_dir(skill_dir: Path, *, include_content: bool) -> OrgSkillRecord | None:
    manifest = skill_dir / "SKILL.md"
    if not manifest.is_file():
        return None
    text = manifest.read_text(encoding="utf-8")
    fallback_module = skill_dir.name.removeprefix("org-")
    parsed = _parse_skill_md(text, skill_dir.name, fallback_module)
    slug = parsed["slug"]
    plugin_dir = _plugin_dir_for(skill_dir, slug)
    return OrgSkillRecord(
        slug=slug,
        module_key=parsed["module_key"],
        name=parsed["name"],
        description=parsed["description"],
        label_en=parsed["label_en"],
        label_zh=parsed["label_zh"],
        directory=skill_dir,
        skill_md=manifest,
        published=plugin_dir is not None,
        plugin_dir=plugin_dir,
        content=text if include_content else "",
    )


def list_generated_skills(root: Path) -> list[OrgSkillRecord]:
    """Scan ``{home}/org-skills`` for generated SKILL.md trees."""
    if not root.is_dir():
        return []
    rows: list[OrgSkillRecord] = []
    for child in sorted(root.iterdir(), key=lambda path: path.name):
        if not child.is_dir() or child.name.endswith(".plugin"):
            continue
        record = _record_from_dir(child, include_content=False)
        if record is not None:
            rows.append(record)
    return rows


def read_generated_skill(root: Path, slug: str) -> OrgSkillRecord:
    """Read one generated skill. Raises ValueError for bad slugs, FileNotFoundError if missing."""
    cleaned = validate_skill_slug(slug)
    skill_dir = (root / cleaned).resolve()
    root_resolved = root.resolve()
    if skill_dir != root_resolved and root_resolved not in skill_dir.parents:
        raise ValueError("invalid skill slug")
    record = _record_from_dir(skill_dir, include_content=True)
    if record is None:
        raise FileNotFoundError(cleaned)
    return record


def catalog_coverage(root: Path) -> list[dict[str, Any]]:
    """Catalog modules plus whether a generated skill already exists."""
    existing = {row.module_key: row for row in list_generated_skills(root)}
    rows: list[dict[str, Any]] = []
    for module in OPENXYOS_MODULES:
        key = module["key"]
        found = existing.get(key)
        rows.append(
            {
                "key": key,
                "slug": skill_slug(key),
                "label": module["label"],
                "label_zh": module["label_zh"],
                "description": module["description"],
                "description_zh": module["description_zh"],
                "generated": found is not None,
                "published": bool(found.published) if found else False,
            }
        )
    return rows
