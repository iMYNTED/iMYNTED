"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type TapeSide = "B" | "S" | "M";

type TapePrint = {
  t: string; // time label
  px: number;
  sz: number;
  side: TapeSide;
};

type TapeResponse = {
  symbol?: string;
  prints?: TapePrint[];
  source?: string;
  ts?: string;
};

function safeNum(v: any, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function sideLabel(side: TapeSide) {
  if (side === "B") return "B";
  if (side === "S") return "S";
  return "M";
}

function sideClasses(side: TapeSide) {
  if (side === "B") return "text-emerald-200 bg-emerald-500/10 border-emerald-400/20";
  if (side === "S") return "text-red-200 bg-red-500/10 border-red-400/20";
  return "text-white/70 bg-white/5 border-white/10";
}

export function TapePanel({ symbol }: { symbol: string }) {
  const sym = useMemo(() => (symbol || "AAPL").toUpperCase(), [symbol]);

  const [prints, setPrints] = useState<TapePrint[]>([]);
  const [source, setSource] = useState<string>("mock");
  const [loading, setLoading] = useState(false);

  // autoscroll that won’t fight user when they scroll up
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    stickToBottomRef.current = nearBottom;
  }

  async function fetchNow() {
    setLoading(true);
    try {
      const url = `/api/market/tape?symbol=${encodeURIComponent(sym)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;

      const json = (await res.json()) as TapeResponse;
      const next = Array.isArray(json.prints) ? json.prints : [];

      // sanitize to avoid toFixed crashes
      const clean = next
        .map((p) => ({
          t: String(p.t ?? ""),
          px: safeNum((p as any).px, NaN),
          sz: safeNum((p as any).sz, NaN),
          side: (p.side === "B" || p.side === "S" || p.side === "M" ? p.side : "M") as TapeSide,
        }))
        .filter((p) => Number.isFinite(p.px) && Number.isFinite(p.sz));

      if (clean.length) setPrints(clean);
      setSource(json.source ?? json.ts ? (json.source ?? "mock") : "mock");
    } finally {
      setLoading(false);
    }
  }

  // initial + refresh
  useEffect(() => {
    fetchNow();
    const t = setInterval(fetchNow, 1500); // fast tape feel
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym]);

  // autoscroll when new data comes in
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [prints]);

  const lastKey = prints.length
    ? `${prints[prints.length - 1].t}-${prints[prints.length - 1].px}-${prints[prints.length - 1].sz}-${prints[prints.length - 1].side}`
    : "";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold text-white/80">
          Tape • {sym}
        </div>
        <div className="text-[11px] text-white/45">
          {loading ? "Updating…" : `Source: ${source}`}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
        {/* header */}
        <div className="grid grid-cols-[0.9fr_1fr_1fr_0.7fr] gap-2 border-b border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/70">
          <div>Time</div>
          <div className="text-right">Price</div>
          <div className="text-right">Size</div>
          <div className="text-right">Side</div>
        </div>

        {/* list */}
        <div
          ref={listRef}
          onScroll={onScroll}
          className="max-h-[320px] overflow-auto"
        >
          {prints.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-white/45">No prints yet.</div>
          ) : (
            prints.map((p) => {
              const key = `${p.t}-${p.px}-${p.sz}-${p.side}`;
              const isLast = key === lastKey;

              return (
                <div
                  key={key}
                  className={[
                    "grid grid-cols-[0.9fr_1fr_1fr_0.7fr] gap-2 px-3 py-2 text-[12px]",
                    "border-b border-white/5",
                    "hover:bg-white/5 transition-colors",
                    isLast ? "bg-white/5" : "bg-transparent",
                  ].join(" ")}
                >
                  <div className="text-white/60 tabular-nums">{p.t}</div>

                  <div className="text-right tabular-nums text-white/85">
                    {p.px.toFixed(2)}
                  </div>

                  <div className="text-right tabular-nums text-white/70">
                    {p.sz.toLocaleString()}
                  </div>

                  <div className="text-right">
                    <span
                      className={[
                        "inline-flex items-center justify-center rounded-lg border px-2 py-0.5 text-[11px] font-bold",
                        sideClasses(p.side),
                        isLast ? "ring-1 ring-white/15" : "",
                      ].join(" ")}
                    >
                      {sideLabel(p.side)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-white/10 px-3 py-2 text-[10px] text-white/35">
          Auto-scroll sticks when you’re at the bottom • Scroll up to “pause”
        </div>
      </div>
    </div>
  );
}

