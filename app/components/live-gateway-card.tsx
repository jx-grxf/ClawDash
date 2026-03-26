"use client";

import { useEffect, useState } from "react";
import type { GatewayHealthSummary } from "@/lib/openclaw-types";

const POLL_MS = 10000;

function statusLabel(status: GatewayHealthSummary["status"]): string {
  if (status === "healthy") return "gesund";
  if (status === "degraded") return "langsam";
  return "down";
}

function statusClasses(status: GatewayHealthSummary["status"]): string {
  if (status === "healthy") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "degraded") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-rose-500/30 bg-rose-500/10 text-rose-300";
}

export function LiveGatewayCard() {
  const [data, setData] = useState<GatewayHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/gateway-health", { cache: "no-store" });
        const payload = await response.json();
        if (active) setData(payload);
      } catch {
        if (active) {
          setData({
            ok: false,
            status: "down",
            checkedAt: Date.now(),
            responseMs: 0,
            error: "Gateway-Check fehlgeschlagen.",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const interval = window.setInterval(load, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Live Gateway</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">wird alle 10 Sekunden neu geprüft</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs ${statusClasses(data?.status || "down")}`}>
          {loading ? "prüft..." : statusLabel(data?.status || "down")}
        </span>
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-muted)]">Version</dt>
          <dd>{data?.openclawVersion || "-"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-muted)]">Port</dt>
          <dd>{data?.port || "-"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-muted)]">Antwortzeit</dt>
          <dd>{data?.responseMs ? `${data.responseMs} ms` : "-"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-muted)]">Local</dt>
          <dd className="truncate text-right">{data?.localUrl || "-"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-muted)]">Public</dt>
          <dd className="truncate text-right">{data?.publicUrl || "-"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-muted)]">Health-Quelle</dt>
          <dd>{data?.healthSource || "-"}</dd>
        </div>
      </dl>
      {data?.error ? <p className="mt-4 text-sm text-[var(--danger)]">{data.error}</p> : null}
    </div>
  );
}
