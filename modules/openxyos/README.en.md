# openXYOS

**Languages:** [简体中文](README.md) · [English](README.en.md) · [Installation guide index](docs/i18n/README.md) · [Localization policy](docs/i18n/POLICY.md)

Source repository: [github.com/XYAIStudio/openXYOS](https://github.com/XYAIStudio/openXYOS)

openXYOS is a streamlined open-source human-agent organization operating system derived from XYOS. It keeps multi-level enterprise structures, multi-tenancy, modular applications, governed human-agent collaboration, agent customization, direct/group chat, and editable example modules.

> Status: community release candidate for local development and evaluation. It is not represented as production-ready.

## Runtime scope

The signed-in product exposes twelve modules: Workspace, Announcements, Organization, Human & Agent Resources, Skills & Plugins, Collaboration, Agent Studio, Tasks, Knowledge, Reflection, Governance, and Settings.

Tenant administrators can enable or disable configurable modules and rename their labels. Workspace and Settings remain foundation modules. Example modules retain complete frontend/API/data paths for secondary development.

## Agent lifecycle

A user defines an agent's name, positioning, capabilities, and experience; uploads supported reference documents; and may link an ima knowledge-base URL. Files are security checked and text-extracted into the agent blueprint and runtime description.

The generated consultant agent enters the Talent Market automatically. After recruitment it becomes a reserve employee, where an administrator can assign responsibilities and a department. High-risk outputs require human review. An ima URL is linked but unverified until a live connector validates it.

## Quick start

Node.js 20.19 or later is required.

```bash
npm ci
cp .env.example .env
npm run dev
```

Replace secret placeholders before startup. The client runs at `http://localhost:5174`; the API runs at `http://localhost:3000/api`.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run verify:open-source
npm run build
```

See the [language index](docs/i18n/README.md), [English operation guide](docs/guides/operation-guide.en.md), [module development](docs/module-development.md), [open-source scope](docs/open-source-scope.md), [security policy](SECURITY.md), and [contribution guide](CONTRIBUTING.md). The source is licensed under [Apache License 2.0](LICENSE).
