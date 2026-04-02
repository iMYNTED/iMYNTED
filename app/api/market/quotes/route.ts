// app/api/market/quotes/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Asset = "stock" | "crypto";

type QuoteMini = {
  symbol: string;
  asset: Asset;

  price: number;
  bid: number;
  ask: number;
  mid: number;
  last: number;

  ts: string;
  provider: "mock";
  warn?: string;
};

function normSym(raw: string) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.\-]/g, "");
}

function normalizeCryptoSymbol(raw: string) {
  const s = normSym(raw);
  if (!s) return "BTC-USD";
  if (s.includes("-")) return s;
  if (s.endsWith("USD")) return s.replace(/USD$/, "-USD");
  return `${s}-USD`;
}

const CRYPTO_BASES = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "BNB", "MATIC"] as const;

function detectAsset(symbol: string): Asset {
  const s = normSym(symbol);
  if (s.includes("-USD")) return "crypto";
  if ((CRYPTO_BASES as readonly string[]).includes(s)) return "crypto";
  return "stock";
}

function tickFor(asset: Asset, px: number) {
  if (!Number.isFinite(px) || px <= 0) return 0.01;
  if (asset === "stock") return px >= 1 ? 0.01 : 0.0001;

  if (px >= 100) return 0.05;
  if (px >= 1) return 0.01;
  if (px >= 0.01) return 0.0001;
  return 0.000001;
}

function roundPx(asset: Asset, px: number) {
  if (!Number.isFinite(px)) return px;
  if (asset === "stock") return Number(px.toFixed(px >= 1 ? 2 : 4));
  if (px >= 100) return Number(px.toFixed(2));
  if (px >= 1) return Number(px.toFixed(4));
  return Number(px.toFixed(6));
}

function midFrom(bid: number, ask: number) {
  return (bid + ask) / 2;
}

function synthesizeBidAsk(asset: Asset, price: number) {
  const t = tickFor(asset, price);
  const bid = Math.max(0, price - t);
  const ask = price + t;
  return { bid: roundPx(asset, bid), ask: roundPx(asset, ask) };
}

/** ------------------ Deterministic Mock (matches /market/quote) ------------------ */
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

function mockPrice(asset: Asset, symbol: string) {
  // ✅ 60s bucket so /quotes agrees with /quote + /tape anchor
  const bucket = Math.floor(Date.now() / 60_000);
  const seed = hash32(`${asset}:${symbol}:${bucket}`);
  const rnd = makeRng(seed);

  const baseHash = hash32(symbol);
  const base = asset === "crypto" ? 1000 + (baseHash % 50_000) : 50 + (baseHash % 200);

  const wiggle = (rnd() - 0.5) * (asset === "crypto" ? base * 0.0012 : 1.2);
  const px = Math.max(asset === "crypto" ? 0.000001 : 1, base + wiggle);

  return roundPx(asset, px);
}

function mockQuoteMini(symbolRaw: string, asset: Asset): QuoteMini {
  const symbol = asset === "crypto" ? normalizeCryptoSymbol(symbolRaw) : normSym(symbolRaw) || "AAPL";

  const last = mockPrice(asset, symbol);
  const { bid, ask } = synthesizeBidAsk(asset, last);
  const mid = roundPx(asset, midFrom(bid, ask));

  const ts = new Date().toISOString();

  return {
    symbol,
    asset,
    last,
    price: last,
    bid,
    ask,
    mid,
    ts,
    provider: "mock",
  };
}

/** ------------------ Route ------------------ */
/**
 * SIM MODE bulk quotes:
 * - Deterministic (60s bucket)
 * - Stable keys (dataBySymbol uses normalized symbol)
 * - No upstream calls (RapidAPI / internal crypto) to avoid drift + timeouts
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  const assetParam = (url.searchParams.get("asset") || "").toLowerCase().trim();
  const forceCrypto = assetParam === "crypto";
  const forceStock = assetParam === "stock";

  const symbolsRaw =
    url.searchParams.get("symbols") ||
    url.searchParams.get("symbol") ||
    url.searchParams.get("ticker") ||
    "AAPL";

  const rawList = symbolsRaw
    .split(",")
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .slice(0, 50);

  // normalize input -> stable symbol strings
  const symbols = rawList
    .map((s) => {
      const guessed = detectAsset(s);
      const wantCrypto = forceCrypto ? true : forceStock ? false : guessed === "crypto";
      return wantCrypto ? normalizeCryptoSymbol(s) : normSym(s);
    })
    .filter(Boolean);

  if (!symbols.length) {
    return NextResponse.json(
      { ok: false, error: "Missing symbols", ts: new Date().toISOString() },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const dataBySymbol: Record<string, QuoteMini> = {};
  for (const s of symbols) {
    const a = forceCrypto ? "crypto" : forceStock ? "stock" : detectAsset(s);
    const key = a === "crypto" ? normalizeCryptoSymbol(s) : normSym(s);
    dataBySymbol[key] = mockQuoteMini(key, a);
  }

  const rows = symbols.map((s) => {
    const a = forceCrypto ? "crypto" : forceStock ? "stock" : detectAsset(s);
    const key = a === "crypto" ? normalizeCryptoSymbol(s) : normSym(s);
    return dataBySymbol[key];
  });

  return NextResponse.json(
    {
      ok: true,
      provider: "mock",
      ts: new Date().toISOString(),
      asset: assetParam || "mixed",
      symbols,
      dataBySymbol,

      // legacy aliases (some components expect these)
      data: rows,
      quotes: rows,
      rows,
      warn: "",
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}