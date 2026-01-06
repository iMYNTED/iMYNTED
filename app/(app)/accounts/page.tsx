import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type ConnectedAccount = {
  id: string;
  provider: string;
  label: string | null;
  status: string;
  created_at: string;
};

export default async function AccountsPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/login?next=/accounts");
  }

  const { data } = await supabase
    .from("connected_accounts")
    .select("id,provider,label,status,created_at")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });

  const accounts = (data ?? []) as ConnectedAccount[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Accounts</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Connected accounts (read-only). Phase 1.
          </p>
        </div>

        <form action={clearAllAccountsAction}>
          <button className="rounded-md bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700">
            Clear all (test)
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">Connected</h2>
          <div className="text-sm text-zinc-400">{accounts.length} total</div>
        </div>

        {accounts.length === 0 ? (
          <div className="px-6 py-8 text-sm text-zinc-400">
            No connected accounts yet. Go to <span className="text-white">Connect Platforms</span> to add one.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {accounts.map((a) => (
              <div key={a.id} className="px-6 py-4 flex items-center justify-between gap-6">
                <div>
                  <div className="font-medium">
                    {a.label ?? prettyProvider(a.provider)}
                  </div>
                  <div className="text-sm text-zinc-400">
                    Provider: {prettyProvider(a.provider)} • Status: {a.status}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-sm text-zinc-500 whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString()}
                  </div>

                  <form action={removeAccountAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="text-sm text-zinc-400 hover:text-white">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function prettyProvider(p: string) {
  if (p === "plaid") return "Plaid";
  if (p === "coinbase") return "Coinbase";
  if (p === "csv") return "CSV";
  return p;
}

async function removeAccountAction(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login?next=/accounts");

  await supabase
    .from("connected_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", userData.user.id);

  revalidatePath("/dashboard");
  revalidatePath("/accounts");

  redirect("/accounts");
}

async function clearAllAccountsAction() {
  "use server";

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login?next=/accounts");

  await supabase.from("connected_accounts").delete().eq("user_id", userData.user.id);

  revalidatePath("/dashboard");
  revalidatePath("/accounts");

  redirect("/accounts");
}
