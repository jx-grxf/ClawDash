"use client";

import { useState, useTransition } from "react";
import type { ModelProbeSummary } from "@/lib/openclaw-types";

function statusColor(status: string): string {
  if (status === "ok") return "text-emerald-300 bg-emerald-500/12 border-emerald-500/30";
  if (status === "static") return "text-sky-300 bg-sky-500/12 border-sky-500/30";
  return "text-rose-300 bg-rose-500/12 border-rose-500/30";
}

interface LiveModelTestsProps {
  enabled: boolean;
}

export function LiveModelTests({ enabled }: LiveModelTestsProps) {
  const [data, setData] = useState<ModelProbeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () => {
    if (!enabled) return;
    startTransition(async () => {
      try {
        setError(null);
        const response = await fetch("/api/model-tests", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Model probe failed.");
        setData(payload);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Model probe failed.");
      }
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Live model tests</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Probe via `openclaw models status --probe`
          </p>
        </div>
        <button
          onClick={load}
          disabled={!enabled || isPending}
          className="rounded-full border border-[var(--border)] bg-[var(--card-strong)] px-4 py-2 text-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {!enabled ? "disabled" : isPending ? "checking..." : "run again"}
        </button>
      </div>

      {!enabled ? (
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--text-muted)]">
          Active model tests are disabled by feature flag. This view stays read-only.
        </div>
      ) : null}
      {data ? (
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--text-muted)]">
          Last probe: {new Date(data.finishedAt).toLocaleString("de-AT")} · Duration: {data.durationMs} ms · Results: {data.results.length}
        </div>
      ) : null}
      {!data && !error ? (
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--text-muted)]">
          No probe has run yet. Click `run again` to test the models on demand.
        </div>
      ) : null}
      {error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</p> : null}
      <div className="grid gap-4">
        {(data?.results || []).map((result) => (
          <article key={`${result.provider}-${result.model}`} className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold">{result.model}</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Provider: {result.provider} · Mode: {result.mode || "unknown"}
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs ${statusColor(result.status)}`}>
                {result.status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--text-muted)]">
              <span>Latency: {result.latencyMs ? `${result.latencyMs} ms` : "-"}</span>
              <span>Source: {result.source || "-"}</span>
              <span>Profile: {result.profileId || "-"}</span>
            </div>
            {result.error ? <p className="mt-3 text-sm text-[var(--danger)]">{result.error}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
