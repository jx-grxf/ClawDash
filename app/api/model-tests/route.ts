import { NextResponse } from "next/server";
import { execOpenclaw, parseJsonFromMixedOutput } from "@/lib/openclaw-cli";
import { getFeatureFlags } from "@/lib/feature-flags";
import type { ModelProbeResult, ModelProbeSummary } from "@/lib/openclaw-types";

interface ProbePayload {
  resolvedDefault?: string;
  defaultModel?: string;
  auth?: {
    probes?: {
      finishedAt?: number;
      durationMs?: number;
      results?: Array<{
        provider?: string;
        model?: string;
        profileId?: string;
        label?: string;
        source?: string;
        mode?: string;
        status?: string;
        latencyMs?: number;
        error?: string;
      }>;
    };
  };
}

interface ProbeEntry {
  provider?: string;
  model?: string;
  profileId?: string;
  label?: string;
  source?: string;
  mode?: string;
  status?: string;
  latencyMs?: number;
  error?: string;
}

function normalizeResult(result: ProbeEntry): ModelProbeResult | null {
  if (!result?.provider || !result?.model) return null;
  return {
    provider: result.provider,
    model: result.model,
    profileId: result.profileId,
    label: result.label,
    source: result.source,
    mode: result.mode,
    status: result.status || "unknown",
    latencyMs: result.latencyMs,
    error: result.error,
  };
}

export async function GET() {
  try {
    if (!getFeatureFlags().enableActiveModelTests) {
      return NextResponse.json({ error: "Active model tests are disabled in ClawDash.", disabled: true, scope: "active-check" }, { status: 403 });
    }
    const { stdout, stderr } = await execOpenclaw(["models", "status", "--probe", "--json", "--probe-timeout", "3000"]);
    const parsed = parseJsonFromMixedOutput(`${stdout}\n${stderr}`) as ProbePayload | null;
    const results = (parsed?.auth?.probes?.results || [])
      .map((result) => normalizeResult(result))
      .filter((result): result is ModelProbeResult => Boolean(result))
      .sort((a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model));

    const summary: ModelProbeSummary = {
      defaultModel: parsed?.resolvedDefault || parsed?.defaultModel || "unknown",
      finishedAt: parsed?.auth?.probes?.finishedAt || Date.now(),
      durationMs: parsed?.auth?.probes?.durationMs || 0,
      results,
    };

    return NextResponse.json(summary);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Model probe failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
