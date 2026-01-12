import { NextResponse } from "next/server";

type Print = {
  ts: string;
  price: number;
  size: number;
  side: "B" | "S" | "M";
};

function nowIso() {
  return new Date().toISOString();
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pick<T>(xs: T[]) {
  return xs[Math.floor(Math.random() * xs.length)];
}

const BASE: Record<string, number> = {
  AAPL: 258.0,
  MSFT: 410.0,
  NVDA: 327.0,
  TSLA: 252.0,
  AMD: 175.0,
  META: 510.0,
  AMZN: 185.0,
  GOOGL: 165.0,
  PLTR: 22.5,
  SOFI: 8.2,
};

function baseFor(symbol: string) {
  const s = symbol.toUpperCase().trim();
  return BASE[s] ?? 100 + (s.charCodeAt(0) % 40) * 3;
}

function makePrint(symbol: string, last: number): Print {
  const side = pick<Print["side"]>(["B", "S", "M"]);
  const drift = rand(-0.08, 0.08);
  const price = Math.max(0.01, last + drift);
  const size =
    side === "M"
      ? Math.floor(rand(1, 400))
      : Math.floor(rand(10, 5000));

  return {
    ts: nowIso(),
    price: Number(price.toFixed(price >= 1 ? 2 : 4)),
    size,
    side,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "AAPL").toUpperCase().trim();
  const limit = Math.min(Number(searchParams.get("limit") || "120"), 500);

  // seed last around a reasonable base
  let last = baseFor(symbol) * (1 + rand(-0.01, 0.01));

  const prints: Print[] = [];
  for (let i = 0; i < limit; i++) {
    const p = makePrint(symbol, last);
    prints.push(p);
    last = p.price;
  }

  // newest first (tape look)
  prints.reverse();

  return NextResponse.json({ symbol, prints });
}
