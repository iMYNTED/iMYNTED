import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/", "/login", "/auth/callback", "/terms", "/privacy"];
const PUBLIC_API_PATHS = [
  "/api/invite",
  "/api/market",
  "/api/crypto",
  "/api/scanner",
  "/api/news",
];

// ── Rate limiting ──
// In-memory store: key → array of timestamps
// Note: per-instance on serverless, still effective against burst abuse
const rateLimitStore = new Map<string, number[]>();

const RATE_LIMITS: Array<{ pattern: RegExp; max: number; windowMs: number }> = [
  // Login page: 10 requests per 15 min per IP
  { pattern: /^\/login/, max: 10, windowMs: 15 * 60 * 1000 },
  // Invite API: 10 per 15 min per IP (brute-force protection)
  { pattern: /^\/api\/invite/, max: 10, windowMs: 15 * 60 * 1000 },
  // Auth endpoints: 20 per minute per IP
  { pattern: /^\/auth\//, max: 20, windowMs: 60 * 1000 },
  // Market/data APIs: 300 per minute per IP
  { pattern: /^\/api\/market/, max: 300, windowMs: 60 * 1000 },
  { pattern: /^\/api\/crypto/, max: 300, windowMs: 60 * 1000 },
  // All other API routes: 120 per minute per IP
  { pattern: /^\/api\//, max: 120, windowMs: 60 * 1000 },
];

function checkRateLimit(ip: string, pathname: string): { limited: boolean; retryAfter?: number } {
  const rule = RATE_LIMITS.find(r => r.pattern.test(pathname));
  if (!rule) return { limited: false };

  const key = `${ip}:${rule.pattern.source}`;
  const now = Date.now();
  const windowStart = now - rule.windowMs;

  const hits = (rateLimitStore.get(key) ?? []).filter(t => t > windowStart);
  hits.push(now);
  rateLimitStore.set(key, hits);

  // Cleanup old keys periodically (every ~500 requests)
  if (rateLimitStore.size > 5000) {
    for (const [k, v] of rateLimitStore) {
      if (v.every(t => t < windowStart)) rateLimitStore.delete(k);
    }
  }

  if (hits.length > rule.max) {
    const oldest = hits[0];
    const retryAfter = Math.ceil((oldest + rule.windowMs - now) / 1000);
    return { limited: true, retryAfter };
  }

  return { limited: false };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/brand/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Rate limiting (applied to all routes including public ones)
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const { limited, retryAfter } = checkRateLimit(ip, pathname);
  if (limited) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "rate limit exceeded");
    return NextResponse.redirect(url);
  }

  // Allow public pages
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Allow public API routes
  if (PUBLIC_API_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Check Supabase session via cookies
  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)"],
};
