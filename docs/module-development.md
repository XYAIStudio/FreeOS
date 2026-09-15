# openXYOS 模块二次开发契约

## 模块目录与状态

| key | 默认名称 | 类型 |
| --- | --- | --- |
| workspace | 工作台 | 基础、常驻 |
| announcements | 通知公告 | 示例 |
| organization | 组织架构 | 核心 |
| employees | 人机资源 | 核心 |
| skills | 技能插件 | 核心 |
| chat | 沟通协作 | 核心 |
| agents | 智能体定制 | 核心 |
| tasks | 任务管理 | 示例 |
| knowledge | 知识库 | 示例 |
| reflections | 反思引擎 | 示例 |
| governance | 治理引擎 | 核心 |
| settings | 系统设置 | 基础、常驻 |

权威后端目录位于 `backend/open-module-catalog.ts`，前端镜像位于 `frontend/src/open-modules.ts`。租户配置由 `/api/module-settings` 读写；设置页可修改开关和 2–20 字符显示名称。

## 修改示例模块

示例模块不是占位卡片，而是可运行的前后端链路。二次开发时应同步处理：

1. 页面与交互：`frontend/src/pages/`
2. 登录后路由：`frontend/src/OpenApp.tsx`
3. 菜单注册：`frontend/src/components/OpenSidebar.tsx`
4. API 路由：`backend/routes/`
5. 数据表和迁移：`backend/db.ts`
6. 租户权限与审计：认证中间件、`tenant_id` 过滤和治理记录
7. 验证脚本：`scripts/`

新增模块键时，同时更新后端目录、前端状态、导航、路由和测试。不可只注册菜单或空页面；至少提供真实读取路径、真实写入或状态变化路径、权限失败反馈和可重复测试。

## 智能体扩展

智能体蓝图 schema 为 `openxyos.agent-blueprint.v1`。新增资料解析器时，应保留文件限制、安全扫描、租户/用户归属检查和提取长度上限。外部知识库连接必须区分 `linked_unverified`、`ready` 和 `unavailable`。
