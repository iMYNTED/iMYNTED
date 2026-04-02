// app/api/market/scanners/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ScanRow = {
  symbol: string;

  // ✅ canonical fields ScannerPanel expects
  price: number; // maps from last
  change: number; // maps from chg
  changePct: number; // percent (NOT decimal)

  volume: number; // maps from vol
  volumeLabel?: string;
  tag?: string;

  // optional extras
  float?: number;
  halted?: boolean;
};

type Resp = {
  ok: boolean;
  provider: "mock";
  type: string;
  tab: string;
  rows: ScanRow[];
  ts: string;
  warn?: string;
  error?: string;
  message?: string;
};

/* ---------------- deterministic RNG (stable across refresh) ---------------- */

function hash32(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function makeRng(seed: number) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}
function rand(rnd: () => number, min: number, max: number) {
  return rnd() * (max - min) + min;
}

function normTab(raw: any) {
  const t = String(raw || "").toLowerCase().trim();
  if (t === "gainers" || t === "losers" || t === "unusual" || t === "news" || t === "halts") return t;
  return "gainers";
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

function volLabel(v: number) {
  if (!Number.isFinite(v)) return "-";
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + "B";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(2) + "K";
  return String(Math.round(v));
}

/**
 * ✅ ScannerPanel normalize() reads:
 * price, change, changePct, volume, tag
 *
 * IMPORTANT:
 * - changePct must be PERCENT (3.4) not decimal (0.034)
 * - stable 60s bucket so scanner doesn't jitter vs other mock feeds
 */
function buildMockRows(tab: string): ScanRow[] {
  const t = normTab(tab);

  const bucket = Math.floor(Date.now() / 60_000);
  const seed = hash32(`scanner:${t}:${bucket}`);
  const rnd = makeRng(seed);

  const pool = mockSymbols(t);

  // ✅ Fill to 25 rows by repeating pool w/ deterministic suffixes
  const want = 25;
  const syms: string[] = [];
  for (let i = 0; i < want; i++) {
    const base = pool[i % pool.length] || "AAPL";
    // keep symbols realistic-looking but unique-ish
    const suffix = i < pool.length ? "" : `${String(i - pool.length + 1)}`;
    syms.push(`${base}${suffix}`);
  }

  return syms.map((symbol, i) => {
    const last = rand(rnd, 2, 250);

    const chgPctDec =
      t === "losers"
        ? -rand(rnd, 0.01, 0.12)
        : t === "gainers"
          ? rand(rnd, 0.01, 0.18)
          : rand(rnd, -0.06, 0.09);

    const chg = last * chgPctDec;

    const vol = Math.floor(rand(rnd, 200_000, 90_000_000));
    const float = Math.floor(rand(rnd, 5_000_000, 900_000_000));
    const halted = t === "halts" ? true : rnd() < 0.02;

    const tag =
      t === "news"
        ? "NEWS"
        : t === "unusual"
          ? "UNUSUAL"
          : t === "halts"
            ? "HALT"
            : i < 3
              ? "HOT"
              : "";

    return {
      symbol,
      price: Number(last.toFixed(2)),
      change: Number(chg.toFixed(2)),
      changePct: Number((chgPctDec * 100).toFixed(2)), // ✅ percent
      volume: vol,
      volumeLabel: volLabel(vol), // ✅ richer terminal feel
      float,
      halted,
      tag,
    };
  });
}

export async function GET(request: Request) {
  const ts = new Date().toISOString();

  try {
    const url = new URL(request.url);

    // accept both params (forwarder sets both)
    const tab = normTab(url.searchParams.get("type") || url.searchParams.get("tab") || "gainers");

    const rows = buildMockRows(tab);

    const out: Resp = {
      ok: true,
      provider: "mock",
      type: tab,
      tab,
      rows,
      ts,
    };

    return NextResponse.json(out, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    // ✅ return 200 so ScannerPanel doesn't hard-fail with HTTP ### and blank rows
    const out: Resp = {
      ok: false,
      provider: "mock",
      type: "error",
      tab: "error",
      rows: [],
      ts,
      error: "scanners_route_failed",
      message: err?.message || String(err),
    };

    return NextResponse.json(out, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}