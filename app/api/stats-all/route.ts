import { NextResponse } from "next/server";
import { getAllStats } from "@/lib/openclaw-dashboard";

export async function GET() {
  try {
    return NextResponse.json(getAllStats());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Stats konnten nicht geladen werden.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
