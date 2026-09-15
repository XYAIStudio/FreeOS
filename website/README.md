# FreeOS 官网

本目录是 [FreeOS](https://github.com/XYAIStudio/FreeOS) 的官方营销站点源码：Vite + React + TypeScript，静态导出。

品牌：XYAI 蓝 `#0033FF`、圆形勾玉标志、XYAI 机器人六姿态。站点不使用 Octop 红字标或章鱼形象。

## 本地预览

需要 Node.js 20+。

```bash
cd website
npm install
npm run dev
```

浏览器打开终端打印的本地地址（默认 `http://127.0.0.1:5173`）。点 Hero 里的机器人可轮换姿态。

```bash
npm run build    # 产出 website/dist
npm run preview  # 预览生产构建
```

中 / EN 切换写在 `localStorage` 的 `freeos-locale`。

## 资源从哪来

| 文件 | 来源 |
|---|---|
| `public/logo.png`、`favicon.png`、`og.png` | 仓库圆形标志（灰环 / 黄绿红勾玉 / 蓝水滴） |
| `public/mascot/*.webp` | `dashboard/public/xyai-mascot-*.webp` 的副本 |

更新机器人素材后，把 dashboard 里的六张 webp 再拷进 `public/mascot/`。

## 发布到 GitHub Pages

`vite.config.ts` 使用相对 `base: './'`，所以 `dist/` 可以挂在域名根路径，也可以挂在项目页路径（如 `https://xyaistudio.github.io/FreeOS/`）。

### 方式 A：GitHub Actions（推荐）

1. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。
2. 增加一个工作流（示例）：checkout → `cd website && npm ci && npm run build` → 用 `actions/upload-pages-artifact` 上传 `website/dist` → `actions/deploy-pages`。
3. 不必配置自定义域名。Pages 默认地址形如 `https://<user>.github.io/<repo>/`。

示例工作流片段：

```yaml
# .github/workflows/website-pages.yml
name: Website
on:
  push:
    branches: [main]
    paths: [website/**]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: website/package-lock.json
      - run: npm ci && npm run build
        working-directory: website
      - uses: actions/upload-pages-artifact@v3
        with:
          path: website/dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - id: deploy
        uses: actions/deploy-pages@v4
```

### 方式 B：把 `dist` 当作 Pages 产物

本地 `npm run build` 后，把 `website/dist` 的内容推到 `gh-pages` 分支，或拷到仓库里 Pages 指定的目录。不要把未构建的 `src/` 直接当作站点根。

本仓库根目录的 `dist/` 已被 gitignore；官网构建产物默认不提交。

## 内容边界

- 产品事实以仓库 `README.md`、`docs/architecture-integration.md`、`docs/asset-loop.md` 为准。
- Windows 安装包指向 [v0.0.1 Release](https://github.com/XYAIStudio/FreeOS/releases/tag/v0.0.1)。
- 页脚按 `NOTICE` 致谢 Octop（MIT）与 openXYOS（Apache-2.0），不主张上游商标从属。
