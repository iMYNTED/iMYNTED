import { NextResponse } from "next/server";

type ScannerType = "gainers" | "losers" | "unusual" | "news" | "halts";

type ScanRow = {
  symbol: string;
  price: number;
  chg: number;
  vol: number;
  relVol: number;
  lastTs: string;
  type: ScannerType;
};

function nowIso() {
  return new Date().toISOString();
}

const UNIVERSE = [
  "AAPL","MSFT","NVDA","TSLA","AMD","META","AMZN","GOOGL","NFLX",
  "PLTR","SOFI","RIVN","LCID","MARA","RIOT","NIO","COIN","HOOD",
  "GME","AMC","SPY","QQQ","IWM","SMCI","INTC","BABA","UBER","LYFT",
  "F","GM","BAC","JPM","XOM","CVX","DIS","DKNG","MRNA","PFE","CVNA",
  "UPST","AI","SOUN","IONQ","SHOP","SNAP","BYND","T","VZ","KVUE",
];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pick<T>(xs: T[]) {
  return xs[Math.floor(Math.random() * xs.length)];
}

function normalizeType(v: string | null): ScannerType {
  const t = (v || "").toLowerCase().trim();
  if (t === "gainers" || t === "losers" || t === "unusual" || t === "news" || t === "halts")
    return t;
  return "gainers";
}

function makeRow(type: ScannerType): ScanRow {
  const symbol = pick(UNIVERSE);
  const base = rand(0.5, 250);

  const chg =
    type === "gainers" ? rand(1.5, 18)
    : type === "losers" ? rand(-18, -1.5)
    : type === "unusual" ? rand(-6, 10)
    : type === "news" ? rand(-8, 14)
    : rand(-2, 2);

  const price = Math.max(0.05, base * (1 + chg / 100));

  const vol =
    type === "unusual"
      ? Math.floor(rand(2_000_000, 80_000_000))
      : Math.floor(rand(50_000, 15_000_000));

  const relVol =
    type === "unusual" ? rand(2.0, 15.0)
    : type === "news" ? rand(1.2, 6.0)
    : rand(0.6, 3.0);

  return { symbol, price, chg, vol, relVol, lastTs: nowIso(), type };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const type = normalizeType(searchParams.get("type"));
  const limit = Math.min(Number(searchParams.get("limit") || "120"), 300);

  const rows: ScanRow[] = [];
  for (let i = 0; i < limit; i++) rows.push(makeRow(type));

  rows.sort((a, b) => {
    if (type === "unusual") return (b.relVol || 0) - (a.relVol || 0);
    return (b.chg || 0) - (a.chg || 0);
  });

  return NextResponse.json({ rows, type });
}
