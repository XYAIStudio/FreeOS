# FreeOS 官网

正式地址：[https://freeos.cnxy.tech](https://freeos.cnxy.tech)

本目录是 [FreeOS](https://github.com/XYAIStudio/FreeOS) 的营销站点源码：Vite + React + TypeScript，`npm run build` 产出可直接当网站根目录的静态文件。

品牌：天蓝 → 亮光渐变、毛玻璃卡片、XYAI 蓝 `#0033FF` 点缀、圆形勾玉标志、XYAI 机器人六姿态。章节节奏对齐 [XYAI Labs](https://cnxy.ai/)（编号、中文大标题、底座 / 系统 / 生态），文案是 FreeOS 自己的产品故事（中文口号「自由的 AI 工作室」，英文 *Your FreeOS, free for you.*）。视觉不使用 Octop 红字标或章鱼形象。

## 本地预览

需要 Node.js 20+。

```bash
cd website
npm install
npm run dev
```

浏览器打开终端打印的本地地址（默认 `http://127.0.0.1:5173`）。点 Hero 里的机器人可轮换姿态。中 / EN 写在 `localStorage` 的 `freeos-locale`。

```bash
npm run build     # 产出 website/dist/，根上就是 index.html
npm run preview   # 预览生产构建
```

## 构建产物

`npm run build` 写入 **`website/dist/`**，结构类似：

```
website/dist/
  index.html
  favicon.png
  logo.png
  og.png
  robots.txt
  mascot/*.webp
  assets/index-*.js
  assets/index-*.css
```

`vite.config.ts` 使用相对 `base: './'`，把 `dist/` **里面的文件**拷到站点根即可，不要多套一层 `dist` 目录。

本仓库根与 `website/` 都忽略 `dist/`，构建产物默认不提交。

## 上传到用户服务器（宝塔 / aaPanel）

父进程会把静态构建上传到已解析的域名根目录。

| 项 | 值 |
|---|---|
| 公网地址 | `https://freeos.cnxy.tech` |
| 服务器网站根 | `/www/wwwroot/freeos.cnxy.tech` |
| 上传内容 | `website/dist/` **内的全部文件**（含 `index.html`、`assets/`、`mascot/`、图片） |
| 结果 | `/www/wwwroot/freeos.cnxy.tech/index.html` 可被 Nginx/Apache 直接返回 |

操作顺序（在有 Node 的机器上构建，再到面板上传；**不要把 SSH 密码或主机凭据写进仓库**）：

1. `cd website && npm ci && npm run build`
2. 在宝塔「网站 → freeos.cnxy.tech → 根目录」确认为 `/www/wwwroot/freeos.cnxy.tech`
3. 清空该目录里旧的站点文件（保留面板自己的配置，不要删服务器系统目录）
4. 将 `website/dist/` 下所有文件上传到 `/www/wwwroot/freeos.cnxy.tech/`
5. 浏览器打开 https://freeos.cnxy.tech 应看到首页，而不是目录列表

静态站点即可，不必配 Node 反代。若面板默认目录索引，把默认文档设为 `index.html`。

## GitHub Pages（可选，不是主发布路径）

主站是 `freeos.cnxy.tech`。若仍要 Pages，把同一份 `dist/` 交给 Actions 或 `gh-pages` 即可。

## 资源从哪来

| 文件 | 来源 |
|---|---|
| `public/logo.png`、`favicon.png`、`og.png` | 仓库圆形标志（灰环 / 黄绿红勾玉 / 蓝水滴） |
| `public/mascot/*.webp` | `dashboard/public/xyai-mascot-*.webp` 的副本 |

## 内容边界

- 产品事实以 [docs/product-contract.zh-CN.md](../docs/product-contract.zh-CN.md) 为准；架构细节见 `docs/architecture-integration.md`、`docs/asset-loop.md`。
- Windows 安装包指向 [最新 GitHub Release](https://github.com/XYAIStudio/FreeOS/releases/latest)（当前 Latest 为 v0.0.3）。
- 页脚按 `NOTICE` 致谢 Octop（MIT）与 openXYOS（Apache-2.0）；FreeOS 是独立维护的下游，沿用上游许可。
- 视觉节奏参考 XYAI Labs 公开站的章节编号与玻璃质感，文案仍是 FreeOS 产品自己的话。
