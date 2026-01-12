"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type DepthLevel = { px: number; sz: number };

type DepthResponse = {
  symbol: string;
  bids: DepthLevel[];
  asks: DepthLevel[];
  source?: string;
  ts?: string;
};

function fmtPx(v: number | null | undefined) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

function fmtSz(v: number | null | undefined) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return v.toLocaleString();
}

function sumTop(levels: DepthLevel[], n: number) {
  return levels.slice(0, n).reduce((acc, l) => acc + (l?.sz ?? 0), 0);
}

function clamp(v: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

function computeWalls(levels: DepthLevel[], topN: number) {
  const slice = levels.slice(0, topN);
  if (!slice.length) return { threshold: Infinity, wallSet: new Set<string>() };

  const sizes = slice.map((l) => l.sz);
  const max = Math.max(...sizes);

  const threshold = Math.max(5000, Math.floor(max * 0.65));

  const wallSet = new Set<string>();
  for (const l of slice) {
    if (l.sz >= threshold) wallSet.add(`${l.px}|${l.sz}`);
  }

  return { threshold, wallSet };
}

function weightedMid(bids: DepthLevel[], asks: DepthLevel[], topN: number) {
  const b = bids.slice(0, topN);
  const a = asks.slice(0, topN);
  if (!b.length || !a.length) return null;

  const bidPx = b.reduce((acc, l) => acc + l.px * l.sz, 0);
  const bidSz = b.reduce((acc, l) => acc + l.sz, 0);

  const askPx = a.reduce((acc, l) => acc + l.px * l.sz, 0);
  const askSz = a.reduce((acc, l) => acc + l.sz, 0);

  if (bidSz === 0 || askSz === 0) return null;

  const wBid = bidPx / bidSz;
  const wAsk = askPx / askSz;

  return (wBid + wAsk) / 2;
}

function inferTickSize(bids: DepthLevel[], asks: DepthLevel[]) {
  const prices = [
    ...bids.slice(0, 8).map((l) => l.px),
    ...asks.slice(0, 8).map((l) => l.px),
  ]
    .filter((p) => Number.isFinite(p))
    .sort((a, b) => a - b);

  let min = Infinity;
  for (let i = 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0 && d < min) min = d;
  }

  if (!Number.isFinite(min) || min <= 0) return 0.01;

  const common = [0.01, 0.05, 0.1, 0.25, 0.5, 1];
  let best = common[0];
  let bestErr = Math.abs(min - best);
  for (const c of common) {
    const e = Math.abs(min - c);
    if (e < bestErr) {
      bestErr = e;
      best = c;
    }
  }
  return bestErr <= 0.002 ? best : min;
}

function useTweenNumber(target: number, ms = 320) {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = fromRef.current;
    const to = target;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (t: number) => {
      const p = clamp((t - start) / ms, 0, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (to - from) * eased;
      setVal(next);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, ms]);

  return val;
}

export function MarketDepthPanel({ symbol }: { symbol: string }) {
  const [data, setData] = useState<DepthResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setErr(null);
      try {
        const res = await fetch(
          `/api/market/depth?symbol=${encodeURIComponent(symbol)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as DepthResponse;
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load depth");
      }
    }

    run();
    const t = setInterval(run, 2500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [symbol]);

  const bids = useMemo(() => (data?.bids ?? []).slice(0, 12), [data]);
  const asks = useMemo(() => (data?.asks ?? []).slice(0, 12), [data]);

  const tick = useMemo(() => inferTickSize(bids, asks), [bids, asks]);

  const bestBid = useMemo(() => {
    if (!bids.length) return null;
    return bids.reduce((a, b) => (b.px > a.px ? b : a), bids[0]);
  }, [bids]);

  const bestAsk = useMemo(() => {
    if (!asks.length) return null;
    return asks.reduce((a, b) => (b.px < a.px ? b : a), asks[0]);
  }, [asks]);

  const mid = useMemo(() => {
    if (!bestBid || !bestAsk) return null;
    return (bestBid.px + bestAsk.px) / 2;
  }, [bestBid, bestAsk]);

  const spread = useMemo(() => {
    if (!bestBid || !bestAsk) return null;
    const abs = bestAsk.px - bestBid.px;
    const pct = mid ? (abs / mid) * 100 : null;
    const ticks = tick > 0 ? abs / tick : null;
    return { abs, pct, ticks };
  }, [bestBid, bestAsk, mid, tick]);

  const topN = 5;

  const imbalance = useMemo(() => {
    const bidTop = sumTop(bids, topN);
    const askTop = sumTop(asks, topN);
    const total = bidTop + askTop;
    if (total === 0) return null;

    const bidPct = (bidTop / total) * 100;
    const askPct = (askTop / total) * 100;
    const net = bidPct - askPct;
    return { bidTop, askTop, bidPct, askPct, net };
  }, [bids, asks]);

  const walls = useMemo(() => {
    const bidWalls = computeWalls(bids, topN);
    const askWalls = computeWalls(asks, topN);
    return { bidWalls, askWalls };
  }, [bids, asks]);

  const wMid = useMemo(() => weightedMid(bids, asks, topN), [bids, asks]);

  const nearTouchDepth = 2;

  const bidNearWalls = useMemo(() => {
    let c = 0;
    const set = new Set(bids.slice(0, nearTouchDepth).map((l) => `${l.px}|${l.sz}`));
    bids.slice(0, nearTouchDepth).forEach((l) => {
      if (walls.bidWalls.wallSet.has(`${l.px}|${l.sz}`) && set.has(`${l.px}|${l.sz}`)) c++;
    });
    return c;
  }, [bids, walls.bidWalls.wallSet]);

  const askNearWalls = useMemo(() => {
    let c = 0;
    const set = new Set(asks.slice(0, nearTouchDepth).map((l) => `${l.px}|${l.sz}`));
    asks.slice(0, nearTouchDepth).forEach((l) => {
      if (walls.askWalls.wallSet.has(`${l.px}|${l.sz}`) && set.has(`${l.px}|${l.sz}`)) c++;
    });
    return c;
  }, [asks, walls.askWalls.wallSet]);

  const pressure = useMemo(() => {
    if (!spread || mid == null) return null;

    const spreadTicks = spread.ticks ?? (spread.abs / tick);
    const tight = 1 - clamp((spreadTicks - 1) / 5);

    const imb = imbalance ? clamp(imbalance.net / 50, -1, 1) : 0;
    const near = clamp((bidNearWalls - askNearWalls) / 2, -1, 1);
    const skew = wMid == null ? 0 : clamp((wMid - mid) / (tick * 4), -1, 1);

    const dir = clamp(0.55 * imb + 0.25 * near + 0.20 * skew, -1, 1);
    const strength = clamp(0.55 * tight + 0.45 * Math.abs(dir), 0, 1);

    const buy = Math.round(clamp(dir, 0, 1) * 100 * strength);
    const sell = Math.round(clamp(-dir, 0, 1) * 100 * strength);

    const label = buy >= 60 ? "BUY PRESSURE" : sell >= 60 ? "SELL PRESSURE" : "NEUTRAL";

    return { buy, sell, label, strength, tight, spreadTicks };
  }, [spread, mid, tick, imbalance, bidNearWalls, askNearWalls, wMid]);

  // animated values
  const buyAnim = useTweenNumber(pressure?.buy ?? 0, 360);
  const sellAnim = useTweenNumber(pressure?.sell ?? 0, 360);
  const strengthAnim = useTweenNumber(Math.round((pressure?.strength ?? 0) * 100), 360);
  const tightAnim = useTweenNumber(Math.round((pressure?.tight ?? 0) * 100), 360);

  if (err) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-red-300">
        Depth error: {err}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-white/40">
        <div>
          Market Depth (Level 2) • <span className="text-white/70">{symbol}</span>
          {data?.source ? ` • Source: ${data.source}` : ""}
        </div>
        <div className="text-white/30">
          {data?.ts ? new Date(data.ts).toLocaleTimeString() : ""}
        </div>
      </div>

      {/* Top stats */}
      <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="text-[10px] text-white/40">BEST BID</div>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="text-lg font-semibold tabular-nums text-emerald-300">
                {fmtPx(bestBid?.px)}
              </div>
              <div className="text-[11px] tabular-nums text-white/50">
                {fmtSz(bestBid?.sz)}
              </div>
            </div>
            <div className="mt-1 text-[10px] text-white/35">
              Walls:{" "}
              <span className="text-white/55 tabular-nums">
                {walls.bidWalls.wallSet.size}
              </span>{" "}
              • ≥{" "}
              <span className="text-white/55 tabular-nums">
                {Number.isFinite(walls.bidWalls.threshold)
                  ? fmtSz(walls.bidWalls.threshold)
                  : "—"}
              </span>{" "}
              • Near: <span className="text-white/55 tabular-nums">{bidNearWalls}</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="text-[10px] text-white/40">SPREAD</div>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="text-lg font-semibold tabular-nums text-white/80">
                {fmtPx(spread?.abs)}
              </div>
              <div className="text-[11px] tabular-nums text-white/50">
                {typeof spread?.pct === "number" ? `${spread.pct.toFixed(3)}%` : ""}
              </div>
            </div>

            <div className="mt-1 grid grid-cols-2 gap-2 text-[10px] text-white/35">
              <div>
                Mid: <span className="tabular-nums text-white/60">{fmtPx(mid)}</span>
              </div>
              <div>
                WMid(5):{" "}
                <span className="tabular-nums text-white/60">{fmtPx(wMid)}</span>
              </div>
              <div>
                Tick: <span className="tabular-nums text-white/60">{tick.toFixed(2)}</span>
              </div>
              <div>
                Spread:{" "}
                <span className="tabular-nums text-white/60">
                  {typeof spread?.ticks === "number" ? `${spread.ticks.toFixed(1)}t` : "—"}
                </span>
              </div>
              <div>
                Imb(5):{" "}
                <span
                  className={[
                    "tabular-nums font-semibold",
                    (imbalance?.net ?? 0) >= 0 ? "text-emerald-300" : "text-red-300",
                  ].join(" ")}
                >
                  {imbalance ? `${imbalance.net.toFixed(1)}%` : "—"}
                </span>
              </div>
              <div className="tabular-nums text-white/45">
                {imbalance ? `${imbalance.bidPct.toFixed(1)} / ${imbalance.askPct.toFixed(1)}` : ""}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="text-[10px] text-white/40">BEST ASK</div>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="text-lg font-semibold tabular-nums text-red-300">
                {fmtPx(bestAsk?.px)}
              </div>
              <div className="text-[11px] tabular-nums text-white/50">
                {fmtSz(bestAsk?.sz)}
              </div>
            </div>
            <div className="mt-1 text-[10px] text-white/35">
              Walls:{" "}
              <span className="text-white/55 tabular-nums">
                {walls.askWalls.wallSet.size}
              </span>{" "}
              • ≥{" "}
              <span className="text-white/55 tabular-nums">
                {Number.isFinite(walls.askWalls.threshold)
                  ? fmtSz(walls.askWalls.threshold)
                  : "—"}
              </span>{" "}
              • Near: <span className="text-white/55 tabular-nums">{askNearWalls}</span>
            </div>
          </div>
        </div>

        {/* Animated BUY/SELL meters */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold text-white/70">PRESSURE METERS</div>
            <div className="text-[11px] text-white/40">{pressure ? pressure.label : "—"}</div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/50 p-3">
              <div className="flex items-baseline justify-between">
                <div className="text-[11px] font-semibold text-white/60">BUY</div>
                <div className="text-lg font-bold tabular-nums text-emerald-300">
                  {Math.round(buyAnim)}
                </div>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-emerald-400/40 transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.round(buyAnim)}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-white/35">
                strength{" "}
                <span className="tabular-nums text-white/55">{Math.round(strengthAnim)}%</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/50 p-3">
              <div className="flex items-baseline justify-between">
                <div className="text-[11px] font-semibold text-white/60">SELL</div>
                <div className="text-lg font-bold tabular-nums text-red-300">
                  {Math.round(sellAnim)}
                </div>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-red-400/40 transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.round(sellAnim)}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-white/35">
                tight{" "}
                <span className="tabular-nums text-white/55">{Math.round(tightAnim)}%</span>
                {" • "}
                spread{" "}
                <span className="tabular-nums text-white/55">
                  {pressure ? pressure.spreadTicks.toFixed(1) : "—"}t
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NOTE: leaving your tables as-is (you already liked them) */}
    </div>
  );
}
