"use client";

import React, { useEffect, useMemo, useState } from "react";

type Level = { price: number; size: number };

function fmt(n: number) {
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "";
}

export default function OrderFlowPanel({
  bids,
  asks,
}: {
  bids: Level[];
  asks: Level[];
}) {
  // -------- Volume Profile --------
  const profile = useMemo(() => {
    const map = new Map<number, number>();

    for (const b of bids) {
      map.set(b.price, (map.get(b.price) || 0) + b.size);
    }
    for (const a of asks) {
      map.set(a.price, (map.get(a.price) || 0) + a.size);
    }

    return Array.from(map.entries())
      .map(([price, vol]) => ({ price, vol }))
      .sort((a, b) => b.price - a.price)
      .slice(0, 40);
  }, [bids, asks]);

  const maxVol = Math.max(1, ...profile.map((p) => p.vol));

  // -------- Delta --------
  const bidVol = bids.reduce((s, b) => s + b.size, 0);
  const askVol = asks.reduce((s, a) => s + a.size, 0);
  const delta = bidVol - askVol;

  const deltaPct =
    bidVol + askVol === 0 ? 0 : (delta / (bidVol + askVol)) * 100;

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 p-3">

      {/* DELTA HISTOGRAM */}
      <div className="rounded-xl border border-white/10 bg-black/40 p-3">
        <div className="text-xs text-white/60 mb-2">Order Flow Delta</div>

        <div className="h-4 w-full bg-white/10 rounded overflow-hidden flex">
          <div
            className="bg-emerald-400 transition-all"
            style={{ width: `${Math.max(0, deltaPct)}%` }}
          />
          <div
            className="bg-rose-400 transition-all"
            style={{ width: `${Math.max(0, -deltaPct)}%` }}
          />
        </div>

        <div className="mt-2 text-xs tabular-nums flex justify-between">
          <span className="text-emerald-300">Buy {fmt(bidVol)}</span>
          <span className="text-white/60">Δ {fmt(delta)}</span>
          <span className="text-rose-300">Sell {fmt(askVol)}</span>
        </div>
      </div>

      {/* VOLUME PROFILE */}
      <div className="rounded-xl border border-white/10 bg-black/40 min-h-0 flex-1 overflow-hidden">

        <div className="border-b border-white/10 px-3 py-2 text-xs text-white/60">
          Volume Profile
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {profile.map((p) => {
            const pct = (p.vol / maxVol) * 100;

            return (
              <div
                key={p.price}
                className="relative px-3 py-1.5 text-[12px] flex justify-between tabular-nums"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-indigo-400/25"
                  style={{ width: `${pct}%` }}
                />

                <span className="relative z-10 text-white/85">
                  {fmt(p.price)}
                </span>
                <span className="relative z-10 text-white/60">
                  {fmt(p.vol)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
