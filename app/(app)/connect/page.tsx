import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export default async function ConnectPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Connect Platforms</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Phase 1: Read-only aggregation. No trading, no execution.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ConnectTile
          title="Plaid (Brokers)"
          desc="Connect broker accounts read-only (Schwab, Fidelity, etc.)."
          provider="plaid"
          label="Plaid Broker Link"
        />

        <ConnectTile
          title="Coinbase"
          desc="Connect Coinbase for balances + positions."
          provider="coinbase"
          label="Coinbase"
        />

        <ConnectTile
          title="CSV Import"
          desc="Upload statements as a fallback."
          provider="csv"
          label="CSV Import"
        />
      </div>

      <div className="text-xs text-zinc-500">
        Tip: Click a connect button above — it will create a real row in your Supabase table and your
        Dashboard “Accounts Connected” will update automatically.
      </div>
    </div>
  );
}

function ConnectTile({
  title,
  desc,
  provider,
  label,
}: {
  title: string;
  desc: string;
  provider: "plaid" | "coinbase" | "csv";
  label: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{title}</h2>
        <span className="text-xs rounded-full border border-zinc-700 px-2 py-1 text-zinc-300">
          Phase 1
        </span>
      </div>

      <p className="text-sm text-zinc-400 mt-2">{desc}</p>

      <form action={connectAccountAction} className="mt-4">
        <input type="hidden" name="provider" value={provider} />
        <input type="hidden" name="label" value={label} />
        <button className="w-full rounded-md bg-white text-black px-4 py-2 text-sm font-medium">
          Connect (stub)
        </button>
      </form>
    </div>
  );
}

async function connectAccountAction(formData: FormData) {
  "use server";

  const provider = String(formData.get("provider") ?? "");
  const label = String(formData.get("label") ?? "");

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
    redirect("/login?next=/connect");
  }

  // Prevent duplicates: one row per provider for now
  const { data: existing } = await supabase
    .from("connected_accounts")
    .select("id")
    .eq("user_id", userData.user.id)
    .eq("provider", provider)
    .limit(1);

  if (!existing || existing.length === 0) {
    await supabase.from("connected_accounts").insert({
      user_id: userData.user.id,
      provider,
      label,
      status: "connected",
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/connect");

  redirect("/accounts");
}

