# openXYOS Operation Guide

This guide describes the local community-release interface. Available functions can vary by tenant module configuration and user permission. Follow the live UI labels, permission messages, and validation errors if they differ from this guide.

## 1. Home page and local startup

Open `http://localhost:5174` to view the project overview, capabilities, Agent Studio demonstration, module list, and source entry points.

1. Select **Try online**.
2. To test model-enabled capabilities, choose a provider, enter your own API key, and select **Save and enter**. The key is not displayed again. To continue without a key, select **Explore basic features**.
3. Select an administrator or standard-user demo perspective, or continue to **Sign in with another account**.

If the API is unavailable, run `npm run dev` from the repository root. Before using any model, confirm the provider, network path, and key permissions. Never paste keys into issues, screenshots, or source files.

## 2. Sign-in, sign-out, and permissions

At `/auth`, enter an email address and password, accept the agreements, and select **Sign in**. Demo accounts exist only when demo seed data has been intentionally enabled. After sign-in, the sidebar shows only modules enabled for the tenant and available to the current user. Use **Sign out** in the header or sidebar to clear the local session.

Administrators can manage modules, models, and users; seeing a module does not grant an ordinary user administrative permission. If **Module configuration failed to load** appears after sign-in, select **Reload**. If it persists, check the API health endpoint, whether `JWT_SECRET` changed after a server restart, and whether the browser retained an old session.

## 3. Workspace

Route: `/app`. Workspace shows organization, task, conversation, and knowledge statistics, plus shortcuts to enabled modules. Select a card or a sidebar item to open a module. Workspace is a foundation entry and cannot be disabled.

## 4. Announcements

Route: `/announcements`. Browse announcements, open an item to read it, and review read status. Users with publishing permission can create, edit, or publish announcements. Confirm recipients and remove personal data, client material, and credentials before publishing. This is an editable example module.

## 5. Organization

Route: `/org`. Inspect group, company, department, role, and reporting relationships. Administrators can add or update nodes through the available UI actions; confirm the tenant and parent relationship before saving. Standard users see only their permitted organizational information.

## 6. Human & Agent Resources

Route: `/employees`. Browse human employees, AI employees, reserve employees, and the Talent Market. Administrators can inspect details, recruit an agent from the Talent Market, complete responsibilities, and assign a department. Use only demonstration data or data you are authorized to process.

## 7. Skills & Plugins

Route: `/skills`. Browse the skill catalog, plugin records, and capability assembly. Before enabling or adding a plugin, review its source, license, required credentials, network permissions, and data path. Installation alone is not production authorization.

## 8. Collaboration

Route: `/chat`. Create or select a direct or group conversation, send messages, and review independent suggestions from people and agents. Configure your own model key in Settings before using model features. Obtain the required human confirmation outside the system for external sending, deletion, payments, or production changes.

## 9. Agent Studio

Route: `/agents`. Provide a name, positioning, capabilities, and domain experience; upload supported reference material; and optionally link a knowledge-base address. Confirm that materials are authorized and do not contain credentials, client secrets, or unpublished technical material. A generated consultant agent enters the Talent Market. An administrator can recruit it into the reserve workforce and complete department and role details.

## 10. Tasks

Route: `/tasks`. Create a task with title, description, owner, due date, and optional subtasks. Update its status during execution and record acceptance. Tasks and status transitions are editable examples; teams can extend fields, rules, and notifications for their own workflow.

## 11. Knowledge

Route: `/knowledge`. Upload supported material, wait for security checks and text extraction, then browse, search, or link the content. Confirm copyright, privacy, and client authorization first. For a failed upload, inspect the file type, size, scan result, and backend logs. Do not upload production databases, credentials, private keys, or confidential patent materials.

## 12. Reflection

Route: `/reflections`. Select collaboration or task records, capture lessons, improvement actions, and reusable experience. Reflection output is organizational learning material and should be reviewed by a responsible person before it becomes a policy or knowledge source.

## 13. Governance

Route: `/governance`; it is normally available only to administrators. Review general permissions, communication rules, process templates, and audit events, then update configuration only within the available permission controls. Governance in the public edition is a general feature and does not represent an unpublished method or automated decision mechanism.

## 14. Settings

Route: `/settings`; administrator access is required.

- **Company settings**: maintain basic information for the current tenant.
- **Module management**: enable or disable configurable modules and change display labels. Workspace and Settings cannot be disabled.
- **AI models**: choose a provider and store the current tenant's own API key. After saving, check masked display and live connectivity.
- **User management**: manage users and roles within the authorized scope.

Saved settings affect the tenant experience. Test module disablement, model changes, and permission changes against non-production data and retain a change record.

## Troubleshooting

- **Cannot sign in**: verify that `http://localhost:3000/api` is reachable, demo data was initialized as documented, or use a valid local account.
- **Blank page or old styles**: force-refresh the browser and confirm the frontend process launched by `npm run dev` is running.
- **Model features unavailable**: verify a valid API key, reachable provider endpoint, and model entitlement. Core organization features remain available without a model key.
- **Contributing**: read the [contribution guide](../../CONTRIBUTING.md), [security policy](../../SECURITY.md), and [module development guide](../module-development.md).
