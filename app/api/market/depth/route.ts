// app/api/market/depth/route.ts
import { NextResponse } from "next/server";

type Asset = "stock" | "crypto" | "futures";
type Level = { px: number; sz: number; exch: string };
type Book = { bids: Level[]; asks: Level[] };

function normSym(raw: string) {
  return String(raw || "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.\-]/g, "");
}

const CRYPTO_BASES = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "BNB", "MATIC"] as const;

const FUTURES_ROOTS_DEPTH = ["ES","NQ","YM","RTY","MES","MNQ","CL","NG","GC","SI","HG","ZB","ZN","ZC","ZS","ZW","6E","6J"] as const;
const FUTURES_TICK: Record<string, number> = {
  ES:0.25, NQ:0.25, YM:1, RTY:0.1, MES:0.25, MNQ:0.25,
  CL:0.01, NG:0.001, GC:0.10, SI:0.005, HG:0.0005,
  ZB:0.03125, ZN:0.015625, ZC:0.25, ZS:0.25, ZW:0.25,
  "6E":0.00005, "6J":0.0000005,
};
const FUTURES_BASE_DEPTH: Record<string, number> = {
  ES:5250, NQ:18200, YM:39400, RTY:2080, MES:5250, MNQ:18200,
  CL:77.5, NG:2.15, GC:2320, SI:27.8, HG:4.25,
  ZB:117, ZN:109, ZC:445, ZS:1095, ZW:555,
  "6E":1.082, "6J":0.00672,
};

function normFutRoot(raw: string): string {
  const s = (raw||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  return s.replace(/[FGHJKMNQUVXZ]\d{1,2}$/,"");
}
function isFuturesDepth(raw: string): boolean {
  return !!(FUTURES_BASE_DEPTH[normFutRoot(raw)]);
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
  if (a === "stock" || a === "crypto" || a === "futures") return a as Asset;
  if (isFuturesDepth(symbol)) return "futures";
  return isCryptoSymbol(symbol) ? "crypto" : "stock";
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function n(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;
  const x = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : undefined;
}

function decFor(asset: Asset, px: number) {
  if (asset === "stock") return px >= 1 ? 2 : 4;
  if (asset === "futures") {
    if (px >= 1000) return 2;
    if (px >= 10) return 3;
    return 6;
  }
  if (px >= 100) return 2;
  if (px >= 1) return 4;
  return 6;
}

function roundPx(asset: Asset, px: number) {
  const d = decFor(asset, px);
  return Number(px.toFixed(d));
}

function tickFor(asset: Asset, px: number) {
  if (!Number.isFinite(px) || px <= 0) return 0.01;
  if (asset === "futures") {
    // will be overridden per-symbol when building the book
    return 0.01;
  }
  if (asset === "stock") return px >= 1 ? 0.01 : 0.0001;
  // crypto
  if (px >= 100) return 0.05;
  if (px >= 1) return 0.01;
  if (px >= 0.01) return 0.0001;
  return 0.000001;
}

/**
 * Canonical quote fetch:
 * Prefer relative fetch (same Next server). If that fails, fall back to absolute origin.
 */
const depthQuoteCache = new Map<string, { data: any; ts: number }>();
const DEPTH_CACHE_TTL = 15000;

async function fetchCanonicalQuote(req: Request, symbol: string, asset: Asset) {
  const ck = `${asset}:${symbol}`;
  const cached = depthQuoteCache.get(ck);
  if (cached && Date.now() - cached.ts < DEPTH_CACHE_TTL) return cached.data;
  const qs = `symbol=${encodeURIComponent(symbol)}&asset=${encodeURIComponent(asset)}`;

  // Derive origin from the incoming request URL
  let origin = "";
  try { origin = new URL(req.url).origin; } catch {}
  if (!origin) {
    origin =
      (process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.startsWith("http")
        ? process.env.NEXT_PUBLIC_BASE_URL
        : "") ||
      (process.env.VERCEL_URL ? (process.env.VERCEL_URL.startsWith("http") ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`) : "");
  }

  if (!origin) return null;

  let res: Response | null = null;
  try {
    res = await fetch(`${origin}/api/market/quote?${qs}`, { cache: "no-store" });
  } catch {
    res = null;
  }

  if (!res || !res.ok) {
    if (cached) return cached.data; // stale fallback
    return null;
  }

  const j: any = await res.json().catch(() => ({}));
  const d = j?.data ?? j ?? {};

  const price = n(d?.price ?? d?.last ?? d?.px ?? d?.c);
  const bid = n(d?.bid ?? d?.b);
  const ask = n(d?.ask ?? d?.a);
  const mid = n(d?.mid);

  const px = price && price > 0 ? price : undefined;
  const bb = bid && bid > 0 ? bid : undefined;
  const aa = ask && ask > 0 ? ask : undefined;

  const m =
    mid && mid > 0
      ? mid
      : bb !== undefined && aa !== undefined
        ? (bb + aa) / 2
        : undefined;

  const result = {
    symbol: String(d?.symbol ?? symbol),
    asset,
    price: px,
    bid: bb,
    ask: aa,
    mid: m,
    provider: String(j?.provider ?? d?.provider ?? "quote"),
    ts: typeof (d?.ts ?? j?.ts) === "string" ? String(d.ts ?? j.ts) : new Date().toISOString(),
  };
  depthQuoteCache.set(ck, { data: result, ts: Date.now() });
  return result;
}

/**
 * Depth book around an anchor price.
 * Deterministic sizes + correct tick/decimals.
 */
const STOCK_EXCHANGES = ["ARCA", "NSDQ", "NYSE", "EDGX", "BATS", "ARCA", "NSDQ", "ARCA"];
const CRYPTO_EXCHANGES = ["CBSE", "BNCE", "KRKN", "GEMI", "CBSE", "BNCE", "CBSE", "KRKN"];

function buildSimBook(asset: Asset, anchor: number, depth: number, symbol = ""): Book {
  const bids: Level[] = [];
  const asks: Level[] = [];

  const px = Math.max(0.000001, anchor);
  const root = asset === "futures" ? normFutRoot(symbol) : "";
  const tick = asset === "futures" ? (FUTURES_TICK[root] ?? tickFor(asset, px)) : tickFor(asset, px);
  const FUTURES_EXCHANGES = ["CME","CBOT","NYMEX","COMEX","CME","CBOT","NYMEX","CME"];
  const exchList = asset === "futures" ? FUTURES_EXCHANGES : (asset === "crypto" ? CRYPTO_EXCHANGES : STOCK_EXCHANGES);

  for (let i = 0; i < depth; i++) {
    const bpx = roundPx(asset, Math.max(0.000001, px - (i + 1) * tick));
    const apx = roundPx(asset, px + (i + 1) * tick);

    let bsz: number;
    let asz: number;

    if (asset === "crypto") {
      bsz = Number((0.03 + ((i * 13) % 6) * 0.01).toFixed(4));
      asz = Number((0.03 + ((i * 17) % 6) * 0.01).toFixed(4));
    } else {
      bsz = Math.round(250 + ((i * 733) % 9000));
      asz = Math.round(250 + ((i * 911) % 9000));
    }

    bids.push({ px: bpx, sz: bsz, exch: exchList[i % exchList.length] });
    asks.push({ px: apx, sz: asz, exch: exchList[(i + 2) % exchList.length] });
  }

  return { bids, asks };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const rawSymbol = url.searchParams.get("symbol") || "AAPL";
    const asset = detectAsset(rawSymbol, url.searchParams.get("asset"));

    const symbol = asset === "crypto" ? normalizeCryptoSymbol(rawSymbol) : asset === "futures" ? normFutRoot(rawSymbol) || normSym(rawSymbol) || "ES" : normSym(rawSymbol) || "AAPL";

    const depth = clamp(Number(url.searchParams.get("depth") || 60), 5, 60);

    const q = await fetchCanonicalQuote(req, symbol, asset);

    const fallbackAnchor =
      asset === "futures"
        ? (FUTURES_BASE_DEPTH[normFutRoot(symbol)] ?? 100)
        : asset === "crypto"
          ? symbol.startsWith("BTC")
            ? 43000
            : symbol.startsWith("ETH")
              ? 2300
              : 1000
          : 100;

    const anchor =
      (q?.mid && q.mid > 0 ? q.mid : undefined) ??
      (q?.price && q.price > 0 ? q.price : undefined) ??
      fallbackAnchor;

    const book = buildSimBook(asset, anchor, depth, symbol);

    const bestBid = book.bids?.[0]?.px;
    const bestAsk = book.asks?.[0]?.px;
    const simMid =
      Number.isFinite(bestBid as any) && Number.isFinite(bestAsk as any)
        ? ((bestBid as number) + (bestAsk as number)) / 2
        : anchor;

    const outMid = q?.mid ?? simMid;

    return NextResponse.json({
      ok: true,
      provider: q?.provider ? `${q.provider}:quote-anchored-depth` : "quote-anchored-depth",
      asset,
      symbol,
      mid: outMid,
      bid: q?.bid,
      ask: q?.ask,
      ts: new Date().toISOString(),

      // ✅ aliases so any consumer works
      bids: book.bids,
      asks: book.asks,

      data: {
        bids: book.bids,
        asks: book.asks,
        bestBid,
        bestAsk,
        mid: simMid,
        quote: q
          ? {
              price: q.price,
              bid: q.bid,
              ask: q.ask,
              mid: q.mid,
              provider: q.provider,
              ts: q.ts,
            }
          : null,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "market depth failed", data: { bids: [], asks: [] } },
      { status: 200 }
    );
  }
}