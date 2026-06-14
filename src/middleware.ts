import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { middlewareAuthSecret, verifySessionTokenEdge } from "@/lib/session-edge";

const SESSION_COOKIE = "evora_session";

const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/twilio/",
  "/api/inngest",
  "/api/voice/play/",
];

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/") || isPublicApi(pathname)) {
    return NextResponse.next();
  }

  const secret = middlewareAuthSecret();
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionTokenEdge(token, secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
