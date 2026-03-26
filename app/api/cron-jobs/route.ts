/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  deriveCronSummaryFromJob,
  findCronSessionEntries,
  inferCronOwnerAgentId,
  mapCronStatus,
  normalizeCronLabel,
  readSessionsIndex,
  type CronStoreJob,
  type SessionsIndex,
} from "@/lib/openclaw-domain";
import { OPENCLAW_AGENTS_DIR, OPENCLAW_CONFIG_PATH, OPENCLAW_HOME } from "@/lib/openclaw-paths";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_STORE_PATH = path.join(OPENCLAW_HOME, "cron", "jobs.json");

type CronJobOverviewItem = {
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
  sessionEntries: Array<{
    sessionKey: string;
    sessionId: string;
    updatedAt: number;
    label?: string;
  }>;
};

interface CronJobsOverview {
  source: {
    configPath: string;
    storePath: string;
  };
  totals: {
    jobs: number;
    running: number;
    failed: number;
    success: number;
  };
  jobs: CronJobOverviewItem[];
  byAgent: Record<string, CronJobOverviewItem[]>;
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function listAgentIds(config: any): string[] {
  const configured = Array.isArray(config?.agents?.list)
    ? config.agents.list
        .map((agent: any) => (typeof agent?.id === "string" ? agent.id.trim() : ""))
        .filter(Boolean)
    : [];
  if (configured.length > 0) return configured;

  try {
    return fs.readdirSync(OPENCLAW_AGENTS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return ["main"];
  }
}

function resolveCronStorePath(config: any): string {
  const raw = typeof config?.cron?.store === "string" ? config.cron.store.trim() : "";
  if (!raw) return DEFAULT_STORE_PATH;
  if (raw.startsWith("~")) return path.join(process.env.HOME || "", raw.slice(1));
  if (path.isAbsolute(raw)) return raw;
  return path.join(OPENCLAW_HOME, raw);
}

function coerceCronJobs(raw: unknown): CronStoreJob[] {
  if (Array.isArray(raw)) {
    return raw
      .map((job, index) => coerceCronJob(job, String(index)))
      .filter((job): job is CronStoreJob => Boolean(job));
  }

  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.jobs)) {
    return obj.jobs
      .map((job, index) => coerceCronJob(job, String(index)))
      .filter((job): job is CronStoreJob => Boolean(job));
  }

  if (obj.jobs && typeof obj.jobs === "object") {
    return Object.entries(obj.jobs as Record<string, unknown>)
      .map(([id, job]) => coerceCronJob(job, id))
      .filter((job): job is CronStoreJob => Boolean(job));
  }

  return Object.entries(obj)
    .map(([id, job]) => coerceCronJob(job, id))
    .filter((job): job is CronStoreJob => Boolean(job));
}

function coerceCronJob(raw: unknown, fallbackId: string): CronStoreJob | null {
  if (!raw || typeof raw !== "object") return null;
  const job = raw as Record<string, unknown>;
  const id = typeof job.id === "string" && job.id.trim() ? job.id.trim() : fallbackId.trim();
  if (!id) return null;

  return {
    id,
    agentId: typeof job.agentId === "string" ? job.agentId : undefined,
    sessionKey: typeof job.sessionKey === "string" ? job.sessionKey : undefined,
    name: typeof job.name === "string" ? job.name : undefined,
    enabled: typeof job.enabled === "boolean" ? job.enabled : undefined,
    payload: job.payload && typeof job.payload === "object" ? (job.payload as CronStoreJob["payload"]) : undefined,
    state: job.state && typeof job.state === "object" ? (job.state as CronStoreJob["state"]) : undefined,
  };
}

function getSessionsIndexForAgent(agentId: string): SessionsIndex {
  try {
    return readSessionsIndex(agentId);
  } catch {
    return {};
  }
}

function buildCronJobsOverview(config: any): CronJobsOverview {
  const storePath = resolveCronStorePath(config);
  const raw = fs.existsSync(storePath) ? readJson<unknown>(storePath) : null;
  const jobs = coerceCronJobs(raw);
  const agentIds = listAgentIds(config);
  const sessionsIndexByAgent = new Map<string, SessionsIndex>();
  for (const agentId of agentIds) {
    sessionsIndexByAgent.set(agentId, getSessionsIndexForAgent(agentId));
  }

  const fallbackJobs = new Map<string, CronStoreJob>();
  if (jobs.length === 0) {
    for (const [agentId, sessionsIndex] of sessionsIndexByAgent.entries()) {
      for (const [sessionKey, meta] of Object.entries(sessionsIndex)) {
        if (!sessionKey.includes(":cron:")) continue;
        const jobId = sessionKey.split(":cron:")[1]?.split(":run:")[0]?.trim();
        if (!jobId) continue;
        fallbackJobs.set(`${agentId}:${jobId}`, {
          id: jobId,
          agentId,
          sessionKey,
          name: meta.label || jobId,
          enabled: true,
          state: {
            lastRunAtMs: meta.updatedAt,
            lastStatus: "success",
          },
        });
      }
    }
  }

  const normalizedJobs = (jobs.length > 0 ? jobs : Array.from(fallbackJobs.values())).map((job) => {
    const agentId = inferCronOwnerAgentId(job);
    const sessionsIndex = sessionsIndexByAgent.get(agentId) || {};
    const sessionEntries = findCronSessionEntries(sessionsIndex, job.id);
    const lastRunAt = sessionEntries[0]?.updatedAt || job.state?.lastRunAtMs || 0;
    const nextRunAt = job.state?.nextRunAtMs;
    const status = mapCronStatus(job.state?.lastStatus);
    const running = status === "running";

    return {
      key: `${agentId}:${job.id}`,
      jobId: job.id,
      label: normalizeCronLabel(job.name || sessionEntries[0]?.label, job.id),
      agentId,
      isRunning: running,
      lastRunAt,
      nextRunAt,
      durationMs: job.state?.lastDurationMs,
      lastStatus: status,
      lastSummary: deriveCronSummaryFromJob(job),
      consecutiveFailures: job.state?.consecutiveErrors || 0,
      sessionEntries,
    };
  });

  const byAgent: Record<string, typeof normalizedJobs> = {};
  for (const job of normalizedJobs) {
    if (!byAgent[job.agentId]) byAgent[job.agentId] = [];
    byAgent[job.agentId].push(job);
  }
  for (const jobsForAgent of Object.values(byAgent)) {
    jobsForAgent.sort((a, b) => (b.lastRunAt || 0) - (a.lastRunAt || 0) || a.label.localeCompare(b.label));
  }

  const totals = {
    jobs: normalizedJobs.length,
    running: normalizedJobs.filter((job) => job.isRunning).length,
    failed: normalizedJobs.filter((job) => job.lastStatus === "failed").length,
    success: normalizedJobs.filter((job) => job.lastStatus === "success").length,
  };

  return {
    source: {
      configPath: OPENCLAW_CONFIG_PATH,
      storePath,
    },
    totals,
    jobs: normalizedJobs.sort((a, b) => (b.lastRunAt || 0) - (a.lastRunAt || 0) || a.label.localeCompare(b.label)),
    byAgent,
  };
}

export async function GET() {
  try {
    const config = readJson<any>(OPENCLAW_CONFIG_PATH) || {};
    return NextResponse.json(buildCronJobsOverview(config));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Cron-Übersicht konnte nicht geladen werden.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
