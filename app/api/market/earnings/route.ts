// app/api/market/earnings/route.ts
// Earnings calendar via Finnhub
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";

// Cache for 15 minutes
let cached: { data: any; ts: number; key: string } | null = null;
const CACHE_TTL = 900_000;

function fmtDate(d: Date) { return d.toISOString().split("T")[0]; }

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || fmtDate(new Date(Date.now() - 7 * 86400000));
  const to = url.searchParams.get("to") || fmtDate(new Date(Date.now() + 14 * 86400000));
  const symbol = url.searchParams.get("symbol") || "";

  const cacheKey = `${from}:${to}:${symbol}`;
  if (cached && cached.key === cacheKey && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ ok: true, ...cached.data, cached: true });
  }

  if (!FINNHUB_KEY) {
    return NextResponse.json({ ok: false, error: "Finnhub key not configured" }, { status: 500 });
  }

  try {
    let apiUrl = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_KEY}`;
    if (symbol) apiUrl += `&symbol=${encodeURIComponent(symbol)}`;

    const res = await fetch(apiUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`Finnhub ${res.status}`);
    const j = await res.json();

    const entries = (j.earningsCalendar || []).map((e: any) => ({
      symbol: e.symbol || "",
      date: e.date || "",
      hour: e.hour || "", // bmo = before market open, amc = after market close, dmh = during market hours
      quarter: e.quarter,
      year: e.year,
      epsActual: e.epsActual,
      epsEstimate: e.epsEstimate,
      revenueActual: e.revenueActual,
      revenueEstimate: e.revenueEstimate,
    })).filter((e: any) => e.symbol);

    // Group by date
    const byDate: Record<string, any[]> = {};
    for (const e of entries) {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e);
    }

    // Count stats
    const preCount = entries.filter((e: any) => e.hour === "bmo").length;
    const postCount = entries.filter((e: any) => e.hour === "amc").length;

    const data = { entries, byDate, totalCount: entries.length, preCount, postCount };
    cached = { data, ts: Date.now(), key: cacheKey };

    return NextResponse.json({ ok: true, ...data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Earnings fetch failed" }, { status: 500 });
  }
}
