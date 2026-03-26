import fs from "fs";
import path from "path";
import { OPENCLAW_HOME } from "@/lib/openclaw-paths";
import { createCacheEntry, getCachedData, type CacheEntry } from "@/lib/server-cache";
import type { SessionItem, SessionTransport } from "@/lib/openclaw-types";

export type SessionChannel = "feishu" | "discord" | "telegram" | "whatsapp" | "slack" | "openai" | string;

// Supported OpenClaw session families that we can safely label in the UI.
// Unknown or future formats still flow through as `unknown` for fallback handling.
export interface SessionIndexEntry {
  sessionId?: string;
  updatedAt?: number;
  label?: string;
  sessionFile?: string;
}

export type SessionsIndex = Record<string, SessionIndexEntry>;

export interface ParsedSessionKey {
  raw: string;
  canonicalKey: string;
  agentId?: string;
  transport: SessionTransport;
  platform?: SessionChannel;
  target?: string;
  sessionId?: string;
  isSubagent: boolean;
  isKnown: boolean;
}

export type CronJobStatus = "success" | "running" | "failed";

export interface CronStoreJob {
  id: string;
  agentId?: string;
  sessionKey?: string;
  name?: string;
  enabled?: boolean;
  payload?: {
    kind?: string;
    message?: string;
    text?: string;
  };
  state?: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastDurationMs?: number;
    lastStatus?: string;
    lastError?: string;
    consecutiveErrors?: number;
  };
}

export interface CronJobInfo {
  key: string;
  jobId: string;
  label: string;
  isRunning: boolean;
  lastRunAt: number;
  nextRunAt?: number;
  durationMs?: number;
  lastStatus: CronJobStatus;
  lastSummary?: string;
  consecutiveFailures: number;
}

const SESSIONS_INDEX_CACHE_TTL_MS = 10_000;
const sessionsIndexCache = new Map<string, CacheEntry<SessionsIndex>>();
const sessionItemsCache = new Map<string, CacheEntry<SessionItem[]>>();
const CRON_JOBS_CACHE_TTL_MS = 10_000;
const cronJobsCache = new Map<string, CacheEntry<CronStoreJob[]>>();

function stripRunSuffix(sessionKey: string): string {
  const idx = sessionKey.indexOf(":run:");
  return idx >= 0 ? sessionKey.slice(0, idx) : sessionKey;
}

function parseTail(parts: string[]): string {
  return parts.slice(0).join(":");
}

function normalizePlatform(value: string | undefined): SessionChannel | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractTextBlocks(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const entry = block as Record<string, unknown>;
      return entry.type === "text" && typeof entry.text === "string" ? entry.text : "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePreviewText(raw: unknown, maxLen = 120): string | undefined {
  const text = extractTextBlocks(raw);
  if (!text) return undefined;
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

export function parseSessionKey(rawKey: string): ParsedSessionKey {
  const raw = typeof rawKey === "string" ? rawKey.trim() : "";
  const canonicalKey = raw ? stripRunSuffix(raw) : "";

  if (!canonicalKey) {
    return {
      raw,
      canonicalKey,
      transport: "unknown",
      isSubagent: false,
      isKnown: false,
    };
  }

  const parts = canonicalKey.split(":");
  if (parts[0] !== "agent" || parts.length < 3) {
    return {
      raw,
      canonicalKey,
      transport: "unknown",
      isSubagent: false,
      isKnown: false,
    };
  }

  const agentId = parts[1] || undefined;
  const scope = parts[2] || "";

  if (scope === "main") {
    return {
      raw,
      canonicalKey,
      agentId,
      transport: "main",
      isSubagent: false,
      isKnown: true,
    };
  }

  if (scope === "subagent" || scope === "spawned") {
    const sessionId = parts.slice(3).join(":") || undefined;
    return {
      raw,
      canonicalKey,
      agentId,
      transport: "subagent",
      sessionId,
      target: sessionId,
      isSubagent: true,
      isKnown: true,
    };
  }

  if (scope === "acp") {
    const sessionId = parts.slice(3).join(":") || undefined;
    return {
      raw,
      canonicalKey,
      agentId,
      transport: "acp",
      sessionId,
      target: sessionId,
      isSubagent: false,
      isKnown: true,
    };
  }

  if (scope === "cron") {
    const jobId = parts.slice(3).join(":") || undefined;
    return {
      raw,
      canonicalKey,
      agentId,
      transport: "cron",
      target: jobId,
      isSubagent: false,
      isKnown: true,
    };
  }

  if (scope === "orphan") {
    const sessionId = parts.slice(3).join(":") || undefined;
    return {
      raw,
      canonicalKey,
      agentId,
      transport: "orphan",
      sessionId,
      target: sessionId,
      isSubagent: false,
      isKnown: true,
    };
  }

  if (parts.length >= 5) {
    const platform = normalizePlatform(parts[2]);
    const transport = parts[3];
    if (transport === "direct" || transport === "group" || transport === "channel") {
      const target = parseTail(parts.slice(4)) || undefined;
      return {
        raw,
        canonicalKey,
        agentId,
        transport,
        platform,
        target,
        isSubagent: false,
        isKnown: true,
      };
    }
  }

  return {
    raw,
    canonicalKey,
    agentId,
    transport: "unknown",
    isSubagent: false,
    isKnown: false,
  };
}

function platformLabel(platform: SessionChannel | undefined): string {
  if (!platform) return "Session";
  const normalized = platform.toLowerCase();
  if (normalized === "feishu") return "Feishu";
  if (normalized === "discord") return "Discord";
  if (normalized === "telegram") return "Telegram";
  if (normalized === "whatsapp") return "WhatsApp";
  if (normalized === "slack") return "Slack";
  if (normalized === "openai") return "OpenAI";
  return platform;
}

export function formatSessionTypeLabel(parsed: ParsedSessionKey): string {
  switch (parsed.transport) {
    case "main":
      return "Main";
    case "cron":
      return "Cron";
    case "subagent":
      return "Subagent";
    case "acp":
      return "ACP";
    case "orphan":
      return "Orphan";
    case "direct":
      return `${platformLabel(parsed.platform)} DM`;
    case "group":
      return `${platformLabel(parsed.platform)} Gruppe`;
    case "channel":
      return `${platformLabel(parsed.platform)} Channel`;
    default:
      return "Unbekannt";
  }
}

export function sessionTypeToKey(parsed: ParsedSessionKey): string {
  if (parsed.transport === "main") return "main";
  if (parsed.transport === "cron") return "cron";
  if (parsed.transport === "subagent") return "subagent";
  if (parsed.transport === "acp") return "acp";
  if (parsed.transport === "orphan") return "orphan";
  if (parsed.transport === "unknown") return "unknown";
  if (parsed.platform) {
    if (parsed.transport === "direct") return `${parsed.platform}-dm`;
    return `${parsed.platform}-${parsed.transport}`;
  }
  return parsed.transport;
}

export function sessionItemFromRecord(sessionKey: string, record: { updatedAt?: number; totalTokens?: number; contextTokens?: number }): SessionItem {
  const parsed = parseSessionKey(sessionKey);
  return {
    key: sessionKey,
    type: sessionTypeToKey(parsed),
    typeLabel: formatSessionTypeLabel(parsed),
    transport: parsed.transport,
    platform: parsed.platform,
    target: parsed.target || "",
    sessionId: (record as { sessionId?: string })?.sessionId || parsed.sessionId,
    updatedAt: record?.updatedAt || 0,
    totalTokens: record?.totalTokens || 0,
    contextTokens: record?.contextTokens || 0,
    isSubagent: parsed.isSubagent,
  };
}

function resolveSessionFilePath(agentId: string, sessionKey: string, record?: SessionsIndex[string]): string | null {
  const fromRecord = record && typeof record.sessionFile === "string" && record.sessionFile.trim() ? record.sessionFile.trim() : "";
  if (fromRecord) return fromRecord;
  const sessionId = resolveSessionIdFromIndex(sessionKey, record ? { [sessionKey]: record } : undefined);
  if (!sessionId) return null;
  return path.join(OPENCLAW_HOME, "agents", agentId, "sessions", `${sessionId}.jsonl`);
}

function readSessionPreview(filePath: string): Pick<SessionItem, "messageCount" | "lastUserMessage" | "lastAssistantMessage" | "lastError" | "lastUserAt" | "lastAssistantAt"> {
  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return {};
  }

  const preview: Pick<SessionItem, "messageCount" | "lastUserMessage" | "lastAssistantMessage" | "lastError" | "lastUserAt" | "lastAssistantAt"> = {
    messageCount: 0,
    lastUserMessage: undefined,
    lastAssistantMessage: undefined,
    lastError: undefined,
    lastUserAt: null,
    lastAssistantAt: null,
  };

  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (entry.type !== "message" || !entry.message || typeof entry.message !== "object") continue;
    preview.messageCount = (preview.messageCount || 0) + 1;
    const msg = entry.message as Record<string, unknown>;
    const role = typeof msg.role === "string" ? msg.role : "";
    const text = normalizePreviewText(msg.content);
    const ts = typeof entry.timestamp === "string" ? Date.parse(entry.timestamp) : 0;

    if (role === "user" && text) {
      preview.lastUserMessage = text;
      preview.lastUserAt = Number.isFinite(ts) ? ts : null;
    }
    if (role === "assistant" && text) {
      preview.lastAssistantMessage = text;
      preview.lastAssistantAt = Number.isFinite(ts) ? ts : null;
    }
    if (typeof msg.errorMessage === "string" && msg.errorMessage.trim()) {
      preview.lastError = normalizePreviewText(msg.errorMessage, 140);
    }
  }

  return preview;
}

export function readSessionsIndex(agentId: string): SessionsIndex {
  const cached = getCachedData(sessionsIndexCache.get(agentId), SESSIONS_INDEX_CACHE_TTL_MS);
  if (cached) return cached;

  const sessionsPath = path.join(OPENCLAW_HOME, "agents", agentId, "sessions", "sessions.json");
  let sessions: SessionsIndex = {};

  try {
    const content = fs.readFileSync(sessionsPath, "utf-8");
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      sessions = parsed as SessionsIndex;
    }
  } catch {
    sessions = {};
  }

  sessionsIndexCache.set(agentId, createCacheEntry(sessions));
  return sessions;
}

export function readSessionItems(agentId: string): SessionItem[] {
  const cached = getCachedData(sessionItemsCache.get(agentId), SESSIONS_INDEX_CACHE_TTL_MS);
  if (cached) return cached;

  const sessionsIndex = readSessionsIndex(agentId);
  const items = Object.entries(sessionsIndex)
    .map(([sessionKey, record]) => {
      const base = sessionItemFromRecord(sessionKey, record);
      const filePath = resolveSessionFilePath(agentId, sessionKey, record);
      const preview = filePath ? readSessionPreview(filePath) : {};
      return {
        ...base,
        ...preview,
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  sessionItemsCache.set(agentId, createCacheEntry(items));
  return items;
}

export function getSubagentSessionIdFromKey(sessionKey: string): string | null {
  const parsed = parseSessionKey(sessionKey);
  return parsed.transport === "subagent" ? parsed.sessionId || null : null;
}

export function resolveSessionIdFromIndex(sessionKey: string, sessionsIndex?: SessionsIndex): string | null {
  const fromIndex = sessionsIndex?.[sessionKey]?.sessionId;
  if (typeof fromIndex === "string" && fromIndex.trim()) return fromIndex.trim();
  return getSubagentSessionIdFromKey(sessionKey);
}

export function normalizeCronLabel(raw: unknown, fallbackKey: string): string {
  if (typeof raw === "string" && raw.trim()) {
    return raw.replace(/^Cron:\s*/i, "").trim() || fallbackKey;
  }
  return fallbackKey;
}

export function inferCronOwnerAgentId(job: CronStoreJob): string {
  if (typeof job.agentId === "string" && job.agentId.trim()) return job.agentId.trim();
  if (typeof job.sessionKey === "string") {
    const parsed = parseSessionKey(job.sessionKey);
    if (parsed.agentId) return parsed.agentId;
  }
  return "main";
}

export function mapCronStatus(status: string | undefined): CronJobStatus {
  const normalized = (status || "").trim().toLowerCase();
  if (normalized === "error" || normalized === "failed") return "failed";
  if (normalized === "running") return "running";
  return "success";
}

export function deriveCronSummaryFromJob(job: CronStoreJob): string | undefined {
  const lastError = typeof job.state?.lastError === "string" ? job.state.lastError.trim() : "";
  if (lastError) return lastError;
  const payloadText =
    typeof job.payload?.message === "string"
      ? job.payload.message
      : typeof job.payload?.text === "string"
        ? job.payload.text
        : "";
  return payloadText ? payloadText.trim() : undefined;
}

export function findCronSessionEntries(sessionsIndex: SessionsIndex, jobId: string): Array<{ sessionKey: string; sessionId: string; updatedAt: number; label?: string }> {
  const entries: Array<{ sessionKey: string; sessionId: string; updatedAt: number; label?: string }> = [];
  for (const [sessionKey, meta] of Object.entries(sessionsIndex)) {
    const parsed = parseSessionKey(sessionKey);
    if (parsed.transport !== "cron" || parsed.target !== jobId) continue;
    if (!meta || typeof meta.sessionId !== "string" || !meta.sessionId.trim()) continue;
    entries.push({
      sessionKey,
      sessionId: meta.sessionId.trim(),
      updatedAt: typeof meta.updatedAt === "number" ? meta.updatedAt : 0,
      label: typeof meta.label === "string" ? meta.label : undefined,
    });
  }
  return entries.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function readCronJobs(): CronStoreJob[] {
  const cronPath = path.join(OPENCLAW_HOME, "cron", "jobs.json");
  const cached = getCachedData(cronJobsCache.get(cronPath), CRON_JOBS_CACHE_TTL_MS);
  if (cached) return cached;

  try {
    const raw = fs.readFileSync(cronPath, "utf-8");
    const parsed = JSON.parse(raw) as { jobs?: CronStoreJob[] };
    const jobs = Array.isArray(parsed.jobs) ? parsed.jobs.filter(Boolean) : [];
    cronJobsCache.set(cronPath, createCacheEntry(jobs));
    return jobs;
  } catch {
    cronJobsCache.set(cronPath, createCacheEntry([]));
    return [];
  }
}
