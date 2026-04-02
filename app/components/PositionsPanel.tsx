// app/components/PositionsPanel.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AssetType = "stock" | "crypto";
type Tab = "all" | "stock" | "crypto";
type BrokerTag = "ALL" | "RH" | "ETRADE" | "WEBULL" | "MOOMOO" | "FIDELITY" | "BINANCE" | "COINBASE" | "IBKR" | "ALPACA" | "SCHWAB" | "TRADIER";

const BROKER_PILLS: BrokerTag[] = ["ALL", "IBKR", "ALPACA", "WEBULL", "SCHWAB", "TRADIER", "COINBASE", "BINANCE", "RH", "ETRADE", "MOOMOO", "FIDELITY"];

// All configured broker endpoints — fetch positions from each in parallel
const BROKER_ENDPOINTS: { broker: BrokerTag; url: string }[] = [
  { broker: "ALPACA",  url: "/api/broker/alpaca?action=positions" },
  { broker: "IBKR",    url: "/api/broker/ibkr?action=positions" },
  { broker: "WEBULL",  url: "/api/broker/webull?action=positions" },
  { broker: "SCHWAB",  url: "/api/broker/schwab?action=positions" },
  { broker: "TRADIER", url: "/api/broker/tradier?action=positions" },
  { broker: "COINBASE",url: "/api/broker/coinbase?action=positions" },
  { broker: "BINANCE", url: "/api/broker/binance?action=positions" },
];

export type PositionRow = {
  id: string;
  asset: AssetType;
  symbol: string; // stock: AAPL, crypto: BTC-USD
  qty: number;
  avg: number;

  // ✅ display "last" (we set this to MID when bid/ask exists)
  last: number;

  // keep for bid/ask display and true mid consistency
  bid?: number;
  ask?: number;

  // broker source for multi-account filtering
  broker?: string;
};

type QuoteMini = {
  symbol: string;
  asset?: "stock" | "crypto";
  price?: number; // provider "price"/last
  mid?: number; // optional (DO NOT trust unless bid/ask exist)
  bid?: number;
  ask?: number;
  last?: number;
  ts?: string;
  provider?: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function n(v: any) {
  const x = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function fmtMoney2(v: number) {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const s = abs.toFixed(2);
  const [i, d] = s.split(".");
  const withCommas = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${withCommas}.${d}`;
}

function pnlClass(v: number) {
  if (v > 0) return "text-emerald-300";
  if (v < 0) return "text-rose-300";
  return "text-white/60";
}

function chip(active: boolean) {
  return cn(
    "h-6 rounded-sm border border-white/10 px-2 text-[10px] font-medium shrink-0 cursor-pointer",
    active ? "bg-white/10 text-white" : "bg-black/20 text-white/55 hover:bg-white/5 hover:text-white/75"
  );
}

function brokerChip(active: boolean) {
  return cn(
    "h-5 rounded-sm border px-1.5 text-[9px] font-medium uppercase tracking-wide shrink-0 cursor-pointer transition-colors",
    active
      ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
      : "border-white/8 bg-black/20 text-white/40 hover:bg-white/5 hover:text-white/60"
  );
}

/* ── per-broker color-coded pill (all classes explicit for Tailwind JIT) ── */
function coloredBrokerChip(broker: BrokerTag, active: boolean) {
  const base = "h-7 rounded-sm border px-2.5 text-[11px] font-semibold shrink-0 cursor-pointer transition-colors";
  const dim = "border-white/8 bg-black/20 text-white/35";

  switch (broker) {
    case "ALL":
      return cn(base, active
        ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
        : cn(dim, "hover:bg-cyan-400/15 hover:text-cyan-300"));
    case "RH":
      return cn(base, active
        ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
        : cn(dim, "hover:bg-amber-400/15 hover:text-amber-300"));
    case "ETRADE":
      return cn(base, active
        ? "border-purple-400/30 bg-purple-400/10 text-purple-300"
        : cn(dim, "hover:bg-purple-400/15 hover:text-purple-300"));
    case "WEBULL":
      return cn(base, active
        ? "border-sky-400/30 bg-sky-400/10 text-sky-300"
        : cn(dim, "hover:bg-sky-400/15 hover:text-sky-300"));
    case "MOOMOO":
      return cn(base, active
        ? "border-orange-400/30 bg-orange-400/10 text-orange-300"
        : cn(dim, "hover:bg-orange-400/15 hover:text-orange-300"));
    case "FIDELITY":
      return cn(base, active
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
        : cn(dim, "hover:bg-emerald-400/15 hover:text-emerald-300"));
    case "BINANCE":
      return cn(base, active
        ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-300"
        : cn(dim, "hover:bg-yellow-400/15 hover:text-yellow-300"));
    case "COINBASE":
      return cn(base, active
        ? "border-blue-400/30 bg-blue-400/10 text-blue-300"
        : cn(dim, "hover:bg-blue-400/15 hover:text-blue-300"));
    case "IBKR":
      return cn(base, active
        ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
        : cn(dim, "hover:bg-rose-400/15 hover:text-rose-300"));
    default:
      return cn(base, dim);
  }
}

/* ── broker row tag color (explicit for Tailwind JIT) ── */
function brokerTagColor(broker: string): string {
  switch (broker.toUpperCase()) {
    case "RH": return "text-amber-300/60";
    case "ETRADE": return "text-purple-300/60";
    case "WEBULL": return "text-sky-300/60";
    case "MOOMOO": return "text-orange-300/60";
    case "FIDELITY": return "text-emerald-300/60";
    case "BINANCE": return "text-yellow-300/60";
    case "COINBASE": return "text-blue-300/60";
    case "IBKR": return "text-rose-300/60";
    default: return "text-white/40";
  }
}

/* ── inline mini broker pill (same size, color-coded) ── */
function inlineBrokerPill(broker: string) {
  const b = broker.toUpperCase();
  const base = "inline-flex h-4 items-center rounded-sm border px-1 text-[8px] font-semibold uppercase leading-none shrink-0";
  const styles: Record<string, string> = {
    RH: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    ETRADE: "border-purple-400/30 bg-purple-400/10 text-purple-300",
    WEBULL: "border-sky-400/30 bg-sky-400/10 text-sky-300",
    MOOMOO: "border-orange-400/30 bg-orange-400/10 text-orange-300",
    FIDELITY: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    BINANCE: "border-yellow-400/30 bg-yellow-400/10 text-yellow-300",
    COINBASE: "border-blue-400/30 bg-blue-400/10 text-blue-300",
    IBKR: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  };
  return cn(base, styles[b] || "border-white/10 bg-white/5 text-white/40");
}

/* ── asset type mini label pill ── */
function assetTypePill(asset: AssetType) {
  return cn(
    "inline-flex h-4 items-center rounded-sm border px-1 text-[8px] font-medium uppercase leading-none shrink-0",
    "border-white/8 bg-white/5 text-white/35"
  );
}

function card(cls = "") {
  return cn("rounded-sm border border-white/10 bg-black/40", cls);
}

/* =========================
   ✅ Symbol normalization (prevents SMCI6 etc)
   - Keeps BRK.B / BRK-B
   - Keeps BTC-USD pairs
   - Strips trailing digits on stocks
========================= */
function normSym(raw: string) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.\-]/g, "");
}

function cleanSymbol(raw: string) {
  let s = normSym(raw);
  if (!s) return "";

  // keep crypto pairs
  if (s.includes("-USD")) return s;

  // strip accidental -USD on stocks
  s = s.replace(/-USD$/i, "");

  // strip trailing digits (rank/index garbage)
  s = s.replace(/[0-9]+$/, "");

  return s;
}

function isCryptoSymbol(raw: string) {
  const s = normSym(raw);
  if (!s) return false;
  if (s.includes("-USD")) return true;
  return ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "BNB", "MATIC"].includes(s);
}

function normalizeCryptoSymbol(raw: string) {
  const s = normSym(raw);
  if (!s) return "BTC-USD";
  if (s.includes("-")) return s;
  if (s.endsWith("USD")) return s.replace(/USD$/, "-USD");
  return `${s}-USD`;
}

function fmtQty(qty: number, asset: AssetType) {
  if (!Number.isFinite(qty)) return "0";
  if (asset === "crypto") {
    const s = qty.toFixed(6);
    return s.replace(/\.?0+$/, "");
  }
  return String(Math.round(qty));
}

function fmtPx(px: number, asset: AssetType) {
  if (!Number.isFinite(px)) return "—";
  const v = Number(px);
  if (asset === "crypto") {
    if (v >= 100) return v.toFixed(2);
    if (v >= 1) return v.toFixed(4);
    return v.toFixed(6);
  }
  return v >= 1 ? v.toFixed(2) : v.toFixed(4);
}

function uniq<T>(xs: T[]) {
  return Array.from(new Set(xs));
}

/** ✅ Seed positions (kept stable); prices will be overwritten by live quotes */
function initialRows(): PositionRow[] {
  return [
    { id: "s1", asset: "stock", symbol: "AAPL", qty: 120, avg: 182.4, last: 185.12, broker: "RH" },
    { id: "s2", asset: "stock", symbol: "TSLA", qty: 40, avg: 238.1, last: 242.55, broker: "WEBULL" },
    { id: "s3", asset: "stock", symbol: "NVDA", qty: 25, avg: 901.5, last: 912.35, broker: "ETRADE" },
    { id: "s4", asset: "stock", symbol: "SPY", qty: 10, avg: 487.2, last: 490.08, broker: "FIDELITY" },

    { id: "c1", asset: "crypto", symbol: "BTC-USD", qty: 0.15, avg: 61200, last: 62880, broker: "BINANCE" },
    { id: "c2", asset: "crypto", symbol: "ETH-USD", qty: 1.8, avg: 3100, last: 3255, broker: "COINBASE" },
  ];
}

function computeMid(bid?: number, ask?: number) {
  if (
    typeof bid === "number" &&
    typeof ask === "number" &&
    Number.isFinite(bid) &&
    Number.isFinite(ask) &&
    bid > 0 &&
    ask > 0
  ) {
    return (bid + ask) / 2;
  }
  return undefined;
}

/**
 * Archmage price priority (must match Header/Trader/Tape):
 * 1) mid (ONLY when real bid+ask exist)
 * 2) price
 * 3) last
 *
 * IMPORTANT: do NOT trust q.mid unless we also have bid+ask.
 */
function pickPx(q?: QuoteMini) {
  if (!q) return undefined;

  const bid = typeof q.bid === "number" ? q.bid : undefined;
  const ask = typeof q.ask === "number" ? q.ask : undefined;

  const realMid = computeMid(bid, ask); // ✅ only real mid
  const price = typeof q.price === "number" ? q.price : undefined;
  const last = typeof q.last === "number" ? q.last : undefined;

  return realMid ?? price ?? last;
}

async function fetchBulkQuotes(symbols: string[]): Promise<Record<string, QuoteMini>> {
  const list = uniq(symbols.map((s) => normSym(s)).filter(Boolean)).slice(0, 25);
  if (!list.length) return {};

  const out: Record<string, QuoteMini> = {};

  const stockSyms: string[] = [];
  const cryptoSyms: string[] = [];

  for (const s0 of list) {
    if (isCryptoSymbol(s0)) cryptoSyms.push(normalizeCryptoSymbol(s0));
    else stockSyms.push(cleanSymbol(s0));
  }

  // ✅ stocks bulk: /api/market/quotes (dataBySymbol)
  if (stockSyms.length) {
    try {
      const res = await fetch(
        `/api/market/quotes?asset=stock&symbols=${encodeURIComponent(stockSyms.join(","))}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const j: any = await res.json().catch(() => ({}));
        const dataBySymbol = j?.dataBySymbol || {};
        for (const k of Object.keys(dataBySymbol)) {
          const q = dataBySymbol[k];
          const key = cleanSymbol(q?.symbol ?? k);
          if (!key) continue;
          out[key] = {
            symbol: key,
            asset: q?.asset,
            price: typeof q?.price === "number" ? q.price : undefined,
            mid: typeof q?.mid === "number" ? q.mid : undefined,
            bid: typeof q?.bid === "number" ? q.bid : undefined,
            ask: typeof q?.ask === "number" ? q.ask : undefined,
            last: typeof q?.last === "number" ? q.last : undefined,
            ts: typeof q?.ts === "string" ? q.ts : typeof j?.ts === "string" ? j.ts : undefined,
            provider:
              typeof q?.provider === "string"
                ? q.provider
                : typeof j?.provider === "string"
                ? j.provider
                : undefined,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  // ✅ crypto canonical: /api/crypto/quote
  if (cryptoSyms.length) {
    await Promise.all(
      cryptoSyms.slice(0, 10).map(async (cs) => {
        try {
          const res = await fetch(`/api/crypto/quote?symbol=${encodeURIComponent(cs)}`, {
            cache: "no-store",
          });
          if (!res.ok) return;

          const j: any = await res.json().catch(() => ({}));
          const d = j?.data ?? j ?? {};
          const key = normSym(d?.symbol ?? cs);
          if (!key) return;

          out[key] = {
            symbol: key,
            asset: "crypto",
            price: typeof d?.price === "number" ? d.price : undefined,
            mid: typeof d?.mid === "number" ? d.mid : undefined,
            bid: typeof d?.bid === "number" ? d.bid : undefined,
            ask: typeof d?.ask === "number" ? d.ask : undefined,
            last: typeof d?.last === "number" ? d.last : undefined,
            ts: typeof d?.ts === "string" ? d.ts : typeof j?.ts === "string" ? j.ts : undefined,
            provider: typeof j?.provider === "string" ? j.provider : "coingecko",
          };
        } catch {}
      })
    );
  }

  return out;
}

/** ✅ emit helper (new + legacy event names) */
function emitEvent(names: string[], detail: any) {
  try {
    for (const name of names) window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    // ignore
  }
}

export default function PositionsPanel({
  onPick,
  refreshMs = 2500,
  onPickAction,
}: {
  onPick?: (asset: AssetType, symbol: string) => void;
  refreshMs?: number;
  onPickAction?: (action: "BUY" | "SELL" | "FLAT", asset: AssetType, symbol: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [brokerFilter, setBrokerFilter] = useState<BrokerTag>("ALL");
  const [rows, setRows] = useState<PositionRow[]>(() => initialRows());
  const [activeId, setActiveId] = useState<string>("");
  const [detached, setDetached] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 120, y: 60 });
  const dragStartRef2 = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  const aliveRef = useRef(true);
  const rowsRef = useRef<PositionRow[]>(rows);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // ✅ Fetch positions from all configured brokers + merge with seed data
  async function fetchAllBrokerPositions() {
    const results = await Promise.allSettled(
      BROKER_ENDPOINTS.map(async ({ broker, url }) => {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return [];
        const j = await res.json();
        if (!j?.ok || !Array.isArray(j.data)) return [];
        return j.data.map((p: any, i: number) => ({
          id: `${broker.toLowerCase()}-${p.symbol}-${i}`,
          asset: p.asset === "crypto" ? "crypto" as const : "stock" as const,
          symbol: p.symbol,
          qty: p.qty,
          avg: p.avgPrice,
          last: p.lastPrice,
          broker: (p.broker || broker) as BrokerTag,
          bid: undefined,
          ask: undefined,
        }));
      })
    );

    if (!aliveRef.current) return;

    const brokerRows: PositionRow[] = results.flatMap(
      (r) => r.status === "fulfilled" ? r.value : []
    );

    setRows((cur) => {
      // Remove old broker rows (any id starting with a known broker prefix), keep seed rows
      const prefixes = BROKER_ENDPOINTS.map((b) => b.broker.toLowerCase() + "-");
      const seedRows = cur.filter((r) => !prefixes.some((p) => r.id.startsWith(p)));
      return [...seedRows, ...brokerRows];
    });
  }

  // ✅ live quote refresh + all broker positions sync
  useEffect(() => {
    let t: any;

    async function poll() {
      try {
        // Fetch positions from all configured brokers periodically
        await fetchAllBrokerPositions();

        const syms = rowsRef.current.map((r) => r.symbol);
        const map = await fetchBulkQuotes(syms);
        if (!aliveRef.current) return;

        if (!map || Object.keys(map).length === 0) return;

        const brokerPrefixes = BROKER_ENDPOINTS.map((b) => b.broker.toLowerCase() + "-");
        setRows((cur) =>
          cur.map((p) => {
            // Don't overwrite broker prices with quote data — brokers already have live prices
            if (brokerPrefixes.some((pfx) => p.id.startsWith(pfx))) return p;

            const key = p.asset === "crypto" ? normSym(p.symbol) : cleanSymbol(p.symbol);
            const q = map[key];
            if (!q) return p;

            const bid = typeof q.bid === "number" ? q.bid : undefined;
            const ask = typeof q.ask === "number" ? q.ask : undefined;

            const px = pickPx(q);
            if (px === undefined) return { ...p, bid, ask };

            return { ...p, last: px, bid, ask };
          })
        );
      } catch {
        // ignore
      } finally {
        if (!aliveRef.current) return;
        t = setTimeout(poll, Math.max(800, refreshMs));
      }
    }

    poll();
    return () => {
      if (t) clearTimeout(t);
    };
  }, [refreshMs]);

  const filtered = useMemo(() => {
    let result = rows;
    if (tab !== "all") result = result.filter((r) => r.asset === tab);
    if (brokerFilter !== "ALL") result = result.filter((r) => (r.broker || "").toUpperCase() === brokerFilter);
    return result;
  }, [rows, tab, brokerFilter]);

  const summary = useMemo(() => {
    const value = filtered.reduce((a, p) => a + n(p.qty) * n(p.last), 0);
    const cost = filtered.reduce((a, p) => a + n(p.qty) * n(p.avg), 0);
    const pnl = value - cost;
    const pct = cost ? (pnl / cost) * 100 : 0;
    return { value, cost, pnl, pct };
  }, [filtered]);

  function emitSymbolPick(asset: AssetType, symbol: string) {
    const sym = asset === "crypto" ? normSym(symbol) : cleanSymbol(symbol);

    // ✅ emit NEW + legacy names (keeps everything syncing)
    emitEvent(["imynted:symbolPick", "imynted:symbol"], {
      asset,
      symbol: sym,
      sym, // alias for older listeners
      source: "PositionsPanel",
      ts: Date.now(),
    });

    try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: sym, asset } })); } catch {}

    onPick?.(asset, sym);
  }

  function emitTradeAction(action: "BUY" | "SELL" | "FLAT", asset: AssetType, symbol: string) {
    const sym = asset === "crypto" ? normSym(symbol) : cleanSymbol(symbol);

    // ✅ emit NEW + legacy names
    emitEvent(["imynted:tradeAction", "imynted:trade"], {
      action,
      asset,
      symbol: sym,
      sym,
      source: "PositionsPanel",
      ts: Date.now(),
    });

    onPickAction?.(action, asset, sym);
  }

  /* ── drag handlers ── */
  function onDragStart(e: React.PointerEvent) {
    dragStartRef2.current = { mx: e.clientX, my: e.clientY, ox: dragPos.x, oy: dragPos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragStartRef2.current) return;
    setDragPos({
      x: dragStartRef2.current.ox + (e.clientX - dragStartRef2.current.mx),
      y: dragStartRef2.current.oy + (e.clientY - dragStartRef2.current.my),
    });
  }
  function onDragEnd() { dragStartRef2.current = null; }

  /* ── positions body (shared inline + popup) ── */
  const positionsBody = (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">

      {/* ── Top bar: type chips + live status + detach ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <button type="button" className={chip(tab === "all")} onClick={() => setTab("all")}>ALL</button>
        <button type="button" className={chip(tab === "stock")} onClick={() => setTab("stock")}>STOCK</button>
        <button type="button" className={chip(tab === "crypto")} onClick={() => setTab("crypto")}>CRYPTO</button>
        <span className="ml-auto text-[9px] text-emerald-400/60 font-medium tracking-wide">Live &bull; 3s</span>
        <span className="text-[9px] text-white/40 ml-1">Rows: {filtered.length}</span>
        <button
          type="button"
          onClick={() => setDetached(!detached)}
          className="text-white/30 hover:text-cyan-400 text-[14px] transition-colors"
          title={detached ? "Reattach positions" : "Detach to floating window"}
        >
          {"\u29C9"}
        </button>
      </div>

      {/* ── Broker pills (scroll horizontal, no wrap) ── */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-none">
        {BROKER_PILLS.map((b) => (
          <button key={b} className={cn(coloredBrokerChip(b, brokerFilter === b), "shrink-0")} onClick={() => setBrokerFilter(b)} type="button">
            {b}
          </button>
        ))}
      </div>

      {/* ── Summary cards ── */}
      <div className="shrink-0 grid grid-cols-2 gap-2 px-3 py-1">
        <div className={card("px-2.5 py-1.5")}>
          <div className="text-[9px] text-white/45">Total Value</div>
          <div className="text-[13px] font-semibold text-white/85 tabular-nums">{fmtMoney2(summary.value)}</div>
          <div className="text-[9px] text-white/35 tabular-nums">Cost: {fmtMoney2(summary.cost)}</div>
        </div>
        <div className={card("px-2.5 py-1.5")}>
          <div className="text-[9px] text-white/45">Total P/L</div>
          <div className={cn("text-[13px] font-semibold tabular-nums", pnlClass(summary.pnl))}>{fmtMoney2(summary.pnl)}</div>
          <div className={cn("text-[9px] tabular-nums", pnlClass(summary.pnl))}>{summary.pct.toFixed(2)}%</div>
        </div>
      </div>

      {/* ── Section header / Summary bar ── */}
      <div className="shrink-0 px-3 py-1">
        {detached ? (
          <div className="flex items-center gap-4 text-[11px] tabular-nums flex-wrap">
            <span className="text-white/50">Market Value (USD) ▾</span>
            <span className="text-white/85 font-semibold">{fmtMoney2(summary.value).replace("$", "")}</span>
            <span className="text-white/50 ml-2">Today&apos;s P/L</span>
            <span className={cn("font-semibold", pnlClass(summary.pnl * 0.1))}>{fmtMoney2(summary.pnl * 0.1)}</span>
            <span className="text-white/50 ml-2">Position P/L</span>
            <span className={cn("font-semibold", pnlClass(summary.pnl))}>{fmtMoney2(summary.pnl)}</span>
          </div>
        ) : (
          <span className="text-[10px] text-white/30">Positions (click &rarr; sync dashboard) &bull; Chips &rarr; Trader</span>
        )}
      </div>

      {/* ── Column headers ── */}
      <div className="shrink-0 px-3 py-1 border-b border-white/10">
        {detached ? (
          <div className="grid grid-cols-[minmax(80px,1.5fr)_52px_60px_60px_72px_60px_72px_52px_48px_36px] gap-1 text-[9px] text-white/40 uppercase tracking-wide">
            <div>Symbol</div>
            <div className="text-right">Price</div>
            <div className="text-right">Avg</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Mkt Val</div>
            <div className="text-right">Today P/L</div>
            <div className="text-right">Total P/L</div>
            <div className="text-right">% Unrl</div>
            <div className="text-right">% Port</div>
            <div className="text-right">CCY</div>
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-12 gap-1 text-[9px] text-white/40 uppercase tracking-wide">
              <div className="col-span-3">Symbol</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Avg</div>
              <div className="col-span-2 text-right">Last</div>
              <div className="col-span-3 text-right">P/L</div>
            </div>
            <div className="sm:hidden grid grid-cols-3 gap-1 text-[9px] text-white/40 uppercase tracking-wide">
              <div>Symbol</div>
              <div className="text-right">Last</div>
              <div className="text-right">P/L</div>
            </div>
          </>
        )}
      </div>

      {/* ── Rows ── */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 overscroll-contain [scrollbar-gutter:stable]">
        {filtered.map((p) => {
          const sym = p.asset === "crypto" ? normSym(p.symbol) : cleanSymbol(p.symbol);
          const pnl = n(p.qty) * (n(p.last) - n(p.avg));
          const pnlPct = n(p.avg) ? ((n(p.last) - n(p.avg)) / n(p.avg)) * 100 : 0;
          const value = n(p.qty) * n(p.last);
          const todayPnl = pnl * 0.1;
          const pctPortfolio = summary.value > 0 ? (value / summary.value) * 100 : 0;

          return (
            <div key={p.id} className={cn("border-b border-white/5 px-3 py-1.5", activeId === p.id && "bg-white/5")}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => { setActiveId(p.id); emitSymbolPick(p.asset, sym); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveId(p.id); emitSymbolPick(p.asset, sym); } }}
                className={detached
                  ? "grid grid-cols-[minmax(80px,1.5fr)_52px_60px_60px_72px_60px_72px_52px_48px_36px] gap-1 text-[11px] items-center cursor-pointer select-none outline-none"
                  : "text-[11px] items-center cursor-pointer select-none outline-none"
                }
              >
                {detached ? (
                  <>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-semibold text-white/85 truncate">{sym}</span>
                        <span className={assetTypePill(p.asset)}>{p.asset === "crypto" ? "CRYPTO" : "STOCK"}</span>
                        {p.broker && <span className={inlineBrokerPill(p.broker)}>{p.broker}</span>}
                      </div>
                    </div>
                    <div className="text-right tabular-nums text-white/65">{fmtPx(p.last, p.asset)}</div>
                    <div className="text-right tabular-nums text-white/50">{fmtPx(p.avg, p.asset)}</div>
                    <div className="text-right tabular-nums text-white/65">{fmtQty(p.qty, p.asset)}</div>
                    <div className="text-right tabular-nums text-white/65">{fmtMoney2(value)}</div>
                    <div className={cn("text-right tabular-nums", pnlClass(todayPnl))}>{todayPnl >= 0 ? "+" : ""}{todayPnl.toFixed(2)}</div>
                    <div className={cn("text-right tabular-nums font-semibold", pnlClass(pnl))}>{pnl >= 0 ? "+" : ""}{fmtMoney2(pnl)}</div>
                    <div className={cn("text-right tabular-nums", pnlClass(pnlPct))}>{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</div>
                    <div className="text-right tabular-nums text-white/40">{pctPortfolio.toFixed(2)}%</div>
                    <div className="text-right tabular-nums text-white/40">USD</div>
                  </>
                ) : (
                  <>
                    {/* Desktop: grid row */}
                    <div className="hidden sm:grid grid-cols-12 gap-1 items-center">
                      <div className="col-span-3 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-semibold text-white/85 truncate">{sym}</span>
                          <span className={assetTypePill(p.asset)}>{p.asset === "crypto" ? "CRYPTO" : "STOCK"}</span>
                          {p.broker && <span className={inlineBrokerPill(p.broker)}>{p.broker}</span>}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {(p.bid !== undefined || p.ask !== undefined) && (
                            <span className="text-[9px] text-white/25 tabular-nums">
                              b {p.bid !== undefined ? fmtPx(p.bid, p.asset) : "\u2014"} / a {p.ask !== undefined ? fmtPx(p.ask, p.asset) : "\u2014"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2 text-right tabular-nums text-white/65">{fmtQty(p.qty, p.asset)}</div>
                      <div className="col-span-2 text-right tabular-nums text-white/50">{fmtPx(p.avg, p.asset)}</div>
                      <div className="col-span-2 text-right tabular-nums text-white/65">{fmtPx(p.last, p.asset)}</div>
                      <div className="col-span-3 text-right">
                        <span className={cn("tabular-nums font-semibold", pnlClass(pnl))}>
                          {pnl >= 0 ? "+" : ""}{fmtMoney2(pnl)}
                        </span>
                        <span className={cn("ml-1 text-[9px] tabular-nums", pnlClass(pnlPct))}>
                          {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    {/* Mobile: stacked layout */}
                    <div className="sm:hidden">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[13px] font-bold text-white truncate">{sym}</span>
                          <span className={assetTypePill(p.asset)}>{p.asset === "crypto" ? "CRYPTO" : "STOCK"}</span>
                          {p.broker && <span className={inlineBrokerPill(p.broker)}>{p.broker}</span>}
                        </div>
                        <span className={cn("text-[12px] tabular-nums font-semibold shrink-0", pnlClass(pnl))}>
                          {pnl >= 0 ? "+" : ""}{fmtMoney2(pnl)} <span className="text-[9px]">{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-white/40 tabular-nums">
                        <span>{fmtQty(p.qty, p.asset)} @ {fmtPx(p.avg, p.asset)}</span>
                        <span>Last {fmtPx(p.last, p.asset)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* ── BUY / SELL / FLAT — always visible ── */}
              <div className="flex items-center gap-1.5 mt-1.5">
                <button className="h-6 w-16 rounded-sm border text-[9px] font-bold border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300 hover:bg-emerald-400/15 transition-colors" onClick={(e) => { e.stopPropagation(); emitTradeAction("BUY", p.asset, sym); }} type="button">BUY</button>
                <button className="h-6 w-16 rounded-sm border text-[9px] font-bold border-red-400/25 bg-red-400/[0.08] text-red-300 hover:bg-red-400/15 transition-colors" onClick={(e) => { e.stopPropagation(); emitTradeAction("SELL", p.asset, sym); }} type="button">SELL</button>
                <button className="h-6 w-12 rounded-sm border text-[9px] font-bold border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] transition-colors" onClick={(e) => { e.stopPropagation(); emitTradeAction("FLAT", p.asset, sym); }} type="button">FLAT</button>
                {p.broker && (
                  <span className="text-[8px] text-white/30">{p.broker}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ── main render with detach/popup support ── */
  return (
    <>
      {!detached ? (
        <div className="h-full min-h-0 flex flex-col overflow-hidden">
          {positionsBody}
        </div>
      ) : (
        <div className="h-full min-h-0 flex flex-col items-center justify-center py-8 gap-3">
          <div className="text-white/20 text-[22px]">{"\u29C9"}</div>
          <span className="text-white/25 text-[11px] uppercase tracking-wider font-medium">Positions Detached</span>
          <button
            type="button"
            onClick={() => setDetached(false)}
            className="text-cyan-400/70 hover:text-cyan-400 text-[11px] transition-colors"
          >
            Reattach
          </button>
        </div>
      )}

      {detached && createPortal(
        <div className="fixed inset-0 z-[9998]" style={{ pointerEvents: "none" }}>
          <div
            className="absolute border border-emerald-400/[0.08] rounded-sm overflow-hidden flex flex-col"
            style={{
              left: dragPos.x, top: dragPos.y, width: "50vw", height: "calc(100vh - 60px)", pointerEvents: "auto",
              background: [
                "radial-gradient(ellipse 70% 35% at 8% 0%, rgba(52,211,153,0.08) 0%, transparent 100%)",
                "radial-gradient(ellipse 40% 25% at 92% 100%, rgba(34,211,238,0.03) 0%, transparent 100%)",
                "linear-gradient(180deg, rgba(5,11,22,0.99) 0%, rgba(2,6,14,0.99) 100%)",
              ].join(", "),
              boxShadow: "0 0 0 1px rgba(52,211,153,0.06), 0 25px 60px rgba(0,0,0,0.75)",
            }}
          >
            <div
              className="flex items-center h-8 px-3 border-b border-emerald-400/[0.08] cursor-move select-none shrink-0"
              style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.06) 0%, transparent 50%)" }}
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
            >
              <span className="text-[11px] text-emerald-400/90 font-bold tracking-wider">iMYNTED POSITIONS</span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetached(false)}
                  className="text-white/30 hover:text-white text-[14px] transition-colors leading-none"
                >
                  {"\u2715"}
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {positionsBody}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

