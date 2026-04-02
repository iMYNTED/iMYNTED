import { NextResponse, type NextRequest } from "next/server";

// ── AUTH BYPASSED FOR DEV ──
// Re-enable Supabase session checks when ready for production.

export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};