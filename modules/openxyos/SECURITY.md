# Security policy

## Supported versions

Security fixes are provided for the latest tagged release. Pre-release branches and untagged snapshots receive fixes on a best-effort basis.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public Issue, Discussion, or pull request. Use GitHub Private Vulnerability Reporting for this repository. Include the affected version, impact, reproduction steps, and any suggested mitigation. Do not include real customer data or credentials.

The maintainers will acknowledge a complete report as soon as practical, coordinate validation and remediation, and credit reporters who request attribution after a fix is available.

## Operator responsibilities

- Replace all example secrets and rotate any credential that may have appeared in an earlier private snapshot.
- Keep demo seeding disabled in production.
- Terminate TLS at a reviewed reverse proxy and configure an explicit CORS allowlist.
- Use a production-grade database and tested backup/restore process for production workloads.
- Enable GitHub secret scanning, push protection, dependency alerts, and protected branches.

