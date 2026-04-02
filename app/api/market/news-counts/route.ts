// app/api/market/news-counts/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type NewsItem = {
  id?: string;
  title?: string;
  source?: string;
  published?: string;
  ts?: string;
  summary?: string;
  url?: string;
};

type BulkNewsResponse = {
  mode?: "bulk" | "single";
  provider?: "rapidapi" | "mock" | string;
  symbols?: string[];
  counts?: Record<string, number>;
  itemsBySymbol?: Record<string, NewsItem[]>;
  ts?: string;
  warn?: string;
  error?: string;
};

type CountsResp = {
  ok: boolean;
  provider: string;
  asset: "stock" | "crypto";
  symbols: string[];
  counts: Record<string, number>;
  ts: string;
  warn?: string;
  error?: string;
};

function normSym(x: string) {
  return (x || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").trim();
}

/** ----------------------------- MODE SWITCH ----------------------------- */
/**
 * Align with /api/market/quote:
 * - DATA_MODE=sim => no external fetch
 * - DATA_MODE=real => live (delegate to /api/market/news)
 *
 * (We still accept IMYNTED_DATA_MODE for backward compatibility)
 */
function dataMode(): "sim" | "real" {
  const v = String(
    process.env.DATA_MODE ||
      process.env.IMYNTED_DATA_MODE ||
      process.env.NEXT_PUBLIC_IMYNTED_DATA_MODE ||
      "sim"
  )
    .toLowerCase()
    .trim();

  return v === "real" || v === "live" ? "real" : "sim";
}

/** Prefer forwarded headers (works in dev + Vercel) */
function originFromReq(req: Request) {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3004";
  return `${proto}://${host}`;
}

/** ----------------------------- SIM counts (no fetch) ----------------------------- */
/**
 * Stable-ish counts per symbol per 30m bucket.
 * Drives “news spike” UI without external calls.
 */
function hash32(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function makeRng(seed: number) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function simCounts(symbols: string[]): Record<string, number> {
  const bucket = Math.floor(Date.now() / (30 * 60_000)); // 30m
  const out: Record<string, number> = {};
  for (const s of symbols) {
    const seed = hash32(`${s}:${bucket}`);
    const rnd = makeRng(seed);

    // 0..7 with occasional spikes
    const base = Math.floor(rnd() * 4); // 0..3
    const spike = rnd() < 0.18 ? 2 + Math.floor(rnd() * 5) : 0; // 0 or 2..6
    out[s] = Math.max(0, Math.min(12, base + spike));
  }
  return out;
}

/** ----------------------------- LIVE counts via /news ----------------------------- */
type FetchCountsResult = {
  provider: string;
  counts: Record<string, number>;
  warn?: string;
  error?: string;
};

async function fetchCountsViaNewsRoute(req: Request, symbols: string[]): Promise<FetchCountsResult> {
  const origin = originFromReq(req);

  const url = new URL("/api/market/news", origin);
  url.searchParams.set("symbols", symbols.join(","));

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) {
      return { provider: "news-route", counts: {}, error: `HTTP ${res.status}` };
    }

    const j = (await res.json().catch(() => ({}))) as BulkNewsResponse;

    const counts: Record<string, number> = {};
    for (const s of symbols) {
      const v = Number(j?.counts?.[s] ?? 0);
      counts[s] = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
    }

    return {
      provider: String(j?.provider || "news-route"),
      counts,
      warn: j?.warn,
      error: j?.error,
    };
  } catch (e: any) {
    return { provider: "news-route", counts: {}, error: e?.message || "fetch failed" };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const assetRaw = (url.searchParams.get("asset") || "stock").toLowerCase().trim();
  const asset: "stock" | "crypto" = assetRaw === "crypto" ? "crypto" : "stock";

  // accept both: symbols=CSV and symbols[]=AAPL&symbols[]=TSLA
  const symbolsParam = url.searchParams.get("symbols");
  const symbolsArray = url.searchParams.getAll("symbols[]");
  const symbolsRaw = (symbolsParam ? symbolsParam.split(",") : []).concat(symbolsArray);

  const symbols = symbolsRaw.map((s) => normSym(s)).filter(Boolean).slice(0, 30);

  if (!symbols.length) {
    const out: CountsResp = {
      ok: true,
      provider: "news-counts",
      asset,
      symbols: [],
      counts: {},
      ts: new Date().toISOString(),
      error: "No symbols provided",
    };
    return NextResponse.json(out, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const mode = dataMode();

  // ✅ SIM: do not fetch anything
  if (mode === "sim") {
    const out: CountsResp = {
      ok: true,
      provider: "mock",
      asset,
      symbols,
      counts: simCounts(symbols),
      ts: new Date().toISOString(),
      warn: "DATA_MODE=sim (no external news calls)",
    };
    return NextResponse.json(out, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  // REAL: delegate to /api/market/news and trust its counts
  const { provider, counts, warn, error } = await fetchCountsViaNewsRoute(req, symbols);

  const safeCounts: Record<string, number> = {};
  for (const s of symbols) {
    const v = Number(counts[s] ?? 0);
    safeCounts[s] = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  }

  const out: CountsResp = {
    ok: true,
    provider,
    asset,
    symbols,
    counts: safeCounts,
    ts: new Date().toISOString(),
    ...(warn ? { warn } : {}),
    ...(error ? { error } : {}),
  };

  return NextResponse.json(out, { status: 200, headers: { "Cache-Control": "no-store" } });
}