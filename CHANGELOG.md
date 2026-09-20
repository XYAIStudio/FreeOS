# Changelog

本文件记录项目的所有重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本号遵循 [语义化版本规范](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

### 文档

- 冻结 FreeOS 产品契约（P0.1）：[docs/product-contract.md](docs/product-contract.md) / [docs/product-contract.zh-CN.md](docs/product-contract.zh-CN.md)。核心愿景采用「创立初心」定稿（中文原文；英文 README 为忠实对应；使用方式段保持委婉：本机注册登录为起步，组织能力为相对独立工作空间）。产品口号：**FreeOS：自由的 AI 工作室，想象空间由你来打开** / *FreeOS: a free AI studio — the space for imagination is yours to open.* 托管 Node / 内嵌组织页仅为过渡桥，终态是把 openXYOS 迁入宿主并导出可商业化源码。取代先前「组织身份为唯一权威」与「永久 / 默认捆绑 Node 运行时」表述。冲突文档改为 Historical vs Current，不删工程历史。

### 新增

- Organization Phase 5（默认安装器瘦身）：Windows/macOS/Linux 默认包装与 Docker Compose 保持 **单进程 FreeOS + 宿主内 Organization**，不捆绑、不解压、不自动拉起 openXYOS Node。`FREEOS_ORG_SIDECAR=1` 与 `SHIP_OPENXYOS_RUNTIME=1` 仍是可选高级路径。文档对齐 #55 / ADR 001 / ADR 003 / `docs/org-export.md`。`modules/openxyos` 保留给导出与开发，不是默认运行时。
- Organization Phase 4（独立站导出起步）：`freeos org export-standalone --out <dir>` 从 `dashboard/src/org-ui` 生成可运行的 Vite 包（OpenApp 风格路由、本地 JWT IdentityBridge `openxyos.standalone.jwt`、登录页、Docker / docker-compose、`server/proxy.mjs` 把 `/api` 反代到 FreeOS `FREEOS_UPSTREAM`）。Chat 不导出。默认安装器零 Node（Phase 5）。说明见 `docs/org-export.md`。
- Organization Phase 3（工作台总览切片，Open-12 收口）：宿主内薄 Workspace / OpenDashboard。Dashboard `/organization/workspace` 使用共享 `dashboard/src/org-ui` 的 `WorkspacePage`。数据复用已有 `GET /api/org-module/overview`，链到已迁的公告 / 架构 / 员工 / 技能 / 智能体 / 任务 / 知识 / 反思 / 治理 / 设置。**不是**第二套控制面（assemble / pack / loop 仍在 `/organization`）。**Chat 永久不迁。** `freeos org export-standalone` 同时列出 Workspace。Phase 3 Open-12 宿主 UI 完成，下一步 Phase 4 导出。
- Organization Phase 3（智能体切片）：宿主内 Agent Studio / 智能体定制。Dashboard `/organization/agents` 使用共享 `dashboard/src/org-ui` 的 `AgentsPage`。列表走 `GET /api/org-module/agents`；编译 / 生命周期 / 注册复用已有 `POST /api/org-module/blueprints/compile`、`/employees/transition`、`/employees/spawn`（`{FREEOS_HOME}/tenants/<id>/employees/`）。**不是** FreeOS 个性化智能体编辑器，也不是 Chat，也不依赖未挂载的 sidecar `/api/agent-studio/*`。注册后的同事出现在 Experts。`freeos org export-standalone` 同时列出 Agents。未迁：Chat、资料上传、人才市场。
- Organization Phase 3（设置切片）：宿主内 Organization Settings。Dashboard `/organization/settings` 使用共享 `dashboard/src/org-ui` 的 `SettingsPage`。本页只编辑 `org_os` 目录模块开关（复用 `GET/PUT /api/org-module/modules`）与组织本地偏好（`GET /api/org-module/settings` · `PUT /api/org-module/prefs`，`{FREEOS_HOME}/org-os/prefs.json`）。**不是** FreeOS 系统设置：大模型密钥、用户、时区仍链到 `/system-settings`。没有边车，也不复制 sidecar 的 AI/用户/数据库页。`freeos org export-standalone` 同时列出 Settings。未迁：Chat、边车系统设置。
- Organization Phase 3（反思切片）：宿主内 Reflections。Dashboard `/organization/reflections` 使用共享 `dashboard/src/org-ui` 的 `ReflectionsPage`。列表/创建/删除走 `/api/org-module/reflections*`，SQLite 在 `{FREEOS_HOME}/org/reflections.sqlite`。可选 `employee_id` / `task_id` 指向同一租户的目录员工与组织任务。这是组织复盘，不是 Chat，也不是第二套技能运行时。`freeos org export-standalone` 同时列出 Reflections。未迁：Chat、边车技能统计、边车部署铁律样例、其余 Open-12。
- Organization Phase 3（任务切片）：宿主内 Tasks。Dashboard `/organization/tasks` 与 `/organization/tasks/:id` 使用共享 `dashboard/src/org-ui` 的 `TasksPage` / `TaskDetailPage`。CRUD、状态流转、子任务与人工评论走 `/api/org-module/tasks*`，SQLite 在 `{FREEOS_HOME}/org/tasks.sqlite`。这是组织待办，不是 Octop cron，也不是项目/Chat 对话。`freeos org export-standalone` 同时列出 Tasks。未迁：Chat、附件上传、边车任务库、其余 Open-12。
- Organization Phase 3（知识切片）：宿主内 Knowledge。Dashboard `/organization/knowledge` 使用共享 `dashboard/src/org-ui` 的 `KnowledgePage`。列表/详情/笔记走 `/api/org-module/knowledge*`，包装已有 `KnowledgeService`（Octop `knowledge_bases` / `knowledge_documents`），与 Chat 检索同一套行。不克隆 openXYOS sidecar notes/files DB。上传、文件夹、嵌入模型仍在 `/knowledge-bases`。`freeos org export-standalone` 同时列出 Knowledge。未迁：Chat、边车知识库、其余 Open-12。
- Organization Phase 3（技能切片）：宿主内 Skills。Dashboard `/organization/skills` 使用共享 `dashboard/src/org-ui` 的 `SkillsPage`。列表/详情走 `GET /api/org-module/skills` 与 `GET /api/org-module/skills/{slug}`，生成/发布仍是已有 `POST …/generate|publish`（`{FREEOS_HOME}/org-skills`，`skill_bridge`）。宿主 skill packages 只读列出，编辑仍在「个性化 → 技能包」。这不是第二套技能运行时。`freeos org export-standalone` 同时列出 Skills。未迁：Chat、边车市场/插件中心、其余 Open-12。
- Organization Phase 3（员工目录切片）：宿主内 Employees。Dashboard `/organization/employees` 与 `/organization/employees/:id` 使用共享 `dashboard/src/org-ui` 的 `EmployeesPage` / `EmployeeDetailPage`。目录 list/detail/create/update 走 `/api/org-module/org/employees*`，与组织架构共用 `{FREEOS_HOME}/org/org_chart.sqlite`，不另开第二套员工库。lifecycle 同事仍是 `GET /api/org-module/employees`。`freeos org export-standalone` 同时列出 Announcements、Org chart、Employees。未迁：Chat、人才市场/备选/离职清算、绩效、汇报线、技能绑定、头像、其余 Open-12。
- Organization Phase 3（组织架构切片）：宿主内 org chart。Dashboard `/organization/org` 使用共享 `dashboard/src/org-ui` 的 `OrgChartPage`；树与 CRUD 走 `/api/org-module/org`（`{FREEOS_HOME}/org/org_chart.sqlite`），不需要 Node sidecar。`freeos org export-standalone` 同时列出 Announcements 与 Org chart。未迁：Chat、汇报线/版本/导入导出图、其余 Open-12。
- Organization Phase 2：宿主内通知公告。Dashboard `/organization/announcements` 使用共享 `dashboard/src/org-ui` 页面；CRUD 走 `/api/org-module/announcements`（`{FREEOS_HOME}/org/announcements.sqlite`），不需要 Node sidecar。`freeos org export-standalone` 写出同一页面的独立站骨架（完整打包仍待 Phase 5）。

### 修复

> 下面若干「启动即拉起本机 openXYOS」条目记录的是 0.0.1 边车时代问题。默认路径已被 [0.0.2] 与本文件 Unreleased 的 Phase 5 取代：安装与首屏不再捆绑或自动拉起 Node。

- Windows 安装预配不再把 Node 工作目录选到残留的嵌套 `openxyos\\openxyos`：顶层已有 `backend-dist/server.js` 与 `dist/index.html` 时必须用 live 根。嵌套 cwd 会让 `node backend-dist/server.js` 立刻退出且 stdout/stderr 为空，安装空等 90s 后以退出码 12 失败。`start-sidecar.ps1` / 预配 / 桌面 Go / Python 启动路径统一按此选择 cwd；每次启动截断 `start.log`；Shell.Application 若未刷新日志则改走 explorer / Start-Process，Node fail-fast 不再伪装成 livez 超时。
- Windows 安装详情不再把 openXYOS 预配的 UTF-8 Node/PowerShell 控制台（`[Error] POST /api/auth`、`[seed]`、中文 Server/WebSocket 状态）按系统 ANSI/GBK 打成乱码。NSIS 只用 `nsExec::Exec` 等退出码，详情页只显示本地化步骤结果；完整日志写入 `%LOCALAPPDATA%\\FreeOS\\openxyos\\provision.log` / `start.log`（UTF-8）。解压前停止并等待旧的 FreeOS openXYOS Node 退出；livez 通过即成功，不把启动期 auth 日志当失败。
- 组织页互生长通道两端都落到可选用状态：推送到 openXYOS 时员工/人才写成列表页能看到的 `active` / `internal` / `available`；从 openXYOS 回流时即使没有技能字段也会登记为同事，技能/插件/MCP 写入 `org-skills` / `org-plugins` / `org-mcps`，并把聊天专家挂到当前用户（修复 `user_id=NULL` 导致「专家」页看不见）。导入后跳到「专家」页，推送/循环后关闭管理抽屉并刷新预览。
- 组织页内嵌浏览器补上后退 / 前进 / 刷新；openXYOS 首页卡通助手改为打包进前端资源（并保留 `/assets/xyai-mascot.webp` 回退），不再显示破碎图片。
- 启动 FreeOS 时就会拉起本机 openXYOS 前后端（桌面 `startOrgSidecar` + 主机 `ensure_sidecar`），不必先进入组织页；登录不再因为 3780 未监听而 `Failed to fetch`。
- 组织页打开本机测试页会先探测 `livez`：前后端未起来时不再把登录 iframe 暴露成 `Failed to fetch`，而是提示点击「重启前后端服务」，并高亮状态栏重启按钮。重启过程改为 XYAI Studio 风格进度卡（吉祥物对话气泡、转圈、逐步推进的停进程 / 本机完整目录 / 启动 API 与页面 / 等待端口 / 加载登录页），并真实停启 FreeOS openXYOS 节点。
- 组织页「最近同步」左侧增加「重启 openXYOS 前后端服务」：XYAI 吉祥物动画、真实停启进程，livez 通过后回到本机测试首页。

- 组织页「把 FreeOS 资产推到 openXYOS」不再把行写进 tenant 1 却让嵌入式登录（`demo@demo.com` → tenant 2）看不见。ingest 以当前登录 / 最近登录 / 本地演示租户为准，并把员工/人才写成列表页会显示的状态；打包回执带落地数量，预览跳到员工页。
- 组织页「运行自增长循环」在员工已是 `active`（或生命周期不允许再跳到 `market`）时不再 500。循环只沿合法边晋升，已到达或非法的步骤记为 skip，接口返回成功的循环证明而不是 `INTERNAL_ERROR`。
- Windows 覆盖安装时，openXYOS 预配不再因为旧 Node 锁住 `%LOCALAPPDATA%\FreeOS\openxyos` 里的文件、`tar.exe` 返回非 0 就直接退出码 3。安装前只停止 FreeOS 自己的 openXYOS（与启动脚本相同的 `Stop-OpenXYOSNode`：`start.pid` / live 与 `$INSTDIR\openxyos` 路径），先解到 LocalAppData 临时目录再合入工作目录，并把 tar 的 stdout/stderr 写入 `provision.log`。tar 非 0 但布局可修复时记警告并继续；只有 extract+heal 之后布局仍不完整才退出 3。幂等短路要求完整布局、`.install-ready`，以及 3780 上是我们的 FreeOS openXYOS，而不是任意 livez。
- 组织页嵌入本机 openXYOS 不再因为边车「已连接」却空白：`CORS_ORIGIN` 即使漏了 `http://127.0.0.1:3780` / `localhost` / `[::1]`，服务端也会合并监听自源，模块脚本和登录不再 500。FreeOS 启动会先停掉 live 目录里旧的 Node，再用当前 `start-sidecar.ps1` 拉起；嵌套的 `openxyos\dist` 会在启动前提升到 live 根。若 livez 正常但自源请求失败，状态栏和预览区会明确提示，而不是一片白。
- Windows 安装成功后删除 `$INSTDIR\openxyos-runtime` 目录和 `openxyos-runtime.zip`（以及 `%LOCALAPPDATA%\FreeOS` 下同名暂存）。预配失败时保留这些文件以便排查。最终工作目录 `$INSTDIR\openxyos` 与 `%LOCALAPPDATA%\FreeOS\openxyos` 不受影响。
- ima 知识库挂接对齐官方 Agent Interface（https://ima.qq.com/agent-interface，落地页现发 ima-skill 1.1.10）：用 Client ID / API Key 连接后，按 `search_knowledge_base` + `get_knowledge_base` 选知识库，按 `get_knowledge_list` / `search_knowledge` 自选文档；文件夹 ID 用接口返回的 `media_id`（不自造 `folder_` 前缀），选择会写入挂接。
- 模型页注册的本机 Ollama / GGUF 现在会出现在对话区模型选择器里，并走本机 `127.0.0.1:11434` 调用。注册会补齐 Ollama 供应商默认值、打开服务开关、热加载对话列表；Ollama 未启动时给出可操作错误，而不是静默失败。
- 对话模型选择器底部增加「模型管理」，跳到侧栏同一条「模型」路由（`/models`）。
- 组织页默认只显示本机 openXYOS 嵌入和顶部蓝色状态栏；「启用组织模块」「组织OS管理」在状态栏右下。互生长导入/导出、源码下载、循环时间线等收到「组织OS管理」。iframe 高度等于可见预览区，openXYOS 弹窗按 iframe 视口水平垂直居中。
- 嵌入本机 openXYOS 登录不再因 CORS 漏掉 `http://127.0.0.1:3780` 而返回笼统的「服务器内部错误」。启动环境合并 sidecar 自源；无演示种子时写入本地 demo 账号，保证隔空第一台电脑能登录。

- Windows 安装期 `start-sidecar.ps1` 不再把数据目录写到只读自动变量 `$home` / `$HOME`（赋值抛 `SessionStateUnauthorizedAccessException`，`$ErrorActionPreference = Continue` 时脚本继续跑，SQLite 会落到 `%USERPROFILE%\\org-os\\xiongyuan.db`）。改为 `$freeosHome`（默认 `%USERPROFILE%\\.freeos`）。
- 预构建 `openxyos-runtime.zip` 现在带上 `backend-dist/migrations/*.sql`。编译后的 `server.js` 用 `__dirname/migrations` 做 `initDatabase()`，缺文件会 ENOENT（`013_audit_bundle.sql`）并让 livez 永远起不来。安装期预配也会把已有 live 目录里的 `backend/migrations` 补到 `backend-dist/migrations`。
- Windows 安装期 `start-sidecar.ps1` 不再用 PowerShell 5.1 默认的 `UseShellExecute=true` 拉起 Node（那样不会继承 `$env:CORS_ORIGIN`，生产环境 `parseOrigins` 立刻抛错，进程退出，3780 无监听，预配空等 90s 后才以退出码 12 失败）。改为 `UseShellExecute=false` 并显式写入 `ProcessStartInfo.EnvironmentVariables`，把 Node stdout/stderr 记入 `%LOCALAPPDATA%\\FreeOS\\openxyos\\start.log`；进程在 livez 前退出则预配以退出码 10 失败并附上日志摘录。
- Windows 安装把 openXYOS 预配改成 **Setup 子进程**（随包装的 `provision-openxyos.ps1`，NSIS `nsExec` 等待退出码）。子进程用 `tar.exe` 解压到 `%LOCALAPPDATA%\\FreeOS\\openxyos`、整理嵌套/扁平布局、以中完整性启动 FE/BE、通过 `livez` 后才写 `.install-ready`。失败按真实原因提示（解压 / Node / 启动 / 健康检查），不再默认归咎 3780 端口，也不再软跳过 livez。不注册 HKCU Run / 登录计划任务；之后由 FreeOS 启动时带上本机 openXYOS。组织页直接嵌入 `http://127.0.0.1:3780`，不再出现「启动边车」。
- 安装期不再在 livez 探测后 `taskkill` 边车：Setup 把 `start-sidecar.ps1` 写到 `%LOCALAPPDATA%\\FreeOS\\openxyos`，用当前用户（IShellDispatch2 / HKCU Run / 登录计划任务）常驻拉起 FE+BE，确认 `http://127.0.0.1:3780/api/health/livez` 后保持运行。组织页在 `.install-ready` 时自动嵌入本机 openXYOS，不再把「启动边车」当主按钮；仅自动启动失败才显示「重试启动」和中文原因。
- 「下载最新 openXYOS 源码」端到端 UTF-8：Wails 文件夹选择器以 UTF-8 Base64 回传路径（不再把 GBK/ACP 当 UTF-8）；落盘前修复 CP1252/Latin-1 误读的目标路径；解压按 zip UTF-8 标志或 GBK 还原中文目录名，避免乱码。
- Windows 知识库本地文件夹挂接：选择器与列表预览按 UTF-8 处理中文路径/文件名，避免 `é¡¹ç®…` 这类乱码；挂接与列表预览不再因向量模型未就绪返回 409。

- 模型页注册本机 GGUF / 已拉取的 Ollama 模型时，Windows 桌面不再返回笼统的 `INTERNAL_ERROR` 500；`ollama create` 使用带引号的 POSIX `FROM` 路径，并把真实失败原因（文件不存在、权限、create 失败）返回给界面。

### 变更

- 组织页改为应用内多标签浏览器（标签栏 + 地址栏 + iframe），进入时打开本机 openXYOS。`target=_blank` / `window.open` 收入应用内标签，不再弹出系统新窗口；去掉「在新窗口打开」。
- 组织页顶部蓝色状态栏增加「下载最新源码」主按钮：点击后先打开系统文件夹选择器，再下载最新 openXYOS 主分支源码。不必先打开「组织OS管理」。成功提示保存路径；管理抽屉仍保留同一操作作为次要入口。
- 对话与工作区共用一份列表：侧栏「对话」进入工作区「对话」标签；点开一条才进入聊天画布。工作区侧栏默认打开「项目」标签。
- 用户可见用词对齐：员工 = 已入编部门；同事 = 同一组织里一起聊的人；专家 / 智能助手 = 尚未入编的帮手。个性化「子智能体」改为「专项助手」。群聊选择「同事或智能助手」。
- 桌面未注册的 local guest 也能打开「模型」和「知识库」（第一台电脑免登录）。
- 组织页导入/推送后显示落地回执，循环时间线用「是/否」而不是 true/false。

### 新增

- 模型页本机模型支持「测速」和「设为默认」：测速对 Ollama `/api/generate`（或已注册供应商的 chat completions）发送固定短提示，展示总延迟、首字时间和 tok/s，可取消，超时约 45 秒；设为默认写入用户 `preferred_model` 与全局 `active_model`，新对话和模型选择器会优先使用它，当前默认显示徽章，可一键取消。
- 开发空间对话右侧栏：可折叠，空状态「开始一个面板」，从文件 / 审查 / 后台任务 / 浏览器 / 终端起步。输入框「+」打开同一组面板，「使用权限」提供默认权限 / 自动审批 / 完全访问并随对话发送。
- 开发空间对话区历史横杠：沿滚动条一侧显示回合刻度，悬停看摘要，点击跳到对应消息；打开右侧栏后仍可见。
- 模型页本机大模型：Ollama 已安装但未运行时显示「启动 Ollama」（Windows 走已知安装路径的 `Ollama.exe` / `ollama app` / `ollama serve`）；缺少可自动处理的依赖时提供「一键下载安装」，否则说明需手动安装；「搜索本机模型」后台扫描 `.gguf` / `.ggml`（以及明确的本地 LLM safetensors 目录），结果进入本机列表并可注册到 Ollama 供对话切换。
- 组织页双向互生长：FreeOS 资产经 `/api/freeos/ingest`（共享写入令牌，无需边车登录墙）落到 openXYOS 员工/人才/插件/技能表；控制面导出再装配回 FreeOS。循环在边车健康时不再把「已推送到控制面」写成 false。
- 组织页可从本地语料或 ima / 云知识库指针一键生产尚未入部门的专家 / 智能助手；本地模型一键下载后会注册到 Ollama 供应商。
- 组织页用语对齐：员工=已入部门；同事=同一组织的同伴；专家 / 智能助手=尚未入部门。导入把部门员工登记为同事；导出把专家写入控制面员工。

### 变更

- 组织循环时间线的是/否改为中英文本地化，不再混用 `true`/`false`。
- 边车启动会写入并传递 `FREEOS_INGEST_TOKEN`；Python 启动器同时识别 `%LOCALAPPDATA%\FreeOS\openxyos`、`$INSTDIR\openxyos` 与 portable `org-sidecar`。
- Windows 安装包在 Setup 内把预构建 openXYOS 运行包解到 `%LOCALAPPDATA%\FreeOS\openxyos`（可写本机根）并完成 livez 探测；`$INSTDIR\openxyos` 仅作备份。组织页打开即可嵌入 `http://127.0.0.1:3780`，不必再点「启动边车」，也不再等首次启动拷贝。
- 项目创建用系统文件夹选择器（Wails 原生对话框，任意盘符）；项目/任务/对话区默认展示实时对话列表，并提供建群/群聊入口。
- Organization OS 首页双循环：FreeOS 数据面与 openXYOS 控制面的实时状态、一键导入部门员工为同事 / 打包专家为员工 / 运行 org loop，以及边车离线时的启动恢复。
- FreeOS 官网源码：`website/`（Vite + React 静态站，正式域名 https://freeos.cnxy.tech）。视觉与章节节奏对齐 XYAI Labs（天蓝→亮光、毛玻璃、01/02/…、底座 / 系统 / 生态），文案仍是 FreeOS 产品自己的话；圆形标志 + XYAI 机器人六姿态，无 Octop 红或章鱼形象。构建产物可整包上传到 `/www/wwwroot/freeos.cnxy.tech`。

### 变更

- 知识库桌面 / 首次打开默认可用：打开「知识库」先看到本地文件夹挂接与云知识库挂接（ima 等），不必先找开关。向量模型、图片识别、扫描件 OCR 仍在「基础设置」里，留给后续清洗、标注、蒸馏。原文件夹只读；解析结果仍写入用户另选的新文件夹。
- 侧栏「组织 OS」更名为「组织」（英文 Organization）。


- 桌面端（`OCTOP_DESKTOP` / `FREEOS_DESKTOP`）首次打开不再经过验证启动密码、选择数据库、创建管理员三步：自动绑定本地 SQLite 并使用已有 guest / local-session。首屏只保留配置 LLM API Key，可「跳过，进入工作台」，之后仍可在设置里配模型。自托管服务端向导不变。
- 侧栏「设置」分组改名为「能力」/ Capabilities。原「控制」与「管理」子模块并入顶层「系统设置」/ System Settings（页内分节；工作台 / 远程桌面仍走全屏路由）。旧 `/admin/*`、`/acp`、`/agent-config` 地址会重定向。
- 用户可见吉祥物从章鱼换成 XYAI 白色机器人姿势包（欢迎 / 空态 / 探头 / 思考 / 打字 / 任务）；桌面启动页与 openXYOS 首页使用同一角色，不再加载章鱼 WebM。
- 桌面更新通道只跟踪 `github.com/XYAIStudio/FreeOS/releases`。不再读取 PyPI `octop`、腾讯云 COS 或其它 Octop 镜像；当前已是最新 FreeOS `v0.0.1` 时不会误报更新。
- 默认主题与残留 Octop `rose` 存储一次性迁移为 XYAI 蓝 `#0033FF`（之后仍可手动选玫瑰粉）。

### 修复

- Windows 安装期就把预构建 openXYOS 用 `tar.exe` 解到 **`%LOCALAPPDATA%\FreeOS\openxyos` 本机工作目录**（`Program Files` 只作只读备份：`$INSTDIR\openxyos` 与 `openxyos-runtime`）。Setup 会拉起 FE+BE 直到 `http://127.0.0.1:3780/api/health/livez` 通过再结束；缺少 `node\node.exe` / `dist\index.html` 或健康检查失败则安装失败。首次打开 FreeOS 不再从安装目录拷贝/解压。组织页「下载最新 openXYOS 源码」走系统文件夹选择器（任意盘符），不再只用手输路径。
- 桌面 / 本地会话不再被 `setup_required` 短路：`GET /setup/status` 之后仍可调用 `POST /auth/local-session`，不会误跳进服务端密码向导。
- 组织页「启动边车」会拉起捆绑的 Node + openXYOS（Windows 用 `node.exe` / `cmd /c`，不再直接 Popen `.bat`），并在右侧预览区嵌入控制台（支持全屏）。openXYOS 在 FreeOS 桌面环境下关闭 `X-Frame-Options`，避免 iframe 空白。安装 / 桌面启动时宿主与 Wails 都会确保边车常开（需 `dist/index.html` 已打包）。
- Windows 打开时不再因 WebView2 `Navigate`/`SetURL` 在 Chromium 未就绪时触发 Go panic。主窗口等 WebView 点火后再跳转；`SetURL` 失败会重试并显示 FreeOS 提示，而不是原始堆栈。设置窗口延后创建，避免两个 WebView2 同时初始化同一用户目录。用户数据目录必须可写，并设置 `WEBVIEW2_USER_DATA_FOLDER`。
- 已安装的 FreeOS 不再继承残留的 `~/.octop` 作为桌面家目录。无 `FREEOS_STAMP` 的 `~/.octop/portable` 会被丢弃；健康检查要求 `product=freeos`，避免连上旧 Octop 进程后出现红标登录墙。桌面端 `?desktop=1` 会记住本地会话并持续重试，不再落到登录页。
- Windows NSIS 安装完成后双击桌面 / 开始菜单快捷方式（或 `FreeOS.exe`）能打开窗口：快捷方式工作目录固定为 `$INSTDIR`，WebView2 用户数据写到 `%LOCALAPPDATA%\FreeOS\WebView2`（不再落到 Program Files），结束页用未提权 token 启动以免把 `~/.freeos` 标成 High integrity，并忽略非 `FreeOS.exe` 的残留 `desktop.pid`。
- Windows NSIS 结束页复选框不再显示 `è¿è¡Œ FreeOS`：`project.nsi` 使用 UTF-8 BOM，`makensis -INPUTCHARSET UTF8`，简体中文 LangString（运行 FreeOS / 卸载确认）按 Unicode 编译。
- Windows NSIS uninstall now stops FreeOS / host / sidecar processes and recursively removes `$INSTDIR` (quoted `RMDir /r`, plus a delayed cleanup after `uninstall.exe` exits). If those processes are still running, uninstall asks first (cancel aborts and leaves them running; confirm closes them then wipes the install dir). User profile data under `%USERPROFILE%\.freeos` / `FREEOS_HOME` / legacy `~/.octop` is kept. Product version remains 0.0.1.
- Windows desktop no longer keeps a leftover Octop 0.9 / 1.0 portable under `~/.octop` just because FreeOS is `0.0.1`. Same-version rebuilds replace when `FREEOS_STAMP` changes.
- Desktop host now sets `OCTOP_DESKTOP=1` / `FREEOS_DESKTOP=1`. Local session accepts IPv4-mapped loopback and, on desktop, picks an existing admin instead of dead-ending on the login form.

### 变更

- Windows NSIS finish page shows a “运行 FreeOS” checkbox, checked by default, and launches from `$INSTDIR`.
- Desktop shell sets `OCTOP_DESKTOP=1` on the bundled host so first-run can treat the process as the Wails app.
- First launch on desktop / loopback opens a local guest session — no login wall. Register or sign in only when saving, exporting, or publishing to an account.
- Login, splash, favicons, and desktop icons use the circular XYAI mark. Product version remains 0.0.1.

## [0.0.3] - 2026-09-20

### 新增

- 交付完整 Organization 集成：FreeOS 统一身份与权限桥接、宿主入口及 openXYOS 管理运行时随桌面安装包分发，离线环境也可使用组织工作台。
- 群聊中对专家的明确 `@` 提及由后端确定性路由到实际专家调用；讨论和头脑风暴场景不再让本地小模型自行决定工具调用。

### 修复

- 统一源代码、CLI 与桌面安装包的 `0.0.3` 版本标识；Windows 打包工作流校验并携带 Organization sidecar。
- OpenXYOS 的本机登录、注册、测试账号和模型配置不再依赖或复用 FreeOS 账户令牌。首次登录会检查本机模型配置：未配置时进入设置并说明智能体、群聊和行业知识加工需要用户自行配置模型；已配置时进入工作台。

## [0.0.2] - 2026-09-18

当前 FreeOS 产品版本，与 0.0.1 边车时代 Windows 安装包区分。`1.0.0` 对本阶段过早；后续按 [semver](https://semver.org/spec/v2.0.0.html) 随产品成熟度递增。规范来源是 `pyproject.toml`（同步 `octop.__version__`、桌面 / NSIS / FnOS 回退值，以及 CI 产物名）。发布工作流需要标签时使用 `v0.0.2`；不重写已推送的历史 tag。

命令核对：`uv run freeos --version` 与 `uv run python -c "import octop; print(octop.__version__)"` 均应输出 `0.0.2`。

### 变更

- 桌面单一运行时：组织控制面能力在 FreeOS/Octop Python 宿主内运行（`org_os` / `/api/org-module/*` / 组织页原生工作台）。完整 openXYOS Node（3780）改为可选导出/同步，不再是安装或首屏的硬依赖。
- 组织页默认不再嵌入 `127.0.0.1:3780`，也不再以 livez /「重启边车」挡住登录或首屏。互生长（导入 / 推送 / 循环）走宿主内镜像与同事/专家列表。
- Windows 安装不再解压或启动 `openxyos-runtime`，也不再因 livez 失败中止安装。桌面启动默认不设置 `OPENXYOS_BASE_URL`，不拉起 Node；需要时设 `FREEOS_ORG_SIDECAR=1`。
- `freeos org loop run` 不再 `ensure_sidecar` 或空等 3780。未配置边车时只写 `{FREEOS_HOME}/openxyos-mirror/` 与生命周期登记。
- 产品版本从 `0.0.1` 升到 `0.0.2`，安装包 / NSIS DisplayVersion / `octop.__version__` 同步，便于与边车时代构建区分。后续 GitHub Release 标签为 `v0.0.2`。
- 默认 Windows NSIS / 绿色便携包不再打入 `openxyos-runtime.zip` 或 `org-sidecar`（约 500MB Node 运行包）。`OPENXYOS_RUNTIME_ZIP_PRESENT` 默认关闭；仅 `SHIP_OPENXYOS_RUNTIME=1` 的构建才带边车。

## [0.0.1] - 2026-09-15

首个 FreeOS 产品版本（桌面默认拉起本机 openXYOS Node 边车）。后续版本见 [0.0.2]。规范来源是 `pyproject.toml`。历史发布标签为 `v0.0.1`；不重写已推送的历史 tag。


### 新增

- Finished self-growth loop: `freeos org loop run` compiles blueprints, promotes colleagues, registers FreeOS chat agents, publishes an asset pack, applies it to openXYOS (HTTP + local mirror), imports back, and proves governance blocks high-risk tools
- `freeos org assets apply` POSTs/PUTs employees, talent, plugins, and module-settings; durable `{FREEOS_HOME}/openxyos-mirror/`
- Inbound import / lifecycle `shadow|active` spawn real FreeOS agents (`org-<slug>`) via the host agents table + routing
- Host-wide governance: `OrgGovernanceMiddleware` spliced into the harness tool path so pending/deny cannot execute
- Colleague routing + org-knowledge live memory so produced employees are usable in FreeOS chat
- Demo fixtures in `tests/fixtures/org-loop/` and e2e proof `tests/e2e/test_org_growth_loop.py`
- Phase A: `xyos-governance-mcp` default-denies high-risk tools and durable-pauses for human approval (`freeos org governance`)
- Phase A: module ↔ skill bridge generates catalog skills with tenant headers and a tenant-toggle publish draft (`freeos org skills`)
- Phase B: `xyos2freeos` compiles `openxyos.agent-blueprint.v1` into tenant-scoped employee workspaces
- Phase B: digital-colleague lifecycle (`draft`→`offboard`) with credential revoke + memory archive
- Phase B: bidirectional asset factory (`freeos org assets publish|import`)
- Phase B: imported openXYOS policy matrices load into `xyos-governance-mcp` (explicit allow still requires human approval)
- Phase B: outbound `freeos.asset-pack.v1` writes `org-employees.publish.json` / `org-talent.publish.json` and redacts packed `.env` secrets

## [1.0.0] - 2026-09-14

> 继承自上游 Octop 的历史记录，不是当前 FreeOS 产品版本。

### 新增

- GA 版本正式发布
- 更新检查默认仅查稳定版，可选包含预发布

### 变更

- 登录页与浏览器标题 slogan 更新为「懂你、帮你、陪你成长的智能伙伴」

### 修复

- 备份列表大归档时不再全量扫描 tar
- 腾讯云语音探测失败在中文界面本地化

## [0.9.35] - 2026-09-13

### 新增

- 聊天支持 @ 提及工作区文件
- STT 探测改为真实识别调用，与 TTS 对称

### 修复

- 语音模型探测不再因凭证/网络错误返回 500，直接展示云厂商真实错误原因
- 浏览器录音上传前转码为 WAV，修复腾讯/Mimo 语音识别不支持 webm 容器导致的识别失败
- STT 探测改为真实识别调用，与 TTS 探测对称，凭证/网络错误以 ok:false 返回
- 语音探测按界面语言返回中文/英文错误（含腾讯云 SecretId 等常见鉴权失败）
- 语音探测失败直接展示错误，不再返回 500；录音上传前转码为 WAV
- `/compact` 回复隐藏本机绝对路径
- `octop run` 正确应用 `OCTOP_PORT` / `OCTOP_BIND_HOST`

## [0.9.34] - 2026-09-12

### 新增

- 聊天头像改到输入框两侧，失败轮次保留内容和错误
- 定时任务空状态改用专家任务示例

### 修复

- 刷新后消息时间戳不再丢失，用户气泡与头像对齐
- FnOS 安装向导接管管理员密码，避免默认弱密码导致无法启动

### 变更

- README 补齐知识库、插件、PostgreSQL 等说明

## [0.9.33] - 2026-09-11

### 新增

- 知识库支持下载原文、按原排版预览，聊天内可直接预览引用
- 技能可在技能包与专家工作区之间复制
- 记忆树支持手动新建与修正；Token 统计支持日期筛选与 Excel 导出
- 按用户限制存储根目录与 Token 配额；创建专家可带默认知识库与连接器
- 聊天支持 @ 子专家、技能斜杠插入，以及 ask_agent 独立对话线程
- 滴滴连接器；可选分段历史归档；便携运行时升级并支持 SQLite 备份

### 修复

- 工作区 zip 导出不再被 backend 根目录同名文件顶替；导入时保留隐藏系统状态
- 知识库文本文档编辑保存生效；共享专家技能可在聊天中使用
- 斜杠命令刷新后仍可见；新会话标题即时更新
- 升级检查失败提示本地化；OpenCode Go 请求携带会话 ID

### 变更

- 聊天点技能改为插入 `/slug`；创建定时任务必须填写名称
- 依赖 harness-gateway ≥ 0.9.6、orcakit-harness-agent ≥ 1.0.8
### 新增

- QQ 私聊默认走官方 `stream_messages` 替换流式：进站先发不可见换行 hold，再按完整 markdown 块更新同一条气泡；`<think>` 会剥掉且不 `.trim()` 掉换行
- 流式失败、前缀被拒（`40007`）或只发出 hold 时，回落为一条静态 markdown（`msg_type=2`，失败再 `0`）

### 修复

- 飞书话题内回复改走话题回复接口并带 `reply_in_thread`，失败时回退为群内普通发送；话题以 `thread_id` 作为会话主体

### 变更

- QQ 私聊不再使用通用「回复模式」开关，旧键 `streaming` / `response_mode` 无效；只有显式 `c2c_streaming: false` 才退出流式
- QQ 群聊 / 频道 / 频道私信没有 stream API，仍只发静态消息
- 控制台保存 QQ 通道时写入 `c2c_streaming: true`，并提示工具过程会另占每条入站约 4 条被动回复配额
- 依赖 `harness-gateway>=0.9.7`（含 QQ C2C 替换流式与飞书话题修复）

## [0.9.32] - 2026-09-06

### 新增

- 聊天运行轨迹抽屉与回合时间轴；人机确认以可读审批卡片展示
- 知识库支持更多文档格式与可选 OCR，上传显示进度
- 定时任务支持名称，计划回合持久化
- 备份可选择归档内容；连接器支持多实例与共享；插件可按智能体开关
- OpenSandbox 远程沙箱；工作台浏览器按用户隔离 profile
- 飞书扫码创建应用；远程手机可自动安装 Docker
- 桌面端 Windows NSIS 安装包与 macOS DMG；未知路由 404 页

### 修复

- 斜杠命令写入 harness 会话 checkpoint，刷新后仍可见，且下一轮模型能读到
- 桌面客户端打包把 `pyproject.toml` 版本写入 macOS Info.plist、Windows 文件版本和 NSIS 安装器，不再沿用写死的旧号
- 用户发布专家卡片展示快照内自定义头像（`icon_url` + `/api/experts/published/{id}/avatar`），不再只显示默认 Lucide 图标
- 用户管理表格（桌面端）横向滚动时固定用户名与操作列（与专家列表一致；移动端不固定）
- 运行轨迹流式事件在内存聚合、回合边界持久化，避免逐 token 写库和重复存储上下文全文
- 运行轨迹 Turns / Calls 折叠与耗时投影：历史缺 `turn_id` / 时长时回退为 USER 边界与内容体量估算，避免开关无效
- 知识库表格模式宽屏仍出现多余水平滚动条（列宽拖拽手柄越出最后一列）
- 聊天右侧停靠/弹窗工具栏避开无边框窗口按钮，避免与红绿灯重叠
- 桌面启动页改为白底卡片和底部进度条；Windows 设置窗加高，避免底边距被裁掉
- 桌面壳内隐藏「安装为桌面应用」，避免在已原生窗口里再提示 PWA 安装
- 日志按大小+按日轮转，并采用 logrotate 风格的 `compress` + `delaycompress`（最新一份轮转文件暂不 gzip，下一轮再压；用 Python 标准库，Windows 可用）
- 远程手机自动安装 Docker 后，非 root 时用 `sudo -n` 写 `daemon.json` 并重启 dockerd
- 旧备份在 schema 变更后可恢复；桌面打包版本与应用元数据对齐
- 主动关怀时区、专家卡片头像、用户表固定列
- 运行轨迹写库开销、日志轮转、通道二维码轮询与远程 Docker 安装权限

### 变更

- 语音与搜索设置迁到模型页；控制台改用 OctopSpinner
- 默认管理员凭据改为首次运行写入 `~/octop-login.txt`

## [0.9.31] - 2026-09-01

### 新增

- 聊天流式输出时默认展开思考/工具过程，回答完成后收起（历史记录仍收起）
- 聊天侧栏与 @ 选择仅展示运行中的专家
- 默认专家与控制台创建的专家一样使用家目录存储；聊天待办按计划顺序展示
- 工作台浏览器可显式结束本地 Chrome 进程；空闲超时后也会回收（登录态仍保留在磁盘 profile）
- 桌面端右上角窗口控制（最小化 / 最大化 / 关闭进托盘）

### 修复

- 过期 hashed 静态资源返回 404，避免升级后桌面壳加载旧脚本
- 桌面无边框窗口改为 CSS/JS 拖拽，去掉会挡住右上角按钮的 `InvisibleTitleBarHeight`
- macOS 点击程序坞只恢复主窗口，不再同时弹出托盘设置窗
- 专家详情技能/子智能体卡片：图标在标题左侧，状态或 id 在标题右侧，描述单独一行
- 桌面端等待本机服务就绪失败时改为中英文说明（跟随桌面语言设置），不再显示 `/api/health` 英文报错
- 桌面启动页补齐右上角窗口按钮，并收紧启动/失败状态的展示
- 桌面托盘设置窗去掉多余空白，右上角只保留关闭；macOS 单击菜单栏图标也会弹出设置

## [0.9.30] - 2026-08-31

### 新增

- 腾讯云 Token Plan 企业版与 Hy 套餐
- WeKnora、Dify 连接器，以及自定义 MCP 的 OAuth
- 备份/恢复、聊天工具栏、SSO 预设与更友好的供应商错误提示
- 技能展示本地化；知识库可配置文档数量上限；钉钉扫码注册
- 对话接入 ask-user-question 人机确认流程

### 修复

- 专家根目录、连接器排序、飞牛图标及主题确认对话框等界面问题
- 聊天中文语音识别跟随界面语言
- MCP OAuth 刷新失败需重新授权；渠道异常 thinking 输出过滤
- 数据库 v10 迁移遗漏 thread projection 表
- 飞牛 FPK 无效在线升级与原生版启动加载；长会话相关问题
- 通道弹框文案统一为「通道」，新建默认实时过程
- `octop acp` 启动即崩溃（CLI 注册表属性应对齐 `acp_cmd`）

## [0.9.29] - 2026-08-27

### 修复

- 长会话卡死：聊天历史改为独立投影分页加载，并支持后台迁移旧会话（不再同步扫 checkpoint）

### 变更

- 依赖：`orcakit-harness-agent[all]>=0.9.27`、`harness-memory>=0.9.7`、`harness-browser>=0.7.6`（自动 full VACUUM 关闭，空闲维护只走 lifecycle GC + incremental `nudge_vacuum`）

## [0.9.28] - 2026-08-26

### 修复

- 无更新权限时隐藏检查更新入口
- `/compact` 兼容 `.octop/conversation_history/` 卸载路径
- FnOS 镜像改为 Docker Hub `jubaoliang/octop`

### 新增

- 基层医生学习助手增加普通医学问答快路径、国内专业学会/专科分会与国际指南精确路由，并完善受控信源降级和检索预算。

## [0.9.27] - 2026-08-26

### 新增

- 内置插件随包装分发（默认关闭，卸载后升级不重建）
- 可配置上传上限（`max_upload_mb` / `OCTOP_MAX_UPLOAD_MB`，默认 100MB）
- Dashboard 推送通知（定时任务与主动关怀 toast）
- 聊天音视频附件预览播放，并扩展 inbound 附件 MIME
- 火山方舟 Seedream / Seedance 生成模型配置、测试与结果展示
- 连接器：Ardot、滴答清单；远程 MCP OAuth 改为 catalog 驱动
- 单工具开关热更新与插件工具目录
- ACP 内置 Runner：Kimi Code、Cursor CLI、Pi
- 知识库文件夹重命名
- ONNX 模型下载竞速 Hugging Face 与 hf-mirror
- 远程手机 ADB shell（旋转与分屏布局）
- FnOS NAS 应用打包（Docker / native `.fpk`）
- 专家模板扩充（通用、Karpathy、临床来源策略）
- 中文子智能体约 49 个（HR / 法务 / 供应链）
- Dashboard 剪贴板回退与聊天 UI 打磨

### 修复

- 知识库文件夹操作按钮误开文件夹
- 工具预期失败不再误报为 `stream_error`
- 连接器 OAuth 公网回调 / HTTPS / 自动保存；npm 不可写时回退用户级 prefix
- SSO ID token issuer 校验
- Dashboard：SW 激活后再 reload、Firefox 无限刷新、选择器 popover、文案全球化
- 浏览器 runtime 目录在 Windows 上可写探测

### 变更

- FnOS 打包拆分为 `docker/` 与 `native/`

## [0.9.26] - 2026-08-23

### 新增

- 远程手机（实验性）：安装时探测主机移动能力（`capabilities.mobile`，物理机 / Redroid / KVM）；能力开启后开放 `GET /api/settings/capabilities` 与 `/api/mobile/*`。控制台「远程手机」支持 adb H.264/JPEG 推流、触控、画质预设、设备信息与 AI 助手面板；智能体移动工具绑定当前远程手机会话
- 控制台布局支持经典 / 极简模式，聊天记录统一承载；用户可选填邮箱（邀请 / 登录）；知识库支持应用内编辑 markdown / txt；远程桌面与远程手机合并为统一控制入口

### 修复

- 邀请链接统一为 `/invite?code=`，修复邀请页居中与移动端在 overflow-hidden 壳下的滚动；启动前显示 logo 加载动画；设置页邮箱输入图标对齐；移除聊天坞中的远程手机入口
- 加固 dashboard 鉴权与请求层（setup 锁定 503、401 刷新）、登录页与 AuthGuard 体验；按服务器能力门控移动端功能；远程控制中枢页签文案缩短为「服务器 / 手机」

## [0.9.25] - 2026-08-21

### 新增

- Token 计量新增缓存命中支持：按模型调用累计未缓存输入、缓存读取、缓存写入、推理 Token 与模型调用次数；用量页和消息气泡展示缓存命中数据。
- 编辑专家抽屉可修改标题语（欢迎语），与创建时同一字段，写入智能体实例而非仅页面配置
- 专家支持上传自定义头像，写入工作区 `.octop/avatar.png`（或 jpg/webp/gif）并通过 `agents.icon_url` 展示；发布快照会带上头像，安装后自动绑定。未设置时仍用配色 + Lucide 图标
- 实例化专家的欢迎语改为单一 `welcome_message` 字段（用户自填，不再分中英）；专家模板仍保留双语欢迎词
- 智能体状态接口返回 `memory_maintenance`（queued / pruning / compacting）。聊天页显示阶段进度条，整理本库时暂停发送；专家卡片显示「整理记忆」标签。
- 聊天页：文件工具卡片显示「编辑了 N 个文件」（不含截图）；文件面板标题改为「文件变更」。会话 `artifacts` 由 Octop 工具中间件在写文件 / 发文件 / 桌面截图成功后写入，切换会话后仍可在文件变更中查看。路径优先取工具 args，仅在 args 没有 path 时才扫结果文本。专家选择器「共享」标记与名称同一行。右侧增加工作区入口；工作区目录树支持将文件拖到其他文件夹。
- 知识库、技能包、已发布专家改为整数自增 `id` + 对外字符串 ID（`knowledge_base_id` / `skill_package_id` / `published_expert_id`；文档用 `kb_id` 关联）。`agents` 仍用字符串引用技能包与已发布专家。知识库文档支持文件夹路径；分片大小等仍存实例 `settings`。删除未使用的 `knowledge_base_members`。上述库变更与专家资料列、会话 artifacts、实例欢迎语单字段一并作为 schema v7。
- 对话检索结果附带知识库引用标记；聊天页在回答下方展示可点击的来源文档（跳转知识库页）

### 修复

- 技能：修复编辑已导入技能并保存后，技能内其余文件与文件夹（README.md、references/ 等）被整体清除的问题——内容编辑（仅 SKILL.md）现原地覆盖清单文件、保留全部同级文件；携带完整 `files` 载荷的更新仍整目录替换（与覆盖重装语义一致）
- Harness usage 事件按稳定调用 ID 去重，避免流重放重复计费；上下文环保留路由模型的真实窗口上限，并将构成拆分明确显示为近似估算。
- Admin 环境变量未进入正在运行的 Agent：本地 shell 默认不继承进程 env，Docker exec 也不传 env，工作区 `.env` 只落盘不注入。现本地 shell 每次 execute 继承当前进程环境（含 `~/.octop/env`）并 overlay 工作区 `.env`；Docker 热读全局文件 + 工作区 `.env` + 最小 PATH（不含完整宿主机环境）。保存 Admin 列表会从进程环境删除已去掉的键；仅搜索类 key 变化时后台 reload Agent。MCP stdio 只注入 SDK 安全子集 + 全局/连接器 env，不再灌入整份 `os.environ`。
- Token 用量账本每轮只记下最后一次模型调用，工具循环中前面若干次调用被丢弃，页面合计会远低于聊天里看到的用量；现按该轮全部 AI 调用的 `usage_metadata` 累加，以 `state_snapshot` 为权威终值（snapshot 之后的增量不再相加），畸形 usage 字段跳过以免打断对话
- 插件工具使用中文等非 ASCII 名称时 LLM 调用失败：主流 API 要求工具名匹配 `^[a-zA-Z0-9_-]{1,64}$`，现自动将非法名称转写为合法拼音名（`pypinyin` 缺失时退回下划线替换），冲突追加 `_2`/`_3` 后缀，并在工具描述前缀 `[原名: …]` 保留原名映射；`config_json.plugins` 配置键与插件内部仍使用原始名称，路由不受影响
- 修复聊天页在"生成中"时于输入框持续打字导致消息列表上下轻微抖动的问题：输入框高度测量改为在离屏克隆节点上进行，不再瞬态改变页面布局
- 工作区读写在 harness 后台重建窗口（DB 仍为 running）回退到 `workspace_for_agent`，避免误报 `AGENT_NOT_RUNNING`
- 聊天页上下文占用环：旧会话没有分段快照时，从消息上已有的 `usage_metadata` / `response_metadata.token_usage` 回填已用量；相对 1M 级窗口不再把真实占用四舍五入成 0%
- 专家抽屉保存页面配置时合并写入 `manifest.json`：保留其它字段与另一语言欢迎语；加载未完成或未改动时不写文件
- 修复个性化「通道」面板在页面放大后不出现纵向滚动条、被挤出的通道卡片无法查看的问题：工具栏固定、卡片网格改为内部滚动区（与技能面板一致），移动端仍整页滚动

## [0.9.24] - 2026-08-15

### 新增
- 知识库：新增知识库与对话检索，支持本地 ONNX 向量嵌入模型运行
- 认证：新增 OpenID Connect（OIDC）单点登录
- 权限：新增按用户模块权限（RBAC）及管理员绕过
- 专家：支持将工作区快照发布为可安装模板（专家市场）
- 智能体：支持将智能体共享给其他用户
- 技能：新增对话式技能管理器（SkillHub），并兼容 Windows
- 备份：新增自动定时系统备份
- 频道：新增 final-only 仅终稿回复模式
- 线程：支持从 AI 回复处分叉会话（fork）
- 体验：HITL 工具选择器、运行时按需安装、KB/技能 UX 优化；对话与镜像等界面打磨；知识嵌入初始化流程加固

### 修复
- 媒体/预览白名单补充音频 MIME 类型
- 修正 ONNX 下载检测在未安装 fastembed 时的误判
- 加固更新状态缓存与存储处理
- 预提交门控：修复 staged 变更检测，避免 testmon 门控误报为绿

### 变更
- 升级 harness-browser 依赖至 0.7.5
- 数据库 schema 收敛为 v5
- 备份恢复面板图标更新为 CalendarClock；对话/镜像等界面打磨

## [0.9.23] - 2026-08-13

### 修复
- 取消首次引导时删除 `octop-login.txt` 引导密码文件的逻辑，避免引导密码意外丢失
- 修复安装脚本版本显示问题，并将安装输出调整为英文

### 新增

- Octop-owned built-in `skill-manager` for conversational Skill lifecycle
  management from uploaded files, archives, Git/GitHub or web URLs, and
  SkillHub. It is seeded into every agent instance without modifying
  harness-agent and installs user Skills only under that agent's `skills/`.

## [0.9.22] - 2026-08-11

### 新增
- 专家工作区支持 `.docx` 在线编辑：以 Markdown 在 Monaco 中打开/保存，保存时转回 docx 覆盖原文件（标题/加粗/斜体/列表/表格保留，复杂格式简化）；工作区新建的 `.docx` 即初始化为合法文档包，预览/编辑立即可用。基于可扩展注册表，新增可编辑后缀只需注册一个后端转换器类 + 前端注册表一行

### 变更
- 依赖新增 `python-docx==1.2.0`（含 `lxml`），用于工作区 `.docx` 的 Markdown 往返转换

### 修复
- 仪表盘发版后或长时间未打开时白屏：Service Worker 不再 Cache-First 钉死旧 `index.html`；hashed 资源改为 CacheFirst；入口脚本失败时清除 SW 缓存并自动刷新一次 (#236)

### 安全
- 仪表盘 SPA 静态回退路由加固：在拼接路径前显式拒绝绝对路径与 `..` 父目录引用，并保留最终 `relative_to` 校验，杜绝路径穿越读取 dashboard 目录之外的文件（修复 CodeQL 标记的 Uncontrolled data used in path expression）

## [0.9.21] - 2026-08-11

### 新增
- 插件管理页支持从本地 ZIP 上传安装插件，可选覆盖已安装的同名插件，无需先把插件托管到 HTTP 直链
- Docker 沙箱 backend（agent `config.backend.type=docker` 或存储 `kind=docker`）；Admin Docker 卡片、本机 Docker 探测/安装；详见 [docs/agent-backend-file-io.md](docs/agent-backend-file-io.md) §13
- 强制密码策略并优化账户与子代理（subagent）使用体验
- 浏览器 HITL 流式交互与网关抢占能力
- 新增每用户模型与推理（reasoning）偏好设置

### 变更
- 依赖 `orcakit-harness-agent[all]>=0.9.20`；FilesystemGuard / ModelSettings 由 harness 自动挂载（Octop 仅保留 BinaryReadGuard 与 runtime_limits）
- 专家 `workspace_dir`：创建时写入 `config_json.workspace_dir`（默认 `{OCTOP_HOME}/agents/<id>/`），所有 backend 共用；Docker 在容器内镜像同名路径为专家工作区，宿主同路径放 sessions/memory/checkpoints
- Docker：`sandbox_scope`（agent/user/fixed）+ `sandbox_prefix`（默认 `octop_sandbox`）；删专家不删容器；专家工作区在 running 时可预览；Admin 存储 `previewable` 仅控制浏览（默认仅 fixed）；探测用 test 沙箱做真实读写
- 删除被专家 `named` 引用的存储后端时返回 `STORAGE_BACKEND_REFERENCED` 并列出引用专家
- 将 IM 频道定时任务从 ACE 迁移至 Octop cron

### 修复
- 超大图片不再降级为附件路径提示：超过视觉嵌入上限（2 MB）的图片由 Pillow 压缩缩放至最长边 1568px 后仍以内联图片嵌入请求（保留 EXIF 方向与透明通道，仅当压缩失败时才回退为路径提示），视觉模型自动升级随之生效 (#219)
- 保留技能 ZIP 导入时的空目录与根级技能的子文件夹
- 修复移动端个人设置抽屉，并恢复玫瑰色主题配色

## [0.9.20] - 2026-08-09

### 新增
- QQ 频道二维码扫码绑定，支持群聊上下文（仪表盘频道抽屉 + `octop channel` CLI）(#160)
- 语音接入小米 MiMo STT / TTS 供应商（`mimo-v2.5-asr` / `mimo-v2.5-tts`），设置页可选择计费端点与 9 种预置音色，TTS 标注限免 (#186)
- 仪表盘自定义品牌配色：8 套调色板（玫瑰 / 科技 / 靛蓝 / 青绿 / 紫罗兰 / 翠绿 / 琥珀 / 石墨），与浅色 / 深色模式正交且本地持久化

### 修复
- Windows 下新建 agent 时，本地后端 `root_dir:"/"` 被解析为当前盘根目录，导致读取工作区（通常位于另一盘符）时抛 `Path ... outside root directory`；现在后端规格解析会在 Windows 上将主机根 `/` 的 `root_dir` 改写为工作区路径（保留原 `type` 等字段）
- 删除专家时同步清理 `~/.octop/agents/<id>/` 工作区目录（rmtree 移出事件循环执行）；清理失败不阻断数据库删除；仪表盘与 CLI 删除确认提示工作区将永久删除且不可恢复
- 乐享连接器 MCP URL 补充 `preset=meta` 参数并简化快捷授权链接 (#213)
- 专家卡片的编辑 / 删除按钮默认可见，不再仅在悬停时显示 (#187, #193)
- 登录页滑动验证通过后，提示文案居中显示在滑块左侧的可见区域 (#185)

### 变更
- 企业微信客户群二维码与文档有效期更新至 2026-08-16

## [0.9.19] - 2026-08-05

### 新增
- 登录页滑动验证控件；侧栏与 Agent 资料抽屉 UI 优化 (#170)
- 聊天历史 API 返回 `turn_active`，重连客户端可 re-subscribe WebSocket 恢复流式输出 (#168, #157)
- Workbench 与聊天 Dock 共用同一 terminal 会话；旧式硬切会话标题迁移为带省略号的裁剪标题 (#157)
- 局部 `root_dir` 下 Linux bubblewrap execute jail（`POST /api/filesystem/ensure-bwrap`、仪表盘 root 目录树 mkdir/rename）(#167)
- 虚拟工作区路径 I/O：host 绝对路径经 `file://` 与 `BackendWorkspace` failback 对齐 (#167)
- 高级设置「更新」页提供按安装方式升级说明与一键检查升级双栏布局；HTTPS 页优化签发状态与预检展示 (#143)

### 修复
- 401 会话过期时通过 React Router 跳转登录，避免整页 reload 导致 lazy chunk 白屏 (#169)

### 变更
- `make all` 先执行前后端 `format-all`（Ruff + Prettier）；pre-commit 在 format 后回写已暂存文件并构建 dashboard (#143)
- harness runtime 诊断日志写入 `~/.octop/logs`（与 `octop.log` 并排），不再落到各 agent workspace 的 `logs/`；行内带 `[agent=…]`
- 依赖 `orcakit-harness-agent>=0.9.19`、`harness-gateway>=0.9.1`（scoped root execute jail）
- 企业微信客户群二维码与文档有效期更新至 2026-08-08 (#149)

## [0.9.18] - 2026-08-02

### 新增
- 聊天 Dock 支持可关闭的文件列表 / 预览 / 浏览器标签页，以及 PR 风格路径树与路径去重；账户气泡与侧栏交互打磨 (#130)
- 内置示例插件（greeting / toolkit / turn-logger）与中英文插件说明文档
- 搜索设置页显性展示当前搜索源：未配置第三方服务时提示内置搜索，配置后展示实际服务 (#109)

### 修复
- 已停止或禁用的专家统一返回 `AGENT_NOT_RUNNING`（不再误报未找到）；管理员 Token Usage 支持按用户筛选；聊天会话频道图标与创建用户角色选择优化 (#137)
- 强化插件安装错误诊断与自定义 MCP 校验；网关流式错误支持本地化
- 聊天流式错误在界面可见；Token Usage / Memory 图表与空状态展示优化；弹层 Dock 几何与全屏行为修正

### 变更
- 设置、连接器、插件管理与管理用户等页面统一到共用仪表盘布局语言
- Docker / 安装文档中的国内加速镜像示例改为腾讯云镜像 (#116)
- 依赖抬升：`orcakit-harness-agent` ≥0.9.18、`harness-memory` ≥0.9.5；对齐 Python 3.12 目标与依赖刷新 (#118)

## [0.9.17] - 2026-07-31

### 新增
- 全局技能包：实例级可复用技能集合，支持挂载到专家、从 SkillHub 导入技能集，以及本地 ZIP / URL 导入技能
- 个性化页整合技能 / 子专家 / 频道 / MBTI / 记忆；技能包管理页支持移动端列表详情切换
- 搜索设置页显性展示当前搜索源：未配置第三方服务时提示使用内置搜索（免 API Key，不保证稳定），配置后展示实际使用的服务 (#109)

### 变更
- 技能相关域逻辑迁至 `infra/skills/`；数据库迁移合并为 schema v2（cron MCP + skill_packages 含图标）(#108)
- 备份/恢复纳入 `skill-packages/` 目录，恢复前清空避免残留 (#108)
- 统一聊天生成中 / 滚动辅助逻辑；antd message 经 App.useApp 绑定，支持主题感知 toast (#119)

### 修复
- Memory 原始事件列表的时间戳按服务器时区展示，与其余 Memory 页保持一致 (#110)

### 修复
- 记忆提取 / 提升等 harness 内部辅助 LLM 默认跟随全局偏好模型（此前切换全局模型后仍回退到首个可用模型）(#110)

## [0.9.16] - 2026-07-29

### 新增
- 统一自定义 / 预设 / 配置提供商弹窗的模型编辑流程，支持拉取 OpenAI 兼容远程模型列表，并仅在显式保存时落库 (#91)
- 支持从 LightClaw 迁移导入（备份快照与系统归档兼容，含外键约束处理）(#58)

### 修复
- 修复自定义提供商弹窗 TypeScript 错误（未使用导入 / 可选 `input`），恢复 release 构建
- 从 GitHub URL 导入技能时保留完整技能目录（含引用文件与脚本），并加固归档下载的分支名、文件数与体积限制 (#92)
- 浏览器配置不再对系统路径执行 chmod，改为使用共享目录 `~/.octop/browser-profiles` (#87)
- 部署后静态资源哈希不匹配导致白屏时，自动软刷新一次并防止重载死循环 (#88)
- 修正网易邮箱 IMAP 主机解析，并在登录前发送 IMAP ID；同时加固 QQ / 网易 / Gmail 邮件主机预设与探测 (#89)

### 变更
- 最低依赖 `orcakit-harness-agent` 提升至 ≥0.9.16
- README 补充中长期 Roadmap / 规划说明
- 新增可选 `.githooks` 提交前检查（`make install-hooks`）

## [0.9.15] - 2026-07-27

### 修复
- 加固聊天导航：切换专家时避免残留旧会话 URL，并稳定流式 Markdown 渲染
- 优化 Memory / Token Usage 页面布局，消除嵌套滚动并改善信息密度
- 补充企业微信客户群二维码相关文档说明

## [0.9.14] - 2026-07-25

### 新增
- 控制平面支持 PostgreSQL 双后端（统一 DatabasePool、并行 PG 迁移、安装向导选择/绑定、pg_dump 备份；PostgreSQL 下记忆默认复用控制平面 DSN）(#60)
- SkillHub 改为走 HTTP API，支持来源中立的技能包安装与搜索 (#55)
- 远程浏览器/桌面支持真实拖拽（转发 CDP 指针事件），并共享推流连接中指示 (#50)
- 聊天界面布局与交互打磨：历史侧栏、消息队列、自动滚动与欢迎页等体验优化 (#66, #69, #70)

### 修复
- 修复 macOS/Linux 上 Agent 上下文历史写入主机根目录的问题：依赖 harness-agent≥0.9.12 将 deepagents artifacts 落到 Agent 工作区 (#57)
- Provider catalog 的 `context_window` 映射为 harness `max_input_tokens`，修复 Auto/摘要阈值与 UI 上下文环按错误上限计算的问题
- 元宝扫码绑定后保存官方 API 与 WebSocket 地址，并升级网关至 0.8.7 以支持完整媒体收发 (#56)
- ChatGPT/Codex OAuth 改为 device code 流程，修复非 localhost 部署下授权失败 (#54)
- 技能 CLI 安装不再根据用户输入的 slug 推导路径，避免装错包 (#63)
- 删除会话时同步清理 harness checkpoint，避免「删除」后消息历史仍残留 (#60)
- 修正 PostgreSQL 记忆可移植导出的误导性 pg_dump 提示（共享 schema 下按 namespace 隔离，不可整库导出单 agent）(#60)
- 技能启用/禁用与 SkillHub 安装不再触发整机 Agent rebuild，避免切到技能列表时短暂「未找到 Agent」
- 修复聊天向上滚动加载更早消息失效，并在列表未溢出时提供可点击回退
- 工作区路径语义澄清（`from_workspace`），并加固 Windows 下 file URL / 主机路径校验

### 变更
- `/compact` 改为在当前话题强制触发一次 Summarization（总结较早消息并 offload 到 `conversation_history/`），不再新建线程；新建空话题请用 `/new`
- `/compact` 成功提示明确：聊天界面仍保留完整历史，压缩的是下一轮模型可见上下文
- 文档与发布流程改为 develop 日常集成、先合入 main 再打 tag (#48)

## [0.9.13] - 2026-07-23

### 新增
- SkillHub 改为走 HTTP API，支持来源中立的技能包安装与搜索 (#55)
- 远程浏览器/桌面支持真实拖拽（转发 CDP 指针事件），并共享推流连接中指示 (#50)

### 修复
- 修复 macOS/Linux 上 Agent 上下文历史写入主机根目录的问题：依赖 harness-agent≥0.9.12 将 deepagents artifacts 落到 Agent 工作区 (#49, #57)
- Provider catalog 的 `context_window` 映射为 harness `max_input_tokens`，修复 Auto/摘要阈值与 UI 上下文环按错误上限（如 128k）计算的问题
- 修复取消聊天任务后再次提问会一直停留在思考状态的问题 (#42, #43)
- 技能启用/禁用与 SkillHub 安装不再触发整机 Agent rebuild，避免切到技能列表时短暂「未找到 Agent」
- 内置专家卡片标题与图标水平对齐
- SkillHub / 专家市场在 Python SSL 失败时给出可操作提示，并修正技能市场错误态「Retry」未本地化为「刷新」(#44, #46)
- 元宝扫码绑定后保存官方 API 与 WebSocket 地址，并升级网关至 0.8.7 以支持完整媒体收发 (#56)
- ChatGPT/Codex OAuth 改为 device code 流程，修复非 localhost 部署下授权失败 (#54)
- 远程桌面安装拒绝不支持的 EL10 环境 (#41)
- 聊天上下文占用图例在空会话时对齐 (#40)
- 修复聊天向上滚动加载更早消息失效，并在列表未溢出时提供可点击回退
- 工作区路径语义澄清（`from_workspace`），并加固 Windows 下 file URL / 主机路径校验

### 变更
- `/compact` 改为在当前话题强制触发一次 Summarization（总结较早消息并 offload 到 `conversation_history/`），不再新建线程；新建空话题请用 `/new`
- `/compact` 成功提示明确：聊天界面仍保留完整历史，压缩的是下一轮模型可见上下文
- 文档与发布流程改为 develop 日常集成、先合入 main 再打 tag (#48)

## [0.9.12] - 2026-07-21

### 新增
- 备份恢复后可在进程内同步 providers 并重载 agent；提供商变更后仅重载受影响的 agent
- 新增服务端时区 API（`default_timezone` / `GET /api/settings/timezone`），控制台时间展示对齐服务端时区
- 记忆提炼支持为每个 agent 单独指定提取模型，并在整理记录中展示每次 extract_run 结果

### 修复
- 修复记忆提取模型无法 fallback 导致提炼失效的问题
- 修复语音输入 STT 回退处理
- 修复内部 MCP gateway 在事件循环上阻塞的问题
- 修复高级搜索探测接口缺失、表格分页卡在 10 条、新建会话图标提示，并加固安装脚本
- 改进 Notion OAuth HTTPS 错误提示

### 变更
- Memory 页签「全部」更名为「记忆沉淀」

## [0.9.11] - 2026-07-19

### 新增
- 新增 SkillHub 专家市场：支持浏览、安装与管理专家，并完善安装安全校验与欢迎页快捷卡片体验
- 新增自定义 MCP 连接器管理，支持探测、工具缓存与连接器配置

## [0.9.10] - 2026-07-18

### 新增
- 新增工作区文件预览与浏览器工作区支持，并完善相关工具链
- 新增聊天面板停靠式文件预览、HTML 预览与历史下拉刷新

### 修复
- 修复连接器 Notion OAuth 弹窗阻塞的问题 (#19)

### 变更
- 重构聊天界面，将浏览器面板与文件面板统一为 ChatDock
- 调整工作区路径透传逻辑，不再重写 BackendWorkspace 路径
- 将上下文使用统计委托给 harness-agent 0.9.10

### 移除
- 移除内置的临床医生专家 (#20)

## [0.9.9] - 2026-07-16

### 新增
- 新增远程桌面安装与连接器探测能力增强 (#16)

## [0.9.8] - 2026-07-15

### 新增
- 远程浏览器/远程桌面安装日志面板新增「复制日志」按钮，并在安装失败时提示可将日志交给 Octop 协助排查
- 新增前端 `copyText` 工具，在非安全上下文（如 plain-http 管理页）下通过临时 textarea + execCommand 回退，保证剪贴板复制可用
- 桌面安装脚本新增 `A-F4`（关闭窗口）与 `C-A-D`（显示桌面）openbox 快捷键，对应桌面快捷键

### 修复
- 修复桌面安装脚本的 Python 构建依赖检测：改用 venv Python（而非系统 `python3`）解析 `pythonX.Y-dev`，避免 evdev 编译时找不到 `Python.h`；`setup.py` 安装构建依赖时显式传入 `--python` 指向当前 venv Python
- 修复连接器类型漂移导致聊天弹窗 logo 解析失败的问题

### 变更
- Docker 构建与 `make build-frontend` 的 `NODE_OPTIONS --max-old-space-size` 由 4096 调低为 2048，降低构建内存占用
- 新增 `docker-publish.yml` 工作流，构建并推送镜像到 Docker Hub
- 移除 `release.yml` 中多余的 `id-token: write` 权限
- 删除已与现行 Docker Hub 发版流程脱节的离线部署脚本 `docker_deploy.sh`，并清理 `docker/README.md`、`README_CN.md` 中的相关章节
- 修正 `docker/README.md` 标题笔误（`ODocker` → `Octop`）

## [0.9.7] - 2026-07-14

### 新增
- 新增多款连接器网关适配器：百度地图、携程问道、飞猪、美团旅游助手、QQ 音乐、元典 (#14)
- 重构连接器网关目录与注册机制，支持更灵活的连接器安装 (#14)

### 修复
- 修复 Linux 远程桌面安装脚本在 EL7（TigerVNC 1.8）下的兼容性，避免 xfdesktop 阻塞安装

## [0.9.6] - 2026-07-13

### 新增
- 新增远程桌面（Remote Desktop）功能，支持跨 Linux、Windows、macOS 的桌面串流 (#7)

### 修复
- 从 .dockerignore 中移除 uv.lock，修正 Docker 构建无法 COPY 锁文件的问题 (#9)
- 修复远程桌面、浏览器、终端及安装向导的本地化（i18n）问题 (#11)

## [0.9.5] - 2026-07-12

### 新增
- 新增 Linux、Windows、macOS 三端的远程桌面串流能力
- 完善远程桌面的安装/卸载交互，并打包 Linux 端安装脚本

### 修复
- 修复 Windows 与 Linux CI 下桌面配置/捕获/输入相关单测与 mypy 报错
- 修复 Mac 端远程桌面安装时误导性的提示文案
- 加固桌面安装 SSE 流式推送并清理 dashboard 端 lint 问题

## [0.9.4] - 2026-07-11

### 新增
- 新增 agent backend 的主机 root_dir 浏览器与权限探测能力
- 改进聊天流式滚动行为与思考计时器

### 修复
- 修复 Windows 下 sqlite 路径测试、媒体路径与 POSIX 专属测试导致的 CI 失败
- 修复 Windows 测试收集问题（惰性导入 pwd 模块）
- 修复 harness-memory Bridge 导入路径
- 修复 CI 流水线并让测试套件通过，项目重命名为 Octop

### 变更
- Windows 兼容：默认 agent backend 限定到 workspace，并集中 POSIX 专属 stdlib 调用以适配 Windows mypy CI

## [0.9.1] - 2026-07-08

### 新增
- 远程浏览器控制页面与浏览器 AI 面板，支持远程浏览器自动化操作
- 附件下载的 `Content-Disposition` 头（RFC 5987，兼容非 ASCII 文件名）
- 前端 UI 语言偏好持久化（自动检测浏览器语言并记忆）
- 专家目录欢迎语（默认欢迎内容 / 工作区清单读取 / 专家目录播种）
- 附件相关国际化域（`i18n/domains/attachment.py`）
- 聊天欢迎语支持

### 变更
- 重构聊天附件与上传处理链路，精简接口与实现
- 重构网关媒体层：附件提示、入站存储、工具媒体展示重写
- 重构 harness 请求构造与消息处理器
- 调整上下文拆分、专家目录、provider 存储与 agent 管理器
- 重构前端聊天界面：输入框、消息气泡、工具媒体条、上下文窗口环等组件大量更新
- 更新登录、初始化向导、终端 AI 面板等前端页面

### 修复
- 修复附件路径解析与内容分发相关问题

### 移除
- 移除模型配置提示弹窗、旧聊天流模块、slash 上下文与附件签名测试
