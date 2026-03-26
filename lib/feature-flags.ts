import fs from "fs";
import path from "path";
import { OPENCLAW_HOME } from "@/lib/openclaw-paths";

export interface FeatureFlags {
  enableLayoutWrite: boolean;
  enableExternalFetches: boolean;
  enableActiveModelTests: boolean;
  enableActiveChecks: boolean;
  enablePrivacyMode: boolean;
  enableLocalOnlyAccess: boolean;
}

export interface RuntimeSettings {
  gatewayPollIntervalMs: number;
  pixelOfficeAgentPollIntervalMs: number;
  pixelOfficeStatsPollIntervalMs: number;
}

export interface ClawDashSettings {
  featureFlags: FeatureFlags;
  runtime: RuntimeSettings;
}

const CLAWDASH_SETTINGS_DIR = path.join(OPENCLAW_HOME, "clawdash");
const CLAWDASH_SETTINGS_PATH = path.join(CLAWDASH_SETTINGS_DIR, "settings.json");

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== "string") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function readFlag(name: string, fallbackName: string | null, defaultValue: boolean): boolean {
  const value = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  return parseBool(value, defaultValue);
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function defaultFeatureFlags(): FeatureFlags {
  return {
    enableLayoutWrite: readFlag("NEXT_PUBLIC_CLAWDASH_ENABLE_LAYOUT_WRITE", "CLAWDASH_ENABLE_LAYOUT_WRITE", false),
    enableExternalFetches: readFlag("NEXT_PUBLIC_CLAWDASH_ENABLE_EXTERNAL_FETCHES", "CLAWDASH_ENABLE_EXTERNAL_FETCHES", false),
    enableActiveModelTests: readFlag("NEXT_PUBLIC_CLAWDASH_ENABLE_ACTIVE_MODEL_TESTS", "CLAWDASH_ENABLE_ACTIVE_MODEL_TESTS", false),
    enableActiveChecks: readFlag("NEXT_PUBLIC_CLAWDASH_ENABLE_ACTIVE_CHECKS", "CLAWDASH_ENABLE_ACTIVE_CHECKS", false),
    enablePrivacyMode: readFlag("NEXT_PUBLIC_CLAWDASH_ENABLE_PRIVACY_MODE", "CLAWDASH_ENABLE_PRIVACY_MODE", false),
    enableLocalOnlyAccess: readFlag("NEXT_PUBLIC_CLAWDASH_LOCAL_ONLY", "CLAWDASH_LOCAL_ONLY", false),
  };
}

function defaultRuntimeSettings(): RuntimeSettings {
  return {
    gatewayPollIntervalMs: 10_000,
    pixelOfficeAgentPollIntervalMs: 1_000,
    pixelOfficeStatsPollIntervalMs: 30_000,
  };
}

function buildDefaults(): ClawDashSettings {
  return {
    featureFlags: defaultFeatureFlags(),
    runtime: defaultRuntimeSettings(),
  };
}

function sanitizeSettings(input: unknown, defaults = buildDefaults()): ClawDashSettings {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const flags = source.featureFlags && typeof source.featureFlags === "object"
    ? (source.featureFlags as Record<string, unknown>)
    : {};
  const runtime = source.runtime && typeof source.runtime === "object"
    ? (source.runtime as Record<string, unknown>)
    : {};

  return {
    featureFlags: {
      enableLayoutWrite: typeof flags.enableLayoutWrite === "boolean" ? flags.enableLayoutWrite : defaults.featureFlags.enableLayoutWrite,
      enableExternalFetches: typeof flags.enableExternalFetches === "boolean" ? flags.enableExternalFetches : defaults.featureFlags.enableExternalFetches,
      enableActiveModelTests: typeof flags.enableActiveModelTests === "boolean" ? flags.enableActiveModelTests : defaults.featureFlags.enableActiveModelTests,
      enableActiveChecks: typeof flags.enableActiveChecks === "boolean" ? flags.enableActiveChecks : defaults.featureFlags.enableActiveChecks,
      enablePrivacyMode: typeof flags.enablePrivacyMode === "boolean" ? flags.enablePrivacyMode : defaults.featureFlags.enablePrivacyMode,
      enableLocalOnlyAccess: typeof flags.enableLocalOnlyAccess === "boolean" ? flags.enableLocalOnlyAccess : defaults.featureFlags.enableLocalOnlyAccess,
    },
    runtime: {
      gatewayPollIntervalMs: clampNumber(runtime.gatewayPollIntervalMs, defaults.runtime.gatewayPollIntervalMs, 2_000, 120_000),
      pixelOfficeAgentPollIntervalMs: clampNumber(runtime.pixelOfficeAgentPollIntervalMs, defaults.runtime.pixelOfficeAgentPollIntervalMs, 500, 30_000),
      pixelOfficeStatsPollIntervalMs: clampNumber(runtime.pixelOfficeStatsPollIntervalMs, defaults.runtime.pixelOfficeStatsPollIntervalMs, 5_000, 120_000),
    },
  };
}

export function getSettingsPath(): string {
  return CLAWDASH_SETTINGS_PATH;
}

export function getDefaultSettings(): ClawDashSettings {
  return buildDefaults();
}

export function getClawDashSettings(): ClawDashSettings {
  const defaults = buildDefaults();
  try {
    if (!fs.existsSync(CLAWDASH_SETTINGS_PATH)) return defaults;
    const raw = fs.readFileSync(CLAWDASH_SETTINGS_PATH, "utf8");
    return sanitizeSettings(JSON.parse(raw), defaults);
  } catch {
    return defaults;
  }
}

export function saveClawDashSettings(next: ClawDashSettings): ClawDashSettings {
  const sanitized = sanitizeSettings(next);
  fs.mkdirSync(CLAWDASH_SETTINGS_DIR, { recursive: true });
  fs.writeFileSync(CLAWDASH_SETTINGS_PATH, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
  return sanitized;
}

export function getFeatureFlags(): FeatureFlags {
  return getClawDashSettings().featureFlags;
}

export function getRuntimeSettings(): RuntimeSettings {
  return getClawDashSettings().runtime;
}
