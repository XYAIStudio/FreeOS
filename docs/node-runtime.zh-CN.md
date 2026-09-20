# Node 运行时：开关、默认值、拆除计划

**状态：** Node 打包的现行说明（P2）。产品意图见
[product-contract.zh-CN.md](product-contract.zh-CN.md)。能力地图：
[org-capability-migration-map.zh-CN.md](org-capability-migration-map.zh-CN.md) 波次 **E**。

托管 Node + iframe 是通往宿主原生组织界面的 **过渡桥**，不是终点，也不得把
`SHIP_OPENXYOS_RUNTIME=1` 再冻成永久产品。

[English](node-runtime.md)

## 默认（零 Node）

下列路径 **不** 捆绑、不解压、不自动拉起 Node：

| 路径 | 行为 |
|---|---|
| `uv run freeos run` / `octop run` | 仅 Python 宿主。组织页是 `/organization` + `/api/org-module/*`。 |
| Docker Compose / `docker/Dockerfile` | 单进程。无边车、无 3780。 |
| 默认 `desktop/portable/package.sh` | `SHIP_OPENXYOS_RUNTIME` 默认 `0` → `SKIP_ORG_SIDECAR=1`。 |
| 默认 `wails3 task package` | `SHIP_OPENXYOS_RUNTIME` 默认 `0`；NSIS 不打入 `openxyos-runtime.zip`。 |

缺少 Node 是 **跳过**，不是宿主崩溃。`ManagedOrganizationRuntime.start()` 在没有
捆绑/源码运行时时报警告并返回，因此源码树上误设 `FREEOS_ORG_INTEGRATED=1` 也不会让
`uv run` 失败。

## 过渡桌面口味（显式 opt-in）

GitHub 工作流 **FreeOS Desktop Package**（`.github/workflows/octop-desktop.yml`）
会设 `SHIP_OPENXYOS_RUNTIME=1` 与 `SKIP_ORG_SIDECAR=0`，让现有 Windows 用户仍能用
0.0.3 的 iframe 桥。该开关在工作流、NSIS 文案和本文里都标成 **过渡**。不要把它
复制进 Docker、`uv run` 或默认安装器。

| 开关 | 默认 | 含义 |
|---|---|---|
| `SHIP_OPENXYOS_RUNTIME` | `0` | 构建期：打入 `org-sidecar` / `openxyos-runtime.zip`。桌面 CI 设 `1`。 |
| `SKIP_ORG_SIDECAR` | 随 ship 标志（ship 为 `0` 时为 `1`） | 打包逃逸舱。显式 `0` 仍打边车。 |
| `FREEOS_ORG_SIDECAR` | 未设 | 运行期：拉起可选 `:3780` 边车。 |
| `FREEOS_ORG_INTEGRATED` | 未设（桌面 Go 可能设 `1`） | 运行期：`/organization` iframe 到 `/organization-app` + 托管 Node。 |
| `OPENXYOS_BASE_URL` / `FREEOS_ORG_SIDECAR_URL` | 未设 | 资产循环 / BFF 指向已有控制面。不拉起 Node。 |

## 拆除计划（对齐迁移图）

原生覆盖完成前 **不要** 删除托管运行时。顺序来自迁移图：

1. **保持** 默认安装器 / `uv run` / Docker 零 Node（本文）。
2. **保持** 桌面 `SHIP_OPENXYOS_RUNTIME=1`，直到波次 E 里仍只活在 App.tsx 的域
   有宿主原生路由可用。
3. **然后** 桌面 CI 不再设 `SHIP_OPENXYOS_RUNTIME=1`（与默认打包一致）。边车仍可
   `FREEOS_ORG_SIDECAR=1` 做导出/同步。
4. **最后** 去掉 `ManagedOrganizationRuntime` 和 `/organization-app` iframe 首页。

反目标：把 Node 重新打进 Docker 或 `uv run`；宣称 iframe「已完成」；把
`SHIP_OPENXYOS_RUNTIME=1` 扩到新口味。

## 镜像与安全（发版卫生）

| 项 | FreeOS 规范 |
|---|---|
| GHCR 镜像 | `ghcr.io/xyaistudio/freeos:{version\|latest}` |
| 本地 Compose 标签 | `octop:latest`（兼容别名；单 Python 进程） |
| 安全公告 | [XYAIStudio/FreeOS](https://github.com/XYAIStudio/FreeOS/security/advisories/new) |
| PyPI 包名 | `octop`（有意保留的标识；CLI 是 `freeos`） |

### 发版 / PyPI / Docker 门禁

- **Docker Publish** 始终推 GHCR。Docker Hub 登录是 **可选**
  （`DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`）。没有 Hub secrets 不得让工作流变红。
- **PyPI** 仍发布名为 `octop` 的发行版（`pypi` 环境的 `PYPI_API_TOKEN`）。这是
  Python 包名，不是腾讯云安全公告地址。
- **飞牛 Docker `.fpk`** 的 compose 必须拉 `ghcr.io/xyaistudio/freeos`，不是
  `ghcr.io/tencentcloud/octop`。
