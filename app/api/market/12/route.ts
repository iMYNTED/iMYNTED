import { NextResponse } from "next/server";

type Level = { px: number; sz: number };
type Book = { bids: Level[]; asks: Level[] };

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function buildSimBook(mid: number, depth = 50): Book {
  const bids: Level[] = [];
  const asks: Level[] = [];
  const tick = mid < 10 ? 0.01 : mid < 100 ? 0.01 : 0.05;

  for (let i = 0; i < depth; i++) {
    const bpx = +(mid - (i + 1) * tick).toFixed(2);
    const apx = +(mid + (i + 1) * tick).toFixed(2);

    const bsz = Math.round(200 + Math.random() * 12000);
    const asz = Math.round(200 + Math.random() * 12000);

    bids.push({ px: bpx, sz: bsz });
    asks.push({ px: apx, sz: asz });
  }

  return { bids, asks };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "TSLA").toUpperCase();

  // deterministic-ish midpoint so it doesn't look random per request
  const seed =
    symbol.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 200;

  const mid = clamp(50 + seed + Math.random() * 5, 1, 5000);
  const book = buildSimBook(mid, 60);

  // Return BOTH shapes so all your components stay compatible
  return NextResponse.json({
    symbol,
    ts: new Date().toISOString(),
    provider: "mock",
    // shape A (your MarketDepthPanel reads these)
    bids: book.bids,
    asks: book.asks,
    // shape B (some code uses bid/ask)
    bid: book.bids.map((x) => ({ price: x.px, size: x.sz, px: x.px, sz: x.sz })),
    ask: book.asks.map((x) => ({ price: x.px, size: x.sz, px: x.px, sz: x.sz })),
    // shape C (book wrapper)
    book,
  });
}
