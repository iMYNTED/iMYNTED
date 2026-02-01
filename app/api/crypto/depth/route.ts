import { NextResponse } from "next/server";

type Level = { px: number; sz: number; price?: number; size?: number };

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

function toNum(x: any): number {
  if (x === null || x === undefined) return Number.NaN;
  if (typeof x === "number") return x;
  if (typeof x === "string") {
    const s = x.replace(/,/g, "").trim();
    if (!s) return Number.NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : Number.NaN;
  }
  return Number.NaN;
}

function normalizeSide(rows: any, limit = 50): Level[] {
  if (!Array.isArray(rows)) return [];

  const out: Level[] = [];

  for (const row of rows.slice(0, limit)) {
    // Coinbase shape (level=2): [price, size, numOrders] as strings
    if (Array.isArray(row) && row.length >= 2) {
      const px = toNum(row[0]);
      const sz = toNum(row[1]);
      if (Number.isFinite(px) && Number.isFinite(sz) && sz > 0) {
        out.push({ px, sz, price: px, size: sz });
      }
      continue;
    }

    // Fallback: object shapes (just in case)
    const px = toNum(row?.px ?? row?.price ?? row?.p);
    const sz = toNum(row?.sz ?? row?.size ?? row?.qty ?? row?.amount ?? row?.q);
    if (Number.isFinite(px) && Number.isFinite(sz) && sz > 0) {
      out.push({ px, sz, price: px, size: sz });
    }
  }

  return out;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const productId = normProductId(url.searchParams.get("symbol"));

    const bookUrl = `https://api.exchange.coinbase.com/products/${encodeURIComponent(
      productId
    )}/book?level=2`;

    const r = await fetch(bookUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": "MySentinelAtlas/1.0",
        Accept: "application/json",
      },
    });

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

    const bids = normalizeSide(j?.bids, 50);
    const asks = normalizeSide(j?.asks, 50);

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
