import { NextResponse } from "next/server";

type Level = { price: number; size: number };

function pickSym(s: string | null) {
  const raw = (s || "AAPL").toUpperCase().trim();
  return raw.includes("-") ? raw.split("-")[0] : raw; // BTC-USD -> BTC
}

function isCryptoSymbol(rawParam: string) {
  const s = (rawParam || "").toUpperCase().trim();
  return s.includes("-USD") || ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "BNB", "MATIC"].includes(s);
}

/** ------------------ FREE price source (CoinGecko) ------------------ */
const PRICE_TTL_MS = 20_000;
const priceCache = new Map<string, { expiresAt: number; price: number }>();

const CG_IDS: Record<string, string> = {
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

async function getCryptoUsdPrice(base: string): Promise<number | null> {
  const id = CG_IDS[base];
  if (!id) return null;

  const key = `cg:${id}`;
  const hit = priceCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.price;

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    id
  )}&vs_currencies=usd`;

  const r = await fetch(url, {
    cache: "force-cache",
    next: { revalidate: Math.ceil(PRICE_TTL_MS / 1000) },
  });

  if (!r.ok) return null;

  const j = await r.json().catch(() => ({}));
  const p = Number(j?.[id]?.usd);

  if (!Number.isFinite(p) || p <= 0) return null;

  priceCache.set(key, { price: p, expiresAt: Date.now() + PRICE_TTL_MS });
  return p;
}

/** ------------------ Stock demo base prices ------------------ */
function midStock(symbol: string) {
  if (symbol === "AAPL") return 185.12;
  if (symbol === "TSLA") return 242.55;
  if (symbol === "NVDA") return 912.35;
  if (symbol === "SPY") return 490.08;
  return 100;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const symbolParam = (url.searchParams.get("symbol") || "AAPL").toUpperCase().trim();
    const assetParam = (url.searchParams.get("asset") || "").toLowerCase().trim();

    const base = pickSym(symbolParam);
    const treatAsCrypto = assetParam === "crypto" || isCryptoSymbol(symbolParam);

    let mid = midStock(base);

    if (treatAsCrypto) {
      const live = await getCryptoUsdPrice(base);
      if (live != null) mid = live;
      else {
        // sensible fallback if unsupported coin
        if (base === "BTC") mid = 43000;
        else if (base === "ETH") mid = 2300;
      }
    }

    // spread step: crypto needs bigger ticks than stocks
    const step = treatAsCrypto
      ? Math.max(0.01, mid * 0.00005) // ~0.005% tick
      : 0.01;

    // sizes: crypto smaller; stocks bigger
    const sizeBase = treatAsCrypto ? 0.05 : 1000;
    const sizeStep = treatAsCrypto ? 0.03 : 250;

    const bids: Level[] = Array.from({ length: 25 }).map((_, i) => ({
      price: Number((mid - step * (i + 1)).toFixed(2)),
      size: Number((sizeBase + i * sizeStep).toFixed(4)),
    }));

    const asks: Level[] = Array.from({ length: 25 }).map((_, i) => ({
      price: Number((mid + step * (i + 1)).toFixed(2)),
      size: Number((sizeBase + i * sizeStep).toFixed(4)),
    }));

    return NextResponse.json({
      ok: true,
      data: { bids, asks, ts: new Date().toISOString(), symbol: symbolParam, mid },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "market depth failed", data: { bids: [], asks: [] } },
      { status: 500 }
    );
  }
}
