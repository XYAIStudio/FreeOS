# FreeOS 产品契约

**状态：** 权威（P0.1）。这是产品意图的单一事实来源。

**语言：** [English](product-contract.md) · 简体中文

本文 **取代** 此前把「组织身份」写成 FreeOS 宿主身份权威、或把捆绑 / 托管 Node 运行时（以及永久 iframe 嵌入 openXYOS）写成目标架构的表述。

相关但从属的文档：[architecture-integration.md](architecture-integration.md)（控制面 / 数据面与自增长循环）、[org-merge-plan.md](org-merge-plan.md) 与 [org-full-integration.md](org-full-integration.md)（工程历史——先读文首 Historical vs Current）、[ADR 001](adr/001-single-process-model.md)、[ADR 003](adr/003-org-ui-single-source-dual-delivery.md)、[org-export.md](org-export.md)。

---

## 愿景

FreeOS 存在的意义：让用户在 **一个自托管平台** 里同时得到 **Octop + openXYOS** 的能力。

- 模型和知识库 **尽可能本地优先**。
- Octop 与 openXYOS 的资产 **互通、互相增强**。
- 用户可以定制，并最终 **导出一套新的 openXYOS 系统源码**，用于商业化。

FreeOS 是独立的下游宿主，不是 Octop 官方发行版。宿主登录不绑定 Octop 官方账号。

## 双身份

两套用户体系 **同时存在**，互不替代，谁也不是对方的「唯一权威」。

| 身份 | 是什么 | 不是什么 |
|---|---|---|
| **FreeOS 软件用户** | 宿主应用的 **本地优先注册 / 登录**。以后 **可以** 对接 FreeOS 官网，用于 **商业授权**。 | 不是 Octop 官方账号。不是组织模块测试用户。 |
| **组织模块用户** | 集成进来的 openXYOS 组织模块是 **独立测试环境**，有 **自己的用户系统**。 | 不是 FreeOS 宿主身份的权威。不是软件授权账号。 |

**禁止** 写成：组织注册登录是 FreeOS 宿主的唯一身份权威。

## 过渡桥（不是终点）

**前进方向：** 把 openXYOS 的网页与能力 **迁入** FreeOS/Octop，做成 **新的原生部分**。

这 **不是** 「永久嵌入一套大型 Node 运行时」。

当前已发布的形态都是原生迁移完成前的 **桥**：

| 已发布形态 | 角色 |
|---|---|
| 桌面 **0.0.3** 托管 Node + iframe 嵌入 openXYOS | 过渡：仍能跑完整原 App 表面。 |
| **Phase-5 默认零 Node** 安装器（宿主内 `/organization` + `/api/org-module/*`；边车可选） | 精简默认路径，同时把页面迁原生。不表示未迁的 App 表面已经完成。 |
| **全量 App iframe** / 可选 `FREEOS_ORG_SIDECAR`（`:3780`） | 未迁页面、导出 / 同步的兼容阀。 |

终态：宿主内原生能力，**加上** 可导出的 openXYOS 源码树。Node 边车和 iframe 应随原生覆盖扩大而收缩，不得再冻成架构。

## 本地模型与知识库

默认路径优先使用操作者本机上的模型与知识库。云厂商是可选项。不要把对话、RAG 或组织知识设计成 **必须** 走某家云。

## 导出目标

操作者应能定制组织系统，并 **最终导出一套新的 openXYOS 系统源码**，供商业自托管。今天的 `freeos org export-standalone`（SPA + 反代到宿主）只是早期交付，不是完成品。重写导出流水线 **不属于本次契约冻结**（后续工作）。

## 接下来不要做什么

本次冻结只改文档。后续工程不得把契约写反。

- **不要** 把捆绑 / 托管 Node，或全量 App iframe，当成永久运行时。
- **不要** 把组织测试用户与 FreeOS 软件用户合成一套，也不要把组织登录做成宿主身份权威。
- **不要** 把 FreeOS 应用认证绑到 Octop 官方账号。
- **不要** 借本契约去实现资产总线、导出重写、拆除 Node 或迁移地图——那些是后续项（P0.2+）。落地时遵守本文意图。
- **不要** 让历史 ADR / 合并计划与本文 silently 打架。旧文放在 **Historical**，**Current** 指向这里。

## 贡献者自检

读完 [README.zh-CN.md](../README.zh-CN.md)（或 [README.md](../README.md)）和本文后，应能说出：

1. FreeOS 本地认证 ≠ 组织模块测试认证。
2. 托管 Node 只是桥。
3. 终态是把 openXYOS 迁入宿主。
4. 可导出的 openXYOS 源码是目标。
