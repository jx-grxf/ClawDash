import { NextResponse } from "next/server";
import { getCliMetadata } from "@/lib/openclaw-cli-metadata";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const pathParam = url.searchParams.get("path") || "";
    const args = pathParam ? pathParam.split(" ").filter(Boolean) : [];
    const metadata = await getCliMetadata(args);
    return NextResponse.json(metadata);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "CLI metadata could not be loaded.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

