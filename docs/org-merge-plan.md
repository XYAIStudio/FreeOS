# 组织模块合并计划（openXYOS → FreeOS Dashboard）

**状态：** Phase 3 组织架构、员工目录、技能与治理 UI 切片已落地（宿主 org tree / 员工 CRUD + skill_bridge list/read + 治理 pauses/audit + `/organization/org` + `/organization/employees` + `/organization/skills` + `/organization/governance` + `org-ui` OrgChartPage / EmployeesPage / SkillsPage / GovernancePage + export-standalone 模块列表）。其余 Open-12 仍待切片。
**日期：** 2026-09-19
**依据：** Phase 0 迁移图、[architecture-integration.md](architecture-integration.md)、[asset-loop.md](asset-loop.md)、[ADR 001](adr/001-single-process-model.md)、#55 宿主内 Organization

Phase 1 冻结了合同。Phase 2（通知公告）与 Phase 3 的组织架构切片已按该合同落地；其余 Open-12 页仍按阶段推进。

---

## 产品意图（不可谈判）

1. **组织模块代码是唯一事实来源。**
2. openXYOS 网页成为 **FreeOS Dashboard Organization 下的子 UI**，不是第二套常驻系统。
3. 同一套源必须能 **生成** 独立 openXYOS Web，供客户自托管（商业加售）。
4. **默认一个安装器**，不强制 Node sidecar。Sidecar 仅作可选兼容（`FREEOS_ORG_SIDECAR` / `SHIP_OPENXYOS_RUNTIME`）。
5. **不用** openXYOS Chat 替换 FreeOS/Octop Agent 对话运行时。

---

## 阶段总览（0–5）

| 阶段 | 目标 | 状态 |
|---|---|---|
| **0** 宿主内地基 | `org_os` 控制面、`/api/org-module/*` BFF、Dashboard 原生工作台、sidecar 改为可选 | **已完成**（#55） |
| **1** 合同冻结 | ADR + 本计划：单源双交付、包布局、API 归属、IdentityBridge、Phase 2 验收 | **本文** |
| **2** 垂直切片 | **通知公告 Announcements** 按合同落地（Dashboard 路由 + 可导出同一页面） | **已完成** |
| **3** Open-12 其余页 | 工作台、组织架构、员工、技能、智能体、任务、知识、反思、治理 UI、设置 | **进行中**：组织架构、员工目录、技能与治理 UI 已迁；其余未开始 |
| **4** 身份与 CRUD | 已迁页面走 IdentityBridge；业务 CRUD 按切片迁入宿主；未迁路由仍可代理到可选 sidecar | 与 2–3 交叉推进 |
| **5** 导出与安装器 | `freeos org export-standalone` 产出独立站；默认安装器保持零 Node | 未开始 |

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
| workspace | OpenApp `/app` | sidecar dashboard/inbox | Phase 3：Dashboard `/organization` 工作台扩展，复用 #55 原生页 |
| **announcements** | OpenApp `/announcements` | sidecar `/api/announcements` | **Phase 2 切片** |
| organization | OpenApp `/org` | sidecar `/api/org` | **Phase 3 切片已落地**：`/organization/org` + `/api/org-module/org` |
| employees | OpenApp `/employees` | sidecar `/api/employees` + 宿主 lifecycle `/api/org-module/employees` | **Phase 3 切片已落地**：`/organization/employees` 目录 CRUD 复用 `org_chart.sqlite`；lifecycle / spawn **已在宿主，勿重复造** |
| skills | OpenApp `/skills` | sidecar `/api/skills` + 宿主 `skill_bridge` | **Phase 3 切片已落地**：`/organization/skills` 列出 `{FREEOS_HOME}/org-skills` 并 generate/publish；宿主 skill packages 只读列出（Agent Skills 运行时仍在个性化）。未迁：边车市场 / 插件中心 / 付费安装 |
| **chat** | OpenApp `/chat` | sidecar `/api/chats` | **不迁。** 对话走 FreeOS/Octop |
| agents | OpenApp `/agents`（Agent Studio） | 源码有 `routes/agent-studio.ts`，**`server.ts` 当前未 `app.use`** | Phase 3 前必须先核实挂载；未挂载则只迁 UI、API 在宿主补齐 |
| tasks | OpenApp `/tasks` | sidecar `/api/tasks` | Phase 3 |
| knowledge | OpenApp `/knowledge` | sidecar `/api/knowledge` | Phase 3；与宿主知识库边界保持「组织资料 ≠ Octop RAG 库」直到单独立项 |
| reflections | OpenApp `/reflections` | sidecar `/api/reflections` | Phase 3 |
| governance UI | OpenApp `/governance` | sidecar `/api/governance` + 宿主 `org_os/governance` | **Phase 3 切片已落地**：`/organization/governance` 展示待审批 / 审计 / 裁决；PEP/PDP 与 durable pause **已在宿主，勿重写引擎**。未迁：边车权限矩阵、通信规则、流程模板 |
| settings | OpenApp `/settings` | sidecar `/api/settings`、`/api/module-settings` | Phase 3：租户/模块开关；宿主已有 `PATCH /api/org-module` 与 `/modules` |

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

命令草图（Phase 5，本文不实现）：

```bash
uv run freeos org export-standalone --out dist/openxyos-web
```

导出物是可部署的独立 Web（自带或可接客户的 openXYOS 后端），**不是** 再维护一份 `AnnouncementPage.tsx`。

---

## API 归属

### 宿主 BFF（已存在，继续作为控制面入口）

前缀：`/api/org-module/*`

| 路由簇 | 归属 | 迁 UI 时 |
|---|---|---|
| `status` · `catalog` · `overview` · `PATCH ""` · `modules` | 宿主 | 保持 |
| `assemble` · `produce` · `pack` · `loop/run` | 宿主 loop | 保持 |
| `employees` · `employees/transition` · `employees/spawn` | 宿主 lifecycle | 保持；与员工 **目录 CRUD** 分开 |
| `assets/*` · `blueprints/compile` · `skills` list/read/generate/publish | 宿主工厂 | **已挂 UI**。list/read 补目录；generate/publish 仍管理员/`plugins` 门控 |
| `governance/check\|resolve\|audit` · `pauses` | 宿主 PEP/PDP | **已挂 UI**。`GET /pauses` 补列出待审批；resolve 仍管理员/`plugins` 门控 |
| `sidecar/*` · `source/download` | 可选兼容 | 留在 Advanced；默认路径不依赖 |

### 业务 CRUD（当前 sidecar Express → 按切片迁入宿主）

| 资源 | 今日 | Phase 2+ 路径 |
|---|---|---|
| 公告 | `GET/POST/PUT/DELETE /api/announcements` | **先迁。** 宿主实现（建议 `/api/org-module/announcements` 或宿主挂 `/api/announcements`），`org-ui` client factory 指向宿主。独立导出站可同路径或经适配器改 base URL |
| 组织树 | sidecar `/api/org` | **已迁。** 宿主 `/api/org-module/org`（tree / departments / employees 目录 CRUD），`{FREEOS_HOME}/org/org_chart.sqlite`。未迁：versions、reporting-lines、skills、import、头像上传 |
| 员工目录 | sidecar `/api/employees` | **已迁目录 CRUD。** 宿主 `/api/org-module/org/employees*`，与 org chart **同一** `{FREEOS_HOME}/org/org_chart.sqlite`。lifecycle 仍是 `GET /api/org-module/employees`（同事 registry）。未迁：人才市场、备选入职、资产离职清算、绩效、汇报线、技能绑定、头像上传 |
| 任务 / 知识 / 反思 / 设置 | sidecar `/api/tasks` 等 | Phase 3 其余页：同一模式，迁完才摘代理 |
| 未迁资源 | sidecar 或 `/api/org-module/sidecar/api/<resource>` 代理 | 可选 sidecar 仍可用；默认安装不启动它 |
| Chat | sidecar `/api/chats` | **永久不迁** |

迁 CRUD **不是** 把整个 Express 重写成 FastAPI 当先决条件（见 ADR 003 否决项）。切片证明：该页不再打 `:3780`，也不再 iframe。

### 数据落点（提醒）

宿主耐久状态在 `FREEOS_HOME`（治理 pause、同事 registry、mirror）。Sidecar SQL.js **不是** 生产 SoT。公告切片需明确：行写入宿主库（SQLite/PG，ADR 002）或 `FREEOS_HOME` 租户目录，而不是暗依赖 sidecar DB。

---

## IdentityBridge 草图

今日 BFF 已把 FreeOS 用户映射为 `X-FreeOS-User` / `X-FreeOS-User-Id` / `X-FreeOS-Role` / `X-FreeOS-Tenant-Id`，并 **剥离** `Authorization`，避免把宿主 JWT 当成 sidecar session（`proxy.py` → `identity_headers`）。那是代理模型，不是最终 UX。

目标：页面只依赖桥，不依赖「第二套登录墙」。

```
org-ui  →  IdentityBridge.getSession()
            IdentityBridge.authHeaders()
            IdentityBridge.apiBase()

嵌入 Dashboard（默认）：
  session = FreeOS JWT / 当前用户
  apiBase = 同源 /api
  无第二次登录

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
4. 导出骨架：`freeos org export-standalone --out …` 写出共享模块列表 + 导入同一 `AnnouncementPage` 的 `App.tsx`（完整 Vite/Node 打包仍是 Phase 5 TODO）。

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
| 其余 Open-12（智能体、任务、知识、反思、设置） | 后续切片 |
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
| 其余 Open-12（智能体、任务、知识、反思、设置） | 后续切片 |
| `freeos org export-standalone` 完整 Vite/Node 打包 | Phase 5 |

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
| 把 Octop 知识库与组织知识混成一个表 | 除非单独立项 |
| 本 PR 搬页面或改安装器 | Phase 1 只文档 |

---

## 相关文档

- [ADR 003 — 单源双交付](adr/003-org-ui-single-source-dual-delivery.md)
- [FreeOS × openXYOS 集成架构](architecture-integration.md)
- [自增长 loop](asset-loop.md)
- [ADR 001 — 单进程](adr/001-single-process-model.md)
- [ADR 002 — SQLite / PostgreSQL](adr/002-database-backends.md)
