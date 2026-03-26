"use client";

import { useEffect, useMemo, useState } from "react";
import type { CliCommandNode, CliRiskTier } from "@/lib/openclaw-cli-metadata";

type CommandRun = {
  command: string;
  args: string[];
  riskTier: CliRiskTier;
  status: "success" | "error" | "timeout";
  exitCode: number;
  runtimeMs: number;
  stdoutPreview: string;
  stderrPreview: string;
  stdout: string;
  stderr: string;
  ranAt: number;
};

const QUICK_ACTIONS = [
  ["status"],
  ["health"],
  ["gateway", "status"],
  ["cron", "list"],
  ["cron", "runs", "--limit", "20"],
  ["sessions"],
  ["skills", "list"],
  ["models", "status"],
  ["docs", "gateway"],
];

const GLOBAL_FLAGS = [
  { key: "profile", label: "--profile", type: "text" },
  { key: "container", label: "--container", type: "text" },
  { key: "logLevel", label: "--log-level", type: "select", options: ["silent", "fatal", "error", "warn", "info", "debug", "trace"] },
  { key: "dev", label: "--dev", type: "checkbox" },
  { key: "noColor", label: "--no-color", type: "checkbox" },
] as const;

const FAVORITES_KEY = "clawdash-cli-favorites";
const HISTORY_KEY = "clawdash-cli-history";

function normalizeMeta(payload: Partial<CliCommandNode> | null | undefined): CliCommandNode | null {
  if (!payload) return null;
  return {
    id: payload.id || "unknown",
    name: payload.name || "openclaw",
    description: payload.description || "",
    usage: payload.usage,
    docsUrl: payload.docsUrl,
    options: Array.isArray(payload.options) ? payload.options : [],
    examples: Array.isArray(payload.examples) ? payload.examples : [],
    subcommands: Array.isArray(payload.subcommands) ? payload.subcommands : [],
    riskTier: payload.riskTier || "read_only",
    suggestedTimeoutMs: typeof payload.suggestedTimeoutMs === "number" ? payload.suggestedTimeoutMs : 10_000,
    requiresConfirmation: Boolean(payload.requiresConfirmation),
  };
}

function riskTone(risk: CliRiskTier): string {
  if (risk === "read_only") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (risk === "active_local") return "border-sky-500/30 bg-sky-500/10 text-sky-300";
  if (risk === "state_mutating") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (risk === "external_side_effect") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  return "border-rose-500/30 bg-rose-500/10 text-rose-300";
}

function tryParseRawArgs(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new Error("Raw args must be a JSON string array.");
  }
  return parsed;
}

export function OpenClawCommandConsole() {
  const [rootMeta, setRootMeta] = useState<CliCommandNode | null>(null);
  const [nodeMeta, setNodeMeta] = useState<CliCommandNode | null>(null);
  const [selectedCommand, setSelectedCommand] = useState("");
  const [selectedSubcommand, setSelectedSubcommand] = useState("");
  const [optionValues, setOptionValues] = useState<Record<string, string | boolean>>({});
  const [globalState, setGlobalState] = useState<Record<string, string | boolean>>({
    profile: "",
    container: "",
    logLevel: "",
    dev: false,
    noColor: true,
  });
  const [positionals, setPositionals] = useState("");
  const [rawArgs, setRawArgs] = useState('["status"]');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [results, setResults] = useState<CommandRun[]>([]);
  const [favorites, setFavorites] = useState<string[][]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeCommand, setActiveCommand] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/cli/metadata", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setRootMeta(normalizeMeta(payload)));
    try {
      setFavorites(JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || "[]"));
      setResults(JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]"));
    } catch {}
  }, []);

  useEffect(() => {
    if (!selectedCommand) return;
    void fetch(`/api/cli/metadata?path=${encodeURIComponent(selectedCommand)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        setNodeMeta(normalizeMeta(payload));
        setSelectedSubcommand("");
        setOptionValues({});
      });
  }, [selectedCommand]);

  useEffect(() => {
    if (!selectedCommand || !selectedSubcommand) return;
    void fetch(`/api/cli/metadata?path=${encodeURIComponent(`${selectedCommand} ${selectedSubcommand}`)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        setNodeMeta(normalizeMeta(payload));
        setOptionValues({});
      });
  }, [selectedCommand, selectedSubcommand]);

  const effectiveMeta = nodeMeta || rootMeta;

  const builtArgs = useMemo(() => {
    if (advancedMode) {
      try {
        return tryParseRawArgs(rawArgs);
      } catch {
        return [];
      }
    }
    const args: string[] = [];
    if (globalState.profile) args.push("--profile", String(globalState.profile));
    if (globalState.container) args.push("--container", String(globalState.container));
    if (globalState.logLevel) args.push("--log-level", String(globalState.logLevel));
    if (globalState.dev) args.push("--dev");
    if (globalState.noColor) args.push("--no-color");
    if (selectedCommand) args.push(selectedCommand);
    if (selectedSubcommand) args.push(selectedSubcommand);
    for (const option of effectiveMeta?.options || []) {
      const key = option.label;
      const value = optionValues[key];
      if (option.expectsValue) {
        if (typeof value === "string" && value.trim()) {
          args.push(option.flags[option.flags.length - 1], value.trim());
        }
      } else if (value === true) {
        args.push(option.flags[option.flags.length - 1]);
      }
    }
    if (positionals.trim()) {
      args.push(...positionals.split(/\s+/).filter(Boolean));
    }
    return args;
  }, [advancedMode, rawArgs, globalState, selectedCommand, selectedSubcommand, effectiveMeta, optionValues, positionals]);

  const currentRisk = effectiveMeta?.riskTier || "read_only";
  const commandPreview = builtArgs.length > 0 ? `openclaw ${builtArgs.map((arg) => JSON.stringify(arg)).join(" ")}` : "openclaw";

  function persist(nextResults: CommandRun[], nextFavorites = favorites) {
    setResults(nextResults);
    setFavorites(nextFavorites);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextResults.slice(0, 12)));
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(nextFavorites.slice(0, 12)));
  }

  async function runArgs(args: string[], riskTier: CliRiskTier) {
    setIsRunning(true);
    setError(null);
    setActiveCommand(`openclaw ${args.join(" ")}`);
    try {
      const needsConfirmation = riskTier === "state_mutating" || riskTier === "external_side_effect" || riskTier === "dangerous";
      if (needsConfirmation) {
        const ok = window.confirm(`Run ${riskTier} command?\n\nopenclaw ${args.join(" ")}`);
        if (!ok) {
          setIsRunning(false);
          setActiveCommand("");
          return;
        }
      }

      const response = await fetch("/api/cli/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args, riskTier, confirmed: true }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Command failed.");
      const nextResults = [payload as CommandRun, ...results].slice(0, 12);
      persist(nextResults);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Command failed.");
    } finally {
      setIsRunning(false);
      setActiveCommand("");
    }
  }

  function toggleFavorite(args: string[]) {
    const exists = favorites.some((favorite) => JSON.stringify(favorite) === JSON.stringify(args));
    const nextFavorites = exists
      ? favorites.filter((favorite) => JSON.stringify(favorite) !== JSON.stringify(args))
      : [args, ...favorites];
    persist(results, nextFavorites);
  }

  return (
    <main className="space-y-6">
      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card-strong)] p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">OpenClaw CLI Console</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Structured OpenClaw-only command runner with metadata, risk tiers, history, and favorites.
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs ${riskTone(currentRisk)}`}>{currentRisk}</span>
        </div>
      </section>

      <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="text-xl font-semibold">Quick Actions</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((args) => (
            <button
              key={args.join(" ")}
              type="button"
              onClick={() => void runArgs(args, "read_only")}
              className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]/70 px-4 py-2 text-sm hover:border-[var(--accent)]"
            >
              openclaw {args.join(" ")}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">Command Builder</h3>
              <button
                type="button"
                onClick={() => setAdvancedMode((value) => !value)}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm"
              >
                {advancedMode ? "Structured" : "Advanced Raw Args"}
              </button>
            </div>

            {!advancedMode ? (
              <div className="mt-4 space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  {GLOBAL_FLAGS.map((item) => (
                    <label key={item.key} className="space-y-2 text-sm">
                      <span className="text-[var(--text-muted)]">{item.label}</span>
                      {item.type === "checkbox" ? (
                        <input
                          type="checkbox"
                          checked={Boolean(globalState[item.key])}
                          onChange={(event) => setGlobalState((current) => ({ ...current, [item.key]: event.target.checked }))}
                        />
                      ) : item.type === "select" ? (
                        <select
                          value={String(globalState[item.key] || "")}
                          onChange={(event) => setGlobalState((current) => ({ ...current, [item.key]: event.target.value }))}
                          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2"
                        >
                          <option value="">default</option>
                          {item.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ) : (
                        <input
                          value={String(globalState[item.key] || "")}
                          onChange={(event) => setGlobalState((current) => ({ ...current, [item.key]: event.target.value }))}
                          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2"
                        />
                      )}
                    </label>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="text-[var(--text-muted)]">Command</span>
                    <select
                      value={selectedCommand}
                      onChange={(event) => setSelectedCommand(event.target.value)}
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2"
                    >
                      <option value="">choose command</option>
                      {(rootMeta?.subcommands || []).map((command) => (
                        <option key={command.name} value={command.name}>{command.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-[var(--text-muted)]">Subcommand</span>
                    <select
                      value={selectedSubcommand}
                      onChange={(event) => setSelectedSubcommand(event.target.value)}
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2"
                    >
                      <option value="">none</option>
                      {(nodeMeta?.subcommands || []).map((command) => (
                        <option key={command.name} value={command.name}>{command.name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {(effectiveMeta?.options || []).length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {effectiveMeta?.options.map((option) => (
                      <label key={option.label} className="space-y-2 text-sm">
                        <span className="text-[var(--text-muted)]">{option.label}</span>
                        {option.expectsValue ? (
                          <input
                            value={String(optionValues[option.label] || "")}
                            onChange={(event) => setOptionValues((current) => ({ ...current, [option.label]: event.target.value }))}
                            placeholder={option.valueHint || option.description}
                            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2"
                          />
                        ) : (
                          <input
                            type="checkbox"
                            checked={Boolean(optionValues[option.label])}
                            onChange={(event) => setOptionValues((current) => ({ ...current, [option.label]: event.target.checked }))}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                ) : null}

                <label className="space-y-2 text-sm">
                  <span className="text-[var(--text-muted)]">Positional args</span>
                  <input
                    value={positionals}
                    onChange={(event) => setPositionals(event.target.value)}
                    placeholder="Optional positional args separated by spaces"
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2"
                  />
                </label>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-[var(--text-muted)]">
                  Power-user mode. Provide a JSON string array only. Example: <code>[&quot;gateway&quot;,&quot;status&quot;,&quot;--json&quot;]</code>
                </p>
                <textarea
                  value={rawArgs}
                  onChange={(event) => setRawArgs(event.target.value)}
                  className="min-h-36 w-full rounded-[20px] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 font-mono text-sm"
                />
              </div>
            )}

            <div className="mt-5 rounded-[20px] border border-[var(--border)] bg-black/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Command Preview</p>
              <p className="mt-2 break-all font-mono text-sm">{commandPreview}</p>
            </div>

            {isRunning ? (
              <div className="mt-4 rounded-[20px] border border-sky-500/30 bg-sky-500/10 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-sky-200">Running OpenClaw command</p>
                    <p className="mt-1 break-all font-mono text-xs text-sky-100/80">{activeCommand || commandPreview}</p>
                  </div>
                  <span className="rounded-full border border-sky-400/30 px-3 py-1 text-xs text-sky-200">
                    in progress
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/20">
                  <div className="h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-sky-400" />
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isRunning || builtArgs.length === 0}
                onClick={() => void runArgs(builtArgs, currentRisk)}
                className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-5 py-2 text-sm disabled:opacity-50"
              >
                {isRunning ? "Running..." : "Run command"}
              </button>
              <button
                type="button"
                disabled={builtArgs.length === 0}
                onClick={() => toggleFavorite(builtArgs)}
                className="rounded-full border border-[var(--border)] px-5 py-2 text-sm disabled:opacity-50"
              >
                Favorite
              </button>
            </div>

            {effectiveMeta ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4">
                  <p className="text-sm font-medium">Help</p>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">{effectiveMeta.description || "No description available."}</p>
                  {effectiveMeta.usage ? <p className="mt-2 font-mono text-xs text-[var(--text-muted)]">{effectiveMeta.usage}</p> : null}
                </div>
                <div className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4">
                  <p className="text-sm font-medium">Examples</p>
                  <div className="mt-2 space-y-2 text-xs text-[var(--text-muted)]">
                    {effectiveMeta.examples.length > 0 ? effectiveMeta.examples.slice(0, 4).map((example) => <p key={example} className="font-mono">{example}</p>) : (
                      <p>No examples available.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {error ? <p className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</p> : null}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="text-xl font-semibold">Favorites</h3>
            <div className="mt-4 space-y-2">
              {favorites.length > 0 ? favorites.map((favorite) => (
                <div key={favorite.join(" ")} className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-3">
                  <button type="button" onClick={() => void runArgs(favorite, "read_only")} className="text-left text-sm font-mono">
                    openclaw {favorite.join(" ")}
                  </button>
                  <button type="button" onClick={() => toggleFavorite(favorite)} className="text-xs text-[var(--text-muted)]">
                    remove
                  </button>
                </div>
              )) : <p className="text-sm text-[var(--text-muted)]">No favorites yet.</p>}
            </div>
          </section>

          <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="text-xl font-semibold">Recent Runs</h3>
            <div className="mt-4 space-y-3">
              {results.length > 0 ? results.map((result) => (
                <article key={`${result.command}-${result.ranAt}`} className="rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono text-sm">{result.command}</p>
                    <span className={`rounded-full border px-3 py-1 text-xs ${riskTone(result.riskTier)}`}>{result.status}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
                    <span>exit {result.exitCode}</span>
                    <span>{result.runtimeMs} ms</span>
                    <span>{new Date(result.ranAt).toLocaleString("en-US")}</span>
                  </div>
                  {result.stdoutPreview ? (
                    <pre className="mt-3 overflow-x-auto rounded-[14px] border border-[var(--border)] bg-black/20 p-3 text-xs text-[var(--text-muted)]">{result.stdoutPreview}</pre>
                  ) : null}
                  {result.stderrPreview ? (
                    <pre className="mt-3 overflow-x-auto rounded-[14px] border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-200">{result.stderrPreview}</pre>
                  ) : null}
                  <div className="mt-3 flex gap-3 text-sm">
                    <button type="button" onClick={() => void runArgs(result.args, result.riskTier)} className="text-[var(--accent)]">rerun</button>
                    <button type="button" onClick={() => navigator.clipboard.writeText(result.stdout || result.stderr || "")} className="text-[var(--accent)]">copy output</button>
                  </div>
                </article>
              )) : <p className="text-sm text-[var(--text-muted)]">No runs yet.</p>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
