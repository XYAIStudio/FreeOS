# 组织模块合并计划（openXYOS → FreeOS Dashboard）

> **Historical vs Current.**
>
> **Current（权威）：** [产品契约](product-contract.zh-CN.md) / [product-contract.md](product-contract.md)。先在本机安顿；组织像工作室里另一间可独立布置的房间；托管 Node 与全量 App iframe 是过渡桥；终态是把 openXYOS **迁入** 宿主。Phase-5 默认零 Node 是精简默认路径，**不是**「未迁页面已经完成」或「永远不再需要桥」。
>
> **Historical：** 以下 Phase 0–5 记录 Open-12 切片与安装器瘦身。2026-09-19 范围修正（全量 App.tsx）见 [全量融合验收合同](org-full-integration.md)——其中 **能力对齐清单仍可用**，文末 Node + 组织身份权威 已作废。

**状态：** Phase 0–4 已落地（#55 宿主内 Organization + Open-12 宿主 UI + `export-standalone`）。**Phase 5 默认安装器瘦身已完成**：Windows/macOS/Linux 默认包不捆绑、不解压、不自动拉起 openXYOS Node；`FREEOS_ORG_SIDECAR` / `SHIP_OPENXYOS_RUNTIME=1` 仍是可选高级路径。残留：导出站自包含 org API、可选 `packages/org-ui` 抽包。详见 [org-export.md](org-export.md)。
**日期：** 2026-09-19
**依据：** Phase 0 迁移图、[architecture-integration.md](architecture-integration.md)、[asset-loop.md](asset-loop.md)、[ADR 001](adr/001-single-process-model.md)、#55 宿主内 Organization

Phase 1 冻结了合同。Phase 2（通知公告）与 Phase 3 Open-12 宿主页已按该合同落地；Chat 不迁。

---

## 产品意图

**Current** 以 [产品契约](product-contract.zh-CN.md) 为准。下面 1–5 是 Phase 1 冻结时的工程意图，仍然有用，但 **不得** 覆盖「使用边界」或「Node 只是桥」。

### Historical（Phase 1 冻结）

1. **组织模块代码是唯一事实来源。**
2. openXYOS 网页成为 **FreeOS Dashboard Organization 下的子 UI**，不是第二套常驻系统。
3. 同一套源必须能 **生成** 独立 openXYOS Web，供客户自托管（商业加售）。
4. **默认一个安装器**，不强制 Node sidecar。Sidecar 仅作可选兼容（`FREEOS_ORG_SIDECAR` / `SHIP_OPENXYOS_RUNTIME`）。Phase-5 零 Node 与 sidecar/iframe 都是过渡，终态是原生迁入。
5. **不用** openXYOS Chat 替换 FreeOS/Octop Agent 对话运行时。

---

## 阶段总览（0–5）

| 阶段 | 目标 | 状态 |
|---|---|---|
| **0** 宿主内地基 | `org_os` 控制面、`/api/org-module/*` BFF、Dashboard 原生工作台、sidecar 改为可选 | **已完成**（#55） |
| **1** 合同冻结 | ADR + 本计划：单源双交付、包布局、API 归属、IdentityBridge、Phase 2 验收 | **本文** |
| **2** 垂直切片 | **通知公告 Announcements** 按合同落地（Dashboard 路由 + 可导出同一页面） | **已完成** |
| **3** Open-12 其余页 | 工作台、组织架构、员工、技能、智能体、任务、知识、反思、治理 UI、设置 | **已完成（Chat 除外）**：架构 / 员工 / 技能 / 治理 / 知识 / 任务 / 反思 / 设置 / 智能体 / 薄 Workspace overview 已迁。**Chat 永久不迁** |
| **4** 身份与导出 | 已迁页面走 IdentityBridge；`export-standalone` 产出可运行独立站（Vite SPA + 本地 JWT + 代理到宿主 org-module API） | **已完成（可运行包）**；自包含 Node API 仍是目标终态 |
| **5** 安装器瘦身 | 默认安装器去掉 sidecar / 保持零 Node | **已完成**。残留：自包含 org API、可选 `packages/org-ui` 抽包 |

Phase 0 已落地、Phase 1 **只冻结合同**。Phase 2 起才允许搬页面。

---

## Phase 0 已在宿主内（保留）

| 能力 | 位置 |
|---|---|
| 治理 / 编译器 / 生命周期 / 资产 apply / 自增长 loop / skill_bridge / runtime / catalog（12 keys） | `src/octop/modules/org_os/` |
| 组织 BFF | `/api/org-module/*`（`src/octop/api/routers/org_module.py`） |
| Dashboard 原生 Ant Design 工作台 | `/organization`（#55，不再依赖 3780 iframe） |
| Sidecar | **可选**。`FREEOS_ORG_SIDECAR`、`SHIP_OPENXYOS_RUNTIME=1` |

Catalog 十二键（`catalog.py` ↔ `open-module-catalog.ts`）：

`workspace` · `announcements` · `organization` · `employees` · `skills` · `chat` · `agents` · `tasks` · `knowledge` · `reflections` · `governance` · `settings`

---

## 重叠矩阵（Phase 0 浓缩）

「Open-12」= `OpenApp.tsx` 路由，**不是** 完整商业 `App.tsx`。

| 模块 key | 现状 UI | 现状 API | 合并方向 |
|---|---|---|---|
| workspace | OpenApp `/app` | sidecar dashboard/inbox | **Phase 3 切片已落地**：薄 Workspace / OpenDashboard `/organization/workspace`，复用 `GET /api/org-module/overview`，链到已迁子页。**不是**第二套控制面（assemble / pack / loop 仍在 `#55` `/organization`）。Chat 不迁 |
| **announcements** | OpenApp `/announcements` | sidecar `/api/announcements` | **Phase 2 切片** |
| organization | OpenApp `/org` | sidecar `/api/org` | **Phase 3 切片已落地**：`/organization/org` + `/api/org-module/org` |
| employees | OpenApp `/employees` | sidecar `/api/employees` + 宿主 lifecycle `/api/org-module/employees` | **Phase 3 切片已落地**：`/organization/employees` 目录 CRUD 复用 `org_chart.sqlite`；lifecycle / spawn **已在宿主，勿重复造** |
| skills | OpenApp `/skills` | sidecar `/api/skills` + 宿主 `skill_bridge` | **Phase 3 切片已落地**：`/organization/skills` 列出 `{FREEOS_HOME}/org-skills` 并 generate/publish；宿主 skill packages 只读列出（Agent Skills 运行时仍在个性化）。未迁：边车市场 / 插件中心 / 付费安装 |
| **chat** | OpenApp `/chat` | sidecar `/api/chats` | **不迁。** 对话走 FreeOS/Octop |
| agents | OpenApp `/agents`（Agent Studio） | 源码有 `routes/agent-studio.ts`，**`server.ts` 当前未 `app.use`** | **Phase 3 切片已落地**：`/organization/agents` 桥接宿主 `GET /api/org-module/agents` + 已有 `/blueprints/compile` 与 employees lifecycle / spawn。**不是** FreeOS 个性化编辑器或 Chat。未迁：边车 `/api/agent-studio/*`、资料上传、人才市场 |
| tasks | OpenApp `/tasks` | sidecar `/api/tasks` | **Phase 3 切片已落地**：`/organization/tasks` + `/api/org-module/tasks*`，`{FREEOS_HOME}/org/tasks.sqlite`。不是 Octop cron，也不是项目/Chat。未迁：附件、边车任务库 |
| knowledge | OpenApp `/knowledge` | sidecar `/api/knowledge` | **Phase 3 切片已落地**：`/organization/knowledge` 列出宿主 `/api/knowledge-bases` 同一套行；不克隆 sidecar notes/files DB |
| reflections | OpenApp `/reflections` | sidecar `/api/reflections` | **Phase 3 切片已落地**：`/organization/reflections` + `/api/org-module/reflections*`，`{FREEOS_HOME}/org/reflections.sqlite`。不是 Chat，也不是第二套技能运行时。未迁：边车技能统计、部署铁律样例 |
| governance UI | OpenApp `/governance` | sidecar `/api/governance` + 宿主 `org_os/governance` | **Phase 3 切片已落地**：`/organization/governance` 展示待审批 / 审计 / 裁决；PEP/PDP 与 durable pause **已在宿主，勿重写引擎**。未迁：边车权限矩阵、通信规则、流程模板 |
| settings | OpenApp `/settings` | sidecar `/api/settings`、`/api/module-settings` | **Phase 3 切片已落地**：`/organization/settings` 只改 `org_os` 目录开关（复用 `PUT /api/org-module/modules`）与组织本地偏好（`/prefs`）。**不是** FreeOS 系统设置（密钥、用户、时区）。未迁：边车公司/AI/用户/数据库页 |

**商业 `App.tsx` 多出来的路由（本波不迁）：** workflows、contracts、assets、attendance/leave、expense、daily-report、goals、budgets、performance、efficiency、audit 等。它们不是 Open-12。

---

## 包布局提案

原则：Phase 2 **先抽缝，不新开 monorepo**；Phase 5 若导出需要独立包再提取。

```
dashboard/src/org-ui/                 # 壳无关：页面、hooks、API client factory
  pages/                              # AnnouncementPage, …
  hooks/
  api/createClient.ts                 # createOrgApiClient(adapter)
  shell.ts                            # ShellAdapter / IdentityBridge 类型

dashboard/src/pages/Organization/     # 薄适配器：路由、FreeOS session、Ant Design、i18n
  index.tsx                           # 已有 #55 工作台
  announcements/                      # 挂 org-ui 页面

src/octop/modules/org_os/contract.py  # org-contract：module keys、blueprint、JSON schema
dashboard/src/org-ui/contract.ts      # 与 Python catalog keys 对拍（测试已有 catalog 漂移检查）

src/octop/cli/commands/org.py         # freeos org export-standalone
scripts/org-export/                   # 独立 Vite + 最小 server，import 同一套 org-ui
```

后续若导出必须脱离 Dashboard Vite 图，再升为 `packages/org-ui` + `packages/org-contract`。**不要**在 Phase 2 为了洁癖先拆包。

```bash
uv run freeos org export-standalone --out dist/openxyos-web
```

导出物是可部署的独立 Web（Vite SPA + Docker；过渡期代理到 FreeOS `/api/org-module`），**不是** 再维护一份 `AnnouncementPage.tsx`。客户说明见 [org-export.md](org-export.md)。

---

## API 归属

### 宿主 BFF（已存在，继续作为控制面入口）

前缀：`/api/org-module/*`

| 路由簇 | 归属 | 迁 UI 时 |
|---|---|---|
| `status` · `catalog` · `overview` · `PATCH ""` · `modules` | 宿主 | 保持 |
| `assemble` · `produce` · `pack` · `loop/run` | 宿主 loop | 保持 |
| `employees` · `employees/transition` · `employees/spawn` | 宿主 lifecycle | **已挂 UI**（Agents）。与员工 **目录 CRUD** 分开 |
| `assets/*` · `blueprints/compile` · `skills` list/read/generate/publish | 宿主工厂 | **已挂 UI**。compile 在 Agents；skills list/read 补目录；generate/publish 仍管理员/`plugins` 门控 |
| `governance/check\|resolve\|audit` · `pauses` | 宿主 PEP/PDP | **已挂 UI**。`GET /pauses` 补列出待审批；resolve 仍管理员/`plugins` 门控 |
| `knowledge` list/read/create/notes | 宿主知识库桥接 | **已挂 UI**。包装 `KnowledgeService`；写操作 `knowledge_bases` 门控。不克隆 sidecar notes DB |
| `tasks` list/stats/detail/CRUD/transition/subtasks/comments | 宿主组织待办 | **已挂 UI**。`{FREEOS_HOME}/org/tasks.sqlite`。不是 cron / 项目任务 / Chat |
| `reflections` list/stats/detail/create/delete | 宿主组织复盘 | **已挂 UI**。`{FREEOS_HOME}/org/reflections.sqlite`。不是 Chat / 第二套技能运行时 |
| `settings` snapshot · `prefs` · `modules` | 宿主组织模块设置 | **已挂 UI**。复用 `/modules`；prefs 在 `{FREEOS_HOME}/org-os/prefs.json`。不是系统设置 |
| `sidecar/*` · `source/download` | 可选兼容 | 留在 Advanced；默认路径不依赖 |

### 业务 CRUD（当前 sidecar Express → 按切片迁入宿主）

| 资源 | 今日 | Phase 2+ 路径 |
|---|---|---|
| 公告 | `GET/POST/PUT/DELETE /api/announcements` | **先迁。** 宿主实现（建议 `/api/org-module/announcements` 或宿主挂 `/api/announcements`），`org-ui` client factory 指向宿主。独立导出站可同路径或经适配器改 base URL |
| 组织树 | sidecar `/api/org` | **已迁。** 宿主 `/api/org-module/org`（tree / departments / employees 目录 CRUD），`{FREEOS_HOME}/org/org_chart.sqlite`。未迁：versions、reporting-lines、skills、import、头像上传 |
| 员工目录 | sidecar `/api/employees` | **已迁目录 CRUD。** 宿主 `/api/org-module/org/employees*`，与 org chart **同一** `{FREEOS_HOME}/org/org_chart.sqlite`。lifecycle 仍是 `GET /api/org-module/employees`（同事 registry）。未迁：人才市场、备选入职、资产离职清算、绩效、汇报线、技能绑定、头像上传 |
| 任务 | sidecar `/api/tasks` | **已迁。** 宿主 `/api/org-module/tasks*`，`{FREEOS_HOME}/org/tasks.sqlite`。不桥接 cron，不迁 Chat |
| 反思 | sidecar `/api/reflections` | **已迁。** 宿主 `/api/org-module/reflections*`，`{FREEOS_HOME}/org/reflections.sqlite`。不迁 Chat，不迁边车技能统计 |
| 设置 | sidecar `/api/settings` 等 | **已迁组织模块设置。** `GET /api/org-module/settings` + `PUT /prefs` + 复用 `PUT /modules`。不迁 sidecar 公司/AI/用户/数据库，也不复制 FreeOS 系统设置 |
| 知识 | sidecar `/api/knowledge` | **已迁为宿主桥接。** `GET /api/org-module/knowledge*` 读 Octop `knowledge_bases` / `knowledge_documents`；笔记写成宿主 markdown 文档。sidecar notes DB 仍是可选兼容 |
| 未迁资源 | sidecar 或 `/api/org-module/sidecar/api/<resource>` 代理 | 可选 sidecar 仍可用；默认安装不启动它 |
| Chat | sidecar `/api/chats` | **永久不迁** |

迁 CRUD **不是** 把整个 Express 重写成 FastAPI 当先决条件（见 ADR 003 否决项）。切片证明：该页不再打 `:3780`，也不再 iframe。

### 数据落点（提醒）

宿主耐久状态在 `FREEOS_HOME`（治理 pause、同事 registry、mirror）。Sidecar SQL.js **不是** 生产 SoT。公告切片需明确：行写入宿主库（SQLite/PG，ADR 002）或 `FREEOS_HOME` 租户目录，而不是暗依赖 sidecar DB。

---

## IdentityBridge 草图

今日 BFF 已把 FreeOS 用户映射为 `X-FreeOS-User` / `X-FreeOS-User-Id` / `X-FreeOS-Role` / `X-FreeOS-Tenant-Id`，并 **剥离** `Authorization`，避免把宿主 JWT 当成 sidecar session（`proxy.py` → `identity_headers`）。工作室访客的 `X-FreeOS-Role` 是 `guest`，不会把宿主管理员写成房间管理员。

目标：宿主内已迁页面继续用工作室会话；完整组织房间（`/organization-app`、`/api/org-module/identity/*`、`/api/org-module/business/*`）用房间自己的登记本。两扇门同在一个 FreeOS，不捏成同一种进入方式。

```
org-ui  →  IdentityBridge.getSession()
            IdentityBridge.authHeaders()
            IdentityBridge.apiBase()

嵌入 Dashboard（默认 / 已迁切片）：
  session = FreeOS JWT / 当前用户
  apiBase = 同源 /api
  宿主内公告、架构、任务等用这扇工作室门

组织房间（integrated runtime / 完整 App）：
  session = 组织 JWT（`org_room_token` 或 iframe `token`）
  apiBase = `/organization-app` 或 `/api/org-module/business`
  房间管理员映射为宿主 `Role.USER`，`organization_role` 留在房间里

独立导出站：
  session = 本地 JWT（现有 openXYOS auth）
  apiBase = 独立站 origin
  客户自托管自己的账号体系
```

`ShellAdapter` 还提供：导航（嵌入用 `/organization/...`，独立站用 `/announcements`）、locale、server timezone、是否展示宿主-only 动作（loop / assemble）。

默认 UX：**打开 Organization 子页 = 已登录 FreeOS 即可读写已迁资源。** 可选 sidecar 的登录框不得回到主路径。

---

## Phase 2 垂直切片：Announcements

最低风险：只读+CRUD 清晰，不碰 Agent 运行时，OpenApp 与商业 `App.tsx` 都引用同一 `AnnouncementPage`。

### 已落地（Phase 2 实现）

1. 壳无关组件：`dashboard/src/org-ui/pages/announcements`，数据经 `createOrgApiClient`。
2. Dashboard 子路由：`/organization/announcements`（工作台 path tabs + 入口卡）。
3. 宿主 API：`/api/org-module/announcements*`，SQLite 在 `{FREEOS_HOME}/org/announcements.sqlite`；嵌入模式打宿主 JWT，不打 `:3780`。
4. 导出骨架：`freeos org export-standalone --out …` 写出共享模块列表 + 导入同一 `AnnouncementPage` 的 `App.tsx`。Phase 4 已把该骨架做成可运行 Vite/Docker 包（见下方）。

### 验收标准

| # | 标准 |
|---|---|
| A | Dashboard 路由在 **`/organization/...`** 下（至少 `/organization/announcements`） |
| B | 该页 **无 iframe**，也 **不要求第二端口**（不依赖 `127.0.0.1:3780`） |
| C | **同一套页面组件** 可用于 `freeos org export-standalone` 输出（独立站路由可以是 `/announcements`） |
| D | 已登录 FreeOS 用户可完成列表 / 发布 / 已读，无需 sidecar 登录墙 |
| E | 不引入 openXYOS Chat，也不改 Agent 对话运行时 |

不满足 A–C 则切片未完成，不得开始 Phase 3 批量搬迁。

---

## Phase 3 进度：组织架构

按 Phase 2 同一缝落地，**只迁 org chart**，不批量搬 Open-12。

### 已落地

1. 壳无关组件：`dashboard/src/org-ui/pages/org`（`OrgChartPage`），数据经 `createOrgApiClient().org`。
2. Dashboard 子路由：`/organization/org`（工作台 path tabs + 入口卡，与 Announcements 并列）。
3. 宿主 API：`/api/org-module/org/tree|departments|employees*`，SQLite 在 `{FREEOS_HOME}/org/org_chart.sqlite`；嵌入模式打宿主 JWT，不打 `:3780`。
4. 导出骨架：`freeos org export-standalone` 的模块列表与 `App.tsx` 同时导入 `AnnouncementPage` 与 `OrgChartPage`。

### 本切片明确推迟

| 推迟项 | 原因 |
|---|---|
| Chat / 从架构图发起会话 | 对话运行时留在 FreeOS/Octop |
| 汇报线、职级、技能绑定、架构版本 | 商业 OrgChart 扩展，不是本垂直切片的最低可用集 |
| 导入文件 / 导出 PNG·SVG·PDF | 依赖 sidecar 上传与 html-to-image/jsPDF |
| 头像上传与预设图 | 需要独立文件存储 |
| 其余 Open-12（工作台扩展、智能体、任务、知识、反思、设置） | 后续切片 |
| `freeos org export-standalone` 完整 Vite/Node 打包 | Phase 5 |

---

## Phase 3 进度：员工目录（本切片）

按同一缝落地，**只迁员工目录**。目录行与组织架构共用 `org_chart.sqlite`，不另开第二套员工库。

### 数据模型（单一 SoT）

| 表面 | 存储 | API | 含义 |
|---|---|---|---|
| 目录员工（人/AI 名册） | `{FREEOS_HOME}/org/org_chart.sqlite` `employees` | `/api/org-module/org/employees*` | 部门编制；OrgChartPage 与 EmployeesPage 读写同一行 |
| 数字同事 lifecycle | `{FREEOS_HOME}/tenants/<id>/employees/registry.json` | `GET /api/org-module/employees` · `/transition` · `/spawn` | 编译/晋升/挂聊天专家；**不是**目录 CRUD |

openXYOS sidecar `/api/employees`（人才市场、备选、资产离职清算）仍是可选兼容面，默认路径不读它。

### 已落地

1. 壳无关组件：`dashboard/src/org-ui/pages/employees`（`EmployeesPage` + `EmployeeDetailPage`），数据经 `createOrgApiClient().employees`。
2. Dashboard 子路由：`/organization/employees`、`/organization/employees/:id`（工作台 path tabs + 入口卡）。
3. 宿主 API：list / detail / stats / create / update / deactivate，管理员写；嵌入模式打宿主 JWT，不打 `:3780`。
4. 导出骨架：`freeos org export-standalone` 模块列表与 `App.tsx` 同时导入 `EmployeesPage` / `EmployeeDetailPage`。

### 本切片明确推迟

| 推迟项 | 原因 |
|---|---|
| Chat / 从员工页发起会话 | 对话运行时留在 FreeOS/Octop |
| lifecycle spawn / transition UI | 已在宿主；工作台同事列表与 Experts 已覆盖 |
| 人才市场、备选入职、reserve ↔ internal | sidecar 另表；本切片不做第二套 talent DB |
| 资产离职清算、绩效、汇报线、技能绑定、头像上传 | 依赖未迁资源或文件存储 |
| 其余 Open-12（智能体、任务、知识、反思、设置） | 后续切片 |
| `freeos org export-standalone` 完整 Vite/Node 打包 | Phase 5 |

---

## Phase 3 进度：技能（本切片）

按同一缝落地，**只迁组织技能目录**。不另造技能运行时：generate/publish **已在** `org_os/skill_bridge`，Agent Skills 仍走宿主技能包。

### 数据模型（单一 SoT）

| 表面 | 存储 | API | 含义 |
|---|---|---|---|
| 组织模块技能 | `{FREEOS_HOME}/org-skills/org-<module>/` | `GET /api/org-module/skills` · `GET …/skills/{slug}` · `POST …/generate` · `POST …/publish` | 目录生成的 SKILL.md；调用组织 API，不是第二套 agent runtime |
| 宿主 Agent Skills | Octop `skill_packages` 表 | 同一 `GET /skills` 的 `host_packages`；编辑仍在 `/personalization/skill-packages` | 智能体真正执行的技能包 |

openXYOS sidecar `/api/skills`（市场、插件中心、付费安装）仍是可选兼容面，默认路径不读它。

### 已落地

1. 壳无关组件：`dashboard/src/org-ui/pages/skills`（`SkillsPage`），数据经 `createOrgApiClient().skills`。
2. Dashboard 子路由：`/organization/skills`（工作台 path tabs + 入口卡）。
3. 宿主 API：已有 generate / publish；本切片补 `GET /skills` 与 `GET /skills/{slug}`。写操作走 `require_permission("plugins")`（管理员绕过）。
4. 导出骨架：`freeos org export-standalone` 模块列表与 `App.tsx` 同时导入 `SkillsPage`。

### 本切片明确推迟

| 推迟项 | 原因 |
|---|---|
| Chat / 从技能页发起会话 | 对话运行时留在 FreeOS/Octop |
| 边车技能市场 / 插件中心 / 付费安装 | sidecar SQL.js；本波不迁商业市场 |
| 在组织页里编辑 Agent Skills | 运行时已在个性化；本页只读列出并跳转 |
| 其余 Open-12（智能体、任务、反思、设置） | 后续切片 |
| `freeos org export-standalone` 完整 Vite/Node 打包 | Phase 5 |

---

## Phase 3 进度：治理 UI（本切片）

按同一缝落地，**只迁治理展示与裁决**。PEP/PDP、durable pause、audit JSONL **已在宿主**，不重写 `GovernanceEngine`。

### 数据模型（单一 SoT）

| 表面 | 存储 | API | 含义 |
|---|---|---|---|
| 待审批 pause | `{FREEOS_HOME}/governance/pauses/<id>.json` | `GET /api/org-module/governance/pauses` · `POST …/resolve` | 高风险工具默认拒绝后的人工复核 |
| 本地审计 | `{FREEOS_HOME}/governance/audit.jsonl` | `GET /api/org-module/governance/audit` | 宿主事实来源；不是 sidecar SQL.js |
| 策略检查 | 同上 | `POST /api/org-module/governance/check` | 引擎已有；UI 不另造检查器 |

openXYOS sidecar `/api/governance`（权限矩阵、通信规则、流程模板、stats）仍是可选兼容面，默认路径不读它。

### 已落地

1. 壳无关组件：`dashboard/src/org-ui/pages/governance`（`GovernancePage`），数据经 `createOrgApiClient().governance`。
2. Dashboard 子路由：`/organization/governance`（工作台 path tabs + 入口卡）。
3. 宿主 API：已有 check / resolve / audit；本切片补 `GET /governance/pauses` 供列表。裁决走 `require_permission("plugins")`（管理员绕过）。
4. 导出骨架：`freeos org export-standalone` 模块列表与 `App.tsx` 同时导入 `GovernancePage`。

### 本切片明确推迟

| 推迟项 | 原因 |
|---|---|
| Chat / 从治理页发起会话 | 对话运行时留在 FreeOS/Octop |
| 边车权限矩阵 / 通信规则 / 流程模板 CRUD | sidecar SQL.js；本波不重写引擎、不迁商业矩阵编辑器 |
| IM `/approve` 接线 | 引擎与 CLI 已能裁决；IM 另切片 |
| 其余 Open-12（智能体、任务、反思、设置） | 后续切片 |
| `freeos org export-standalone` 完整 Vite/Node 打包 | Phase 5 |

---

## Phase 3 进度：知识（本切片）

按同一缝落地，**只迁组织知识目录**。不另造笔记/文件 SQLite：列出并写入的是宿主 FreeOS 知识库（Chat / Agent RAG 同一套行）。

### 与 FreeOS 知识库的关系

| 表面 | 存储 | API | 含义 |
|---|---|---|---|
| 组织知识页 | Octop `knowledge_bases` / `knowledge_documents` | `GET /api/org-module/knowledge` · `GET …/{kb_id}` · `POST …` · `POST …/{kb_id}/notes` | **桥接宿主 KB**。卡片/笔记 UX 参考 openXYOS KnowledgePage，数据不是 sidecar SQL.js |
| 宿主知识库页 | 同上 | `/api/knowledge-bases*` · Dashboard `/knowledge-bases` | 上传、文件夹、嵌入模型、IMA 挂载仍在这里 |
| sidecar 知识 | openXYOS notes + files | 可选 `/api/knowledge` | **不迁、不克隆。** 默认路径不读它 |

组织知识 **不是** 第二套「组织资料」表，也 **没有** 把 sidecar 笔记合并进 Octop RAG。它只是 Organization 壳下的同一套宿主知识库视图；笔记会变成所选 KB 里的 markdown 文档，因此对话检索能看到。

### 已落地

1. 壳无关组件：`dashboard/src/org-ui/pages/knowledge`（`KnowledgePage`），数据经 `createOrgApiClient().knowledge`。
2. Dashboard 子路由：`/organization/knowledge`（工作台 path tabs + 入口卡）。
3. 宿主 API：本切片补 `/api/org-module/knowledge*`，包装已有 `KnowledgeService`。写操作走 `require_permission("knowledge_bases")`（管理员绕过）。
4. 导出骨架：`freeos org export-standalone` 模块列表与 `App.tsx` 同时导入 `KnowledgePage`。

### 本切片明确推迟

| 推迟项 | 原因 |
|---|---|
| Chat / 从知识页发起检索对话 | 对话运行时留在 FreeOS/Octop |
| 边车 notes/files CRUD 与解析流水线 | sidecar SQL.js；本波不克隆第二套知识库 |
| 上传、文件夹、嵌入设置、IMA 挂载 | 已在宿主 `/knowledge-bases`；本页只列并加笔记 |
| 其余 Open-12（智能体、反思、设置） | 后续切片 |
| `freeos org export-standalone` 完整 Vite/Node 打包 | Phase 5 |

---

## Phase 3 进度：任务（本切片）

按同一缝落地，**只迁组织待办**。不桥接 Octop cron（定时智能体提示），也不把 openXYOS 任务对话搬进宿主 Chat。

### 数据模型（单一 SoT）

| 表面 | 存储 | API | 含义 |
|---|---|---|---|
| 组织任务 | `{FREEOS_HOME}/org/tasks.sqlite` | `/api/org-module/tasks*` | 待办 / 进行中 / 评审 / 完成；子任务与人工评论 |
| Octop cron | 宿主 `cron_jobs` | `/api/cron` | **不是**组织任务。定时对智能体发提示 |
| 项目任务 | Dashboard `/projects?view=tasks` | 既有项目面 | **不是**组织任务。`/tasks` 仍重定向到项目 |
| sidecar 任务 | openXYOS SQL.js | 可选 `/api/tasks` | **不迁、不克隆。** 默认路径不读它 |

可选 `assigned_to` 指向同一租户的目录员工（`org_chart.sqlite`），不是边车员工表。评论是工作项备注，**不是**智能体对话。

### 已落地

1. 壳无关组件：`dashboard/src/org-ui/pages/tasks`（`TasksPage` + `TaskDetailPage`），数据经 `createOrgApiClient().tasks`。
2. Dashboard 子路由：`/organization/tasks`、`/organization/tasks/:id`（工作台 path tabs + 入口卡）。
3. 宿主 API：list / stats / detail / create / update / delete / transition / subtasks / comments；嵌入模式打宿主 JWT，不打 `:3780`。
4. 导出骨架：`freeos org export-standalone` 模块列表与 `App.tsx` 同时导入 `TasksPage` / `TaskDetailPage`。

### 本切片明确推迟

| 推迟项 | 原因 |
|---|---|
| Chat / 从任务页发起会话 | 对话运行时留在 FreeOS/Octop |
| 边车任务附件上传 | sidecar 本身已关闭不受控路径上传 |
| 与 cron / 项目任务合并 | 语义不同；本页只拥有组织待办 |
| 其余 Open-12（智能体、反思、设置） | 后续切片 |
| `freeos org export-standalone` 完整 Vite/Node 打包 | Phase 5 |

---

## Phase 3 进度：反思（本切片）

按同一缝落地，**只迁组织复盘**。不把 openXYOS Chat 或 sidecar `employee_skill_stats` 搬进宿主。

### 数据模型（单一 SoT）

| 表面 | 存储 | API | 含义 |
|---|---|---|---|
| 组织反思 | `{FREEOS_HOME}/org/reflections.sqlite` | `/api/org-module/reflections*` | 任务完成 / 错误学习 / 知识沉淀 / 改进计划 |
| 目录员工 / 组织任务 | `org_chart.sqlite` / `tasks.sqlite` | 可选 `employee_id` / `task_id` | 同一租户的目录员工与组织待办，不是边车表 |
| sidecar 反思 | openXYOS SQL.js | 可选 `/api/reflections` | **不迁、不克隆。** 默认路径不读它 |

可选 `employee_id` 指向同一租户的目录员工；可选 `task_id` 指向组织任务。提取技能字段只是文本，**不会**写入技能运行时。

### 已落地

1. 壳无关组件：`dashboard/src/org-ui/pages/reflections`（`ReflectionsPage`），数据经 `createOrgApiClient().reflections`。
2. Dashboard 子路由：`/organization/reflections`（工作台 path tabs + 入口卡）。
3. 宿主 API：list / stats / detail / create / delete；嵌入模式打宿主 JWT，不打 `:3780`。
4. 导出骨架：`freeos org export-standalone` 模块列表与 `App.tsx` 同时导入 `ReflectionsPage`。

### 本切片明确推迟

| 推迟项 | 原因 |
|---|---|
| Chat / 从反思页发起会话 | 对话运行时留在 FreeOS/Octop |
| 边车 `employee_skill_stats` / 技能使用统计 | 组织技能已有独立切片；本页不另造技能库 |
| 边车「系统部署铁律」样例文案 | openXYOS 自身部署备忘，不是组织复盘数据 |
| 其余 Open-12（工作台扩展） | **已由 Workspace 切片完成** |
| `freeos org export-standalone` 完整 Vite/Node 打包 | Phase 5 |

---

## Phase 3 进度：设置（本切片）

按同一缝落地，**只迁组织模块设置**。不复制 FreeOS 系统设置（大模型密钥、用户、时区、模型、安全）。

### 数据模型（单一 SoT）

| 表面 | 存储 | API | 含义 |
|---|---|---|---|
| 目录模块开关 | `{FREEOS_HOME}/org-os/module-toggles.json` | `GET/PUT /api/org-module/modules`（本页复用，不另造） | openXYOS catalog 十二键的显示/隐藏；`workspace` / `settings` 锁定为开 |
| 组织本地偏好 | `{FREEOS_HOME}/org-os/prefs.json` | `GET /api/org-module/settings` · `PUT /api/org-module/prefs` | 组织显示名与简介；不是实例名 |
| FreeOS 系统设置 | Octop 用户/供应商/config.json | `/system-settings` 等 | **本页不编辑。** 只外链 |
| sidecar 设置 | openXYOS SQL.js | 可选 `/api/settings` | **不迁、不克隆。** 默认路径不读它 |

本页明确 **没有**：LLM API Key、用户注册、空中模式、数据库备份、边车角色矩阵。

### 已落地

1. 壳无关组件：`dashboard/src/org-ui/pages/settings`（`SettingsPage`），数据经 `createOrgApiClient().settings`。
2. Dashboard 子路由：`/organization/settings`（工作台 path tabs + 入口卡）。
3. 宿主 API：snapshot / prefs；模块开关复用已有 `/modules`。写操作仅管理员。
4. 导出骨架：`freeos org export-standalone` 模块列表与 `App.tsx` 同时导入 `SettingsPage`。

### 本切片明确推迟

| 推迟项 | 原因 |
|---|---|
| 把系统设置搬进组织页 | FreeOS 已有系统设置；本页只链出去 |
| 边车公司/AI/用户/数据库 Tab | sidecar SQL.js；密钥与用户在宿主 |
| Chat 搬迁 | **永久不迁** |
| `freeos org export-standalone` 完整 Vite/Node 打包 | Phase 5 |

---

## Phase 3 进度：智能体（本切片）

按同一缝落地，**只迁组织智能体定制（Agent Studio）**。不替换 FreeOS/Octop 对话运行时，也不把个性化智能体编辑器搬进组织页。

### 与 FreeOS Agents / Experts 的关系

| 表面 | 存储 | API | 含义 |
|---|---|---|---|
| 组织智能体页 | `{FREEOS_HOME}/tenants/<id>/employees/` + `registry.json` | `GET /api/org-module/agents` · 已有 `POST /blueprints/compile` · `/employees/transition` · `/employees/spawn` | 编译 `openxyos.agent-blueprint.v1`，管理数字同事生命周期，注册为宿主聊天智能体 |
| FreeOS Experts / 个性化 | Octop `agents` 表 + 个性化编辑器 | `/experts` · `/personalization` | **运行时编辑与专家目录仍在这里。** 本页只深链 |
| sidecar Agent Studio | `routes/agent-studio.ts` | `/api/agent-studio/*` | **未挂载，不依赖。** 资料上传 / 人才市场不迁 |

目录员工（人/AI 名册）仍在 `/organization/employees`（`org_chart.sqlite`）。本页管的是 **lifecycle 数字同事**，不是第二套名册。

### 已落地

1. 壳无关组件：`dashboard/src/org-ui/pages/agents`（`AgentsPage`），数据经 `createOrgApiClient().agents`。
2. Dashboard 子路由：`/organization/agents`（工作台 path tabs + 入口卡）。
3. 宿主 API：本切片补 `GET /api/org-module/agents` 快照（同事列表、下一状态、宿主深链）。编译 / 流转 / 注册复用已有 lifecycle 路由；写操作走 `require_permission("plugins")`（管理员绕过）。
4. 导出骨架：`freeos org export-standalone` 模块列表与 `App.tsx` 同时导入 `AgentsPage`。

### 本切片明确推迟

| 推迟项 | 原因 |
|---|---|
| Chat / 从智能体页发起会话 | 对话运行时留在 FreeOS/Octop |
| 边车 `/api/agent-studio/*` 资料上传与人才市场 | sidecar 未挂载；本页不克隆上传工作室 |
| 在组织页里编辑 FreeOS 智能体 / 专家 | 运行时已在个性化与 Experts；本页只编译并深链 |
| 薄 Workspace overview | **已由 Workspace 切片完成** |
| `freeos org export-standalone` 完整 Vite/Node 打包 | Phase 5 |

---

## Phase 3 进度：工作台总览（本切片，Phase 3 收口）

按同一缝落地，**只迁薄 Workspace / OpenDashboard**。不把 `#55` `/organization` 工作台改成第二套控制面，也不迁 Chat。

### 与 #55 工作台的关系

| 表面 | 路由 | API | 含义 |
|---|---|---|---|
| 组织工作台（控制面） | `/organization` | `GET /api/org-module/overview` + assemble / pack / loop | **已有。** 装配同事、打包回写、自增长循环、可选 sidecar |
| Workspace 落地页 | `/organization/workspace`（独立站 `/app`） | **同一** `GET /api/org-module/overview` | OpenApp `/app` 等价物：状态摘要 + 链到已迁子页 |
| Chat | 不迁 | sidecar `/api/chats` | **永久不迁。** 对话走 FreeOS/Octop `/chat` |

### 已落地

1. 壳无关组件：`dashboard/src/org-ui/pages/workspace`（`WorkspacePage`），数据经 `createOrgApiClient().workspace.overview()`。
2. Dashboard 子路由：`/organization/workspace`（工作台 path tabs + 入口卡）。`/organization` 控制面保持原样。
3. 宿主 API：**无新路由。** 复用已有 `GET /api/org-module/overview`。
4. 导出骨架：`freeos org export-standalone` 模块列表与 `App.tsx` 同时导入 `WorkspacePage`。Chat 不在共享模块列表里。

### 本切片明确推迟 / 永久不做

| 项 | 原因 |
|---|---|
| Chat / 边车 inbox | **永久不迁。** 对话运行时留在 FreeOS/Octop |
| 把 assemble / pack / loop 搬进 Workspace | 会变成第二套控制面；工作台仍在 `/organization` |
| 边车 `/api/dashboard/overview` | 宿主 overview 已覆盖状态；不克隆 sidecar inbox |
| `freeos org export-standalone` 完整 Vite/Node 打包 | Phase 5 |

Phase 3 Open-12 宿主 UI 至此收口。下一步是 Phase 4 导出与 IdentityBridge。

---

## Phase 4 进度：独立站导出（本波）

按 ADR 003 把骨架导出做成 **客户能解开就跑** 的包。不搬安装器、不删 sidecar。

### 已落地

1. `freeos org export-standalone --out <dir>` 复制 `scripts/org-export/template/` + `dashboard/src/org-ui`（不含测试）。
2. 独立壳：Vite、OpenApp 风格路由、登录页、`createLocalJwtBridge`（`openxyos.standalone.jwt`，与 Dashboard `auth_token` 分离）。
3. 过渡 API：同源 `/api`，由 Vite / `server/proxy.mjs` / nginx 反代到 `FREEOS_UPSTREAM`（FreeOS `/api/org-module/*` + `/api/auth/login`）。
4. 部署物：`Dockerfile`、`docker-compose.yml`、导出目录 `README.md`、仓库 [org-export.md](org-export.md)。
5. Chat 仍不导出；`/chat`、`/experts`、`/system-settings` 为深链说明页。

### Phase 4 当时推迟、现已分流

| 项 | 现状 |
|---|---|
| 从默认安装器摘掉 sidecar | **Phase 5 已完成。** 默认 NSIS / 绿包 / Docker 零 Node；`FREEOS_ORG_SIDECAR=1` / `SHIP_OPENXYOS_RUNTIME=1` 仍可选 |
| 自包含 org-module Node/Fastify 服务 | **残留。** 过渡期仍复用宿主 BFF；`server/proxy.mjs` 是占位 |
| `packages/org-ui` 抽包 | **残留。** 导出已拷贝 org-ui；不必先拆 monorepo |

---

## Phase 5 进度：默认安装器瘦身

默认交付是 **一个 FreeOS 进程 + 宿主内 Organization**。客户不必再装第二套 Node/openXYOS。

### 已落地

1. 默认 Windows NSIS / 绿包 / Desktop CI **不** 打入 `openxyos-runtime.zip` 或 `org-sidecar`（`SKIP_ORG_SIDECAR=1`，`SHIP_OPENXYOS_RUNTIME` 默认 `0`）。
2. Setup **不** `nsExec` 预配、不解压、不等 livez、不注册开机自启；缺 zip 不是安装失败。
3. 桌面 / 主机启动默认不设 `OPENXYOS_BASE_URL`，不拉起 3780。Organization 首屏是 `/organization` + `/api/org-module/*`。
4. `modules/openxyos` 仍保留给导出 / 开发 / `FREEOS_ORG_SIDECAR=1` 高级路径，不是默认运行时。
5. 独立商业站走 `freeos org export-standalone`（[org-export.md](org-export.md)），不是默认安装器。

### 残留（不挡默认安装）

| 残留 | 说明 |
|---|---|
| 导出站自包含 org API | 仍代理到 `FREEOS_UPSTREAM`；不是第二套默认桌面运行时 |
| `packages/org-ui` 抽包 | 仅当 Dashboard Vite 图必须脱离时再做 |
| 未迁商业 `App.tsx` 路由 | 合同 / 资产 / 考勤等仍不加售进默认 Dashboard |

---

## 明确非目标

| 非目标 | 说明 |
|---|---|
| 替换 Chat 运行时 | 对话、IM、cron、sandbox 留在 FreeOS/Octop |
| 本波迁入完整 `App.tsx` 商业路由 | Open-12 以外的合同/资产/考勤等不加售进默认 Dashboard |
| 永久双进程 / 默认捆绑 Node runtime | sidecar 只是兼容阀 |
| 永远 iframe | 兼容预览可暂留 Advanced，不是已迁页的交付形态 |
| 手维护第二份独立站 | 独立站必须从 `org-ui` 生成 |
| 先重写全部 Express → FastAPI | 按切片迁 CRUD |
| 重写 `GovernanceEngine` | 治理执行已在宿主；本波只迁 UI |
| 克隆 sidecar 知识库 / 另造组织笔记表 | 组织知识桥接宿主 KB；不把 sidecar notes 与 Octop RAG 合成新表 |
| 本 PR 搬页面或改安装器 | Phase 1 只文档 |

---

## 相关文档

- [独立站导出说明](org-export.md)
- [ADR 003 — 单源双交付](adr/003-org-ui-single-source-dual-delivery.md)
- [FreeOS × openXYOS 集成架构](architecture-integration.md)
- [自增长 loop](asset-loop.md)
- [ADR 001 — 单进程](adr/001-single-process-model.md)
- [ADR 002 — SQLite / PostgreSQL](adr/002-database-backends.md)
