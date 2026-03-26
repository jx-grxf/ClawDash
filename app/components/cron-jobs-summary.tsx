"use client";

import { useEffect, useState } from "react";

type CronJob = {
  key: string;
  jobId: string;
  label: string;
  agentId: string;
  isRunning: boolean;
  lastRunAt: number;
  nextRunAt?: number;
  durationMs?: number;
  lastStatus: "success" | "running" | "failed";
  lastSummary?: string;
  consecutiveFailures: number;
};

type CronJobsOverview = {
  totals: {
    jobs: number;
    running: number;
    failed: number;
    success: number;
  };
  jobs: CronJob[];
};

function formatTime(value: number): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("de-AT");
}

export function CronJobsSummary() {
  const [data, setData] = useState<CronJobsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/cron-jobs", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Cron-Übersicht konnte nicht geladen werden.");
        if (active) setData(payload);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Cron-Übersicht konnte nicht geladen werden.");
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">Cron Jobs</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Live-Übersicht aus dem lokalen Job-Store.</p>
        </div>
        <div className="text-sm text-[var(--text-muted)]">
          {data?.totals.jobs || 0} Jobs · {data?.totals.running || 0} running
        </div>
      </div>

      {error ? <p className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4">
          <p className="text-sm text-[var(--text-muted)]">Gesamt</p>
          <p className="mt-2 text-3xl font-semibold">{data?.totals.jobs || 0}</p>
        </div>
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4">
          <p className="text-sm text-[var(--text-muted)]">Running</p>
          <p className="mt-2 text-3xl font-semibold">{data?.totals.running || 0}</p>
        </div>
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4">
          <p className="text-sm text-[var(--text-muted)]">Failed</p>
          <p className="mt-2 text-3xl font-semibold">{data?.totals.failed || 0}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {(data?.jobs || []).slice(0, 5).map((job) => (
          <article key={job.key} className="rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-medium">{job.label}</p>
                <p className="text-sm text-[var(--text-muted)]">{job.agentId} · {job.jobId}</p>
              </div>
              <div className="text-sm text-[var(--text-muted)]">
                {job.lastStatus} · {formatTime(job.lastRunAt)}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--text-muted)]">
              <span>Next: {formatTime(job.nextRunAt || 0)}</span>
              <span>Dauer: {job.durationMs ? `${Math.round(job.durationMs / 1000)}s` : "-"}</span>
              <span>Fehler: {job.consecutiveFailures}</span>
            </div>
            {job.lastSummary ? <p className="mt-3 text-sm text-[var(--text)]">{job.lastSummary}</p> : null}
          </article>
        ))}
        {data && data.jobs.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Keine Cron-Jobs gefunden.</p>
        ) : null}
      </div>
    </section>
  );
}
