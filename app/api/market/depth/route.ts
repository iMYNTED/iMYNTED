import { NextResponse } from "next/server";

type Level = { px: number; sz: number };

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

/**
 * Normalize unknown level shapes to {px, sz}
 * Accepts common variants: px/price, sz/size/qty
 */
function normalizeLevel(l: any): Level | null {
  const px = toNum(l?.px ?? l?.price ?? l?.p);
  const sz = toNum(l?.sz ?? l?.size ?? l?.qty ?? l?.q);
  if (px === null || sz === null) return null;
  return { px, sz };
}

function genMockDepth(symbol: string): { bids: Level[]; asks: Level[]; source: string } {
  const mid = symbol === "AAPL" ? 258 : symbol === "TSLA" ? 320 : 100;
  const spread = rand(0.02, 0.08);

  const bids: Level[] = Array.from({ length: 12 }).map((_, i) => ({
    px: Number((mid - spread - i * rand(0.01, 0.06)).toFixed(2)),
    sz: Math.floor(rand(50, 8000)),
  }));

  const asks: Level[] = Array.from({ length: 12 }).map((_, i) => ({
    px: Number((mid + spread + i * rand(0.01, 0.06)).toFixed(2)),
    sz: Math.floor(rand(50, 8000)),
  }));

  return { bids, asks, source: "mock" };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "AAPL").toUpperCase();

  try {
    // 🔁 If you already fetch upstream, normalize it like this:
    // const upstream = await fetch("...", { headers: {...} });
    // const raw = await upstream.json();
    // const rawBids = raw.bids ?? raw.data?.bids ?? [];
    // const rawAsks = raw.asks ?? raw.data?.asks ?? [];
    // const bids = (rawBids as any[]).map(normalizeLevel).filter(Boolean) as Level[];
    // const asks = (rawAsks as any[]).map(normalizeLevel).filter(Boolean) as Level[];

    // ✅ default mock (stable)
    const { bids, asks, source } = genMockDepth(symbol);

    return NextResponse.json({
      symbol,
      bids,
      asks,
      source,
      ts: new Date().toISOString(),
    });
  } catch (e: any) {
    const { bids, asks } = genMockDepth(symbol);

    return NextResponse.json(
      {
        symbol,
        bids,
        asks,
        source: "mock",
        ts: new Date().toISOString(),
        error: e?.message ?? "depth route error",
      },
      { status: 200 }
    );
  }
}
