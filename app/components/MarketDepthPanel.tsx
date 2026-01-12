"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type LevelRow = { px: number; sz: number };
type Depth = { symbol: string; ts: string; bids: LevelRow[]; asks: LevelRow[] };

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtPx(v: number) {
  return Number(v).toFixed(2);
}

function fmtSz(v: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return String(Math.round(n));
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function stableMidForSymbol(symbol: string) {
  // deterministic per symbol, so SSR/CSR match at first paint
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  const base = 120 + (h % 180); // 120..299
  const cents = (h % 100) / 100;
  return +(base + cents).toFixed(2);
}

function buildInitial(symbol: string): Depth {
  const mid = stableMidForSymbol(symbol);
  const bids = Array.from({ length: 20 }).map((_, i) => ({
    px: +(mid - (i + 1) * 0.01).toFixed(2),
    sz: 250 + i * 35,
  }));
  const asks = Array.from({ length: 20 }).map((_, i) => ({
    px: +(mid + (i + 1) * 0.01).toFixed(2),
    sz: 250 + i * 35,
  }));
  // ts fixed so SSR/CSR match
  return { symbol, ts: "1970-01-01T00:00:00.000Z", bids, asks };
}

function normalizeDepth(symbol: string, raw: any): Depth | null {
  const d = raw?.depth || raw;
  if (!d) return null;

  const bids: any[] = Array.isArray(d.bids) ? d.bids : [];
  const asks: any[] = Array.isArray(d.asks) ? d.asks : [];
  if (!bids.length || !asks.length) return null;

  const clean = (rows: any[]) =>
    rows
      .slice(0, 20)
      .map((r) => ({ px: Number(r.px), sz: Number(r.sz) }))
      .filter((r) => Number.isFinite(r.px) && Number.isFinite(r.sz));

  const cb = clean(bids);
  const ca = clean(asks);
  if (!cb.length || !ca.length) return null;

  return {
    symbol,
    ts: typeof d.ts === "string" ? d.ts : new Date().toISOString(),
    bids: cb,
    asks: ca,
  };
}

export function MarketDepthPanel(props: { symbol?: string; activeSymbol?: string }) {
  const symbol = useMemo(
    () => (props.activeSymbol || props.symbol || "AAPL").toUpperCase().trim(),
    [props.activeSymbol, props.symbol]
  );

  const [depth, setDepth] = useState<Depth>(() => buildInitial(symbol));
  const [flash, setFlash] = useState<Record<string, "up" | "down">>({});
  const flashTimer = useRef<any>(null);

  // reset when symbol changes
  useEffect(() => {
    setDepth(buildInitial(symbol));
    setFlash({});
  }, [symbol]);

  function setFlashBurst(updates: Record<string, "up" | "down">) {
    if (!Object.keys(updates).length) return;

    setFlash((f) => ({ ...f, ...updates }));

    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => {
      setFlash({});
    }, 250);
  }

  // Poll API; if empty/error -> simulate (Bloomberg vibe)
  useEffect(() => {
    let alive = true;

    function simulateTick() {
      setDepth((cur) => {
        const mid =
          (cur.bids[0]?.px + cur.asks[0]?.px) / 2 ||
          stableMidForSymbol(symbol);

        // deterministic “wobble”: based on current timestamp seconds (client only)
        const s = new Date().getSeconds();
        const wobble = (s % 2 === 0 ? 1 : -1) * 0.01;
        const newMid = +(mid + wobble).toFixed(2);

        const bids = cur.bids.map((r, i) => ({
          px: +(newMid - (i + 1) * 0.01).toFixed(2),
          sz: Math.max(10, Math.round(r.sz + ((i % 2 === 0 ? 1 : -1) * 18))),
        }));

        const asks = cur.asks.map((r, i) => ({
          px: +(newMid + (i + 1) * 0.01).toFixed(2),
          sz: Math.max(10, Math.round(r.sz + ((i % 3 === 0 ? 1 : -1) * 14))),
        }));

        const updates: Record<string, "up" | "down"> = {};
        for (let i = 0; i < 20; i++) {
          const db = bids[i].sz - cur.bids[i].sz;
          const da = asks[i].sz - cur.asks[i].sz;
          if (db !== 0) updates[`b-${i}`] = db > 0 ? "up" : "down";
          if (da !== 0) updates[`a-${i}`] = da > 0 ? "up" : "down";
        }
        setFlashBurst(updates);

        return { symbol, ts: new Date().toISOString(), bids, asks };
      });
    }

    async function poll() {
      if (!alive) return;

      try {
        const r = await fetch(`/api/market/depth?symbol=${encodeURIComponent(symbol)}`, {
          cache: "no-store",
        });
        const j = await r.json().catch(() => null);
        if (!alive) return;

        const norm = normalizeDepth(symbol, j);
        if (norm) {
          setDepth((prev) => {
            const updates: Record<string, "up" | "down"> = {};
            for (let i = 0; i < 20; i++) {
              const pb = prev.bids[i];
              const nb = norm.bids[i];
              const pa = prev.asks[i];
              const na = norm.asks[i];
              if (pb && nb && nb.sz !== pb.sz) updates[`b-${i}`] = nb.sz > pb.sz ? "up" : "down";
              if (pa && na && na.sz !== pa.sz) updates[`a-${i}`] = na.sz > pa.sz ? "up" : "down";
            }
            setFlashBurst(updates);
            return norm;
          });
        } else {
          simulateTick();
        }
      } catch {
        if (!alive) return;
        simulateTick();
      } finally {
        if (!alive) return;
        setTimeout(poll, 900);
      }
    }

    poll();
    return () => {
      alive = false;
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [symbol]);

  const bestBid = depth.bids[0]?.px ?? 0;
  const bestAsk = depth.asks[0]?.px ?? 0;
  const spread = bestAsk && bestBid ? +(bestAsk - bestBid).toFixed(2) : 0;

  const maxBid = useMemo(() => Math.max(1, ...depth.bids.map((r) => r.sz)), [depth]);
  const maxAsk = useMemo(() => Math.max(1, ...depth.asks.map((r) => r.sz)), [depth]);

  const flashCls = (key: string, side: "b" | "a") => {
    const v = flash[key];
    if (!v) return "";
    if (side === "b") return v === "up" ? "bg-emerald-500/25" : "bg-emerald-500/15";
    return v === "up" ? "bg-rose-500/15" : "bg-rose-500/25";
  };

  return (
    <div className="h-full min-h-0">
      <div className="mb-2 flex items-center justify-between text-[11px] text-white/45">
        <div>
          <span className="text-white/80 font-semibold">{symbol}</span>{" "}
          <span className="text-white/35">•</span>{" "}
          <span className="tabular-nums text-white/60">
            bid {bestBid ? fmtPx(bestBid) : "--"} / ask {bestAsk ? fmtPx(bestAsk) : "--"} / spr{" "}
            {spread ? spread.toFixed(2) : "--"}
          </span>
        </div>
        <div className="tabular-nums text-white/35">
          {depth.ts && depth.ts !== "1970-01-01T00:00:00.000Z"
            ? new Date(depth.ts).toLocaleTimeString()
            : ""}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 border-b border-white/10 text-[11px]">
          <div className="col-span-5 px-3 py-2 text-white/70 font-semibold">Bids</div>
          <div className="col-span-2 px-2 py-2 text-center text-white/60 font-semibold">
            Spread
          </div>
          <div className="col-span-5 px-3 py-2 text-white/70 font-semibold">Asks</div>
        </div>

        {/* 3-column ladder */}
        <div className="max-h-[560px] overflow-y-auto">
          {/* subheaders */}
          <div className="grid grid-cols-12 sticky top-0 z-10 bg-black/70 text-[10px] text-white/45 border-b border-white/10">
            <div className="col-span-5 grid grid-cols-3 px-3 py-1">
              <div>Px</div>
              <div className="text-right">Sz</div>
              <div className="text-right">Depth</div>
            </div>
            <div className="col-span-2 px-2 py-1 text-center">Spr</div>
            <div className="col-span-5 grid grid-cols-3 px-3 py-1">
              <div>Px</div>
              <div className="text-right">Sz</div>
              <div className="text-right">Depth</div>
            </div>
          </div>

          {Array.from({ length: 20 }).map((_, i) => {
            const b = depth.bids[i];
            const a = depth.asks[i];
            const bw = b ? clamp01(b.sz / maxBid) * 100 : 0;
            const aw = a ? clamp01(a.sz / maxAsk) * 100 : 0;
            const rowSpread = a && b ? +(a.px - b.px).toFixed(2) : spread;

            return (
              <div key={`row-${i}`} className="grid grid-cols-12 border-b border-white/5 text-[12px]">
                {/* BIDS */}
                <div
                  className={cn(
                    "col-span-5 relative grid grid-cols-3 items-center px-3 py-1 transition-colors",
                    flashCls(`b-${i}`, "b")
                  )}
                >
                  <div
                    className="absolute inset-y-0 left-0 z-0 bg-emerald-500/10 transition-[width] duration-300 ease-out"
                    style={{ width: `${bw}%` }}
                  />
                  <div className="relative z-10 tabular-nums text-emerald-300">
                    {b ? fmtPx(b.px) : "--"}
                  </div>
                  <div className="relative z-10 text-right tabular-nums text-white/75">
                    {b ? fmtSz(b.sz) : "--"}
                  </div>
                  <div className="relative z-10 text-right tabular-nums text-white/45">
                    {b ? `${Math.round(bw)}%` : ""}
                  </div>
                </div>

                {/* SPREAD */}
                <div className="col-span-2 px-2 py-1 flex items-center justify-center">
                  <div className="rounded-lg border border-white/10 bg-black/40 px-2 py-[2px] text-[11px] tabular-nums text-white/70">
                    {Number.isFinite(rowSpread) ? rowSpread.toFixed(2) : "--"}
                  </div>
                </div>

                {/* ASKS */}
                <div
                  className={cn(
                    "col-span-5 relative grid grid-cols-3 items-center px-3 py-1 transition-colors",
                    flashCls(`a-${i}`, "a")
                  )}
                >
                  <div
                    className="absolute inset-y-0 left-0 z-0 bg-rose-500/10 transition-[width] duration-300 ease-out"
                    style={{ width: `${aw}%` }}
                  />
                  <div className="relative z-10 tabular-nums text-rose-300">
                    {a ? fmtPx(a.px) : "--"}
                  </div>
                  <div className="relative z-10 text-right tabular-nums text-white/75">
                    {a ? fmtSz(a.sz) : "--"}
                  </div>
                  <div className="relative z-10 text-right tabular-nums text-white/45">
                    {a ? `${Math.round(aw)}%` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-white/10 px-3 py-2 text-[10px] text-white/40">
          Bloomberg ladder: Bids | Spread | Asks • flashes on size change • bars animate on updates
        </div>
      </div>
    </div>
  );
}
