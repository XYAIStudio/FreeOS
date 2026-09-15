"""Module ↔ skill bidirectional bridge (Direction 3)."""

from octop.modules.org_os.skill_bridge.endpoints import MODULE_ENDPOINTS
from octop.modules.org_os.skill_bridge.generate import generate_module_skills
from octop.modules.org_os.skill_bridge.publish import publish_skill

__all__ = [
    "MODULE_ENDPOINTS",
    "generate_module_skills",
    "publish_skill",
]
