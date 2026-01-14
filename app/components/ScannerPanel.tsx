"use client";

import React, { useEffect, useMemo, useState } from "react";

type ScannerTab = "gainers" | "losers" | "unusual" | "news" | "halts";

type ScanRow = {
  symbol: string;
  last?: number;
  chg?: number;
  chgPct?: number;
  vol?: number;
  float?: number;
  halted?: boolean;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtNum(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

function fmtPrice(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(2);
}

function fmtPct(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  // support decimal (0.034) or percent (3.4)
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${pct.toFixed(2)}%`;
}

function emitSetSymbol(symbol: string) {
  window.dispatchEvent(new CustomEvent("msa:setSymbol", { detail: { symbol } }));
}

export default function ScannerPanel({
  onSelectSymbol,
  selectedSymbol,
}: {
  onSelectSymbol?: (symbol: string) => void;
  selectedSymbol?: string;
}) {
  const [tab, setTab] = useState<ScannerTab>("gainers");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    let alive = true;
    let t: any;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        const res = await fetch(`/api/market/scanners?tab=${encodeURIComponent(tab)}`, {
          cache: "no-store",
        });
        const data = await res.json();

        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
          ? data.rows
          : Array.isArray(data?.data)
          ? data.data
          : [];

        const normalized: ScanRow[] = list
          .map((r) => {
            const sym = String(r.symbol ?? r.sym ?? r.ticker ?? "").toUpperCase().trim();
            if (!sym) return null;

            const last = Number(r.last ?? r.price ?? r.p ?? NaN);
            const chg = Number(r.chg ?? r.change ?? r.d ?? NaN);
            const chgPct = Number(r.chgPct ?? r.changePct ?? r.dp ?? r.pct ?? NaN);
            const vol = Number(r.vol ?? r.volume ?? r.v ?? NaN);
            const flt = Number(r.float ?? r.sharesFloat ?? r.floatShares ?? NaN);

            return {
              symbol: sym,
              last: Number.isFinite(last) ? last : undefined,
              chg: Number.isFinite(chg) ? chg : undefined,
              chgPct: Number.isFinite(chgPct) ? chgPct : undefined,
              vol: Number.isFinite(vol) ? vol : undefined,
              float: Number.isFinite(flt) ? flt : undefined,
              halted: Boolean(r.halted ?? r.halt ?? r.isHalted ?? false),
            } as ScanRow;
          })
          .filter(Boolean) as ScanRow[];

        if (!alive) return;
        setRows(normalized);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load scanners");
        setRows([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }

      t = setTimeout(load, 2500);
    }

    load();
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [tab]);

  const filtered = useMemo(() => {
    const needle = q.trim().toUpperCase();
    if (!needle) return rows;
    return rows.filter((r) => r.symbol.includes(needle));
  }, [rows, q]);

  function pick(sym: string) {
    const s = sym.toUpperCase().trim();
    onSelectSymbol?.(s);
    emitSetSymbol(s);
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["gainers", "Top Gainers"],
            ["losers", "Top Losers"],
            ["unusual", "Unusual Vol"],
            ["news", "News Spike"],
            ["halts", "HALTS"],
          ] as Array<[ScannerTab, string]>
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-xs font-semibold",
              tab === k
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/10 bg-black/40 text-white/75 hover:bg-white/5"
            )}
          >
            {label}
          </button>
        ))}

        <div className="ml-auto text-xs text-white/60">
          {loading ? "Loading…" : err ? `Error: ${err}` : `${filtered.length} rows`}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter symbols…"
          className="w-[220px] rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/20 focus:bg-black/70 caret-white"
        />
        <div className="text-xs text-white/55">Click a row to set symbol</div>
      </div>

      <div className="grid grid-cols-12 gap-2 border-y border-white/10 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/55">
        <div className="col-span-2">SYM</div>
        <div className="col-span-2 text-right">LAST</div>
        <div className="col-span-2 text-right">CHG</div>
        <div className="col-span-2 text-right">CHG%</div>
        <div className="col-span-2 text-right">VOL</div>
        <div className="col-span-2 text-right">FLOAT</div>
      </div>

      <div className="mt-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white/60">
            No rows.
          </div>
        ) : (
          filtered.slice(0, 200).map((r) => {
            const isSel =
              selectedSymbol &&
              r.symbol.toUpperCase() === selectedSymbol.toUpperCase();

            const chgPos = typeof r.chg === "number" && r.chg > 0;
            const chgNeg = typeof r.chg === "number" && r.chg < 0;
            const pctPos = typeof r.chgPct === "number" && r.chgPct > 0;
            const pctNeg = typeof r.chgPct === "number" && r.chgPct < 0;

            return (
              <button
                key={r.symbol}
                type="button"
                onClick={() => pick(r.symbol)}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-left",
                  "border-white/10 bg-black/40 hover:bg-white/5",
                  "focus:outline-none focus:ring-2 focus:ring-white/10",
                  isSel && "border-white/25 bg-white/10"
                )}
              >
                <div className="grid grid-cols-12 gap-2 text-sm text-white">
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="font-semibold">{r.symbol}</span>
                    {r.halted ? (
                      <span className="rounded-md border border-yellow-400/30 bg-yellow-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-200">
                        HALT
                      </span>
                    ) : null}
                  </div>

                  <div className="col-span-2 text-right tabular-nums text-white/90">
                    {fmtPrice(r.last)}
                  </div>

                  <div
                    className={cn(
                      "col-span-2 text-right tabular-nums",
                      chgPos ? "text-emerald-300" : chgNeg ? "text-red-300" : "text-white/70"
                    )}
                  >
                    {r.chg == null ? "—" : (r.chg > 0 ? "+" : "") + r.chg.toFixed(2)}
                  </div>

                  <div
                    className={cn(
                      "col-span-2 text-right tabular-nums",
                      pctPos ? "text-emerald-300" : pctNeg ? "text-red-300" : "text-white/70"
                    )}
                  >
                    {fmtPct(r.chgPct)}
                  </div>

                  <div className="col-span-2 text-right tabular-nums text-white/80">
                    {fmtNum(r.vol)}
                  </div>

                  <div className="col-span-2 text-right tabular-nums text-white/80">
                    {fmtNum(r.float)}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
