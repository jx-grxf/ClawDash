import { NextResponse } from "next/server";
import { runOpenclaw } from "@/lib/openclaw-cli";
import { type CliRiskTier, sanitizeCliArgs } from "@/lib/openclaw-cli-metadata";

const RISK_TIMEOUT_MS: Record<CliRiskTier, number> = {
  read_only: 10_000,
  active_local: 20_000,
  state_mutating: 25_000,
  external_side_effect: 25_000,
  dangerous: 15_000,
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      args?: unknown;
      riskTier?: CliRiskTier;
      confirmed?: boolean;
    };
    const args = sanitizeCliArgs(body.args);
    const riskTier = body.riskTier || "read_only";
    const needsConfirmation = riskTier === "state_mutating" || riskTier === "external_side_effect" || riskTier === "dangerous";

    if (needsConfirmation && body.confirmed !== true) {
      return NextResponse.json(
        { error: "Confirmation required for this command.", needsConfirmation: true },
        { status: 400 },
      );
    }

    const result = await runOpenclaw(args, RISK_TIMEOUT_MS[riskTier] || 20_000);
    return NextResponse.json({
      ...result,
      riskTier,
      status: result.timedOut ? "timeout" : result.exitCode === 0 ? "success" : "error",
      stdoutTruncated: result.stdout.length > 24_000,
      stderrTruncated: result.stderr.length > 24_000,
      stdoutPreview: result.stdout.slice(0, 24_000),
      stderrPreview: result.stderr.slice(0, 24_000),
      ranAt: Date.now(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "CLI command could not be executed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

