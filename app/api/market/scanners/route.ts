import { NextResponse } from "next/server";

type ScanRow = {
  symbol: string;
  last?: number;
  chg?: number;
  chgPct?: number; // decimal (0.034 = 3.4%) or percent (3.4) — UI handles both
  vol?: number;
  float?: number;
  halted?: boolean;
};

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function mockSymbols(tab: string) {
  const pools: Record<string, string[]> = {
    gainers: ["SOUN", "NVDA", "TSLA", "AAPL", "AMD", "SMCI", "PLTR", "MARA", "RIOT", "SOFI"],
    losers: ["BABA", "PYPL", "INTC", "NKE", "DIS", "CVNA", "RIVN", "SHOP", "SQ", "SNAP"],
    unusual: ["GME", "AMC", "MSTR", "AFRM", "UPST", "IONQ", "SIRI", "DKNG", "HOOD", "RKT"],
    news: ["TSLA", "NVDA", "AAPL", "MSFT", "META", "AMZN", "GOOG", "PLTR", "SOUN", "SMCI"],
    halts: ["HKD", "TOP", "MULN", "FFIE", "GNS", "NIO", "SPCE", "SAVA", "MCOM", "BTBT"],
  };
  return pools[tab] ?? pools.gainers;
}

function buildMockRows(tab: string): ScanRow[] {
  const syms = mockSymbols(tab);

  return syms.slice(0, 25).map((symbol) => {
    const last = rand(2, 250);
    const chgPct =
      tab === "losers"
        ? -rand(0.01, 0.12)
        : tab === "gainers"
        ? rand(0.01, 0.18)
        : rand(-0.06, 0.09);

    const chg = last * chgPct;
    const vol = Math.floor(rand(200_000, 90_000_000));
    const float = Math.floor(rand(5_000_000, 900_000_000));
    const halted = tab === "halts" ? true : Math.random() < 0.02;

    return {
      symbol,
      last: Number(last.toFixed(2)),
      chg: Number(chg.toFixed(2)),
      chgPct: Number(chgPct.toFixed(4)),
      vol,
      float,
      halted,
    };
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tab = (url.searchParams.get("tab") || "gainers").toLowerCase();

    const rows = buildMockRows(tab);

    return NextResponse.json(
      { tab, rows, source: "mock", ok: true },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "scanners route failed", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
