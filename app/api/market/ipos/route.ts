// app/api/market/ipos/route.ts
// IPO Calendar via Finnhub — upcoming + recent IPOs
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";

// Cache for 30 minutes
let cached: { data: any; ts: number } | null = null;
const CACHE_TTL = 1_800_000;

function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}

export async function GET() {
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ ok: true, ...cached.data, cached: true });
  }

  if (!FINNHUB_KEY) {
    return NextResponse.json({ ok: false, error: "Finnhub key not configured" }, { status: 500 });
  }

  try {
    const now = new Date();
    // Upcoming: next 60 days
    const futureEnd = new Date(now.getTime() + 60 * 86400000);
    // Recent: last 30 days
    const pastStart = new Date(now.getTime() - 30 * 86400000);

    const [upRes, recentRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/calendar/ipo?from=${fmtDate(now)}&to=${fmtDate(futureEnd)}&token=${FINNHUB_KEY}`, { cache: "no-store" }),
      fetch(`https://finnhub.io/api/v1/calendar/ipo?from=${fmtDate(pastStart)}&to=${fmtDate(now)}&token=${FINNHUB_KEY}`, { cache: "no-store" }),
    ]);

    const upJ = upRes.ok ? await upRes.json().catch(() => ({})) : {};
    const recentJ = recentRes.ok ? await recentRes.json().catch(() => ({})) : {};

    function mapEntries(items: any[], status: "upcoming" | "listed") {
      return (items || []).map((e: any) => ({
        symbol: e.symbol || "",
        name: e.name || "",
        exchange: e.exchange || "",
        price: e.price || "",
        numberOfShares: e.numberOfShares || 0,
        totalSharesValue: e.totalSharesValue || 0,
        date: e.date || "",
        status: e.status || status,
        currentPrice: undefined as number | undefined,
        change: undefined as number | undefined,
        changePct: undefined as number | undefined,
      })).filter((e) => e.symbol && e.name);
    }

    const upcoming = mapEntries(upJ.ipoCalendar, "upcoming")
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
    let listed = mapEntries(recentJ.ipoCalendar, "listed")
      .sort((a: any, b: any) => b.date.localeCompare(a.date));

    // Enrich top 15 listed IPOs with current price from Finnhub quotes
    const enrichLimit = Math.min(listed.length, 15);
    if (enrichLimit > 0) {
      const batchSize = 5;
      for (let i = 0; i < enrichLimit; i += batchSize) {
        const batch = listed.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (entry: any) => {
            const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(entry.symbol)}&token=${FINNHUB_KEY}`, { cache: "no-store" });
            if (!res.ok) return null;
            const q = await res.json();
            if (!q || !Number.isFinite(q.c) || q.c === 0) return null;
            return { symbol: entry.symbol, currentPrice: q.c, change: q.d, changePct: q.dp, prevClose: q.pc };
          })
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) {
            const idx = listed.findIndex((e: any) => e.symbol === r.value!.symbol);
            if (idx >= 0) {
              listed[idx] = {
                ...listed[idx],
                currentPrice: r.value.currentPrice,
                change: r.value.change,
                changePct: r.value.changePct,
              };
            }
          }
        }
        // Small delay between batches
        if (i + batchSize < enrichLimit) await new Promise(r => setTimeout(r, 300));
      }
    }

    const data = { upcoming, listed, upcomingCount: upcoming.length, listedCount: listed.length };
    cached = { data, ts: Date.now() };

    return NextResponse.json({ ok: true, ...data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "IPO fetch failed" }, { status: 500 });
  }
}
