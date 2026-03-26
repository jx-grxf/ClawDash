"use client";

import { useEffect, useState, useTransition } from "react";
import type { ClawDashSettings } from "@/lib/feature-flags";

type SettingsPayload = {
  settings: ClawDashSettings;
  defaults: ClawDashSettings;
  path: string;
};

const FEATURE_FLAG_ITEMS: Array<{
  key: keyof ClawDashSettings["featureFlags"];
  title: string;
  description: string;
}> = [
  {
    key: "enableLayoutWrite",
    title: "Enable layout editing",
    description: "Allow saving Pixel Office layout changes from the dashboard.",
  },
  {
    key: "enableExternalFetches",
    title: "Enable external fetches",
    description: "Allow release/contribution fetches that reach external services.",
  },
  {
    key: "enableActiveModelTests",
    title: "Enable active model tests",
    description: "Allow real OpenClaw model probes from the Models page.",
  },
  {
    key: "enableActiveChecks",
    title: "Enable active gateway checks",
    description: "Allow live gateway health checks instead of read-only status.",
  },
];

const RUNTIME_ITEMS: Array<{
  key: keyof ClawDashSettings["runtime"];
  title: string;
  description: string;
  suffix: string;
  step: number;
  min: number;
  max: number;
}> = [
  {
    key: "gatewayPollIntervalMs",
    title: "Gateway refresh interval",
    description: "How often the live gateway card refreshes.",
    suffix: "ms",
    step: 1000,
    min: 2000,
    max: 120000,
  },
  {
    key: "pixelOfficeAgentPollIntervalMs",
    title: "Pixel Office agent refresh interval",
    description: "How often Pixel Office refreshes agent activity.",
    suffix: "ms",
    step: 500,
    min: 500,
    max: 30000,
  },
  {
    key: "pixelOfficeStatsPollIntervalMs",
    title: "Pixel Office stats refresh interval",
    description: "How often Pixel Office refreshes stats and snapshots.",
    suffix: "ms",
    step: 1000,
    min: 5000,
    max: 120000,
  },
];

export function SettingsPanel() {
  const [settings, setSettings] = useState<ClawDashSettings | null>(null);
  const [defaults, setDefaults] = useState<ClawDashSettings | null>(null);
  const [settingsPath, setSettingsPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    void fetch("/api/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: SettingsPayload) => {
        if (!active) return;
        setSettings(payload.settings);
        setDefaults(payload.defaults);
        setSettingsPath(payload.path);
      })
      .catch(() => {
        if (active) setError("Failed to load settings.");
      });
    return () => {
      active = false;
    };
  }, []);

  function setFeatureFlag(key: keyof ClawDashSettings["featureFlags"], value: boolean) {
    setSettings((current) => current ? {
      ...current,
      featureFlags: {
        ...current.featureFlags,
        [key]: value,
      },
    } : current);
  }

  function setRuntimeValue(key: keyof ClawDashSettings["runtime"], value: number) {
    setSettings((current) => current ? {
      ...current,
      runtime: {
        ...current.runtime,
        [key]: value,
      },
    } : current);
  }

  function resetToDefaults() {
    if (!defaults) return;
    setSettings(defaults);
    setSuccess(null);
    setError(null);
  }

  function save() {
    if (!settings) return;
    startTransition(async () => {
      try {
        setError(null);
        setSuccess(null);
        const response = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to save settings.");
        setSettings(payload.settings);
        setSuccess("Settings saved.");
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Failed to save settings.");
      }
    });
  }

  if (!settings) {
    return (
      <main className="space-y-6">
        <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card-strong)] p-6">
          <h2 className="text-2xl font-semibold">Settings</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Loading local dashboard settings...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card-strong)] p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Settings</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Local ClawDash runtime settings stored on disk.
            </p>
            <p className="mt-2 break-all text-xs text-[var(--text-muted)]">{settingsPath}</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={resetToDefaults}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm"
            >
              Reset draft
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm text-[var(--text)] disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save settings"}
            </button>
          </div>
        </div>
        {success ? <p className="mt-4 text-sm text-emerald-300">{success}</p> : null}
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </section>

      <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="text-xl font-semibold">Feature flags</h3>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          These flags can be changed live from the dashboard. Security and access-control env flags stay outside this panel.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {FEATURE_FLAG_ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex items-start justify-between gap-4 rounded-[20px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4"
            >
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{item.description}</p>
              </div>
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={settings.featureFlags[item.key]}
                onChange={(event) => setFeatureFlag(item.key, event.target.checked)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="text-xl font-semibold">Runtime</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {RUNTIME_ITEMS.map((item) => (
            <label
              key={item.key}
              className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4"
            >
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{item.description}</p>
              <input
                type="number"
                min={item.min}
                max={item.max}
                step={item.step}
                value={settings.runtime[item.key]}
                onChange={(event) => setRuntimeValue(item.key, Number(event.target.value))}
                className="mt-4 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2"
              />
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Range: {item.min} - {item.max} {item.suffix}
              </p>
            </label>
          ))}
        </div>
      </section>
    </main>
  );
}
