# openXYOS 简体中文简介与安装指南

openXYOS 是面向人机组织的开源操作系统。它提供多层级组织、多租户、可配置模块、人机交互、智能体定制、任务与知识管理等通用能力，供开发者本地评估、二次开发和社区协作。

## 系统范围

登录后可使用工作台、通知公告、组织架构、人机资源、技能插件、沟通协作、智能体定制、任务管理、知识库、反思引擎、治理引擎和系统设置。管理员可以在“系统设置 → 模块管理”启停可配置模块并修改显示名称；工作台和系统设置始终保留。

## 本地安装

前提：Node.js 20.19 或更高版本。

```bash
git clone <your-fork-or-repository-url>
cd openXYOS
npm ci
cp .env.example .env
npm run dev
```

Windows PowerShell 请使用 `Copy-Item .env.example .env`。启动前应在 `.env` 中设置足够强度的 `JWT_SECRET` 与 `COOKIE_SECRET`，不要提交该文件。浏览器访问 `http://localhost:5174`；API 默认在 `http://localhost:3000/api`。

## 演示与验证

演示数据只适用于本地评估。设置 `SEED_DEMO_DATA=true` 并提供自定义演示密码后再执行种子数据命令；公开仓库不承诺内置管理员凭据。提交前执行：

```bash
npm run lint
npm run typecheck
npm test
npm run verify:open-source
npm run build
```

请继续阅读[中文操作指南](../guides/operation-guide.zh-CN.md)、[安全政策](../../SECURITY.md)和[贡献指南](../../CONTRIBUTING.md)。
