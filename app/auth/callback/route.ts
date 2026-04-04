// app/auth/callback/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing Supabase env vars",
        missing: {
          NEXT_PUBLIC_SUPABASE_URL: !supabaseUrl,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: !supabaseAnonKey,
        },
      },
      { status: 500 }
    );
  }

  if (!code) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("next", next);
    loginUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(loginUrl);
  }

  const redirectUrl = new URL(next, requestUrl.origin);
  const response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.session) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("next", next);
    loginUrl.searchParams.set(
      "error",
      error?.message || "no_session_returned"
    );
    return NextResponse.redirect(loginUrl);
  }

  // Server-side invite enforcement: block users without invited flag
  const user = data.session.user;
  if (!user.user_metadata?.invited) {
    // Sign out the session server-side using service role
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await admin.auth.admin.signOut(data.session.access_token);

    // Clear the session cookies
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "not_invited");
    const denied = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) {
      denied.cookies.delete(cookie.name);
    }
    return denied;
  }

  return response;
}