# Scripts

在**仓库根目录**运行以下命令。

## 安装 Octop（终端用户）

新安装使用 `~/.freeos/venv` 与 `~/.freeos/bin/octop`。还没有 `~/.freeos`、但已经有 `~/.octop` 时，继续用旧目录。

**不要**使用腾讯云 COS 上的 `…/octop/install.*`。那是上游 Octop，默认安装 PyPI `octop`，不是 FreeOS。

桌面用户优先下载 GitHub Releases 的 `FreeOS-desktop-*`。

### 远程脚本（develop；打 tag 后由 Release 说明固定标签）

| 平台 | 命令 |
|------|------|
| macOS / Linux | `curl -fsSL https://raw.githubusercontent.com/XYAIStudio/FreeOS/codex/freeos-0.1.0-upstream-foundation/scripts/install.sh \| bash` |
| Windows (PowerShell) | `irm https://raw.githubusercontent.com/XYAIStudio/FreeOS/codex/freeos-0.1.0-upstream-foundation/scripts/install.ps1 \| iex` |
| Windows (cmd) | 下载 `https://raw.githubusercontent.com/XYAIStudio/FreeOS/codex/freeos-0.1.0-upstream-foundation/scripts/install.bat` 后运行 |

### 本地脚本（仓库内）

| 平台 | 命令 |
|------|------|
| macOS / Linux | `bash scripts/install.sh` |
| Windows (PowerShell) | `powershell -ExecutionPolicy Bypass -File scripts/install.ps1` |
| Windows (cmd) | `scripts\install.bat` |

### 常用选项

```bash
# 从 FreeOS GitHub 源码安装最新版（默认）
bash scripts/install.sh

# 从 FreeOS GitHub v0.1.0rc1 标签安装
bash scripts/install.sh --version 0.1.0rc1

# 显式安装 PyPI 上游 Octop（不包含 FreeOS 下游修改）
bash scripts/install.sh --from-pypi

# 安装可选附加组件
bash scripts/install.sh --extras browser
bash scripts/install.sh --extras browser,channels-feishu

# 从本地源码安装（开发/离线）
bash scripts/install.sh --from-source
bash scripts/install.sh --from-source /path/to/orca

# 使用国内 PyPI 镜像加速 Python 依赖下载
bash scripts/install.sh --mirror https://mirrors.cloud.tencent.com/pypi/simple
```

Windows PowerShell 等价参数：`-Version`、`-FromSource`、`-FromPyPI`、`-SourceDir`、`-Extras`。

### 环境变量

| 变量 | 说明 |
|------|------|
| `FREEOS_HOME` | 安装根目录（优先） |
| `OCTOP_HOME` | 旧安装根目录覆盖。未设置时：已有 `~/.freeos`，否则已有 `~/.octop`，否则新建 `~/.freeos` |
| `OCTOP_REPO` | `--from-source` 无本地目录时的 git 克隆地址 |
| `OCTOP_PYPI_MIRROR` | PyPI 镜像（与 `--mirror` 等效） |
| `PLAYWRIGHT_DOWNLOAD_HOST` | Playwright 浏览器下载镜像（仅 `--extras browser`） |

默认不下载 Playwright Chromium。需要远程浏览器自动化时加 `--extras browser`，或安装后在控制台 / `python -m playwright install chromium` 按需安装。若系统已有 Chrome / Chromium，即使加了 `--extras browser` 也会跳过下载。

安装完成后：

```bash
octop init    # 初始化数据库与管理员
octop run     # 启动服务 → http://127.0.0.1:8088
```

---

## 构建 Python wheel（随 GitHub Release 分发）

先构建前端（产物写入 `src/octop/dashboard/`，与 `dashboard/vite.config.ts` 的 `outDir` 一致），再打包 wheel。

```bash
bash scripts/wheel_build.sh
```

Windows:

```powershell
powershell -File scripts/wheel_build.ps1
```

输出：`dist/*.whl`、`dist/*.tar.gz`

Release workflow 将构建出的 wheel 和源码包附加到 GitHub Release。`octop` 是内部兼容用的发行包名，不要把 FreeOS 制品发布到 PyPI；安装脚本默认从 FreeOS GitHub 仓库安装。

---

## 平台说明

- **macOS / Linux**：`install.sh` 支持自动安装 uv、创建 venv；Playwright Chromium 仅在 `--extras browser` 时下载（系统已有 Chrome 则跳过）。
- **Windows**：使用 `install.ps1` 或 `install.bat`；PTY 终端、飞书 bot creator 等非阻塞 stdout 等功能在 Windows 上受限（见下方兼容性分析）。

完整跨平台兼容性分析见项目文档或 PR 说明。
