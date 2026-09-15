# Contributing to XYOS

Thank you for helping improve XYOS.

## Before opening a change

1. Search existing issues and discussions.
2. Open an issue before large API, data-model, security, or product-scope changes.
3. Keep a pull request focused on one independently reviewable outcome.
4. Never include customer data, credentials, production addresses, generated databases, uploads, or build artifacts.

## Development workflow

```bash
npm ci
cp .env.example .env
npm run dev
```

Before submitting a pull request, run:

```bash
npm run lint
npm run typecheck
npm test
npm run verify:open-source
npm run build
```

Add or update tests for changed behavior. Document configuration changes in `.env.example` and README files. Security-sensitive changes must include negative tests for unauthorized, cross-tenant, and malformed requests.

## Commit and pull-request expectations

- Use a clear, imperative commit subject.
- Explain the user-visible effect, security impact, migration needs, and verification performed.
- Preserve backward compatibility unless the issue explicitly approves a breaking change.
- Do not commit generated dependency directories or runtime data.
- Add a `Signed-off-by: Your Name <email>` line to every commit (`git commit --signoff`).
- Before a pull request can be merged, its contributor must have completed the project ICLA or an applicable CCLA and received the `cla-signed` label from a maintainer. The agreement is published only after legal review; until then, external contributions are discussed but not merged.

Unless a separately executed contributor agreement states otherwise, contributions intentionally submitted to this repository are provided under the Apache License 2.0. Brand rights are governed separately by [TRADEMARKS.md](TRADEMARKS.md).
