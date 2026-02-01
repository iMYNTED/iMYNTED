import { NextResponse } from "next/server";

type Level = { price: number; size: number };

function normProductId(sym: string | null) {
  const raw = (sym || "BTC-USD").toUpperCase().trim();
  // Accept "BTC", "BTC-USD", "BTCUSDT" etc. -> normalize to BTC-USD
  if (raw === "BTC" || raw === "XBT") return "BTC-USD";
  if (raw === "ETH") return "ETH-USD";
  if (raw === "SOL") return "SOL-USD";
  if (raw === "XRP") return "XRP-USD";

  if (raw.includes("-")) return raw;
  if (raw.endsWith("USDT")) return `${raw.replace("USDT", "")}-USD`;
  if (raw.endsWith("USD")) return `${raw.replace("USD", "")}-USD`;

  return `${raw}-USD`;
}

function toNum(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const productId = normProductId(url.searchParams.get("symbol"));

    // Coinbase Exchange public order book (level=2)
    const bookUrl = `https://api.exchange.coinbase.com/products/${encodeURIComponent(
      productId
    )}/book?level=2`;

    const r = await fetch(bookUrl, {
      cache: "no-store",
      headers: {
        // Some environments behave better with an explicit UA
        "User-Agent": "MySentinelAtlas/1.0",
        Accept: "application/json",
      },
    });

    // If Coinbase throttles, return friendly empty book (don’t crash UI)
    if (r.status === 429) {
      return NextResponse.json(
        {
          ok: true,
          data: { bids: [], asks: [], ts: new Date().toISOString(), symbol: productId },
          warning: "Coinbase rate-limited (429) — try again in a moment.",
        },
        { status: 200 }
      );
    }

    if (!r.ok) throw new Error(`Coinbase book ${r.status}`);

    const j = await r.json();

    // Coinbase shape: { bids: [[price,size,numOrders],...], asks: [[...]] }
    const bids: Level[] = Array.isArray(j?.bids)
      ? j.bids.slice(0, 25).map((row: any[]) => ({
          price: toNum(row?.[0]),
          size: toNum(row?.[1]),
        }))
      : [];

    const asks: Level[] = Array.isArray(j?.asks)
      ? j.asks.slice(0, 25).map((row: any[]) => ({
          price: toNum(row?.[0]),
          size: toNum(row?.[1]),
        }))
      : [];

    return NextResponse.json({
      ok: true,
      data: { bids, asks, ts: new Date().toISOString(), symbol: productId },
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "crypto depth failed",
        data: { bids: [], asks: [] },
      },
      { status: 500 }
    );
  }
}
