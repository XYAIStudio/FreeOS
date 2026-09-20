# 独立组织站导出（可商业化 openXYOS 源码包）

> **Current：** [产品契约](product-contract.zh-CN.md)。`freeos org export-standalone` 默认写出可商业化的 openXYOS **系统源码**（`--mode full`：完整 `App.tsx` 树 + 宿主桥 slice）。`--mode slice` 仍是早期的 org-ui SPA + 反代，给只想对接宿主 `/api/org-module` 的场景。Phase-5 默认零 Node 与可选 sidecar/iframe 仍是过渡桥，不是本导出物。组织像工作室里另一间房间，与日常用法各自留白。

`freeos org export-standalone --out <dir>` 从 FreeOS 检出生成 **一份可二次产品化的源码包**。默认不是「只有薄壳 + 反代」。

默认 FreeOS 安装器 **不** 捆绑 Node，也 **不** 自动拉起 openXYOS。Sidecar 仅作可选兼容（`FREEOS_ORG_SIDECAR=1` / `SHIP_OPENXYOS_RUNTIME=1`）。这是 **Phase 5** 已落地的默认拓扑（过渡态）：一个 Python 进程 + 宿主内 Organization。导出是显式的商业/运营动作，不改变桌面包。

## 生成

在 FreeOS 源码检出里：

```bash
uv run freeos org export-standalone --out dist/openxyos-web
# 等同 --mode full
uv run freeos org export-standalone --out dist/openxyos-web --mode slice
```

### `--mode full`（默认）

| 路径 | 内容 | 许可证 |
|---|---|---|
| `openxyos/` | `modules/openxyos` 拷贝（完整 `App.tsx` + Express） | Apache-2.0 |
| `slice/` | `dashboard/src/org-ui` + Vite/Docker 宿主桥 | MIT |
| `modules.json` | 路由/模块清单，对照桌面 `/organization` | — |
| `README.md` / `README.zh-CN.md` | 含什么、仍反代什么、怎么跑、商业化说明 | — |

完整树用 Node 跑原来的组织前端（Open-12、商业垂类、组织沟通协作）。slice 仍把 `/api` 反代到 FreeOS。

### `--mode slice`

只写出 MIT SPA（与 full 包里的 `slice/` 相同）：OpenApp 风格路由、本地 JWT、登录页、Docker、`server/proxy.mjs`。**工作室智能体对话不导出。** 组织沟通协作在完整树里；slice 的 `/chat` 是说明页。`/coverage` 展示与 App.tsx / 宿主清单的对照。

模板源在 `scripts/org-export/template/`（slice）与 `scripts/org-export/pack/`（full 包说明）。改宿主切片页面请改 `dashboard/src/org-ui`，再重新导出。

## 客户怎么跑

详见导出目录里的 README。最短路径：

**完整组织应用（产品化）：**

```bash
cd dist/openxyos-web/openxyos
npm ci
npm run dev
```

完整树使用 **组织房间自己的注册/登录**，与 FreeOS 工作室日常入口分开。

**宿主桥 slice：**

```bash
cd dist/openxyos-web/slice   # 或 --mode slice 时的输出根
cp .env.example .env
# FREEOS_UPSTREAM 指向已有 FreeOS（默认 http://127.0.0.1:8088）
npm install
npm run dev
```

或：

```bash
FREEOS_UPSTREAM=http://127.0.0.1:8088 docker compose up --build
```

浏览器打开 `http://127.0.0.1:3780`。slice 登录目前打宿主 `/api/auth/login`，只是过渡桥，不是组织房间终态。

## 对照桌面组织模块

导出根目录（full）或 `src/modules.json`（slice）列出：

- 已抽到 `org-ui` 的宿主切片
- Dashboard `/organization/…` 路由
- `App.tsx` / `OpenApp.tsx` 每条路由的 `in_slice` / `in_full_tree` / `host_route_exists`
- **有意省略**：工作室智能体对话；桌面 iframe / NSIS；slice 不含商业垂类与组织会话（完整树含）

slice SPA 的 `/coverage` 用同一份清单做可视化对照。

## 仍走宿主反代的

| | `--mode slice` / `slice/` | `--mode full` 的 `openxyos/` |
|---|---|---|
| UI | org-ui SPA（Open-12） | 完整 App.tsx |
| API | 反代到 FreeOS `/api/org-module/*` | 自包含 Express |
| 身份 | 本地 JWT；登录打宿主（过渡桥） | 组织房间自己的 `/api/auth` |
| 安装器 | 不打进默认包 | 不打进默认包 |

`VITE_API_BASE` 默认 `/api`（同源）。不要在浏览器里直连另一个源的 FreeOS，除非那个宿主已配好 CORS。slice 推荐始终走代理。

## 配置（slice）

| 变量 | 时机 | 含义 |
|---|---|---|
| `VITE_API_BASE` | 构建 | SPA 的 API 前缀，默认 `/api` |
| `FREEOS_UPSTREAM` | 运行 | 拥有 `/api/org-module` 与 `/api/auth` 的 FreeOS 源 |
| `PORT` | `npm start` / Vite | 监听端口，默认 `3780` |

## 许可证

- **Apache-2.0**：`openxyos/`（及未改动拷贝），见该目录 `LICENSE` / `NOTICE`
- **MIT**：宿主桥 `slice/`（Vite 壳、IdentityBridge、拷贝的 org-ui、Docker/反代），见 `slice/LICENSE`
- 商标：`openXYOS` / `XYOS` 仅用于源码归属，见 `openxyos/TRADEMARKS.md`（若有）

## 非目标 / 残留

- 把 slice 也做成自包含 Express（slice 仍反代宿主 `/api/org-module`）
- 导出 FreeOS / Octop **工作室智能体对话**（组织沟通协作在完整树里）
- 抽出 `packages/org-ui` monorepo（仅当 Dashboard Vite 图必须脱离时再做）
- 把独立站 Node 打进默认 Windows/macOS/Linux 安装器（明确不做）
- 与 `POST /api/org-module/source/download`（GitHub 上游 zip）合成单一产物（仍是跟进项）
