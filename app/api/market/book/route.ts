// app/api/market/book/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Asset = "stock" | "crypto";
type Level = { px: number; sz: number };
type Book = { bids: Level[]; asks: Level[] };

function normSym(raw: string) {
  return String(raw || "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.\-]/g, "");
}

const CRYPTO_BASES = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "BNB", "MATIC"] as const;

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
  if (a === "stock" || a === "crypto") return a;
  return isCryptoSymbol(symbol) ? "crypto" : "stock";
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function n(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;
  const x = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : undefined;
}

function decFor(asset: Asset, px: number) {
  if (asset === "stock") return px >= 1 ? 2 : 4;
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

  if (asset === "stock") return px >= 1 ? 0.01 : 0.0001;

  // crypto
  if (px >= 100) return 0.05;
  if (px >= 1) return 0.01;
  if (px >= 0.01) return 0.0001;
  return 0.000001;
}

/* ----------------------------- origin helpers ----------------------------- */

function safeOriginFromRequest(req: Request) {
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}

function getOriginFromHeaders(req: Request) {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  if (!host) return "";
  return `${proto}://${host}`;
}

function safeEnvOrigin() {
  const b = process.env.NEXT_PUBLIC_BASE_URL;
  if (b && b.startsWith("http")) return b;

  const v = process.env.VERCEL_URL;
  if (v) return v.startsWith("http") ? v : `https://${v}`;

  return "";
}

/* ----------------------------- deterministic RNG ----------------------------- */

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
 * Canonical quote fetch (same as everything else).
 * Anchor simulated book around quote.price; only trust mid if bid+ask exist and >0.
 */
async function fetchCanonicalQuote(req: Request, symbol: string, asset: Asset) {
  const origin = safeOriginFromRequest(req) || getOriginFromHeaders(req) || safeEnvOrigin();
  if (!origin) return null;

  const url = `${origin}/api/market/quote?symbol=${encodeURIComponent(symbol)}&asset=${asset}`;

  const res = await fetch(url, { cache: "no-store" }).catch(() => null as any);
  if (!res || !res.ok) return null;

  const j: any = await res.json().catch(() => ({}));
  const d = j?.data ?? j ?? {};

  const price = n(d?.price ?? d?.last ?? d?.px ?? d?.c);
  const bid = n(d?.bid ?? d?.b);
  const ask = n(d?.ask ?? d?.a);

  const px = price && price > 0 ? price : undefined;
  const bb = bid && bid > 0 ? bid : undefined;
  const aa = ask && ask > 0 ? ask : undefined;

  const mid = bb !== undefined && aa !== undefined ? (bb + aa) / 2 : undefined;

  return {
    symbol: String(d?.symbol ?? symbol),
    asset,
    price: px,
    bid: bb,
    ask: aa,
    mid,
    provider: String(d?.provider ?? j?.provider ?? "quote"),
    ts: typeof (d?.ts ?? j?.ts) === "string" ? String(d.ts ?? j.ts) : new Date().toISOString(),
    warn: typeof j?.warn === "string" ? String(j.warn) : "",
  };
}

/**
 * Tight, simulated book around an anchor price.
 * ✅ 2.5s bucket (feels alive, still deterministic)
 * ✅ depth from query
 */
function buildSimBook(asset: Asset, symbol: string, anchor: number, depth: number): Book {
  const bids: Level[] = [];
  const asks: Level[] = [];

  const px = Math.max(0.000001, anchor);
  const tick = tickFor(asset, px);

  // ✅ match UI cadence: alive but not jittery
  const bucket = Math.floor(Date.now() / 2500);
  const rnd = makeRng(hash32(`${asset}:${symbol}:book:${bucket}:${Math.round(px / tick)}`));

  for (let i = 0; i < depth; i++) {
    const bpx = roundPx(asset, Math.max(0.000001, px - (i + 1) * tick));
    const apx = roundPx(asset, px + (i + 1) * tick);

    let bsz: number;
    let asz: number;

    if (asset === "crypto") {
      const baseB = 0.03 + ((i * 13) % 6) * 0.01;
      const baseA = 0.03 + ((i * 17) % 6) * 0.01;

      // jitter +/- ~12%
      const jb = 1 + (rnd() - 0.5) * 0.24;
      const ja = 1 + (rnd() - 0.5) * 0.24;

      bsz = Number((baseB * jb).toFixed(4));
      asz = Number((baseA * ja).toFixed(4));

      bsz = Math.max(0.0001, bsz);
      asz = Math.max(0.0001, asz);
    } else {
      const baseB = 250 + ((i * 733) % 9000);
      const baseA = 250 + ((i * 911) % 9000);

      // jitter +/- ~18%
      const jb = 1 + (rnd() - 0.5) * 0.36;
      const ja = 1 + (rnd() - 0.5) * 0.36;

      bsz = Math.max(1, Math.round(baseB * jb));
      asz = Math.max(1, Math.round(baseA * ja));
    }

    bids.push({ px: bpx, sz: bsz });
    asks.push({ px: apx, sz: asz });
  }

  return { bids, asks };
}

/**
 * Optional: if you later restore a real L2 provider, plug it here.
 * For now return null so we fall back to quote-anchored sim.
 */
async function fetchRealBook(_symbol: string, _asset: Asset): Promise<Book | null> {
  return null;
}

function sendJson(payload: any, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const rawSymbol = url.searchParams.get("symbol") || "AAPL";
    const asset = detectAsset(rawSymbol, url.searchParams.get("asset"));

    const symbol = asset === "crypto" ? normalizeCryptoSymbol(rawSymbol) : normSym(rawSymbol) || "AAPL";

    // ✅ IMPORTANT: default depth 16 so UI doesn’t look short
    const depth = clamp(Number(url.searchParams.get("depth") || 16), 5, 50);

    // 1) Try real L2 provider (currently none)
    const real = await fetchRealBook(symbol, asset);
    if (real) {
      const bestBid = real.bids?.[0]?.px;
      const bestAsk = real.asks?.[0]?.px;
      const mid =
        Number.isFinite(bestBid as any) && Number.isFinite(bestAsk as any)
          ? ((bestBid as number) + (bestAsk as number)) / 2
          : undefined;

      return sendJson({
        ok: true,
        provider: "l2-provider",
        asset,
        symbol,
        bid: bestBid,
        ask: bestAsk,
        mid,
        ts: new Date().toISOString(),

        bids: real.bids,
        asks: real.asks,

        data: { bids: real.bids, asks: real.asks, bid: bestBid, ask: bestAsk, mid },
      });
    }

    // 2) Canonical quote anchor
    const q = await fetchCanonicalQuote(req, symbol, asset);

    const fallbackAnchor =
      asset === "crypto"
        ? symbol.startsWith("BTC")
          ? 43000
          : symbol.startsWith("ETH")
            ? 2300
            : 1000
        : 100;

    // prefer quote.mid when it is real (bid+ask), otherwise quote.price
    const anchor = q?.mid && q.mid > 0 ? q.mid : q?.price && q.price > 0 ? q.price : fallbackAnchor;

    const book = buildSimBook(asset, symbol, anchor, depth);

    const bestBid = book.bids?.[0]?.px;
    const bestAsk = book.asks?.[0]?.px;

    const bookMid =
      Number.isFinite(bestBid as any) && Number.isFinite(bestAsk as any)
        ? ((bestBid as number) + (bestAsk as number)) / 2
        : anchor;

    return sendJson({
      ok: true,
      provider: q?.provider ? `${q.provider}:quote-anchored-sim` : "quote-anchored-sim",
      asset,
      symbol,

      // must match the book we return
      bid: bestBid,
      ask: bestAsk,
      mid: bookMid,

      // canonical price for debug overlays
      price: q?.price ?? anchor,

      ts: new Date().toISOString(),
      warn: "l2_simulated",

      // backward compat
      bids: book.bids,
      asks: book.asks,

      data: {
        bids: book.bids,
        asks: book.asks,
        bestBid,
        bestAsk,
        mid: bookMid,
        quote: q
          ? {
              price: q.price,
              bid: q.bid,
              ask: q.ask,
              mid: q.mid,
              provider: q.provider,
              ts: q.ts,
              warn: q.warn || "",
            }
          : null,
      },
    });
  } catch (e: any) {
    return sendJson(
      {
        ok: false,
        error: e?.message || "book failed",
        data: { bids: [], asks: [] },
        bids: [],
        asks: [],
      },
      500
    );
  }
}