import { NextResponse } from "next/server";

type Side = "B" | "S" | "M";
type Row = { ts: string; price: number; size: number; side: Side };

function pickSym(s: string | null) {
  const raw = (s || "AAPL").toUpperCase().trim();
  return raw.includes("-") ? raw.split("-")[0] : raw; // BTC-USD -> BTC
}

function isCryptoSymbol(raw: string) {
  const s = (raw || "").toUpperCase().trim();
  return s.includes("-USD") || ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "BNB", "MATIC"].includes(s);
}

/** ------------------ FREE price source (CoinGecko) ------------------ */
/**
 * No key needed. We'll cache to avoid rate limits.
 */
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
    // allow Next to reuse a little
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
function baseStockPrice(symbol: string) {
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
    const base = pickSym(symbolParam);

    const assetParam = (url.searchParams.get("asset") || "").toLowerCase().trim();
    const treatAsCrypto = assetParam === "crypto" || isCryptoSymbol(symbolParam);

    // ✅ choose correct mid price
    let mid = baseStockPrice(base);

    if (treatAsCrypto) {
      const live = await getCryptoUsdPrice(base);
      if (live != null) mid = live;
      else {
        // fallback if unknown crypto
        if (base === "BTC") mid = 43000;
        else if (base === "ETH") mid = 2300;
      }
    }

    // Demo prints (stable + "alive") around the mid
    const now = Date.now();
    const data: Row[] = Array.from({ length: 60 }).map((_, i) => {
      const t = now - i * 900; // 0.9s apart
      const wiggle = Math.sin((now / 1000 + i) * 0.9) * (treatAsCrypto ? mid * 0.0006 : mid * 0.0003);
      const drift = ((now / 1000 + i) % 20) * (treatAsCrypto ? 0.02 : 0.01);
      const price = Number((mid + wiggle + drift).toFixed(2));

      const sizeBase = treatAsCrypto ? 0.02 : 100;
      const size = Number((sizeBase + ((i * 17) % (treatAsCrypto ? 4 : 900)) * (treatAsCrypto ? 0.01 : 1)).toFixed(4));

      const side: Side = i % 3 === 0 ? "B" : i % 3 === 1 ? "S" : "M";
      return { ts: new Date(t).toISOString(), price, size, side };
    });

    return NextResponse.json({ ok: true, data, symbol: symbolParam, mid });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "market tape failed", data: [] },
      { status: 500 }
    );
  }
}
