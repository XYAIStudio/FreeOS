"""Capability catalog mirrored from openXYOS ``open-module-catalog.ts``.

The Python list is the runtime source for the FreeOS BFF. Tests compare
keys against ``modules/openxyos/backend/open-module-catalog.ts`` so drift
is caught without importing TypeScript.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import TypedDict

_KEY_RE = re.compile(r'key:\s*"([a-z0-9-]+)"')


class OrgCapability(TypedDict):
    key: str
    label: str
    label_zh: str
    description: str
    description_zh: str
    locked: bool


OPENXYOS_MODULES: tuple[OrgCapability, ...] = (
    {
        "key": "workspace",
        "label": "Workspace",
        "label_zh": "工作台",
        "description": "Organization operations overview and inbox.",
        "description_zh": "组织运行总览与待办入口",
        "locked": True,
    },
    {
        "key": "announcements",
        "label": "Announcements",
        "label_zh": "通知公告",
        "description": "Publish notices and track read state.",
        "description_zh": "可二次开发的通知发布与已读示例",
        "locked": False,
    },
    {
        "key": "organization",
        "label": "Organization",
        "label_zh": "组织架构",
        "description": "Groups, companies, departments, roles, and reporting lines.",
        "description_zh": "集团、公司、部门、岗位与汇报关系",
        "locked": False,
    },
    {
        "key": "employees",
        "label": "People & agents",
        "label_zh": "人机资源",
        "description": "Human employees, AI employees, and talent market.",
        "description_zh": "人类员工、AI 员工、备选员工与人才市场",
        "locked": False,
    },
    {
        "key": "skills",
        "label": "Skill plugins",
        "label_zh": "技能插件",
        "description": "Agent skill catalog and capability assembly.",
        "description_zh": "智能体技能目录与能力装配",
        "locked": False,
    },
    {
        "key": "chat",
        "label": "Collaboration",
        "label_zh": "沟通协作",
        "description": "Human-agent chat, rooms, and realtime collaboration.",
        "description_zh": "人机单聊、群聊与实时协作",
        "locked": False,
    },
    {
        "key": "agents",
        "label": "Agent studio",
        "label_zh": "智能体定制",
        "description": "Generate advisor agents and list them in the talent market.",
        "description_zh": "在线生成顾问型智能体并登记人才市场",
        "locked": False,
    },
    {
        "key": "tasks",
        "label": "Tasks",
        "label_zh": "任务管理",
        "description": "Tasks, subtasks, and status workflow examples.",
        "description_zh": "可二次开发的任务、子任务与状态流转示例",
        "locked": False,
    },
    {
        "key": "knowledge",
        "label": "Knowledge",
        "label_zh": "知识库",
        "description": "Document upload, parse, and retrieval examples.",
        "description_zh": "可二次开发的资料上传、解析与检索示例",
        "locked": False,
    },
    {
        "key": "reflections",
        "label": "Reflections",
        "label_zh": "反思引擎",
        "description": "Retrospectives and experience capture.",
        "description_zh": "可二次开发的复盘与经验沉淀示例",
        "locked": False,
    },
    {
        "key": "governance",
        "label": "Governance",
        "label_zh": "治理引擎",
        "description": "Human-agent policy, review, and audit boundaries.",
        "description_zh": "人机协作策略、人工复核与审计边界",
        "locked": False,
    },
    {
        "key": "settings",
        "label": "Settings",
        "label_zh": "系统设置",
        "description": "Tenant, model, module, and user settings.",
        "description_zh": "租户、模型、模块与用户设置",
        "locked": True,
    },
)


def catalog_keys() -> list[str]:
    return [item["key"] for item in OPENXYOS_MODULES]


def default_openxyos_catalog_path() -> Path:
    """Vendored catalog file, or empty path if the subtree is absent."""
    here = Path(__file__).resolve()
    # src/octop/modules/org_os/catalog.py → repo root
    root = here.parents[4]
    return root / "modules" / "openxyos" / "backend" / "open-module-catalog.ts"


def load_upstream_catalog_keys(path: Path | None = None) -> list[str]:
    """Parse ``key: "..."`` entries from the openXYOS TypeScript catalog."""
    catalog = path or default_openxyos_catalog_path()
    if not catalog.is_file():
        return []
    text = catalog.read_text(encoding="utf-8")
    return _KEY_RE.findall(text)
