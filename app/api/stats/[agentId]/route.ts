import { NextResponse } from "next/server";
import { getStatsForAgent } from "@/lib/openclaw-dashboard";

export async function GET(_request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await params;
    return NextResponse.json(getStatsForAgent(agentId));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Agent-Stats konnten nicht geladen werden.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
