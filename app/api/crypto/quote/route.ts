import { NextResponse } from "next/server";

const COIN_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  BNB: "binancecoin",
};

function parseCryptoSymbol(input: string) {
  const raw = (input || "").toUpperCase().trim();
  const base = raw.includes("-") ? raw.split("-")[0] : raw;
  const pair = raw.includes("-") ? raw : `${base}-USD`;
  return { base, pair };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const symbol = url.searchParams.get("symbol") || "BTC-USD";
    const { base, pair } = parseCryptoSymbol(symbol);

    const id = COIN_ID[base];
    if (!id) {
      return NextResponse.json(
        { ok: false, error: `Unsupported crypto ${base}. Add mapping in COIN_ID.` },
        { status: 400 }
      );
    }

    const cg = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
      id
    )}&vs_currencies=usd&include_24hr_change=true`;

    const r = await fetch(cg, { cache: "no-store" });
    if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
    const j = await r.json();

    const price = Number(j?.[id]?.usd ?? 0);
    const chgPct = Number(j?.[id]?.usd_24h_change ?? 0);
    const chg = price && chgPct ? (price * chgPct) / 100 : 0;

    return NextResponse.json({
      ok: true,
      data: {
        symbol: pair,
        price,
        chg,
        chgPct,
        ts: new Date().toISOString(),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "crypto quote failed" },
      { status: 500 }
    );
  }
}
