import { NextResponse } from "next/server";

type Candle = {
  t: number; // ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function intervalToMs(interval: string) {
  const s = (interval || "1m").toLowerCase().trim();
  if (s === "1m") return 60_000;
  if (s === "5m") return 5 * 60_000;
  if (s === "15m") return 15 * 60_000;
  if (s === "30m") return 30 * 60_000;
  if (s === "1h") return 60 * 60_000;
  if (s === "4h") return 4 * 60 * 60_000;
  if (s === "1d") return 24 * 60 * 60_000;
  return 60_000;
}

function genMockCandles(symbol: string, intervalMs: number, limit: number): Candle[] {
  const sym = (symbol || "AAPL").toUpperCase().trim();
  const seed = hashStr(sym);
  const rnd = mulberry32(seed);

  const now = Date.now();
  const step = intervalMs;

  const end = Math.floor(now / step) * step;
  const start = end - step * (limit - 1);

  const base = 20 + (seed % 400) / 2; // ~20..220
  let last = base;

  const out: Candle[] = [];

  for (let i = 0; i < limit; i++) {
    const t = start + i * step;

    const drift = (Math.sin((i + seed) / 13) + Math.cos((i + seed) / 29)) * 0.08;
    const noise = (rnd() - 0.5) * 0.35;

    const change = drift + noise;
    const o = last;
    const c = Math.max(0.01, o * (1 + change / 100));

    const wick = Math.max(0.0001, Math.abs(c - o) * (0.3 + rnd() * 0.9));
    const h = Math.max(o, c) + wick;
    const l = Math.max(0.01, Math.min(o, c) - wick);

    const v = Math.floor(10_000 + rnd() * 2_000_000);

    out.push({
      t,
      o: Number(o.toFixed(4)),
      h: Number(h.toFixed(4)),
      l: Number(l.toFixed(4)),
      c: Number(c.toFixed(4)),
      v,
    });

    last = c;
  }

  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const symbol = (url.searchParams.get("symbol") || "AAPL").toUpperCase().trim();
  const asset = (url.searchParams.get("asset") || "stock").toLowerCase().trim();
  const interval = (url.searchParams.get("interval") || "1m").toLowerCase().trim();

  const limit = clamp(toInt(url.searchParams.get("limit"), 120), 20, 400);
  const intervalMs = intervalToMs(interval);

  const candles = genMockCandles(symbol, intervalMs, limit);

  return NextResponse.json({
    ok: true,
    provider: "mock",
    symbol,
    asset,
    interval,
    intervalMs,
    limit,
    candles,
  });
}
