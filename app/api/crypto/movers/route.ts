import { NextResponse } from "next/server";

type Row = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  chgPct24h: number;
  vol24h: number;
  mcap: number;
};

type CacheEntry = { expiresAt: number; data: Row[] };
const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Row[]>>();
const KEY = "coingecko:movers";

function num(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function pick(j: any): Row[] {
  const rows: any[] = Array.isArray(j) ? j : [];
  return rows
    .map((x: any) => ({
      id: String(x?.id || ""),
      symbol: String(x?.symbol || "").toUpperCase(),
      name: String(x?.name || ""),
      price: num(x?.current_price),
      chgPct24h: num(x?.price_change_percentage_24h),
      vol24h: num(x?.total_volume),
      mcap: num(x?.market_cap),
    }))
    .filter((r) => r.id && r.symbol && r.name);
}

async function fetchMovers(): Promise<Row[]> {
  const u = new URL("https://api.coingecko.com/api/v3/coins/markets");
  u.searchParams.set("vs_currency", "usd");
  u.searchParams.set("order", "market_cap_desc");
  u.searchParams.set("per_page", "250");
  u.searchParams.set("page", "1");
  u.searchParams.set("sparkline", "false");
  u.searchParams.set("price_change_percentage", "24h");

  const r = await fetch(u.toString(), {
    cache: "force-cache",
    next: { revalidate: Math.ceil(TTL_MS / 1000) },
    headers: { accept: "application/json" },
  });

  if (!r.ok) throw new Error(`CoinGecko ${r.status}`);

  const j = await r.json();
  const rows = pick(j);

  rows.sort((a, b) => Math.abs(b.chgPct24h) - Math.abs(a.chgPct24h));
  return rows.slice(0, 40);
}

export async function GET() {
  try {
    const hit = cache.get(KEY);
    if (hit && hit.expiresAt > Date.now()) {
      return NextResponse.json({ ok: true, data: hit.data, cached: true });
    }

    const existing = inflight.get(KEY);
    if (existing) {
      const data = await existing;
      return NextResponse.json({ ok: true, data, cached: true, deduped: true });
    }

    const p = (async () => {
      const data = await fetchMovers();
      cache.set(KEY, { data, expiresAt: Date.now() + TTL_MS });
      return data;
    })();

    inflight.set(KEY, p);

    try {
      const data = await p;
      return NextResponse.json({ ok: true, data, cached: false });
    } finally {
      inflight.delete(KEY);
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "crypto movers failed", data: [] },
      { status: 500 }
    );
  }
}
