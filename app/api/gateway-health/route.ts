import { NextResponse } from "next/server";
import { execOpenclaw, parseJsonFromMixedOutput } from "@/lib/openclaw-cli";
import { getFeatureFlags } from "@/lib/feature-flags";
import { resolveGatewayEndpoints } from "@/lib/gateway-url";
import { getDashboardData } from "@/lib/openclaw-dashboard";
import type { GatewayHealthSummary } from "@/lib/openclaw-types";

interface GatewayStatusPayload {
  rpc?: { ok?: boolean };
  gateway?: { port?: number };
}

const GATEWAY_HEALTH_CACHE_TTL_MS = 5_000;

let cachedGatewayHealth:
  | {
      value: GatewayHealthSummary;
      expiresAt: number;
    }
  | null = null;
let inFlightGatewayHealth: Promise<GatewayHealthSummary> | null = null;

async function computeGatewayHealthSummary(
  endpoints: ReturnType<typeof resolveGatewayEndpoints>,
): Promise<GatewayHealthSummary> {
  const startedAt = Date.now();
  try {
    const [{ stdout: versionStdout }, { stdout, stderr }] = await Promise.all([
      execOpenclaw(["--version"]),
      execOpenclaw(["gateway", "status", "--json", "--timeout", "4000"]),
    ]);

    const parsed = parseJsonFromMixedOutput(`${stdout}\n${stderr}`) as GatewayStatusPayload | null;
    const checkedAt = Date.now();
    const responseMs = checkedAt - startedAt;
    const ok = parsed?.rpc?.ok === true;

    return {
      ok,
      status: ok ? (responseMs > 1800 ? "degraded" : "healthy") : "down",
      checkedAt,
      responseMs,
      openclawVersion: versionStdout.trim() || undefined,
      port: parsed?.gateway?.port || endpoints.port,
      host: endpoints.host,
      webUrl: endpoints.healthUrl,
      localUrl: endpoints.localUrl,
      publicUrl: endpoints.publicUrl,
      healthSource: endpoints.source,
      error: ok ? undefined : "Gateway did not respond cleanly.",
    };
  } catch (error: unknown) {
    const checkedAt = Date.now();
    const message = error instanceof Error ? error.message : "Gateway check failed.";
    return {
      ok: false,
      status: "down",
      checkedAt,
      responseMs: checkedAt - startedAt,
      error: message,
      port: endpoints.port,
      host: endpoints.host,
      webUrl: endpoints.healthUrl,
      localUrl: endpoints.localUrl,
      publicUrl: endpoints.publicUrl,
      healthSource: endpoints.source,
    };
  }
}

export async function GET() {
  const featureFlags = getFeatureFlags();
  const data = getDashboardData();
  const endpoints = resolveGatewayEndpoints({
    port: data.gateway.port,
    host: data.gateway.host,
    remoteUrl: data.gateway.publicUrl,
    webUrl: data.gateway.publicUrl,
  });

  if (!featureFlags.enableActiveChecks) {
    return NextResponse.json<GatewayHealthSummary>({
      ok: true,
      status: "healthy",
      checkedAt: Date.now(),
      responseMs: 0,
      openclawVersion: undefined,
      port: endpoints.port,
      host: endpoints.host,
      webUrl: endpoints.healthUrl,
      localUrl: endpoints.localUrl,
      publicUrl: endpoints.publicUrl,
      healthSource: endpoints.source,
      error: "Active gateway checks are disabled by feature flag.",
    });
  }

  const now = Date.now();
  if (cachedGatewayHealth && cachedGatewayHealth.expiresAt > now) {
    return NextResponse.json(cachedGatewayHealth.value);
  }

  if (!inFlightGatewayHealth) {
    inFlightGatewayHealth = computeGatewayHealthSummary(endpoints).finally(() => {
      inFlightGatewayHealth = null;
    });
  }

  const result = await inFlightGatewayHealth;
  cachedGatewayHealth = {
    value: result,
    expiresAt: Date.now() + GATEWAY_HEALTH_CACHE_TTL_MS,
  };

  return NextResponse.json(result);
}
