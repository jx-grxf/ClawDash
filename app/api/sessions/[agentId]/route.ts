import { NextResponse } from "next/server";
import { getAgentSessions } from "@/lib/openclaw-dashboard";
import { getDashboardAccessConfig, redactSessionItem } from "@/lib/dashboard-access";

export async function GET(_request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await params;
    const config = getDashboardAccessConfig();
    const sessions = getAgentSessions(agentId).map((session) => redactSessionItem(session));
    return NextResponse.json({ agentId, privacyMode: config.privacyMode, sessions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sessions konnten nicht geladen werden.";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
