import { NextResponse } from "next/server";
import { isTrustedSameOriginRequest } from "@/lib/dashboard-access";
import {
  getClawDashSettings,
  getDefaultSettings,
  getSettingsDisplayPath,
  saveClawDashSettings,
  type ClawDashSettings,
} from "@/lib/feature-flags";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const settings = getClawDashSettings();
  return NextResponse.json({
    settings,
    defaults: getDefaultSettings(),
    path: getSettingsDisplayPath(),
  });
}

export async function PUT(request: Request) {
  try {
    if (!isTrustedSameOriginRequest(request)) {
      return NextResponse.json({ ok: false, error: "Cross-origin settings writes are not allowed." }, { status: 403 });
    }
    const body = (await request.json()) as Partial<ClawDashSettings>;
    const current = getClawDashSettings();
    const saved = saveClawDashSettings({
      featureFlags: {
        ...current.featureFlags,
        ...(body.featureFlags || {}),
      },
      runtime: {
        ...current.runtime,
        ...(body.runtime || {}),
      },
    });
    return NextResponse.json({ ok: true, settings: saved, path: getSettingsDisplayPath() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save settings.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
