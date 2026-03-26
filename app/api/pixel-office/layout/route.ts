import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { isTrustedSameOriginRequest } from '@/lib/dashboard-access'
import { OPENCLAW_PIXEL_OFFICE_DIR } from '@/lib/openclaw-paths'
import { getFeatureFlags } from '@/lib/feature-flags'

const LAYOUT_DIR = OPENCLAW_PIXEL_OFFICE_DIR
const LAYOUT_FILE = path.join(LAYOUT_DIR, 'layout.json')

export async function GET() {
  const featureFlags = getFeatureFlags()
  try {
    if (!fs.existsSync(LAYOUT_FILE)) {
      return NextResponse.json({ layout: null, writable: featureFlags.enableLayoutWrite })
    }
    const data = fs.readFileSync(LAYOUT_FILE, 'utf-8')
    const layout = JSON.parse(data)
    return NextResponse.json({ layout, writable: featureFlags.enableLayoutWrite })
  } catch {
    return NextResponse.json({ layout: null, writable: featureFlags.enableLayoutWrite })
  }
}

export async function POST(request: Request) {
  try {
    if (!isTrustedSameOriginRequest(request)) {
      return NextResponse.json({ error: "Cross-origin layout writes are not allowed." }, { status: 403 })
    }
    if (!getFeatureFlags().enableLayoutWrite) {
      return NextResponse.json({ error: "Layout write access is disabled.", disabled: true, scope: "local-write" }, { status: 403 })
    }
    const { layout } = await request.json()
    if (!layout || layout.version !== 1 || !Array.isArray(layout.tiles)) {
      return NextResponse.json({ error: 'Invalid layout' }, { status: 400 })
    }

    // Ensure directory exists
    if (!fs.existsSync(LAYOUT_DIR)) {
      fs.mkdirSync(LAYOUT_DIR, { recursive: true })
    }

    // Atomic write: write to .tmp then rename
    const tmpFile = LAYOUT_FILE + '.tmp'
    fs.writeFileSync(tmpFile, JSON.stringify(layout, null, 2), 'utf-8')
    fs.renameSync(tmpFile, LAYOUT_FILE)

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
