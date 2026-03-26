import fs from "fs";
import path from "path";
import { maskSensitiveValue } from "@/lib/dashboard-access";
import { getFeatureFlags } from "@/lib/feature-flags";
import { resolveGatewayEndpoints } from "@/lib/gateway-url";
import { readSessionItems } from "@/lib/openclaw-domain";
import { OPENCLAW_CONFIG_PATH, OPENCLAW_HOME } from "@/lib/openclaw-paths";
import type {
  AgentStats,
  AgentState,
  AgentSummary,
  AllStats,
  DashboardData,
  DayStat,
  ProviderSummary,
  SessionItem,
  StatsBreakdownItem,
} from "@/lib/openclaw-types";

interface IdentityLike {
  name?: string;
  emoji?: string;
}

interface AgentConfig {
  id: string;
  name?: string;
  model?: string | { primary?: string };
  identity?: IdentityLike;
}

interface ModelConfig {
  id: string;
  name?: string;
}

interface ProviderConfig {
  api?: string;
  models?: ModelConfig[];
}

interface DashboardConfig {
  agents?: {
    defaults?: {
      model?: string | { primary?: string; fallbacks?: string[] };
    };
    list?: AgentConfig[];
  };
  bindings?: Array<{
    agentId?: string;
    match?: {
      channel?: string;
    };
  }>;
  channels?: Record<string, { enabled?: boolean }>;
  models?: {
    providers?: Record<string, ProviderConfig>;
  };
  gateway?: {
    port?: number;
    host?: string;
    hostname?: string;
    bind?: string;
    remote?: {
      url?: string;
    };
    web?: {
      url?: string;
    };
    auth?: {
      token?: string;
    };
  };
}

interface AgentModelsConfig {
  providers?: Record<string, ProviderConfig>;
}

interface LogMessage {
  role: string;
  ts: string;
  stopReason?: string;
  model?: string;
  text?: string;
}

interface InternalDayStat extends DayStat {
  responseTimes: number[];
}

let statsCache: { all: AllStats; byAgent: Record<string, AgentStats>; ts: number } | null = null;
const STATS_CACHE_TTL_MS = 30_000;
let dashboardCache: { data: DashboardData; ts: number } | null = null;
const DASHBOARD_CACHE_TTL_MS = 10_000;
const HIDDEN_AGENT_IDS = new Set(["codex"]);

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function safeReadJsonFile<T>(filePath: string): T | null {
  try {
    return readJsonFile<T>(filePath);
  } catch {
    return null;
  }
}

function listAgentDirectories(): string[] {
  const agentsDir = path.join(OPENCLAW_HOME, "agents");
  try {
    return fs.readdirSync(agentsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .filter((agentId) => !HIDDEN_AGENT_IDS.has(agentId))
      .sort();
  } catch {
    return [];
  }
}

function readIdentityName(agentId: string): string | null {
  const candidates = [
    path.join(OPENCLAW_HOME, "agents", agentId, "agent", "IDENTITY.md"),
    path.join(OPENCLAW_HOME, `workspace-${agentId}`, "IDENTITY.md"),
    agentId === "main" ? path.join(OPENCLAW_HOME, "workspace", "IDENTITY.md") : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const content = fs.readFileSync(candidate, "utf-8");
      const match = content.match(/\*\*Name:\*\*\s*(.+)/);
      if (match?.[1]) return match[1].trim();
    } catch {}
  }

  return null;
}

function readAgentModelsProviders(): Record<string, ProviderConfig> {
  const modelsPath = path.join(OPENCLAW_HOME, "agents", "main", "agent", "models.json");
  const models = safeReadJsonFile<AgentModelsConfig>(modelsPath);
  return models?.providers || {};
}

function resolveAgentState(lastActive: number | null): AgentState {
  if (!lastActive) return "offline";
  const diff = Date.now() - lastActive;
  if (diff < 3 * 60 * 1000) return "working";
  if (diff < 10 * 60 * 1000) return "online";
  if (diff < 24 * 60 * 60 * 1000) return "idle";
  return "offline";
}

function getPlatformNames(agentId: string, config: DashboardConfig): string[] {
  const platforms = new Set<string>();
  const bindings = Array.isArray(config.bindings) ? config.bindings : [];
  const channels: Record<string, { enabled?: boolean }> = config.channels ?? {};

  for (const binding of bindings) {
    if (binding?.agentId !== agentId) continue;
    const channel = binding?.match?.channel;
    if (typeof channel === "string" && channel.trim()) platforms.add(channel);
  }

  if (agentId === "main") {
    for (const [channelName, channelConfig] of Object.entries(channels)) {
      if (channelConfig.enabled !== false) platforms.add(channelName);
    }
  }

  return Array.from(platforms).sort();
}

function readDashboardConfig(): DashboardConfig {
  return safeReadJsonFile<DashboardConfig>(OPENCLAW_CONFIG_PATH) || {};
}

function maybeMask(value: string): string {
  return getFeatureFlags().enablePrivacyMode ? maskSensitiveValue(value) : value;
}

function summarizeText(value: string | undefined, maxLength = 96): string | undefined {
  if (!value) return undefined;
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return undefined;
  const masked = getFeatureFlags().enablePrivacyMode ? maskSensitiveValue(compact, 8, 0) : compact;
  return masked.length > maxLength ? `${masked.slice(0, maxLength - 1)}...` : masked;
}

function extractMessageText(content: unknown): string | undefined {
  if (typeof content === "string") return summarizeText(content);
  if (!Array.isArray(content)) return undefined;
  const text = content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const value = (block as { text?: unknown }).text;
      return typeof value === "string" ? value : "";
    })
    .filter(Boolean)
    .join(" ");
  return summarizeText(text);
}

function collectModelReferences(config: DashboardConfig, agentList: AgentConfig[], defaultModel: string, fallbacks: string[]): Set<string> {
  const refs = new Set<string>();
  if (defaultModel) refs.add(defaultModel);
  for (const fallback of fallbacks) refs.add(fallback);
  for (const agent of agentList) {
    const modelValue = typeof agent.model === "string" ? agent.model : agent.model?.primary;
    if (modelValue) refs.add(modelValue);
  }
  return refs;
}

function buildProviders(config: DashboardConfig, agents: AgentSummary[], agentList: AgentConfig[], defaultModel: string, fallbacks: string[]): ProviderSummary[] {
  const combinedProviders = {
    ...(config.models?.providers || {}),
    ...readAgentModelsProviders(),
  };
  const providers = new Map<string, ProviderSummary>();

  for (const [providerId, provider] of Object.entries(combinedProviders)) {
    providers.set(providerId, {
      id: providerId,
      api: provider.api,
      models: Array.isArray(provider.models)
        ? provider.models.map((model) => ({ id: model.id, name: model.name || model.id }))
        : [],
      usedBy: agents.filter((agent) => agent.model.startsWith(`${providerId}/`)).map((agent) => agent.id),
    });
  }

  for (const modelRef of collectModelReferences(config, agentList, defaultModel, fallbacks)) {
    const slashIndex = modelRef.indexOf("/");
    if (slashIndex <= 0) continue;
    const providerId = modelRef.slice(0, slashIndex);
    const modelId = modelRef.slice(slashIndex + 1);
    const existing = providers.get(providerId);
    if (!existing) {
      providers.set(providerId, {
        id: providerId,
        api: undefined,
        models: [{ id: modelId, name: modelId }],
        usedBy: agents.filter((agent) => agent.model.startsWith(`${providerId}/`)).map((agent) => agent.id),
      });
      continue;
    }
    if (!existing.models.some((model) => model.id === modelId)) {
      existing.models.push({ id: modelId, name: modelId });
    }
  }

  return Array.from(providers.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function parseJsonlStats(filePath: string, dayMap: Record<string, InternalDayStat>): void {
  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return;
  }
  if (!content.trim()) return;

  const lines = content.trim().split("\n");
  const messages: LogMessage[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as {
        type?: string;
        timestamp?: string;
        message?: {
          role?: string;
          stopReason?: string;
          usage?: {
            input?: number;
            output?: number;
            totalTokens?: number;
          };
        };
      };
      if (entry.type !== "message" || !entry.timestamp || !entry.message?.role) continue;

      const date = entry.timestamp.slice(0, 10);
      if (!dayMap[date]) {
        dayMap[date] = {
          date,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          messageCount: 0,
          avgResponseMs: 0,
          responseTimes: [],
        };
      }

      messages.push({
        role: entry.message.role,
        ts: entry.timestamp,
        stopReason: entry.message.stopReason,
        model: typeof (entry.message as { model?: unknown }).model === "string" ? (entry.message as { model: string }).model : undefined,
        text: extractMessageText((entry.message as { content?: unknown }).content),
      });

      if (entry.message.role === "assistant" && entry.message.usage) {
        dayMap[date].inputTokens += entry.message.usage.input || 0;
        dayMap[date].outputTokens += entry.message.usage.output || 0;
        dayMap[date].totalTokens += entry.message.usage.totalTokens || ((entry.message.usage.input || 0) + (entry.message.usage.output || 0));
        dayMap[date].messageCount += 1;
      }
    } catch {}
  }

  let lastUserTs: string | null = null;
  for (const message of messages) {
    if (message.role === "user") {
      lastUserTs = message.ts;
      continue;
    }
    if (message.role === "assistant" && message.stopReason === "stop" && lastUserTs) {
      const diffMs = new Date(message.ts).getTime() - new Date(lastUserTs).getTime();
      if (diffMs > 0 && diffMs < 10 * 60 * 1000) {
        const date = lastUserTs.slice(0, 10);
        if (!dayMap[date]) {
          dayMap[date] = {
            date,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            messageCount: 0,
            avgResponseMs: 0,
            responseTimes: [],
          };
        }
        dayMap[date].responseTimes.push(diffMs);
      }
      lastUserTs = null;
    }
  }
}

interface SessionTranscriptSummary {
  messageCount: number;
  avgResponseMs: number;
  lastUserMessage?: string;
  lastAssistantMessage?: string;
  lastUserAt?: number | null;
  lastAssistantAt?: number | null;
}

function summarizeSessionTranscript(agentId: string, session: SessionItem): SessionTranscriptSummary | null {
  if (!session.sessionId) return null;
  const filePath = path.join(OPENCLAW_HOME, "agents", agentId, "sessions", `${session.sessionId}.jsonl`);
  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
  if (!content.trim()) return null;

  const lines = content.trim().split("\n");
  let lastUserMessage: string | undefined;
  let lastAssistantMessage: string | undefined;
  let lastUserAt: number | null = null;
  let lastAssistantAt: number | null = null;
  let lastUserTs: string | null = null;
  let responseTotal = 0;
  let responseCount = 0;
  let messageCount = 0;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as {
        type?: string;
        timestamp?: string;
        message?: {
          role?: string;
          stopReason?: string;
          content?: unknown;
        };
      };
      if (entry.type !== "message" || !entry.timestamp || !entry.message?.role) continue;
      const role = entry.message.role;
      const at = Date.parse(entry.timestamp);
      messageCount += 1;

      if (role === "user") {
        lastUserTs = entry.timestamp;
        lastUserAt = Number.isFinite(at) ? at : lastUserAt;
        lastUserMessage = extractMessageText(entry.message.content) || lastUserMessage;
      }

      if (role === "assistant") {
        lastAssistantAt = Number.isFinite(at) ? at : lastAssistantAt;
        lastAssistantMessage = extractMessageText(entry.message.content) || lastAssistantMessage;
        if (entry.message.stopReason === "stop" && lastUserTs) {
          const diffMs = Date.parse(entry.timestamp) - Date.parse(lastUserTs);
          if (diffMs > 0 && diffMs < 10 * 60 * 1000) {
            responseTotal += diffMs;
            responseCount += 1;
          }
          lastUserTs = null;
        }
      }
    } catch {}
  }

  return {
    messageCount,
    avgResponseMs: responseCount > 0 ? Math.round(responseTotal / responseCount) : 0,
    lastUserMessage,
    lastAssistantMessage,
    lastUserAt,
    lastAssistantAt,
  };
}

function finalizeDayStats(dayMap: Record<string, InternalDayStat>): DayStat[] {
  return Object.values(dayMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ responseTimes, ...rest }) => ({
      ...rest,
      avgResponseMs: responseTimes.length > 0
        ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
        : 0,
    }));
}

function aggregateToWeeklyMonthly(daily: DayStat[]): Pick<AllStats, "weekly" | "monthly"> {
  const weekMap: Record<string, DayStat> = {};
  const monthMap: Record<string, DayStat> = {};

  for (const day of daily) {
    const dt = new Date(`${day.date}T00:00:00Z`);
    const utcDay = dt.getUTCDay();
    const mondayOffset = utcDay === 0 ? -6 : 1 - utcDay;
    const monday = new Date(dt.getTime() + mondayOffset * 86400000);
    const weekKey = monday.toISOString().slice(0, 10);
    const monthKey = day.date.slice(0, 7);

    if (!weekMap[weekKey]) {
      weekMap[weekKey] = {
        date: weekKey,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        messageCount: 0,
        avgResponseMs: 0,
      };
    }
    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {
        date: monthKey,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        messageCount: 0,
        avgResponseMs: 0,
      };
    }

    for (const bucket of [weekMap[weekKey], monthMap[monthKey]]) {
      bucket.inputTokens += day.inputTokens;
      bucket.outputTokens += day.outputTokens;
      bucket.totalTokens += day.totalTokens;
      bucket.messageCount += day.messageCount;
    }
  }

  return {
    weekly: Object.values(weekMap).sort((a, b) => a.date.localeCompare(b.date)),
    monthly: Object.values(monthMap).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function buildStatsPayload(agentId: string, dayMap: Record<string, InternalDayStat>): AgentStats {
  const daily = finalizeDayStats(dayMap);
  const { weekly, monthly } = aggregateToWeeklyMonthly(daily);
  const trailing = daily.slice(-7);
  return {
    agentId,
    daily,
    weekly,
    monthly,
    rolling: {
      responseMs7d: trailing.length > 0 ? Math.round(trailing.reduce((sum, day) => sum + day.avgResponseMs, 0) / trailing.length) : 0,
      tokens7d: trailing.reduce((sum, day) => sum + day.totalTokens, 0),
      messages7d: trailing.reduce((sum, day) => sum + day.messageCount, 0),
    },
  };
}

function buildBreakdownItems(entries: Map<string, { label: string; totalTokens: number; messageCount: number; responseTotal: number; responseCount: number; days: Set<string> }>): StatsBreakdownItem[] {
  return Array.from(entries.entries())
    .map(([id, item]) => ({
      id,
      label: item.label,
      totalTokens: item.totalTokens,
      messageCount: item.messageCount,
      avgResponseMs: item.responseCount > 0 ? Math.round(item.responseTotal / item.responseCount) : 0,
      daysWithData: item.days.size,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens || a.label.localeCompare(b.label));
}

function accumulateBreakdown(
  store: Map<string, { label: string; totalTokens: number; messageCount: number; responseTotal: number; responseCount: number; days: Set<string> }>,
  key: string,
  label: string,
  day: DayStat,
): void {
  const current = store.get(key) || {
    label,
    totalTokens: 0,
    messageCount: 0,
    responseTotal: 0,
    responseCount: 0,
    days: new Set<string>(),
  };
  current.totalTokens += day.totalTokens;
  current.messageCount += day.messageCount;
  if (day.avgResponseMs > 0) {
    current.responseTotal += day.avgResponseMs;
    current.responseCount += 1;
  }
  if (day.messageCount > 0) current.days.add(day.date);
  store.set(key, current);
}

function readAgentJsonlStats(agentId: string): AgentStats {
  const sessionsDir = path.join(OPENCLAW_HOME, "agents", agentId, "sessions");
  const dayMap: Record<string, InternalDayStat> = {};

  let files: string[] = [];
  try {
    files = fs.readdirSync(sessionsDir).filter((file) => file.endsWith(".jsonl") && !file.includes(".deleted."));
  } catch {
    return { agentId, daily: [], weekly: [], monthly: [] };
  }

  for (const file of files) {
    parseJsonlStats(path.join(sessionsDir, file), dayMap);
  }

  return buildStatsPayload(agentId, dayMap);
}

function ensureStatsCache(): { all: AllStats; byAgent: Record<string, AgentStats>; ts: number } {
  if (statsCache && Date.now() - statsCache.ts < STATS_CACHE_TTL_MS) return statsCache;

  const agentIds = listAgentDirectories();
  const byAgent: Record<string, AgentStats> = {};
  const aggregateMap: Record<string, InternalDayStat> = {};
  const byAgentBreakdown = new Map<string, { label: string; totalTokens: number; messageCount: number; responseTotal: number; responseCount: number; days: Set<string> }>();
  const byModelBreakdown = new Map<string, { label: string; totalTokens: number; messageCount: number; responseTotal: number; responseCount: number; days: Set<string> }>();
  const dashboard = readDashboardConfig();
  const configuredAgents = new Map<string, string>(
    (dashboard.agents?.list || [])
      .filter((agent): agent is AgentConfig => Boolean(agent?.id))
      .map((agent) => [agent.id, readIdentityName(agent.id) || agent.identity?.name || agent.name || agent.id]),
  );

  for (const agentId of agentIds) {
    const stats = readAgentJsonlStats(agentId);
    byAgent[agentId] = stats;
    for (const day of stats.daily) {
      accumulateBreakdown(byAgentBreakdown, agentId, configuredAgents.get(agentId) || agentId, day);
    }

    const modelRef = (dashboard.agents?.list || []).find((agent) => agent.id === agentId)?.model;
    const modelId = typeof modelRef === "string" ? modelRef : modelRef?.primary || "unknown";
    for (const day of stats.daily) {
      accumulateBreakdown(byModelBreakdown, modelId, modelId, day);
    }

    for (const day of stats.daily) {
      if (!aggregateMap[day.date]) {
        aggregateMap[day.date] = {
          ...day,
          responseTimes: day.avgResponseMs > 0 ? [day.avgResponseMs] : [],
        };
      } else {
        aggregateMap[day.date].inputTokens += day.inputTokens;
        aggregateMap[day.date].outputTokens += day.outputTokens;
        aggregateMap[day.date].totalTokens += day.totalTokens;
        aggregateMap[day.date].messageCount += day.messageCount;
        if (day.avgResponseMs > 0) aggregateMap[day.date].responseTimes.push(day.avgResponseMs);
      }
    }
  }

  const daily = finalizeDayStats(aggregateMap);
  const { weekly, monthly } = aggregateToWeeklyMonthly(daily);
  const trailing = daily.slice(-7);
  statsCache = {
    all: {
      daily,
      weekly,
      monthly,
      byAgent: buildBreakdownItems(byAgentBreakdown),
      byModel: buildBreakdownItems(byModelBreakdown),
      rolling: {
        responseMs7d: trailing.length > 0 ? Math.round(trailing.reduce((sum, day) => sum + day.avgResponseMs, 0) / trailing.length) : 0,
        tokens7d: trailing.reduce((sum, day) => sum + day.totalTokens, 0),
        messages7d: trailing.reduce((sum, day) => sum + day.messageCount, 0),
      },
    },
    byAgent,
    ts: Date.now(),
  };
  return statsCache;
}

export function getDashboardData(): DashboardData {
  if (dashboardCache && Date.now() - dashboardCache.ts < DASHBOARD_CACHE_TTL_MS) {
    return dashboardCache.data;
  }

  const config = readDashboardConfig();
  const defaults = config.agents?.defaults || {};
  const defaultModelConfig = defaults.model;
  const defaultModel = typeof defaultModelConfig === "string" ? defaultModelConfig : defaultModelConfig?.primary || "unknown";
  const fallbacks = typeof defaultModelConfig === "object" && Array.isArray(defaultModelConfig.fallbacks) ? defaultModelConfig.fallbacks : [];

  let agentList: AgentConfig[] = Array.isArray(config.agents?.list) ? config.agents.list : [];
  agentList = agentList.filter((agent) => !HIDDEN_AGENT_IDS.has(agent.id));
  if (agentList.length === 0) agentList = listAgentDirectories().map((id) => ({ id }));
  if (agentList.length === 0) agentList = [{ id: "main" }];

  const agents: AgentSummary[] = agentList.map((agent) => {
    const id = agent.id;
    const sessions = readSessionItems(id);
    const lastActive = sessions[0]?.updatedAt || null;
    const totalTokens = sessions.reduce((sum, session) => sum + session.totalTokens, 0);
    const modelValue = typeof agent.model === "string" ? agent.model : agent.model?.primary || defaultModel;

    return {
      id,
      name: readIdentityName(id) || agent.identity?.name || agent.name || id,
      emoji: agent.identity?.emoji || "🤖",
      model: modelValue || defaultModel,
      sessionCount: sessions.length,
      totalTokens,
      lastActive,
      platforms: getPlatformNames(id, config),
      state: resolveAgentState(lastActive),
    };
  });

  const data = {
    agents,
    providers: buildProviders(config, agents, agentList, defaultModel, fallbacks),
    defaults: {
      model: defaultModel,
      fallbacks,
    },
    gateway: {
      hasToken: Boolean(config.gateway?.auth?.token),
      ...resolveGatewayEndpoints({
        port: config.gateway?.port,
        host: config.gateway?.host || config.gateway?.hostname,
        bind: config.gateway?.bind,
        remoteUrl: config.gateway?.remote?.url,
        webUrl: config.gateway?.web?.url,
      }),
    },
  };

  dashboardCache = { data, ts: Date.now() };
  return data;
}

export function getAgentSessions(agentId: string): SessionItem[] {
  return readSessionItems(agentId).map((session) => {
    const transcript = summarizeSessionTranscript(agentId, session);
    return {
      ...session,
      key: maybeMask(session.key),
      target: maybeMask(session.target),
      sessionId: session.sessionId ? maybeMask(session.sessionId) : session.sessionId,
      lastError: summarizeText(session.lastError, 140),
      lastUserMessage: transcript?.lastUserMessage,
      lastAssistantMessage: transcript?.lastAssistantMessage,
      avgResponseMs: transcript?.avgResponseMs || 0,
      messageCount: transcript?.messageCount || 0,
      lastUserAt: transcript?.lastUserAt,
      lastAssistantAt: transcript?.lastAssistantAt,
    };
  });
}

export function getAllStats(): AllStats {
  return ensureStatsCache().all;
}

export function getStatsForAgent(agentId: string): AgentStats {
  return ensureStatsCache().byAgent[agentId] || { agentId, daily: [], weekly: [], monthly: [] };
}
