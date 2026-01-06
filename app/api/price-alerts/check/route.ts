import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function severityForMove(absPct: number): "Low" | "Medium" | "High" {
  if (absPct >= 10) return "High";
  if (absPct >= 5) return "Medium";
  return "Low";
}

// ✅ Replace this with your real quote provider.
// For now, it's a stub you can wire to your current market data source.
async function getPrice(symbol: string): Promise<number> {
  // TODO: implement using the same provider you used for “market news”
  // Throw to make errors obvious until wired:
  throw new Error(`Price provider not wired for ${symbol}`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
const secret = url.searchParams.get("neLo2EGAjfm0bplv8DXVZFYa_ctaYKkXT_P8EN5CQy8");

if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rules, error: rulesErr } = await supabaseAdmin
    .from("price_alert_rules")
    .select("*");

  if (rulesErr) return NextResponse.json({ error: rulesErr.message }, { status: 500 });

  for (const r of rules ?? []) {
    try {
      const price = await getPrice(r.symbol);

      // First time: set baseline_price and move on
      if (!r.baseline_price) {
        await supabaseAdmin
          .from("price_alert_rules")
          .update({ baseline_price: price })
          .eq("id", r.id);
        continue;
      }

      const pct = ((price - r.baseline_price) / r.baseline_price) * 100;
      const absPct = Math.abs(pct);

      if (absPct >= Number(r.threshold_percent)) {
        // event history
        await supabaseAdmin.from("price_alert_events").insert({
          rule_id: r.id,
          percent_change: pct,
          price,
        });

        // user-facing notification feed (your existing table)
        const sev = severityForMove(absPct);
        await supabaseAdmin.from("alerts").insert({
          user_id: r.user_id,
          title: "Price Alert",
          detail: `${r.symbol} moved ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% (price: ${price})`,
          severity: sev, // ✅ must be 'High'|'Medium'|'Low'
          is_read: false,
        });

        // reset baseline to avoid spam
        await supabaseAdmin
          .from("price_alert_rules")
          .update({ baseline_price: price })
          .eq("id", r.id);
      }
    } catch (e: any) {
      // Optional: log later; for now just continue
      continue;
    }
  }

  return NextResponse.json({ ok: true });
}
