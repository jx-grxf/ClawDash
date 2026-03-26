import { NextRequest, NextResponse } from "next/server";
import { isAllowedDashboardRequest, shouldChallengeWithBasicAuth } from "@/lib/dashboard-access";

export function middleware(request: NextRequest) {
  if (isAllowedDashboardRequest(request)) {
    return NextResponse.next();
  }

  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const response = isApi
    ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    : new NextResponse("ClawDash access denied", { status: 401 });
  if (shouldChallengeWithBasicAuth()) {
    response.headers.set("WWW-Authenticate", 'Basic realm="ClawDash"');
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets).*)"],
};
