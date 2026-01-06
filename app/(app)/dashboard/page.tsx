import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // no-op
        },
      },
    }
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userData.user) {
    redirect("/login?next=/dashboard");
  }

  const userId = userData.user.id;

  const [{ count: accountsCount }, { data: alertsData }] = await Promise.all([
    supabase
      .from("connected_accounts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),

    supabase
      .from("alerts")
      .select("id,severity,title,detail,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <DashboardClient
      initialEmail={userData.user.email ?? null}
      accountsConnected={accountsCount ?? 0}
      alerts={alertsData ?? []}
    />
  );
}


