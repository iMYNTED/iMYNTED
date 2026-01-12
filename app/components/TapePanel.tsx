"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Print = {
  ts: string;
  price: number;
  size: number;
  side: "B" | "S" | "M";
};

function hhmm(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtPx(n: number) {
  if (!Number.isFinite(n)) return "-";
  return n >= 1 ? n.toFixed(2) : n.toFixed(4);
}

export function TapePanel({ symbol }: { symbol: string }) {
  const sym = useMemo(() => (symbol || "AAPL").toUpperCase().trim(), [symbol]);
  const [prints, setPrints] = useState<Print[]>([]);
  const [paused, setPaused] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // ✅ A: whenever symbol changes, scroll to top immediately
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = 0;
  }, [sym]);

  useEffect(() => {
    let alive = true;
    let t: any;

    async function poll() {
      try {
        const res = await fetch(`/api/market/tape?symbol=${encodeURIComponent(sym)}&limit=140`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!alive) return;
        if (Array.isArray(json?.prints)) setPrints(json.prints);
      } catch {
        // ignore
      } finally {
        if (!alive) return;
        t = setTimeout(poll, 1200);
      }
    }

    if (!paused) poll();
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [paused, sym]);

  return (
    <div className="h-full min-h-0 w-full">
      <div className="mb-2 flex items-center gap-2">
        <div className="text-[11px] text-white/45">Tape • {sym}</div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setPaused((p) => !p)}
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white/75 hover:bg-white/10"
          >
            {paused ? "Paused" : "Live"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] font-semibold text-white/55">
        <div className="col-span-4">Time</div>
        <div className="col-span-4 text-right">Price</div>
        <div className="col-span-2 text-right">Size</div>
        <div className="col-span-2 text-right">Side</div>
      </div>

      <div
        ref={listRef}
        className="mt-2 h-full min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20"
      >
        <div className="divide-y divide-white/5">
          {prints.map((p, idx) => (
            <div key={p.ts + idx} className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[12px]">
              <div className="col-span-4 tabular-nums text-white/60">{hhmm(p.ts)}</div>
              <div className="col-span-4 text-right tabular-nums text-white/80">{fmtPx(p.price)}</div>
              <div className="col-span-2 text-right tabular-nums text-white/70">{p.size}</div>
              <div className="col-span-2 text-right">
                <span
                  className={
                    p.side === "B"
                      ? "rounded-md bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300"
                      : p.side === "S"
                      ? "rounded-md bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-red-300"
                      : "rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/60"
                  }
                >
                  {p.side}
                </span>
              </div>
            </div>
          ))}
          {prints.length === 0 ? (
            <div className="p-4 text-[12px] text-white/45">No prints yet.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
