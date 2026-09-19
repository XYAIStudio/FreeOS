"""Module ↔ skill bidirectional bridge (Direction 3)."""

from octop.modules.org_os.skill_bridge.endpoints import MODULE_ENDPOINTS
from octop.modules.org_os.skill_bridge.generate import generate_module_skills
from octop.modules.org_os.skill_bridge.inventory import (
    catalog_coverage,
    default_org_skills_dir,
    list_generated_skills,
    read_generated_skill,
)
from octop.modules.org_os.skill_bridge.publish import publish_skill

__all__ = [
    "MODULE_ENDPOINTS",
    "catalog_coverage",
    "default_org_skills_dir",
    "generate_module_skills",
    "list_generated_skills",
    "publish_skill",
    "read_generated_skill",
]
