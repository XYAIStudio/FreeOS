# openXYOS open-source scope

## Included

- React/Vite community client and the 12-module signed-in runtime
- Node.js/Express APIs, WebSocket collaboration, migrations, and development database adapter
- Multi-tenant organization and human/agent resource management
- Agent Studio, reference extraction, Talent Market, reserve-employee onboarding, chat, knowledge, reflection, and governance
- Tenant module switches, editable display names, and secondary-development examples
- Security, access-control, module, agent-lifecycle, audit, and tool-gateway tests
- Community development/container references and public architecture documentation

## Excluded from a public release

- Runtime databases, backups, uploads, logs, build output, dependency directories, and deployment bundles
- Production hosts, credentials, certificates, model keys, monitoring data, and customer information
- Patent, software-copyright, customer-delivery, and other internal application materials
- Proprietary hosted connectors. Saving an ima URL does not claim live connectivity; it remains `linked_unverified` until a connector validates it.
- Human-machine technology method materials and other patent-claim-critical implementations: source code, routes, state/data models, tests, seeds, demonstrations, historical specifications and any reproducible supporting material are excluded. They may not be released merely by renaming or partial redaction; see the [human-machine public boundary](governance/HUMAN_MACHINE_SOURCE_BOUNDARY.md).
- Registered-brand source files and unapproved use of the registered circular Logo outside the documented official product assets.

## Release boundary

A successful frontend build does not establish production readiness. Production claims require reproducible installation, backend startup, migrations, authentication, tenant isolation, upload security, backup/restore, restart recovery, capacity validation, and external HTTPS checks.

The public edition must not rely on unpublished packages for documented core workflows, and must not present disabled controls or fixed mock responses as delivered capability.

Every public release must pass the [release gate](governance/OPEN_SOURCE_RELEASE_GATE.md). Complete IP records, application numbers, certificates, contracts and customer evidence remain in a private register; only the public policy and release evidence intended for publication belong in this repository.
