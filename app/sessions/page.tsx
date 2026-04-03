import Link from "next/link";
import { getAgentSessions, getDashboardData } from "@/lib/openclaw-dashboard";
import type { SessionTransport } from "@/lib/openclaw-types";

export const dynamic = "force-dynamic";

function formatTime(timestamp: number | null | undefined): string {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString("de-AT");
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

function formatAge(timestamp: number | null | undefined): string {
  if (!timestamp) return "-";
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "just now";
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

const TRANSPORT_LABELS: Record<SessionTransport, string> = {
  main: "Main",
  direct: "Direct",
  group: "Group",
  channel: "Channel",
  cron: "Cron",
  subagent: "Subagent",
  acp: "ACP",
  orphan: "Orphan",
  unknown: "Unknown",
};

const TRANSPORT_FILTERS: Array<{ label: string; value: string }> = [
  { label: "All", value: "all" },
  { label: "Main", value: "main" },
  { label: "Direct", value: "direct" },
  { label: "Group", value: "group" },
  { label: "Channel", value: "channel" },
  { label: "Cron", value: "cron" },
  { label: "Subagent", value: "subagent" },
  { label: "ACP", value: "acp" },
  { label: "Unknown", value: "unknown" },
];

const ACTIVITY_FILTERS: Array<{ label: string; value: string }> = [
  { label: "All", value: "all" },
  { label: "24h", value: "recent" },
  { label: "7d", value: "week" },
  { label: "30d", value: "month" },
  { label: "Stale", value: "stale" },
];

function matchesTransportFilter(transport: SessionTransport, filter: string | null): boolean {
  if (!filter || filter === "all") return true;
  return transport === filter;
}

function matchesActivityFilter(updatedAt: number, filter: string | null): boolean {
  if (!filter || filter === "all") return true;
  const age = Date.now() - updatedAt;
  if (filter === "recent") return age <= 24 * 60 * 60 * 1000;
  if (filter === "week") return age <= 7 * 24 * 60 * 60 * 1000;
  if (filter === "month") return age <= 30 * 24 * 60 * 60 * 1000;
  if (filter === "stale") return age > 7 * 24 * 60 * 60 * 1000;
  return true;
}

function previewText(text?: string): string {
  if (!text) return "-";
  return text.length > 140 ? `${text.slice(0, 139)}…` : text;
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; type?: string; activity?: string }>;
}) {
  const params = await searchParams;
  const data = getDashboardData();
  const activeAgent = data.agents.find((agent) => agent.id === params.agent) || data.agents[0];
  const sessions = activeAgent ? getAgentSessions(activeAgent.id) : [];
  const filteredSessions = sessions.filter((session) => {
    const typeMatch = matchesTransportFilter(session.transport, params.type || null);
    const activityMatch = matchesActivityFilter(session.updatedAt, params.activity || null);
    return typeMatch && activityMatch;
  });
  const currentType = params.type || "all";
  const currentActivity = params.activity || "all";
  const recentSession = sessions[0] || null;
  const transportCounts = TRANSPORT_FILTERS.map((filter) => ({
    ...filter,
    count: filter.value === "all"
      ? sessions.length
      : sessions.filter((session) => session.transport === filter.value).length,
  }));

  return (
    <main className="space-y-6">
      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card-strong)] p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Sessions</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Pick an agent on the left, then filter sessions by type, age, and content.
            </p>
          </div>
          <div className="text-sm text-[var(--text-muted)]">
            {sessions.length} sessions · {filteredSessions.length} visible
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="mb-3 text-lg font-semibold">Agents</h3>
          <div className="space-y-2">
            {data.agents.map((agent) => {
              const isActive = activeAgent?.id === agent.id;
              return (
                <Link
                  key={agent.id}
                  href={`/sessions?agent=${agent.id}`}
                  prefetch={false}
                  className={`block rounded-[18px] border px-4 py-3 transition ${
                    isActive
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-[var(--bg-elevated)]/70 hover:border-[var(--accent)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-2xl">{agent.emoji}</div>
                      <div className="mt-1 font-medium">{agent.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{agent.id}</div>
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">{agent.sessionCount}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </aside>

        <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
          {activeAgent ? (
            <>
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold">{activeAgent.emoji} {activeAgent.name}</h3>
                  <p className="text-sm text-[var(--text-muted)]">{activeAgent.id} · {activeAgent.model}</p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <Link href="/" prefetch={false} className="text-[var(--accent)]">back to dashboard</Link>
                  <Link href="/operator" prefetch={false} className="text-[var(--accent)]">Operator View</Link>
                </div>
              </div>

              <div className="mb-4 space-y-3">
                <div className="flex flex-wrap gap-2 text-sm">
                  {TRANSPORT_FILTERS.map((chip) => {
                    const active = currentType === chip.value && currentActivity === "all";
                    return (
                      <Link
                        key={chip.value}
                        href={`/sessions?agent=${activeAgent.id}${chip.value === "all" ? "" : `&type=${chip.value}`}`}
                        prefetch={false}
                        className={`rounded-full border px-4 py-2 ${active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--bg-elevated)]/70"}`}
                      >
                        {chip.label} · {transportCounts.find((item) => item.value === chip.value)?.count || 0}
                      </Link>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  {ACTIVITY_FILTERS.map((chip) => {
                    const active = currentActivity === chip.value && currentType === "all";
                    const href = `/sessions?agent=${activeAgent.id}${chip.value === "all" ? "" : `&activity=${chip.value}`}`;
                    return (
                      <Link
                        key={chip.value}
                        href={href}
                        prefetch={false}
                        className={`rounded-full border px-4 py-2 ${active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--bg-elevated)]/70"}`}
                      >
                        {chip.label}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {recentSession ? (
                <div className="mb-4 rounded-[20px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4 text-sm text-[var(--text-muted)]">
                  Latest session: <span className="text-[var(--text)]">{TRANSPORT_LABELS[recentSession.transport]}</span> · {formatAge(recentSession.updatedAt)} · {formatTokens(recentSession.totalTokens)} tokens
                </div>
              ) : null}

              <div className="mb-4 grid gap-3 md:grid-cols-4">
                {TRANSPORT_FILTERS.slice(1).map((item) => (
                  <div key={item.value} className="rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-3 text-sm">
                    <p className="text-[var(--text-muted)]">{item.label}</p>
                    <p className="mt-1 text-xl font-semibold">{transportCounts.find((entry) => entry.value === item.value)?.count || 0}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {filteredSessions.map((session) => (
                  <article key={session.key} className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-medium">{TRANSPORT_LABELS[session.transport]}</p>
                        <p className="text-sm text-[var(--text-muted)] break-all">{session.key}</p>
                      </div>
                      <div className="text-sm text-[var(--text-muted)]">
                        {formatTime(session.updatedAt)} · {formatAge(session.updatedAt)}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--text-muted)]">
                      <span>Target: {session.target || "-"}</span>
                      <span>Total Tokens: {formatTokens(session.totalTokens)}</span>
                      <span>Context Tokens: {formatTokens(session.contextTokens)}</span>
                      <span>Messages: {session.messageCount ?? 0}</span>
                      <span>Avg response: {session.avgResponseMs ? `${session.avgResponseMs} ms` : "-"}</span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Latest user message</p>
                        <p className="mt-2 text-sm text-[var(--text)]">{previewText(session.lastUserMessage)}</p>
                      </div>
                      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Latest assistant message</p>
                        <p className="mt-2 text-sm text-[var(--text)]">{previewText(session.lastAssistantMessage)}</p>
                      </div>
                    </div>
                  </article>
                ))}
                {filteredSessions.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No sessions found.</p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No agents found.</p>
          )}
        </section>
      </section>
    </main>
  );
}
