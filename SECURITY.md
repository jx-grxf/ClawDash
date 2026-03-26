# Security Policy

## Scope

ClawDash is intended for self-hosted OpenClaw dashboards in trusted environments.

Because it can read local OpenClaw state and optionally trigger active checks or local writes, you should treat it like an operator tool, not a public web app.

## Supported Versions

At the moment, security fixes are expected on the latest `main` branch and the latest tagged release.

## Reporting a Vulnerability

If you find a security issue, please do **not** open a public issue with full exploit details.

Instead:

1. Contact the maintainer privately first.
2. Include reproduction steps, impact, and affected configuration.
3. Wait for confirmation before disclosing details publicly.

If private contact is not available, open a minimal GitHub issue without sensitive details and explicitly mention that the report is security-related.

## Deployment Guidance

- Prefer local-only access whenever possible.
- Use `CLAWDASH_ACCESS_TOKEN` or basic auth for remote access.
- Enable privacy mode when handling sensitive ids or tokens.
- Keep layout writes, active checks, and external fetches disabled unless you need them.
- Do not expose ClawDash directly to the public internet without an additional trusted reverse proxy and authentication layer.
