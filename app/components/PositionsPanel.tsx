"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type AssetType = "stock" | "crypto";
type Tab = "all" | "stock" | "crypto";

export type PositionRow = {
  id: string;
  asset: AssetType;
  symbol: string; // stock: AAPL, crypto: BTC-USD (or BTC)
  qty: number;
  avg: number;
  last: number;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function n(v: any) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function fmtMoney2(v: number) {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const s = abs.toFixed(2);
  const [i, d] = s.split(".");
  const withCommas = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${withCommas}.${d}`;
}

function pnlClass(v: number) {
  if (v > 0) return "text-emerald-300";
  if (v < 0) return "text-rose-300";
  return "text-white/60";
}

function chip(active: boolean) {
  return cn(
    "h-8 rounded-md border border-white/10 px-3 text-xs",
    active ? "bg-white/10 text-white" : "bg-black/20 text-white/70 hover:bg-white/5"
  );
}

function card(cls = "") {
  return cn("rounded-xl border border-white/10 bg-black/40", cls);
}

// ✅ demo data (stable)
function initialRows(): PositionRow[] {
  return [
    { id: "s1", asset: "stock", symbol: "AAPL", qty: 120, avg: 182.4, last: 185.12 },
    { id: "s2", asset: "stock", symbol: "TSLA", qty: 40, avg: 238.1, last: 242.55 },
    { id: "s3", asset: "stock", symbol: "NVDA", qty: 25, avg: 901.5, last: 912.35 },
    { id: "s4", asset: "stock", symbol: "SPY", qty: 10, avg: 487.2, last: 490.08 },

    { id: "c1", asset: "crypto", symbol: "BTC-USD", qty: 0.15, avg: 61200, last: 62880 },
    { id: "c2", asset: "crypto", symbol: "ETH-USD", qty: 1.8, avg: 3100, last: 3255 },
  ];
}

// small deterministic motion (no randomness)
function applyTick(rows: PositionRow[], t: number) {
  const wobble = (k: number) => (((t + k) % 2 === 0 ? 1 : -1) * 0.08);

  return rows.map((p, idx) => {
    const drift = wobble(idx);

    // crypto moves a bit more visually
    const mult = p.asset === "crypto" ? 22 : 1;

    const nextLast = +(n(p.last) + drift * mult).toFixed(2);
    return { ...p, last: nextLast };
  });
}

export default function PositionsPanel({
  onPick,
  refreshMs = 2500,
}: {
  onPick?: (asset: AssetType, symbol: string) => void;
  refreshMs?: number;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [rows, setRows] = useState<PositionRow[]>(() => initialRows());

  const [activeId, setActiveId] = useState<string>("");

  const tickRef = useRef<number>(0);

  useEffect(() => {
    let alive = true;

    const t = setInterval(() => {
      if (!alive) return;
      tickRef.current += 1;
      setRows((cur) => applyTick(cur, tickRef.current));
    }, refreshMs);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [refreshMs]);

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    return rows.filter((r) => r.asset === tab);
  }, [rows, tab]);

  const summary = useMemo(() => {
    const value = filtered.reduce((a, p) => a + n(p.qty) * n(p.last), 0);
    const cost = filtered.reduce((a, p) => a + n(p.qty) * n(p.avg), 0);
    const pnl = value - cost;
    const pct = cost ? (pnl / cost) * 100 : 0;
    return { value, cost, pnl, pct };
  }, [filtered]);

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 p-3">
      {/* Tabs + refresh */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button className={chip(tab === "all")} onClick={() => setTab("all")}>
            ALL
          </button>
          <button className={chip(tab === "stock")} onClick={() => setTab("stock")}>
            STOCK
          </button>
          <button className={chip(tab === "crypto")} onClick={() => setTab("crypto")}>
            CRYPTO
          </button>
          <span className="ml-2 text-[11px] text-white/50">Live demo • {Math.round(refreshMs / 1000)}s</span>
        </div>

        <div className="text-[11px] text-white/45">
          Rows: <span className="text-white/70">{filtered.length}</span>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3">
        <div className={card("p-3")}>
          <div className="text-[10px] text-white/45">Total Value</div>
          <div className="mt-1 text-[16px] font-semibold text-white/85 tabular-nums">
            {fmtMoney2(summary.value)}
          </div>
          <div className="mt-1 text-[10px] text-white/35 tabular-nums">Cost: {fmtMoney2(summary.cost)}</div>
        </div>

        <div className={card("p-3")}>
          <div className="text-[10px] text-white/45">Total P/L</div>
          <div className={cn("mt-1 text-[16px] font-semibold tabular-nums", pnlClass(summary.pnl))}>
            {fmtMoney2(summary.pnl)}
          </div>
          <div className={cn("mt-1 text-[10px] tabular-nums", pnlClass(summary.pnl))}>
            {summary.pct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Positions list */}
      <div className={card("min-h-0 flex-1 flex flex-col overflow-hidden")}>
        <div className="border-b border-white/10 px-3 py-2 text-[11px] text-white/55">
          Positions (click → sync dashboard)
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* header */}
          <div className="grid grid-cols-12 gap-2 border-b border-white/5 px-3 py-2 text-[11px] text-white/45">
            <div className="col-span-3">Symbol</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Avg</div>
            <div className="col-span-2 text-right">Last</div>
            <div className="col-span-3 text-right">P/L</div>
          </div>

          {filtered.map((p) => {
            const value = n(p.qty) * n(p.last);
            const pnl = n(p.qty) * (n(p.last) - n(p.avg));
            const pnlPct = n(p.avg) ? ((n(p.last) - n(p.avg)) / n(p.avg)) * 100 : 0;

            const selected = activeId === p.id;

            return (
              <button
                key={p.id}
                onClick={() => {
                  setActiveId(p.id);
                  onPick?.(p.asset, p.symbol);
                }}
                className={cn(
                  "w-full text-left",
                  "grid grid-cols-12 items-center gap-2 border-b border-white/5 px-3 py-2 text-[12px]",
                  "hover:bg-white/5",
                  selected && "bg-white/5"
                )}
                title={`Value: ${fmtMoney2(value)} • Avg: ${fmtMoney2(n(p.avg))} • P/L: ${fmtMoney2(pnl)} (${pnlPct.toFixed(
                  2
                )}%)`}
              >
                <div className="col-span-3 font-semibold text-white/85">
                  {p.symbol}
                  <span className="ml-2 text-[10px] text-white/35">{p.asset.toUpperCase()}</span>
                </div>

                <div className="col-span-2 text-right tabular-nums text-white/65">{p.qty}</div>
                <div className="col-span-2 text-right tabular-nums text-white/65">{fmtMoney2(n(p.avg))}</div>
                <div className="col-span-2 text-right tabular-nums text-white/65">{fmtMoney2(n(p.last))}</div>

                <div className={cn("col-span-3 text-right tabular-nums", pnlClass(pnl))}>{fmtMoney2(pnl)}</div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-white/10 px-3 py-2 text-[10px] text-white/35">
          Demo feed • next step = wire broker APIs
        </div>
      </div>
    </div>
  );
}
