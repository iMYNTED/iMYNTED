// app/api/crypto/quote/route.ts
import { NextResponse } from "next/server";

type Asset = "crypto";

type Quote = {
  symbol: string; // e.g. BTC-USD
  asset: Asset;

  price: number; // display price (mid preferred when bid/ask exist)
  bid?: number;
  ask?: number;
  mid?: number;

  chg: number;
  chgPct: number;

  ts: string;
  provider: "coingecko";
};

const COIN_ID: Record<string, string> = { /* eslint-disable-line prefer-const */
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  BNB: "binancecoin",
  MATIC: "polygon",
};

function normSym(x: string) {
  return (x || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").trim();
}

function parseCryptoSymbol(input: string) {
  const raw = normSym(input || "");
  const base = raw.includes("-") ? raw.split("-")[0] : raw;
  const pair = raw
    ? raw.includes("-")
      ? raw
      : raw.endsWith("USD")
        ? raw.replace(/USD$/, "-USD")
        : `${base}-USD`
    : "BTC-USD";
  return { base: base || "BTC", pair };
}

/** match unified quote route crypto ticks */
function tickFor(px: number) {
  if (!Number.isFinite(px) || px <= 0) return 0.01;
  if (px >= 100) return 0.05;
  if (px >= 1) return 0.01;
  if (px >= 0.01) return 0.0001;
  return 0.000001;
}

/** match unified quote route crypto rounding */
function roundPx(px: number) {
  if (!Number.isFinite(px)) return px;
  if (px >= 100) return Number(px.toFixed(2));
  if (px >= 1) return Number(px.toFixed(4));
  return Number(px.toFixed(6));
}

function ensureBidAsk(price: number, bid?: number, ask?: number) {
  const t = tickFor(price);

  if (bid !== undefined && ask === undefined) ask = bid + t;
  if (ask !== undefined && bid === undefined) bid = Math.max(0, ask - t);

  if (bid === undefined && ask === undefined) {
    bid = Math.max(0, price - t);
    ask = price + t;
  }

  if (bid !== undefined && ask !== undefined && ask < bid) {
    const m = (bid + ask) / 2;
    bid = Math.max(0, m - t / 2);
    ask = m + t / 2;
  }

  return {
    bid: bid !== undefined ? roundPx(bid) : undefined,
    ask: ask !== undefined ? roundPx(ask) : undefined,
  };
}

function midFrom(bid?: number, ask?: number) {
  if (bid === undefined || ask === undefined) return undefined;
  if (!Number.isFinite(bid) || !Number.isFinite(ask)) return undefined;
  if (bid <= 0 || ask <= 0) return undefined;
  return (bid + ask) / 2;
}

/** small TTL cache to avoid CG rate limit + UI mismatches */
const CG_TTL_MS = 20_000;
const cache = new Map<string, { expiresAt: number; quote: Quote }>();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const symbolParam = url.searchParams.get("symbol") || "BTC-USD";

    const { base, pair } = parseCryptoSymbol(symbolParam);
    let id = COIN_ID[base];

    // Dynamic CoinGecko ID lookup for unknown symbols
    if (!id) {
      try {
        const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(base)}`;
        const searchRes = await fetch(searchUrl, { cache: "force-cache", next: { revalidate: 3600 } });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const match = searchData?.coins?.find((c: any) =>
            c.symbol?.toUpperCase() === base
          );
          if (match?.id) {
            id = match.id;
            // Cache for future requests
            COIN_ID[base] = id;
          }
        }
      } catch {}
    }

    if (!id) {
      return NextResponse.json(
        { ok: false, error: `Unknown crypto symbol ${base}` },
        { status: 400 }
      );
    }

    const cacheKey = `cg:${id}`;
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return NextResponse.json({ ok: true, provider: "coingecko", data: hit.quote });
    }

    const cg = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
      id
    )}&vs_currencies=usd&include_24hr_change=true`;

    const r = await fetch(cg, {
      cache: "force-cache",
      next: { revalidate: Math.ceil(CG_TTL_MS / 1000) },
    });

    if (!r.ok) throw new Error(`CoinGecko ${r.status}`);

    const j = await r.json().catch(() => ({}));

    const rawPrice = Number(j?.[id]?.usd);
    const rawChgPct = Number(j?.[id]?.usd_24h_change ?? 0);

    if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
      throw new Error("CoinGecko returned invalid price");
    }

    const chgPct = Number.isFinite(rawChgPct) ? rawChgPct : 0;
    const chg = (rawPrice * chgPct) / 100;

    // synthesize inside market so Trader/Header/L2/Tape align
    const { bid, ask } = ensureBidAsk(rawPrice);
    const mid = midFrom(bid, ask);

    const outPrice = mid ?? rawPrice;

    const quote: Quote = {
      symbol: pair,
      asset: "crypto",
      price: roundPx(outPrice),
      bid,
      ask,
      mid: mid !== undefined ? roundPx(mid) : undefined,
      chg: Number((chg || 0).toFixed(4)),
      chgPct: Number((chgPct || 0).toFixed(2)),
      ts: new Date().toISOString(),
      provider: "coingecko",
    };

    cache.set(cacheKey, { expiresAt: Date.now() + CG_TTL_MS, quote });

    return NextResponse.json({ ok: true, provider: "coingecko", data: quote });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "crypto quote failed" },
      { status: 500 }
    );
  }
}