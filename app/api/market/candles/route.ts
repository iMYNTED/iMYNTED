// app/api/market/candles/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Asset = "stock" | "crypto" | "futures";

type Candle = {
  t: number; // ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function normSym(raw: string) {
  return String(raw || "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.\-]/g, "");
}

const CRYPTO_BASES = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "BNB", "MATIC"] as const;

const FUTURES_ROOTS = new Set([
  "ES","NQ","YM","RTY","MES","MNQ","VX",
  "CL","NG","HO","RB",
  "GC","SI","HG","PL",
  "ZB","ZN","ZF","ZC","ZS","ZW","ZL",
  "6E","6J","6B","6A",
]);

const FUTURES_TICK: Record<string, number> = {
  ES:0.25, NQ:0.25, YM:1, RTY:0.1, MES:0.25, MNQ:0.25, VX:0.05,
  CL:0.01, NG:0.001, HO:0.0001, RB:0.0001,
  GC:0.1, SI:0.005, HG:0.0005, PL:0.1,
  ZB:0.03125, ZN:0.015625, ZF:0.0078125,
  ZC:0.25, ZS:0.25, ZW:0.25, ZL:0.01,
  "6E":0.00005,"6J":0.0000005,"6B":0.0001,"6A":0.0001,
};

function normalizeFuturesSymbol(raw: string): string {
  return normSym(raw).replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "");
}

function isFuturesSymbol(raw: string): boolean {
  const s = normSym(raw);
  const root = s.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "");
  return FUTURES_ROOTS.has(root);
}

function isCryptoSymbol(raw: string) {
  const s = normSym(raw);
  if (!s) return false;
  if (s.includes("-USD")) return true;
  return (CRYPTO_BASES as readonly string[]).includes(s);
}

function normalizeCryptoSymbol(raw: string) {
  const s = normSym(raw);
  if (!s) return "BTC-USD";
  if (s.includes("-")) return s;
  if (s.endsWith("USD")) return s.replace(/USD$/, "-USD");
  return `${s}-USD`;
}

function detectAsset(symbol: string, assetParam?: string | null): Asset {
  const a = String(assetParam || "").toLowerCase().trim();
  if (a === "futures") return "futures";
  if (a === "stock" || a === "crypto") return a;
  if (isFuturesSymbol(symbol)) return "futures";
  return isCryptoSymbol(symbol) ? "crypto" : "stock";
}

function toNum(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

/** ----------------------------- MODE SWITCH ----------------------------- */
function dataMode(): "sim" | "live" {
  const v =
    (process.env.IMYNTED_DATA_MODE ||
      process.env.NEXT_PUBLIC_IMYNTED_DATA_MODE ||
      "sim")
      .toLowerCase()
      .trim();

  return v === "live" ? "live" : "sim";
}

/** seeded RNG */
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

function intervalToMs(interval: string) {
  const s = (interval || "1m").toLowerCase().trim();
  if (s === "1m") return 60_000;
  if (s === "5m") return 5 * 60_000;
  if (s === "15m") return 15 * 60_000;
  if (s === "30m") return 30 * 60_000;
  if (s === "1h") return 60 * 60_000;
  if (s === "4h") return 4 * 60 * 60_000;
  if (s === "1d") return 24 * 60 * 60_000;
  return 60_000;
}

function decFor(asset: Asset, px: number) {
  if (asset === "futures") {
    if (px >= 10000) return 2;
    if (px >= 100)   return 3;
    if (px >= 1)     return 4;
    return 6;
  }
  if (asset === "stock") return px >= 1 ? 2 : 4;
  if (px >= 100) return 2;
  if (px >= 1) return 4;
  return 6;
}
function roundPx(asset: Asset, px: number) {
  const d = decFor(asset, px);
  return Number(px.toFixed(d));
}

/**
 * ✅ SIM anchor: hit /api/market/quote (which itself respects DATA_MODE)
 * Chart == Header == Trader == Tape.
 */
async function getAnchorPrice(req: Request, symbol: string, asset: Asset): Promise<{ price: number; provider: string; warn?: string }> {
  const origin = new URL(req.url).origin;
  const u = new URL("/api/market/quote", origin);
  u.searchParams.set("symbol", symbol);
  u.searchParams.set("asset", asset);

  const res = await fetch(u.toString(), { cache: "no-store" }).catch(() => null as any);
  if (!res || !res.ok) {
    const fallback =
      asset === "crypto"
        ? symbol.startsWith("BTC")
          ? 43000
          : symbol.startsWith("ETH")
            ? 2300
            : 1000
        : 100;
    return { price: fallback, provider: "fallback", warn: "quote_unavailable" };
  }

  const j: any = await res.json().catch(() => ({}));
  const d = j?.data ?? j ?? {};
  const px = toNum(d?.price) ?? toNum(d?.last) ?? toNum(d?.c) ?? undefined;

  if (!px || px <= 0) {
    const fallback = asset === "crypto" ? 1000 : 100;
    return { price: fallback, provider: "fallback", warn: "quote_missing_price" };
  }

  return {
    price: px,
    provider: String(d?.provider ?? j?.provider ?? "quote"),
    warn: typeof j?.warn === "string" ? j.warn : undefined,
  };
}

function genAnchoredMockCandles(asset: Asset, symbol: string, intervalMs: number, limit: number, anchor: number): Candle[] {
  const sym = normSym(symbol) || (asset === "crypto" ? "BTC-USD" : "AAPL");

  const step = intervalMs;
  const now = Date.now();
  const end = Math.floor(now / step) * step;
  const start = end - step * (limit - 1);

  // ✅ stable evolution (60s bucket)
  const bucket = Math.floor(now / 60_000);
  const seed = hash32(`${asset}:${sym}:${intervalMs}:${bucket}`);
  const rnd = makeRng(seed);

  const basePx = Math.max(asset === "crypto" ? 0.000001 : 0.01, anchor);
  const vol = asset === "crypto" ? 0.22 : asset === "futures" ? 0.08 : 0.10;

  let last = basePx * (1 + (rnd() - 0.5) * 0.0025);
  const out: Candle[] = [];

  for (let i = 0; i < limit; i++) {
    const t = start + i * step;

    const drift = (Math.sin((i + seed) / 17) + Math.cos((i + seed) / 31)) * (vol * 0.06);
    const noise = (rnd() - 0.5) * (vol * 0.22);

    const changePct = drift + noise;

    const o = last;
    const c = Math.max(0.000001, o * (1 + changePct / 100));

    const body = Math.abs(c - o);
    const wick = Math.max(basePx * 0.00015, body * (0.35 + rnd() * 0.9));

    const h = Math.max(o, c) + wick;
    const l = Math.max(0.000001, Math.min(o, c) - wick);

    const v =
      asset === "crypto"
        ? Math.floor(200 + rnd() * 50_000)
        : asset === "futures"
          ? Math.floor(100 + rnd() * 8_000)
          : Math.floor(25_000 + rnd() * 3_500_000);

    out.push({
      t,
      o: roundPx(asset, o),
      h: roundPx(asset, h),
      l: roundPx(asset, l),
      c: roundPx(asset, c),
      v,
    });

    last = c;
  }

  // ✅ force last close to equal anchor
  const lastIdx = out.length - 1;
  if (lastIdx >= 0) {
    const a = roundPx(asset, basePx);
    out[lastIdx] = {
      ...out[lastIdx],
      c: a,
      h: roundPx(asset, Math.max(out[lastIdx].h, out[lastIdx].o, a)),
      l: roundPx(asset, Math.min(out[lastIdx].l, out[lastIdx].o, a)),
    };
  }

  return out;
}

/**
 * LIVE candles hook:
 * - for now returns null (we fall back to SIM)
 * - later, plug RapidAPI candles or a broker feed here
 */
async function fetchLiveCandles(_req: Request, _symbol: string, _asset: Asset, _interval: string, _limit: number): Promise<{ provider: string; candles: Candle[] } | null> {
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const rawSymbol = url.searchParams.get("symbol") || "AAPL";
  const asset = detectAsset(rawSymbol, url.searchParams.get("asset"));

  const symbol = asset === "crypto"   ? normalizeCryptoSymbol(rawSymbol)
               : asset === "futures"  ? normSym(rawSymbol) || "ESH26"
               : normSym(rawSymbol) || "AAPL";
  const interval = (url.searchParams.get("interval") || "1m").toLowerCase().trim();

  const limit = clamp(toInt(url.searchParams.get("limit"), 120), 20, 400);
  const intervalMs = intervalToMs(interval);

  const mode = dataMode();

  // ✅ LIVE mode path (ready for later)
  if (mode === "live") {
    const live = await fetchLiveCandles(req, symbol, asset, interval, limit).catch(() => null);
    if (live && Array.isArray(live.candles) && live.candles.length) {
      return NextResponse.json({
        ok: true,
        provider: live.provider,
        mode: "live",
        symbol,
        asset,
        interval,
        intervalMs,
        limit,
        candles: live.candles,
      });
    }
    // fall through to sim if live not wired / fails
  }

  // ✅ SIM path (anchored to quote)
  const anchor = await getAnchorPrice(req, symbol, asset);
  const candles = genAnchoredMockCandles(asset, symbol, intervalMs, limit, anchor.price);

  return NextResponse.json({
    ok: true,
    provider: "mock",
    mode: "sim",
    symbol,
    asset,
    interval,
    intervalMs,
    limit,
    anchor: {
      price: anchor.price,
      provider: anchor.provider,
      warn: anchor.warn || "",
    },
    candles,
    warn: mode === "live" ? "live_candles_unavailable_fell_back_to_sim" : "SIM_MODE",
  });
}