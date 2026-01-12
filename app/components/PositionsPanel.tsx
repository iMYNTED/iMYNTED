"use client";

import React, { useEffect, useMemo, useState } from "react";

type Position = {
  symbol: string;
  qty: number;
  avg: number;
  last: number;
};

function n(v: any) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** Deterministic money format (no locale / timezone differences) */
function fmtMoney2(v: number) {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const s = abs.toFixed(2);
  const [i, d] = s.split(".");
  const withCommas = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${withCommas}.${d}`;
}

function clsPnl(v: number) {
  if (v > 0) return "text-emerald-300";
  if (v < 0) return "text-rose-300";
  return "text-white/70";
}

function card(cls?: string) {
  return ["rounded-xl border border-white/10 bg-black/40 p-3", cls ?? ""].join(
    " "
  );
}

/**
 * ✅ CRITICAL: This returns stable demo data that will be IDENTICAL on
 * server + client initial render, preventing hydration mismatch.
 */
function initialPositions(): Position[] {
  return [
    { symbol: "AAPL", qty: 120, avg: 182.4, last: 185.12 },
    { symbol: "TSLA", qty: 40, avg: 238.1, last: 242.55 },
    { symbol: "NVDA", qty: 25, avg: 901.5, last: 912.35 },
    { symbol: "SPY", qty: 10, avg: 487.2, last: 490.08 },
  ];
}

/**
 * If you *must* show "live-ish" movement, do it AFTER mount
 * but keep it deterministic (no Date.now in the markup before mount).
 *
 * This produces small changes based on a stable "tick" counter, not real time.
 */
function applyDeterministicTick(rows: Position[], tick: number): Position[] {
  // tick increments 0,1,2... and creates repeatable moves
  const wobble = (k: number) => ((tick + k) % 2 === 0 ? 1 : -1) * 0.08;

  return rows.map((p, idx) => {
    const delta = wobble(idx);
    const last = +(n(p.last) + delta).toFixed(2);
    return { ...p, last };
  });
}

export default function PositionsPanel() {
  /**
   * ✅ First render uses stable positions so SSR/CSR match.
   */
  const [positions, setPositions] = useState<Position[]>(() => initialPositions());

  /**
   * OPTIONAL: After mount, you can fetch real data OR run a deterministic tick.
   * If you don't want movement, you can delete the interval below.
   */
  useEffect(() => {
    let alive = true;

    // Example: deterministic "demo tick" after mount (safe for hydration)
    let tick = 0;
    const t = setInterval(() => {
      if (!alive) return;
      tick += 1;
      setPositions((cur) => applyDeterministicTick(cur, tick));
    }, 2500);

    // If you later add real data, do it here (after mount):
    // fetch("/api/positions", { cache: "no-store" })
    //   .then((r) => r.json())
    //   .then((data) => alive && setPositions(data))
    //   .catch(() => {});

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const summary = useMemo(() => {
    const totalValue = positions.reduce(
      (acc, p) => acc + n(p.qty) * n(p.last),
      0
    );
    const costBasis = positions.reduce(
      (acc, p) => acc + n(p.qty) * n(p.avg),
      0
    );
    const totalPnl = totalValue - costBasis;
    const totalPnlPct = costBasis !== 0 ? (totalPnl / costBasis) * 100 : 0;

    return { totalValue, costBasis, totalPnl, totalPnlPct };
  }, [positions]);

  return (
    <div className="space-y-3">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3">
        <div className={card()}>
          <div className="text-[10px] text-white/45">Total Value</div>
          <div className="mt-1 text-[16px] font-semibold text-white/85 tabular-nums">
            {fmtMoney2(n(summary.totalValue))}
          </div>
          <div className="mt-1 text-[10px] text-white/35 tabular-nums">
            Cost: {fmtMoney2(n(summary.costBasis))}
          </div>
        </div>

        <div className={card()}>
          <div className="text-[10px] text-white/45">Total P/L</div>
          <div
            className={[
              "mt-1 text-[16px] font-semibold tabular-nums",
              clsPnl(n(summary.totalPnl)),
            ].join(" ")}
          >
            {fmtMoney2(n(summary.totalPnl))}
          </div>
          <div
            className={[
              "mt-1 text-[10px] tabular-nums",
              clsPnl(n(summary.totalPnl)),
            ].join(" ")}
          >
            {n(summary.totalPnlPct).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Positions list */}
      <div className={card("p-0 overflow-hidden")}>
        <div className="border-b border-white/10 px-3 py-2 text-[11px] text-white/55">
          Positions
        </div>

        <div className="max-h-[170px] overflow-y-auto">
          {positions.map((p) => {
            const value = n(p.qty) * n(p.last);
            const pnl = n(p.qty) * (n(p.last) - n(p.avg));
            const pnlPct =
              n(p.avg) !== 0 ? ((n(p.last) - n(p.avg)) / n(p.avg)) * 100 : 0;

            return (
              <div
                key={p.symbol}
                className="grid grid-cols-5 items-center gap-2 border-b border-white/5 px-3 py-2 text-[12px]"
              >
                <div className="font-semibold text-white/85">{p.symbol}</div>
                <div className="text-right tabular-nums text-white/65">
                  {p.qty}
                </div>
                <div className="text-right tabular-nums text-white/65">
                  {fmtMoney2(n(p.last))}
                </div>
                <div className="text-right tabular-nums text-white/65">
                  {fmtMoney2(value)}
                </div>
                <div
                  className={["text-right tabular-nums", clsPnl(pnl)].join(" ")}
                  title={`Avg: ${fmtMoney2(n(p.avg))} • P/L: ${fmtMoney2(
                    pnl
                  )} (${pnlPct.toFixed(2)}%)`}
                >
                  {fmtMoney2(pnl)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-white/10 px-3 py-2 text-[10px] text-white/35">
          Demo positions (deterministic) • safe SSR/CSR • replace with live data in useEffect when ready
        </div>
      </div>
    </div>
  );
}
