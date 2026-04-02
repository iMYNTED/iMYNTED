// app/components/WatchlistPanel.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSettings } from "./SettingsContext";

type AssetType = "stock" | "crypto";

interface WatchlistItem {
  symbol: string;
  asset: AssetType;
}

interface LiveQuote {
  price?: number;
  chg?: number;
  changePct?: number;
  volume?: number;
  bid?: number;
  ask?: number;
  high?: number;
  low?: number;
  open?: number;
  prevClose?: number;
  name?: string;
  mktCap?: number;
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function isCryptoBase(raw: string) {
  const s = (raw || "").toUpperCase().trim();
  if (!s) return false;
  if (s.includes("-USD")) return true;
  return ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "BNB", "MATIC"].includes(s);
}

function detectAsset(raw: string): AssetType {
  const s = (raw || "").toUpperCase().trim();
  if (s.includes("-USD") || isCryptoBase(s)) return "crypto";
  return "stock";
}

function fmtPx(v?: number) {
  if (!Number.isFinite(v)) return "—";
  const n = Number(v);
  if (n >= 100) return n.toFixed(2);
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtPct(v?: number) {
  if (!Number.isFinite(v)) return "";
  return `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`;
}

function fmtVol(v?: number) {
  if (!v || !Number.isFinite(v)) return "—";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}

function fmtChg(v?: number) {
  if (!Number.isFinite(v)) return "—";
  const n = Number(v);
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(2)}`;
}

function fmtMktCap(v?: number) {
  if (!v || !Number.isFinite(v)) return "—";
  if (v >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(2)}T`;
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  return `${(v / 1_000).toFixed(0)}K`;
}

const STORAGE_KEY = "imynted:watchlist";
const LISTS_KEY = "imynted:watchlist:lists";

const DEFAULT_ITEMS: WatchlistItem[] = [
  { symbol: "AAPL", asset: "stock" },
  { symbol: "TSLA", asset: "stock" },
  { symbol: "NVDA", asset: "stock" },
  { symbol: "AMZN", asset: "stock" },
  { symbol: "MSFT", asset: "stock" },
  { symbol: "BTC-USD", asset: "crypto" },
  { symbol: "ETH-USD", asset: "crypto" },
  { symbol: "SOL-USD", asset: "crypto" },
];

function loadItems(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ITEMS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return DEFAULT_ITEMS;
}

function saveItems(items: WatchlistItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

/* ── Component ──────────────────────────────────────────────────── */

export default function WatchlistPanel({
  onPickSymbol,
  className,
}: {
  onPickSymbol?: (symbol: string) => void;
  className?: string;
}) {
  const { upColor, downColor } = useSettings();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [addInput, setAddInput] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [sort, setSort] = useState<"default" | "alpha" | "change" | "volume">("default");
  const [sel, setSel] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(false);
  const [detached, setDetached] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 180, y: 80 });
  const dragRef = useRef<{ ox: number; oy: number } | null>(null);
  function onDragStart(e: React.PointerEvent) { e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { ox: e.clientX - dragPos.x, oy: e.clientY - dragPos.y }; }
  function onDragMove(e: React.PointerEvent) { if (!dragRef.current) return; setDragPos({ x: e.clientX - dragRef.current.ox, y: e.clientY - dragRef.current.oy }); }
  function onDragEnd() { dragRef.current = null; }

  // Load from localStorage on mount
  useEffect(() => {
    setItems(loadItems());
    mountedRef.current = true;
  }, []);

  // Persist on change
  useEffect(() => {
    if (!mountedRef.current) return;
    saveItems(items);
  }, [items]);

  // Fetch quotes for all symbols
  useEffect(() => {
    if (items.length === 0) return;
    let alive = true;

    async function fetchAll() {
      const next: Record<string, LiveQuote> = {};
      // Fetch each symbol individually via /api/market/quote (works without API key)
      await Promise.all(items.map(async (item) => {
        try {
          const asset = item.asset === "crypto" ? "crypto" : "stock";
          const res = await fetch(`/api/market/quote?symbol=${encodeURIComponent(item.symbol)}&asset=${asset}`, { cache: "no-store" });
          if (!res.ok || !alive) return;
          const r = await res.json();
          next[item.symbol.toUpperCase()] = {
            price: r.price ?? r.last ?? r.mid,
            chg: r.chg ?? r.change,
            changePct: r.chgPct ?? r.changePct ?? r.changePercent,
            volume: r.volume ?? r.vol,
            bid: r.bid,
            ask: r.ask,
            high: r.dayHigh ?? r.high ?? r.h,
            low: r.dayLow ?? r.low ?? r.l,
            open: r.open ?? r.o,
            prevClose: r.prevClose ?? r.pc ?? r.previousClose,
            name: r.name,
            mktCap: r.marketCap ?? r.mktCap,
          };
        } catch {}
      }));
      if (!alive) return;
      setQuotes((prev) => ({ ...prev, ...next }));
    }

    fetchAll();
    const timer = setInterval(fetchAll, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [items]);

  // Listen to quote bus for real-time updates
  useEffect(() => {
    function onQuote(ev: Event) {
      const d = (ev as CustomEvent).detail || {};
      const sym = String(d.symbol || "").toUpperCase().trim();
      if (!sym) return;
      setQuotes((prev) => ({
        ...prev,
        [sym]: {
          ...prev[sym],
          price: d.price ?? d.mid ?? d.last ?? prev[sym]?.price,
          chg: d.chg ?? prev[sym]?.chg,
          changePct: d.changePct ?? prev[sym]?.changePct,
          bid: d.bid ?? prev[sym]?.bid,
          ask: d.ask ?? prev[sym]?.ask,
          high: d.high ?? prev[sym]?.high,
          low: d.low ?? prev[sym]?.low,
          open: d.open ?? prev[sym]?.open,
          prevClose: d.prevClose ?? prev[sym]?.prevClose,
          volume: d.vol ?? d.volume ?? prev[sym]?.volume,
        },
      }));
    }

    window.addEventListener("imynted:quote", onQuote as EventListener);
    window.addEventListener("imynted:quoteUpdate", onQuote as EventListener);
    return () => {
      window.removeEventListener("imynted:quote", onQuote as EventListener);
      window.removeEventListener("imynted:quoteUpdate", onQuote as EventListener);
    };
  }, []);

  const addSymbol = useCallback(
    (raw: string) => {
      const sym = raw.toUpperCase().trim().replace(/\s+/g, "");
      if (!sym) return;
      if (items.some((i) => i.symbol === sym)) return;
      const asset = detectAsset(sym);
      setItems((prev) => [...prev, { symbol: sym, asset }]);
      setAddInput("");
      setShowAdd(false);
    },
    [items]
  );

  const removeSymbol = useCallback((sym: string) => {
    setItems((prev) => prev.filter((i) => i.symbol !== sym));
  }, []);

  const sorted = useMemo(() => {
    const arr = [...items];
    if (sort === "alpha") arr.sort((a, b) => a.symbol.localeCompare(b.symbol));
    else if (sort === "change")
      arr.sort((a, b) => {
        const ca = quotes[a.symbol]?.changePct ?? 0;
        const cb = quotes[b.symbol]?.changePct ?? 0;
        return cb - ca;
      });
    else if (sort === "volume")
      arr.sort((a, b) => {
        const va = quotes[a.symbol]?.volume ?? 0;
        const vb = quotes[b.symbol]?.volume ?? 0;
        return vb - va;
      });
    return arr;
  }, [items, sort, quotes]);

  function pick(item: WatchlistItem) {
    try {
      window.dispatchEvent(
        new CustomEvent("imynted:symbolPick", {
          detail: { asset: item.asset, symbol: item.symbol },
        })
      );
      window.dispatchEvent(
        new CustomEvent("imynted:openDetail", {
          detail: { asset: item.asset, symbol: item.symbol },
        })
      );
    } catch {}
    onPickSymbol?.(item.symbol);
  }

  function fireTradeAction(action: "BUY" | "SELL", asset: AssetType, symbol: string) {
    try {
      window.dispatchEvent(new CustomEvent("imynted:tradeAction", { detail: { action, asset, symbol } }));
      window.dispatchEvent(new CustomEvent("imynted:trade", { detail: { action, asset, symbol } }));
    } catch {}
  }

  const watchBody = (
    <div className="h-full min-h-0 flex flex-col text-white">

      {/* Top controls */}
      <div className="shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-white/[0.06]">
        {(["default", "alpha", "change", "volume"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setSort(s)}
            className={cn("h-5 px-1.5 rounded text-[9px] font-medium transition-colors cursor-pointer",
              sort === s ? "bg-emerald-400/15 text-emerald-300" : "text-white/30 hover:text-white/60 hover:bg-white/5"
            )}>
            {s === "default" ? "#" : s === "alpha" ? "A-Z" : s === "change" ? "%CHG" : "VOL"}
          </button>
        ))}
        <div className="flex-1" />
        <button type="button"
          onClick={() => { setShowAdd(!showAdd); if (!showAdd) setTimeout(() => inputRef.current?.focus(), 50); }}
          className="h-5 w-5 rounded flex items-center justify-center text-[14px] text-white/30 hover:text-emerald-300 hover:bg-emerald-400/10 transition-colors cursor-pointer"
        >+</button>
        <button type="button" onClick={() => setDetached(v => !v)} title={detached ? "Dock" : "Detach"}
          className="h-5 w-5 rounded flex items-center justify-center text-[11px] text-white/30 hover:text-emerald-300 hover:bg-emerald-400/10 transition-colors cursor-pointer ml-0.5"
        >⧉</button>
      </div>

      {/* Add input */}
      {showAdd && (
        <div className="shrink-0 px-2 py-1.5 border-b border-white/[0.04]">
          <input ref={inputRef} value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addSymbol(addInput); }
              if (e.key === "Escape") { setShowAdd(false); setAddInput(""); }
            }}
            placeholder="Add symbol… AAPL · BTC-USD"
            className="w-full h-7 bg-black/50 rounded border border-emerald-400/20 px-2 text-[11px] text-white/90 outline-none placeholder:text-white/20 focus:border-emerald-400/40"
          />
        </div>
      )}

      {/* Column headers — scanner style */}
      <div className="wl-hdr shrink-0 grid px-2 py-1 border-b border-white/[0.06] bg-black/30"
        style={{ gridTemplateColumns: "18px minmax(0,2fr) minmax(0,1.2fr) 52px" }}>
        <span className="text-[9px] text-white/25 tabular-nums">NO.</span>
        <span className="text-[9px] text-white/25 uppercase tracking-wide">SYMBOL</span>
        <span className="text-[9px] text-white/25 uppercase tracking-wide text-right">PRICE</span>
        <span className="text-[9px] text-white/25 uppercase tracking-wide text-right">%CHG</span>
        <span className="hidden sm:block text-[9px] text-white/25 uppercase tracking-wide text-right">CHG</span>
        <span className="hidden sm:block text-[9px] text-white/25 uppercase tracking-wide text-right">VOL</span>
        <span className="hidden sm:block text-[9px] text-white/25 uppercase tracking-wide text-right">MKT CAP</span>
      </div>
      {/* Wide header — tablet+ */}
      <style jsx>{`
        @media (min-width: 640px) {
          .wl-hdr { grid-template-columns: 18px minmax(0,1.8fr) minmax(0,1.2fr) 48px 48px 52px 44px !important; }
          .wl-row { grid-template-columns: 18px minmax(0,1.8fr) minmax(0,1.2fr) 48px 48px 52px 44px !important; }
        }
      `}</style>

      {/* Rows */}
      <div className="flex-1 min-h-0 overflow-auto">
        {sorted.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-white/30">No symbols. Click + to add.</div>
        ) : sorted.map((item, idx) => {
          const q = quotes[item.symbol];
          const pct = q?.changePct;
          const up = (pct ?? 0) >= 0;
          const hasPct = pct !== undefined && Number.isFinite(pct);
          const hasChg = q?.chg !== undefined && Number.isFinite(q.chg);
          const chgUp = (q?.chg ?? 0) >= 0;
          const selected = idx === sel;
          const hasBidAsk = q?.bid !== undefined && q?.ask !== undefined;
          const hasHL = q?.high !== undefined && q?.low !== undefined;

          return (
            <div key={item.symbol}
              role="button" tabIndex={0}
              onClick={() => { setSel(idx); pick(item); }}
              className={cn(
                "group relative cursor-pointer select-none transition-colors border-b border-white/[0.04]",
                selected ? "bg-emerald-400/[0.06]" : "hover:bg-white/[0.025]"
              )}
            >
              {/* left accent */}
              <div className={cn("absolute left-0 top-0 h-full w-[2px]",
                selected ? "bg-emerald-400" : hasPct ? (up ? "bg-emerald-400/30" : "bg-red-400/30") : "bg-transparent"
              )} />

              {/* Main row */}
              <div className="wl-row grid items-center gap-x-1 px-2 py-1.5"
                style={{ gridTemplateColumns: "18px minmax(0,2fr) minmax(0,1.2fr) 52px" }}>

                {/* NO. */}
                <span className="text-[9px] tabular-nums text-white/25">{idx + 1}</span>

                {/* Symbol + badge */}
                <div className="flex items-center gap-1 min-w-0">
                  <span className={cn(
                    "text-[8px] font-bold px-1 py-0 rounded leading-4 shrink-0",
                    item.asset === "crypto" ? "bg-amber-400/10 text-amber-400/70" : "bg-emerald-400/10 text-emerald-400/70"
                  )}>{item.asset === "crypto" ? "C" : "S"}</span>
                  <span className={cn("text-[11px] font-semibold truncate", selected ? "text-white" : "text-white/90")}>
                    {item.symbol}
                  </span>
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); removeSymbol(item.symbol); }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 ml-1 text-[9px] text-white/20 hover:text-red-400/80 transition-opacity"
                  >✕</button>
                </div>

                {/* Price */}
                <div className={cn("text-[11px] tabular-nums font-semibold text-right",
                  hasPct ? (up ? "text-emerald-300" : "text-red-300") : "text-white/70"
                )}>{fmtPx(q?.price)}</div>

                {/* %CHG */}
                <div className={cn("text-[10px] tabular-nums font-semibold text-right",
                  hasPct ? (up ? upColor : downColor) : "text-white/25"
                )}>{hasPct ? fmtPct(pct) : "—"}</div>

                {/* CHG $ — hidden on mobile */}
                <div className={cn("hidden sm:block text-[10px] tabular-nums text-right",
                  hasChg ? (chgUp ? upColor : downColor) : "text-white/25"
                )}>{hasChg ? fmtChg(q!.chg) : "—"}</div>

                {/* VOL — hidden on mobile */}
                <div className="hidden sm:block text-[10px] tabular-nums text-right text-white/45">{fmtVol(q?.volume)}</div>

                {/* MKT CAP — hidden on mobile */}
                <div className="hidden sm:block text-[10px] tabular-nums text-right text-white/35">{fmtMktCap(q?.mktCap)}</div>
              </div>

              {/* Sub-row: H/L + bid×ask */}
              <div className="grid gap-x-1 px-2 pb-1.5"
                style={{ gridTemplateColumns: "18px 1fr" }}>
                <div />
                <div className="flex items-center gap-2 flex-wrap">
                  {hasHL && (
                    <span className="text-[9px] tabular-nums text-white/35">
                      <span className="text-emerald-400/50">H</span> <span className="text-emerald-400/70">{fmtPx(q!.high)}</span>
                      <span className="text-white/20 mx-1">·</span>
                      <span className="text-red-400/50">L</span> <span className="text-red-400/70">{fmtPx(q!.low)}</span>
                      {q?.open !== undefined && (
                        <><span className="text-white/20 mx-1">·</span><span className="text-white/35">O</span> <span className="text-white/50">{fmtPx(q.open)}</span></>
                      )}
                      {q?.prevClose !== undefined && (
                        <><span className="text-white/20 mx-1">·</span><span className="text-white/35">PC</span> <span className="text-white/50">{fmtPx(q.prevClose)}</span></>
                      )}
                    </span>
                  )}
                  {hasBidAsk && (
                    <span className="text-[9px] tabular-nums ml-auto">
                      <span className="text-emerald-400/50">b</span> <span className="text-emerald-400/80">{fmtPx(q!.bid)}</span>
                      <span className="text-white/20"> × </span>
                      <span className="text-red-400/50">a</span> <span className="text-red-400/80">{fmtPx(q!.ask)}</span>
                    </span>
                  )}
                  {/* Trade buttons */}
                  <div className={cn(
                    "flex items-center gap-1 ml-auto transition-opacity",
                    selected ? "opacity-100" : "sm:opacity-0 sm:group-hover:opacity-100"
                  )}>
                    <button type="button"
                      className="h-5 rounded-sm border border-emerald-400/25 bg-emerald-400/[0.08] px-2 text-[8px] font-bold text-emerald-300 hover:bg-emerald-400/15 transition-colors"
                      onClick={(e) => { e.stopPropagation(); fireTradeAction("BUY", item.asset, item.symbol); }}>BUY</button>
                    <button type="button"
                      className="h-5 rounded-sm border border-red-400/25 bg-red-400/[0.08] px-2 text-[8px] font-bold text-red-300 hover:bg-red-400/15 transition-colors"
                      onClick={(e) => { e.stopPropagation(); fireTradeAction("SELL", item.asset, item.symbol); }}>SELL</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-3 py-1 border-t border-white/[0.04] flex items-center gap-2">
        <span className="text-[9px] text-emerald-400/30">{sorted.length} symbols</span>
        <span className="text-[9px] text-white/15">· click row to load chart</span>
      </div>
    </div>
  );

  const portal = detached && typeof window !== "undefined"
    ? createPortal(
        <div style={{
          position: "fixed", left: dragPos.x, top: dragPos.y,
          width: 560, height: 600, zIndex: 9999, borderRadius: 10,
          overflow: "hidden", border: "1px solid rgba(52,211,153,0.08)",
          boxShadow: "0 0 0 1px rgba(52,211,153,0.05), 0 24px 60px rgba(0,0,0,0.75)",
          background: "linear-gradient(135deg, #050d14 0%, #060e18 60%, #050c12 100%)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 10, background: "radial-gradient(ellipse 70% 35% at 8% 0%, rgba(52,211,153,0.08) 0%, transparent 100%)" }} />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 10, background: "radial-gradient(ellipse 40% 30% at 92% 100%, rgba(34,211,238,0.05) 0%, transparent 100%)" }} />
          <div
            style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.07) 0%, transparent 60%)", borderBottom: "1px solid rgba(52,211,153,0.08)", padding: "6px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "grab", userSelect: "none", flexShrink: 0 }}
            onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd}
          >
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(52,211,153,0.9)" }}>iMYNTED WATCHLIST</span>
            <button onClick={() => setDetached(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>×</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{watchBody}</div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {!detached && watchBody}
      {portal}
    </>
  );
}
