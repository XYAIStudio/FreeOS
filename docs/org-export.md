# 独立组织站导出（Phase 4）

`freeos org export-standalone --out <dir>` 从 **同一套** `dashboard/src/org-ui` 生成可部署的 openXYOS 风格独立站。这是商业加售的交付物，不是第二份手维护前端。

默认 FreeOS 安装器 **不** 因此改成捆绑 Node。Sidecar 仍是可选兼容（`FREEOS_ORG_SIDECAR` / `SHIP_OPENXYOS_RUNTIME`）。安装器瘦身是 **Phase 5**。

## 生成

在 FreeOS 源码检出里：

```bash
uv run freeos org export-standalone --out dist/openxyos-web
```

输出目录自带：

- Vite + React 壳，路由对齐 OpenApp（`/app`、`/announcements`、`/org`、`/employees`、`/skills`、`/agents`、`/tasks`、`/knowledge`、`/reflections`、`/governance`、`/settings`）
- 拷贝后的 `src/org-ui`（不含测试）
- 独立 IdentityBridge：本地 JWT，键名 `openxyos.standalone.jwt`（**不是** Dashboard 的 `auth_token`）
- 登录页 → `POST /api/auth/login`
- `Dockerfile` + `docker-compose.yml` + `server/proxy.mjs`

**Chat 不导出。** `/chat` 只是深链说明页。

模板源在 `scripts/org-export/template/`。改页面请改 `dashboard/src/org-ui`，再重新导出。

## 客户怎么跑

详见导出目录里的 `README.md`。最短路径：

```bash
cd dist/openxyos-web
cp .env.example .env
# 把 FREEOS_UPSTREAM 指到已有 FreeOS（默认 http://127.0.0.1:8088）
npm install
npm run dev
```

或：

```bash
FREEOS_UPSTREAM=http://127.0.0.1:8088 docker compose up --build
```

浏览器打开 `http://127.0.0.1:3780`，用 **FreeOS 用户** 登录。

## 过渡路径 vs 目标终态

| | 本波（可演示） | 目标终态 |
|---|---|---|
| UI | 本包 SPA（org-ui） | 同一套 org-ui |
| API | 反向代理到 FreeOS `/api/org-module/*` | 本包自包含服务实现同一合同 |
| 身份 | 本地 JWT，登录打 FreeOS `/api/auth/login` | 客户自己的账号体系发本地 JWT |
| 安装器 | 不变；sidecar 仍可选 | Phase 5：默认安装器零 Node |

`VITE_API_BASE` 默认 `/api`（同源）。不要在浏览器里直连另一个源的 FreeOS，除非那个宿主已配好 CORS。推荐始终走代理。

## 配置

| 变量 | 时机 | 含义 |
|---|---|---|
| `VITE_API_BASE` | 构建 | SPA 的 API 前缀，默认 `/api` |
| `FREEOS_UPSTREAM` | 运行 | 拥有 `/api/org-module` 与 `/api/auth` 的 FreeOS 源 |
| `PORT` | `npm start` / Vite | 监听端口，默认 `3780` |

## 非目标（本波）

- 从默认安装器里摘掉 sidecar（Phase 5）
- 重写整套 Express → 独立 Node API
- 迁 openXYOS Chat
- 抽出 `packages/org-ui` monorepo（仅当 Dashboard Vite 图必须脱离时再做）
