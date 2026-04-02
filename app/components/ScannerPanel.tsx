// app/components/ScannerPanel.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSettings } from "./SettingsContext";

/* ─── Types ─── */

type RawRow = Record<string, any>;
type Tab = "bulls" | "bears" | "catalysts" | "flow" | "risk" | "halts";
type ScreenerPreset = "gainers" | "losers" | "heat" | "dividends";
type ScannerMode = "market" | "imynted";

type Direction = "bull" | "bear" | "neutral";
type ConvictionLevel = "high" | "medium" | "low";
type ScannerBucket = string;

type Row = {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  volumeLabel?: string;
  tag?: string;
  totalScore?: number;
  marketCap?: number;
  // Intelligence
  opportunityScore?: number;
  bullScore?: number;
  bearScore?: number;
  riskPenalty?: number;
  direction?: Direction;
  conviction?: ConvictionLevel;
  bucket?: ScannerBucket;
  reason?: string;
  scores?: Record<string, number>;
  // Halts
  haltStatus?: string;
  haltReason?: string;
  haltTime?: string;
  haltMs?: number;
};

type HaltItem = {
  id?: string;
  symbol?: string;
  status?: string;
  reason?: string;
  venue?: string;
  published?: string;
  title?: string;
  url?: string;
  ts?: string;
  asOf?: string;
  time?: string;
};

type HaltsApiAllResp = {
  mode?: string;
  provider?: string;
  items?: HaltItem[];
  ts?: string;
  error?: string;
};

type QuoteMini = {
  bid?: number;
  ask?: number;
  mid?: number;
  last?: number;
  price?: number;
  ts?: string;
  provider?: string;
  warn?: string;
};

/* ─── Helpers ─── */

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function n(v: any): number {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;

  if (typeof v === "string") {
    const s = v.trim().replace(/,/g, "").replace(/%/g, "");
    const x = Number(s);
    return Number.isFinite(x) ? x : NaN;
  }

  const x = Number(v);
  return Number.isFinite(x) ? x : NaN;
}

function fmtPx(x: number) {
  if (!Number.isFinite(x)) return "-";
  return x >= 1 ? x.toFixed(2) : x.toFixed(4);
}

function fmtPct(x: number) {
  if (!Number.isFinite(x)) return "-";
  const s = x >= 0 ? "+" : "";
  return `${s}${x.toFixed(2)}%`;
}

function volLabel(v: number, fallback?: string) {
  if (fallback) return fallback;
  if (!Number.isFinite(v)) return "-";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
  return String(Math.round(v));
}

/* ─── Canonical symbol helpers ─── */

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

function normalizeStockSymbol(raw: string) {
  let s = normSym(raw);
  if (!s) return "AAPL";
  s = s.replace(/-USD$/i, "");
  s = s.replace(/[0-9]+$/, "");
  if (s.includes("-")) return "AAPL";
  s = s.replace(/[^A-Z0-9.]/g, "");
  return s || "AAPL";
}

function normalizeSymbol(asset: "stock" | "crypto", raw: string) {
  return asset === "crypto" ? normalizeCryptoSymbol(raw) : normalizeStockSymbol(raw);
}

function cleanSymbol(raw: any) {
  let s = String(raw ?? "").toUpperCase().trim().replace(/\s+/g, "");
  if (!s) return "";
  s = s.replace(/[^A-Z0-9.\-]/g, "");
  s = s.replace(/[0-9]+$/, "");
  if (s.includes("-")) return "AAPL";
  s = s.replace(/[^A-Z0-9.]/g, "");
  return s;
}

/* ─── Data Unwrapping ─── */

function unwrapRowsLike(json: any): RawRow[] {
  if (!json) return [];
  if (typeof json === "object") {
    if ((json.ok === true || json.ok === false) && json.data !== undefined)
      return unwrapRowsLike(json.data);
    if ((json.success === true || json.success === false) && json.data !== undefined)
      return unwrapRowsLike(json.data);
    if (json.result && typeof json.result === "object") {
      const r = unwrapRowsLike(json.result);
      if (r.length) return r;
    }
    if (json.payload && typeof json.payload === "object") {
      const r = unwrapRowsLike(json.payload);
      if (r.length) return r;
    }
  }
  if (Array.isArray(json)) return json;
  const direct = (obj: any): RawRow[] => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    if (Array.isArray(obj.rows)) return obj.rows;
    if (Array.isArray(obj.data)) return obj.data;
    return [];
  };
  const a1 = direct(json);
  if (a1.length) return a1;
  if (json.data && typeof json.data === "object") {
    const d = json.data;
    const a2 = direct(d);
    if (a2.length) return a2;
  }
  if (json.rows && typeof json.rows === "object") {
    const r = json.rows;
    const a3 = direct(r);
    if (a3.length) return a3;
  }
  return [];
}

function normalize(r: RawRow): Row {
  const symbol = cleanSymbol(r.symbol ?? r.ticker ?? r.sym ?? r.code ?? "");
  const rawName = r.name ?? r.company ?? r.companyName ?? r.description ?? r.shortName ?? "";
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : undefined;
  const price = n(r.price ?? r.px ?? r.last ?? r.lastPrice ?? r.ltp ?? r.close);
  const change = n(r.change ?? r.chg ?? r.delta ?? r.net ?? r.netChange);
  const providedPct = n(r.changePct ?? r.chgPct ?? r.pct ?? r.percent ?? r.netPct);
  const volume = n(r.volume ?? r.vol ?? r.v ?? r.totalVolume ?? r.dayVolume);
  const volumeLabel = (r.volumeLabel ?? r.volLabel ?? r.volume_label) as string | undefined;
  const tag = (r.tag ?? r.type ?? r.label) as string | undefined;
  const totalScore = n(r.totalScore ?? r.score ?? r.rankScore ?? r.total_score);
  const marketCap = n(r.marketCap ?? r.market_cap ?? r.mktCap);

  let changePct = providedPct;
  if (!Number.isFinite(changePct) && Number.isFinite(price) && Number.isFinite(change)) {
    const prev = price - change;
    if (Number.isFinite(prev) && prev !== 0) changePct = (change / prev) * 100;
  }

  return {
    symbol,
    name,
    price,
    change,
    changePct,
    volume,
    volumeLabel,
    tag: tag ? String(tag).trim() : undefined,
    totalScore: Number.isFinite(totalScore) ? totalScore : undefined,
    marketCap: Number.isFinite(marketCap) ? marketCap : undefined,
    // Intelligence fields
    opportunityScore: Number.isFinite(n(r.opportunityScore)) ? n(r.opportunityScore) : undefined,
    bullScore: Number.isFinite(n(r.bullScore)) ? n(r.bullScore) : undefined,
    bearScore: Number.isFinite(n(r.bearScore)) ? n(r.bearScore) : undefined,
    riskPenalty: Number.isFinite(n(r.riskPenalty)) ? n(r.riskPenalty) : undefined,
    direction: (r.direction as Direction) ?? undefined,
    conviction: (r.conviction as ConvictionLevel) ?? undefined,
    bucket: (r.bucket as ScannerBucket) ?? undefined,
    reason: typeof r.reason === "string" ? r.reason : undefined,
    scores: r.scores && typeof r.scores === "object" ? r.scores : undefined,
  };
}

function ActionPill({ kind, onClick }: { kind: "B" | "S"; onClick: (e: React.MouseEvent) => void }) {
  const isBuy = kind === "B";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold leading-none",
        isBuy
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
          : "border-rose-500/25 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15"
      )}
      title={isBuy ? "Buy" : "Sell"}
    >
      {kind}
    </button>
  );
}

function MiniBadge({ count, tone }: { count: number; tone: "rose" | "sky" }) {
  if (!count) return null;
  const toneColors: Record<string, string> = {
    rose: "border-rose-500/25 bg-rose-500/10 text-rose-200",
    sky: "border-sky-500/25 bg-sky-500/10 text-sky-200",
  };
  return (
    <span
      className={cn(
        "ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-sm border px-1 text-[10px] font-semibold leading-none",
        toneColors[tone] || toneColors.sky
      )}
    >
      {count}
    </span>
  );
}

function NewsPill({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      className="inline-flex h-[15px] items-center gap-[2px] rounded-sm border border-cyan-500/20 bg-[rgba(6,182,212,0.08)] px-[4px] text-[8px] font-bold uppercase leading-none text-cyan-400 tracking-wider select-none"
      title={`${count} news article${count > 1 ? "s" : ""}`}
    >
      <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
        <path d="M2 3h9v10H2V3zm9 1h2v8h-1c-.6 0-1-.4-1-1V4zM4 5h5v2H4V5zm0 3h2v1H4V8zm3 0h2v1H7V8zm-3 2h2v1H4v-1zm3 0h2v1H7v-1z"/>
      </svg>
      {count > 1 && count}
    </span>
  );
}

/* ─── Score Detail Panel ─── */

const SIGNAL_LABELS: Array<{ key: string; label: string; color: string }> = [
  { key: "catalyst", label: "Catalyst", color: "amber" },
  { key: "sentiment", label: "Sentiment", color: "cyan" },
  { key: "confirmation", label: "Confirmation", color: "emerald" },
  { key: "momentum", label: "Momentum", color: "cyan" },
  { key: "volume", label: "Volume", color: "violet" },
  { key: "structure", label: "Structure", color: "cyan" },
  { key: "liquidity", label: "Liquidity", color: "emerald" },
  { key: "orderflow", label: "Order Flow", color: "amber" },
  { key: "volatility", label: "Volatility", color: "red" },
  { key: "squeeze", label: "Squeeze", color: "violet" },
];

function ScoreDetail({ row }: { row: Row }) {
  if (!row.scores) return null;
  return (
    <div className="px-3 py-2 bg-[rgba(4,10,18,0.6)] border-t border-white/5">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {SIGNAL_LABELS.map(({ key, label, color }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-[10px] text-white/50">{label}</span>
            <ScoreBar value={row.scores?.[key]} color={color} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[10px]">
        <span className="text-white/40">Opp: <span className="text-cyan-300 font-semibold">{Math.round(row.opportunityScore ?? 0)}</span></span>
        <span className="text-white/40">Bull: <span className="text-emerald-300">{Math.round(row.bullScore ?? 0)}</span></span>
        <span className="text-white/40">Bear: <span className="text-red-300">{Math.round(row.bearScore ?? 0)}</span></span>
        <span className="text-white/40">Risk: <span className="text-amber-300">-{Math.round(row.riskPenalty ?? 0)}</span></span>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

/* ─── Event helpers ─── */

function fireTradeAction(action: "BUY" | "SELL", symbol: string) {
  try {
    window.dispatchEvent(new CustomEvent("imynted:tradeAction", { detail: { action, asset: "stock", symbol } }));
  } catch {}
}

function emitPickSymbol(asset: "stock" | "crypto", rawSymbol: string) {
  const canonical = normalizeSymbol(asset, rawSymbol);
  if (!canonical) return;
  const detail = {
    symbol: canonical,
    asset,
    rawSymbol: String(rawSymbol || "").toUpperCase().trim(),
    source: "ScannerPanel",
    tsLocal: Date.now(),
  };
  try { window.dispatchEvent(new CustomEvent("imynted:symbol", { detail })); } catch {}
  try { window.dispatchEvent(new CustomEvent("imynted:symbolPick", { detail })); } catch {}
  try { window.dispatchEvent(new CustomEvent("msa:symbol", { detail })); } catch {}
  try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: canonical, asset } })); } catch {}
}

/* ─── UI Sub-components ─── */

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "bulls", label: "BULLS" },
  { key: "bears", label: "BEARS" },
  { key: "catalysts", label: "CATALYSTS" },
  { key: "flow", label: "FLOW" },
  { key: "risk", label: "RISK" },
  { key: "halts", label: "HALTS" },
];

/* ── per-tab color scheme (bg + text for active pill, text for symbol) ── */
const TAB_COLORS: Record<Tab, { active: string; symbol: string }> = {
  bulls:     { active: "bg-emerald-400/15 text-emerald-300 border border-emerald-400/20", symbol: "text-emerald-400" },
  bears:     { active: "bg-red-400/15 text-red-300 border border-red-400/20",             symbol: "text-red-400" },
  catalysts: { active: "bg-amber-400/15 text-amber-300 border border-amber-400/20",       symbol: "text-amber-400" },
  flow:      { active: "bg-blue-400/15 text-blue-300 border border-blue-400/20",          symbol: "text-blue-400" },
  risk:      { active: "bg-orange-400/15 text-orange-300 border border-orange-400/20",    symbol: "text-orange-400" },
  halts:     { active: "bg-yellow-700/15 text-yellow-400 border border-yellow-600/20",    symbol: "text-yellow-400" },
};

// Maps tab to the API scanner type
function tabToScannerType(tab: Tab): string {
  if (tab === "bulls") return "gainers";
  if (tab === "bears") return "losers";
  if (tab === "catalysts") return "gainers";
  if (tab === "flow") return "unusual";
  if (tab === "risk") return "gainers";
  return "gainers";
}

function DirectionIcon({ direction }: { direction?: Direction }) {
  if (direction === "bull") return <span className="text-emerald-400 text-[8px] leading-none">&#9650;</span>;
  if (direction === "bear") return <span className="text-red-400 text-[8px] leading-none">&#9660;</span>;
  return null;
}

function BucketPill({ bucket }: { bucket?: string }) {
  if (!bucket || bucket === "neutral") return null;
  const colors: Record<string, string> = {
    breakout: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
    momentum_surge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    squeeze_candidate: "border-violet-400/30 bg-violet-400/10 text-violet-300",
    catalyst_driven: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    accumulation: "border-sky-400/30 bg-sky-400/10 text-sky-300",
    distribution: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    mean_reversion: "border-orange-400/30 bg-orange-400/10 text-orange-300",
    high_risk: "border-red-500/30 bg-red-500/10 text-red-300",
  };
  const label = bucket.replace(/_/g, " ");
  return (
    <span className={cn("rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none", colors[bucket] || "border-white/10 bg-white/5 text-white/50")}>
      {label}
    </span>
  );
}

function ConvictionBadge({ conviction }: { conviction?: ConvictionLevel }) {
  if (!conviction || conviction === "low") return null;
  const cls = conviction === "high"
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
    : "border-amber-400/30 bg-amber-400/10 text-amber-300";
  return (
    <span className={cn("rounded-md border px-1 py-0.5 text-[9px] font-bold uppercase leading-none", cls)}>
      {conviction === "high" ? "HIGH" : "MED"}
    </span>
  );
}

function ScoreBar({ value, max = 100, color = "cyan" }: { value?: number; max?: number; color?: string }) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(value!, max)) : 0;
  const pct = (v / max) * 100;
  const barColors: Record<string, string> = {
    cyan: "bg-cyan-400/70",
    emerald: "bg-emerald-400/70",
    red: "bg-red-400/70",
    amber: "bg-amber-400/70",
    violet: "bg-violet-400/70",
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-12 rounded-full bg-white/10 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", barColors[color] || "bg-cyan-400/70")} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-white/60 w-5 text-right">{Math.round(v)}</span>
    </div>
  );
}

/* ─── Halts helpers ─── */

function safeTimeStr(it: HaltItem) {
  return it.published || it.ts || it.asOf || it.time || "";
}

function timeMsFrom(it: HaltItem) {
  const t = safeTimeStr(it);
  const d = new Date(t);
  const ms = d.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function hhmmFromRaw(t?: string) {
  if (!t) return "";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isHaltedStatus(status?: string) {
  const s = (status || "").toLowerCase();
  if (!s) return false;
  if (s.includes("resum")) return false;
  return s.includes("halt") || s.includes("pause");
}

function statusPretty(status?: string) {
  return (status || "").trim() || "Halted";
}

function reasonPretty(it: HaltItem) {
  const r = (it.reason || "").trim();
  if (r) return r;
  const title = (it.title || "").trim();
  if (!title) return "";
  const parts = title.split(" - ");
  if (parts.length >= 2) return parts.slice(1).join(" - ").trim();
  return "";
}

function unwrapQuotesBySymbol(json: any): Record<string, any> {
  const root = json ?? {};
  const data = root?.data ?? root;
  const by = data?.dataBySymbol ?? data?.quotesBySymbol ?? data?.bySymbol ?? data;
  if (by && typeof by === "object" && !Array.isArray(by)) return by as Record<string, any>;
  return {};
}

function normalizeQuoteMini(q: any): QuoteMini {
  const bid = n(q?.bid ?? q?.b);
  const ask = n(q?.ask ?? q?.a);
  const last = n(q?.price ?? q?.last ?? q?.px ?? q?.c);
  const mid = Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0 ? (bid + ask) / 2 : undefined;
  const price = Number.isFinite(n(q?.price)) ? n(q?.price) : Number.isFinite(mid as any) ? (mid as number) : last;
  return {
    bid: Number.isFinite(bid) ? bid : undefined,
    ask: Number.isFinite(ask) ? ask : undefined,
    mid: mid != null && Number.isFinite(mid) ? mid : undefined,
    last: Number.isFinite(last) ? last : undefined,
    price: Number.isFinite(price) ? price : undefined,
    ts: typeof q?.ts === "string" ? q.ts : typeof q?.t === "string" ? q.t : "",
    provider: typeof q?.provider === "string" ? q.provider : "",
    warn: typeof q?.warn === "string" ? q.warn : "",
  };
}

export default function ScannerPanel({
  symbol,
  onPickSymbol,
  className,
}: {
  symbol?: string;
  onPickSymbol?: (s: string) => void;
  className?: string;
}) {
  const { upColor, downColor } = useSettings();
  const focusSymbol = useMemo(() => cleanSymbol(symbol || ""), [symbol]);
  const [scannerMode, setScannerMode] = useState<ScannerMode>("imynted");
  const [screenerPreset, setScreenerPreset] = useState<ScreenerPreset>("gainers");
  const [tab, setTab] = useState<Tab>("bulls");
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [paused, setPaused] = useState(false);
  const [pollMs, setPollMs] = useState(1500);
  const [status, setStatus] = useState("");
  const [expandedSym, setExpandedSym] = useState<string | null>(null);
  type StrategySort = "total" | "breakout" | "accum" | "scalp" | "squeeze";
  const [strategySort, setStrategySort] = useState<StrategySort>("total");

  const [haltItems, setHaltItems] = useState<HaltItem[]>([]);
  const [haltCounts, setHaltCounts] = useState<Record<string, number>>({});
  const [haltTotal, setHaltTotal] = useState<number>(0);

  const [newsCounts, setNewsCounts] = useState<Record<string, number>>({});

  const [quotesBySym, setQuotesBySym] = useState<Record<string, QuoteMini>>({});

  const [detached, setDetached] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 40, y: 30 });
  const dragStartRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  const [marketType, setMarketType] = useState<"stocks" | "crypto" | "etfs" | "futures" | "forex" | "bonds">("stocks");
  const [sessionTab, setSessionTab] = useState<"pre" | "regular" | "post" | "overnight">("regular");

  // Auto-detect session from market status
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/market/status");
        const j = await res.json();
        if (j?.ok && j.session && ["pre", "regular", "post", "overnight"].includes(j.session)) {
          setSessionTab(j.session);
        }
      } catch {}
    })();
  }, []);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // ── Real-time Market Screener data (Finnhub-powered) ──
  const [screenerData, setScreenerData] = useState<{ gainers: Row[]; losers: Row[]; heat: Row[]; dividends: Row[] }>({ gainers: [], losers: [], heat: [], dividends: [] });
  const screenerAliveRef = useRef(true);

  // Track live market status for session badge
  const [marketStatus, setMarketStatus] = useState<{ isOpen: boolean; session: string; holiday?: string | null }>({ isOpen: false, session: "closed" });

  useEffect(() => {
    screenerAliveRef.current = true;
    if (scannerMode !== "market") return;

    // Fetch market status
    (async () => {
      try {
        const res = await fetch("/api/market/status");
        const j = await res.json();
        if (j?.ok) setMarketStatus({ isOpen: j.isOpen, session: j.session, holiday: j.holiday });
      } catch {}
    })();

    // Static universes for non-stock market types
    const CRYPTO_SYMS = ["BTC-USD","ETH-USD","SOL-USD","XRP-USD","ADA-USD","DOGE-USD","AVAX-USD","MATIC-USD","DOT-USD","LINK-USD","UNI-USD","ATOM-USD","LTC-USD","NEAR-USD","FIL-USD"];
    const ETF_SYMS = ["SPY","QQQ","IWM","DIA","ARKK","TQQQ","SOXL","XLF","XLE","XLK","GLD","TLT","HYG","VTI","SQQQ","UVXY","SOXS"];
    const FUTURES_SYMS = ["ES","NQ","YM","RTY","CL","NG","GC","SI","ZB","ZN","ZC","ZS"];
    const FOREX_SYMS = ["EUR/USD","GBP/USD","USD/JPY","AUD/USD","USD/CAD","USD/CHF","NZD/USD","EUR/GBP"];
    const BOND_SYMS = ["TLT","BND","HYG","LQD","AGG","SHY","IEF","MUB","VCIT","VCSH"];

    let timer: any;
    async function fetchScreener() {
      try {
        function toRows(data: any[]): Row[] {
          return (data || []).filter((r: any) => r.symbol).map((r: any) => ({
            symbol: r.symbol,
            name: r.name || r.symbol,
            price: Number(r.price) || 0,
            change: Number(r.change) || 0,
            changePct: Number(r.changePct) || 0,
            volume: Number(r.volume) || 0,
            marketCap: Number(r.marketCap) || 0,
            tag: r.tag,
          }));
        }

        let gainers: Row[] = [];
        let losers: Row[] = [];

        if (marketType === "crypto") {
          // Use CoinGecko movers API
          const res = await fetch("/api/crypto/movers", { cache: "no-store" });
          const j = await res.json().catch(() => ({}));
          const all = (j?.data || []).map((r: any) => ({
            symbol: `${r.symbol}-USD`, name: r.name || r.symbol,
            price: r.price || 0, change: r.price * (r.chgPct24h / 100) || 0,
            changePct: r.chgPct24h || 0, volume: r.vol24h || 0, marketCap: r.mcap || 0,
          }));
          gainers = all.filter((r: Row) => r.changePct > 0).sort((a: Row, b: Row) => b.changePct - a.changePct).slice(0, 25);
          losers = all.filter((r: Row) => r.changePct < 0).sort((a: Row, b: Row) => a.changePct - b.changePct).slice(0, 25);
          if (losers.length === 0) losers = all.sort((a: Row, b: Row) => a.changePct - b.changePct).slice(0, 25);
        } else if (marketType === "stocks") {
          // Finnhub-powered stock scanner
          const [gRes, lRes] = await Promise.all([
            fetch("/api/market/scanner?type=gainers&limit=25", { cache: "no-store" }),
            fetch("/api/market/scanner?type=losers&limit=25", { cache: "no-store" }),
          ]);
          const gJ = await gRes.json().catch(() => ({ rows: [] }));
          const lJ = await lRes.json().catch(() => ({ rows: [] }));
          gainers = toRows(gJ.rows || gJ.data);
          losers = toRows(lJ.rows || lJ.data);
        } else {
          // ETFs, Futures, Forex, Bonds — fetch quotes from our quote API for a fixed universe
          const syms = marketType === "etfs" ? ETF_SYMS
            : marketType === "futures" ? FUTURES_SYMS
            : marketType === "forex" ? FOREX_SYMS
            : marketType === "bonds" ? BOND_SYMS
            : ETF_SYMS;
          const assetType = marketType === "futures" ? "futures" : "stock";
          const all: Row[] = [];
          // Fetch in batches of 6
          for (let i = 0; i < syms.length; i += 6) {
            const batch = syms.slice(i, i + 6);
            const results = await Promise.allSettled(
              batch.map(sym =>
                fetch(`/api/market/quote?symbol=${encodeURIComponent(sym)}&asset=${assetType}`, { cache: "no-store" })
                  .then(r => r.json())
                  .then(j => j?.ok ? {
                    symbol: sym, name: j.data?.name || sym,
                    price: Number(j.price) || 0, change: Number(j.chg) || 0,
                    changePct: Number(j.chgPct) || 0, volume: Number(j.volume) || 0,
                    marketCap: Number(j.marketCap) || 0,
                  } : null)
              )
            );
            for (const r of results) {
              if (r.status === "fulfilled" && r.value) all.push(r.value as Row);
            }
            if (!screenerAliveRef.current) return;
          }
          gainers = all.filter(r => r.changePct > 0).sort((a, b) => b.changePct - a.changePct);
          losers = all.filter(r => r.changePct < 0).sort((a, b) => a.changePct - b.changePct);
          if (losers.length === 0) losers = all.sort((a, b) => a.changePct - b.changePct);
          if (gainers.length === 0) gainers = all.sort((a, b) => b.changePct - a.changePct);
        }

        if (!screenerAliveRef.current) return;

        // Enrich stocks with volume + marketCap (skip for crypto/others that already have it)
        if (marketType === "stocks") {
          const allSyms = [...new Set([...gainers, ...losers].map(r => r.symbol))];
          const quoteMap = new Map<string, { volume: number; marketCap: number }>();
          for (let i = 0; i < allSyms.length; i += 8) {
            const batch = allSyms.slice(i, i + 8);
            const qResults = await Promise.allSettled(
              batch.map(sym =>
                fetch(`/api/market/quote?symbol=${encodeURIComponent(sym)}&asset=stock`, { cache: "no-store" })
                  .then(r => r.json())
                  .then(j => j?.ok ? { sym, volume: Number(j.volume) || 0, marketCap: Number(j.marketCap) || 0 } : null)
              )
            );
            for (const r of qResults) {
              if (r.status === "fulfilled" && r.value) {
                quoteMap.set(r.value.sym, { volume: r.value.volume, marketCap: r.value.marketCap });
              }
            }
            if (!screenerAliveRef.current) return;
          }
          gainers = gainers.map(r => { const q = quoteMap.get(r.symbol); return q ? { ...r, volume: q.volume || r.volume, marketCap: q.marketCap || r.marketCap } : r; });
          losers = losers.map(r => { const q = quoteMap.get(r.symbol); return q ? { ...r, volume: q.volume || r.volume, marketCap: q.marketCap || r.marketCap } : r; });
        }

        // Heat = top movers by absolute % change (de-duped)
        const seen = new Set<string>();
        const heat = [...gainers, ...losers]
          .filter(r => { if (seen.has(r.symbol)) return false; seen.add(r.symbol); return true; })
          .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
          .slice(0, 20);

        setScreenerData({ gainers, losers, heat, dividends: [] });
      } catch {
        // keep existing data on error
      }
      if (screenerAliveRef.current) {
        timer = setTimeout(fetchScreener, 60_000);
      }
    }

    fetchScreener();
    return () => { screenerAliveRef.current = false; clearTimeout(timer); };
  }, [scannerMode, marketType]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLInputElement | null>(null);
  const [sel, setSel] = useState(0);

  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;

    async function pollHalts() {
      try {
        const res = await fetch("/api/market/halts?mode=all", { cache: "no-store" });
        const j = (await res.json()) as HaltsApiAllResp;
        if (!alive) return;

        const items = Array.isArray(j.items) ? j.items : [];
        setHaltItems(items);

        const counts: Record<string, number> = {};
        for (const it of items) {
          const s = cleanSymbol(it.symbol);
          if (!s) continue;
          if (!isHaltedStatus(it.status)) continue;
          counts[s] = (counts[s] || 0) + 1;
        }

        setHaltCounts(counts);
        setHaltTotal(Object.values(counts).reduce((a, b) => a + b, 0));
      } catch {
      } finally {
        if (!alive) return;
        timer = window.setTimeout(pollHalts, 30_000);
      }
    }

    pollHalts();

    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (tab === "halts" || paused) return;

    let alive = true;
    let timer: number | undefined;

    async function poll() {
      try {
        setStatus("");
        const scannerType = tabToScannerType(tab);
        const res = await fetch(`/api/scanner?type=${encodeURIComponent(scannerType)}`, { cache: "no-store" });
        if (!alive) return;

        if (!res.ok) {
          setStatus(`HTTP ${res.status}`);
          return;
        }

        const json = await res.json();

        if (json?.ok === false) {
          setStatus(String(json?.error || "Scanner error"));
          return;
        }

        const raw = unwrapRowsLike(json);
        const next = raw.map((rr: any) => normalize(rr)).filter((r) => r.symbol);

        if (next.length) {
          setRows(next);
          setStatus("");
        } else {
          setRows([]);
          setStatus("0 rows");
        }
      } catch {
        if (!alive) return;
        setStatus("Fetch error");
      } finally {
        if (!alive) return;
        timer = window.setTimeout(poll, pollMs);
      }
    }

    poll();

    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [paused, pollMs, tab]);

  const haltsMode = tab === "halts";

  const effectiveRows: Row[] = useMemo(() => {
    if (haltsMode) {
      const bySym = new Map<string, { sym: string; latestMs: number; item: HaltItem }>();
      for (const it of haltItems) {
        const s = cleanSymbol(it.symbol);
        if (!s) continue;
        if (!isHaltedStatus(it.status)) continue;
        const ms = timeMsFrom(it);
        const cur = bySym.get(s);
        if (!cur) bySym.set(s, { sym: s, latestMs: ms, item: it });
        else if (ms >= cur.latestMs) bySym.set(s, { sym: s, latestMs: ms, item: it });
      }
      const out: Row[] = [];
      for (const v of bySym.values()) {
        const it = v.item;
        out.push({
          symbol: v.sym, price: NaN, change: NaN, changePct: NaN, volume: NaN, tag: "",
          haltStatus: statusPretty(it.status),
          haltReason: reasonPretty(it) || "\u2014",
          haltTime: hhmmFromRaw(safeTimeStr(it)) || "\u2014",
          haltMs: v.latestMs || 0,
        });
      }
      out.sort((a, b) => (b.haltMs || 0) - (a.haltMs || 0) || a.symbol.localeCompare(b.symbol));
      return out;
    }

    const out = [...rows];

    // Strategy sort function — used by all tabs
    function strategySortFn(a: Row, b: Row): number {
      const scoreKey = strategySort === "breakout" ? "breakoutScore"
        : strategySort === "accum" ? "accumulationScore"
        : strategySort === "scalp" ? "scalpScore"
        : strategySort === "squeeze" ? "squeezeScore"
        : "opportunityScore";
      const aS = (a as any)[scoreKey] ?? a.totalScore ?? 0;
      const bS = (b as any)[scoreKey] ?? b.totalScore ?? 0;
      return bS - aS || a.symbol.localeCompare(b.symbol);
    }

    if (tab === "bulls") {
      out.sort(strategySortFn);
      return out; // Show all ranked — don't filter out bears, user sees direction label
    }

    if (tab === "bears") {
      out.sort((a, b) => {
        const aS = a.bearScore ?? 0;
        const bS = b.bearScore ?? 0;
        return bS - aS || a.symbol.localeCompare(b.symbol);
      });
      return out; // Show all ranked by bear score
    }

    if (tab === "catalysts") {
      out.sort((a, b) => {
        const aS = a.scores?.catalyst ?? 0;
        const bS = b.scores?.catalyst ?? 0;
        return bS - aS || a.symbol.localeCompare(b.symbol);
      });
      return out.filter(r => (r.scores?.catalyst ?? 0) > 10);
    }

    if (tab === "flow") {
      out.sort((a, b) => {
        const aS = (a.scores?.volume ?? 0) + (a.scores?.orderflow ?? 0);
        const bS = (b.scores?.volume ?? 0) + (b.scores?.orderflow ?? 0);
        return bS - aS || a.symbol.localeCompare(b.symbol);
      });
      return out;
    }

    if (tab === "risk") {
      return out
        .sort((a, b) => (b.riskPenalty ?? 0) - (a.riskPenalty ?? 0) || a.symbol.localeCompare(b.symbol));
    }

    return out;
  }, [haltsMode, rows, haltItems, tab, strategySort]);

  const filtered = useMemo(() => {
    const qq = q.trim().toUpperCase();
    return effectiveRows.filter((r) => (qq ? cleanSymbol(r.symbol).includes(qq) : true));
  }, [effectiveRows, q]);

  const visibleSymbols = useMemo(() => {
    return Array.from(new Set(filtered.map((r) => cleanSymbol(r.symbol)))).filter(Boolean).slice(0, 30);
  }, [filtered]);

  const visibleSymbolsKey = useMemo(() => visibleSymbols.join(","), [visibleSymbols]);

  /* ── News counts poll ── */
  useEffect(() => {
    if (!mountedRef.current || haltsMode) return;
    const syms = visibleSymbols;
    if (!syms.length) return;

    let alive = true;
    let timer: number | undefined;

    async function pollNews() {
      try {
        const res = await fetch(`/api/market/news-counts?asset=stock&symbols=${syms.join(",")}`, { cache: "no-store" });
        if (!alive || !res.ok) return;
        const j = await res.json().catch(() => ({}));
        if (!alive) return;
        if (j?.counts) setNewsCounts((prev) => ({ ...prev, ...j.counts }));
      } catch {} finally {
        if (alive) timer = window.setTimeout(pollNews, 60_000);
      }
    }

    pollNews();
    return () => { alive = false; if (timer) window.clearTimeout(timer); };
  }, [visibleSymbolsKey, haltsMode]);

  useEffect(() => {
    if (!mountedRef.current || haltsMode) return;

    let alive = true;
    let timer: number | undefined;

    async function loadQuotes() {
      try {
        const syms = visibleSymbols;
        if (!syms.length) {
          setQuotesBySym({});
          return;
        }

        const needs = filtered.some((r) => !Number.isFinite(r.price) || r.price <= 0);
        if (!needs) return;

        const qs = new URLSearchParams();
        qs.set("asset", "stock");
        qs.set("symbols", syms.join(","));

        const res = await fetch(`/api/market/quotes?${qs.toString()}`, { cache: "no-store" });
        if (!alive || !res.ok) return;

        const j = await res.json().catch(() => ({}));
        if (!alive || j?.ok === false) return;

        const rawBy = unwrapQuotesBySymbol(j);
        const next: Record<string, QuoteMini> = {};
        for (const s of syms) {
          const qv = rawBy?.[s];
          if (!qv) continue;
          next[s] = normalizeQuoteMini(qv);
        }

        setQuotesBySym(next);
      } catch {}
    }

    loadQuotes();
    timer = window.setInterval(loadQuotes, 3500) as unknown as number;

    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
  }, [visibleSymbolsKey, haltsMode, filtered, visibleSymbols]);

  useEffect(() => {
    if (filtered.length === 0) setSel(0);
    else setSel((s) => Math.max(0, Math.min(s, filtered.length - 1)));
  }, [filtered.length]);

  useEffect(() => {
    if (!focusSymbol) return;
    const idx = filtered.findIndex((r) => cleanSymbol(r.symbol) === focusSymbol);
    if (idx >= 0) setSel(idx);
  }, [focusSymbol, filtered]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const row = el.querySelector<HTMLElement>(`[data-row="${sel}"]`);
    if (row) row.scrollIntoView({ block: "nearest" });
  }, [sel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const isTyping = t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || (t as any)?.isContentEditable;

      if (!isTyping && e.key === ".") {
        e.preventDefault();
        filterRef.current?.focus();
        return;
      }

      if (isTyping && t !== filterRef.current) return;

      if (e.key === "Escape") {
        if (document.activeElement === filterRef.current || q) {
          e.preventDefault();
          setQ("");
          filterRef.current?.blur();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((s) => Math.min(s + 1, Math.max(0, filtered.length - 1)));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => Math.max(s - 1, 0));
        return;
      }

      if (!isTyping && (e.key === "b" || e.key === "B")) {
        const pick = filtered[Math.max(0, Math.min(sel, filtered.length - 1))];
        const sym = cleanSymbol(pick?.symbol);
        if (sym && tab !== "halts") {
          e.preventDefault();
          emitPickSymbol("stock", sym);
          onPickSymbol?.(sym);
          fireTradeAction("BUY", sym);
        }
        return;
      }

      if (!isTyping && (e.key === "s" || e.key === "S")) {
        const pick = filtered[Math.max(0, Math.min(sel, filtered.length - 1))];
        const sym = cleanSymbol(pick?.symbol);
        if (sym && tab !== "halts") {
          e.preventDefault();
          emitPickSymbol("stock", sym);
          onPickSymbol?.(sym);
          fireTradeAction("SELL", sym);
        }
        return;
      }

      if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        const pick = filtered[Math.max(0, Math.min(sel, filtered.length - 1))];
        const sym = cleanSymbol(pick?.symbol);
        if (sym) {
          emitPickSymbol("stock", sym);
          onPickSymbol?.(sym);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, onPickSymbol, q, sel, tab]);

  const selectedRow = filtered[Math.max(0, Math.min(sel, Math.max(0, filtered.length - 1)))] || null;
  const selectedSym = selectedRow ? cleanSymbol(selectedRow.symbol) : "";

  function rowView(r: Row): Row {
    const sym = cleanSymbol(r.symbol);
    const qv = quotesBySym?.[sym];
    if (!qv) return r;
    const price = Number.isFinite(r.price) && r.price > 0 ? r.price : Number(qv.price ?? qv.last ?? NaN);
    return { ...r, price };
  }

  /* ── drag handlers ── */
  function onDragStart(e: React.PointerEvent) {
    dragStartRef.current = { mx: e.clientX, my: e.clientY, ox: dragPos.x, oy: dragPos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragStartRef.current) return;
    setDragPos({
      x: dragStartRef.current.ox + (e.clientX - dragStartRef.current.mx),
      y: dragStartRef.current.oy + (e.clientY - dragStartRef.current.my),
    });
  }
  function onDragEnd() { dragStartRef.current = null; }

  /* ─── Render ─── */
  const scannerBody = (
    <div className={cn("h-full min-h-0 w-full flex flex-col", !detached && className)}>

      {/* ── Market type nav ── */}
      <div className="shrink-0 flex items-center gap-2 sm:gap-4 px-2 sm:px-3 h-8 border-b border-white/10 overflow-x-auto scrollbar-hide">
        {(["stocks", "crypto", "etfs", "futures", "forex", "bonds"] as const).map((mt) => {
          const labels: Record<string, string> = { stocks: "Stocks", crypto: "Crypto", etfs: "ETFs", futures: "Futures", forex: "Forex", bonds: "Bonds" };
          return (
            <button key={mt} type="button" onClick={() => { setMarketType(mt); if (mt !== "stocks") setScannerMode("market"); }} className={cn("text-[11px] sm:text-[12px] font-semibold transition-colors whitespace-nowrap shrink-0", marketType === mt ? "text-white" : "text-white/40 hover:text-white/70")}>
              {labels[mt]}
            </button>
          );
        })}
        <button type="button" onClick={() => { setScannerMode("market"); setScreenerPreset("heat"); }}
          className="text-[11px] sm:text-[12px] text-white/40 hover:text-white/70 transition-colors whitespace-nowrap shrink-0">Overview</button>
        <div className="relative">
          <button type="button" onClick={() => setShowMoreMenu(!showMoreMenu)} className="text-[12px] text-white/40 hover:text-white/70 transition-colors">More ▾</button>
          {showMoreMenu && (
            <div className="absolute top-full left-0 mt-1 z-50 min-w-[140px] rounded-sm border border-white/10 bg-[rgba(4,10,18,0.97)] py-1 shadow-xl">
              {[
                { label: "Hong Kong", key: "hk" }, { label: "Singapore", key: "sg" },
                { label: "Canada", key: "ca" }, { label: "Australia", key: "au" },
              ].map((item) => (
                <button key={item.key} type="button" onClick={() => setShowMoreMenu(false)} className="w-full text-left px-3 py-1.5 text-[11px] text-white/60 hover:bg-white/5 hover:text-white/90 transition-colors">
                  {item.label}
                </button>
              ))}
              <div className="border-t border-white/10 my-1" />
              <button type="button" onClick={() => setShowMoreMenu(false)} className="w-full text-left px-3 py-1.5 text-[11px] text-white/40 hover:bg-white/5 hover:text-white/70 transition-colors">
                Settings
              </button>
            </div>
          )}
        </div>
        <div className="ml-auto">
          <button type="button" onClick={() => setDetached(!detached)} className="text-white/30 hover:text-cyan-400 text-[14px] transition-colors" title={detached ? "Reattach scanner" : "Detach to window"}>⧉</button>
        </div>
      </div>

      {/* ── Mode toggle: Market Screener vs iMYNTED Scanner ── */}
      <div className="shrink-0 flex flex-wrap items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-0 rounded-sm border border-white/10 overflow-hidden shrink-0">
          <button type="button" onClick={() => setScannerMode("market")}
            className={cn("px-2 sm:px-3 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide transition-colors",
              scannerMode === "market" ? "bg-emerald-400/15 text-emerald-300" : "text-white/35 hover:text-white/60"
            )}>Market</button>
          <button type="button" onClick={() => setScannerMode("imynted")}
            className={cn("px-2 sm:px-3 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide transition-colors",
              scannerMode === "imynted" ? "bg-emerald-400/15 text-emerald-300" : "text-white/35 hover:text-white/60"
            )}>⚡ iMYNTED</button>
        </div>
        {scannerMode === "market" && (
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
            {(["pre", "regular", "post", "overnight"] as const).map((s) => {
              const isLiveSession = marketStatus.session === s || (s === "regular" && marketStatus.isOpen);
              return (
                <button key={s} type="button" onClick={() => setSessionTab(s)} className={cn(
                  "px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] rounded-sm transition-colors whitespace-nowrap shrink-0 flex items-center gap-1",
                  sessionTab === s ? "bg-white/10 text-white font-semibold" : "text-white/40 hover:text-white/70"
                )}>
                  {isLiveSession && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
                  {s === "pre" ? "Pre" : s === "regular" ? "Regular" : s === "post" ? "Post" : "O/N"}
                </button>
              );
            })}
            {marketStatus.holiday && (
              <span className="text-[8px] text-amber-400/60 ml-1 shrink-0">Holiday: {marketStatus.holiday}</span>
            )}
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-white/30 shrink-0">
          <span onClick={() => setViewMode("list")} className={cn("text-[12px] cursor-pointer transition-colors", viewMode === "list" ? "text-cyan-400" : "hover:text-white/60")}>☰</span>
          <span onClick={() => setViewMode("grid")} className={cn("text-[12px] cursor-pointer transition-colors", viewMode === "grid" ? "text-cyan-400" : "hover:text-white/60")}>⊞</span>
        </div>
      </div>

      {/* ── Market Screener presets ── */}
      {scannerMode === "market" && (
        <div className="shrink-0 px-2 sm:px-3 py-1.5 border-b border-white/[0.06]">
          <div className="flex flex-wrap items-center gap-1">
            {([
              { key: "gainers" as ScreenerPreset, label: "Gainers", icon: "▲" },
              { key: "losers" as ScreenerPreset, label: "Losers", icon: "▼" },
              { key: "heat" as ScreenerPreset, label: "Heat", icon: "🔥" },
              { key: "dividends" as ScreenerPreset, label: "Divs", icon: "💰" },
            ]).map(p => (
              <button key={p.key} type="button" onClick={() => setScreenerPreset(p.key)}
                className={cn("rounded-sm border px-1.5 sm:px-2.5 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide transition-colors shrink-0",
                  screenerPreset === p.key
                    ? "border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-300"
                    : "border-white/10 bg-white/[0.03] text-white/35 hover:text-white/60"
                )}>{p.icon} {p.label}</button>
            ))}

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter..."
              spellCheck={false}
              className="ml-auto w-[90px] sm:w-[140px] rounded-xl border border-white/[0.08] bg-[rgba(4,10,18,0.7)] px-2 sm:px-3 py-1.5 text-[11px] sm:text-[12px] text-white/85 outline-none placeholder:text-white/30 focus:border-cyan-400/30"
            />
          </div>
        </div>
      )}

      {/* ── Market Screener ── */}
      {scannerMode === "market" && (() => {
        const data = screenerData[screenerPreset];
        const isDividends = screenerPreset === "dividends";
        const filtered = q ? data.filter(r => r.symbol.toLowerCase().includes(q.toLowerCase()) || r.name?.toLowerCase().includes(q.toLowerCase())) : data;

        if (viewMode === "grid") return (
          <div className="flex-1 min-h-0 overflow-auto p-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {filtered.map((r, i) => {
                const up = r.changePct >= 0;
                function fmtV(v?: number) { if (!v) return "—"; if (v >= 1e9) return `${(v/1e9).toFixed(1)}B`; if (v >= 1e6) return `${(v/1e6).toFixed(1)}M`; if (v >= 1e3) return `${(v/1e3).toFixed(0)}K`; return String(Math.round(v)); }
                return (
                  <button key={i} type="button" onClick={() => { onPickSymbol?.(r.symbol); try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: r.symbol, asset: r.symbol.includes("-USD") ? "crypto" : "stock" } })); } catch {} }}
                    className="rounded-sm border border-white/[0.07] p-2.5 text-left hover:bg-white/[0.04] hover:border-emerald-400/20 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="inline-flex items-center justify-center h-[22px] min-w-[36px] px-1.5 rounded-sm text-[9px] font-bold text-white/90 border"
                        style={(() => {
                          const h = r.symbol.split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                          const v = h % 6;
                          const styles = [
                            { background: "linear-gradient(135deg, rgba(52,211,153,0.28) 0%, rgba(6,78,59,0.45) 100%)", borderColor: "rgba(52,211,153,0.35)" },
                            { background: "linear-gradient(135deg, rgba(45,212,191,0.28) 0%, rgba(15,80,80,0.40) 100%)", borderColor: "rgba(45,212,191,0.30)" },
                            { background: "linear-gradient(135deg, rgba(34,211,238,0.25) 0%, rgba(8,60,90,0.40) 100%)", borderColor: "rgba(34,211,238,0.30)" },
                            { background: "linear-gradient(135deg, rgba(52,211,153,0.32) 0%, rgba(34,211,238,0.15) 100%)", borderColor: "rgba(52,211,153,0.35)" },
                            { background: "linear-gradient(135deg, rgba(56,189,248,0.22) 0%, rgba(12,50,80,0.40) 100%)", borderColor: "rgba(56,189,248,0.25)" },
                            { background: "linear-gradient(135deg, rgba(52,211,153,0.30) 0%, rgba(20,60,50,0.50) 100%)", borderColor: "rgba(52,211,153,0.40)" },
                          ];
                          return styles[v];
                        })()}>{r.symbol}</span>
                      <span className={cn("text-[11px] font-bold tabular-nums", up ? "text-emerald-400" : "text-red-400")}>{up ? "+" : ""}{r.changePct.toFixed(2)}%</span>
                    </div>
                    {r.name && r.name !== r.symbol && <div className="text-[9px] text-white/35 truncate mb-1">{r.name}</div>}
                    <div className="flex items-center justify-between text-[10px] tabular-nums">
                      <span className="text-white/60">{r.price > 0 ? r.price.toFixed(2) : "—"}</span>
                      <span className="text-white/35">{fmtV(r.volume)}</span>
                    </div>
                    {r.marketCap ? <div className="text-[8px] text-white/25 mt-0.5">Cap: {fmtV(r.marketCap)}</div> : null}
                  </button>
                );
              })}
            </div>
            <div className="px-2 py-2 text-[9px] text-white/20">{filtered.length} rows</div>
          </div>
        );

        return (
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="min-w-[480px] sm:min-w-0">
            {/* Header */}
            <div className={cn("sticky top-0 z-10 grid px-2 sm:px-3 py-1.5 border-b border-white/[0.06] bg-black/60 backdrop-blur-sm text-[9px] text-white/30 uppercase tracking-wider font-semibold")}
              style={{ gridTemplateColumns: isDividends ? "24px 70px 1fr 64px 64px 64px 64px" : "24px 70px 1fr 62px 62px 52px 62px 62px 62px" }}>
              <span>No.</span>
              <span>Sym</span>
              <span>Name</span>
              {isDividends ? (<>
                <span className="text-right">Yield</span>
                <span className="text-right">5Y Avg</span>
                <span className="text-right">Price</span>
                <span className="text-right">Chg</span>
              </>) : (<>
                <span className="text-right">Price</span>
                <span className="text-right">% Chg</span>
                <span className="text-right">Chg</span>
                <span className="text-right">Vol</span>
                <span className="text-right">Turn</span>
                <span className="text-right">Cap</span>
              </>)}
            </div>
            {/* Rows */}
            {filtered.map((r, i) => {
              const up = r.changePct >= 0;
              function fmtV(v?: number) { if (!v) return "—"; if (v >= 1e12) return `${(v/1e12).toFixed(2)}T`; if (v >= 1e9) return `${(v/1e9).toFixed(2)}B`; if (v >= 1e6) return `${(v/1e6).toFixed(2)}M`; if (v >= 1e3) return `${(v/1e3).toFixed(1)}K`; return String(Math.round(v)); }
              return (
                <button key={i} type="button" onClick={() => {
                  if (onPickSymbol) onPickSymbol(r.symbol);
                  try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: r.symbol, asset: r.symbol.includes("-USD") ? "crypto" : "stock" } })); } catch {}
                }}
                  className={cn("w-full text-left grid px-2 sm:px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors items-center")}
                  style={{ gridTemplateColumns: isDividends ? "24px 70px 1fr 64px 64px 64px 64px" : "24px 70px 1fr 62px 62px 52px 62px 62px 62px" }}>
                  <span className="text-[10px] text-white/30">{i + 1}</span>
                  <span className="inline-flex items-center justify-center h-[22px] min-w-[36px] px-1.5 rounded-sm text-[9px] font-bold text-white/90 border"
                    style={(() => {
                      const h = r.symbol.split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                      const v = h % 6;
                      const s = [
                        { bg: "linear-gradient(135deg, rgba(52,211,153,0.28) 0%, rgba(6,78,59,0.45) 100%)", border: "rgba(52,211,153,0.35)" },
                        { bg: "linear-gradient(135deg, rgba(34,211,238,0.28) 0%, rgba(8,60,90,0.45) 100%)", border: "rgba(34,211,238,0.30)" },
                        { bg: "linear-gradient(135deg, rgba(99,102,241,0.28) 0%, rgba(30,27,75,0.45) 100%)", border: "rgba(99,102,241,0.30)" },
                        { bg: "linear-gradient(135deg, rgba(168,85,247,0.25) 0%, rgba(59,7,100,0.40) 100%)", border: "rgba(168,85,247,0.25)" },
                        { bg: "linear-gradient(135deg, rgba(251,146,60,0.25) 0%, rgba(80,40,10,0.40) 100%)", border: "rgba(251,146,60,0.25)" },
                        { bg: "linear-gradient(135deg, rgba(56,189,248,0.28) 0%, rgba(12,50,80,0.45) 100%)", border: "rgba(56,189,248,0.30)" },
                      ][v];
                      return { background: s.bg, borderColor: s.border };
                    })()}>
                    {r.symbol}
                  </span>
                  <span className="text-[11px] text-white/50 truncate">{r.name ?? "—"}</span>
                  {isDividends ? (<>
                    <span className="text-[11px] tabular-nums text-right text-cyan-400 font-semibold">{r.tag}</span>
                    <span className="text-[11px] tabular-nums text-right text-white/50">—</span>
                    <span className="text-[11px] tabular-nums text-right text-white/70">{r.price.toFixed(r.price >= 100 ? 2 : 3)}</span>
                    <span className={cn("text-[11px] tabular-nums text-right font-semibold", up ? upColor : downColor)}>
                      {up ? "+" : ""}{r.change.toFixed(r.change >= 1 ? 2 : 4)}
                    </span>
                  </>) : (<>
                    <span className="text-[11px] tabular-nums text-right text-white/70">{r.price.toFixed(r.price >= 100 ? 2 : r.price >= 1 ? 3 : 4)}</span>
                    <span className={cn("text-[11px] tabular-nums text-right font-semibold", up ? upColor : downColor)}>
                      {up ? "+" : ""}{r.changePct.toFixed(2)}%
                    </span>
                    <span className={cn("text-[11px] tabular-nums text-right", up ? upColor : downColor)}>
                      {up ? "+" : ""}{r.change.toFixed(r.change >= 1 ? 2 : 4)}
                    </span>
                    <span className="text-[11px] tabular-nums text-right text-white/50">{fmtV(r.volume)}</span>
                    <span className="text-[11px] tabular-nums text-right text-white/45">{fmtV(r.volume * r.price)}</span>
                    <span className="text-[11px] tabular-nums text-right text-white/40">{fmtV(r.marketCap)}</span>
                  </>)}
                </button>
              );
            })}
            {/* Footer */}
            <div className="px-2 sm:px-3 py-2 text-[9px] text-white/20 flex items-center justify-between">
              <span>{filtered.length} rows</span>
              <span>SIM · No live feed</span>
            </div>
            </div>
          </div>
        );
      })()}

      {/* Scanner tabs — only show in iMYNTED mode */}
      {scannerMode === "imynted" && (<>
      <div className="shrink-0 py-1.5 px-1">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-0.5 sm:gap-1 rounded-xl border border-white/10 bg-[rgba(4,10,18,0.7)] p-0.5 sm:p-1 overflow-x-auto scrollbar-hide">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1 sm:gap-1.5 rounded-lg px-1.5 sm:px-2.5 py-1 text-[10px] sm:text-[11px] transition whitespace-nowrap shrink-0",
                  tab === t.key
                    ? TAB_COLORS[t.key].active
                    : "text-white/65 hover:bg-white/10 border border-transparent"
                )}
                type="button"
              >
                <span>{t.label}</span>
                {t.key === "halts" && haltTotal > 0 ? (
                  <span className={cn(
                    "inline-flex h-4 min-w-[16px] items-center justify-center rounded-md px-1 text-[10px] font-semibold leading-none",
                    tab === t.key ? "bg-red-500/20 text-red-300" : "border border-rose-500/20 bg-rose-500/10 text-rose-200"
                  )}>
                    {haltTotal}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Strategy sort */}
          {tab !== "halts" && (
            <div className="flex items-center gap-0.5 rounded-xl border border-white/[0.06] bg-[rgba(4,10,18,0.5)] p-0.5 overflow-x-auto scrollbar-hide">
              {([
                { key: "total" as StrategySort, label: "TOTAL" },
                { key: "breakout" as StrategySort, label: "BRK" },
                { key: "accum" as StrategySort, label: "ACC" },
                { key: "scalp" as StrategySort, label: "SCP" },
                { key: "squeeze" as StrategySort, label: "SQZ" },
              ]).map(s => (
                <button key={s.key} type="button" onClick={() => setStrategySort(s.key)}
                  className={cn(
                    "px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-bold rounded-lg transition-colors whitespace-nowrap shrink-0",
                    strategySort === s.key
                      ? "bg-cyan-400/15 text-cyan-300 border border-cyan-400/25"
                      : "text-white/40 hover:text-white/60 border border-transparent"
                  )}>{s.label}</button>
              ))}
            </div>
          )}

          <input
            ref={filterRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter..."
            spellCheck={false}
            className="w-[90px] sm:w-[140px] rounded-xl border border-white/[0.08] bg-[rgba(4,10,18,0.7)] px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-[12px] text-white/85 outline-none placeholder:text-white/30 focus:border-cyan-400/30"
          />

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {tab !== "halts" ? (
              <>
                <button
                  onClick={() => setPaused((p) => !p)}
                  className={cn(
                    "rounded-xl border px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-[12px]",
                    paused
                      ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
                      : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15"
                  )}
                  type="button"
                >
                  {paused ? "Paused" : "Live"}
                </button>
                <select
                  value={pollMs}
                  onChange={(e) => setPollMs(Number(e.target.value))}
                  className="hidden sm:block rounded-xl border border-white/[0.08] bg-[rgba(4,10,18,0.7)] px-2 py-2 text-[12px] text-white/80"
                >
                  <option value={1000}>1s</option>
                  <option value={1500}>1.5s</option>
                  <option value={2000}>2s</option>
                  <option value={3000}>3s</option>
                </select>
              </>
            ) : (
              <div className="rounded-xl border border-white/[0.08] bg-[rgba(4,10,18,0.5)] px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-[12px] text-white/50">
                ~30s
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Column headers — list view only */}
      {viewMode === "list" && (
        <>
          {tab === "halts" ? (
            <div className="shrink-0 grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,.6fr)] sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.05fr)_minmax(0,1.7fr)_minmax(0,.7fr)] gap-1 sm:gap-2 rounded-xl border border-white/[0.08] bg-[rgba(4,10,18,0.5)] px-2 sm:px-3 py-2 text-[10px] sm:text-[11px] font-semibold text-white/40">
              <div>SYM</div>
              <div className="hidden sm:block">STATUS</div>
              <div>REASON</div>
              <div className="text-right">TIME</div>
            </div>
          ) : (
            <div className="shrink-0 grid grid-cols-[minmax(50px,1.2fr)_56px_56px_52px] sm:grid-cols-[28px_minmax(80px,1.3fr)_36px_minmax(0,1fr)_62px_62px_52px_62px_62px_62px_110px] gap-1 border-b border-white/[0.08] bg-[rgba(4,10,18,0.5)] px-2 sm:px-3 py-2 text-[9px] sm:text-[10px] font-semibold text-white/40 uppercase tracking-wide">
              <div className="hidden sm:block">No.</div>
              <div>Sym</div>
              <div className="hidden sm:block"></div>
              <div className="hidden sm:block">Name</div>
              <div className="text-right">Price</div>
              <div className="text-right">% Chg</div>
              <div className="hidden sm:block text-right">Chg</div>
              <div className="hidden sm:block text-right">Vol</div>
              <div className="hidden sm:block text-right">Turn</div>
              <div className="hidden sm:block text-right">Cap</div>
              <div className="text-right">Sentiment</div>
            </div>
          )}
        </>
      )}

      {/* Row list — list view */}
      {viewMode === "list" && (
      <div ref={listRef} className="flex-1 min-h-0 overflow-auto bg-[rgba(2,7,14,0.6)]">
        {filtered.length === 0 ? (
          <div className="p-4 text-[12px] text-white/35">
            {tab === "halts" ? "No active halts right now." : tab === "risk" ? "No high-risk signals detected." : "No rows."}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((r0, idx) => {
              const r = rowView(r0);
              const selected = idx === sel;
              const up = (r.changePct ?? 0) >= 0;
              const sym = cleanSymbol(r.symbol);
              const haltCount = haltCounts[sym] || 0;
              const newsCount = newsCounts[sym] || 0;
              const isExpanded = expandedSym === sym;

              return (
                <div key={`${sym}-${idx}`}>
                  <div
                    data-row={idx}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSel(idx);
                      emitPickSymbol("stock", sym);
                      onPickSymbol?.(sym);
                    }}
                    onDoubleClick={() => setExpandedSym(isExpanded ? null : sym)}
                    className={cn(
                      "group relative w-full select-none px-2 sm:px-3 text-left",
                      tab === "halts"
                        ? "grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,.6fr)] sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.05fr)_minmax(0,1.7fr)_minmax(0,.7fr)] gap-1 sm:gap-2 py-1.5"
                        : "grid grid-cols-[minmax(50px,1.2fr)_56px_56px_52px] sm:grid-cols-[28px_minmax(80px,1.3fr)_36px_minmax(0,1fr)_62px_62px_52px_62px_62px_62px_110px] gap-1 py-1.5",
                      selected ? "bg-cyan-400/5" : "hover:bg-white/[0.03]"
                    )}
                  >
                    {/* Selection indicator */}
                    <div className={cn("absolute left-0 top-0 h-full w-[2px]", selected ? "bg-cyan-400/70" : "bg-transparent")} />

                    {/* Row number */}
                    {tab !== "halts" && <div className="hidden sm:block text-[10px] text-white/30 tabular-nums self-center">{idx + 1}</div>}

                    {/* Symbol column — color-coded by direction */}
                    <div className="min-w-0 flex items-center gap-1 text-[12px]">
                      {tab !== "halts" && <DirectionIcon direction={r.direction} />}
                      <span className={cn("font-semibold truncate", TAB_COLORS[tab].symbol)}>{sym}</span>
                      <MiniBadge count={haltCount} tone="rose" />
                      {newsCount > 0 && <NewsPill count={newsCount} />}
                    </div>

                    {/* B/S action pills + Trade button */}
                    {tab !== "halts" && (
                      <div className={cn(
                        "flex items-center justify-center gap-0.5 transition-opacity",
                        selected ? "opacity-100" : "sm:opacity-0 sm:group-hover:opacity-100"
                      )}>
                        <ActionPill kind="B" onClick={(e) => { e.preventDefault(); e.stopPropagation(); fireTradeAction("BUY", sym); }} />
                        <ActionPill kind="S" onClick={(e) => { e.preventDefault(); e.stopPropagation(); fireTradeAction("SELL", sym); }} />
                      </div>
                    )}

                    {/* Name column */}
                    {tab !== "halts" && (
                      <div className="hidden sm:block min-w-0 truncate text-[11px] text-white/40 self-center">{r.name || "\u2014"}</div>
                    )}

                    {tab === "halts" ? (
                      <>
                        <div className="hidden sm:block min-w-0 truncate text-white/80">{r.haltStatus || "\u2014"}</div>
                        <div className="min-w-0 truncate text-white/60 text-[10px] sm:text-[11px]">{r.haltReason || "\u2014"}</div>
                        <div className="min-w-0 truncate text-right tabular-nums text-white/50 text-[10px] sm:text-[11px]">{r.haltTime || "\u2014"}</div>
                      </>
                    ) : (
                      <>
                        <div className={cn("text-right tabular-nums text-[11px]", selected ? "text-white/90" : "text-white/70")}>
                          {fmtPx(r.price)}
                        </div>
                        <div className={cn("text-right tabular-nums text-[11px] font-semibold", up ? upColor : downColor)}>
                          {fmtPct(r.changePct)}
                        </div>
                        <div className={cn("hidden sm:block text-right tabular-nums text-[11px]", up ? "text-emerald-400/70" : "text-red-400/70")}>
                          {Number.isFinite(r.change) ? (r.change >= 0 ? "+" : "") + r.change.toFixed(2) : "\u2014"}
                        </div>
                        <div className={cn("hidden sm:block text-right tabular-nums text-[11px]", selected ? "text-white/70" : "text-white/55")}>
                          {volLabel(r.volume, r.volumeLabel)}
                        </div>
                        <div className={cn("hidden sm:block text-right tabular-nums text-[11px]", selected ? "text-white/60" : "text-white/40")}>
                          {Number.isFinite(r.price) && Number.isFinite(r.volume) ? volLabel(r.price * r.volume) : "\u2014"}
                        </div>
                        <div className={cn("hidden sm:block text-right tabular-nums text-[11px]", selected ? "text-white/55" : "text-white/35")}>
                          {Number.isFinite(r.marketCap) ? volLabel(r.marketCap!) : "\u2014"}
                        </div>
                        {/* iMYNTED Sentiment — visible on all sizes */}
                        {(() => {
                          const score = r.opportunityScore ?? r.totalScore ?? 0;
                          const bull = r.bullScore ?? (up ? score * 0.7 : score * 0.3);
                          const bear = r.bearScore ?? (up ? score * 0.2 : score * 0.6);
                          const label = bull > bear + 10 ? "BULL" : bear > bull + 10 ? "BEAR" : "NEUTRAL";
                          const cls = label === "BULL" ? "border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-300"
                            : label === "BEAR" ? "border-red-400/30 bg-red-400/[0.12] text-red-300"
                            : "border-amber-400/30 bg-amber-400/[0.12] text-amber-300";
                          const barPct = Math.max(5, Math.min(100, score));
                          const barColor = label === "BULL" ? "bg-emerald-400/40" : label === "BEAR" ? "bg-red-400/40" : "bg-amber-400/40";
                          return (
                            <div className="flex flex-col items-end gap-0.5" title={`Bull: ${Math.round(bull)} · Bear: ${Math.round(bear)} · Score: ${Math.round(score)}`}>
                              <div className="flex items-center gap-1">
                                <span className={cn("text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-sm border whitespace-nowrap", cls)}>
                                  {label}
                                </span>
                                <span className="text-[10px] tabular-nums font-bold text-white/60">{Math.round(score)}</span>
                              </div>
                              {/* Mini bar */}
                              <div className="hidden sm:block w-full h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                                <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${barPct}%` }} />
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>

                  {/* Reason line */}
                  {tab !== "halts" && r.reason && (
                    <div className="px-3 pb-1 -mt-0.5 text-[10px] text-white/35 truncate pl-7">
                      {r.reason}
                    </div>
                  )}

                  {/* Expanded detail */}
                  {isExpanded && tab !== "halts" && <ScoreDetail row={r} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Grid / card view */}
      {viewMode === "grid" && (
        <div ref={listRef} className="flex-1 min-h-0 overflow-auto bg-[rgba(2,7,14,0.6)] p-2">
          {filtered.length === 0 ? (
            <div className="p-4 text-[12px] text-white/35">No rows.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((r0, idx) => {
                const r = rowView(r0);
                const sym = cleanSymbol(r.symbol);
                const up = (r.changePct ?? 0) >= 0;
                const selected = idx === sel;
                return (
                  <div
                    key={`${sym}-grid-${idx}`}
                    role="button" tabIndex={0}
                    onClick={() => { setSel(idx); emitPickSymbol("stock", sym); onPickSymbol?.(sym); }}
                    className={cn(
                      "rounded-sm border p-2.5 text-left transition-colors cursor-pointer",
                      selected ? "border-cyan-400/30 bg-cyan-400/5" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn("text-[12px] font-bold", TAB_COLORS[tab].symbol)}>{sym}</span>
                      <span className={cn("text-[11px] font-semibold tabular-nums", up ? upColor : downColor)}>{fmtPct(r.changePct)}</span>
                    </div>
                    {r.name && <div className="text-[10px] text-white/40 truncate mb-1.5">{r.name}</div>}
                    <div className="flex items-center justify-between text-[10px] tabular-nums">
                      <span className="text-white/60">{fmtPx(r.price)}</span>
                      <span className="text-white/40">{volLabel(r.volume, r.volumeLabel)}</span>
                    </div>
                    {Number.isFinite(r.marketCap) && (
                      <div className="text-[9px] text-white/30 mt-1">Cap: {volLabel(r.marketCap!)}</div>
                    )}
                    <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-white/[0.06]">
                      <button type="button"
                        className="flex-1 rounded-sm border border-emerald-400/25 bg-emerald-400/[0.08] py-1 text-[9px] font-bold text-emerald-300 hover:bg-emerald-400/15 transition-colors"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); fireTradeAction("BUY", sym); }}>BUY</button>
                      <button type="button"
                        className="flex-1 rounded-sm border border-red-400/25 bg-red-400/[0.08] py-1 text-[9px] font-bold text-red-300 hover:bg-red-400/15 transition-colors"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); fireTradeAction("SELL", sym); }}>SELL</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      </>)}

      {/* ── Market ticker bar ── */}
      <div className="shrink-0 h-6 flex items-center gap-2 sm:gap-4 px-2 sm:px-3 border-t border-white/10 bg-[rgba(2,7,14,0.8)] text-[9px] sm:text-[10px] tabular-nums overflow-x-auto scrollbar-hide">
        <span className="text-white/30 shrink-0">{scannerMode === "imynted" ? `${filtered.length} rows` : ""}{status ? <span className="ml-1 text-rose-300/70">({status})</span> : null}</span>
        <span className="text-white/50 shrink-0">SPX <span className="text-emerald-400">6,592 +0.54%</span></span>
        <span className="hidden sm:inline text-white/50 shrink-0">Dow <span className="text-emerald-400">46,429 +0.66%</span></span>
        <span className="hidden sm:inline text-white/50 shrink-0">NDX <span className="text-emerald-400">21,930 +0.77%</span></span>
        <span className="ml-auto text-white/20 shrink-0">
          {selectedSym && tab !== "halts" ? (
            <>{selectedSym} \u00B7 <span className="text-white/40">B</span>/<span className="text-white/40">S</span></>
          ) : (
            <>\u2191/\u2193 \u00B7 Enter</>
          )}
        </span>
      </div>
    </div>
  );

  /* ── main render with detach/fullscreen popup ── */
  return (
    <>
      {!detached ? (
        <div className="h-full min-h-0 flex flex-col overflow-hidden">
          {scannerBody}
        </div>
      ) : (
        <div className="h-full min-h-0 flex flex-col items-center justify-center py-8 gap-3">
          <div className="text-white/20 text-[22px]">{"\u29C9"}</div>
          <span className="text-white/25 text-[11px] uppercase tracking-wider font-medium">Scanner Detached</span>
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
        <div className="fixed inset-0 z-[9997]" style={{ pointerEvents: "none" }}>
          <div
            className="absolute border border-emerald-400/[0.08] rounded-sm overflow-hidden flex flex-col"
            style={{
              left: dragPos.x, top: dragPos.y, width: "calc(100vw - 80px)", height: "calc(100vh - 60px)", pointerEvents: "auto",
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
              <span className="text-[11px] text-emerald-400/90 font-bold tracking-wider">iMYNTED SCANNER</span>
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
            <div className="flex-1 min-h-0 overflow-hidden p-2">
              {scannerBody}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}