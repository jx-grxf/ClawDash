import Link from "next/link";
import { CronJobsSummary } from "@/app/components/cron-jobs-summary";
import { LiveGatewayCard } from "@/app/components/live-gateway-card";
import { getAllStats, getDashboardData } from "@/lib/openclaw-dashboard";

export const dynamic = "force-dynamic";

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

export default function OperatorPage() {
  const dashboard = getDashboardData();
  const stats = getAllStats();
  const needsAttention = dashboard.agents.filter((agent) => agent.state === "offline" || agent.sessionCount === 0);
  const rolling = stats.rolling || { responseMs7d: 0, tokens7d: 0, messages7d: 0 };

  return (
    <main className="space-y-6">
      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card-strong)] p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--text-muted)]">Operator View</p>
            <h2 className="mt-2 text-2xl font-semibold">OpenClaw quick check</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Gateway, cron, agent health, and current usage at a glance.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/sessions" className="text-[var(--accent)]">Sessions</Link>
            <Link href="/stats" className="text-[var(--accent)]">Stats</Link>
            <Link href="/pixel-office" className="text-[var(--accent)]">Pixel Office</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Agents</p>
          <p className="mt-2 text-3xl font-semibold">{dashboard.agents.length}</p>
        </div>
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Needs Attention</p>
          <p className="mt-2 text-3xl font-semibold">{needsAttention.length}</p>
        </div>
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--text-muted)]">7d Tokens</p>
          <p className="mt-2 text-3xl font-semibold">{formatTokens(rolling.tokens7d)}</p>
        </div>
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--text-muted)]">7d Messages</p>
          <p className="mt-2 text-3xl font-semibold">{rolling.messages7d}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <LiveGatewayCard />
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="text-xl font-semibold">Needs Attention</h3>
            <div className="mt-4 space-y-3">
              {needsAttention.slice(0, 5).map((agent) => (
                <article key={agent.id} className="rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-2xl">{agent.emoji}</p>
                      <p className="mt-2 font-medium">{agent.name}</p>
                      <p className="text-sm text-[var(--text-muted)]">{agent.id} · {agent.model}</p>
                    </div>
                    <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--accent)]">
                      {agent.state}
                    </span>
                  </div>
                </article>
              ))}
              {needsAttention.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">All quiet. No direct issues detected.</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <CronJobsSummary />
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="text-xl font-semibold">Quick note</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              This is the fast operations view. Use Sessions and Stats for deeper analysis.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
