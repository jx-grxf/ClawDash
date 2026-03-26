/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { execOpenclaw } from "@/lib/openclaw-cli";
import { createCacheEntry, getCachedData, type CacheEntry } from "@/lib/server-cache";

const REPO = process.env.OPENCLAW_REPO || "openclaw/openclaw";

// Server-side cache: 1h TTL
let cache: CacheEntry<{ tag: string; name: string; publishedAt: string; body: string; htmlUrl: string }> | null = null;
const CACHE_TTL = 60 * 60 * 1000;
const REVALIDATE_SECONDS = 60 * 60;

async function fetchLatestRelease(forceLatest = false) {
  if (!FEATURE_FLAGS.enableExternalFetches) {
    const { stdout } = await execOpenclaw(["--version"]);
    return {
      tag: stdout.trim() || "local",
      name: "Local OpenClaw",
      publishedAt: new Date().toISOString(),
      body: "External release fetch disabled.",
      htmlUrl: "",
      source: "local",
      disabled: true,
    };
  }
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
    ...(forceLatest ? { cache: "no-store" as const } : { next: { revalidate: REVALIDATE_SECONDS } }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  return {
    tag: data.tag_name,
    name: data.name || data.tag_name,
    publishedAt: data.published_at,
    body: data.body || "",
    htmlUrl: data.html_url,
    source: "github",
  };
}

export async function GET(request: Request) {
  try {
    const forceLatest = new URL(request.url).searchParams.get("force") === "1";
    const cached = !forceLatest ? getCachedData(cache, CACHE_TTL) : null;
    if (cached) {
      return NextResponse.json(cached);
    }
    const data = await fetchLatestRelease(forceLatest);
    cache = createCacheEntry(data);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
