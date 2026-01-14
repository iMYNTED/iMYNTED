import { NextResponse } from "next/server";

type ScanRow = {
  symbol: string;
  price: number;
  chg: number;
  chgPct: number;
  vol: number;
  float?: number;
  news?: number;
  halted?: boolean;
  tag?: string;
};

function pick<T>(xs: T[], n: number) {
  return xs.slice(0, n);
}

function makeDemo(tab: string): ScanRow[] {
  const base: ScanRow[] = [
    { symbol: "AAPL", price: 257.95, chg: 1.22, chgPct: 0.48, vol: 62_100_000, float: 15_700_000_000 },
    { symbol: "TSLA", price: 221.54, chg: 6.12, chgPct: 2.84, vol: 94_200_000, float: 3_200_000_000 },
    { symbol: "NVDA", price: 912.35, chg: 18.44, chgPct: 2.06, vol: 51_500_000, float: 2_400_000_000 },
    { symbol: "AMD", price: 168.21, chg: -2.05, chgPct: -1.20, vol: 47_900_000, float: 1_600_000_000 },
    { symbol: "PLTR", price: 17.83, chg: 0.61, chgPct: 3.54, vol: 112_300_000, float: 2_100_000_000, news: 3 },
    { symbol: "SOUN", price: 3.12, chg: 0.44, chgPct: 16.40, vol: 189_400_000, float: 530_000_000, news: 6 },
    { symbol: "RIVN", price: 13.06, chg: -0.77, chgPct: -5.57, vol: 88_200_000, float: 980_000_000 },
    { symbol: "MARA", price: 20.17, chg: 1.91, chgPct: 10.45, vol: 71_600_000, float: 340_000_000, news: 2 },
    { symbol: "AMC", price: 4.92, chg: 0.38, chgPct: 8.37, vol: 220_500_000, float: 520_000_000 },
    { symbol: "GME", price: 17.44, chg: -0.62, chgPct: -3.43, vol: 44_800_000, float: 305_000_000 },
  ];

  const halts: ScanRow[] = [
    { symbol: "ABCD", price: 2.14, chg: 0.82, chgPct: 62.10, vol: 12_400_000, float: 45_000_000, halted: true, news: 1 },
    { symbol: "WXYZ", price: 6.71, chg: -1.90, chgPct: -22.08, vol: 9_700_000, float: 22_000_000, halted: true, news: 0 },
  ];

  const t = (tab || "").toLowerCase();

  if (t === "halts") return pick(halts, 50);

  if (t === "news") {
    return pick(
      base
        .map((r) => ({ ...r, news: r.news ?? Math.floor(Math.random() * 6) }))
        .sort((a, b) => (b.news || 0) - (a.news || 0)),
      50
    );
  }

  if (t === "unusual") {
    return pick(
      base
        .map((r) => ({ ...r, vol: r.vol + Math.floor(Math.random() * 120_000_000) }))
        .sort((a, b) => b.vol - a.vol),
      50
    );
  }

  if (t === "losers") {
    return pick(
      base
        .map((r) => ({ ...r, chg: -Math.abs(r.chg), chgPct: -Math.abs(r.chgPct) }))
        .sort((a, b) => a.chgPct - b.chgPct),
      50
    );
  }

  // default: gainers
  return pick(
    base
      .map((r) => ({ ...r, chg: Math.abs(r.chg), chgPct: Math.abs(r.chgPct) }))
      .sort((a, b) => b.chgPct - a.chgPct),
    50
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") || "gainers";
  const rows = makeDemo(tab);

  return NextResponse.json({
    tab,
    rows,
    ts: new Date().toISOString(),
  });
}
