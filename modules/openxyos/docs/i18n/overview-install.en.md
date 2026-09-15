# openXYOS Overview and Installation Guide

openXYOS is an open-source operating system for human-agent organizations. It provides general-purpose capabilities for multi-level organizations, multi-tenancy, configurable modules, human-agent interaction, agent customization, task management, and knowledge management. It is intended for local evaluation, extension, and community collaboration.

## Product scope

After sign-in, the product provides Workspace, Announcements, Organization, Human & Agent Resources, Skills & Plugins, Collaboration, Agent Studio, Tasks, Knowledge, Reflection, Governance, and Settings. Administrators can enable or disable configurable modules and change their display labels in **Settings → Module Management**. Workspace and Settings remain available as foundation entries.

## Local installation

Prerequisite: Node.js 20.19 or later.

```bash
git clone <your-fork-or-repository-url>
cd openXYOS
npm ci
cp .env.example .env
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env`. Before starting, set strong values for `JWT_SECRET` and `COOKIE_SECRET` in `.env`; never commit that file. Open `http://localhost:5174` in a browser. The API is available at `http://localhost:3000/api` by default.

## Demo data and verification

Demo data is for local evaluation only. Enable `SEED_DEMO_DATA=true`, set a custom demo password, then run the seed command. The public repository does not promise built-in administrator credentials.

```bash
npm run lint
npm run typecheck
npm test
npm run verify:open-source
npm run build
```

Read the complete [English operation guide](../guides/operation-guide.en.md), [security policy](../../SECURITY.md), and [contribution guide](../../CONTRIBUTING.md).
