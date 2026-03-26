# ClawDash

Ein eigenes lokales Dashboard fuer OpenClaw.

## Start

```bash
npm install
npm run dev
```

Dann im Browser `http://localhost:3000` oeffnen.

## Aktueller Stand

- Dashboard mit Agent-Overview
- Operator View fuer Gateway, Cron und Uebersicht
- Live Gateway Checks ueber `openclaw gateway status`
- Live Modelltests ueber `openclaw models status --probe`
- Sessions mit Agent-Auswahl, Typ-Facets und Message-Vorschau
- Stats fuer Token, Antwortzeiten, Agenten- und Modell-Breakdown
- Grosses Pixel Office mit mehreren Raeumen

## Sicherheit und Scope

ClawDash ist ein lokales OpenClaw-Dashboard fuer Anzeige, Analyse und gezielte Checks. Es ist nicht als eigener Bot-Runner gedacht. Standardmaessig sind schreibende Aktionen und externe Fetches deaktiviert.

Feature-Flags:

- `CLAWDASH_ENABLE_LAYOUT_WRITE=false`
- `CLAWDASH_ENABLE_EXTERNAL_FETCHES=false`
- `CLAWDASH_ENABLE_ACTIVE_MODEL_TESTS=false`
- `CLAWDASH_LOCAL_ONLY=false`
- `CLAWDASH_ENABLE_PRIVACY_MODE=false`
- `CLAWDASH_ENABLE_PRIVACY_MODE=false`
- `CLAWDASH_LOCAL_ONLY=false`

Die Flags werden auch als `NEXT_PUBLIC_...`-Variante akzeptiert, falls die Client-Seite sie mitlesen soll.

Access-Schutz:

- `CLAWDASH_ACCESS_TOKEN=...`
- `CLAWDASH_BASIC_AUTH_USER=...`
- `CLAWDASH_BASIC_AUTH_PASSWORD=...`
- `CLAWDASH_REQUIRE_AUTH=false`

API-Klassifikation:

- `read-only`: `/api/config`, `/api/sessions/[agentId]`, `/api/stats-all`, `/api/stats/[agentId]`, `/api/activity-heatmap`, `/api/pixel-office/idle-rank`, `/api/pixel-office/tracks`, `/api/pixel-office/version`, `/api/pixel-office/contributions`
- `active-check`: `/api/gateway-health`, `/api/model-tests`
- `local-write`: `/api/pixel-office/layout`

Hinweis:

- `local-write` ist per Default blockiert.
- `active-check` ruft nur lokale OpenClaw-Checks auf.
- Externe Quellen wie GitHub Releases oder Contributions sind nur aktiv, wenn das Flag fuer externe Fetches explizit eingeschaltet ist.
- ClawDash nicht ungeschuetzt ins Netz haengen, wenn du es auf einem erreichbaren Host betreibst.
- `CLAWDASH_ENABLE_PRIVACY_MODE=true` maskiert Session-Keys, Feishu-User-IDs und Gateway-Tokens in API-Antworten.
- Wenn du Zugriff absichern willst, setze entweder `CLAWDASH_ACCESS_TOKEN` oder `CLAWDASH_BASIC_AUTH_USER` plus `CLAWDASH_BASIC_AUTH_PASSWORD`.

## Datenquellen

ClawDash liest direkt lokal aus:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/agents/*/sessions/sessions.json`
- `~/.openclaw/agents/*/sessions/*.jsonl`
- `~/.openclaw/agents/main/agent/models.json`

Keine Datenbank, kein externer Sync.
