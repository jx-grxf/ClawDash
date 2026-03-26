import { NextResponse } from "next/server";
import { execOpenclaw, parseJsonFromMixedOutput } from "@/lib/openclaw-cli";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { resolveGatewayEndpoints } from "@/lib/gateway-url";
import { getDashboardData } from "@/lib/openclaw-dashboard";
import type { GatewayHealthSummary } from "@/lib/openclaw-types";

interface GatewayStatusPayload {
  rpc?: { ok?: boolean };
  gateway?: { port?: number };
}

export async function GET() {
  const startedAt = Date.now();
  const data = getDashboardData();
  const endpoints = resolveGatewayEndpoints({
    port: data.gateway.port,
    host: data.gateway.host,
    remoteUrl: data.gateway.publicUrl,
    webUrl: data.gateway.publicUrl,
  });

  if (!FEATURE_FLAGS.enableActiveChecks) {
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

  try {
    const [{ stdout: versionStdout }, { stdout, stderr }] = await Promise.all([
      execOpenclaw(["--version"]),
      execOpenclaw(["gateway", "status", "--json", "--timeout", "4000"]),
    ]);

    const parsed = parseJsonFromMixedOutput(`${stdout}\n${stderr}`) as GatewayStatusPayload | null;
    const checkedAt = Date.now();
    const responseMs = checkedAt - startedAt;
    const ok = parsed?.rpc?.ok === true;

    const result: GatewayHealthSummary = {
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
      error: ok ? undefined : "Gateway antwortet nicht sauber.",
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    const checkedAt = Date.now();
    const message = error instanceof Error ? error.message : "Gateway-Check fehlgeschlagen.";
    return NextResponse.json<GatewayHealthSummary>({
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
    });
  }
}
