import Link from "next/link";
import { StatsChart } from "@/app/components/stats-chart";
import { getAllStats, getDashboardData, getStatsForAgent } from "@/lib/openclaw-dashboard";

export const dynamic = "force-dynamic";

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function BarRow({
  label,
  value,
  maxValue,
  meta,
  href,
  active,
}: {
  label: string;
  value: number;
  maxValue: number;
  meta: string;
  href?: string;
  active?: boolean;
}) {
  const width = maxValue > 0 ? Math.max(4, (value / maxValue) * 100) : 4;
  const body = (
    <div className={`rounded-[18px] border px-4 py-3 ${active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--bg-elevated)]/70"}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-xs text-[var(--text-muted)]">{meta}</p>
        </div>
        <p className="text-sm font-semibold">{formatTokens(value)}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/20">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );

  if (!href) return body;
  return <Link href={href}>{body}</Link>;
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>;
}) {
  const params = await searchParams;
  const dashboard = getDashboardData();
  const allStats = getAllStats();
  const activeAgent = dashboard.agents.find((agent) => agent.id === params.agent) || null;
  const scopedStats = activeAgent ? getStatsForAgent(activeAgent.id) : null;
  const chartStats = scopedStats || allStats;
  const totalTokens = chartStats.daily.reduce((sum, day) => sum + day.totalTokens, 0);
  const avgResponseMs = chartStats.daily.length
    ? Math.round(chartStats.daily.reduce((sum, day) => sum + day.avgResponseMs, 0) / chartStats.daily.length)
    : 0;
  const daysWithData = chartStats.daily.filter((day) => day.messageCount > 0).length;
  const totalMessages = chartStats.daily.reduce((sum, day) => sum + day.messageCount, 0);
  const rolling = allStats.rolling || { responseMs7d: 0, tokens7d: 0, messages7d: 0 };
  const byAgent = allStats.byAgent || [];
  const byModel = allStats.byModel || [];
  const maxAgentTokens = Math.max(...byAgent.map((item) => item.totalTokens), 1);
  const maxModelTokens = Math.max(...byModel.map((item) => item.totalTokens), 1);

  return (
    <main className="space-y-6">
      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card-strong)] p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Stats</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Token usage and response times from local JSONL session logs.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/stats" className="text-[var(--accent)]">all agents</Link>
            <Link href="/operator" className="text-[var(--accent)]">Operator View</Link>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex flex-wrap gap-2">
          {dashboard.agents.map((agent) => {
            const active = params.agent === agent.id;
            return (
              <Link
                key={agent.id}
                href={`/stats?agent=${agent.id}`}
                className={`rounded-full border px-4 py-2 text-sm ${
                  active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--bg-elevated)]/70"
                }`}
              >
                {agent.emoji} {agent.name}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Total tokens</p>
          <p className="mt-2 text-3xl font-semibold">{formatTokens(totalTokens)}</p>
        </div>
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Avg response time</p>
          <p className="mt-2 text-3xl font-semibold">{avgResponseMs ? `${avgResponseMs} ms` : "n/a"}</p>
        </div>
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Days with data</p>
          <p className="mt-2 text-3xl font-semibold">{daysWithData}</p>
        </div>
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Messages</p>
          <p className="mt-2 text-3xl font-semibold">{totalMessages}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Rolling 7d Tokens</p>
          <p className="mt-2 text-3xl font-semibold">{formatTokens(rolling.tokens7d)}</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Avg response {rolling.responseMs7d || 0} ms</p>
        </div>
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Rolling 7d Messages</p>
          <p className="mt-2 text-3xl font-semibold">{rolling.messages7d}</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">last 7 days</p>
        </div>
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Scope</p>
          <p className="mt-2 text-lg font-semibold">{activeAgent ? activeAgent.name : "All agents"}</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{activeAgent ? activeAgent.model : "entire dashboard"}</p>
        </div>
      </section>

      <section className="grid gap-6">
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Token trend {activeAgent ? `· ${activeAgent.name}` : "· all agents"}</h3>
          </div>
          <StatsChart data={chartStats.daily} metric="totalTokens" color="#d0612d" />
        </div>
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Response trend {activeAgent ? `· ${activeAgent.name}` : "· all agents"}</h3>
          </div>
          <StatsChart data={chartStats.daily} metric="avgResponseMs" color="#1d8f56" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Per Agent</h3>
            <p className="text-sm text-[var(--text-muted)]">Tokens and response data per agent.</p>
          </div>
          <div className="space-y-3">
            {byAgent.map((item) => (
              <BarRow
                key={item.id}
                label={item.label}
                value={item.totalTokens}
                maxValue={maxAgentTokens}
                meta={`${item.messageCount} messages · ${item.avgResponseMs || 0} ms · ${item.daysWithData} days`}
                href={`/stats?agent=${item.id}`}
                active={activeAgent?.id === item.id}
              />
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Per model</h3>
            <p className="text-sm text-[var(--text-muted)]">Active model usage across all agents.</p>
          </div>
          <div className="space-y-3">
            {byModel.map((item) => (
              <BarRow
                key={item.id}
                label={item.label}
                value={item.totalTokens}
                maxValue={maxModelTokens}
                meta={`${item.messageCount} messages · ${item.avgResponseMs || 0} ms · ${item.daysWithData} days`}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
