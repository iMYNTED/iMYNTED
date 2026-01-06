import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const cookiesToSet: Array<{ name: string; value: string; options: any }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(newCookies) {
          cookiesToSet.push(...newCookies);
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const res = NextResponse.json({ rules: [] });
    cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  }

  const { data, error } = await supabase
    .from("price_alert_rules")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    const res = NextResponse.json({ error: error.message }, { status: 400 });
    cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  }

  const res = NextResponse.json({ rules: data ?? [] });
  cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
  return res;
}
