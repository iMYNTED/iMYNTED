"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type AssetType = "stock" | "crypto";

type Level = { px: number; sz: number };
type Book = { bids: Level[]; asks: Level[] };

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fmtPx(n?: number) {
  if (n === undefined || n === null || Number.isNaN(Number(n))) return "—";
  return Number(n).toFixed(2);
}

function fmtSz(n?: number) {
  if (n === undefined || n === null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);

  // keep true zeros as zero
  if (v === 0) return "0";

  // ✅ crypto often fractional — don't round into 0
  if (v < 0.0001) return v.toExponential(2); // e.g. 3.4e-5
  if (v < 1) {
    const s = v.toFixed(6); // show up to 6 decimals
    return s.replace(/0+$/, "").replace(/\.$/, ""); // trim trailing zeros
  }

  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
  return String(Math.round(v));
}

// ✅ more robust number parsing for crypto feeds (strings, commas, etc.)
function toNum(x: any) {
  if (x === null || x === undefined) return NaN;
  if (typeof x === "number") return x;
  if (typeof x === "string") {
    const s = x.replace(/,/g, "").trim();
    if (!s) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function safeLevels(raw: any): Level[] {
  const arr: any[] = Array.isArray(raw) ? raw : [];
  const out: Level[] = [];

  for (const x of arr) {
    // array formats: [price, size] or ["price","size"]
    if (Array.isArray(x) && x.length >= 2) {
      const px = toNum(x[0]);
      const sz = toNum(x[1]);
      if (Number.isFinite(px) && Number.isFinite(sz)) out.push({ px, sz });
      continue;
    }

    const px = toNum(x?.px ?? x?.price ?? x?.p);

    // ✅ IMPORTANT: crypto commonly uses qty/amount/q
    const sz = toNum(
      x?.sz ??
        x?.size ??
        x?.s ??
        x?.qty ??
        x?.quantity ??
        x?.amount ??
        x?.q
    );

    if (Number.isFinite(px) && Number.isFinite(sz)) out.push({ px, sz });
  }

  return out;
}

// ✅ only called inside effects (client), never during SSR render
function buildSimBook(mid: number, depth = 12): Book {
  const bids: Level[] = [];
  const asks: Level[] = [];
  const tick = mid < 10 ? 0.01 : mid < 100 ? 0.01 : 0.05;

  for (let i = 0; i < depth; i++) {
    const bpx = +(mid - (i + 1) * tick).toFixed(2);
    const apx = +(mid + (i + 1) * tick).toFixed(2);

    // keep “alive” but not crazy
    const bsz = Math.round(200 + Math.random() * 12000);
    const asz = Math.round(200 + Math.random() * 12000);

    bids.push({ px: bpx, sz: bsz });
    asks.push({ px: apx, sz: asz });
  }

  return { bids, asks };
}

type PulseMap = Record<string, 1>;

export function MarketDepthPanel({
  symbol,
  asset = "stock",
}: {
  symbol: string;
  asset?: AssetType;
}) {
  // normalize symbol by asset
  const sym = useMemo(() => {
    const s = (symbol || "").toUpperCase().trim();
    if (!s) return asset === "crypto" ? "BTC-USD" : "AAPL";
    if (asset === "crypto") return s.includes("-") ? s : `${s}-USD`;
    return s.replace("-USD", "");
  }, [symbol, asset]);

  const depth = 12;

  // ✅ start empty so SSR/CSR match perfectly
  const [book, setBook] = useState<Book>({ bids: [], asks: [] });
  const [mode, setMode] = useState<"auto" | "api" | "sim">("auto");
  const [err, setErr] = useState("");

  const prevRef = useRef<Book | null>(null);
  const midRef = useRef<number>(100);

  const [pulse, setPulse] = useState<PulseMap>({});
  const timers = useRef<Record<string, any>>({});

  function pulseKey(k: string) {
    setPulse((p) => ({ ...p, [k]: 1 }));
    if (timers.current[k]) clearTimeout(timers.current[k]);
    timers.current[k] = setTimeout(() => {
      setPulse((p) => {
        const next = { ...p };
        delete next[k];
        return next;
      });
      delete timers.current[k];
    }, 220);
  }

  async function fetchBookFromApi(): Promise<Book | null> {
    const urls =
      asset === "crypto"
        ? [
            `/api/crypto/depth?symbol=${encodeURIComponent(sym)}`,
            `/api/crypto/book?symbol=${encodeURIComponent(sym)}`,
          ]
        : [
            `/api/market/depth?symbol=${encodeURIComponent(sym)}`,
            `/api/market/l2?symbol=${encodeURIComponent(sym)}`,
            `/api/market/book?symbol=${encodeURIComponent(sym)}`,
          ];

    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;

        const raw = await res.json();

        if (raw?.ok === false) continue;
        const data = raw?.data ?? raw;

        const bids = safeLevels(data?.bids ?? data?.bid ?? data?.book?.bids).slice(0, 50);
        const asks = safeLevels(data?.asks ?? data?.ask ?? data?.book?.asks).slice(0, 50);

        if (bids.length >= 2 && asks.length >= 2) return { bids, asks };
      } catch {
        continue;
      }
    }

    return null;
  }

  function apply(next: Book) {
    const prev = prevRef.current;

    if (prev) {
      for (let i = 0; i < depth; i++) {
        const pb = prev.bids?.[i];
        const nb = next.bids?.[i];
        const pa = prev.asks?.[i];
        const na = next.asks?.[i];

        if (pb && nb && pb.sz !== nb.sz) pulseKey(`b_${i}`);
        if (pa && na && pa.sz !== na.sz) pulseKey(`a_${i}`);
      }
    }

    prevRef.current = next;
    setBook(next);
  }

  // seed on symbol/asset change (client only)
  useEffect(() => {
    setErr("");
    prevRef.current = null;
    setPulse({});
    midRef.current = clamp(midRef.current + (Math.random() - 0.5) * 5, 1, 5000);
    apply(buildSimBook(midRef.current, depth));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym, asset]);

  // poll loop (client only)
  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        if (!alive) return;

        if (mode === "sim") {
          midRef.current = clamp(midRef.current + (Math.random() - 0.5) * 0.35, 1, 5000);
          apply(buildSimBook(midRef.current, depth));
          return;
        }

        const api = await fetchBookFromApi();
        if (api) {
          const bb = api.bids?.[0]?.px;
          const ba = api.asks?.[0]?.px;
          if (Number.isFinite(bb) && Number.isFinite(ba)) midRef.current = (bb! + ba!) / 2;
          setErr("");
          apply(api);
          return;
        }

        if (mode === "auto") {
          midRef.current = clamp(midRef.current + (Math.random() - 0.5) * 0.35, 1, 5000);
          apply(buildSimBook(midRef.current, depth));
        } else {
          setErr("L2 API not available.");
        }
      } catch (e: any) {
        setErr(e?.message || "L2 error");
      }
    }

    tick();
    const t = setInterval(tick, 900);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym, asset, mode]);

  const bids = Array.isArray(book.bids) ? book.bids : [];
  const asks = Array.isArray(book.asks) ? book.asks : [];

  const maxBidSz = Math.max(1, ...bids.slice(0, depth).map((x) => x?.sz ?? 0));
  const maxAskSz = Math.max(1, ...asks.slice(0, depth).map((x) => x?.sz ?? 0));

  const bestBid = bids[0]?.px;
  const bestAsk = asks[0]?.px;
  const spr =
    Number.isFinite(bestBid) && Number.isFinite(bestAsk) ? (bestAsk! - bestBid!).toFixed(2) : "—";

  function barStyle(side: "bid" | "ask", pct: number, pulsing: boolean) {
    const a = pulsing ? 0.78 : 0.55;
    const bg =
      side === "bid"
        ? `linear-gradient(to right, rgba(16,185,129,${a}), rgba(16,185,129,0))`
        : `linear-gradient(to right, rgba(239,68,68,${a}), rgba(239,68,68,0))`;

    return {
      width: `${clamp(pct, 0, 100)}%`,
      background: bg,
      opacity: pulsing ? 0.52 : 0.34,
      filter: pulsing ? "brightness(1.18)" : "brightness(1.0)",
      transition: "width 200ms ease, opacity 180ms ease, filter 180ms ease",
    } as React.CSSProperties;
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* ✅ Header line stays dark */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/40 px-3 py-2">
        <div className="text-sm font-semibold text-white">
          {asset === "crypto" ? "Order Book" : "Level 2"}
        </div>

        <div className="text-[11px] text-white/60">
          {sym} • bid {fmtPx(bestBid)} / ask {fmtPx(bestAsk)} / spr {spr}
        </div>

        {/* ✅ FIX: remove bg-background (white) */}
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as any)}
          className={cn(
            "h-8 rounded-md border border-white/10 px-2 text-xs outline-none",
            "bg-black/35 text-white",
            "focus:ring-2 focus:ring-white/20"
          )}
          title="Data source"
        >
          <option value="auto">Auto</option>
          <option value="api">API</option>
          <option value="sim">Sim</option>
        </select>
      </div>

      {err ? (
        <div className="border-b border-white/10 bg-black/35 px-3 py-2 text-xs text-red-500">
          {err}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-12 border-b border-white/10 px-3 py-2 text-[11px] text-white/60">
          <div className="col-span-5">Bids</div>
          <div className="col-span-2 text-center">Spread</div>
          <div className="col-span-5 text-right">Asks</div>
        </div>

        <div className="grid grid-cols-12 border-b border-white/10 px-3 py-2 text-[11px] text-white/60">
          <div className="col-span-2">Px</div>
          <div className="col-span-2 text-right">Sz</div>
          <div className="col-span-1 text-right">Depth</div>

          <div className="col-span-2 text-center">Spr</div>

          <div className="col-span-1 text-right">Depth</div>
          <div className="col-span-2 text-right">Sz</div>
          <div className="col-span-2 text-right">Px</div>
        </div>

        {Array.from({ length: depth }).map((_, i) => {
          const b = bids[i];
          const a = asks[i];

          const bPct = b?.sz ? Math.round((b.sz / maxBidSz) * 100) : 0;
          const aPct = a?.sz ? Math.round((a.sz / maxAskSz) * 100) : 0;

          const rowSpr =
            Number.isFinite(b?.px) && Number.isFinite(a?.px) ? (a!.px - b!.px).toFixed(2) : "—";

          const bPulse = Boolean(pulse[`b_${i}`]);
          const aPulse = Boolean(pulse[`a_${i}`]);

          return (
            <div
              key={i}
              className={cn(
                "relative grid grid-cols-12 px-3 py-1.5 text-sm border-b border-white/10",
                i === 0 && "bg-white/5"
              )}
            >
              <div className="absolute inset-y-0 left-0" style={barStyle("bid", bPct, bPulse)} />
              <div className="absolute inset-y-0 left-1/2" style={barStyle("ask", aPct, aPulse)} />

              <div className="col-span-2 tabular-nums text-emerald-400 relative">{fmtPx(b?.px)}</div>
              <div className="col-span-2 text-right tabular-nums relative text-white/85">{fmtSz(b?.sz)}</div>
              <div className="col-span-1 text-right tabular-nums text-white/50 relative">
                {b ? `${bPct}%` : "—"}
              </div>

              <div className="col-span-2 text-center tabular-nums relative">
                <span className="inline-flex min-w-[2.5rem] justify-center rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-xs text-white/85">
                  {rowSpr}
                </span>
              </div>

              <div className="col-span-1 text-right tabular-nums text-white/50 relative">
                {a ? `${aPct}%` : "—"}
              </div>
              <div className="col-span-2 text-right tabular-nums relative text-white/85">{fmtSz(a?.sz)}</div>
              <div className="col-span-2 text-right tabular-nums text-red-400 relative">{fmtPx(a?.px)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
