"use client";

import React, { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  chgPct24h: number;
  vol24h: number;
  mcap: number;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtCompact(n: number) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 });
}

function fmtPrice(n: number) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "0";
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

export default function CryptoMoversPanel({
  onPickSymbol,
  refreshMs = 60_000,
}: {
  onPickSymbol?: (sym: string) => void; // "BTC", "ETH", etc
  refreshMs?: number;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [mode, setMode] = useState<"movers" | "gainers" | "losers">("movers");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/crypto/movers", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `Movers API ${res.status}`);
      setRows(Array.isArray(j?.data) ? j.data : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load crypto movers");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    load();
    const t = setInterval(() => {
      if (!alive) return;
      load();
    }, refreshMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMs]);

  const filtered = useMemo(() => {
    const copy = [...rows];
    if (mode === "gainers") return copy.sort((a, b) => b.chgPct24h - a.chgPct24h).slice(0, 25);
    if (mode === "losers") return copy.sort((a, b) => a.chgPct24h - b.chgPct24h).slice(0, 25);
    return copy.slice(0, 25);
  }, [rows, mode]);

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="p-2 border-b border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("movers")}
            className={cn(
              "rounded-md border border-white/10 px-2 py-1 text-[11px] hover:bg-muted",
              mode === "movers" && "bg-muted"
            )}
          >
            MOVERS
          </button>
          <button
            onClick={() => setMode("gainers")}
            className={cn(
              "rounded-md border border-white/10 px-2 py-1 text-[11px] hover:bg-muted",
              mode === "gainers" && "bg-muted"
            )}
          >
            GAINERS
          </button>
          <button
            onClick={() => setMode("losers")}
            className={cn(
              "rounded-md border border-white/10 px-2 py-1 text-[11px] hover:bg-muted",
              mode === "losers" && "bg-muted"
            )}
          >
            LOSERS
          </button>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          {loading ? "..." : "↻"}
        </button>
      </div>

      {err ? (
        <div className="m-2 rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-[12px] text-red-200">
          {err}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid grid-cols-[74px_1fr_1fr_1fr] gap-0 border-b border-white/10 bg-white/5 px-2 py-1 text-[11px] text-muted-foreground">
          <div>Symbol</div>
          <div className="text-right">Price</div>
          <div className="text-right">24h%</div>
          <div className="text-right">Vol</div>
        </div>

        <div className="divide-y divide-white/5">
          {filtered.map((r) => {
            const up = r.chgPct24h >= 0;
            return (
              <button
                key={r.id}
                onClick={() => onPickSymbol?.(r.symbol)}
                className="w-full text-left hover:bg-muted/40"
                title={r.name}
              >
                <div className="grid grid-cols-[74px_1fr_1fr_1fr] items-center px-2 py-1 text-[12px]">
                  <div className="font-semibold">{r.symbol}</div>
                  <div className="text-right tabular-nums">{fmtPrice(r.price)}</div>
                  <div className={cn("text-right tabular-nums", up ? "text-emerald-300" : "text-red-300")}>
                    {r.chgPct24h.toFixed(2)}%
                  </div>
                  <div className="text-right tabular-nums text-muted-foreground">{fmtCompact(r.vol24h)}</div>
                </div>
              </button>
            );
          })}

          {!filtered.length && !loading ? (
            <div className="px-3 py-6 text-sm text-muted-foreground">No movers yet.</div>
          ) : null}
        </div>
      </div>

      <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-white/10">
        Click a row to set symbol • Refresh {Math.round(refreshMs / 1000)}s
      </div>
    </div>
  );
}
