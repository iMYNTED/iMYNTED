import { NextResponse } from "next/server";

type ScannerRow = {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  tag: "Gainer" | "Loser" | "Unusual Vol" | "News Spike";
};

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function fmtVol(v: number) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
  return String(Math.floor(v));
}

function genMockRows(tag: ScannerRow["tag"], symbols: string[]): ScannerRow[] {
  return symbols.slice(0, 10).map((s) => {
    const price = Number(rand(2, 350).toFixed(2));
    const changePct =
      tag === "Loser"
        ? Number(rand(-22, -1).toFixed(2))
        : Number(rand(1, 18).toFixed(2));
    const change = Number(((price * changePct) / 100).toFixed(2));
    const volume = Math.floor(rand(100_000, 120_000_000));

    return {
      symbol: s,
      price,
      change,
      changePct,
      volume,
      tag,
    };
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "gainers").toLowerCase();

  // MOCK symbol pools (fast + terminal feel). We'll swap to real providers later.
  const pools = {
    gainers: ["NVDA", "TSLA", "AMD", "SOFI", "PLTR", "SMCI", "MARA", "RIOT", "AAPL", "META", "MSFT"],
    losers: ["BABA", "NIO", "SNAP", "PYPL", "UBER", "F", "RIVN", "COIN", "SQ", "DIS", "BA"],
    unusual: ["SPY", "QQQ", "IWM", "TSLA", "NVDA", "AAPL", "AMD", "META", "MSFT", "AVGO", "NFLX"],
    newspike: ["AAPL", "TSLA", "NVDA", "AMD", "META", "MSFT", "PLTR", "SOFI", "SMCI", "MARA", "COIN"],
  };

  let tag: ScannerRow["tag"] = "Gainer";
  let rows: ScannerRow[] = [];

  if (type === "losers") {
    tag = "Loser";
    rows = genMockRows(tag, pools.losers);
  } else if (type === "unusual") {
    tag = "Unusual Vol";
    rows = genMockRows(tag, pools.unusual).map((r) => ({
      ...r,
      changePct: Number(rand(-6, 6).toFixed(2)),
      change: Number(((r.price * rand(-6, 6)) / 100).toFixed(2)),
      volume: Math.floor(rand(40_000_000, 250_000_000)),
    }));
  } else if (type === "newspike") {
    tag = "News Spike";
    rows = genMockRows(tag, pools.newspike).map((r) => ({
      ...r,
      changePct: Number(rand(-4, 10).toFixed(2)),
      change: Number(((r.price * rand(-4, 10)) / 100).toFixed(2)),
      volume: Math.floor(rand(2_000_000, 150_000_000)),
    }));
  } else {
    tag = "Gainer";
    rows = genMockRows(tag, pools.gainers);
  }

  return NextResponse.json({
    provider: "mock",
    type,
    rows: rows.map((r) => ({
      ...r,
      volumeLabel: fmtVol(r.volume),
    })),
    ts: new Date().toISOString(),
  });
}
