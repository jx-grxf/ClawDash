<div align="center">

# 🦞 ClawDash

**Operator-focused local dashboard for OpenClaw**

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![CI](https://img.shields.io/github/actions/workflow/status/jx-grxf/ClawDash/ci.yml?branch=main&label=CI)
![OpenClaw](https://img.shields.io/badge/OpenClaw-local%20ops-0F766E)
![Pixel Office](https://img.shields.io/badge/Pixel%20Office-live%20view-D97706)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

ClawDash is a local, self-hosted dashboard for OpenClaw. It gives you a fast operational view of agents, sessions, models, cron activity, gateway health, stats, CLI actions, and the Pixel Office, without turning the dashboard itself into another bot runtime.

It is built for personal, self-hosted, and trusted operator setups, not as a hosted multi-tenant control plane.

---

## Contents

- [Highlights](#-highlights)
- [Scope](#-scope)
- [Tech Stack](#-tech-stack)
- [Requirements](#-requirements)
- [Quick Start](#-quick-start)
- [Features](#-features)
- [Configuration](#-configuration)
- [Settings](#-settings)
- [Security](#-security)
- [Architecture](#-architecture)
- [API Classification](#-api-classification)
- [Roadmap Notes](#-roadmap-notes)
- [License](#-license)

---

## Highlights

| | Feature |
|---|---|
| Dashboard | Agent overview with a clear "Needs Attention" summary |
| Operator View | Gateway, cron jobs, usage, and status at a glance |
| Sessions | Agent picker, transport facets, age filters, and message previews |
| Stats | Token trends, response-time charts, per-agent and per-model breakdowns |
| Pixel Office | Large animated office view with lounge, desks, gateway area, and live agents |
| CLI | OpenClaw command console inside the dashboard |
| Settings | Built-in runtime settings panel for live feature toggles and refresh intervals |
| Safety | Privacy mode, access protection, and read-only defaults |

---

## Scope

- **Self-hosted only**
- **Local OpenClaw-first**: reads local config, session indexes, JSONL logs, and local job stores
- **Operator-oriented**: focuses on visibility, diagnostics, and explicit actions
- **Not a hosted SaaS product**
- **Not an OpenClaw replacement**

By default, ClawDash prefers safe and conservative behavior:

- layout writes are disabled
- external fetches are disabled
- active model tests are disabled
- active gateway checks are disabled

---

## Tech Stack

| Layer | Technologies |
|---|---|
| App | Next.js 16, React 19, TypeScript |
| UI | App Router, dark dashboard layout, custom Pixel Office integration |
| Data | Local OpenClaw files, JSON, JSONL session logs |
| Runtime actions | `openclaw` CLI for gateway/model checks and command console |
| Persistence | Local file-based ClawDash settings in `~/.openclaw/clawdash/settings.json` |

---

## Requirements

- **Node.js** `20+` recommended
- **npm**
- **OpenClaw** installed locally and available in your environment
- A local OpenClaw home directory, typically `~/.openclaw`

ClawDash expects local OpenClaw state such as:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/agents/*/sessions/sessions.json`
- `~/.openclaw/agents/*/sessions/*.jsonl`
- `~/.openclaw/agents/main/agent/models.json`
- local cron store files when present

---

## Quick Start

```bash
git clone https://github.com/jx-grxf/ClawDash.git
cd ClawDash
npm install
npm run dev
```

Then open:

- [http://localhost:3000](http://localhost:3000)

If port `3000` is busy, Next.js will automatically move to the next free port.

---

## Features

### Dashboard

- Overview cards for agents, models, tokens, and messages
- "Needs Attention" section for idle/offline/problematic agents
- quick links into operator, stats, sessions, and office views

### Operator View

- live gateway card
- cron summary
- quick operational overview for triage

### Sessions

- agent selection in the left sidebar
- transport filters (`main`, `direct`, `group`, `channel`, `cron`, `subagent`, `acp`)
- activity filters
- last user/assistant message preview

### Stats

- token trend chart
- response trend chart
- rolling 7-day summaries
- per-agent and per-model usage breakdowns

### Pixel Office

- imported and extended Pixel Office experience
- visible live agents, including offline/idle handling
- lounge behavior for idle agents
- gateway/server area and large office layout

### CLI Console

- structured OpenClaw command runner
- metadata-aware command builder
- quick actions
- run history and favorites

### Settings

- built-in settings page at `/settings`
- feature toggles for live dashboard behavior
- editable refresh intervals for gateway and Pixel Office polling

---

## Configuration

ClawDash works with runtime settings stored locally plus optional environment variables.

### Optional environment variables

| Variable | Purpose |
|---|---|
| `OPENCLAW_HOME` | Override the default OpenClaw home directory |
| `CLAWDASH_ACCESS_TOKEN` | Require a token for dashboard/API access |
| `CLAWDASH_BASIC_AUTH_USER` | Optional basic-auth username |
| `CLAWDASH_BASIC_AUTH_PASSWORD` | Optional basic-auth password |
| `CLAWDASH_ENABLE_PRIVACY_MODE` | Mask sensitive ids/tokens in dashboard responses |
| `CLAWDASH_LOCAL_ONLY` | Restrict access to loopback/local requests |

### Runtime settings file

ClawDash stores local runtime settings here:

```bash
~/.openclaw/clawdash/settings.json
```

That file is managed by the dashboard settings page and includes:

- feature toggles for active checks and write actions
- gateway refresh interval
- Pixel Office agent refresh interval
- Pixel Office stats refresh interval

---

## Settings

The `/settings` page lets you toggle and persist:

- `Enable layout editing`
- `Enable external fetches`
- `Enable active model tests`
- `Enable active gateway checks`
- `Gateway refresh interval`
- `Pixel Office agent refresh interval`
- `Pixel Office stats refresh interval`

These are intended for local operator workflows, so they are stored on disk instead of requiring repeated code edits.

---

## Security

ClawDash is designed for trusted local environments.

- Do **not** expose it directly to the public internet without additional protection.
- Use `CLAWDASH_ACCESS_TOKEN` or basic auth if you need remote access.
- Use privacy mode when sensitive ids or tokens must be redacted.
- Keep write actions disabled unless you explicitly need them.

For reporting vulnerabilities or deployment guidance, see [SECURITY.md](SECURITY.md).

---

## Architecture

```text
OpenClaw files + local CLI
        |
        v
Next.js app routes and local data readers
        |
        v
ClawDash pages
  - Dashboard
  - Operator
  - Sessions
  - Stats
  - Pixel Office
  - CLI
  - Settings
```

In practice, ClawDash combines:

1. local file reads from OpenClaw state
2. targeted `openclaw` CLI calls for active checks
3. internal API routes for normalized UI data
4. a Next.js frontend for monitoring and local control

---

## API Classification

### Read-only

- `/api/config`
- `/api/sessions/[agentId]`
- `/api/stats-all`
- `/api/stats/[agentId]`
- `/api/activity-heatmap`
- `/api/agent-activity`
- `/api/cron-jobs`
- `/api/pixel-office/idle-rank`
- `/api/pixel-office/tracks`
- `/api/pixel-office/version`
- `/api/pixel-office/contributions`
- `/api/settings` `GET`

### Active checks

- `/api/gateway-health`
- `/api/model-tests`

### Local write

- `/api/pixel-office/layout`
- `/api/settings` `PUT`

---

## Roadmap Notes

Current project state already includes:

- dark operator-style UI
- imported Pixel Office with OpenClaw-focused behavior
- OpenClaw CLI command console
- runtime settings panel
- local safety defaults

Likely next steps:

- richer office generation and layout tools
- more per-command CLI forms
- better release/version telemetry
- more operator diagnostics

---

## License

This project is licensed under the [MIT License](LICENSE).
