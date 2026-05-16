import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PROTECTED = [/^\/board(?:\/|$)/, /^\/boards(?:\/|$)/];
const PUBLIC = ["/signin", "/signup"];

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-DNS-Prefetch-Control": "on",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
};

const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss: https://api.anthropic.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss: http: https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

function applySecurityHeaders(res: NextResponse) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  const csp = process.env.NODE_ENV === "production" ? PROD_CSP : DEV_CSP;
  res.headers.set("Content-Security-Policy", csp);
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return res;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/auth")) return;

  if (PROTECTED.some((re) => re.test(pathname)) && !req.auth) {
    const signin = new URL("/signin", req.url);
    signin.searchParams.set("from", pathname);
    return applySecurityHeaders(NextResponse.redirect(signin));
  }
  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return applySecurityHeaders(NextResponse.next());
  }
  return applySecurityHeaders(NextResponse.next());
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|manifest|sw\\.js).*)"],
};
