import Link from "next/link";
import { LiveGatewayCard } from "@/app/components/live-gateway-card";
import { getDashboardData, getAllStats } from "@/lib/openclaw-dashboard";

export const dynamic = "force-dynamic";

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function formatLastActive(timestamp: number | null): string {
  if (!timestamp) return "no activity";
  return new Date(timestamp).toLocaleString("de-AT");
}

function formatRelativeAge(timestamp: number | null): string {
  if (!timestamp) return "unknown";
  const diff = Date.now() - timestamp;
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

export default function HomePage() {
  const data = getDashboardData();
  const stats = getAllStats();
  const activeAgents = data.agents.filter((agent) => agent.lastActive).length;
  const totalTokens = data.agents.reduce((sum, agent) => sum + agent.totalTokens, 0);
  const totalMessages = stats.daily.reduce((sum, day) => sum + day.messageCount, 0);
  const needsAttention = data.agents
    .filter((agent) => agent.state === "offline" || agent.state === "idle" || agent.sessionCount === 0)
    .slice(0, 4);
  const healthyAgents = data.agents.filter((agent) => agent.state === "working" || agent.state === "online").length;
  const latestActivity = data.agents
    .map((agent) => agent.lastActive || 0)
    .filter((timestamp) => timestamp > 0)
    .sort((a, b) => b - a)[0] || null;
  const averageResponseMs = stats.daily.length
    ? Math.round(stats.daily.reduce((sum, day) => sum + day.avgResponseMs, 0) / stats.daily.length)
    : 0;
  const recentVolume = stats.daily.slice(-3).reduce((sum, day) => sum + day.totalTokens, 0);

  return (
    <main className="space-y-8">
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
          <p className="text-sm text-[var(--text-muted)]">Agents</p>
          <p className="mt-3 text-4xl font-semibold">{data.agents.length}</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{activeAgents} mit Session-Aktivität</p>
        </div>
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
          <p className="text-sm text-[var(--text-muted)]">Models</p>
          <p className="mt-3 text-4xl font-semibold">{data.providers.reduce((sum, provider) => sum + provider.models.length, 0)}</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">across {data.providers.length} providers</p>
        </div>
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
          <p className="text-sm text-[var(--text-muted)]">Token</p>
          <p className="mt-3 text-4xl font-semibold">{formatTokens(totalTokens)}</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">total from local sessions</p>
        </div>
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
          <p className="text-sm text-[var(--text-muted)]">Messages</p>
          <p className="mt-3 text-4xl font-semibold">{totalMessages}</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">assistant replies in logs</p>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card-strong)] p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-[var(--text-muted)]">Entscheidungsübersicht</p>
                <h2 className="mt-2 text-2xl font-semibold">Needs Attention</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {needsAttention.length > 0
                    ? `${needsAttention.length} agents need a quick look right now.`
                    : "Everything looks stable right now."}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link className="text-[var(--accent)]" href="/operator">Operator</Link>
                <Link className="text-[var(--accent)]" href="/sessions">Sessions</Link>
                <Link className="text-[var(--accent)]" href="/stats">Stats</Link>
                <Link className="text-[var(--accent)]" href="/pixel-office">Office</Link>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4">
                <p className="text-sm text-[var(--text-muted)]">Healthy</p>
                <p className="mt-2 text-3xl font-semibold">{healthyAgents}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">working or online</p>
              </div>
              <div className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4">
                <p className="text-sm text-[var(--text-muted)]">Latest activity</p>
                <p className="mt-2 text-2xl font-semibold">{formatRelativeAge(latestActivity)}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{formatLastActive(latestActivity)}</p>
              </div>
              <div className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4">
                <p className="text-sm text-[var(--text-muted)]">Response time</p>
                <p className="mt-2 text-3xl font-semibold">{averageResponseMs ? `${averageResponseMs} ms` : "n/a"}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">last 7 days</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {needsAttention.length > 0 ? needsAttention.map((agent) => (
                <article key={agent.id} className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-2xl">{agent.emoji}</p>
                      <h3 className="mt-1 text-lg font-semibold">{agent.name}</h3>
                      <p className="text-sm text-[var(--text-muted)]">{agent.id} · {agent.model}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--accent)]">
                        {agent.state}
                      </span>
                      <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)]">
                        Sessions: {agent.sessionCount}
                      </span>
                      <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)]">
                        Tokens: {formatTokens(agent.totalTokens)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-[var(--text-muted)]">
                    {agent.sessionCount === 0
                      ? "No sessions found. Check setup or bindings."
                      : agent.state === "offline"
                        ? "Inactive for too long. Check gateway, channel, or model access."
                        : "Keep an eye on it because activity is slowing down."}
                  </p>
                </article>
              )) : (
                <div className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4 text-sm text-[var(--text-muted)]">
                  No urgent issues. All visible agents show usable activity.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card-strong)] p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Agent Overview</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Default model: <span className="font-medium text-[var(--text)]">{data.defaults.model}</span> · 3-day token flow: {formatTokens(recentVolume)}
                </p>
              </div>
              <p className="text-sm text-[var(--text-muted)]">{totalMessages} total messages</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {data.agents.map((agent) => (
                <article key={agent.id} className="rounded-[22px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-3xl">{agent.emoji}</p>
                      <h3 className="mt-2 text-xl font-semibold">{agent.name}</h3>
                      <p className="text-sm text-[var(--text-muted)]">{agent.id}</p>
                    </div>
                    <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--accent)]">
                      {agent.state}
                    </span>
                  </div>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-[var(--text-muted)]">Model</dt>
                      <dd className="text-right">{agent.model}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-[var(--text-muted)]">Token</dt>
                      <dd>{formatTokens(agent.totalTokens)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-[var(--text-muted)]">Sessions</dt>
                      <dd>{agent.sessionCount}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-[var(--text-muted)]">Last active</dt>
                      <dd className="text-right">{formatLastActive(agent.lastActive)}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {agent.platforms.length > 0 ? agent.platforms.map((platform) => (
                      <span key={platform} className="rounded-full border border-[var(--border)] px-3 py-1 text-xs">
                        {platform}
                      </span>
                    )) : (
                      <span className="text-xs text-[var(--text-muted)]">no platform bindings detected</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <LiveGatewayCard />
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--text-muted)]">Shortcuts</p>
            <div className="mt-4 space-y-3 text-sm">
              <Link className="block rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 px-4 py-3 hover:border-[var(--accent)]" href="/sessions?type=main">
                Check main sessions
              </Link>
              <Link className="block rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 px-4 py-3 hover:border-[var(--accent)]" href="/operator">
                Open operator view
              </Link>
              <Link className="block rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 px-4 py-3 hover:border-[var(--accent)]" href="/stats">
                View token and response trends
              </Link>
              <Link className="block rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 px-4 py-3 hover:border-[var(--accent)]" href="/pixel-office">
                Open office layout
              </Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
