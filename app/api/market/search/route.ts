// app/api/market/search/route.ts
// Symbol lookup via Finnhub
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) return NextResponse.json({ ok: true, results: [] });
  if (!FINNHUB_KEY) return NextResponse.json({ ok: false, error: "Finnhub key not configured" }, { status: 500 });

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${FINNHUB_KEY}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`Finnhub ${res.status}`);
    const j = await res.json();

    const results = (j.result || [])
      .filter((r: any) => r.symbol && r.description && !r.symbol.includes("."))
      .slice(0, 15)
      .map((r: any) => ({
        symbol: r.symbol,
        name: r.description,
        type: r.type || "Common Stock",
      }));

    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Search failed", results: [] }, { status: 500 });
  }
}
