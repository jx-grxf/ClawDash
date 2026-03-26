# ClawDash

ClawDash is a local dashboard for OpenClaw.

It is built for operators who want a fast overview of agents, sessions, models, gateway health, cron activity, usage stats, and the Pixel Office view, without turning the dashboard itself into another bot runner.

## Features

- Dashboard with agent overview and "Needs Attention" summary
- Operator view for gateway, cron jobs, and quick health checks
- Live gateway checks via `openclaw gateway status`
- Live model probes via `openclaw models status --probe`
- Session explorer with agent selection, transport facets, and message previews
- Usage stats with token trends, response times, per-agent breakdown, and per-model breakdown
- Large Pixel Office view with imported office engine and assets
- Optional privacy mode and optional local/auth access protection

## Stack

- Next.js 16
- TypeScript
- App Router
- Local file-based reads from the OpenClaw home directory

## Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Data Sources

ClawDash reads local OpenClaw state directly from files such as:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/agents/*/sessions/sessions.json`
- `~/.openclaw/agents/*/sessions/*.jsonl`
- `~/.openclaw/agents/main/agent/models.json`
- local cron job store files when available

There is no project database and no required external sync.

## Safety and Scope

ClawDash is intended as a local OpenClaw dashboard for visibility, analysis, and explicit checks.

It is not meant to be an OpenClaw replacement, a bot runtime, or an unrestricted remote control panel.

By default:

- local write actions are disabled
- external fetches are disabled
- active model probes are disabled
- privacy mode is disabled
- local-only access restrictions are disabled unless explicitly enabled

## Feature Flags

- `CLAWDASH_ENABLE_LAYOUT_WRITE=false`
- `CLAWDASH_ENABLE_EXTERNAL_FETCHES=false`
- `CLAWDASH_ENABLE_ACTIVE_MODEL_TESTS=false`
- `CLAWDASH_ENABLE_ACTIVE_CHECKS=false`
- `CLAWDASH_ENABLE_PRIVACY_MODE=false`
- `CLAWDASH_LOCAL_ONLY=false`

`NEXT_PUBLIC_...` variants are also accepted when a flag needs to be visible on the client side.

## Access Protection

Optional dashboard protection is available through:

- `CLAWDASH_ACCESS_TOKEN=...`
- `CLAWDASH_BASIC_AUTH_USER=...`
- `CLAWDASH_BASIC_AUTH_PASSWORD=...`

If privacy mode is enabled, session keys, user/channel identifiers, and gateway tokens are redacted in API responses and UI data flows.

## API Classification

Read-only:

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

Active checks:

- `/api/gateway-health`
- `/api/model-tests`

Local write:

- `/api/pixel-office/layout`

## Notes

- Do not expose ClawDash to the public internet without proper access controls.
- Pixel Office assets and engine code were integrated from an existing OpenClaw dashboard reference and adapted for this project.
- Next.js currently warns that `middleware.ts` should eventually move to the newer `proxy` convention.

## Status

Current project status includes:

- dark sidebar layout inspired by the reference dashboard
- imported Pixel Office experience
- operator-focused monitoring pages
- safer defaults for local usage
- build passing
- lint passing with warnings only in imported Pixel Office base modules
