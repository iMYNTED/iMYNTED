"use client";

import React, { useEffect, useMemo, useState } from "react";

type Position = {
  symbol: string;
  name?: string;
  qty: number; // shares
  avg: number; // avg cost
  last: number; // last price
  dayChgPct: number; // day %
};

type Summary = {
  totalValue: number;
  dayPnl: number;
  dayPnlPct: number;
  totalPnl: number;
  totalPnlPct: number;
  buyingPower: number;
};

type ApiResponse = {
  provider?: string;
  account?: string;
  summary?: Partial<Summary>;
  positions?: Partial<Position>[];
  ts?: string;
};

function n(v: any, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function fmtMoney(v: number) {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return `${sign}$${abs.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function fmtMoney2(v: number) {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return `${sign}$${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtPct(v: number) {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function clsPnl(v: number) {
  return v >= 0 ? "text-emerald-300" : "text-red-300";
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

/* -------------------- MOCK (swap to real /api later) -------------------- */
function genMockPositions(): { summary: Summary; positions: Position[] } {
  const base: Position[] = [
    { symbol: "AAPL", qty: 120, avg: 182.15, last: 258.02, dayChgPct: 0.62 },
    { symbol: "TSLA", qty: 40, avg: 212.2, last: 241.85, dayChgPct: -1.14 },
    { symbol: "NVDA", qty: 25, avg: 455.0, last: 621.33, dayChgPct: 1.72 },
    { symbol: "AMD", qty: 60, avg: 132.7, last: 158.44, dayChgPct: 0.95 },
    { symbol: "PLTR", qty: 300, avg: 18.9, last: 22.41, dayChgPct: -0.31 },
    { symbol: "SOFI", qty: 900, avg: 7.8, last: 9.32, dayChgPct: 2.11 },
  ];

  const positions = base.map((p) => {
    // tiny drift so it feels alive
    const drift = (Math.random() - 0.5) * 0.8;
    const day = p.dayChgPct + drift;
    const last = p.last * (1 + drift / 100);
    return { ...p, last: Number(last.toFixed(2)), dayChgPct: Number(day.toFixed(2)) };
  });

  const totalValue = positions.reduce((acc, p) => acc + p.qty * p.last, 0);
  const cost = positions.reduce((acc, p) => acc + p.qty * p.avg, 0);
  const totalPnl = totalValue - cost;
  const totalPnlPct = cost > 0 ? (totalPnl / cost) * 100 : 0;

  // estimate day pnl using dayChgPct (approx)
  const dayPnl = positions.reduce((acc, p) => acc + (p.qty * p.last * p.dayChgPct) / 100, 0);
  const dayPnlPct = totalValue > 0 ? (dayPnl / totalValue) * 100 : 0;

  const buyingPower = Math.max(0, 25000 + (Math.random() - 0.5) * 1500);

  return {
    summary: {
      totalValue,
      dayPnl,
      dayPnlPct,
      totalPnl,
      totalPnlPct,
      buyingPower,
    },
    positions,
  };
}

async function tryFetchPositions(): Promise<{ ok: true; json: ApiResponse } | { ok: false; error: string }> {
  // You can add a real endpoint later:
  // const candidates = ["/api/positions", "/api/broker/positions"];
  const candidates: string[] = [];

  let last = "No positions endpoint configured (using mock)";
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        last = `${url} → HTTP ${res.status}`;
        continue;
      }
      const json = (await res.json()) as ApiResponse;
      return { ok: true, json };
    } catch (e: any) {
      last = `${url} → ${e?.message ?? "fetch failed"}`;
    }
  }
  return { ok: false, error: last };
}

/* ------------------------------ Component ------------------------------ */

export default function PositionsPanel() {
  const [provider, setProvider] = useState<string>("mock");
  const [summary, setSummary] = useState<Summary>(() => genMockPositions().summary);
  const [positions, setPositions] = useState<Position[]>(() => genMockPositions().positions);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"all" | "winners" | "losers">("all");
  const [sort, setSort] = useState<
    "value" | "day" | "total" | "symbol"
  >("value");

  async function refresh() {
    setLoading(true);
    try {
      const res = await tryFetchPositions();
      if (res.ok) {
        setProvider(res.json.provider ?? "api");

        const s: Summary = {
          totalValue: n(res.json.summary?.totalValue, 0),
          dayPnl: n(res.json.summary?.dayPnl, 0),
          dayPnlPct: n(res.json.summary?.dayPnlPct, 0),
          totalPnl: n(res.json.summary?.totalPnl, 0),
          totalPnlPct: n(res.json.summary?.totalPnlPct, 0),
          buyingPower: n(res.json.summary?.buyingPower, 0),
        };

        const ps: Position[] = (res.json.positions ?? []).map((p) => ({
          symbol: String(p.symbol ?? "").toUpperCase(),
          name: p.name ? String(p.name) : undefined,
          qty: n(p.qty, 0),
          avg: n(p.avg, 0),
          last: n(p.last, 0),
          dayChgPct: n(p.dayChgPct, 0),
        }));

        if (ps.length) {
          setSummary(s);
          setPositions(ps);
          setErr(null);
        } else {
          setErr("No positions returned (keeping last good)");
        }
      } else {
        // mock refresh (keeps UI alive)
        const mock = genMockPositions();
        setProvider("mock");
        setSummary(mock.summary);
        setPositions(mock.positions);
        setErr(null); // mock is OK
      }
    } finally {
      setLoading(false);
    }
  }

  // initial + auto refresh
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computed = useMemo(() => {
    const rows = positions.map((p) => {
      const value = n(p.qty) * n(p.last);
      const cost = n(p.qty) * n(p.avg);
      const totalPnl = value - cost;
      const totalPnlPct = cost > 0 ? (totalPnl / cost) * 100 : 0;
      return { ...p, value, totalPnl, totalPnlPct };
    });

    const query = q.trim().toUpperCase();
    let filtered = rows.filter((r) =>
      query ? r.symbol.includes(query) || (r.name ?? "").toUpperCase().includes(query) : true
    );

    if (mode === "winners") filtered = filtered.filter((r) => r.dayChgPct >= 0);
    if (mode === "losers") filtered = filtered.filter((r) => r.dayChgPct < 0);

    const sorted = [...filtered].sort((a, b) => {
      if (sort === "symbol") return a.symbol.localeCompare(b.symbol);
      if (sort === "day") return Math.abs(b.dayChgPct) - Math.abs(a.dayChgPct);
      if (sort === "total") return Math.abs(b.totalPnlPct) - Math.abs(a.totalPnlPct);
      // value
      return b.value - a.value;
    });

    // allocation bars (top 6)
    const tv = rows.reduce((acc, r) => acc + r.value, 0);
    const alloc = [...rows]
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((r) => ({
        symbol: r.symbol,
        w: tv > 0 ? r.value / tv : 0,
      }));

    return { rows: sorted, alloc, totalValue: tv };
  }, [positions, q, mode, sort]);

  function Pill({
    active,
    children,
    onClick,
  }: {
    active: boolean;
    children: React.ReactNode;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={[
          "rounded-full px-3 py-1.5 text-[11px] font-semibold",
          active
            ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30"
            : "bg-white/5 text-white/70 hover:bg-white/10",
        ].join(" ")}
      >
        {children}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {/* Top summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/10 bg-black/40 p-3">
          <div className="text-[10px] text-white/45">Total Value</div>
          <div className="mt-1 text-[16px] font-semibold text-white/85 tabular-nums">
            {fmtMoney2(n(summary.totalValue))}
          </div>
          <div className={["mt-1 text-[11px] tabular-nums", clsPnl(n(summary.totalPnl))].join(" ")}>
            Total P/L {fmtMoney2(n(summary.totalPnl))} ({fmtPct(n(summary.totalPnlPct))})
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/40 p-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-white/45">Day P/L</div>
            <div className="text-[10px] text-white/35">{loading ? "Updating…" : `src: ${provider}`}</div>
          </div>
          <div className={["mt-1 text-[16px] font-semibold tabular-nums", clsPnl(n(summary.dayPnl))].join(" ")}>
            {fmtMoney2(n(summary.dayPnl))}
          </div>
          <div className={["mt-1 text-[11px] tabular-nums", clsPnl(n(summary.dayPnlPct))].join(" ")}>
            {fmtPct(n(summary.dayPnlPct))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/40 p-3 col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-white/45">Buying Power</div>
            <button
              onClick={refresh}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/70 hover:bg-white/10"
            >
              Refresh
            </button>
          </div>
          <div className="mt-1 text-[14px] font-semibold text-white/85 tabular-nums">
            {fmtMoney2(n(summary.buyingPower))}
          </div>

          {/* Allocation mini bar */}
          <div className="mt-2">
            <div className="flex h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/40">
              {computed.alloc.map((a) => (
                <div
                  key={a.symbol}
                  className="h-full"
                  style={{ width: `${Math.max(2, a.w * 100)}%`, background: "rgba(255,255,255,0.18)" }}
                  title={`${a.symbol} ${(a.w * 100).toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {computed.alloc.map((a) => (
                <div
                  key={`tag-${a.symbol}`}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/70"
                >
                  {a.symbol} {(a.w * 100).toFixed(1)}%
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          spellCheck={false}
          placeholder="Search symbol…"
          className="w-[160px] rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/85 outline-none placeholder:text-white/30"
        />

        <Pill active={mode === "all"} onClick={() => setMode("all")}>All</Pill>
        <Pill active={mode === "winners"} onClick={() => setMode("winners")}>Winners</Pill>
        <Pill active={mode === "losers"} onClick={() => setMode("losers")}>Losers</Pill>

        <div className="ml-auto flex items-center gap-2">
          <div className="text-[11px] text-white/45">Sort</div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/85 outline-none"
          >
            <option value="value">Value</option>
            <option value="day">Day %</option>
            <option value="total">Total %</option>
            <option value="symbol">Symbol</option>
          </select>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-red-300">
          {err}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
        <div className="grid grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr_0.9fr_1fr] gap-2 border-b border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/70">
          <div>Symbol</div>
          <div className="text-right">Qty</div>
          <div className="text-right">Avg</div>
          <div className="text-right">Last</div>
          <div className="text-right">Day</div>
          <div className="text-right">Total</div>
        </div>

        <div className="max-h-[240px] overflow-auto">
          {computed.rows.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-white/45">No positions.</div>
          ) : (
            computed.rows.map((p) => (
              <div
                key={p.symbol}
                className="grid grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr_0.9fr_1fr] gap-2 px-3 py-2 text-[12px] border-b border-white/5 hover:bg-white/5"
              >
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-white/85">{p.symbol}</div>
                  <div className="text-[10px] text-white/35 truncate max-w-[120px]">
                    {p.name ?? ""}
                  </div>
                </div>

                <div className="text-right tabular-nums text-white/70">{n(p.qty).toLocaleString()}</div>
                <div className="text-right tabular-nums text-white/70">{fmtMoney2(n(p.avg))}</div>
                <div className="text-right tabular-nums text-white/85">{fmtMoney2(n(p.last))}</div>

                <div className={["text-right tabular-nums", clsPnl(n(p.dayChgPct))].join(" ")}>
                  {fmtPct(n(p.dayChgPct))}
                </div>

                <div className="text-right tabular-nums">
                  <div className={clsPnl(n(p.totalPnl))}>
                    {fmtPct(n(p.totalPnlPct))}
                  </div>
                  <div className={["text-[10px]", clsPnl(n(p.totalPnl))].join(" ")}>
                    {fmtMoney2(n(p.totalPnl))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-3 py-2 text-[10px] text-white/35 flex items-center justify-between">
          <span>Positions • updates every 10s</span>
          <span>Total: {fmtMoney2(computed.totalValue)}</span>
        </div>
      </div>
    </div>
  );
}
