import { NextResponse } from "next/server";
import fs from "fs";
import { OPENCLAW_CONFIG_PATH, OPENCLAW_HOME } from "@/lib/openclaw-paths";

export async function GET() {
  return NextResponse.json({
    ok: true,
    openclawHome: OPENCLAW_HOME,
    configExists: fs.existsSync(OPENCLAW_CONFIG_PATH),
  });
}
