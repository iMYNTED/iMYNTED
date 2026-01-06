// app/auth/callback/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing Supabase env vars",
        missing: {
          NEXT_PUBLIC_SUPABASE_URL: !SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: !SUPABASE_ANON,
        },
      },
      { status: 500 }
    );
  }

  if (!code) {
    const back = new URL("/login", url.origin);
    back.searchParams.set("next", next);
    back.searchParams.set("error", "missing_code");
    return NextResponse.redirect(back);
  }

  const response = NextResponse.redirect(new URL(next, url.origin));

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  // 🔥 debugging (safe)
  if (error) {
    const back = new URL("/login", url.origin);
    back.searchParams.set("next", next);
    back.searchParams.set("error", error.message);
    return NextResponse.redirect(back);
  }

  // If exchange succeeded but session is missing, treat as failure
  if (!data?.session) {
    const back = new URL("/login", url.origin);
    back.searchParams.set("next", next);
    back.searchParams.set("error", "no_session_returned");
    return NextResponse.redirect(back);
  }

  return response;
}




