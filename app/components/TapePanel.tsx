"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Side = "B" | "S" | "M";

type Print = {
  ts: string; // ISO timestamp
  price: number;
  size: number;
  side?: Side; // buy/sell/mid
  venue?: string;
};

function hhmm(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function TapePanel({
  symbol,
  asset,
}: {
  symbol: string;
  asset?: "stock" | "crypto" | string;
}) {
  const sym = useMemo(() => (symbol || "AAPL").toUpperCase().trim(), [symbol]);
  const assetKey = useMemo(() => (asset || "stock").toLowerCase().trim(), [asset]);

  const [prints, setPrints] = useState<Print[]>([]);
  const [err, setErr] = useState<string>("");
  const [isLive, setIsLive] = useState(true);

  // Flow summary
  const [buyVol, setBuyVol] = useState(0);
  const [sellVol, setSellVol] = useState(0);

  // Sweep settings (use lower for crypto)
  const sweepThreshold = useMemo(() => {
    // equities: shares; crypto: “size” tends to be smaller
    return assetKey === "crypto" ? 2 : 1200;
  }, [assetKey]);

  // Sweep + streaks
  const [lastSweepSide, setLastSweepSide] = useState<"B" | "S" | null>(null);
  const [sweepStreak, setSweepStreak] = useState(0);
  const sweepTimesRef = useRef<number[]>([]);
  const [burst, setBurst] = useState(false);

  // Flash animation on newest prints
  const lastSeenRef = useRef<string>("");
  const [flashKey, setFlashKey] = useState<string>("");

  useEffect(() => {
    let alive = true;

    async function poll() {
      try {
        const qs = new URLSearchParams({ symbol: sym });
        if (assetKey) qs.set("asset", assetKey);

        const res = await fetch(`/api/market/tape?${qs.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(`Tape API ${res.status}`);

        const json = await res.json();

        // Accept {prints:[...]} or {data:[...]} or raw array
        const next: Print[] =
          (json?.prints as Print[]) ||
          (json?.data as Print[]) ||
          (Array.isArray(json) ? (json as Print[]) : []);

        if (!alive) return;

        setErr("");

        setPrints(() => {
          const merged = [...next].slice(0, 300);

          const newest = merged[0];
          if (newest?.ts && newest.ts !== lastSeenRef.current) {
            lastSeenRef.current = newest.ts;

            // ✅ flash animation
            const fk = `${newest.ts}-${newest.price}-${newest.size}`;
            setFlashKey(fk);
            window.setTimeout(() => setFlashKey(""), 220);

            const sz = Number(newest.size || 0);
            const side: Side =
              newest.side === "B" || newest.side === "S" ? newest.side : "M";

            // flow
            if (side === "B") setBuyVol((x) => x + sz);
            if (side === "S") setSellVol((x) => x + sz);

            // sweep detection
            const isSweep = sz >= sweepThreshold && (side === "B" || side === "S");
            if (isSweep) {
              setSweepStreak((cur) => (lastSweepSide === side ? cur + 1 : 1));
              setLastSweepSide(side);

              // momentum burst: 3 sweeps in 6s
              const now = Date.now();
              sweepTimesRef.current = [...sweepTimesRef.current, now].filter(
                (t) => now - t <= 6000
              );
              const hit = sweepTimesRef.current.length >= 3;
              setBurst(hit);
              if (hit) window.setTimeout(() => setBurst(false), 1200);
            }
          }

          return merged;
        });
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Tape error");
      }
    }

    if (!isLive) return;

    poll();
    const id = window.setInterval(poll, 900);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [sym, assetKey, isLive, sweepThreshold, lastSweepSide]);

  // Reset flow/streaks when switching symbol/asset
  useEffect(() => {
    setBuyVol(0);
    setSellVol(0);
    setSweepStreak(0);
    setLastSweepSide(null);
    setBurst(false);
    sweepTimesRef.current = [];
    lastSeenRef.current = "";
    setFlashKey("");
    setPrints([]);
    setErr("");
  }, [sym, assetKey]);

  const net = buyVol - sellVol;

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold tracking-wide">
            {sym}
            <span className="ml-2 text-[11px] font-medium text-muted-foreground">
              {assetKey.toUpperCase()}
            </span>
          </div>

          {/* sweep streak badge */}
          {sweepStreak >= 2 && lastSweepSide && (
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                lastSweepSide === "B"
                  ? "border-emerald-400/30 text-emerald-300"
                  : "border-red-400/30 text-red-300"
              )}
              title="Consecutive sweeps"
            >
              {lastSweepSide} x{sweepStreak}
            </span>
          )}

          {/* momentum burst */}
          {burst && (
            <span
              className="rounded-md border border-yellow-400/30 px-2 py-0.5 text-[11px] font-semibold text-yellow-200"
              title="Sweep momentum burst"
            >
              BURST
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[11px] text-muted-foreground">
            Buy {buyVol.toLocaleString()} • Sell {sellVol.toLocaleString()} •{" "}
            <span className={net >= 0 ? "text-emerald-300" : "text-red-300"}>
              Net {net.toLocaleString()}
            </span>
          </div>

          <button
            onClick={() => setIsLive((v) => !v)}
            className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {isLive ? "Live" : "Paused"}
          </button>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div className="mb-2 rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-[12px] text-red-200">
          {err}
        </div>
      )}

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/10">
        <div className="grid grid-cols-[72px_1fr_1fr_1fr] gap-0 border-b border-white/10 bg-white/5 px-2 py-1 text-[11px] text-muted-foreground">
          <div>Time</div>
          <div className="text-right">Price</div>
          <div className="text-right">Size</div>
          <div className="text-right">Side</div>
        </div>

        <div className="divide-y divide-white/5">
          {prints.map((p, idx) => {
            const side: Side =
              p.side === "B" || p.side === "S" ? p.side : "M";

            const isSweep =
              Number(p.size || 0) >= sweepThreshold && (side === "B" || side === "S");

            const rowKey = `${p.ts}-${p.price}-${p.size}`;
            const isFlash = rowKey === flashKey;

            return (
              <div
                key={`${p.ts}-${idx}`}
                className={cn(
                  "grid grid-cols-[72px_1fr_1fr_1fr] items-center px-2 py-1 text-[12px] transition-colors",
                  isSweep && "bg-white/5",
                  isFlash && "bg-white/15"
                )}
              >
                <div className="text-muted-foreground">{hhmm(p.ts)}</div>

                <div
                  className={cn(
                    "text-right tabular-nums",
                    side === "B" && "text-emerald-300",
                    side === "S" && "text-red-300"
                  )}
                >
                  {Number(p.price || 0).toFixed(assetKey === "crypto" ? 2 : 2)}
                </div>

                <div className="text-right tabular-nums">
                  {Number(p.size || 0).toLocaleString()}
                </div>

                <div className="text-right">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                      side === "B" && "border-emerald-400/30 text-emerald-300",
                      side === "S" && "border-red-400/30 text-red-300",
                      side === "M" && "border-white/15 text-muted-foreground"
                    )}
                  >
                    {isSweep ? `${side} SWEEP` : side}
                  </span>
                </div>
              </div>
            );
          })}

          {!prints.length && (
            <div className="px-3 py-6 text-sm text-muted-foreground">
              No tape data yet.
            </div>
          )}
        </div>
      </div>

      {/* Footer hint */}
      <div className="mt-2 text-[11px] text-muted-foreground">
        Flash on new prints • Sweep ≥ {sweepThreshold.toLocaleString()} ({assetKey})
      </div>
    </div>
  );
}

// ✅ default export ALSO (prevents import mismatch crashes)
export default TapePanel;
