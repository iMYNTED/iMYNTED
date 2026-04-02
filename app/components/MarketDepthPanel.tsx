// app/components/MarketDepthPanel.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSettings } from "./SettingsContext";

type AssetType = "stock" | "crypto";

type Level = { px: number; sz: number };
type Book = { bids: Level[]; asks: Level[] };

type CanonQuote = {
  symbol?: string;
  asset?: "stock" | "crypto";
  price?: number;
  last?: number;
  mid?: number;
  bid?: number;
  ask?: number;
  ts?: string;
  provider?: string;
  warn?: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/* ------------------------ Canonical symbol helpers ------------------------ */
/** MUST match Positions/SymbolHeader/Tape/Chart/Trader */
function normSym(raw: string) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.\-]/g, "");
}

function normalizeCryptoSymbol(raw: string) {
  const s = normSym(raw);
  if (!s) return "BTC-USD";
  if (s.includes("-")) return s;
  if (s.endsWith("USD")) return s.replace(/USD$/, "-USD");
  return `${s}-USD`;
}

/**
 * ✅ STOCK RULE (must match ChartPanel/TraderCard/SymbolHeader):
 * - strip -USD
 * - strip trailing digits
 * - if contains "-" -> "AAPL" (your rule)
 * - allow "." in symbols (BRK.B)
 */
function normalizeStockSymbol(raw: string) {
  let s = normSym(raw);
  if (!s) return "AAPL";
  s = s.replace(/-USD$/i, "");
  s = s.replace(/[0-9]+$/, "");
  if (s.includes("-")) return "AAPL"; // your rule
  s = s.replace(/[^A-Z0-9.]/g, "");
  return s || "AAPL";
}

function normalizeSymbol(asset: AssetType, raw: string) {
  return asset === "crypto" ? normalizeCryptoSymbol(raw) : normalizeStockSymbol(raw);
}

/* ----------------------------- Price formatting ---------------------------- */

function decFor(asset: AssetType, px: number) {
  if (asset === "stock") return px >= 1 ? 2 : 4;
  if (px >= 100) return 2;
  if (px >= 1) return 4;
  return 6;
}

function fmtPx(v?: number, asset?: AssetType) {
  if (v === undefined || v === null || Number.isNaN(Number(v))) return "—";
  const a = asset || "stock";
  const d = decFor(a, Number(v));
  return Number(v).toFixed(d);
}

function fmtSz(n?: number) {
  if (n === undefined || n === null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);

  if (v === 0) return "0";
  if (v < 0.0001) return v.toExponential(2);
  if (v < 1) {
    const s = v.toFixed(6);
    return s.replace(/0+$/, "").replace(/\.$/, "");
  }

  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
  return String(Math.round(v));
}

function fmtPct01(p?: number) {
  if (!Number.isFinite(p as any)) return "—";
  const x = clamp(Number(p), 0, 100);
  return `${Math.round(x)}%`;
}

function toNum(x: any) {
  if (x === null || x === undefined) return NaN;
  if (typeof x === "number") return x;
  if (typeof x === "string") {
    const s = x.replace(/,/g, "").trim();
    if (!s) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

function safeLevels(raw: any): Level[] {
  const arr: any[] = Array.isArray(raw) ? raw : [];
  const out: Level[] = [];

  for (const x of arr) {
    if (Array.isArray(x) && x.length >= 2) {
      const px = toNum(x[0]);
      const sz = toNum(x[1]);
      if (Number.isFinite(px) && Number.isFinite(sz)) out.push({ px, sz });
      continue;
    }

    const px = toNum(x?.px ?? x?.price ?? x?.p);
    const sz = toNum(x?.sz ?? x?.size ?? x?.s ?? x?.qty ?? x?.quantity ?? x?.amount ?? x?.q);

    if (Number.isFinite(px) && Number.isFinite(sz)) out.push({ px, sz });
  }

  return out;
}

function roundPx(asset: AssetType, px: number) {
  const d = decFor(asset, px);
  return Number(px.toFixed(d));
}

function tickFor(asset: AssetType, px: number) {
  if (!Number.isFinite(px) || px <= 0) return 0.01;
  if (asset === "stock") return px >= 1 ? 0.01 : 0.0001;
  if (px >= 100) return 0.05;
  if (px >= 1) return 0.01;
  if (px >= 0.01) return 0.0001;
  return 0.000001;
}

/** seeded RNG so SIM sizes feel alive but stable-ish */
function hash32(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function makeRng(seed: number) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

/**
 * ✅ Normalize, sort, dedupe, and trim.
 * bids: DESC px
 * asks: ASC px
 * Remove non-positive / NaN / crossed levels.
 */
function normalizeBook(asset: AssetType, raw: Book, depth: number): Book | null {
  const bids0 = Array.isArray(raw?.bids) ? raw.bids : [];
  const asks0 = Array.isArray(raw?.asks) ? raw.asks : [];

  const bids = bids0
    .map((l) => ({ px: toNum(l?.px), sz: toNum(l?.sz) }))
    .filter((l) => Number.isFinite(l.px) && Number.isFinite(l.sz) && l.px > 0 && l.sz >= 0)
    .map((l) => ({ px: roundPx(asset, l.px), sz: l.sz }));

  const asks = asks0
    .map((l) => ({ px: toNum(l?.px), sz: toNum(l?.sz) }))
    .filter((l) => Number.isFinite(l.px) && Number.isFinite(l.sz) && l.px > 0 && l.sz >= 0)
    .map((l) => ({ px: roundPx(asset, l.px), sz: l.sz }));

  if (!bids.length || !asks.length) return null;

  bids.sort((a, b) => b.px - a.px);
  asks.sort((a, b) => a.px - b.px);

  // dedupe by price (keep max size at that price)
  const dedupe = (levels: Level[]) => {
    const m = new Map<number, number>();
    for (const l of levels) {
      const prev = m.get(l.px);
      if (prev === undefined) m.set(l.px, l.sz);
      else m.set(l.px, Math.max(prev, l.sz));
    }
    return Array.from(m.entries()).map(([px, sz]) => ({ px, sz }));
  };

  const bidsD = dedupe(bids).sort((a, b) => b.px - a.px);
  const asksD = dedupe(asks).sort((a, b) => a.px - b.px);

  // remove crossed: ensure bestAsk > bestBid
  const bestBid = bidsD[0]?.px;
  const bestAsk = asksD[0]?.px;
  if (Number.isFinite(bestBid) && Number.isFinite(bestAsk) && bestAsk <= bestBid) {
    const asksF = asksD.filter((x) => x.px > bestBid);
    const bidsF = bidsD.filter((x) => x.px < bestAsk);
    if (!asksF.length || !bidsF.length) return null;
    return { bids: bidsF.slice(0, depth), asks: asksF.slice(0, depth) };
  }

  return { bids: bidsD.slice(0, depth), asks: asksD.slice(0, depth) };
}

/**
 * ✅ SIM BOOK should match canonical quote tick/decimals.
 * Sizes jitter slightly (seeded) so it feels alive without price drift.
 */
function buildSimBook(asset: AssetType, anchor: number, depth: number, seedTag: string): Book {
  const bids: Level[] = [];
  const asks: Level[] = [];

  const px = Math.max(0.000001, Number(anchor) || 1);
  const tick = tickFor(asset, px);

  // stable-ish seed changes every ~2.5s (sizes only)
  const bucket = Math.floor(Date.now() / 2500);
  const rnd = makeRng(hash32(`${seedTag}:${asset}:${bucket}:${Math.round(px / tick)}`));

  for (let i = 0; i < depth; i++) {
    const bpx = roundPx(asset, px - (i + 1) * tick);
    const apx = roundPx(asset, px + (i + 1) * tick);

    if (asset === "crypto") {
      const baseB = 0.03 + ((i * 13) % 6) * 0.01;
      const baseA = 0.03 + ((i * 17) % 6) * 0.01;

      const jb = 1 + (rnd() - 0.5) * 0.24;
      const ja = 1 + (rnd() - 0.5) * 0.24;

      const bsz = Number((baseB * jb).toFixed(4));
      const asz = Number((baseA * ja).toFixed(4));

      bids.push({ px: bpx, sz: Math.max(0, bsz) });
      asks.push({ px: apx, sz: Math.max(0, asz) });
    } else {
      const baseB = 250 + ((i * 733) % 9000);
      const baseA = 250 + ((i * 911) % 9000);

      const jb = 1 + (rnd() - 0.5) * 0.36;
      const ja = 1 + (rnd() - 0.5) * 0.36;

      const bsz = Math.round(baseB * jb);
      const asz = Math.round(baseA * ja);

      bids.push({ px: bpx, sz: Math.max(0, bsz) });
      asks.push({ px: apx, sz: Math.max(0, asz) });
    }
  }

  return { bids, asks };
}

type PulseMap = Record<string, 1>;

export function MarketDepthPanel({ symbol, asset = "stock" }: { symbol: string; asset?: AssetType }) {
  const { upColor, downColor } = useSettings();
  const sym = useMemo(() => normalizeSymbol(asset, symbol), [symbol, asset]);

  const [depth, setDepth] = useState(40);
  const [showDepthMenu, setShowDepthMenu] = useState(false);

  const [book, setBook] = useState<Book>({ bids: [], asks: [] });
  const [mode, setMode] = useState<"auto" | "api" | "sim">("auto");
  const [err, setErr] = useState("");
  const [detached, setDetached] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 120, y: 80 });
  const dragRef = useRef<{ ox: number; oy: number } | null>(null);
  function onDragStart(e: React.PointerEvent) { e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { ox: e.clientX - dragPos.x, oy: e.clientY - dragPos.y }; }
  function onDragMove(e: React.PointerEvent) { if (!dragRef.current) return; setDragPos({ x: e.clientX - dragRef.current.ox, y: e.clientY - dragRef.current.oy }); }
  function onDragEnd() { dragRef.current = null; }

  const prevRef = useRef<Book | null>(null);

  // ✅ Anchor must be canonical quote.price (mid only if bid/ask exists, else last/price) — no drift.
  const anchorRef = useRef<number>(asset === "crypto" ? 43000 : 100);
  const lastCanonAtRef = useRef<number>(0);
  const canonRef = useRef<{ price?: number; bid?: number; ask?: number; ts?: string; provider?: string }>({});

  const [pulse, setPulse] = useState<PulseMap>({});
  const timers = useRef<Record<string, any>>({});

  const inFlightRef = useRef(false);

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

  /** ✅ PRIMARY: subscribe to canonical quote bus from SymbolHeader */
  useEffect(() => {
    function onQuote(ev: any) {
      const d: CanonQuote = ev?.detail || {};
      const easset = (d?.asset === "crypto" ? "crypto" : "stock") as AssetType;
      if (easset !== asset) return;

      const esymRaw = String(d?.symbol || "").toUpperCase().trim();
      if (!esymRaw) return;

      const esym = normalizeSymbol(asset, esymRaw);
      if (esym !== sym) return;

      const px = typeof d?.price === "number" && d.price > 0 ? d.price : undefined;
      const bid = typeof d?.bid === "number" && d.bid > 0 ? d.bid : undefined;
      const ask = typeof d?.ask === "number" && d.ask > 0 ? d.ask : undefined;

      if (px !== undefined) anchorRef.current = px;

      canonRef.current = {
        price: px,
        bid,
        ask,
        ts: typeof d?.ts === "string" ? d.ts : undefined,
        provider: typeof d?.provider === "string" ? d.provider : undefined,
      };
      lastCanonAtRef.current = Date.now();

      if (mode !== "api") {
        apply(buildSimBook(asset, anchorRef.current, depth, sym));
      }
    }

    window.addEventListener("imynted:quote", onQuote as any);
    window.addEventListener("imynted:quoteUpdate", onQuote as any);
    window.addEventListener("msa:quote", onQuote as any);
    return () => {
      window.removeEventListener("imynted:quote", onQuote as any);
      window.removeEventListener("imynted:quoteUpdate", onQuote as any);
      window.removeEventListener("msa:quote", onQuote as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym, asset, mode]);

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

        const raw = await res.json().catch(() => null);
        if (!raw) continue;
        if (raw?.ok === false) continue;

        const data = raw?.data ?? raw;

        const bidsRaw = safeLevels(data?.bids ?? data?.bid ?? data?.book?.bids);
        const asksRaw = safeLevels(data?.asks ?? data?.ask ?? data?.book?.asks);

        const normalized = normalizeBook(asset, { bids: bidsRaw, asks: asksRaw }, depth);
        if (normalized && normalized.bids.length >= 2 && normalized.asks.length >= 2) return normalized;
      } catch {
        continue;
      }
    }

    return null;
  }

  /** Seed book from canonical anchor (bus) or fallback */
  useEffect(() => {
    prevRef.current = null;
    setPulse({});
    setErr("");

    if (Number.isFinite(anchorRef.current) && anchorRef.current > 0) {
      apply(buildSimBook(asset, anchorRef.current, depth, sym));
      return;
    }

    anchorRef.current = clamp(asset === "crypto" ? 43000 : 100, 0.000001, 5_000_000);
    apply(buildSimBook(asset, anchorRef.current, depth, sym));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym, asset]);

  /** Poll loop */
  useEffect(() => {
    let alive = true;
    let timer: any;

    async function tick() {
      if (!alive) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        if (mode === "api") {
          const api = await fetchBookFromApi();
          if (api) {
            const bb = api.bids?.[0]?.px;
            const aa = api.asks?.[0]?.px;
            if (
              Number.isFinite(bb as any) &&
              Number.isFinite(aa as any) &&
              (bb as number) > 0 &&
              (aa as number) > 0
            ) {
              anchorRef.current = ((bb as number) + (aa as number)) / 2;
            }
            setErr("");
            apply(api);
          } else {
            setErr("L2 API not available.");
          }
          return;
        }

        if (mode === "auto") {
          const api = await fetchBookFromApi();
          if (api) {
            const bb = api.bids?.[0]?.px;
            const aa = api.asks?.[0]?.px;
            if (
              Number.isFinite(bb as any) &&
              Number.isFinite(aa as any) &&
              (bb as number) > 0 &&
              (aa as number) > 0
            ) {
              anchorRef.current = ((bb as number) + (aa as number)) / 2;
            }
            setErr("");
            apply(api);
            return;
          }

          const canonFresh = lastCanonAtRef.current && Date.now() - lastCanonAtRef.current < 9000;
          apply(buildSimBook(asset, anchorRef.current, depth, sym));
          setErr(canonFresh ? "" : "Quote stale (using last known anchor).");
          return;
        }

        apply(buildSimBook(asset, anchorRef.current, depth, sym));
        setErr("");
      } catch (e: any) {
        setErr(e?.message || "L2 error");
      } finally {
        inFlightRef.current = false;
        if (!alive) return;
        timer = setTimeout(tick, 900);
      }
    }

    tick();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym, asset, mode]);

  const bids = Array.isArray(book.bids) ? book.bids : [];
  const asks = Array.isArray(book.asks) ? book.asks : [];

  const bestBid = bids[0]?.px;
  const bestAsk = asks[0]?.px;

  const spr =
    Number.isFinite(bestBid as any) && Number.isFinite(bestAsk as any)
      ? roundPx(asset, (bestAsk as number) - (bestBid as number)).toFixed(decFor(asset, Math.max(1, Number(bestAsk))))
      : "—";

  // cumulative
  const bidCum = useMemo(() => {
    const out: number[] = [];
    let s = 0;
    for (let i = 0; i < depth; i++) {
      s += Number(bids[i]?.sz ?? 0);
      out[i] = s;
    }
    return out;
  }, [bids, depth]);

  const askCum = useMemo(() => {
    const out: number[] = [];
    let s = 0;
    for (let i = 0; i < depth; i++) {
      s += Number(asks[i]?.sz ?? 0);
      out[i] = s;
    }
    return out;
  }, [asks, depth]);

  // depth% based on cumulative / total
  const bidDepthPct = useMemo(() => {
    const total = Math.max(0, Number(bidCum[depth - 1] ?? 0));
    const out: number[] = [];
    for (let i = 0; i < depth; i++) {
      const v = Number(bidCum[i] ?? 0);
      out[i] = total > 0 ? (v / total) * 100 : 0;
    }
    return out;
  }, [bidCum, depth]);

  const askDepthPct = useMemo(() => {
    const total = Math.max(0, Number(askCum[depth - 1] ?? 0));
    const out: number[] = [];
    for (let i = 0; i < depth; i++) {
      const v = Number(askCum[i] ?? 0);
      out[i] = total > 0 ? (v / total) * 100 : 0;
    }
    return out;
  }, [askCum, depth]);

  function bidBarStyle(pct: number, pulsing: boolean) {
    const a = pulsing ? 0.9 : 0.72;
    return {
      width: `${clamp(pct, 0, 100)}%`,
      background: `linear-gradient(to right, rgba(16,185,129,${a}), rgba(16,185,129,0.08))`,
      opacity: pulsing ? 0.62 : 0.46,
      filter: pulsing ? "brightness(1.2)" : "brightness(1.0)",
      transition: "width 200ms ease, opacity 180ms ease, filter 180ms ease",
    } as React.CSSProperties;
  }

  function askBarStyle(pct: number, pulsing: boolean) {
    const a = pulsing ? 0.9 : 0.72;
    return {
      width: `${clamp(pct, 0, 100)}%`,
      background: `linear-gradient(to left, rgba(239,68,68,${a}), rgba(239,68,68,0.08))`,
      opacity: pulsing ? 0.62 : 0.46,
      filter: pulsing ? "brightness(1.2)" : "brightness(1.0)",
      transition: "width 200ms ease, opacity 180ms ease, filter 180ms ease",
    } as React.CSSProperties;
  }

  const canonFresh = lastCanonAtRef.current && Date.now() - lastCanonAtRef.current < 9000;
  const canon = canonRef.current;

  const l2Body = (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex items-center justify-between gap-1.5 border-b border-white/8 px-2 py-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-semibold tracking-wide text-white/90">{sym}</span>
          <span className="text-[10px] text-white/40">{asset === "crypto" ? "ORDER BOOK" : "L2"}</span>
        </div>

        <div className="hidden sm:block text-[10px] tabular-nums text-white/40">
          <span className="text-emerald-400/60">bid</span> <span className="text-emerald-400/90">{fmtPx(bestBid, asset)}</span>
          <span className="text-white/20"> / </span><span className="text-red-400/60">ask</span> <span className="text-red-400/90">{fmtPx(bestAsk, asset)}</span>
          <span className="text-white/20"> / </span><span className="text-cyan-400/50">spr</span> {spr}
          {canon?.price ? (
            <>
              <span className="text-white/20"> • </span><span className="text-cyan-400/50">px</span> <span className="text-white/70">{fmtPx(canon.price, asset)}</span>
              {canon.bid !== undefined && canon.ask !== undefined ? (
                <span className="text-white/20"> • <span className="text-emerald-400/70">{fmtPx(canon.bid, asset)}</span>×<span className="text-red-400/70">{fmtPx(canon.ask, asset)}</span></span>
              ) : null}
              {!canonFresh ? <span className="ml-1 text-yellow-300/60">STALE</span> : null}
            </>
          ) : null}
        </div>
        {/* Mobile: compact bid×ask only */}
        <div className="sm:hidden text-[10px] tabular-nums">
          <span className="text-emerald-400/90">{fmtPx(bestBid, asset)}</span>
          <span className="text-white/20">×</span>
          <span className="text-red-400/90">{fmtPx(bestAsk, asset)}</span>
        </div>

        <div className="flex items-center gap-1 relative">
          {/* Level selector */}
          <button
            onClick={() => setShowDepthMenu(v => !v)}
            className="rounded-sm border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-colors"
            title="Book depth"
          >{depth} Levels</button>
          {showDepthMenu && (
            <>
              <div className="fixed inset-0 z-[28]" onClick={() => setShowDepthMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-[30] rounded border border-white/15 overflow-hidden shadow-2xl"
                style={{ background: "rgba(4,10,18,0.97)", minWidth: 90 }}>
                {[5, 10, 16, 20, 40, 60, 80, 100].map(n => (
                  <button key={n} onClick={() => { setDepth(n); setShowDepthMenu(false); }}
                    className={cn("w-full px-3 py-1.5 text-[11px] text-left transition-colors hover:bg-white/[0.05]",
                      depth === n ? "text-emerald-300 font-bold" : "text-white/60"
                    )}>{n}{depth === n && <span className="ml-auto text-emerald-400 text-[10px] float-right">✓</span>}</button>
                ))}
              </div>
            </>
          )}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            className="rounded-sm border border-white/[0.08] bg-transparent px-1.5 py-0.5 text-[10px] text-white/50 outline-none focus:border-emerald-400/30"
            title="Data source"
          >
            <option value="auto" className="bg-[#060e18]">Auto</option>
            <option value="api" className="bg-[#060e18]">API</option>
            <option value="sim" className="bg-[#060e18]">Sim</option>
          </select>
          <button
            onClick={() => setDetached((v) => !v)}
            title={detached ? "Dock" : "Detach"}
            className="ml-1 flex items-center justify-center rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-white/50 hover:bg-white/10 hover:text-white/80 transition"
          >
            ⧉
          </button>
        </div>
      </div>

      {err ? <div className="border-b border-white/8 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{err}</div> : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Column header */}
        <div className="sticky top-0 z-10 grid grid-cols-12 border-b border-white/8 bg-black/60 px-2 py-1 text-[10px] text-white/40 backdrop-blur">
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

          const bDepth = b ? bidDepthPct[i] : 0;
          const aDepth = a ? askDepthPct[i] : 0;

          const rowSpr =
            Number.isFinite(b?.px) && Number.isFinite(a?.px)
              ? fmtPx((a!.px as number) - (b!.px as number), asset)
              : "—";

          const bPulse = Boolean(pulse[`b_${i}`]);
          const aPulse = Boolean(pulse[`a_${i}`]);

          const top = i === 0;

          return (
            <div
              key={i}
              className={cn(
                "relative grid grid-cols-12 px-2",
                "text-[11px] leading-[18px]",
                top ? "py-1 bg-white/5" : "py-0.5"
              )}
            >
              {/* split border: green bid / red ask */}
              <div className="absolute bottom-0 left-0 w-1/2 h-px bg-emerald-400/25 pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-1/2 h-px bg-red-400/25 pointer-events-none" />

              {/* depth shading (half width bars) */}
              <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden pointer-events-none">
                <div className="absolute inset-y-0 left-0" style={bidBarStyle(bDepth, bPulse)} />
              </div>
              <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden pointer-events-none">
                <div className="absolute inset-y-0 right-0" style={askBarStyle(aDepth, aPulse)} />
              </div>

              <div
                className={cn(
                  "col-span-2 tabular-nums relative",
                  top ? "text-emerald-300 font-semibold" : "text-emerald-400"
                )}
              >
                {fmtPx(b?.px, asset)}
              </div>
              <div
                className={cn(
                  "col-span-2 text-right tabular-nums relative",
                  top ? "text-white font-semibold" : "text-white/85"
                )}
              >
                {fmtSz(b?.sz)}
              </div>
              <div className="col-span-1 text-right tabular-nums text-white/55 relative">
                {b ? fmtPct01(bDepth) : "—"}
              </div>

              <div className="col-span-2 text-center tabular-nums relative">
                <span
                  className={cn(
                    "inline-flex min-w-[2.5rem] justify-center rounded-sm border border-white/8 bg-black/30 px-1.5 py-0 text-[10px] text-white/50",
                    top && "bg-black/40 text-white/70"
                  )}
                >
                  {rowSpr}
                </span>
              </div>

              <div className="col-span-1 text-right tabular-nums text-white/55 relative">
                {a ? fmtPct01(aDepth) : "—"}
              </div>
              <div
                className={cn(
                  "col-span-2 text-right tabular-nums relative",
                  top ? "text-white font-semibold" : "text-white/85"
                )}
              >
                {fmtSz(a?.sz)}
              </div>
              <div
                className={cn(
                  "col-span-2 text-right tabular-nums relative",
                  top ? "text-rose-300 font-semibold" : "text-red-400"
                )}
              >
                {fmtPx(a?.px, asset)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const portal = detached && typeof window !== "undefined"
    ? createPortal(
        <div
          style={{
            position: "fixed",
            left: dragPos.x,
            top: dragPos.y,
            width: 560,
            height: 520,
            zIndex: 9999,
            borderRadius: 10,
            overflow: "hidden",
            border: "1px solid rgba(52,211,153,0.08)",
            boxShadow: "0 0 0 1px rgba(52,211,153,0.05), 0 24px 60px rgba(0,0,0,0.75)",
            background: "linear-gradient(135deg, #050d14 0%, #060e18 60%, #050c12 100%)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* brand glow overlays */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 10, background: "radial-gradient(ellipse 70% 35% at 8% 0%, rgba(52,211,153,0.08) 0%, transparent 100%)" }} />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 10, background: "radial-gradient(ellipse 40% 30% at 92% 100%, rgba(34,211,238,0.05) 0%, transparent 100%)" }} />
          {/* title bar */}
          <div
            style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.07) 0%, transparent 60%)", borderBottom: "1px solid rgba(52,211,153,0.08)", padding: "6px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "grab", userSelect: "none", flexShrink: 0 }}
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
          >
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(52,211,153,0.9)" }}>iMYNTED LEVEL 2</span>
            <button onClick={() => setDetached(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>×</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            {l2Body}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {!detached && l2Body}
      {portal}
    </>
  );
}