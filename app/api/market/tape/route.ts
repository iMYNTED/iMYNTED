// app/api/market/tape/route.ts
import { NextResponse } from "next/server";

type Side = "B" | "S" | "M";
type Row = { ts: string; price: number; size: number; side: Side; venue?: string };

function normSym(raw: string) {
  return String(raw || "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.\-]/g, "");
}

function pickBaseSymbol(s: string) {
  const sym = normSym(s);
  if (!sym) return "AAPL";
  if (sym.includes("-")) return sym.split("-")[0];
  return sym;
}

const CRYPTO_BASES = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "BNB", "MATIC"] as const;

const FUTURES_ROOTS = new Set([
  "ES","NQ","YM","RTY","MES","MNQ","VX",
  "CL","NG","HO","RB",
  "GC","SI","HG","PL",
  "ZB","ZN","ZF","ZC","ZS","ZW","ZL",
  "6E","6J","6B","6A",
]);

const FUTURES_VENUES: Record<string, string> = {
  ES:"CME", NQ:"CME", YM:"CBOT", RTY:"CME", MES:"CME", MNQ:"CME", VX:"CFE",
  CL:"NYMEX", NG:"NYMEX", HO:"NYMEX", RB:"NYMEX",
  GC:"COMEX", SI:"COMEX", HG:"COMEX", PL:"NYMEX",
  ZB:"CBOT", ZN:"CBOT", ZF:"CBOT", ZC:"CBOT", ZS:"CBOT", ZW:"CBOT", ZL:"CBOT",
  "6E":"CME","6J":"CME","6B":"CME","6A":"CME",
};

function isCryptoSymbol(raw: string) {
  const s = normSym(raw);
  if (!s) return false;
  if (s.includes("-USD")) return true;
  return (CRYPTO_BASES as readonly string[]).includes(s);
}

function isFuturesSymbol(raw: string): boolean {
  const s = normSym(raw);
  const root = s.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "");
  return FUTURES_ROOTS.has(root);
}

function getFuturesRoot(sym: string): string {
  return normSym(sym).replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "");
}

function detectAssetType(rawSym: string, assetParam: string): "stock" | "crypto" | "futures" {
  const a = assetParam.toLowerCase().trim();
  if (a === "futures") return "futures";
  if (a === "crypto")  return "crypto";
  if (a === "stock")   return "stock";
  if (isFuturesSymbol(rawSym)) return "futures";
  if (isCryptoSymbol(rawSym))  return "crypto";
  return "stock";
}

function tickFor(asset: "stock" | "crypto" | "futures", px: number, root?: string) {
  if (asset === "futures") {
    const TICKS: Record<string,number> = {
      ES:0.25, NQ:0.25, YM:1, RTY:0.1, MES:0.25, MNQ:0.25, VX:0.05,
      CL:0.01, NG:0.001, HO:0.0001, RB:0.0001,
      GC:0.1, SI:0.005, HG:0.0005, PL:0.1,
      ZB:0.03125, ZN:0.015625, ZF:0.0078125,
      ZC:0.25, ZS:0.25, ZW:0.25, ZL:0.01,
      "6E":0.00005,"6J":0.0000005,"6B":0.0001,"6A":0.0001,
    };
    return root && TICKS[root] ? TICKS[root] : 0.01;
  }
  if (!Number.isFinite(px) || px <= 0) return 0.01;
  if (asset === "stock") return px >= 1 ? 0.01 : 0.0001;
  if (px >= 100) return 0.05;
  if (px >= 1) return 0.01;
  if (px >= 0.01) return 0.0001;
  return 0.000001;
}

function decFor(asset: "stock" | "crypto" | "futures", px: number) {
  if (asset === "futures") {
    if (px >= 10000) return 2;
    if (px >= 100)   return 3;
    if (px >= 1)     return 4;
    return 7;
  }
  if (asset === "stock") return px >= 1 ? 2 : 4;
  if (px >= 100) return 2;
  if (px >= 1) return 4;
  return 6;
}

function roundPx(asset: "stock" | "crypto" | "futures", px: number) {
  const d = decFor(asset, px);
  return Number(px.toFixed(d));
}

function safeOriginFromRequest(req: Request) {
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}

function safeEnvOrigin() {
  const b = process.env.NEXT_PUBLIC_BASE_URL;
  if (b && b.startsWith("http")) return b;

  const v = process.env.VERCEL_URL;
  if (v) return v.startsWith("http") ? v : `https://${v}`;

  return "";
}

/* ---------------- deterministic RNG ---------------- */

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

/**
 * Canonical quote fetch — stock, crypto, and futures.
 */
const tapeQuoteCache = new Map<string, { data: any; ts: number }>();
const TAPE_CACHE_TTL = 15000;

async function getCanonicalQuote(
  req: Request,
  symbolParam: string,
  assetParam: string
): Promise<{
  asset: "stock" | "crypto" | "futures";
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  mid: number;
  provider?: string;
  warn?: string;
}> {
  const symRaw = normSym(symbolParam) || "AAPL";
  const assetType = detectAssetType(symRaw, assetParam);

  let symbol = symRaw;
  if (assetType === "crypto") {
    symbol = symRaw.includes("-") ? symRaw : `${pickBaseSymbol(symRaw)}-USD`;
  }

  const cacheKey = `${assetType}:${symbol}`;
  const cached = tapeQuoteCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TAPE_CACHE_TTL) {
    return cached.data;
  }

  const origin = safeOriginFromRequest(req) || safeEnvOrigin();
  const url = `${origin}/api/market/quote?symbol=${encodeURIComponent(symbol)}&asset=${assetType}`;

  const res = await fetch(url, { cache: "no-store" }).catch(() => null as any);

  if (!res || !res.ok) {
    // Return stale cache if available
    if (cached) return cached.data;
    const fallback = assetType === "crypto" ? 1000 : assetType === "futures" ? 5000 : 100;
    return { asset: assetType, symbol, price: fallback, mid: fallback, provider: "fallback", warn: "quote_unavailable" };
  }

  const j: any = await res.json().catch(() => ({}));
  const root = j ?? {};
  const d = root?.data ?? root?.quote ?? root ?? {};

  const bidRaw = d?.bid !== undefined ? Number(d.bid) : Number(d?.b);
  const askRaw = d?.ask !== undefined ? Number(d.ask) : Number(d?.a);
  const bid = Number.isFinite(bidRaw) && bidRaw > 0 ? bidRaw : undefined;
  const ask = Number.isFinite(askRaw) && askRaw > 0 ? askRaw : undefined;
  const midFeed = Number(d?.mid ?? d?.m ?? d?.midpoint);

  let mid: number | undefined;
  if (bid !== undefined && ask !== undefined) mid = (bid + ask) / 2;
  else if (Number.isFinite(midFeed) && midFeed > 0) mid = midFeed;

  const explicitPrice = Number(d?.price);
  const last = Number(d?.last ?? d?.px ?? d?.c);
  let price: number | undefined = mid ?? explicitPrice ?? last;

  if (!Number.isFinite(price) || (price as number) <= 0) {
    price = assetType === "crypto" ? 1000 : assetType === "futures" ? 5000 : 100;
  }
  if (!mid || !Number.isFinite(mid)) mid = price;

  const result = {
    asset: assetType,
    symbol: String(d?.symbol ?? symbol),
    price: price!, bid, ask, mid: mid!,
    provider: String(d?.provider ?? root?.provider ?? "quote"),
    warn: typeof root?.warn === "string" ? String(root.warn) : typeof d?.warn === "string" ? String(d.warn) : undefined,
  };
  tapeQuoteCache.set(cacheKey, { data: result, ts: Date.now() });
  return result;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const symbolParam = url.searchParams.get("symbol") || "AAPL";
    const assetParam = (url.searchParams.get("asset") || "").toLowerCase().trim();

    const canon = await getCanonicalQuote(req, symbolParam, assetParam);

    /* ---------------------------------------------------------
       🔥 CORE FIX:
       SAME 60s bucket as /quote generator
       This keeps HEADER / TRADER / TAPE perfectly aligned.
    --------------------------------------------------------- */
    const bucket = Math.floor(Date.now() / 60_000);
    const seed = hash32(`${canon.asset}:${canon.symbol}:${bucket}`);
    const rnd = makeRng(seed);

    const anchor = canon.price;
    const futRoot = canon.asset === "futures" ? getFuturesRoot(canon.symbol) : "";
    const tick = tickFor(canon.asset, anchor, futRoot || undefined);

    // ✅ Make tape longer by default (terminal feel)
    const countParam = Number(url.searchParams.get("n") || "");
    const defaultN = canon.asset === "crypto" ? 480 : canon.asset === "futures" ? 350 : 420;

    const N = clamp(
      Number.isFinite(countParam) ? countParam : defaultN,
      160,
      700
    );

    const haveBA = canon.bid !== undefined && canon.ask !== undefined;
    const bid = canon.bid;
    const ask = canon.ask;
    const mid = canon.mid;

    /* ---------------------------------------------------------
       VISUAL MOTION ONLY (NO DRIFT)
    --------------------------------------------------------- */
    const wiggleAmp = canon.asset === "crypto" ? anchor * 0.00015
                    : canon.asset === "futures" ? tick * 3
                    : anchor * 0.00008;

    const sweepChance = canon.asset === "crypto" ? 0.12 : canon.asset === "futures" ? 0.10 : 0.08;
    const doSweep = rnd() < sweepChance;
    const sweepSide: Side = rnd() < 0.5 ? "B" : "S";
    const sweepLen = doSweep ? Math.round(8 + rnd() * 14) : 0;
    const sweepStart = doSweep ? Math.round(rnd() * (N * 0.55)) : -9999;

    const now = Date.now();
    let t = now;

    const rows: Row[] = [];

    for (let i = 0; i < N; i++) {
      // ✅ slightly wider spacing so it covers more time (still looks active)
      const step =
        canon.asset === "crypto"
          ? 260 + Math.round(rnd() * 720)
          : canon.asset === "futures"
            ? 180 + Math.round(rnd() * 600)
            : 320 + Math.round(rnd() * 920);

      t -= step;

      let side: Side = rnd() < 0.43 ? "B" : rnd() < 0.86 ? "S" : "M";

      const inSweep = doSweep && i >= sweepStart && i < sweepStart + sweepLen;
      if (inSweep) side = sweepSide;

      let inside = anchor;

      // prints lean on inside market when bid/ask exists
      if (haveBA && bid !== undefined && ask !== undefined) {
        if (side === "B") inside = ask;
        else if (side === "S") inside = bid;
        else inside = mid;
      }

      const micro = (rnd() - 0.5) * wiggleAmp;
      const px = clamp(inside + micro, anchor - wiggleAmp, anchor + wiggleAmp);

      const price = roundPx(canon.asset, Math.max(tick, px));

      let size: number;

      if (canon.asset === "crypto") {
        if (inSweep) size = Number((2 + rnd() * 4.5).toFixed(4));
        else size = Number((0.01 + rnd() * 0.12).toFixed(4));
      } else if (canon.asset === "futures") {
        if (inSweep) size = Math.round(10 + rnd() * 90);
        else size = Math.round(1 + rnd() * 25);
      } else {
        if (inSweep) size = Math.round(1200 + rnd() * 6800);
        else size = Math.round(50 + rnd() * 850);
      }

      const futVenue = futRoot ? (FUTURES_VENUES[futRoot] ?? "CME") : "CME";

      rows.push({
        ts: new Date(t).toISOString(),
        price,
        size,
        side,
        venue:
          canon.asset === "futures"
            ? inSweep ? `${futVenue}-SWEEP` : futVenue
            : canon.asset === "crypto"
              ? inSweep ? "SIM-SWEEP" : "SIM-CRYPTO"
              : inSweep ? "SIM-SWEEP" : "SIM-STK",
      });
    }

    return NextResponse.json({
      ok: true,
      provider: canon.provider,
      asset: canon.asset,
      symbol: canon.symbol,
      price: canon.price,
      mid: canon.mid,
      bid: canon.bid,
      ask: canon.ask,
      ts: new Date().toISOString(),
      prints: rows,
      data: rows,
      warn: canon.warn || "",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "market tape failed", prints: [], data: [] },
      { status: 200 }
    );
  }
}