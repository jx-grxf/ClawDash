export type AgentState = "working" | "online" | "idle" | "offline";
export type SessionTransport = "main" | "direct" | "group" | "channel" | "cron" | "subagent" | "acp" | "orphan" | "unknown";

export interface AgentSummary {
  id: string;
  name: string;
  emoji: string;
  model: string;
  sessionCount: number;
  totalTokens: number;
  lastActive: number | null;
  platforms: string[];
  state: AgentState;
}

export interface ProviderModelSummary {
  id: string;
  name: string;
}

export interface ProviderSummary {
  id: string;
  api?: string;
  models: ProviderModelSummary[];
  usedBy: string[];
}

export interface DashboardData {
  agents: AgentSummary[];
  providers: ProviderSummary[];
  defaults: {
    model: string;
    fallbacks: string[];
  };
  gateway: {
    port: number;
    host?: string;
    hasToken: boolean;
    localUrl?: string;
    publicUrl?: string;
    healthUrl?: string;
    source?: "local_bind" | "remote_url" | "host_override" | "fallback";
  };
}

export interface SessionItem {
  key: string;
  type: string;
  typeLabel: string;
  transport: SessionTransport;
  platform?: string;
  target: string;
  sessionId?: string;
  updatedAt: number;
  totalTokens: number;
  contextTokens: number;
  isSubagent: boolean;
  messageCount?: number;
  avgResponseMs?: number;
  lastUserMessage?: string;
  lastAssistantMessage?: string;
  lastError?: string;
  lastUserAt?: number | null;
  lastAssistantAt?: number | null;
}

export interface DayStat {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  messageCount: number;
  avgResponseMs: number;
}

export interface AllStats {
  daily: DayStat[];
  weekly: DayStat[];
  monthly: DayStat[];
  byAgent?: StatsBreakdownItem[];
  byModel?: StatsBreakdownItem[];
  rolling?: {
    responseMs7d: number;
    tokens7d: number;
    messages7d: number;
  };
}

export interface AgentStats extends AllStats {
  agentId: string;
}

export interface StatsBreakdownItem {
  id: string;
  label: string;
  totalTokens: number;
  messageCount: number;
  avgResponseMs: number;
  daysWithData: number;
}

export interface ModelProbeResult {
  provider: string;
  model: string;
  profileId?: string;
  label?: string;
  source?: string;
  mode?: string;
  status: string;
  latencyMs?: number;
  error?: string;
}

export interface ModelProbeSummary {
  defaultModel: string;
  finishedAt: number;
  durationMs: number;
  results: ModelProbeResult[];
}

export interface GatewayHealthSummary {
  ok: boolean;
  status: "healthy" | "degraded" | "down";
  checkedAt: number;
  responseMs: number;
  openclawVersion?: string;
  error?: string;
  port?: number;
  host?: string;
  webUrl?: string;
  localUrl?: string;
  publicUrl?: string;
  healthSource?: "local_bind" | "remote_url" | "host_override" | "fallback";
}
