# openXYOS → FreeOS 能力迁移图（P0.2）

**状态：** Wave 2 宿主原生组织（2026-09-20）加深了公告已读名单、任务附件、架构图汇报线/部门类型/导入、工作台与总览内联批准治理暂停、以及目录启用 UX。计数不变：9 native / 11 slice / 12 iframe。Wave 1 人才市场仍是 `org_ui_slice`。

**语言：** [English](org-capability-migration-map.md) · 简体中文

**机器可读：** [org-capability-migration-map.json](org-capability-migration-map.json)

本文回答：哪些能力已经在 FreeOS/Octop **宿主原生**，哪些仍在托管 Node / iframe 上，下一步迁什么。不改运行时代码。

产品意图以 [product-contract.zh-CN.md](product-contract.zh-CN.md) 为准（P0.1，已随 #73 合入 `main`）。北极星：

- 终态：把 openXYOS 的网页与组织能力 **迁进** 宿主（原生）。不是长期附带一套大型 Node。
- 桌面里的托管 Node + iframe 只是 **过渡桥**。
- 双入口：本机工作室 vs 组织像另一间可独立布置的 **房间**。面向用户的表述保持柔和；实现上 **两套身份空间分开**。
- 双向资产；可导出 openXYOS 源码供商业化；本地模型与知识库。
- 口号：中文「FreeOS：自由的 AI 工作室，想象空间由你来打开」· 英文「Your FreeOS, free for you.」

旧合并文档（[org-merge-plan.md](org-merge-plan.md)、[org-full-integration.md](org-full-integration.md)、[ADR 003](adr/003-org-ui-single-source-dual-delivery.md)）记录工程史。若其中仍写「组织登录是唯一身份权威」或「永久保留 Node」，本图以产品契约为准。

## 总表

| 状态 | 数量 | 含义 |
|---|---:|---|
| `native_host` | 9 | 宿主 Python/React 已拥有该能力（深度仍可能不够）。 |
| `org_ui_slice` | 11 | 共享 `dashboard/src/org-ui` + `/api/org-module/*`，比原 App.tsx 薄。 |
| `managed_node_iframe` | 12 | 完整原 UI/API 仍依赖桌面 `FREEOS_ORG_INTEGRATED` iframe 或 Node 代理。 |
| `sidecar_optional` | 1 | 可选 `:3780`（`FREEOS_ORG_SIDECAR`）。 |
| `export_only` | 1 | 商业导出流水线；不是默认桌面运行时。 |
| `missing` | 0 | 没有整域在两边都不存在；缺口是深度/对等，不是空名。 |
| **合计** | **34** | |

优先级：**P0 = 7**（波次 A–D）· **P1 = 17** · **P2 = 10**。

| 域 | 状态 | 依赖 Node？ | 商业导出？ | 优先级 | 下一步（一行） |
|---|---|---|---|---|---|
| [双向资产总线](#1-双向资产总线) | native_host | 部分 | 是 | P0 | apply/循环把员工/人才落到宿主 sqlite，不依赖 Node；插件/MCP ingest 仍可选 Node。 |
| [独立站导出](#2-独立站导出商业加售) | export_only | 部分 | 是 | P0 | 默认 `--mode full` 写出 openXYOS **源码树**；`--mode slice` 仍是 SPA+反代宿主桥。 |
| [租户与身份（双入口）](#3-租户与身份双入口) | managed_node_iframe | 部分 | 是 | P0 | 两套身份空间；组织房间不再以 Node `/api/auth` 为权威。 |
| [本地模型](#4-本地模型) | native_host | 部分 | 是 | P0 | 组织房间使用工作室同一套本机模型池，而不是边车 `/api/settings/ai`。 |
| [宿主知识库](#5-宿主知识库) | native_host | 否 | 部分 | P0 | 默认本地 RAG；云连接器可选。 |
| [组织知识](#6-组织知识笔记文件) | org_ui_slice | 部分 | 是 | P0 | 上传/文件夹/再解析走宿主 KB；不克隆边车 notes 库。 |
| [蓝图与编译器](#10-蓝图与编译器) | native_host | 否 | 是 | P0 | 编译结果进入资产总线，便于导出蓝图源。 |
| [托管 Node + iframe 壳](#7-托管-node--iframe-壳) | managed_node_iframe | 是 | 否 | P1 | 首页已是原生工作台；iframe 仅作原 App 过渡入口。收缩运行时。 |
| [模块目录](#9-模块目录) | native_host | 否 | 是 | P1 | 设置/工作台展示 `delivery`/`host_path`；App.tsx 垂类原生迁入时扩展 key。 |
| [同事生命周期](#11-同事生命周期) | native_host | 否 | 是 | P1 | 与员工目录 / 人才市场 UI 打通。 |
| [治理](#12-治理引擎--ui) | native_host | 部分 | 是 | P1 | 工作台/总览可内联批准宿主暂停；仍迁权限矩阵/通信规则。 |
| [组织工作台](#13-组织工作台装配--打包--循环) | native_host | 否 | 部分 | P1 | 即便桌面集成，首页仍是原生工厂；原 App 只是过渡链接。 |
| [工作台总览](#14-工作台总览) | org_ui_slice | 部分 | 是 | P1 | 内联批准暂停；OpenDashboard 仍在 Node。 |
| [通知公告](#15-通知公告) | org_ui_slice | 否 | 是 | P1 | 宿主已读名单；其余原页字段仍可补。 |
| [组织架构](#16-组织架构) | org_ui_slice | 部分 | 是 | P1 | 汇报线、部门类型、JSON 导入已在宿主 sqlite；版本/头像仍在原 App。 |
| [员工目录](#17-员工目录) | org_ui_slice | 部分 | 是 | P1 | 人才页共用 sqlite；入职/离职仍在原 App。 |
| [人才市场](#18-人才市场) | org_ui_slice | 部分 | 是 | P1 | 宿主列表/招募 + 资产总线落地；再补原 App 筛选深度。 |
| [技能插件](#19-技能插件) | org_ui_slice | 部分 | 是 | P1 | 市场可留到导出；目录已在宿主。 |
| [智能体定制](#20-智能体定制) | org_ui_slice | 部分 | 是 | P1 | 资料上传；不要依赖未挂载的边车 studio API。 |
| [组织任务](#21-组织任务) | org_ui_slice | 否 | 是 | P1 | 宿主附件在 `org/task-files`；不是 cron/Chat。 |
| [反思引擎](#22-反思引擎) | org_ui_slice | 否 | 是 | P1 | 仅迁原页仍引用的边车附加能力。 |
| [组织设置](#23-组织设置) | org_ui_slice | 部分 | 是 | P1 | 目录启用展示 delivery；公司/角色/备份仍在原 App。 |
| [组织沟通](#24-组织沟通协作) | managed_node_iframe | 是 | 是 | P1 | 原生组织会话；**不要**替换 Octop 智能体对话。 |
| [源码下载](#34-openxyos-源码下载) | native_host | 否 | 是 | P1 | 与波次 B 导出物合一，不要三套「源码」。 |
| [可选 :3780 边车](#8-可选-node-边车3780) | sidecar_optional | 是 | 否 | P2 | 原生覆盖完成前可选用；不打进默认安装器。 |
| [流程引擎](#25-流程引擎) | managed_node_iframe | 是 | 是 | P2 | 宿主库 + 设计器；人事单据依赖它。 |
| [合同](#26-合同) | managed_node_iframe | 是 | 是 | P2 | 放在流程之后（审批/付款）。 |
| [实物资产台账](#27-实物资产台账) | managed_node_iframe | 是 | 是 | P2 | 台账 ≠ `freeos.asset-pack.v1`。 |
| [考勤 / 请假 / 报销 / 日报](#28-考勤--请假--报销--日报) | managed_node_iframe | 是 | 是 | P2 | 作为一簇放在流程之后。 |
| [目标 / 预算 / 例行 / 绩效 / 效率](#29-目标--预算--例行--绩效--效率) | managed_node_iframe | 是 | 是 | P2 | 放在任务 + 组织架构之后。 |
| [组织审计](#30-组织审计) | managed_node_iframe | 是 | 是 | P2 | 与宿主治理审计合一。 |
| [后台 / 租户 / 支付](#31-后台--租户--支付) | managed_node_iframe | 是 | 部分 | P2 | 拆开 SaaS 账单与房间需要的租户 CRUD。 |
| [客户服务](#32-客户服务) | managed_node_iframe | 是 | 部分 | P2 | 在盘点内；仅当导出仍带该路由才原生迁。 |
| [电力交易](#33-电力交易) | managed_node_iframe | 是 | 部分 | P2 | 同上；更像行业演示。 |

## 建议波次（P0.1 之后）

与产品顺序对齐：**资产总线 → 导出 → 双身份 UX → 本地模型/知识库 → 拆除 Node**。

| 波次 | 优先级 | 要做 | 不要做 |
|---|---|---|---|
| **A. 资产总线** | P0 | 宿主自有 pack / ingest / apply，使 FreeOS 与组织房间交换员工、技能、插件、MCP，不必等 Node HTTP 健康。 | 把 `{FREEOS_HOME}/openxyos-mirror/` 加可选 `/api/freeos/ingest` 当成双向产品已完成。 |
| **B. 导出** | P0 | 生成可商业化的 **openXYOS 源码树**。 | 把 `export-standalone`（Vite SPA + 反代到 FreeOS `/api/org-module`）冻成商业交付物。 |
| **C. 双身份 UX** | P0 | 工作室 vs 组织**房间**；实现上两套身份空间分开。用户文案保持柔和。 | 让组织注册成为宿主权威，或两间房共用一道登录墙。 |
| **D. 本地模型 / 知识库** | P0 | 默认对话、RAG、组织知识跑在操作者机器上。 | 组织 LLM/KB 只能走 Node `/api/settings/ai` 或厂商云。 |
| **E. 拆除 Node** | P1→P2 | 把仍在 iframe 里的 App 面原生迁入（先补 Open-12 深度，再商业垂类），然后去掉托管 Node。 | 把 Node 重新打进默认安装器，或宣称 iframe「已完成」。 |

## 不要当成终态

这些出货形态仍需原生迁入。它们是桥。

1. **桌面集成 iframe** 嵌入完整 App — `FREEOS_ORG_INTEGRATED=1`（`desktop/src/process.go`）仍把 `/organization-app` 代理到托管 Node。`/organization` 已是 **原生工作台**；原 App 只是可选过渡链接（`OrganizationEntry.tsx`）。FastAPI `org_ui.py` 把 `/organization-app` 代理到私有端口上的 Node。
2. **`ManagedOrganizationRuntime`** — `src/octop/modules/org_os/managed_runtime.py`（重启循环、本机 `OPENXYOS_BASE_URL`）。
3. **`/api/org-module/identity/*` 与 `/business/*`** — `org_identity.py` 把登录/注册和业务 CRUD 转发到 Node `/api/auth` 与 `/api/*`。
4. **可选 `:3780` 边车** — `FREEOS_ORG_SIDECAR` / `SHIP_OPENXYOS_RUNTIME`。Phase 5 默认安装器已经零 Node；不要倒退。开关表与拆除计划：[node-runtime.zh-CN.md](node-runtime.zh-CN.md)。
5. **尚未达到 App 对等的 Open-12 宿主切片** — [org-full-parity-inventory.json](org-full-parity-inventory.json) 里 `host_route_exists=true` **不等于**验收。清单把每条路由记为 `parity=not_accepted`。仍缺：人才市场筛选深度、插件市场、组织沟通、公司/AI/数据库设置、架构图版本/头像……
6. **遗留 `OrgMiniBrowser.tsx`** — 未再被路由引用的 iframe 壳。不要把它复活成 Organization 首页。

## 证据规则

- 优先使用 [org-full-parity-inventory.json](org-full-parity-inventory.json)（`scripts/org-parity-inventory.py`）、[org-full-integration.md](org-full-integration.md)、[org-merge-plan.md](org-merge-plan.md)、Dashboard `routeConfigs`、`modules/openxyos` 的 `App.tsx` / `OpenApp.tsx`、以及 `src/octop/modules/org_os/`。
- 清单自身的限制：静态扫描；有路由 ≠ 功能对等。
- 各域的 **未知项** 单独标出，不编造字段对照。
- 当前 `main` 上实际有两套运行形态：
  - **源码 `freeos run`**（未设 `FREEOS_ORG_INTEGRATED`）：原生工作台 + org-ui 切片；Node 边车可选。
  - **桌面 0.0.3**：集成 Node + iframe 完整 App.tsx。这是桥，不是目的地。

## 各域

### 1. 双向资产总线

| | |
|---|---|
| **今日位置** | `src/octop/modules/org_os/assets/`（`freeos.asset-pack.v1`）、`apply/apply.py`（边车健康时 `POST /api/freeos/ingest`；始终写 `{FREEOS_HOME}/openxyos-mirror/`）、`freeos org assets *`、组织工作台 assemble/pack/loop、`modules/openxyos/backend/routes/freeos-bridge.ts` |
| **状态** | `native_host` |
| **依赖 Node？** | 部分 |
| **商业导出？** | 是 |
| **优先级** | P0 · 波次 A |
| **下一步** | apply/循环把员工与人才落到宿主 `org_chart.sqlite`，不依赖 Node。插件/MCP ingest 在 Node 健康时仍是尽力而为。 |
| **测试** | `tests/unit/test_asset_loop.py`、`test_openxyos_apply.py`、`test_org_loop.py`、`tests/e2e/test_org_growth_loop.py` |
| **未知** | 独立商业导出是只带 CLI 工厂，还是应用内操作。 |

### 2. 独立站导出（商业加售）

| | |
|---|---|
| **今日位置** | `export_standalone.py`、`freeos org export-standalone`（默认 `--mode full` 拷贝 `modules/openxyos` + `slice/`）、`scripts/org-export/template/` + `pack/`、拷贝 `dashboard/src/org-ui`、[org-export.md](org-export.md) |
| **状态** | `export_only` |
| **依赖 Node？** | 部分（完整树 **运行** 需要 Node；slice 仍反代到 FreeOS） |
| **商业导出？** | 是 |
| **优先级** | P0 · 波次 B |
| **下一步** | 与 `POST /api/org-module/source/download` 合一；slice 内自包含 API 仍可选。不要把仅 slice 的 SPA+反代冻成商业交付物。 |
| **测试** | `tests/unit/cli/test_org_export_standalone.py` |
| **未知** | slice 内自包含 org API 仍是跟进项，未实现。 |

### 3. 租户与身份（双入口）

| | |
|---|---|
| **今日位置** | 工作室：未集成时 FreeOS JWT（`api/routers/auth.py`）。组织房间（桌面）：`integration.py` 用边车 `GET /api/auth/me` 校验 Bearer。`org_identity.py` 登录/注册/刷新。Login/AuthGuard 按 `integrated` 分支。导出站：本地 JWT 再 `POST` FreeOS `/api/auth/login`。 |
| **状态** | `managed_node_iframe`（组织房间权威仍在 Node） |
| **依赖 Node？** | 部分 |
| **商业导出？** | 是 |
| **优先级** | P0 · 波次 C |
| **下一步** | **两套身份空间**分开。用户侧：工作室 vs 另一间房。组织房间不再以 Node `/api/auth` 为权威。不要把两个入口收成一次登录。 |
| **测试** | `dashboard/src/components/AuthGuard.test.tsx`；org-module 代理头测试 |
| **未知** | `org-full-integration.md` 仍写组织登录是唯一权威——P0.1 之后视为历史。导出站打 FreeOS `/api/auth` 与「两套空间」冲突，除非商业包长出自己的组织账号。 |

### 4. 本地模型

| | |
|---|---|
| **今日位置** | 设置向导默认先选 Ollama；Dashboard 模型页「本地」标签（Ollama/GGUF、测速、设为默认）；`infra/agents/providers/local_register.py`。组织设置里的 AI 仍是 Node `/api/settings/ai`。 |
| **状态** | `native_host`（工作室） |
| **依赖 Node？** | 部分 |
| **商业导出？** | 是 |
| **优先级** | P0 · 波次 D |
| **下一步** | 组织房间使用同一套本机模型池；不要把组织 LLM 留在边车设置。 |
| **测试** | `dashboard/src/pages/Settings/Models/presetUtils.test.ts`；`tests/unit/utils/test_local_endpoint.py` |
| **未知** | 没有测试断言组织页调用宿主本地供应商。 |

### 5. 宿主知识库

| | |
|---|---|
| **今日位置** | `/knowledge-bases`，Octop `KnowledgeService`。空状态先引导本机文件夹挂接；向量默认本机 ONNX。 |
| **状态** | `native_host` |
| **依赖 Node？** | 否 |
| **商业导出？** | 部分 |
| **优先级** | P0 · 波次 D |
| **下一步** | 本地文件夹挂接/嵌入保持默认；WeKnora/IMA 仍是可选连接器。 |
| **测试** | `KnowledgeMountHome.test.tsx`；`tests/unit/knowledge/test_gate.py` |
| **未知** | WeKnora/IMA 连接器仍在；云端保持可选。 |

### 6. 组织知识（笔记/文件）

| | |
|---|---|
| **今日位置** | org-ui `KnowledgePage` + `/api/org-module/knowledge*` 包装宿主 KB。原 `KnowledgePage.tsx` + 边车 `/api/knowledge` 文件/笔记。 |
| **状态** | `org_ui_slice` |
| **依赖 Node？** | 部分 |
| **商业导出？** | 是 |
| **优先级** | P0 · 波次 D |
| **下一步** | 上传/文件夹/再解析对等到宿主库；不克隆边车 notes DB。 |
| **测试** | `tests/unit/test_org_knowledge.py`、`KnowledgePage.test.tsx` |

### 7. 托管 Node + iframe 壳

| | |
|---|---|
| **今日位置** | `managed_runtime.py`、`/organization-app`、`OrganizationEntry.tsx`（原生首页；原 App 是过渡链接）、openXYOS Vite `base: /organization-app/` |
| **状态** | `managed_node_iframe` |
| **依赖 Node？** | 是 |
| **商业导出？** | 否（桥，不是可售产物） |
| **优先级** | P1 · 波次 E |
| **下一步** | Organization 首页已经是原生工作台。其余 App 垂类原生迁入后再收缩并去掉托管进程。开关见 [node-runtime.zh-CN.md](node-runtime.zh-CN.md)。`uv run` / Docker 保持零 Node。桌面 CI 可设 `SHIP_OPENXYOS_RUNTIME=1`（过渡）。不要把该开关扩成永久产品。 |
| **测试** | `tests/unit/api/test_org_ui.py`、`tests/integration/test_dashboard_serve.py`、`OrganizationEntry.test.tsx` |

### 8. 可选 Node 边车（:3780）

| | |
|---|---|
| **今日位置** | `FREEOS_ORG_SIDECAR`、`sidecar_launch.py`、`/api/org-module/sidecar/{path}` |
| **状态** | `sidecar_optional` |
| **依赖 Node？** | 是 |
| **商业导出？** | 否 |
| **优先级** | P2 · 波次 E |
| **下一步** | 原生覆盖完成前可选用；不要重新打进默认安装器。见 [node-runtime.zh-CN.md](node-runtime.zh-CN.md)。 |
| **测试** | `tests/unit/test_org_module.py` |

### 9. 模块目录

| | |
|---|---|
| **今日位置** | `org_os/catalog.py`（12 个 Open-12 key）↔ `open-module-catalog.ts`；`module_toggles.py`；`org-ui/contract.ts` |
| **状态** | `native_host` |
| **依赖 Node？** | 否 |
| **商业导出？** | 是 |
| **优先级** | P1 |
| **下一步** | 设置与工作台已展示 `delivery` / `host_path`。App.tsx 垂类原生迁入时扩展 key；保持漂移测试绿色。 |
| **测试** | `test_org_module.py` 中的目录对照 |

### 10. 蓝图与编译器

| | |
|---|---|
| **今日位置** | `org_os/compiler/`、`POST /api/org-module/blueprints/compile`、`freeos org compile-blueprint` |
| **状态** | `native_host` |
| **依赖 Node？** | 否 |
| **商业导出？** | 是 |
| **优先级** | P0 · 波次 A |
| **下一步** | 编译后的蓝图走资产总线，定制组织可不靠边车导出源。 |
| **测试** | `test_blueprint_compiler.py`、`test_colleague_spawn.py` |

### 11. 同事生命周期

| | |
|---|---|
| **今日位置** | `org_os/lifecycle/`、`runtime/spawn.py`、`/api/org-module/employees*`、`freeos org employee *` |
| **状态** | `native_host` |
| **依赖 Node？** | 否 |
| **商业导出？** | 是 |
| **优先级** | P1 |
| **下一步** | 一条原生流：目录 + 人才 + `draft → market → recruit → shadow → active`。 |
| **测试** | `test_lifecycle.py`、`test_colleague_spawn.py` |

### 12. 治理（引擎 + UI）

| | |
|---|---|
| **今日位置** | 宿主 PEP/PDP/pause/MCP；org-ui 待审批/审计。边车 `/api/governance` 权限矩阵、通信规则、模板 **未迁**。 |
| **状态** | `native_host`（引擎） |
| **依赖 Node？** | 部分 |
| **商业导出？** | 是 |
| **优先级** | P1 |
| **下一步** | 工作台与总览可内联批准/驳回宿主 PEP 暂停。仍把矩阵/规则/模板迁到宿主引擎；不要重写 PEP/PDP。 |
| **测试** | `test_org_governance.py`、`test_host_governance.py`、`GovernancePage.test.tsx` |

### 13. 组织工作台（装配 / 打包 / 循环）

| | |
|---|---|
| **今日位置** | `/organization` 原生 Ant Design 工厂（`index.tsx`）。桌面 `integrated=true` 时仍以本页为首页；原 App 只是可选过渡链接。 |
| **状态** | `native_host` |
| **依赖 Node？** | 否 |
| **商业导出？** | 部分 |
| **优先级** | P1 |
| **下一步** | 工作室工厂与组织房间都可到达；iframe 不得吞掉 `/organization`。 |
| **测试** | `dashboard/src/pages/Organization/index.test.tsx`、`OrganizationEntry.test.tsx` |

### 14. 工作台总览

| | |
|---|---|
| **今日位置** | 薄 `WorkspacePage` + `GET /api/org-module/overview`。原 OpenDashboard `/app` `/workspace`；商业 Dashboard `/` `/dashboard` **没有**宿主路由。 |
| **状态** | `org_ui_slice` |
| **依赖 Node？** | 部分 |
| **商业导出？** | 是 |
| **优先级** | P1 |
| **下一步** | OpenDashboard / 商业 Dashboard 仍在 Node。宿主总览已列出待处理暂停，管理员可在页内批准/驳回。 |
| **测试** | `test_org_workspace.py`、`WorkspacePage.test.tsx` |

### 15. 通知公告

| | |
|---|---|
| **今日位置** | org-ui + `{FREEOS_HOME}/org/announcements.sqlite` + 原 `AnnouncementPage` |
| **状态** | `org_ui_slice` |
| **依赖 Node？** | 否 |
| **商业导出？** | 是 |
| **优先级** | P1 |
| **下一步** | 已读/访客名单已在宿主库。其余原页附加能力再补。 |
| **测试** | `test_org_announcements.py`、`AnnouncementPage.test.tsx` |

### 16. 组织架构

| | |
|---|---|
| **今日位置** | org-ui 树/CRUD 在 `org_chart.sqlite`，含汇报线、部门类型与 JSON 导入。原页的版本、头像仍在 Node。 |
| **状态** | `org_ui_slice` |
| **依赖 Node？** | 部分 |
| **商业导出？** | 是 |
| **优先级** | P1 |
| **下一步** | 版本与头像仍在原 App。汇报线、部门类型、JSON 导入已落到同一 sqlite。 |
| **测试** | `test_org_chart.py`、`OrgChartPage.test.tsx` |

### 17. 员工目录

| | |
|---|---|
| **今日位置** | org-ui 员工与架构 **共用** `org_chart.sqlite`。人才市场页签与资产总线落地共用这份库。原页入职/备选/离职/绩效仍在 Node。 |
| **状态** | `org_ui_slice` |
| **依赖 Node？** | 部分 |
| **商业导出？** | 是 |
| **优先级** | P1 |
| **下一步** | 入职/离职/绩效不要另开第二套员工库。 |
| **测试** | `EmployeesPage.test.tsx`、`EmployeeDetailPage.test.tsx` |

### 18. 人才市场

| | |
|---|---|
| **今日位置** | org-ui 员工人才页签 + `/api/org-module/talent*`，写在 `org_chart.sqlite` 的 `talent_pool`。原 `/api/talent` 的筛选深度仍在 Node。 |
| **状态** | `org_ui_slice` |
| **依赖 Node？** | 部分 |
| **商业导出？** | 是 |
| **优先级** | P1 |
| **下一步** | 对照原 App 补分类筛选、智能体定制发布到市场、离职。宿主列表/招募与资产总线落地已不依赖 Node。 |
| **测试** | `test_org_talent.py`、`test_org_chart.py`、`EmployeesPage.test.tsx` |

### 19. 技能插件

| | |
|---|---|
| **今日位置** | org-ui 通过 `skill_bridge` 列出 `{FREEOS_HOME}/org-skills`。边车市场 `/api/plugins` 未迁。 |
| **状态** | `org_ui_slice` |
| **依赖 Node？** | 部分 |
| **商业导出？** | 是 |
| **优先级** | P1 |
| **下一步** | 默认安装宿主目录即可；付费市场放到导出或更后。 |
| **测试** | `test_org_skills.py`、`test_skill_bridge.py`、`SkillsPage.test.tsx` |

### 20. 智能体定制

| | |
|---|---|
| **今日位置** | org-ui AgentsPage → 编译 + 生命周期。原 `AgentStudioPage`；边车 `routes/agent-studio.ts` 在 `server.ts` **未** `app.use`（源码缺口）。 |
| **状态** | `org_ui_slice` |
| **依赖 Node？** | 部分 |
| **商业导出？** | 是 |
| **优先级** | P1 |
| **下一步** | 原生资料上传 + 人才登记；不要等未挂载的边车 studio。 |
| **测试** | `test_org_agents.py`、`AgentsPage.test.tsx` |
| **未知** | 先确认原 studio API 缺口，再决定是否算迁移阻塞。 |

### 21. 组织任务

| | |
|---|---|
| **今日位置** | org-ui + `tasks.sqlite`。不是 Octop cron，也不是 Chat。 |
| **状态** | `org_ui_slice` |
| **依赖 Node？** | 否 |
| **商业导出？** | 是 |
| **优先级** | P1 |
| **下一步** | 附件落在 `{FREEOS_HOME}/org/task-files`。组织任务仍区别于 Octop cron 与 Chat。 |
| **测试** | `test_org_tasks.py`、Tasks 页测试 |

### 22. 反思引擎

| | |
|---|---|
| **今日位置** | org-ui + `reflections.sqlite` |
| **状态** | `org_ui_slice` |
| **依赖 Node？** | 否 |
| **商业导出？** | 是 |
| **优先级** | P1 |
| **下一步** | 仅当原页仍需要时再迁边车技能统计。 |
| **测试** | `test_org_reflections.py`、`ReflectionsPage.test.tsx` |

### 23. 组织设置

| | |
|---|---|
| **今日位置** | org-ui 模块开关 + `prefs.json`。原 SettingsPage：公司/AI/用户/数据库/租户仍在 Node。FreeOS `/system-settings` 是 **工作室**侧。 |
| **状态** | `org_ui_slice` |
| **依赖 Node？** | 部分 |
| **商业导出？** | 是 |
| **优先级** | P1 |
| **下一步** | 目录启用已展示 `delivery`/`host_path`。房间侧公司/角色/备份仍在原 App；不要把工作室密钥/时区抄进组织设置。 |
| **测试** | `test_org_settings.py`、`SettingsPage.test.tsx` |

### 24. 组织沟通协作

| | |
|---|---|
| **今日位置** | `ChatPage.tsx` + 边车 `/api/chats` + WebSocket。**没有** `/organization/chat`。FreeOS `/chat` 是智能体运行时——两类都保留。导出目前只深链说明页。 |
| **状态** | `managed_node_iframe` |
| **依赖 Node？** | 是 |
| **商业导出？** | 是 |
| **优先级** | P1 |
| **下一步** | 原生组织房间/提及/置顶。**不要**替换 Octop 智能体对话。Open-12 计划里「Chat 永久不迁」不是产品终态（见 [org-full-integration.md](org-full-integration.md)）。 |
| **测试** | 宿主无 |
| **未知** | 复用网关 threads 还是新建 `org_os` 库尚未决定。 |

### 25. 流程引擎

| | |
|---|---|
| **今日位置** | `WorkflowPage` + 设计器；`/api/workflows` 与 `/api/workflows-v2`。仅 App.tsx。 |
| **状态** | `managed_node_iframe` |
| **依赖 Node？** | 是 |
| **商业导出？** | 是 |
| **优先级** | P2 |
| **下一步** | 盘点 v2 设计器/实例/任务 API，再做宿主库 + org-ui。请假/报销/日报依赖它。 |
| **未知** | v1 与 v2 重叠是原系统复杂度。 |

### 26. 合同

| | |
|---|---|
| **今日位置** | `ContractPage` + `/api/contracts*`（审批、付款、甘特）。仅 App.tsx。 |
| **状态** | `managed_node_iframe` |
| **依赖 Node？** | 是 |
| **商业导出？** | 是 |
| **优先级** | P2 |
| **下一步** | 放在流程之后。 |

### 27. 实物资产台账

| | |
|---|---|
| **今日位置** | `/assets`、`/assets/count`、`/assets/dashboard`、`/assets/vehicles`、`/assets/procurement`、`/assets/:id`。**不是** `freeos.asset-pack.v1`。 |
| **状态** | `managed_node_iframe` |
| **依赖 Node？** | 是 |
| **商业导出？** | 是 |
| **优先级** | P2 |
| **下一步** | 波次 A 之后再迁台账（不要混用两个「资产」）。 |

### 28. 考勤 / 请假 / 报销 / 日报

| | |
|---|---|
| **今日位置** | App.tsx 四页；请假/报销/日报调用 `workflows-v2`。 |
| **状态** | `managed_node_iframe` |
| **依赖 Node？** | 是 |
| **商业导出？** | 是 |
| **优先级** | P2 |
| **下一步** | 作为一簇放在流程之后，让审批回写同一套单据。 |

### 29. 目标 / 预算 / 例行 / 绩效 / 效率

| | |
|---|---|
| **今日位置** | App.tsx 五页；无宿主路由。[org-full-integration.md](org-full-integration.md)「目标与执行」链路。 |
| **状态** | `managed_node_iframe` |
| **依赖 Node？** | 是 |
| **商业导出？** | 是 |
| **优先级** | P2 |
| **下一步** | 放在宿主员工 + 组织任务之后，以便目标引用它们。 |

### 30. 组织审计

| | |
|---|---|
| **今日位置** | `AuditTrailPage` + 边车 `/api/audit/*`。宿主治理 JSONL 是 **另一套**库。 |
| **状态** | `managed_node_iframe` |
| **依赖 Node？** | 是 |
| **商业导出？** | 是 |
| **优先级** | P2 |
| **下一步** | 与宿主治理审计合一；不要盲目克隆边车 `/api/audit`。 |
| **未知** | 商业 SoT 是哪一套。 |

### 31. 后台 / 租户 / 支付

| | |
|---|---|
| **今日位置** | `AdminPage` + `/api/admin`、`/api/payments`、`/api/assistant`。 |
| **状态** | `managed_node_iframe` |
| **依赖 Node？** | 是 |
| **商业导出？** | 部分 |
| **优先级** | P2 |
| **下一步** | 拆开 SaaS 账单/访客统计（可考虑不迁）与房间需要的租户 CRUD。 |
| **未知** | 清单未标注哪些页签是 SaaS、哪些是自托管。 |

### 32. 客户服务

| | |
|---|---|
| **今日位置** | `CustomerServicePage` + `/api/customers`。全量融合盘点有意包含。 |
| **状态** | `managed_node_iframe` |
| **依赖 Node？** | 是 |
| **商业导出？** | 部分 |
| **优先级** | P2 |
| **下一步** | 仅当商业包仍带该路由才原生迁；否则记 `export_only`。 |
| **未知** | 未声明默认 FreeOS 组织房间必须有它。 |

### 33. 电力交易

| | |
|---|---|
| **今日位置** | `ElectricityMarketPage` + `/api/electricity/*`。 |
| **状态** | `managed_node_iframe` |
| **依赖 Node？** | 是 |
| **商业导出？** | 部分 |
| **优先级** | P2 |
| **下一步** | 先确认是否行业包演示，再开原生切片。 |

### 34. openXYOS 源码下载

| | |
|---|---|
| **今日位置** | `source_download.py`、`POST /api/org-module/source/download`（GitHub `openXYOS` main.zip）。 |
| **状态** | `native_host` |
| **依赖 Node？** | 否 |
| **商业导出？** | 是 |
| **优先级** | P1 · 波次 B |
| **下一步** | 与波次 B 生成源合成一件产物；GitHub 上游 zip ≠ `export-standalone` ≠ 定制树。 |
| **未知** | 操作者目前面对三种不同的「源码」含义。 |

## 已导出的共享 org-ui 模块

来自 `src/octop/modules/org_os/contract.py` 的 `SHARED_ORG_UI_MODULES`：

`announcements` · `organization` · `employees` · `skills` · `governance` · `knowledge` · `tasks` · `reflections` · `settings` · `agents` · `workspace`

**不在**该列表（仍 iframe 或仅宿主工厂）：`chat` 以及所有商业 `App.tsx` 垂类。

Dashboard 宿主路由（`dashboard/src/routes/index.tsx`）：`/organization` 加上上述十一切片。**没有** `/organization/chat`、`/organization/workflows`、`/organization/contracts`、`/organization/assets`、`/organization/attendance`……

## 另见

- [product-contract.zh-CN.md](product-contract.zh-CN.md)（P0.1，已在 `main`）
- [architecture-integration.md](architecture-integration.md)
- [org-full-integration.md](org-full-integration.md)
- [org-merge-plan.md](org-merge-plan.md)
- [org-export.md](org-export.md)
- [asset-loop.md](asset-loop.md)
- [ADR 003](adr/003-org-ui-single-source-dual-delivery.md)
- [org-full-parity-inventory.json](org-full-parity-inventory.json)
- [README.zh-CN.md](../README.zh-CN.md)
