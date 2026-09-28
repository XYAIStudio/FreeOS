# FreeOS 本地模型自动评测与场景路由规划

状态：0.0.7 核心功能候选

范围：本地 Ollama 模型；为其他 OpenAI 兼容本地运行时预留扩展点

原则：本地优先、可解释、用户可覆盖、低扰动、不上传提示或结果

## 1. 要解决的问题

普通用户通常只知道已经下载了哪些模型，不知道模型在自己的 CPU、GPU、内存和运行参数下是否真正可用。模型参数量、厂商宣传和社区榜单不能代替本机实测。FreeOS 需要把“选择模型”从一次人工猜测改成可重复、可解释的本机评测。

目标不是选出一个全局最快模型，而是为不同场景提供合适候选：

1. **实时聊天**：首字快、连续输出稳定，适合长时间陪伴和高频问答。
2. **长时任务**：长上下文稳定，失败率低，持续生成速度不会明显衰减。
3. **工具智能体**：能正确调用工具并产出合法参数。
4. **视觉理解**：能接收图像并完成基础识别任务。
5. **低资源模式**：在内存或显存紧张时仍可稳定工作。

明确不做：

- 不根据模型名称或参数量直接宣称“最好”。
- 不自动下载大型模型，也不删除用户模型。
- 不在每次启动时跑完整基准。
- 不在一轮对话中频繁切换模型，破坏上下文一致性。
- 不把本机硬件、测试提示、模型输出或评分上传到 FreeOS 服务。

## 2. 现有基础与改造边界

现有能力可以直接复用：

- `infra/agents/providers/local_speed.py` 已能测量总延迟、首字时间和近似 tokens/s。
- `/api/local-models/probe` 已能发现硬件、Ollama 和已安装模型。
- `/api/local-models/speed-test` 已提供单模型手动测速。
- `local_default.py`、用户偏好和 provider store 已负责默认模型解析。
- gateway processor 已支持线程模型覆盖、智能体默认模型和多模态升级。
- 0.0.6 的 Ollama tool fallback 已能识别“不支持 tools”，但降级结果目前不是持久化能力画像。

本功能新增一个领域服务，并保持 API 路由为薄适配层：

```text
dashboard/模型页
      │
      ▼
api/routers/local_model_benchmarks.py
      │
      ▼
infra/agents/model_selection/
  benchmark_service.py
  capability_probe.py
  scoring.py
  router.py
  fingerprints.py
      │
      ├── provider store / Ollama HTTP
      └── db repos / settings
```

模型选择和评分属于 `infra/` 领域逻辑；HTTP 状态码、请求校验和 SSE 进度属于 `api/`；结果展示和人工覆盖属于 `dashboard/`。

## 3. 用户流程

### 3.1 首次发现

1. FreeOS 扫描已安装并已注册的本地模型。
2. 如果存在两个或更多未评测模型，显示“为本机推荐模型”卡片。
3. 用户点击开始后先展示预计耗时、资源占用和将要测试的模型。
4. 默认执行 2–5 分钟轻量评测；用户可以取消。
5. 完成后分别给出“实时聊天”“长时任务”“工具智能体”“视觉理解”推荐。
6. 用户可以接受某一推荐、维持当前模型或锁定指定模型。

首次版本不在无明确提示时自动触发高负载测试。后续可增加“设备空闲时自动复测”，默认关闭。

### 3.2 日常使用

- 对话创建时根据任务要求选择模型，并在该线程内保持稳定。
- 若用户手动选定模型或智能体设置了 `default_model`，始终优先使用用户设置。
- 当请求含图片、工具或长上下文时，只在满足能力硬约束的候选中评分。
- 当前模型连续失败时可以切换至同场景备选，但必须在界面显示切换原因。
- 已开始生成有效内容后不自动更换模型；失败重试发生在新一次模型调用上。

### 3.3 复测条件

以下指纹变化时将结果标记为“需要复测”，而不是立即启动测试：

- 模型 digest、量化版本或模型参数变化。
- CPU、GPU、显存、内存或 Ollama 版本变化。
- FreeOS 基准套件版本变化。
- 用户改变上下文长度、GPU 层数或运行参数。
- 结果超过 30 天，或近期真实调用稳定性明显恶化。

## 4. 基准套件

### 4.1 两级评测

**快速评测**用于首次推荐：每个模型约 20–45 秒。

- 冷启动一次：记录模型加载时间。
- 热启动两次：记录首字时间和 tokens/s，取中位数。
- 256–512 token 上下文测试一次。
- 能力声明与最小能力探测。
- 进程峰值内存、显存信息在运行时可获得时记录；不可获得时明确标为未知。

**完整评测**由用户主动选择：每个模型约 2–5 分钟。

- 冷、热启动分开统计。
- 2K、8K 上下文档位；更大档位仅在模型声明和设备资源允许时执行。
- 固定长度持续生成，观察 tokens/s 衰减和超时。
- 工具调用、结构化输出和视觉探测。
- 重复三次，保存中位数、P90 和成功率。

### 4.2 指标定义

| 指标 | 定义 | 用途 |
|---|---|---|
| `load_ms` | 冷启动到请求可处理的时间 | 首次体验、切换成本 |
| `ttft_ms` | 请求发送到第一个非空输出片段 | 实时聊天核心指标 |
| `decode_tokens_per_sec` | 模型报告的 eval_count / eval_duration，缺失时才使用近似值 | 持续生成速度 |
| `total_latency_ms` | 完整请求总耗时 | 综合延迟 |
| `success_rate` | 有效完成次数 / 总次数 | 稳定性硬指标 |
| `timeout_rate` | 超时次数 / 总次数 | 排除不可用候选 |
| `long_context_pass` | 指定上下文档位是否成功并回答校验点 | 长时任务约束 |
| `tool_call_pass` | 是否返回合法工具名及符合 schema 的参数 | 工具智能体约束 |
| `vision_pass` | 是否接受图片并返回可验证内容 | 视觉任务约束 |
| `json_schema_pass` | 是否能稳定生成符合 schema 的输出 | 工作流约束 |
| `peak_ram_mb` / `peak_vram_mb` | 测试期间可观测峰值 | 资源安全与低资源推荐 |
| `sustained_speed_ratio` | 长生成后半段速度 / 前半段速度 | 热降频和长时稳定性 |

tokens/s 必须优先使用运行时给出的真实 token 计数。只有片段数量时，字段应标为 `estimated_tokens_per_sec`，不能与真实 tokens/s 混用。

### 4.3 能力探测

- **工具调用**：提供一个无副作用的本地 `echo` schema，要求返回固定参数；禁止执行文件、网络或系统工具。
- **视觉**：使用随安装包提供的小型测试图，不读取用户照片。
- **长上下文**：在合成文本中放置随机校验码，要求模型准确找回；不测试主观回答质量。
- **结构化输出**：校验 JSON schema，不用模糊文本匹配代替。
- **中文基础能力**：只作为最低可用门槛，首版不把小型题库分数包装成通用智力评分。

## 5. 评分与推荐算法

### 5.1 先约束，再评分

路由先应用硬约束：

```text
视觉请求       → vision_pass = true
工具请求       → tool_call_pass = true
目标上下文 N   → verified_context_tokens >= N
内存安全       → 未触发 OOM，且资源余量高于安全阈值
用户锁定       → 直接使用锁定模型；能力不满足时明确提示
```

不满足硬约束的模型不会因为速度快而进入候选。

### 5.2 归一化

评分只在本机、同一基准版本和同一场景的候选模型之间归一化。延迟类指标使用对数缩放，避免极端慢模型把其他模型挤在很小区间；缺失指标不按零分处理，而是降低置信度。

```text
higher_is_better(x) = percentile_rank(log1p(x))
lower_is_better(x)  = 1 - percentile_rank(log1p(x))
confidence          = 已完成必测项权重 / 场景必测项总权重
```

### 5.3 首版权重

| 场景 | TTFT | tokens/s | 稳定性 | 长上下文 | 资源余量 | 能力校验 |
|---|---:|---:|---:|---:|---:|---:|
| 实时聊天 | 35% | 25% | 25% | 5% | 10% | 硬约束 |
| 长时任务 | 10% | 20% | 30% | 25% | 15% | 硬约束 |
| 工具智能体 | 15% | 15% | 30% | 15% | 10% | 15% + 硬约束 |
| 视觉理解 | 15% | 15% | 25% | 10% | 10% | 25% + 硬约束 |
| 低资源 | 20% | 15% | 25% | 5% | 35% | 硬约束 |

总分用于排序，推荐理由必须引用原始事实，例如：“热启动首字中位数 620ms；3/3 成功；工具探测通过；峰值显存 4.1GB”。不展示无法从测试推导的笼统结论。

### 5.4 抖动控制

- 新模型需比当前模型高至少 8 分，或当前模型不满足硬约束，才建议切换。
- 同一线程不因微小分数变化切换。
- 自动故障转移后设置冷却时间，避免两个模型来回切换。
- 连续 3 次同类运行时故障才降低健康评分；用户取消、网络断开和应用退出不计入模型失败。

## 6. 数据模型

新增迁移需要同时提供 SQLite 和 PostgreSQL 版本，并遵循当前未发布 schema 的折叠规则。

### `local_model_profiles`

每个模型指纹一行，保存最近聚合结果：

- `model_profile_id`：公开 ULID。
- `provider_name`、`model_id`、`model_digest`。
- `runtime_kind`、`runtime_version`。
- `hardware_fingerprint`：仅保存本机不可逆摘要。
- `benchmark_suite_version`、`status`、`started_at`、`completed_at`。
- `metrics_json`、`capabilities_json`、`scenario_scores_json`。
- `confidence`、`stale_reason`、`last_error_code`。

唯一键：`provider_name + model_id + model_digest + hardware_fingerprint + benchmark_suite_version`。

### `local_model_benchmark_runs`

保存有限期运行记录，用于审计和重新聚合：

- `benchmark_run_id`、`model_profile_id`、`mode`、`status`。
- 每个测试项的耗时、指标、错误分类和开始结束时间。
- 不保存自由文本模型输出，只保存校验是否通过和必要摘要。
- 默认保留最近 10 次或 30 天，由用户清除。

### `local_model_routing_prefs`

建议优先放入现有用户偏好 JSON，避免过早增加表：

```json
{
  "mode": "recommend",
  "locked_model": null,
  "scenario_overrides": {
    "realtime_chat": null,
    "long_task": null,
    "tool_agent": null,
    "vision": null
  },
  "allow_background_benchmark": false,
  "allow_runtime_failover": true
}
```

`mode` 首版提供 `manual` 和 `recommend`。等推荐逻辑经过真实用户验证后，再增加默认自动路由模式。

## 7. API 设计

建议新增：

| 方法 | 路径 | 作用 |
|---|---|---|
| `GET` | `/api/local-models/benchmarks` | 列出模型画像、评分、陈旧原因和当前任务 |
| `POST` | `/api/local-models/benchmarks` | 创建批量评测任务 |
| `GET` | `/api/local-models/benchmarks/{job_id}` | 查询任务与逐模型进度 |
| `DELETE` | `/api/local-models/benchmarks/{job_id}` | 协作取消，保留已完成结果 |
| `POST` | `/api/local-models/benchmarks/{profile_id}/retry` | 重测单一模型 |
| `GET` | `/api/local-models/recommendations` | 返回各场景推荐、备选、理由与置信度 |
| `PUT` | `/api/local-models/routing-preferences` | 保存人工锁定和自动策略 |

批量任务使用轮询或 SSE 返回阶段：`queued → loading → warmup → latency → sustained → capability → scoring → completed`。任务必须限制为单机一次只运行一个重型模型，避免多个模型同时占满显存。

请求示例：

```json
{
  "model_refs": ["Ollama (Local)/qwen2.5:7b", "Ollama (Local)/llama3.2:3b"],
  "mode": "quick",
  "scenarios": ["realtime_chat", "long_task", "tool_agent"]
}
```

推荐响应必须同时返回 `eligible`、`disqualifiers`、`score`、`confidence` 和原始关键指标，供 UI 解释。

## 8. 运行时路由

在 gateway processor 现有 `_resolve_harness_model()` 前增加一个领域选择步骤，保持优先级明确：

```text
线程手动覆盖
  > 智能体显式 default_model
  > 用户场景锁定
  > 满足硬约束且置信度足够的本机推荐
  > 现有全局 active model / fallback
```

场景推断首版只使用确定性信号：

- 附件含图片 → `vision`。
- 当前智能体拥有工具且本轮允许工具 → `tool_agent`。
- 估算上下文超过已验证阈值的 60% → `long_task`。
- 其他 → `realtime_chat`。

不使用另一个 LLM 来判断路由，以免增加延迟、成本和循环依赖。

### 故障转移

允许故障转移的错误：模型明确不支持所需能力、OOM、服务端 5xx、模型进程退出、在限定时间内无首字。认证失败、用户取消、输入不合法和工具自身错误不触发换模型。

故障转移顺序：同场景第二名 → 当前全局默认 → 返回明确错误。每次切换写入结构化审计事件，并在聊天界面显示“已从 A 切换到 B：A 工具调用不受支持”。

## 9. 前端设计

模型设置页新增“本机模型推荐”区域：

- 顶部显示硬件摘要、上次评测时间、基准版本和“开始快速评测”。
- 模型表显示状态、TTFT、tokens/s、稳定性、上下文、视觉、工具、资源占用。
- 推荐卡按场景排列，展示首选、备选、分数、置信度和三条主要理由。
- 支持“设为此场景默认”“锁定当前模型”“取消评测”“完整评测”。
- 结果陈旧时显示具体原因，不能继续以绿色“推荐”展示。

聊天消息的模型徽标应保留实际执行模型；发生自动切换时记录两个模型和原因，避免用户误以为一直由原模型回答。

## 10. 调度、资源与安全

- 评测默认串行；GPU/统一内存低于安全余量时暂停并提示。
- 笔记本使用电池、系统高负载、正在语音通话或有活跃生成时不启动后台评测。
- 每项测试设独立超时，总任务有预算；取消必须能终止后续请求并释放模型。
- 所有提示均来自版本化内置基准，不读取用户聊天、知识库或组织数据。
- 日志不得记录模型完整输出、API Key、用户目录或硬件序列号。
- 远程 URL 即使配置为“本地 provider”，也不能被当成本机基准；首版仅允许 loopback Ollama。
- 基准接口沿用 `ollama_models` 权限；普通用户只能查看和修改自己的推荐偏好。

## 11. 可观测性

新增结构化指标：

- `local_model_benchmark_started/completed/cancelled/failed`
- `local_model_benchmark_duration_seconds`
- `local_model_route_selected{scenario,reason}`
- `local_model_failover{error_class}`
- `local_model_recommendation_accepted/rejected`

指标只记录类别和计数，不包含模型输出和硬件原始标识。诊断页提供本机可导出的 JSON 报告，默认脱敏。

## 12. 分阶段交付

### M1：可信批量评测

- 后端 profile/run 存储、模型指纹、任务取消与串行执行。
- 快速评测：冷/热 TTFT、真实 tokens/s、成功率、资源可用性。
- 模型页批量进度和结果表。
- 不改变聊天实际选模。

验收：两种以上 Ollama 模型可在 Windows/macOS/Linux 完成、取消并复用结果；重启后结果仍在；模型 digest 变化后结果变陈旧。

### M2：能力探测与场景推荐

- 工具、视觉、长上下文、JSON schema 探测。
- 场景硬约束、评分、置信度和解释。
- 用户接受推荐、场景锁定和手动覆盖。

验收：不支持 tools 的 qwen2.5vl:3b 不进入工具智能体候选，但可进入通过验证的视觉候选；缺失数据不会被伪装成零分或已通过。

### M3：受控运行时路由

- 接入 `_resolve_harness_model()` 优先级链。
- 线程粘性、明确切换提示、同场景故障转移和冷却。
- 实际调用健康反馈只影响稳定性，不覆盖离线基准原始数据。

验收：手动锁定始终优先；视觉/工具/长上下文硬约束生效；失败不会产生模型切换循环；历史消息显示实际执行模型。

### M4：空闲复测与长期优化

- 可选的空闲时复测、速度衰减检测和推荐变化提示。
- 根据匿名关闭的本机接受/拒绝行为调整用户自己的权重，不进行云端训练。
- 扩展 LM Studio、vLLM 等 loopback OpenAI 兼容运行时。

## 13. 测试与发布门禁

单元测试：

- 指纹稳定性、指标聚合、缺失值、硬约束、归一化和抖动控制。
- 工具/视觉/上下文探测的成功、能力不支持、超时、OOM 和取消。
- 路由优先级、线程粘性、故障分类与冷却。
- SQLite/PostgreSQL repo 和迁移等价性。

集成测试：

- 伪 Ollama SSE 流覆盖冷/热指标及错误分类。
- API 权限、任务并发限制、取消和重启恢复。
- 用户接受推荐后默认模型更新；手动锁定不被覆盖。

真实验收矩阵：

- Windows NVIDIA、Windows 纯 CPU、Apple Silicon、Linux NVIDIA。
- 至少一个文本模型、一个视觉但不支持 tools 的模型、一个工具模型。
- 快速评测、完整评测、应用重启、模型更新、低内存、Ollama 中途退出。
- 连续长对话至少 60 分钟，确认无频繁切换、无显存持续增长、失败可恢复。

发布门禁仍为 `make all`，并增加 dashboard 类型检查、真实 Ollama 可选测试和桌面安装包隔离验收。模拟测试通过不等于真实模型和安装包验收。

## 14. 成功指标

- 首次有两个以上本地模型的用户，80% 能在 5 分钟内得到至少一个高置信度推荐。
- 接受推荐后的实时聊天 TTFT 中位数相对原默认模型改善至少 20%，或稳定性显著提高。
- 因模型能力不匹配导致的 `stream_error` 降低 80%。
- 自动故障转移循环为零；错误切换率低于 1%。
- 用户手动锁定被覆盖的事件为零。
- 基准期间用户数据外发事件为零。

## 15. 开发顺序与估算

建议四个迭代完成：

1. **1 周**：数据结构、指纹、批量任务、现有测速重构和 API。
2. **1 周**：能力探测、评分解释、模型页 UI。
3. **1 周**：受控路由、线程粘性、故障转移和审计事件。
4. **1 周**：四平台真实模型验收、性能调优、文档与灰度开关。

M1 和 M2 可以在 0.0.7 默认提供；M3 建议先以“推荐模式”灰度，收集本机验收证据后再把自动路由设为可选。M4 不应阻塞 0.0.7。
