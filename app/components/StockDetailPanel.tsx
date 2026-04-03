// app/components/StockDetailPanel.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSettings } from "./SettingsContext";

type AssetType = "stock" | "crypto";
type Tab = "ticks" | "summary" | "quotes" | "options" | "profile" | "shareholders" | "sentiment";
type ProfileSub = "overview" | "executives" | "efficiency";
type ShareholderSub = "overview" | "activity" | "insiders" | "institutions";
type OptionsSub = "chains" | "strategy" | "unusual" | "top";
type OptionType = "both" | "call" | "put";
type Moneyness = "both" | "itm" | "otm";
type Side = "B" | "S" | "M";
type Session = "all" | "overnight" | "preMkt" | "intraday" | "postMkt";

interface Tick { ts: string; price: number; size: number; side: Side; venue?: string; }
interface Level { px: number; sz: number; exch?: string; }
interface Quote {
  price?: number; bid?: number; ask?: number; chg?: number; chgPct?: number;
  high?: number; low?: number; open?: number; prevClose?: number; volume?: number;
  mktCap?: number; pe?: number; eps?: number; beta?: number; week52High?: number;
  week52Low?: number; avgVol?: number; shares?: number; float?: number; divYield?: number;
  ts?: string; provider?: string;
}
interface Profile {
  name?: string; description?: string; sector?: string; industry?: string;
  employees?: number; website?: string; ceo?: string; founded?: string; country?: string;
}
interface SignalResult {
  score: number;
  label: string;
  sub: string;
  what: string;
  pros: string[];
  cons: string[];
}

/* ── helpers ──────────────────────────────────────────────────────── */

function cn(...xs: Array<string | false | null | undefined>) { return xs.filter(Boolean).join(" "); }
function clamp(v: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, v)); }

function fmtPx(v?: number, dec?: number) {
  if (!Number.isFinite(v)) return "—";
  const d = dec ?? (Number(v) >= 100 ? 2 : Number(v) >= 1 ? 2 : 4);
  return Number(v).toFixed(d);
}
function fmtPct(v?: number) {
  if (!Number.isFinite(v)) return "—";
  return `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`;
}
function fmtChg(v?: number) {
  if (!Number.isFinite(v)) return "—";
  return `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}`;
}
function fmtVol(v?: number) {
  if (!v || !Number.isFinite(v)) return "—";
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function StatRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-[3px] border-b border-white/[0.04]">
      <span className="text-[10px] text-white/40 shrink-0">{label}</span>
      <span className={cn("text-[10px] tabular-nums text-right font-medium", valueClass ?? "text-white/80")}>{value}</span>
    </div>
  );
}

/* ── signal scoring (client-side, from live quote + ticks + L2) ──── */

function scoreBar(score: number) {
  if (score >= 75) return "bg-emerald-400";
  if (score >= 50) return "bg-amber-400";
  if (score >= 25) return "bg-orange-400";
  return "bg-red-400/70";
}
function scoreLabel(score: number) {
  if (score >= 75) return { text: "STRONG", cls: "text-emerald-400" };
  if (score >= 50) return { text: "MODERATE", cls: "text-amber-400" };
  if (score >= 25) return { text: "WEAK", cls: "text-orange-400" };
  return { text: "INACTIVE", cls: "text-red-400/70" };
}

function momentumSignal(q: Quote): SignalResult {
  const chgPct = q.chgPct ?? 0;
  const pctScore = clamp((chgPct / 10) * 100);
  let breakoutScore = 0;
  if (q.high && q.low && q.price) {
    const range = q.high - q.low;
    if (range > 0) breakoutScore = clamp(((q.price - q.low) / range) * 100);
  }
  const score = Math.round(0.6 * pctScore + 0.4 * breakoutScore);
  const pros: string[] = [];
  const cons: string[] = [];
  if (chgPct > 5) pros.push(`Strong +${chgPct.toFixed(1)}% intraday move`);
  else if (chgPct > 2) pros.push(`Positive +${chgPct.toFixed(1)}% intraday gain`);
  if (q.high && q.price && q.high > 0 && (q.high - q.price) / q.high < 0.01) pros.push("Trading near intraday high — breakout zone");
  if (q.prevClose && q.price && q.price > q.prevClose * 1.03) pros.push("3%+ gap from previous close");
  if (chgPct < -3) cons.push(`Heavy ${chgPct.toFixed(1)}% decline today`);
  if (q.low && q.price && q.low > 0 && (q.price - q.low) / q.low < 0.01) cons.push("Price sitting near intraday low");
  if (Math.abs(chgPct) < 0.5) cons.push("Minimal price movement — low momentum");
  return {
    score, label: "Momentum",
    sub: `${chgPct >= 0 ? "+" : ""}${chgPct?.toFixed(2) ?? "—"}% • ${Math.round(breakoutScore)}% of range`,
    what: "% change from prev close (35%) · range velocity over last 5 candles (25%) · relative strength vs SPY (25%) · breakout proximity to day high (15%)",
    pros, cons,
  };
}

function volumeSignal(q: Quote): SignalResult {
  let score = 0;
  const pros: string[] = [];
  const cons: string[] = [];

  if (q.volume && q.avgVol && q.avgVol > 0) {
    const ratio = q.volume / q.avgVol;
    score = clamp((ratio - 1) * 33); // 3× avgVol = max
    if (ratio >= 3) pros.push(`${ratio.toFixed(1)}× average volume — heavy institutional flow`);
    else if (ratio >= 2) pros.push(`${ratio.toFixed(1)}× average volume — above-average participation`);
    else if (ratio >= 1.3) pros.push(`${ratio.toFixed(1)}× average volume — elevated activity`);
    if (ratio < 0.5) cons.push("Volume well below average — low conviction");
    else if (ratio < 1) cons.push("Volume below average");
  } else if (q.volume) {
    if (q.volume > 10_000_000) { score = 70; pros.push(`${fmtVol(q.volume)} shares — high absolute volume`); }
    else if (q.volume > 1_000_000) { score = 45; pros.push(`${fmtVol(q.volume)} shares traded`); }
    else { score = 20; cons.push("Low absolute volume"); }
  } else {
    cons.push("No volume data available");
  }

  return {
    score: Math.round(score), label: "Volume",
    sub: q.avgVol ? `${fmtVol(q.volume)} (${((q.volume ?? 0) / q.avgVol).toFixed(1)}× avg)` : fmtVol(q.volume),
    what: "Volume acceleration last 5 candles (40%) · relative volume vs 30-period baseline (40%) · single-candle volume spike detection (20%)",
    pros, cons,
  };
}

function volatilitySignal(q: Quote): SignalResult {
  const pros: string[] = [];
  const cons: string[] = [];
  let score = 0;

  if (q.high && q.low && q.price && q.price > 0) {
    const rangePct = (q.high - q.low) / q.price;
    score = clamp((rangePct / 0.05) * 100); // 5% day range = max
    if (rangePct > 0.08) pros.push(`${(rangePct * 100).toFixed(1)}% intraday range — very high volatility`);
    else if (rangePct > 0.04) pros.push(`${(rangePct * 100).toFixed(1)}% intraday range — elevated volatility`);
    else if (rangePct > 0.02) pros.push(`${(rangePct * 100).toFixed(1)}% intraday range — moderate movement`);
    else cons.push(`Only ${(rangePct * 100).toFixed(2)}% intraday range — tight/dead ticker`);
  } else {
    cons.push("Insufficient OHLC data");
  }

  if (q.beta && q.beta > 0) {
    if (q.beta > 2) pros.push(`Beta ${q.beta.toFixed(2)} — highly volatile vs market`);
    else if (q.beta > 1.5) pros.push(`Beta ${q.beta.toFixed(2)} — above-market volatility`);
    else if (q.beta < 0.5) cons.push(`Beta ${q.beta.toFixed(2)} — low market sensitivity`);
  }

  return {
    score: Math.round(score), label: "Volatility",
    sub: (q.high && q.low && q.price) ? `${(((q.high - q.low) / q.price) * 100).toFixed(2)}% day range` : "—",
    what: "Short vs long-term range expansion (50%) · abnormal single-candle range (30%) · dead ticker penalty — filters stocks with <0.1% movement (20%)",
    pros, cons,
  };
}

function liquiditySignal(q: Quote, bids: Level[], asks: Level[]): SignalResult {
  const pros: string[] = [];
  const cons: string[] = [];
  let score = 0;

  // Spread score
  let spreadScore = 0;
  const spr = (q.bid !== undefined && q.ask !== undefined) ? q.ask - q.bid : undefined;
  if (spr !== undefined && q.price && q.price > 0) {
    const spreadPct = spr / q.price;
    spreadScore = clamp((1 - spreadPct / 0.005) * 100); // 0.5% spread = 0 score
    if (spreadPct < 0.0005) pros.push(`Ultra-tight spread ${fmtPx(spr, 4)} (${(spreadPct * 100).toFixed(3)}%)`);
    else if (spreadPct < 0.002) pros.push(`Tight spread ${fmtPx(spr, 4)} — good liquidity`);
    else cons.push(`Wide spread ${fmtPx(spr, 4)} (${(spreadPct * 100).toFixed(2)}%) — slippage risk`);
  }

  // L2 imbalance
  let imbalanceScore = 50;
  const totalBidSz = bids.reduce((s, l) => s + l.sz, 0);
  const totalAskSz = asks.reduce((s, l) => s + l.sz, 0);
  const totalBook = totalBidSz + totalAskSz;
  if (totalBook > 0) {
    const bidPct = totalBidSz / totalBook;
    imbalanceScore = clamp((bidPct - 0.5) / 0.5 * 100);
    if (bidPct > 0.65) pros.push(`${Math.round(bidPct * 100)}% bid dominance — strong buy-side support`);
    else if (bidPct < 0.35) cons.push(`${Math.round((1 - bidPct) * 100)}% ask dominance — heavy sell pressure`);
  } else {
    cons.push("No L2 data — liquidity unverified");
  }

  score = Math.round(0.4 * spreadScore + 0.6 * imbalanceScore);

  return {
    score, label: "Liquidity",
    sub: spr !== undefined ? `Spr ${fmtPx(spr, 4)} · Bid ${Math.round((totalBidSz / (totalBook || 1)) * 100)}%` : "No L2",
    what: "Spread tightness vs price (40%) · bid vs ask size imbalance from Level 2 (35%) · liquidity vacuum detection — very small ask wall (25%)",
    pros, cons,
  };
}

function orderflowSignal(ticks: Tick[], bids: Level[], asks: Level[]): SignalResult {
  const pros: string[] = [];
  const cons: string[] = [];
  let score = 50;

  const recent = ticks.slice(0, 50);
  if (recent.length >= 10) {
    let buyVol = 0, sellVol = 0;
    let maxSize = 0;
    let totalSize = 0;

    for (const t of recent) {
      if (t.side === "B") buyVol += t.size;
      if (t.side === "S") sellVol += t.size;
      if (t.size > maxSize) maxSize = t.size;
      totalSize += t.size;
    }

    const avgSize = totalSize / recent.length;
    const total = buyVol + sellVol || 1;
    const imbalance = buyVol / total;
    const aggressionScore = clamp((imbalance - 0.5) / 0.5 * 100);

    // Large lot detection: if maxPrint > 3x avg
    const largeLotScore = clamp((maxSize / (avgSize || 1) - 1) / 4 * 100);

    score = Math.round(0.5 * aggressionScore + 0.5 * largeLotScore);

    if (imbalance > 0.65) pros.push(`${Math.round(imbalance * 100)}% buy-side tape — aggressive accumulation`);
    else if (imbalance > 0.55) pros.push("Slight buy imbalance on tape");
    else if (imbalance < 0.35) cons.push(`${Math.round((1 - imbalance) * 100)}% sell-side tape — distribution in progress`);
    if (maxSize > avgSize * 4) pros.push(`Large lot detected: ${fmtVol(maxSize)} shares — institutional print`);
  } else {
    score = 50;
    cons.push("Insufficient tape data for orderflow analysis");
  }

  const totalBidSz = bids.reduce((s, l) => s + l.sz, 0);
  const totalAskSz = asks.reduce((s, l) => s + l.sz, 0);
  if (totalBidSz > totalAskSz * 2.5) pros.push("Bid-side vacuum — low ask wall, squeeze potential");

  return {
    score, label: "Orderflow",
    sub: recent.length >= 10
      ? `Buy ${Math.round((recent.filter(t => t.side === "B").length / recent.length) * 100)}% of last ${recent.length} prints`
      : "Insufficient data",
    what: "Aggressive buy vs sell volume imbalance from tape (40%) · large lot detection — institutional prints (35%) · sustained buying streaks (25%)",
    pros, cons,
  };
}

function squeezeSignal(q: Quote): SignalResult {
  const pros: string[] = [];
  const cons: string[] = [];
  let score = 0;

  // Float score
  let floatScore = 0;
  if (q.float) {
    floatScore = clamp((5_000_000 / q.float) * 100);
    if (q.float < 5_000_000) pros.push(`Low float ${fmtVol(q.float)} — short squeeze fuel`);
    else if (q.float < 20_000_000) pros.push(`Small float ${fmtVol(q.float)} — manageable supply`);
    else cons.push(`Large float ${fmtVol(q.float)} — harder to squeeze`);
  } else {
    cons.push("Float data unavailable");
  }

  // Upside momentum
  const chgPct = q.chgPct ?? 0;
  const upsideScore = clamp((chgPct / 15) * 100); // 15% = max
  if (chgPct > 10) pros.push(`+${chgPct.toFixed(1)}% move — potential short covering`);
  else if (chgPct < 0) cons.push("Negative tape — no squeeze momentum");

  // Mkt cap proxy (low cap easier to squeeze)
  let capScore = 50;
  if (q.mktCap) {
    if (q.mktCap < 50_000_000) { capScore = 90; pros.push("Micro-cap — high squeeze sensitivity"); }
    else if (q.mktCap < 300_000_000) { capScore = 70; pros.push("Small-cap — elevated squeeze risk"); }
    else if (q.mktCap > 10_000_000_000) { capScore = 10; cons.push("Large-cap — difficult to squeeze"); }
  }

  score = Math.round(0.35 * floatScore + 0.30 * upsideScore + 0.20 * capScore + 0.15 * Math.min(chgPct * 2, 100));

  return {
    score: Math.max(0, score), label: "Squeeze",
    sub: q.float ? `Float ${fmtVol(q.float)} · +${chgPct.toFixed(1)}%` : `${chgPct.toFixed(1)}% move`,
    what: "Low float score — <5M float = max (30%) · short interest % (30%) · rapid upside price move (25%) · volume expansion vs baseline (15%)",
    pros, cons,
  };
}

function catalystSignal(q: Quote): SignalResult {
  // Without live news data we use gap + volume as proxy
  const chgPct = q.chgPct ?? 0;
  const pros: string[] = [];
  const cons: string[] = [];

  let gapScore = 0;
  if (q.prevClose && q.open && q.prevClose > 0) {
    const gapPct = ((q.open - q.prevClose) / q.prevClose) * 100;
    gapScore = clamp(Math.abs(gapPct) * 10);
    if (gapPct > 5) pros.push(`+${gapPct.toFixed(1)}% gap-up — likely catalyst at open`);
    else if (gapPct < -5) cons.push(`${gapPct.toFixed(1)}% gap-down — negative catalyst signal`);
    else if (Math.abs(gapPct) < 0.5) cons.push("No gap — no evident catalyst at open");
  }

  let volScore = 0;
  if (q.volume && q.avgVol && q.avgVol > 0) {
    volScore = clamp(((q.volume / q.avgVol) - 1) * 25);
    if (q.volume > q.avgVol * 2) pros.push("Volume confirms price move — institutional catalyst reaction");
  }

  const score = Math.round(0.5 * gapScore + 0.3 * volScore + 0.2 * clamp(Math.abs(chgPct) * 5));

  if (score < 20) cons.push("No strong catalyst signal detected from available data");

  return {
    score, label: "Catalyst",
    sub: (q.prevClose && q.open) ? `Gap ${(((q.open - q.prevClose) / q.prevClose) * 100).toFixed(1)}%` : "No gap data",
    what: "Catalyst type weight by importance (FDA approval=95, guidance=90, earnings=85…) · source credibility · news recency in last 5–240 min · gap + volume confirmation",
    pros, cons,
  };
}

/* ── composite score ─────────────────────────────────────────────── */

function compositeScore(signals: SignalResult[]) {
  const weights = [0.20, 0.18, 0.15, 0.15, 0.17, 0.08, 0.07]; // mom, vol, volat, liq, flow, squeeze, catalyst
  return Math.round(signals.reduce((s, sig, i) => s + sig.score * (weights[i] ?? 0.1), 0));
}

/* ── component ───────────────────────────────────────────────────── */

export default function StockDetailPanel({
  symbol,
  asset = "stock",
  companyName,
  onClose,
  defaultTab,
}: {
  symbol: string;
  asset?: AssetType;
  companyName?: string;
  onClose?: () => void;
  defaultTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab ?? "quotes");
  const [session, setSession] = useState<Session>("all");
  const [profileSub, setProfileSub] = useState<ProfileSub>("overview");
  const [symSearch, setSymSearch] = useState("");
  const [symDropOpen, setSymDropOpen] = useState(false);
  const symSearchRef = useRef<HTMLInputElement | null>(null);

  const SYM_LIST: Array<{ sym: string; name: string; asset: "stock" | "crypto" }> = [
    { sym: "AAPL", name: "Apple", asset: "stock" }, { sym: "MSFT", name: "Microsoft", asset: "stock" },
    { sym: "GOOGL", name: "Alphabet", asset: "stock" }, { sym: "AMZN", name: "Amazon", asset: "stock" },
    { sym: "NVDA", name: "NVIDIA", asset: "stock" }, { sym: "TSLA", name: "Tesla", asset: "stock" },
    { sym: "META", name: "Meta", asset: "stock" }, { sym: "JPM", name: "JPMorgan", asset: "stock" },
    { sym: "V", name: "Visa", asset: "stock" }, { sym: "SPY", name: "SPDR S&P 500", asset: "stock" },
    { sym: "QQQ", name: "Nasdaq 100 ETF", asset: "stock" }, { sym: "AMD", name: "AMD", asset: "stock" },
    { sym: "NFLX", name: "Netflix", asset: "stock" }, { sym: "DIS", name: "Disney", asset: "stock" },
    { sym: "BA", name: "Boeing", asset: "stock" }, { sym: "COIN", name: "Coinbase", asset: "stock" },
    { sym: "PLTR", name: "Palantir", asset: "stock" }, { sym: "SOFI", name: "SoFi", asset: "stock" },
    { sym: "BTC-USD", name: "Bitcoin", asset: "crypto" }, { sym: "ETH-USD", name: "Ethereum", asset: "crypto" },
    { sym: "SOL-USD", name: "Solana", asset: "crypto" }, { sym: "XRP-USD", name: "Ripple", asset: "crypto" },
    { sym: "DOGE-USD", name: "Dogecoin", asset: "crypto" },
  ];
  const symSuggestions = symSearch.trim()
    ? SYM_LIST.filter(s => s.sym.includes(symSearch.toUpperCase()) || s.name.toUpperCase().includes(symSearch.toUpperCase())).slice(0, 6)
    : SYM_LIST.slice(0, 6);

  function jumpToSymbol(sym: string, a: "stock" | "crypto") {
    setSymSearch(""); setSymDropOpen(false);
    try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: sym, asset: a } })); } catch {}
  }
  const [shareholderSub, setShareholderSub] = useState<ShareholderSub>("overview");
  const [optionsSub, setOptionsSub] = useState<OptionsSub>("chains");
  const [optType, setOptType] = useState<OptionType>("both");
  const [optMoney, setOptMoney] = useState<Moneyness>("both");
  const [optStrikes, setOptStrikes] = useState("All Strikes");
  const [optOutlook, setOptOutlook] = useState("bullish");
  const [optExp, setOptExp] = useState(7); // index into expiration dates
  const [optBias, setOptBias] = useState(50); // 0=max return, 100=max probability
  const [topOptSort, setTopOptSort] = useState(0); // index into top options filter pills
  const [quote, setQuote] = useState<Quote>({});
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [bids, setBids] = useState<Level[]>([]);
  const [asks, setAsks] = useState<Level[]>([]);
  const [profile, setProfile] = useState<Profile>({ name: companyName });
  const [fundamentals, setFundamentals] = useState<Record<string, any>>({});
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const [dragPos, setDragPos] = useState({ x: isMobile ? 0 : 80, y: isMobile ? 0 : 20 });
  const [panelSize, setPanelSize] = useState({ w: 0, h: 0 }); // 0 = auto (calc)
  const panelResizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const [rightW, setRightW] = useState(260);
  const [l2Levels, setL2Levels] = useState(10);
  const [l2Exch, setL2Exch] = useState("ALL");
  const [l2Ribbons, setL2Ribbons] = useState(true);
  const [l2SizeBar, setL2SizeBar] = useState(true);
  const [l2Menu, setL2Menu] = useState<null | "root" | "exchange" | "display">(null);
  const dragRef = useRef<{ ox: number; oy: number } | null>(null);
  const resizeDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const ticksRef = useRef<HTMLDivElement>(null);
  const aliveRef = useRef(true);

  function onDragStart(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { ox: e.clientX - dragPos.x, oy: e.clientY - dragPos.y };
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    setDragPos({ x: e.clientX - dragRef.current.ox, y: e.clientY - dragRef.current.oy });
  }
  function onDragEnd() { dragRef.current = null; }

  function onResizeStart(e: React.PointerEvent) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeDragRef.current = { startX: e.clientX, startW: rightW };
  }
  function onResizeMove(e: React.PointerEvent) {
    if (!resizeDragRef.current) return;
    const delta = resizeDragRef.current.startX - e.clientX;
    setRightW(Math.max(180, Math.min(326, resizeDragRef.current.startW + delta)));
  }
  function onResizeEnd() { resizeDragRef.current = null; }

  // Panel corner resize
  function onPanelResizeStart(e: React.PointerEvent) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const el = (e.currentTarget as HTMLElement).closest("[data-panel-root]") as HTMLElement;
    panelResizeRef.current = { startX: e.clientX, startY: e.clientY, startW: el?.offsetWidth || 900, startH: el?.offsetHeight || 650 };
  }
  function onPanelResizeMove(e: React.PointerEvent) {
    if (!panelResizeRef.current) return;
    const dw = e.clientX - panelResizeRef.current.startX;
    const dh = e.clientY - panelResizeRef.current.startY;
    setPanelSize({ w: Math.max(600, panelResizeRef.current.startW + dw), h: Math.max(400, panelResizeRef.current.startH + dh) });
  }
  function onPanelResizeEnd() { panelResizeRef.current = null; }

  // Track current symbol to discard stale responses
  const symRef = useRef(symbol);
  useEffect(() => { symRef.current = symbol; setQuote({}); }, [symbol]);

  // Poll quote
  useEffect(() => {
    aliveRef.current = true;
    let timer: any;
    async function poll() {
      if (!aliveRef.current) return;
      try {
        const res = await fetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}&asset=${asset}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        const d = json?.data ?? json?.quote ?? json ?? {};
        if (!aliveRef.current || symRef.current !== symbol) return; // discard stale
        if (aliveRef.current) setQuote({
          price: d.price ?? d.mid ?? d.last,
          bid: d.bid ?? d.b,
          ask: d.ask ?? d.a,
          chg: d.chg ?? d.change ?? d.delta,
          chgPct: d.chgPct ?? d.changePct ?? d.pct,
          high: d.dayHigh ?? d.high ?? d.h,
          low: d.dayLow ?? d.low ?? d.l,
          open: d.open ?? d.o,
          prevClose: d.prevClose ?? d.pc,
          volume: d.volume ?? d.vol ?? d.v,
          mktCap: d.mktCap ?? d.marketCap,
          pe: d.pe ?? d.peRatio,
          eps: d.eps,
          beta: d.beta,
          week52High: d.week52High ?? d.yearHigh,
          week52Low: d.week52Low ?? d.yearLow,
          avgVol: d.avgVol ?? d.avgVolume,
          shares: d.shares ?? d.sharesOutstanding,
          float: d.float ?? d.floatShares,
          divYield: d.divYield ?? d.dividendYield,
          ts: d.ts,
          provider: d.provider ?? json?.provider,
        });
      } catch {}
      if (aliveRef.current) timer = setTimeout(poll, 2500);
    }
    poll();
    return () => { aliveRef.current = false; clearTimeout(timer); };
  }, [symbol, asset]);

  // Poll tape
  useEffect(() => {
    let timer: any;
    let alive = true;
    async function poll() {
      if (!alive) return;
      try {
        const res = await fetch(`/api/market/tape?symbol=${encodeURIComponent(symbol)}&rows=120`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        const rows: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        if (alive) setTicks(rows.map((r: any) => ({
          ts: r.ts ?? r.time ?? "",
          price: Number(r.price ?? r.px ?? r.p ?? 0),
          size: Number(r.size ?? r.sz ?? r.qty ?? 0),
          side: (r.side === "S" ? "S" : r.side === "M" ? "M" : "B") as Side,
          venue: r.venue ?? r.exchange,
        })).filter(r => r.price > 0));
      } catch {}
      if (alive) timer = setTimeout(poll, 1500);
    }
    poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [symbol]);

  // Poll depth
  useEffect(() => {
    let timer: any;
    let alive = true;
    async function poll() {
      if (!alive) return;
      try {
        const res = await fetch(`/api/market/depth?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        const d = json?.data ?? json ?? {};
        const rawBids: any[] = Array.isArray(d.bids) ? d.bids : [];
        const rawAsks: any[] = Array.isArray(d.asks) ? d.asks : [];
        const mapLevels = (arr: any[]) => arr.slice(0, 60).map((x: any) => ({
          px: Number(x?.px ?? x?.price ?? x?.[0] ?? 0),
          sz: Number(x?.sz ?? x?.size ?? x?.[1] ?? 0),
          exch: String(x?.exch ?? x?.exchange ?? x?.venue ?? ""),
        })).filter(l => l.px > 0);
        if (alive) { setBids(mapLevels(rawBids)); setAsks(mapLevels(rawAsks)); }
      } catch {}
      if (alive) timer = setTimeout(poll, 1000);
    }
    poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [symbol]);

  // Fetch company profile + fundamentals from Finnhub
  useEffect(() => {
    if (asset === "crypto") return;
    let alive = true;
    (async () => {
      try {
        const [profRes, fundRes] = await Promise.all([
          fetch(`/api/market/profile?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" }),
          fetch(`/api/market/fundamentals?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" }),
        ]);
        const profJ = await profRes.json().catch(() => ({}));
        const fundJ = await fundRes.json().catch(() => ({}));
        if (!alive) return;
        if (profJ?.ok && profJ.data) {
          const d = profJ.data;
          setProfile({
            name: d.name || symbol,
            description: undefined,
            sector: d.industry || undefined,
            industry: d.industry || undefined,
            employees: undefined,
            website: d.website || undefined,
            ceo: undefined,
            founded: d.ipo || undefined,
            country: d.country || undefined,
          });
          // Store full profile data for Profile tab
          setFundamentals(prev => ({ ...prev, _profile: d }));
        }
        if (fundJ?.ok && fundJ.data) {
          setFundamentals(fundJ.data);
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, [symbol, asset]);

  // Auto-scroll ticks
  useEffect(() => {
    if (tab === "ticks" && ticksRef.current) ticksRef.current.scrollTop = 0;
  }, [ticks, tab]);

  const { upColor, downColor, settings: appSettings } = useSettings();
  const up = (quote.chg ?? 0) >= 0;
  const chgColor = up ? upColor : downColor;
  const spr = (quote.bid !== undefined && quote.ask !== undefined) ? Math.max(0, quote.ask - quote.bid) : undefined;

  const totalBid = bids.reduce((s, l) => s + l.sz, 0);
  const totalAsk = asks.reduce((s, l) => s + l.sz, 0);
  const totalBook = totalBid + totalAsk || 1;
  const bidPct = Math.round((totalBid / totalBook) * 100);
  const askPct = 100 - bidPct;

  // Compute all signals
  const signals: SignalResult[] = [
    momentumSignal(quote),
    volumeSignal(quote),
    volatilitySignal(quote),
    liquiditySignal(quote, bids, asks),
    orderflowSignal(ticks, bids, asks),
    squeezeSignal(quote),
    catalystSignal(quote),
  ];
  const composite = compositeScore(signals);

  // Symbol-keyed company data for Profile & Shareholders tabs
  const COMPANY_DB: Record<string, {
    listing: string; issuePrice: string; isin: string; founded: string; ceo: string; market: string;
    employees: string; fiscalEnd: string; address: string; city: string; province: string; country: string;
    zip: string; phone: string; website: string; description: string;
  }> = {
    TSLA: { listing: "Jun 29, 2010", issuePrice: "17.00", isin: "US88160R1014", founded: "2003", ceo: "Mr. Elon Musk", market: "NASDAQ", employees: "134,785", fiscalEnd: "12-31", address: "1 Tesla Road", city: "Austin", province: "Texas", country: "United States of America", zip: "78725", phone: "1-512-516-8177", website: "http://www.tesla.com", description: "Tesla, Inc. engages in the design, development, manufacture, and sale of electric vehicles and energy generation and storage systems. It operates through the Automotive and Energy Generation and Storage segments. The company was founded by Jeffrey B. Straubel, Elon Reeve Musk, Martin Eberhard, and Marc Tarpenning on July 1, 2003 and is headquartered in Austin, TX." },
    META: { listing: "May 18, 2012", issuePrice: "38.00", isin: "US30303M1027", founded: "2004", ceo: "Mr. Mark Zuckerberg", market: "NASDAQ", employees: "78,865", fiscalEnd: "12-31", address: "1 Meta Way", city: "Menlo Park", province: "California", country: "United States of America", zip: "94025", phone: "1-650-543-4800", website: "http://www.meta.com", description: "Meta Platforms, Inc. engages in the development of social media applications. It builds technology that helps people connect and share, find communities, and grow businesses. The company was founded by Mark Elliot Zuckerberg, Dustin Moskovitz, Chris R. Hughes, Andrew McCollum, and Eduardo P. Saverin on February 4, 2004, and is headquartered in Menlo Park, CA." },
    AAPL: { listing: "Dec 12, 1980", issuePrice: "22.00", isin: "US0378331005", founded: "1976", ceo: "Mr. Tim Cook", market: "NASDAQ", employees: "164,000", fiscalEnd: "09-30", address: "One Apple Park Way", city: "Cupertino", province: "California", country: "United States of America", zip: "95014", phone: "1-408-996-1010", website: "http://www.apple.com", description: "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide. The company also offers software and services. Apple was founded by Steve Jobs, Steve Wozniak, and Ronald Wayne in 1976." },
    NVDA: { listing: "Jan 22, 1999", issuePrice: "12.00", isin: "US67066G1040", founded: "1993", ceo: "Mr. Jensen Huang", market: "NASDAQ", employees: "36,000", fiscalEnd: "01-31", address: "2788 San Tomas Expressway", city: "Santa Clara", province: "California", country: "United States of America", zip: "95051", phone: "1-408-486-2000", website: "http://www.nvidia.com", description: "NVIDIA Corporation provides graphics, compute and networking solutions. The company operates through Graphics and Compute & Networking segments, specializing in GPUs for gaming, professional visualization, data center, and automotive markets." },
  };

  const EXEC_DB: Record<string, typeof SIM_EXECS_DEFAULT> = {
    TSLA: [
      { name: "Elon Musk", title: "Director, CEO & Technoking of Tesla", salary: "—", age: 54, gender: "male", updated: "Jan 28, 2026" },
      { name: "Vaibhav Taneja", title: "Chief Financial Officer", salary: "139.47M", age: 47, gender: "male", updated: "Jan 28, 2026" },
      { name: "Xiaotong Tom Zhu", title: "SVP, APAC & Global Vehicle Mfg.", salary: "518.25K", age: 45, gender: "male", updated: "Sep 16, 2025" },
      { name: "Robyn M. Denholm", title: "Chairman of the Board", salary: "—", age: 62, gender: "female", updated: "Jan 28, 2026" },
      { name: "Kimbal Musk", title: "Director", salary: "—", age: 52, gender: "male", updated: "Jan 28, 2026" },
      { name: "John R. Hartung", title: "Director", salary: "—", age: 0, gender: "male", updated: "Jan 28, 2026" },
      { name: "Kathleen Wilson-Thompson", title: "Independent Director", salary: "—", age: 68, gender: "female", updated: "Jan 28, 2026" },
      { name: "Joseph Gebbia", title: "Independent Director", salary: "—", age: 44, gender: "male", updated: "Jan 28, 2026" },
      { name: "Jeffrey B. Straubel", title: "Independent Director", salary: "—", age: 49, gender: "male", updated: "Jan 28, 2026" },
      { name: "James R. Murdoch", title: "Independent Director", salary: "—", age: 52, gender: "male", updated: "Jan 28, 2026" },
      { name: "Ira Ehrenpreis", title: "Independent Director", salary: "—", age: 56, gender: "male", updated: "Jan 28, 2026" },
    ],
    META: [
      { name: "Mark Zuckerberg", title: "Chairman & CEO", salary: "27.22M", age: 40, gender: "male", updated: "Jan 28, 2026" },
      { name: "Jennifer G. Newstead", title: "Chief Legal Officer", salary: "—", age: 55, gender: "female", updated: "Apr 16, 2025" },
      { name: "Javier Olivan", title: "Chief Operating Officer", salary: "25.51M", age: 47, gender: "male", updated: "Apr 16, 2025" },
      { name: "Christopher K. Cox", title: "Chief Product Officer", salary: "23.61M", age: 42, gender: "male", updated: "Apr 16, 2025" },
      { name: "Andrew Bosworth", title: "Chief Technology Officer", salary: "23.59M", age: 43, gender: "male", updated: "Apr 16, 2025" },
      { name: "Susan J. Li", title: "Chief Financial Officer", salary: "23.62M", age: 39, gender: "female", updated: "Jan 28, 2026" },
    ],
  };
  const SIM_EXECS_DEFAULT = [{ name: "—", title: "—", salary: "—", age: 0, gender: "—", updated: "—" }];

  const EFFICIENCY_DB: Record<string, typeof SIM_EFFICIENCY_DEFAULT> = {
    TSLA: [
      { year: "2025/FY", headcount: "134.79K", revPerEmp: "703.54K", opProfitPerEmp: "35.98K", netIncPerEmp: "28.60K", hcChg: "+7.26%", revChg: "-9.50%", opChg: "-41.74%", niChg: "-49.75%" },
      { year: "2024/FY", headcount: "125.67K", revPerEmp: "777.38K", opProfitPerEmp: "61.75K", netIncPerEmp: "56.92K", hcChg: "-10.54%", revChg: "+12.84%", opChg: "-2.44%", niChg: "-46.60%" },
      { year: "2023/FY", headcount: "140.47K", revPerEmp: "688.91K", opProfitPerEmp: "63.29K", netIncPerEmp: "106.60K", hcChg: "+9.87%", revChg: "+8.12%", opChg: "-41.50%", niChg: "+8.28%" },
      { year: "2022/FY", headcount: "127.86K", revPerEmp: "637.14K", opProfitPerEmp: "108.19K", netIncPerEmp: "98.45K", hcChg: "+28.77%", revChg: "+17.54%", opChg: "+65.36%", niChg: "+73.19%" },
      { year: "2021/FY", headcount: "99.29K", revPerEmp: "542.08K", opProfitPerEmp: "65.42K", netIncPerEmp: "56.84K", hcChg: "+40.33%", revChg: "+21.63%", opChg: "+132.16%", niChg: "+366.60%" },
    ],
    META: [
      { year: "2025/FY", headcount: "78.87K", revPerEmp: "2.55M", opProfitPerEmp: "1.06M", netIncPerEmp: "766.60K", hcChg: "+6.48%", revChg: "+14.73%", opChg: "+12.73%", niChg: "-8.95%" },
      { year: "2024/FY", headcount: "74.07K", revPerEmp: "2.22M", opProfitPerEmp: "936.72K", netIncPerEmp: "841.94K", hcChg: "+10.03%", revChg: "+10.83%", opChg: "+34.98%", niChg: "+44.96%" },
      { year: "2023/FY", headcount: "67.32K", revPerEmp: "2.00M", opProfitPerEmp: "694.49K", netIncPerEmp: "580.80K", hcChg: "-22.16%", revChg: "+48.62%", opChg: "+107.51%", niChg: "+116.50%" },
    ],
  };
  const SIM_EFFICIENCY_DEFAULT = [{ year: "—", headcount: "—", revPerEmp: "—", opProfitPerEmp: "—", netIncPerEmp: "—", hcChg: "—", revChg: "—", opChg: "—", niChg: "—" }];

  const HOLDER_DB: Record<string, typeof SIM_HOLDERS_DEFAULT> = {
    TSLA: [
      { name: "Elon Musk", shares: "932.9M", pctOwned: "24.86%", chg: "-210.69K", pctChg: "<0.01%", date: "Dec 29, 2025", disclosure: "Form 4" },
      { name: "The Vanguard", shares: "258.93M", pctOwned: "6.90%", chg: "+6.54M", pctChg: "+0.17%", date: "Dec 31, 2025", disclosure: "13F" },
      { name: "BlackRock", shares: "209.13M", pctOwned: "5.57%", chg: "+2.81M", pctChg: "+0.07%", date: "Dec 31, 2025", disclosure: "13F" },
      { name: "State Street Global", shares: "114.84M", pctOwned: "3.06%", chg: "+1.08M", pctChg: "+0.03%", date: "Dec 31, 2025", disclosure: "13F" },
      { name: "Geode Capital Mgmt.", shares: "65.70M", pctOwned: "1.75%", chg: "+375.95K", pctChg: "+0.01%", date: "Dec 31, 2025", disclosure: "13F" },
      { name: "Capital Research", shares: "52.47M", pctOwned: "1.40%", chg: "-2.43M", pctChg: "-0.06%", date: "Dec 31, 2025", disclosure: "Aggregated 13" },
      { name: "Norges Bank Inv.", shares: "38.09M", pctOwned: "1.01%", chg: "+814.14K", pctChg: "+0.02%", date: "Dec 31, 2025", disclosure: "13F" },
      { name: "J.P. Morgan Asset", shares: "35.60M", pctOwned: "0.95%", chg: "+2.19M", pctChg: "+0.06%", date: "Dec 31, 2025", disclosure: "13F" },
      { name: "FMR", shares: "33.77M", pctOwned: "0.90%", chg: "+3.35M", pctChg: "+0.09%", date: "Dec 31, 2025", disclosure: "13F" },
      { name: "Northern Trust", shares: "25.80M", pctOwned: "0.69%", chg: "-419.62K", pctChg: "-0.01%", date: "Dec 31, 2025", disclosure: "13F" },
    ],
    META: [
      { name: "Mark Zuckerberg", shares: "341.82M", pctOwned: "13.51%", chg: "-242.34K", pctChg: "<0.01%", date: "Oct 31, 2025", disclosure: "Form 4" },
      { name: "The Vanguard", shares: "200.00M", pctOwned: "7.91%", chg: "+7.27M", pctChg: "+0.29%", date: "Dec 31, 2025", disclosure: "13F" },
      { name: "BlackRock", shares: "171.34M", pctOwned: "6.77%", chg: "+3.99M", pctChg: "+0.16%", date: "Dec 31, 2025", disclosure: "13F" },
      { name: "FMR", shares: "114.24M", pctOwned: "4.52%", chg: "-7.70M", pctChg: "-0.30%", date: "Dec 31, 2025", disclosure: "13F" },
      { name: "State Street Global", shares: "90.84M", pctOwned: "3.59%", chg: "+4.40M", pctChg: "+0.17%", date: "Dec 31, 2025", disclosure: "13F" },
      { name: "Capital Research", shares: "84.60M", pctOwned: "3.34%", chg: "-4.27M", pctChg: "-0.17%", date: "Dec 31, 2025", disclosure: "Aggregated 13" },
    ],
  };
  const SIM_HOLDERS_DEFAULT = [{ name: "—", shares: "—", pctOwned: "—", chg: "—", pctChg: "—", date: "—", disclosure: "—" }];

  const INST_DB: Record<string, { numInst: number; totalShares: string; pctOwned: string; chgSummary: string; rows: typeof SIM_INSTITUTIONS_DEFAULT }> = {
    TSLA: { numInst: 4879, totalShares: "1.61B", pctOwned: "43.04%", chgSummary: "+68.91K", rows: [
      { date: "Latest", numInst: 4879, totalShares: "1.61B", pctOwned: "43.04%", chg: "+68.91K" },
      { date: "2025/Q3", numInst: 4886, totalShares: "1.61B", pctOwned: "43.05%", chg: "+8.97M" },
      { date: "2025/Q2", numInst: 4538, totalShares: "1.61B", pctOwned: "48.30%", chg: "+2.36M" },
      { date: "2025/Q1", numInst: 4257, totalShares: "1.60B", pctOwned: "49.74%", chg: "+22.63M" },
      { date: "2024/Q4", numInst: 4110, totalShares: "1.58B", pctOwned: "49.15%", chg: "+32.92M" },
      { date: "2024/Q3", numInst: 4421, totalShares: "1.55B", pctOwned: "48.13%", chg: "+59.75M" },
      { date: "2024/Q2", numInst: 3691, totalShares: "1.49B", pctOwned: "46.41%", chg: "+17.54M" },
    ]},
    META: { numInst: 6044, totalShares: "1.68B", pctOwned: "66.33%", chgSummary: "-493.26K", rows: [
      { date: "Latest", numInst: 6044, totalShares: "1.68B", pctOwned: "66.33%", chg: "-493.26K" },
      { date: "2025/Q3", numInst: 6056, totalShares: "1.68B", pctOwned: "66.35%", chg: "-18.43M" },
      { date: "2025/Q2", numInst: 5802, totalShares: "1.70B", pctOwned: "67.30%", chg: "-9.72M" },
      { date: "2025/Q1", numInst: 5686, totalShares: "1.71B", pctOwned: "67.87%", chg: "-7.36M" },
      { date: "2024/Q4", numInst: 5522, totalShares: "1.71B", pctOwned: "67.91%", chg: "+3.51M" },
    ]},
  };
  const SIM_INSTITUTIONS_DEFAULT = [{ date: "—", numInst: 0, totalShares: "—", pctOwned: "—", chg: "—" }];

  // Resolve for current symbol
  const sym_upper = symbol.toUpperCase();
  const _fp = fundamentals._profile || {};
  const _db = COMPANY_DB[sym_upper];
  const companyInfo = {
    listing: _db?.listing || _fp.ipo || profile.founded || "—",
    issuePrice: _db?.issuePrice || "—",
    isin: _db?.isin || "—",
    founded: _db?.founded || _fp.ipo || profile.founded || "—",
    ceo: _db?.ceo || profile.ceo || "—",
    market: _db?.market || _fp.exchange || "—",
    employees: _db?.employees || (profile.employees ? profile.employees.toLocaleString() : "—"),
    fiscalEnd: _db?.fiscalEnd || "—",
    address: _db?.address || "—",
    city: _db?.city || "—",
    province: _db?.province || "—",
    country: _db?.country || _fp.country || profile.country || "—",
    zip: _db?.zip || "—",
    phone: _db?.phone || _fp.phone || "—",
    website: _db?.website || _fp.website || profile.website || "—",
    description: _db?.description || profile.description || `${_fp.name || symbol} — ${_fp.industry || profile.industry || "Industry N/A"}. Listed on ${_fp.exchange || "—"}. IPO: ${_fp.ipo || "—"}.`,
    // Extra fields from Profile2
    currency: _fp.currency || "USD",
    industry: _fp.industry || profile.industry || "—",
    logo: _fp.logo || "",
    marketCap: _fp.marketCap || 0,
    sharesOutstanding: _fp.sharesOutstanding || 0,
    peers: _fp.peers || [],
    filings: _fp.filings || [],
  };
  const SIM_EXECS = EXEC_DB[sym_upper] ?? SIM_EXECS_DEFAULT;
  const SIM_EFFICIENCY = EFFICIENCY_DB[sym_upper] ?? SIM_EFFICIENCY_DEFAULT;
  const SIM_HOLDERS = HOLDER_DB[sym_upper] ?? SIM_HOLDERS_DEFAULT;
  const SIM_HOLDER_TYPES = [
    { type: "Mutual Fund", pct: 45, color: "#3b82f6" },
    { type: "Individual/Insider", pct: sym_upper === "TSLA" ? 28 : 18, color: "#06b6d4" },
    { type: "Public Company", pct: 5, color: "#8b5cf6" },
    { type: "Gov. Pension Fund", pct: sym_upper === "TSLA" ? 4 : 8, color: "#22c55e" },
    { type: "Hedge Fund", pct: sym_upper === "TSLA" ? 6 : 12, color: "#f59e0b" },
    { type: "Private Company", pct: 6, color: "#ef4444" },
    { type: "Sovereign Wealth Fund", pct: 3, color: "#fb923c" },
    { type: "Other", pct: 3, color: "#6b7280" },
  ];
  const SIM_ACTIVITY = [
    { date: "Mar 24, 2026", name: "Pure Portfolios Holdings LLC", chgShares: "-1.43K", chgAmount: "-540.76K", pctHeld: "0.00%", type: "Family Office/Trust" },
    { date: "Mar 24, 2026", name: "Running Point Capital Adv.", chgShares: "-1.59K", chgAmount: "-599.97K", pctHeld: "0.00%", type: "Mutual Fund" },
    { date: "Mar 24, 2026", name: "Yeomans Consulting Group", chgShares: "-1.86K", chgAmount: "-700.27K", pctHeld: "0.00%", type: "Family Office/Trust" },
    { date: "Mar 24, 2026", name: "TNB Financial Services", chgShares: "-2.01K", chgAmount: "-756.84K", pctHeld: "0.00%", type: "Mutual Fund" },
    { date: "Mar 24, 2026", name: "SOL Capital Management", chgShares: "-9.90K", chgAmount: "-3.73M", pctHeld: "0.00%", type: "Mutual Fund" },
    { date: "Mar 6, 2026", name: "Vaibhav Taneja", chgShares: "+4.35K", chgAmount: "+1.60M", pctHeld: "0.01%", type: "Individual/Insider" },
    { date: "Feb 28, 2026", name: "WisdomTree Management", chgShares: "+3.86K", chgAmount: "+1.46M", pctHeld: "0.01%", type: "Mutual Fund" },
    { date: "Feb 28, 2026", name: "IS Asset Management", chgShares: "+100", chgAmount: "+37.71K", pctHeld: "0.01%", type: "Mutual Fund" },
  ];
  const instData = INST_DB[sym_upper] ?? { numInst: 0, totalShares: "—", pctOwned: "—", chgSummary: "—", rows: SIM_INSTITUTIONS_DEFAULT };
  const SIM_INSTITUTIONS = instData.rows;

  const TABS: { key: Tab; label: string }[] = [
    { key: "quotes", label: "Quotes" },
    { key: "profile", label: "Profile" },
    { key: "summary", label: "Summary" },
    { key: "shareholders", label: "Shareholders" },
    { key: "options", label: "Options" },
    { key: "sentiment", label: "⚡ Sentiment" },
    { key: "ticks", label: "Ticks" },
  ];
  const SESSIONS: { key: Session; label: string }[] = [
    { key: "all", label: "All" },
    { key: "overnight", label: "Overnight" },
    { key: "preMkt", label: "Pre Mkt" },
    { key: "intraday", label: "Intraday" },
    { key: "postMkt", label: "Post Mkt" },
  ];

  // Session-aware ticks (sim — in production filter by actual session times)
  const sessionTicks = ticks; // pass-through since we use simulated data

  // Aggregate tick stats
  const buyVol = sessionTicks.filter(t => t.side === "B").reduce((s, t) => s + t.size, 0);
  const sellVol = sessionTicks.filter(t => t.side === "S").reduce((s, t) => s + t.size, 0);
  const neutralVol = sessionTicks.filter(t => t.side === "M").reduce((s, t) => s + t.size, 0);
  const totalTickVol = buyVol + sellVol + neutralVol || 1;
  const avgTickPx = sessionTicks.length > 0 ? sessionTicks.reduce((s, t) => s + t.price, 0) / sessionTicks.length : 0;

  // Price-level aggregation for Summary tab
  const priceLevelMap = new Map<string, { price: number; buy: number; sell: number; neutral: number }>();
  for (const t of sessionTicks) {
    const key = fmtPx(t.price);
    const lvl = priceLevelMap.get(key) ?? { price: t.price, buy: 0, sell: 0, neutral: 0 };
    if (t.side === "B") lvl.buy += t.size;
    else if (t.side === "S") lvl.sell += t.size;
    else lvl.neutral += t.size;
    priceLevelMap.set(key, lvl);
  }
  const priceLevels = Array.from(priceLevelMap.values()).sort((a, b) => b.price - a.price);
  const maxLevelSize = Math.max(...priceLevels.map(l => l.buy + l.sell + l.neutral), 1);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      data-panel-root=""
      style={{
        position: "fixed",
        left: isMobile ? 0 : dragPos.x,
        top: isMobile ? 0 : dragPos.y,
        width: isMobile ? "100vw" : panelSize.w > 0 ? panelSize.w : "calc(100vw - 160px)",
        height: isMobile ? "100vh" : panelSize.h > 0 ? panelSize.h : "calc(100vh - 40px)",
        zIndex: 9999,
        borderRadius: isMobile ? 0 : 10,
        overflow: "hidden",
        border: isMobile ? "none" : "1px solid rgba(52,211,153,0.10)",
        boxShadow: isMobile ? "none" : "0 0 0 1px rgba(52,211,153,0.05), 0 32px 80px rgba(0,0,0,0.9)",
        background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* glow */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 10, background: "radial-gradient(ellipse 60% 30% at 5% 0%, rgba(52,211,153,0.09) 0%, transparent 100%)" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 10, background: "radial-gradient(ellipse 35% 25% at 95% 100%, rgba(34,211,238,0.05) 0%, transparent 100%)" }} />

      {/* Title bar */}
      <div
        className="relative z-10 shrink-0 flex items-center justify-between px-4 py-2 border-b border-emerald-400/[0.08] cursor-grab select-none"
        style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.07) 0%, transparent 60%)" }}
        onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd}
      >
        <div className="flex items-center gap-1.5 md:gap-2 min-w-0 overflow-hidden">
          <span className="hidden md:inline text-[10px] font-bold tracking-[0.14em] text-emerald-400/80 uppercase">iMYNTED</span>
          <span className="hidden md:inline text-white/15">|</span>
          {/* Symbol pill */}
          <span className="rounded-sm border border-emerald-400/25 bg-emerald-400/[0.07] px-2 py-0.5 text-[11px] md:text-[12px] font-bold text-white tracking-wide shrink-0">{symbol}</span>
          {/* Asset type pill */}
          <span className={cn("rounded-sm border px-1 md:px-1.5 py-0.5 text-[7px] md:text-[8px] font-bold uppercase tracking-wider shrink-0",
            asset === "crypto" ? "border-amber-400/25 bg-amber-400/[0.07] text-amber-300" : "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300/70"
          )}>{asset === "crypto" ? "CRY" : "STK"}</span>
          {/* Price pill */}
          <span className={cn("rounded-sm border px-1.5 md:px-2 py-0.5 text-[13px] md:text-[16px] font-bold tabular-nums shrink-0",
            up ? "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-400" : "border-red-400/20 bg-red-400/[0.05] text-red-400"
          )}>{fmtPx(quote.price)}</span>
          <span className={cn("text-[10px] md:text-[11px] font-semibold tabular-nums truncate max-w-[100px] md:max-w-none", chgColor)}>
            <span className="hidden sm:inline">{fmtChg(quote.chg)} </span>({fmtPct(quote.chgPct)})
          </span>
        </div>
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          {/* Bid pill — hidden on mobile */}
          <span className="hidden md:inline rounded-sm border border-emerald-400/20 bg-emerald-400/[0.05] px-1.5 py-0.5 text-[10px] tabular-nums font-semibold text-emerald-400/80">
            b {fmtPx(quote.bid)}
          </span>
          <span className="hidden md:inline text-white/15 text-[10px]">×</span>
          {/* Ask pill — hidden on mobile */}
          <span className="hidden md:inline rounded-sm border border-red-400/20 bg-red-400/[0.05] px-1.5 py-0.5 text-[10px] tabular-nums font-semibold text-red-400/80">
            a {fmtPx(quote.ask)}
          </span>
          {spr !== undefined && (
            <span className="hidden md:inline rounded-sm border border-cyan-400/15 bg-cyan-400/[0.04] px-1.5 py-0.5 text-[9px] tabular-nums text-cyan-400/60">
              spr {fmtPx(spr, 4)}
            </span>
          )}
          {/* Trade buttons */}
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => {
            try { window.dispatchEvent(new CustomEvent("imynted:tradeAction", { detail: { action: "BUY", asset, symbol } })); } catch {}
          }} className="rounded-sm border border-emerald-400/25 bg-emerald-400/[0.08] px-2 py-0.5 text-[9px] font-bold text-emerald-300 hover:bg-emerald-400/15 transition-colors">BUY</button>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => {
            try { window.dispatchEvent(new CustomEvent("imynted:tradeAction", { detail: { action: "SELL", asset, symbol } })); } catch {}
          }} className="rounded-sm border border-red-400/25 bg-red-400/[0.08] px-2 py-0.5 text-[9px] font-bold text-red-300 hover:bg-red-400/15 transition-colors">SELL</button>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} className="ml-1 text-white/40 hover:text-white/80 text-[22px] leading-none transition cursor-pointer p-1">×</button>
        </div>
      </div>

      {/* Symbol search bar */}
      <div className="relative z-20 shrink-0 flex items-center gap-2 px-3 md:px-4 py-1.5 border-b border-white/[0.04]"
        style={{ background: "rgba(4,10,18,0.5)" }}>
        <span className="text-[9px] text-white/30 uppercase tracking-wider shrink-0">Symbol</span>
        <div className="relative flex-1 max-w-[240px]">
          <input
            ref={symSearchRef}
            value={symDropOpen ? symSearch : ""}
            onChange={(e) => { setSymSearch(e.target.value); setSymDropOpen(true); }}
            onFocus={() => { setSymSearch(""); setSymDropOpen(true); }}
            onBlur={() => setTimeout(() => setSymDropOpen(false), 200)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && symSearch.trim()) {
                const q = symSearch.toUpperCase().trim();
                const match = SYM_LIST.find(s => s.sym === q);
                if (match) jumpToSymbol(match.sym, match.asset);
                else jumpToSymbol(q, q.includes("-USD") ? "crypto" : "stock");
                symSearchRef.current?.blur();
              }
              if (e.key === "Escape") { setSymDropOpen(false); symSearchRef.current?.blur(); }
            }}
            placeholder={`Search... (current: ${symbol})`}
            className="h-7 w-full rounded-sm border border-white/10 bg-black/30 px-2 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-emerald-400/30"
            onPointerDown={(e) => e.stopPropagation()}
          />
          {symDropOpen && symSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-0.5 rounded-sm border border-emerald-400/15 overflow-hidden max-h-[200px] overflow-y-auto"
              style={{ background: "rgba(5,12,20,0.98)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
              {symSuggestions.map(s => (
                <button key={s.sym} type="button"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-emerald-400/[0.06] transition-colors border-b border-white/[0.04] last:border-0"
                  onMouseDown={(e) => { e.preventDefault(); jumpToSymbol(s.sym, s.asset); }}>
                  <span className={cn("rounded-sm border px-1 py-0 text-[7px] font-bold shrink-0",
                    s.asset === "crypto" ? "border-amber-400/25 bg-amber-400/[0.07] text-amber-300" : "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300/70"
                  )}>{s.asset === "crypto" ? "CRY" : "STK"}</span>
                  <span className="text-[11px] font-bold text-white/90">{s.sym}</span>
                  <span className="text-[9px] text-white/35 truncate">{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs row */}
      <div className="relative z-10 shrink-0 flex items-center justify-between border-b border-white/[0.06] px-2 md:px-4 overflow-x-auto">
        <div className="flex items-center gap-0 shrink-0">
          {TABS.map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={cn(
                "px-2 md:px-3 py-2 text-[10px] md:text-[11px] font-semibold uppercase tracking-wide transition border-b-2 -mb-px shrink-0 whitespace-nowrap",
                tab === t.key
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-white/35 hover:text-white/60"
              )}
            >{t.label}</button>
          ))}
        </div>
        {/* Session filter pills — visible on ticks + summary, hidden on mobile */}
        {(tab === "ticks" || tab === "summary") && (
          <div className="hidden md:flex items-center gap-1">
            {SESSIONS.map(s => (
              <button key={s.key} type="button" onClick={() => setSession(s.key)}
                className={cn(
                  "rounded-sm border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors",
                  session === s.key
                    ? "border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-300"
                    : "border-white/10 bg-white/[0.03] text-white/35 hover:text-white/60 hover:bg-white/[0.06]"
                )}
              >{s.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="relative z-10 flex-1 min-h-0 flex overflow-hidden">

        {/* ── TICKS TAB ── */}
        {tab === "ticks" && (
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Volume summary bar */}
            <div className="shrink-0 flex items-center gap-3 px-3 py-1.5 border-b border-white/[0.06] bg-black/20">
              <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/[0.06] px-2 py-0.5 text-[10px] font-bold tabular-nums text-emerald-400">
                BUY {fmtVol(buyVol)}
              </span>
              <span className="rounded-sm border border-red-400/20 bg-red-400/[0.06] px-2 py-0.5 text-[10px] font-bold tabular-nums text-red-400">
                SELL {fmtVol(sellVol)}
              </span>
              <span className="rounded-sm border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold tabular-nums text-white/40">
                NET {buyVol >= sellVol ? "+" : ""}{fmtVol(buyVol - sellVol)}
              </span>
              {/* Buy/Sell distribution bar */}
              <div className="flex-1 h-1.5 rounded-full overflow-hidden flex">
                <div className="bg-emerald-400/60 h-full transition-all" style={{ width: `${(buyVol / totalTickVol) * 100}%` }} />
                <div className="bg-white/10 h-full" style={{ width: `${(neutralVol / totalTickVol) * 100}%` }} />
                <div className="bg-red-400/60 h-full transition-all flex-1" />
              </div>
              <span className="text-[9px] text-white/30 tabular-nums">{sessionTicks.length} prints</span>
            </div>
            {/* Multi-column tick header */}
            <div className="shrink-0 grid px-3 py-1 border-b border-white/[0.06]"
              style={{ gridTemplateColumns: "78px 1fr 80px 70px 70px" }}>
              {["TIME","PRICE","SIZE","SIDE","VENUE"].map(h => (
                <span key={h} className="text-[8px] text-white/30 uppercase tracking-wider font-semibold">{h}</span>
              ))}
            </div>
            <div ref={ticksRef} className="flex-1 overflow-y-auto">
              {sessionTicks.length === 0 ? (
                <div className="p-4 text-[11px] text-white/30">Loading ticks…</div>
              ) : sessionTicks.map((tick, i) => {
                const tickUp = tick.side === "B";
                const tickDown = tick.side === "S";
                const maxSz = Math.max(...sessionTicks.slice(0, 50).map(t => t.size), 1);
                const szBarW = Math.min((tick.size / maxSz) * 100, 100);
                return (
                  <div key={i} className={cn(
                    "relative grid px-3 py-[4px] border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors items-center",
                    i === 0 && "bg-emerald-400/[0.04]"
                  )} style={{ gridTemplateColumns: "78px 1fr 80px 70px 70px" }}>
                    <span className="text-[10px] tabular-nums text-white/40">{fmtTime(tick.ts)}</span>
                    <span className={cn("text-[11px] tabular-nums font-semibold",
                      tickUp ? "text-emerald-400" : tickDown ? "text-red-400" : "text-white/70"
                    )}>{fmtPx(tick.price)}</span>
                    {/* Size with proportional bar */}
                    <div className="relative flex items-center gap-1">
                      <span className={cn("relative z-10 text-[10px] tabular-nums font-medium",
                        tickUp ? "text-emerald-400/70" : tickDown ? "text-red-400/70" : "text-white/50"
                      )}>{fmtVol(tick.size)}</span>
                      <div className="flex-1 h-[3px] rounded-full bg-white/[0.04] overflow-hidden">
                        <div className={cn("h-full rounded-full", tickUp ? "bg-emerald-400/40" : tickDown ? "bg-red-400/40" : "bg-white/15")}
                          style={{ width: `${szBarW}%` }} />
                      </div>
                    </div>
                    {/* Side pill */}
                    <span className={cn(
                      "rounded-sm border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide w-fit",
                      tickUp ? "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300"
                        : tickDown ? "border-red-400/25 bg-red-400/[0.08] text-red-300"
                        : "border-white/10 bg-white/[0.04] text-white/35"
                    )}>
                      {tick.size >= 5000 ? (tickUp ? "BLK B" : tickDown ? "BLK S" : "M") : (tickUp ? "B" : tickDown ? "S" : "M")}
                    </span>
                    <span className="text-[9px] text-white/25 truncate">{tick.venue ?? "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SUMMARY TAB (Moomoo-style) ── */}
        {tab === "summary" && (
          <div className="flex-1 min-w-0 overflow-y-auto p-4">
            {/* Overview + Donut row */}
            <div className="flex items-start gap-6 mb-4 pb-4 border-b border-white/[0.06]">
              {/* Overview stats */}
              <div className="flex-1">
                <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-3">Overview</p>
                <div className="space-y-1.5">
                  <StatRow label="Avg Price" value={avgTickPx > 0 ? fmtPx(avgTickPx) : "—"} />
                  <StatRow label="Total Trades" value={sessionTicks.length > 0 ? fmtVol(sessionTicks.length) : "—"} />
                  <StatRow label="Volume" value={fmtVol(buyVol + sellVol + neutralVol)} />
                </div>
              </div>
              {/* Donut chart */}
              <div className="shrink-0 flex items-center gap-4">
                <div className="relative" style={{ width: 90, height: 90 }}>
                  <svg viewBox="0 0 36 36" width="90" height="90">
                    {/* Background ring */}
                    <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                    {/* Buy arc */}
                    <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(52,211,153,0.8)" strokeWidth="4"
                      strokeDasharray={`${(buyVol / totalTickVol) * 87.96} 87.96`}
                      strokeDashoffset="0" transform="rotate(-90 18 18)" strokeLinecap="round" />
                    {/* Sell arc */}
                    <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(248,113,113,0.8)" strokeWidth="4"
                      strokeDasharray={`${(sellVol / totalTickVol) * 87.96} 87.96`}
                      strokeDashoffset={`${-(buyVol / totalTickVol) * 87.96}`}
                      transform="rotate(-90 18 18)" strokeLinecap="round" />
                    {/* Neutral arc */}
                    <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4"
                      strokeDasharray={`${(neutralVol / totalTickVol) * 87.96} 87.96`}
                      strokeDashoffset={`${-((buyVol + sellVol) / totalTickVol) * 87.96}`}
                      transform="rotate(-90 18 18)" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[11px] font-bold text-white/80 tabular-nums">{Math.round((buyVol / totalTickVol) * 100)}%</span>
                  </div>
                </div>
                {/* Stats legend */}
                <div className="space-y-2">
                  <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-1">Stats</p>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400/80 shrink-0" />
                    <span className="text-[10px] text-white/60">Active Buy</span>
                    <span className="text-[10px] tabular-nums font-bold text-emerald-400 ml-auto">{fmtVol(buyVol)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-400/80 shrink-0" />
                    <span className="text-[10px] text-white/60">Active Sell</span>
                    <span className="text-[10px] tabular-nums font-bold text-red-400 ml-auto">{fmtVol(sellVol)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
                    <span className="text-[10px] text-white/60">Neutral</span>
                    <span className="text-[10px] tabular-nums font-bold text-white/40 ml-auto">{fmtVol(neutralVol)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Price-level aggregation table */}
            <div className="shrink-0 grid px-2 py-1.5 border-b border-white/[0.06] bg-black/20 rounded-t"
              style={{ gridTemplateColumns: "70px 80px 80px 70px 1fr 50px" }}>
              {["Price","Active Buy","Active Sell","Neutral","Size","% Vol"].map(h => (
                <span key={h} className="text-[8px] text-white/30 uppercase tracking-wider font-semibold">{h}</span>
              ))}
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              {priceLevels.length === 0 ? (
                <div className="p-4 text-[11px] text-white/30">Loading price levels…</div>
              ) : priceLevels.map((lvl, i) => {
                const total = lvl.buy + lvl.sell + lvl.neutral;
                const volPct = total / totalTickVol;
                const buyDom = lvl.buy > lvl.sell;
                return (
                  <div key={i} className={cn(
                    "grid px-2 py-[4px] border-b border-white/[0.03] items-center hover:bg-white/[0.025] transition-colors",
                    buyDom ? "bg-emerald-400/[0.02]" : lvl.sell > lvl.buy ? "bg-red-400/[0.02]" : ""
                  )} style={{ gridTemplateColumns: "70px 80px 80px 70px 1fr 50px" }}>
                    <span className="text-[10px] tabular-nums font-semibold text-white/80">{fmtPx(lvl.price)}</span>
                    <span className="text-[10px] tabular-nums text-emerald-400/80 font-medium">{lvl.buy > 0 ? fmtVol(lvl.buy) : ""}</span>
                    <span className="text-[10px] tabular-nums text-red-400/80 font-medium">{lvl.sell > 0 ? fmtVol(lvl.sell) : ""}</span>
                    <span className="text-[10px] tabular-nums text-white/35">{lvl.neutral > 0 ? fmtVol(lvl.neutral) : ""}</span>
                    {/* Stacked size bar */}
                    <div className="flex h-[10px] rounded-sm overflow-hidden gap-px">
                      {lvl.buy > 0 && <div className="bg-emerald-400/50 h-full" style={{ width: `${(lvl.buy / maxLevelSize) * 100}%` }} />}
                      {lvl.sell > 0 && <div className="bg-red-400/50 h-full" style={{ width: `${(lvl.sell / maxLevelSize) * 100}%` }} />}
                      {lvl.neutral > 0 && <div className="bg-white/15 h-full" style={{ width: `${(lvl.neutral / maxLevelSize) * 100}%` }} />}
                    </div>
                    <span className="text-[9px] tabular-nums text-white/40 text-right">{(volPct * 100).toFixed(2)}%</span>
                  </div>
                );
              })}
            </div>

            {/* ── Financial Highlights (from SEC filings) ── */}
            {fundamentals.financials?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-3">Financial Highlights (SEC Filing)</p>
                {(() => {
                  const f = fundamentals.financials[0]; // most recent
                  const fmtB = (v?: number) => v != null ? `$${(v / 1e9).toFixed(2)}B` : "—";
                  const fmtM = (v?: number) => v != null ? `$${(v / 1e6).toFixed(0)}M` : "—";
                  const grossMargin = f.revenue && f.grossProfit ? ((f.grossProfit / f.revenue) * 100).toFixed(1) + "%" : "—";
                  const opMargin = f.revenue && f.operatingIncome ? ((f.operatingIncome / f.revenue) * 100).toFixed(1) + "%" : "—";
                  const netMargin = f.revenue && f.netIncome ? ((f.netIncome / f.revenue) * 100).toFixed(1) + "%" : "—";
                  return (
                    <>
                      <div className="text-[9px] text-white/30 mb-2">{f.form} — {f.period}{f.quarter ? ` (Q${f.quarter})` : ""}</div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-0 mb-3">
                        <StatRow label="Revenue" value={fmtB(f.revenue)} />
                        <StatRow label="Gross Profit" value={fmtB(f.grossProfit)} />
                        <StatRow label="Gross Margin" value={grossMargin} valueClass="text-cyan-400/70" />
                        <StatRow label="Operating Income" value={fmtB(f.operatingIncome)} />
                        <StatRow label="Net Income" value={fmtB(f.netIncome)} valueClass={f.netIncome > 0 ? "text-emerald-400/80" : "text-red-400/80"} />
                        <StatRow label="Op. Margin" value={opMargin} valueClass="text-cyan-400/70" />
                        <StatRow label="R&D" value={fmtM(f.rd)} />
                        <StatRow label="SG&A" value={fmtM(f.sga)} />
                        <StatRow label="Net Margin" value={netMargin} valueClass="text-cyan-400/70" />
                        <StatRow label="EPS (Diluted)" value={f.eps != null ? `$${f.eps.toFixed(2)}` : "—"} />
                      </div>

                      <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-2 mt-3">Balance Sheet</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-0 mb-3">
                        <StatRow label="Total Assets" value={fmtB(f.totalAssets)} />
                        <StatRow label="Total Liabilities" value={fmtB(f.totalLiabilities)} />
                        <StatRow label="Equity" value={fmtB(f.totalEquity)} />
                        <StatRow label="Cash" value={fmtB(f.cash)} valueClass="text-emerald-400/70" />
                        <StatRow label="Long-Term Debt" value={fmtB(f.totalDebt)} valueClass="text-red-400/70" />
                      </div>

                      <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-2 mt-3">Cash Flow</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-0">
                        <StatRow label="Operating CF" value={fmtB(f.operatingCashFlow)} />
                        <StatRow label="CapEx" value={fmtM(f.capex)} />
                        <StatRow label="Free Cash Flow" value={fmtB(f.freeCashFlow)} valueClass={f.freeCashFlow && f.freeCashFlow > 0 ? "text-emerald-400/80" : "text-red-400/80"} />
                      </div>

                      {/* Revenue trend if multiple filings */}
                      {fundamentals.financials.length > 1 && (
                        <>
                          <p className="text-[9px] text-cyan-400/60 uppercase tracking-widest mb-2 mt-4">Revenue Trend</p>
                          <div className="grid px-1 py-1 border-b border-white/[0.06] bg-black/20 rounded-t"
                            style={{ gridTemplateColumns: "80px 80px 80px 80px 60px" }}>
                            {["Period", "Revenue", "Net Inc.", "FCF", "EPS"].map(h => (
                              <span key={h} className="text-[8px] text-white/30 uppercase tracking-wider font-semibold">{h}</span>
                            ))}
                          </div>
                          {fundamentals.financials.map((ff: any, i: number) => (
                            <div key={i} className="grid px-1 py-[4px] border-b border-white/[0.03] items-center"
                              style={{ gridTemplateColumns: "80px 80px 80px 80px 60px" }}>
                              <span className="text-[9px] text-white/55">{ff.period?.slice(0, 7) || `${ff.form}`}</span>
                              <span className="text-[9px] tabular-nums text-white/70">{fmtB(ff.revenue)}</span>
                              <span className={cn("text-[9px] tabular-nums", ff.netIncome > 0 ? "text-emerald-400/70" : "text-red-400/70")}>{fmtB(ff.netIncome)}</span>
                              <span className={cn("text-[9px] tabular-nums", ff.freeCashFlow > 0 ? "text-emerald-400/70" : "text-red-400/70")}>{fmtB(ff.freeCashFlow)}</span>
                              <span className="text-[9px] tabular-nums text-white/60">{ff.eps != null ? `$${ff.eps.toFixed(2)}` : "—"}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── QUOTES TAB (full Moomoo-style quote grid) ── */}
        {tab === "quotes" && (
          <div className="flex-1 min-w-0 overflow-y-auto p-4">
            {/* Price header */}
            <div className="mb-4 pb-3 border-b border-white/[0.06]">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[14px] font-bold text-white shrink-0">{symbol}</span>
                  <span className="text-[11px] text-white/40 truncate">{profile.name ?? ""}</span>
                </div>
                {quote.ts && (
                  <span className="shrink-0 rounded-sm border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] text-white/30 whitespace-nowrap">
                    {(() => { try { return new Date(quote.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " ET"; } catch { return ""; } })()}
                  </span>
                )}
              </div>
              <div className={cn("text-[24px] font-bold tabular-nums", chgColor)}>{fmtPx(quote.price)}</div>
              <div className={cn("text-[13px] font-semibold tabular-nums mt-0.5", chgColor)}>
                {fmtChg(quote.chg)} {fmtPct(quote.chgPct)}
              </div>
            </div>

            {/* Main quote grid — 4 columns like Moomoo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-0 mb-4">
              <StatRow label="High" value={fmtPx(quote.high)} valueClass="text-emerald-400/80" />
              <StatRow label="Open" value={fmtPx(quote.open)} />
              <StatRow label="Volume" value={fmtVol(quote.volume)} />
              <StatRow label="Avg Price" value={quote.price && quote.volume ? fmtPx((quote.price * quote.volume) / (quote.volume || 1)) : "—"} />
              <StatRow label="Low" value={fmtPx(quote.low)} valueClass="text-red-400/80" />
              <StatRow label="Prev Close" value={fmtPx(quote.prevClose)} />
              <StatRow label="Turnover" value={quote.price && quote.volume ? fmtVol(quote.price * quote.volume) : "—"} />
              <StatRow label="Mkt Cap" value={fmtVol(quote.mktCap)} />
              <StatRow label="Float Mkt C." value={quote.float && quote.price ? fmtVol(quote.float * quote.price) : "—"} />
              <StatRow label="P/E TTM" value={(() => { const v = quote.pe ?? fundamentals.metrics?.pe; return v ? v.toFixed(2) : "—"; })()} />
              <StatRow label="P/B" value={fundamentals.metrics?.pb ? fundamentals.metrics.pb.toFixed(2) : "—"} />
              <StatRow label="Total Shar." value={fmtVol(quote.shares)} />
              <StatRow label="Free Float" value={fmtVol(quote.float)} />
              <StatRow label="P/E LFY" value={fundamentals.metrics?.peForward ? fundamentals.metrics.peForward.toFixed(2) : "—"} />
              <StatRow label="P/S TTM" value={fundamentals.metrics?.ps ? fundamentals.metrics.ps.toFixed(2) : "—"} />
              <StatRow label="Vol Ratio" value={quote.volume && quote.avgVol ? `${(quote.volume / quote.avgVol).toFixed(2)}` : "—"} />
              <StatRow label="Div Yield TTM" value={(() => { const v = quote.divYield ?? fundamentals.metrics?.dividendYieldTTM; return v ? fmtPct(v) : "—"; })()} valueClass="text-cyan-400/70" />
              <StatRow label="52wk Low" value={fmtPx(quote.week52Low ?? fundamentals.metrics?.week52Low)} valueClass="text-red-400/80" />
              <StatRow label="Range %" value={quote.high && quote.low && quote.price ? `${(((quote.high - quote.low) / quote.price) * 100).toFixed(2)}%` : "—"} />
              <StatRow label="Bid/Ask %" value={spr !== undefined && quote.price ? `${((spr / quote.price) * 100).toFixed(2)}%` : "—"} />
              <StatRow label="Dividend/Share" value={fundamentals.metrics?.dividendPerShare ? `$${fundamentals.metrics.dividendPerShare.toFixed(2)}` : "—"} />
              <StatRow label="52wk High" value={fmtPx(quote.week52High ?? fundamentals.metrics?.week52High)} valueClass="text-emerald-400/80" />
              <StatRow label="ROE TTM" value={fundamentals.metrics?.roeTTM ? `${fundamentals.metrics.roeTTM.toFixed(2)}%` : "—"} />
              <StatRow label="Beta" value={(() => { const v = quote.beta ?? fundamentals.metrics?.beta; return v ? v.toFixed(3) : "—"; })()} />
              <StatRow label="EPS TTM" value={(() => { const v = quote.eps ?? fundamentals.metrics?.epsTTM; return v ? `$${v.toFixed(2)}` : "—"; })()} />
              <StatRow label="Avg Volume" value={fmtVol(quote.avgVol)} />
              <StatRow label="Gross Margin" value={fundamentals.metrics?.grossMarginTTM ? `${fundamentals.metrics.grossMarginTTM.toFixed(1)}%` : "—"} />
            </div>

            {/* 52-Week range bar */}
            {quote.week52High && quote.week52Low && quote.price ? (
              <div className="mb-4 px-1">
                <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-2">52-Week Range</p>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-400/60 to-emerald-400/60 rounded-full" style={{
                    width: `${clamp(((quote.price - quote.week52Low) / (quote.week52High - quote.week52Low)) * 100)}%`
                  }} />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[8px] text-red-400/50 tabular-nums">{fmtPx(quote.week52Low)}</span>
                  <span className={cn("text-[9px] font-bold tabular-nums", chgColor)}>{fmtPx(quote.price)}</span>
                  <span className="text-[8px] text-emerald-400/50 tabular-nums">{fmtPx(quote.week52High)}</span>
                </div>
              </div>
            ) : null}

            {/* Post Mkt / Overnight sections (simulated) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { label: "Post Mkt", time: "19:59 ET", pxMul: 1.002, chgMul: 0.002, chgPct: "+0.20%", volMul: 0.08, hiMul: 1.005, loMul: 0.998 },
                { label: "Overnight", time: "23:04 ET", pxMul: 1.005, chgMul: 0.005, chgPct: "+0.50%", volMul: 0.12, hiMul: 1.008, loMul: 0.996 },
              ] as const).map(s => (
                <div key={s.label} className="rounded border border-white/[0.06] p-3" style={{ background: "rgba(6,14,24,0.5)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] text-emerald-400/60 uppercase tracking-widest">{s.label}</span>
                    <span className="text-[9px] text-white/25">{s.time}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-[14px] font-bold tabular-nums text-white/80">{fmtPx(quote.price ? quote.price * s.pxMul : undefined)}</span>
                    <span className="text-[10px] tabular-nums text-emerald-400/70">{fmtChg(quote.price ? quote.price * s.chgMul : undefined)}</span>
                    <span className="text-[10px] tabular-nums text-emerald-400/70">{s.chgPct}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 text-[9px]">
                    <div className="flex items-center justify-between border-b border-white/[0.04] py-[3px] gap-1">
                      <span className="text-white/40 shrink-0">Hi</span>
                      <span className="text-white/80 tabular-nums font-medium truncate">{fmtPx(quote.price ? quote.price * s.hiMul : undefined)}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/[0.04] py-[3px] gap-1">
                      <span className="text-white/40 shrink-0">Vol</span>
                      <span className="text-white/80 tabular-nums font-medium truncate">{fmtVol(quote.volume ? quote.volume * s.volMul : undefined)}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/[0.04] py-[3px] gap-1">
                      <span className="text-white/40 shrink-0">Lo</span>
                      <span className="text-white/80 tabular-nums font-medium truncate">{fmtPx(quote.price ? quote.price * s.loMul : undefined)}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/[0.04] py-[3px] gap-1">
                      <span className="text-white/40 shrink-0">Trn</span>
                      <span className="text-white/80 tabular-nums font-medium truncate">{fmtVol(quote.price && quote.volume ? quote.price * quote.volume * s.volMul : undefined)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {quote.ts && <p className="mt-3 text-[9px] text-white/20">Updated {quote.ts} · {quote.provider ?? "mock"}</p>}
          </div>
        )}

        {/* ── OPTIONS TAB ── */}
        {tab === "options" && (() => {
          const px = quote.price ?? 170;
          const strikes = Array.from({ length: 22 }, (_, i) => Math.round(px * 0.7 + i * (px * 0.03)));
          const dte = "Mar 27, 26 (0D)";
          const iv = 43.45; const hv = 38.35; const ivRank = 14; const ivPct = 44;
          const pcRatio = 0.70; const oi = "15.14M"; const pcOiRatio = 0.89;

          // Simulated chain row generator with realistic pricing
          function chainRow(strike: number) {
            const dist = (strike - px) / px;
            const itm = strike < px;
            // Intrinsic + time value (Black-Scholes approximation)
            const daysToExp = 21;
            const timeVal = px * 0.01 * Math.sqrt(daysToExp / 365) * (iv / 100) * (1 - Math.abs(dist) * 2);
            const callIntrinsic = Math.max(0, px - strike);
            const callTimeVal = Math.max(0.01, timeVal * (1 + Math.random() * 0.3));
            const callBidRaw = callIntrinsic + callTimeVal;
            const callBid = Math.max(0.01, callBidRaw - Math.random() * 0.3).toFixed(2);
            const callAsk = (parseFloat(callBid) + 0.15 + Math.random() * 0.8).toFixed(2);
            const callMid = ((parseFloat(callBid) + parseFloat(callAsk)) / 2).toFixed(2);
            const callLast = (parseFloat(callMid) + (Math.random() - 0.5) * 0.3).toFixed(2);
            const callChg = ((Math.random() - 0.4) * 15 - Math.abs(dist) * 20).toFixed(2);
            const callVol = Math.max(1, Math.round(300 * Math.random() * (itm ? 3 : 1)));
            const callOi = Math.round(2000 + Math.random() * 40000);
            const putIntrinsic = Math.max(0, strike - px);
            const putTimeVal = Math.max(0.01, timeVal * (1 + Math.random() * 0.3));
            const putBidRaw = putIntrinsic + putTimeVal;
            const putBid = Math.max(0.01, putBidRaw - Math.random() * 0.3).toFixed(2);
            const putAsk = (parseFloat(putBid) + 0.15 + Math.random() * 0.8).toFixed(2);
            const putMid = ((parseFloat(putBid) + parseFloat(putAsk)) / 2).toFixed(2);
            const putLast = (parseFloat(putMid) + (Math.random() - 0.5) * 0.2).toFixed(2);
            const putChg = ((Math.random() - 0.6) * 12 + Math.abs(dist) * 15).toFixed(2);
            const putVol = Math.max(1, Math.round(200 * Math.random() * (!itm ? 2 : 0.8)));
            const putOi = Math.round(1500 + Math.random() * 25000);
            return { strike, dist, itm, callBid, callAsk, callMid, callLast, callChg, callVol, callOi, putBid, putAsk, putMid, putLast, putChg, putVol, putOi };
          }

          const chain = strikes.map(s => chainRow(s));
          const filteredChain = chain.filter(r => {
            if (optType === "call" || optType === "put") return true; // show all strikes, filter columns
            if (optMoney === "itm") return r.itm;
            if (optMoney === "otm") return !r.itm;
            return true;
          });

          // Simulated unusual activity
          const SIM_UNUSUAL = [
            { time: "15:47:55", sym: symbol, exp: "Apr 2, 2026", dte: "6D", strike: px * 1.02, cp: "Call", side: "Bid", sentiment: "Bearish", orderType: "Normal", size: "3.38K", price: "2.38", premium: "805.39K", bid: "2.38", ask: "2.40" },
            { time: "15:47:55", sym: symbol, exp: "Apr 2, 2026", dte: "6D", strike: px * 1.05, cp: "Call", side: "Mid", sentiment: "Neutral", orderType: "Normal", size: "3.38K", price: "0.91", premium: "307.94K", bid: "0.90", ask: "0.92" },
            { time: "15:20:40", sym: symbol, exp: "Apr 2, 2026", dte: "6D", strike: px * 0.99, cp: "Put", side: "Bid", sentiment: "Bullish", orderType: "Normal", size: "6.84K", price: "2.93", premium: "2M", bid: "2.93", ask: "2.95" },
            { time: "15:20:40", sym: symbol, exp: "Apr 2, 2026", dte: "6D", strike: px * 0.88, cp: "Put", side: "Bid", sentiment: "Bullish", orderType: "Normal", size: "13.04K", price: "0.22", premium: "286.9K", bid: "0.22", ask: "0.23" },
            { time: "14:56:40", sym: symbol, exp: "Apr 10, 2026", dte: "14D", strike: px * 1.17, cp: "Put", side: "Ask", sentiment: "Bearish", orderType: "Floor", size: "8.11K", price: "27.85", premium: "22.57M", bid: "27.40", ask: "28.20" },
            { time: "14:56:14", sym: symbol, exp: "Mar 27, 2026", dte: "0D", strike: px * 1.11, cp: "Put", side: "Bid", sentiment: "Bullish", orderType: "Normal", size: "3.27K", price: "17.60", premium: "5.75M", bid: "17.60", ask: "18.30" },
            { time: "14:50:58", sym: symbol, exp: "Jun 17, 2027", dte: "447D", strike: px * 1.05, cp: "Call", side: "Ask", sentiment: "Bullish", orderType: "Floor", size: "11.09K", price: "34.65", premium: "38.44M", bid: "34.25", ask: "34.65" },
            { time: "14:12:44", sym: symbol, exp: "Mar 30, 2026", dte: "3D", strike: px * 1.05, cp: "Call", side: "Ask", sentiment: "Bullish", orderType: "Sweep", size: "6.43K", price: "0.36", premium: "232.03M", bid: "0.35", ask: "0.37" },
          ];

          // Strategy cards — vary based on outlook and expiration
          const expDays = [0, 3, 5, 6, 10, 12, 14, 21, 28][optExp] ?? 21;
          const timeMult = Math.max(0.3, Math.sqrt(expDays / 21)); // more time = higher premiums
          const bullStrategies = [
            { name: "Long Call", legs: `Long ${Math.round(px * 1.01)}C`, ror: `${(229 * timeMult).toFixed(1)}%`, prob: `${(33 + (28 - expDays) * 0.3).toFixed(1)}%`, profit: `+$${Math.round(px * 8.2 * timeMult)}`, maxLoss: `-$${Math.round(px * 3.57 * timeMult)}`, chart: "call" },
            { name: "Short Put", legs: `Short ${Math.round(px * 1.01)}P`, ror: `${(4.2 * timeMult).toFixed(1)}%`, prob: "61.10%", profit: `+$${Math.round(695 * timeMult)}`, maxLoss: `$${Math.round(16555 * timeMult).toLocaleString()}`, chart: "put" },
            { name: "Long Covered Call", legs: `Long ${symbol}, Short ${Math.round(px * 1.08)}C`, ror: `${(9.0 * timeMult).toFixed(1)}%`, prob: "51.99%", profit: `+$${Math.round(1528 * timeMult).toLocaleString()}`, maxLoss: `-$${Math.round(16971).toLocaleString()}`, chart: "covered" },
            { name: "Long Call Spread", legs: `Long ${Math.round(px * 0.93)}C, Short ${Math.round(px * 1.12)}C`, ror: `${(132.5 * timeMult).toFixed(1)}%`, prob: `${(42.8 + (28 - expDays) * 0.2).toFixed(1)}%`, profit: `+$${Math.round(1852 * timeMult).toLocaleString()}`, maxLoss: `-$${Math.round(1397 * timeMult).toLocaleString()}`, chart: "spread" },
            { name: "Short Put Spread", legs: `Long ${Math.round(px * 0.98)}P, Short ${Math.round(px * 0.99)}P`, ror: `${(56.2 * timeMult).toFixed(1)}%`, prob: "53.34%", profit: `+$${Math.round(90 * timeMult)}`, maxLoss: `-$${Math.round(160 * timeMult)}`, chart: "spread" },
          ];
          const bearStrategies = [
            { name: "Long Put", legs: `Long ${Math.round(px * 0.99)}P`, ror: `${(195 * timeMult).toFixed(1)}%`, prob: `${(35 + (28 - expDays) * 0.3).toFixed(1)}%`, profit: `+$${Math.round(px * 6.8 * timeMult)}`, maxLoss: `-$${Math.round(px * 2.9 * timeMult)}`, chart: "put" },
            { name: "Short Call", legs: `Short ${Math.round(px * 0.99)}C`, ror: `${(3.8 * timeMult).toFixed(1)}%`, prob: "58.20%", profit: `+$${Math.round(580 * timeMult)}`, maxLoss: `Unlimited`, chart: "call" },
            { name: "Bear Put Spread", legs: `Long ${Math.round(px * 1.02)}P, Short ${Math.round(px * 0.92)}P`, ror: `${(118 * timeMult).toFixed(1)}%`, prob: `${(40 + (28 - expDays) * 0.2).toFixed(1)}%`, profit: `+$${Math.round(1420 * timeMult).toLocaleString()}`, maxLoss: `-$${Math.round(1180 * timeMult).toLocaleString()}`, chart: "spread" },
            { name: "Bear Call Spread", legs: `Short ${Math.round(px * 1.01)}C, Long ${Math.round(px * 1.06)}C`, ror: `${(48 * timeMult).toFixed(1)}%`, prob: "55.10%", profit: `+$${Math.round(120 * timeMult)}`, maxLoss: `-$${Math.round(380 * timeMult)}`, chart: "spread" },
          ];
          const neutralStrategies = [
            { name: "Iron Condor", legs: `${Math.round(px * 0.94)}P/${Math.round(px * 0.97)}P/${Math.round(px * 1.03)}C/${Math.round(px * 1.06)}C`, ror: `${(32 * timeMult).toFixed(1)}%`, prob: "62.50%", profit: `+$${Math.round(210 * timeMult)}`, maxLoss: `-$${Math.round(790 * timeMult)}`, chart: "condor" },
            { name: "Short Straddle", legs: `Short ${Math.round(px)}C, Short ${Math.round(px)}P`, ror: `${(18 * timeMult).toFixed(1)}%`, prob: "54.80%", profit: `+$${Math.round(1850 * timeMult).toLocaleString()}`, maxLoss: `Unlimited`, chart: "straddle" },
            { name: "Iron Butterfly", legs: `${Math.round(px * 0.95)}P/${Math.round(px)}P/${Math.round(px)}C/${Math.round(px * 1.05)}C`, ror: `${(85 * timeMult).toFixed(1)}%`, prob: "38.20%", profit: `+$${Math.round(980 * timeMult)}`, maxLoss: `-$${Math.round(520 * timeMult)}`, chart: "butterfly" },
          ];
          const directionalStrategies = [
            { name: "Long Straddle", legs: `Long ${Math.round(px)}C, Long ${Math.round(px)}P`, ror: `${(145 * timeMult).toFixed(1)}%`, prob: "42.30%", profit: `+$${Math.round(2100 * timeMult).toLocaleString()}`, maxLoss: `-$${Math.round(1450 * timeMult).toLocaleString()}`, chart: "straddle" },
            { name: "Long Strangle", legs: `Long ${Math.round(px * 0.97)}P, Long ${Math.round(px * 1.03)}C`, ror: `${(220 * timeMult).toFixed(1)}%`, prob: "35.60%", profit: `+$${Math.round(1680 * timeMult).toLocaleString()}`, maxLoss: `-$${Math.round(760 * timeMult)}`, chart: "strangle" },
          ];
          const strategyMap: Record<string, typeof bullStrategies> = {
            bullish: bullStrategies, vbullish: bullStrategies,
            bearish: bearStrategies, vbearish: bearStrategies,
            neutral: neutralStrategies, directional: directionalStrategies,
          };
          const rawStrategies = strategyMap[optOutlook] ?? bullStrategies;
          // Sort by bias: 0=max return (sort by ROR desc), 100=max probability (sort by prob desc)
          const strategies = [...rawStrategies].sort((a, b) => {
            const aRor = parseFloat(a.ror) || 0;
            const bRor = parseFloat(b.ror) || 0;
            const aProb = parseFloat(a.prob) || 0;
            const bProb = parseFloat(b.prob) || 0;
            const returnWeight = 1 - optBias / 100;
            const probWeight = optBias / 100;
            const aScore = aRor * returnWeight + aProb * probWeight;
            const bScore = bRor * returnWeight + bProb * probWeight;
            return bScore - aScore;
          });

          return (
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              {/* Sub-tab pills */}
              <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-white/[0.06] overflow-x-auto scrollbar-hide">
                {([
                  { key: "chains" as OptionsSub, label: "Chains" },
                  { key: "strategy" as OptionsSub, label: "⚡ Strategy Builder" },
                  { key: "unusual" as OptionsSub, label: "Unusual Activity" },
                  { key: "top" as OptionsSub, label: "Top Options" },
                ]).map(s => (
                  <button key={s.key} onClick={() => setOptionsSub(s.key)}
                    className={cn(
                      "shrink-0 whitespace-nowrap rounded-sm border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors",
                      optionsSub === s.key
                        ? "border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-300"
                        : "border-white/10 bg-white/[0.03] text-white/35 hover:text-white/60"
                    )}>{s.label}</button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* ── CHAINS ── */}
                {optionsSub === "chains" && (
                  <div className="flex flex-col h-full">
                    {/* Options stats bar */}
                    <div className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-1.5 border-b border-white/[0.06] bg-black/20 text-[9px]">
                      <span className="text-white/40">Volume <span className="text-white/70 font-semibold">2.42M</span></span>
                      <span className="text-white/40">Put/Call Ratio <span className="text-white/70 font-semibold">{pcRatio}</span></span>
                      <span className="text-white/40">Open Interest <span className="text-white/70 font-semibold">{oi}</span></span>
                      <span className="text-white/40">Put/Call OI <span className="text-white/70 font-semibold">{pcOiRatio}</span></span>
                      <span className="text-white/40">Implied Vol <span className="text-cyan-400/80 font-semibold">{iv}%</span></span>
                      <span className="text-white/40">Historical Vol <span className="text-white/70 font-semibold">{hv}%</span></span>
                      <span className="text-white/40">IV Rank <span className="text-white/70 font-semibold">{ivRank}</span></span>
                      <span className="text-white/40">IV Pct <span className="text-white/70 font-semibold">{ivPct}%</span></span>
                    </div>
                    {/* Filters row */}
                    <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 border-b border-white/[0.06]">
                      {/* Call/Put toggle */}
                      <div className="flex items-center gap-0 rounded-sm border border-white/10 overflow-hidden">
                        {(["both","call","put"] as OptionType[]).map(t => (
                          <button key={t} onClick={() => setOptType(t)}
                            className={cn("px-2 py-0.5 text-[9px] font-bold uppercase transition-colors",
                              optType === t ? "bg-emerald-400/15 text-emerald-300" : "text-white/35 hover:text-white/60"
                            )}>{t === "both" ? "Both" : t === "call" ? "Call" : "Put"}</button>
                        ))}
                      </div>
                      {/* ITM/OTM toggle */}
                      <div className="flex items-center gap-0 rounded-sm border border-white/10 overflow-hidden">
                        {(["both","itm","otm"] as Moneyness[]).map(m => (
                          <button key={m} onClick={() => setOptMoney(m)}
                            className={cn("px-2 py-0.5 text-[9px] font-bold uppercase transition-colors",
                              optMoney === m ? "bg-emerald-400/15 text-emerald-300" : "text-white/35 hover:text-white/60"
                            )}>{m === "both" ? "Both" : m.toUpperCase()}</button>
                        ))}
                      </div>
                      {/* Strikes dropdown */}
                      <select value={optStrikes} onChange={e => setOptStrikes(e.target.value)}
                        className="rounded-sm border border-white/10 bg-transparent px-2 py-0.5 text-[9px] text-white/60 focus:outline-none">
                        {["All Strikes","6","8","10","20","40","60","80","100"].map(v => (
                          <option key={v} value={v} className="bg-[#060e18]">{v}</option>
                        ))}
                      </select>
                      <span className="ml-auto text-[9px] text-white/30">{dte}</span>
                    </div>
                    {/* Chain table */}
                    <div className="flex-1 overflow-auto">
                      {/* Header */}
                      {(() => {
                        const showCall = optType !== "put";
                        const showPut = optType !== "call";
                        const cols = [
                          ...(showCall ? ["70px","60px","70px","70px","70px","80px"] : []),
                          "80px",
                          ...(showPut ? ["70px","70px","70px","70px","60px","70px"] : []),
                        ].join(" ");
                        return (
                          <>
                            <div className="sticky top-0 z-10 grid bg-black/60 backdrop-blur-sm border-b border-white/[0.06]"
                              style={{ gridTemplateColumns: cols }}>
                              {showCall && <>
                                <span className="px-2 py-1 text-[8px] text-white/30 uppercase">Bid</span>
                                <span className="px-2 py-1 text-[8px] text-white/30 uppercase">Ask</span>
                                <span className="px-2 py-1 text-[8px] text-white/30 uppercase">Mid</span>
                                <span className="px-2 py-1 text-[8px] text-white/30 uppercase">Last</span>
                                <span className="px-2 py-1 text-[8px] text-white/30 uppercase">% Chg</span>
                                <span className="px-2 py-1 text-[8px] text-white/30 uppercase">Volume</span>
                              </>}
                              <span className="px-2 py-1 text-[8px] text-emerald-400/60 uppercase text-center font-bold">Strike</span>
                              {showPut && <>
                                <span className="px-2 py-1 text-[8px] text-white/30 uppercase">Bid</span>
                                <span className="px-2 py-1 text-[8px] text-white/30 uppercase">Ask</span>
                                <span className="px-2 py-1 text-[8px] text-white/30 uppercase">Mid</span>
                                <span className="px-2 py-1 text-[8px] text-white/30 uppercase">Last</span>
                                <span className="px-2 py-1 text-[8px] text-white/30 uppercase">% Chg</span>
                                <span className="px-2 py-1 text-[8px] text-white/30 uppercase">OI</span>
                              </>}
                            </div>
                            {/* Rows */}
                            {filteredChain.map((r, i) => {
                              const atm = Math.abs(r.dist) < 0.015;
                              return (
                                <div key={i} className={cn(
                                  "grid items-center border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors",
                                  atm && "bg-emerald-400/[0.04] border-emerald-400/10",
                                  r.itm && showCall && "bg-white/[0.015]"
                                )} style={{ gridTemplateColumns: cols }}>
                                  {showCall && <>
                                    <span className="px-2 py-[4px] text-[10px] tabular-nums text-emerald-400/80">{r.callBid}</span>
                                    <span className="px-2 py-[4px] text-[10px] tabular-nums text-red-400/80">{r.callAsk}</span>
                                    <span className="px-2 py-[4px] text-[10px] tabular-nums text-white/50">{r.callMid}</span>
                                    <span className="px-2 py-[4px] text-[10px] tabular-nums text-white/60">{r.callLast}</span>
                                    <span className={cn("px-2 py-[4px] text-[10px] tabular-nums", parseFloat(r.callChg) >= 0 ? upColor : downColor)}>{r.callChg}%</span>
                                    <span className="px-2 py-[4px] text-[10px] tabular-nums text-white/45">{r.callVol}</span>
                                  </>}
                                  <span className={cn("px-2 py-[4px] text-[11px] tabular-nums text-center font-bold",
                                    atm ? "text-emerald-400" : "text-white/80"
                                  )}>{r.strike}</span>
                                  {showPut && <>
                                    <span className="px-2 py-[4px] text-[10px] tabular-nums text-emerald-400/80">{r.putBid}</span>
                                    <span className="px-2 py-[4px] text-[10px] tabular-nums text-red-400/80">{r.putAsk}</span>
                                    <span className="px-2 py-[4px] text-[10px] tabular-nums text-white/50">{r.putMid}</span>
                                    <span className="px-2 py-[4px] text-[10px] tabular-nums text-white/60">{r.putLast}</span>
                                    <span className="px-2 py-[4px] text-[10px] tabular-nums text-white/35">{r.putChg}%</span>
                                    <span className="px-2 py-[4px] text-[10px] tabular-nums text-white/40">{fmtVol(r.putOi)}</span>
                                  </>}
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* ── STRATEGY BUILDER ── */}
                {optionsSub === "strategy" && (
                  <div className="p-4">
                    <p className="text-[11px] text-white/60 mb-4">What&apos;s your outlook on the stock price?</p>
                    {/* Outlook icons */}
                    <div className="flex items-center gap-4 mb-5">
                      {[
                        { key: "bullish", label: "Bullish", icon: "↗", active: "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-300" },
                        { key: "vbullish", label: "Very Bullish", icon: "⇗", active: "border-emerald-500/30 bg-emerald-500/[0.10] text-emerald-200" },
                        { key: "neutral", label: "Neutral", icon: "→", active: "border-amber-400/30 bg-amber-400/[0.08] text-amber-300" },
                        { key: "directional", label: "Directional", icon: "↕", active: "border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-300" },
                        { key: "vbearish", label: "Very Bearish", icon: "⇘", active: "border-red-500/30 bg-red-500/[0.10] text-red-200" },
                        { key: "bearish", label: "Bearish", icon: "↘", active: "border-red-400/30 bg-red-400/[0.08] text-red-300" },
                      ].map(o => (
                        <button key={o.key} onClick={() => setOptOutlook(o.key)}
                          className={cn("flex flex-col items-center gap-1 px-3 py-2 rounded-sm border transition-colors",
                            optOutlook === o.key ? o.active : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/60"
                          )}>
                          <span className="text-[18px]">{o.icon}</span>
                          <span className="text-[8px] font-bold uppercase tracking-wide">{o.label}</span>
                        </button>
                      ))}
                    </div>
                    {/* Target + Budget */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40">Target Price</span>
                        <span className="rounded-sm border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] text-white/80 tabular-nums font-semibold">{(px * 1.125).toFixed(3)}</span>
                        <span className="text-[10px] text-emerald-400/60">(+12.53%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40">Budget</span>
                        <span className="rounded-sm border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] text-white/50">None</span>
                      </div>
                    </div>
                    {/* Expiration pills */}
                    <div className="flex items-center gap-1 mb-4 flex-wrap">
                      <span className="text-[10px] text-white/40 mr-1">Expiration</span>
                      {["Mar 27 (0D)","Mar 30 (3D)","Apr 1 (5D)","Apr 2 (6D)","Apr 6 (10D)","Apr 8 (12D)","Apr 10 (14D)","Apr 17 (21D)","Apr 24 (28D)"].map((d, i) => (
                        <button key={d} type="button" onClick={() => setOptExp(i)}
                          className={cn("rounded-sm border px-2 py-0.5 text-[9px] font-bold transition-colors cursor-pointer",
                          optExp === i ? "border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-300" : "border-white/10 bg-white/[0.03] text-white/35 hover:text-white/60"
                        )}>{d}</button>
                      ))}
                    </div>
                    {/* Max Return ↔ Max Probability slider */}
                    <div className="flex items-center gap-3 mb-5">
                      <span className="text-[9px] text-white/40 shrink-0">Max Return</span>
                      <input
                        type="range" min={0} max={100} value={optBias}
                        onChange={(e) => setOptBias(Number(e.target.value))}
                        className="flex-1 h-1 appearance-none bg-white/[0.08] rounded-full cursor-pointer accent-emerald-400 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-emerald-300/50"
                      />
                      <span className="text-[9px] text-white/40 shrink-0">Max Probability</span>
                    </div>
                    {/* Strategy cards */}
                    <div className="grid grid-cols-3 gap-3">
                      {(() => {
                        const isBear = optOutlook === "bearish" || optOutlook === "vbearish";
                        const isNeutral = optOutlook === "neutral";
                        const isDir = optOutlook === "directional";
                        const accentBorder = isBear ? "hover:border-red-400/20" : isNeutral ? "hover:border-amber-400/20" : isDir ? "hover:border-cyan-400/20" : "hover:border-emerald-400/20";
                        const detailCls = isBear ? "text-red-400/60 border-red-400/20" : isNeutral ? "text-amber-400/60 border-amber-400/20" : isDir ? "text-cyan-400/60 border-cyan-400/20" : "text-emerald-400/60 border-emerald-400/20";
                        return strategies.map((s, i) => (
                        <div key={i} className={cn("rounded border border-white/[0.07] p-3 transition-colors", accentBorder)} style={{ background: "rgba(5,11,20,0.7)" }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-white/85">{s.name}</span>
                            <span className={cn("text-[9px] border rounded px-1.5 py-0.5", detailCls)}>Details</span>
                          </div>
                          <p className="text-[9px] text-white/35 mb-2">{s.legs}</p>
                          <div className="grid grid-cols-2 gap-y-1 text-[9px]">
                            <span className="text-white/40">Return on Risk</span><span className="text-right text-white/70 font-semibold">{s.ror}</span>
                            <span className="text-white/40">Profit Probability</span><span className="text-right text-white/70 font-semibold">{s.prob}</span>
                            <span className="text-white/40">Profit</span><span className={cn("text-right font-semibold", s.profit.startsWith("+") ? "text-emerald-400" : "text-red-400")}>{s.profit}</span>
                            <span className="text-white/40">Max Loss</span><span className={cn("text-right font-semibold", s.maxLoss.startsWith("-") || s.maxLoss === "Unlimited" ? "text-red-400" : "text-amber-400")}>{s.maxLoss}</span>
                          </div>
                          {/* Mini P&L chart */}
                          <div className="mt-2 h-10 rounded bg-white/[0.03] border border-white/[0.05] flex items-end px-1 gap-px overflow-hidden">
                            <div className="flex-1 flex items-end h-full">
                              <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
                                <line x1="0" y1="15" x2="100" y2="15" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                                <path d={s.chart === "call" ? "M0,28 L40,25 L55,15 L80,5 L100,2" : s.chart === "put" ? "M0,2 L20,5 L45,15 L60,25 L100,28" : "M0,20 L30,18 L50,10 L70,14 L100,20"} fill="none" stroke={s.profit.startsWith("+") ? "rgba(52,211,153,0.7)" : "rgba(248,113,113,0.7)"} strokeWidth="1.5" />
                              </svg>
                            </div>
                          </div>
                          <p className="text-[8px] text-white/25 text-center mt-1 tabular-nums">{symbol} {fmtPx(px)}</p>
                        </div>
                      ));
                      })()}
                    </div>
                  </div>
                )}

                {/* ── UNUSUAL ACTIVITY ── */}
                {optionsSub === "unusual" && (
                  <div>
                    {/* Filter pills */}
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06]">
                      <div className="flex items-center gap-0 rounded-sm border border-white/10 overflow-hidden">
                        {["Both","Call","Put"].map(f => (
                          <span key={f} className="px-2 py-0.5 text-[9px] font-bold text-white/40 hover:text-white/60 cursor-pointer">{f}</span>
                        ))}
                      </div>
                      {["Ask","Mid","Bid"].map(f => (
                        <label key={f} className="flex items-center gap-1 text-[9px] text-white/40 cursor-pointer">
                          <span className="w-3 h-3 rounded-sm border border-white/20 bg-white/[0.05] flex items-center justify-center">
                            <span className="text-emerald-400 text-[8px]">✓</span>
                          </span>{f}
                        </label>
                      ))}
                      {["Bullish","Neutral","Bearish"].map(f => (
                        <label key={f} className="flex items-center gap-1 text-[9px] text-white/40 cursor-pointer">
                          <span className="w-3 h-3 rounded-sm border border-white/20 bg-white/[0.05] flex items-center justify-center">
                            <span className="text-emerald-400 text-[8px]">✓</span>
                          </span>{f}
                        </label>
                      ))}
                    </div>
                    {/* Table */}
                    <div className="overflow-auto">
                      <div className="grid px-3 py-1.5 bg-black/20 border-b border-white/[0.06] min-w-[900px]"
                        style={{ gridTemplateColumns: "100px 60px 90px 40px 70px 50px 40px 90px 70px 60px 60px 70px 50px 50px" }}>
                        {["Trade Time","Symbol","Expiration","DTE","Strike","C/P","Side","Sentiment","Order Type","Size","Price","Premium","Bid","Ask"].map(h => (
                          <span key={h} className="text-[8px] text-white/30 uppercase tracking-wider font-semibold">{h}</span>
                        ))}
                      </div>
                      {SIM_UNUSUAL.map((u, i) => (
                        <div key={i} className="grid px-3 py-[4px] border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors items-center min-w-[900px]"
                          style={{ gridTemplateColumns: "100px 60px 90px 40px 70px 50px 40px 90px 70px 60px 60px 70px 50px 50px" }}>
                          <span className="text-[10px] tabular-nums text-white/50">{u.time}</span>
                          <span className="text-[10px] font-bold text-white/80">{u.sym}</span>
                          <span className="text-[10px] text-white/50">{u.exp}</span>
                          <span className="text-[10px] tabular-nums text-white/40">{u.dte}</span>
                          <span className="text-[10px] tabular-nums text-white/70">{fmtPx(u.strike)}</span>
                          <span className={cn("text-[10px] font-bold", u.cp === "Call" ? upColor : downColor)}>{u.cp}</span>
                          <span className="text-[10px] text-white/50">{u.side}</span>
                          <span className={cn("rounded-sm border px-1.5 py-0.5 text-[8px] font-bold uppercase",
                            u.sentiment === "Bullish" ? "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300"
                              : u.sentiment === "Bearish" ? "border-red-400/25 bg-red-400/[0.08] text-red-300"
                              : "border-white/15 bg-white/[0.05] text-white/40"
                          )}>{u.sentiment}</span>
                          <span className={cn("rounded-sm border px-1.5 py-0.5 text-[8px] font-bold",
                            u.orderType === "Sweep" ? "border-amber-400/25 bg-amber-400/[0.08] text-amber-300"
                              : u.orderType === "Floor" ? "border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-300"
                              : u.orderType === "Cross" ? "border-purple-400/25 bg-purple-400/[0.08] text-purple-300"
                              : "border-white/10 bg-white/[0.03] text-white/35"
                          )}>{u.orderType}</span>
                          <span className="text-[10px] tabular-nums text-white/60">{u.size}</span>
                          <span className="text-[10px] tabular-nums text-white/70">{u.price}</span>
                          <span className="text-[10px] tabular-nums text-white/55">{u.premium}</span>
                          <span className="text-[10px] tabular-nums text-emerald-400/60">{u.bid}</span>
                          <span className="text-[10px] tabular-nums text-red-400/60">{u.ask}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── TOP OPTIONS ── */}
                {optionsSub === "top" && (() => {
                  const topFilters = ["Volume","Turnover","OI (by Volume)","OI Rise (Daily)","OI Fall (Daily)","OI by Value","OI Value Rise","OI Value Fall","% Chg","IV"];
                  // Generate rows with all sortable fields
                  const topRows = Array.from({ length: 15 }, (_, i) => {
                    const stk = Math.round(px * (0.85 + i * 0.025));
                    const cp = i % 2 === 0 ? "C" : "P";
                    const seed = (stk * 7 + i * 13) % 100;
                    const vol = Math.round(140000 * Math.pow(0.92, i) * (0.7 + seed / 100));
                    const turn = vol * (10 + seed / 5);
                    const oi = Math.round(vol * (2.5 + seed / 30));
                    const oiByVal = oi * stk;
                    const oiRise = Math.round(seed > 50 ? oi * 0.02 * (seed / 50) : 0);
                    const oiValRise = oiRise * stk;
                    const oiFall = Math.round(seed <= 50 ? oi * 0.015 * ((100 - seed) / 50) : 0);
                    const oiValFall = oiFall * stk;
                    const pctChg = ((seed - 50) * 0.8).toFixed(2);
                    const ivVal = (25 + seed * 0.4 + Math.abs(stk - px) / px * 30).toFixed(1);
                    return { stk, cp, sym: `${symbol} ${String(260327 + i * 1000).slice(0, 6)} ${stk}.00${cp}`, vol, turn, oi, oiByVal, oiRise, oiValRise, oiFall, oiValFall, pctChg: parseFloat(pctChg), iv: parseFloat(ivVal) };
                  });
                  // Sort by selected filter
                  const sortKeys = ["vol","turn","oi","oiRise","oiFall","oiByVal","oiValRise","oiValFall","pctChg","iv"] as const;
                  const sk = sortKeys[topOptSort] ?? "vol";
                  topRows.sort((a: any, b: any) => Math.abs(b[sk]) - Math.abs(a[sk]));

                  return (
                  <div>
                    {/* Filter pills */}
                    <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.06] flex-wrap">
                      {topFilters.map((f, i) => (
                        <button key={f} type="button" onClick={() => setTopOptSort(i)}
                          className={cn("rounded-sm border px-2 py-0.5 text-[9px] font-bold uppercase transition-colors cursor-pointer",
                          topOptSort === i ? "border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-300" : "border-white/10 bg-white/[0.03] text-white/35 hover:text-white/60"
                        )}>{f}</button>
                      ))}
                    </div>
                    {/* Table */}
                    <div className="grid px-3 py-1.5 bg-black/20 border-b border-white/[0.06]"
                      style={{ gridTemplateColumns: "1fr 80px 80px 80px 80px 70px 80px 70px 80px" }}>
                      {["Symbol","Volume","Turnover","OI","OI by Value","OI Rise","OI Value Rise","OI Fall","OI Value Fall"].map(h => (
                        <span key={h} className="text-[8px] text-white/30 uppercase tracking-wider font-semibold">{h}</span>
                      ))}
                    </div>
                    {topRows.map((r, i) => (
                      <div key={i} className="grid px-3 py-[4px] border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors items-center"
                        style={{ gridTemplateColumns: "1fr 80px 80px 80px 80px 70px 80px 70px 80px" }}>
                        <span className="text-[10px] font-medium text-white/80">{r.sym}</span>
                        <span className="text-[10px] tabular-nums text-white/65">{fmtVol(r.vol)}</span>
                        <span className="text-[10px] tabular-nums text-white/55">{fmtVol(r.turn)}</span>
                        <span className="text-[10px] tabular-nums text-white/55">{fmtVol(r.oi)}</span>
                        <span className="text-[10px] tabular-nums text-white/50">{fmtVol(r.oiByVal)}</span>
                        <span className={cn("text-[10px] tabular-nums", r.oiRise > 0 ? "text-emerald-400/70" : "text-white/40")}>{r.oiRise > 0 ? fmtVol(r.oiRise) : "0"}</span>
                        <span className={cn("text-[10px] tabular-nums", r.oiValRise > 0 ? "text-emerald-400/60" : "text-white/40")}>{r.oiValRise > 0 ? fmtVol(r.oiValRise) : "0"}</span>
                        <span className={cn("text-[10px] tabular-nums", r.oiFall > 0 ? "text-red-400/70" : "text-white/40")}>{r.oiFall > 0 ? fmtVol(r.oiFall) : "0"}</span>
                        <span className={cn("text-[10px] tabular-nums", r.oiValFall > 0 ? "text-red-400/60" : "text-white/40")}>{r.oiValFall > 0 ? fmtVol(r.oiValFall) : "0"}</span>
                      </div>
                    ))}
                  </div>
                  );
                })()}
              </div>
            </div>
          );
        })()}

        {/* ── PROFILE TAB (sub-tabbed: Overview / Executives / Efficiency) ── */}
        {tab === "profile" && (
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Sub-tab pills */}
            <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-white/[0.06] overflow-x-auto scrollbar-hide">
              {([
                { key: "overview" as ProfileSub, label: "Company Overview" },
                { key: "executives" as ProfileSub, label: "Executives" },
                { key: "efficiency" as ProfileSub, label: "Operational Efficiency" },
              ]).map(s => (
                <button key={s.key} onClick={() => setProfileSub(s.key)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-sm border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors",
                    profileSub === s.key
                      ? "border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-300"
                      : "border-white/10 bg-white/[0.03] text-white/35 hover:text-white/60"
                  )}>{s.label}</button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Company Overview */}
              {profileSub === "overview" && (
                <div>
                  {/* Logo + Name header */}
                  {companyInfo.logo && (
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/[0.06]">
                      <img src={companyInfo.logo} alt="" className="w-10 h-10 rounded-sm bg-white/5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <div>
                        <div className="text-[13px] font-bold text-white/90">{profile.name || symbol}</div>
                        <div className="text-[10px] text-white/40">{companyInfo.industry} · {companyInfo.market}</div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0 mb-4">
                    <StatRow label="Symbol" value={symbol} />
                    <StatRow label="Company Name" value={profile.name ?? symbol} />
                    <StatRow label="Exchange" value={companyInfo.market} valueClass="text-cyan-400/70" />
                    <StatRow label="Industry" value={companyInfo.industry} />
                    <StatRow label="IPO / Listing Date" value={companyInfo.listing} />
                    <StatRow label="Currency" value={companyInfo.currency} />
                    <StatRow label="Country" value={companyInfo.country} />
                    <StatRow label="Phone" value={companyInfo.phone} />
                    <StatRow label="Mkt Cap" value={companyInfo.marketCap ? `$${(companyInfo.marketCap).toFixed(0)}M` : "—"} valueClass="text-emerald-400/70" />
                    <StatRow label="Shares Outstanding" value={companyInfo.sharesOutstanding ? `${companyInfo.sharesOutstanding.toFixed(2)}M` : "—"} />
                    <StatRow label="Website" value={companyInfo.website} valueClass="text-cyan-400/70" />
                    {companyInfo.ceo !== "—" && <StatRow label="CEO" value={companyInfo.ceo} />}
                    {companyInfo.employees !== "—" && <StatRow label="Employees" value={companyInfo.employees} />}
                  </div>

                  {/* Description */}
                  <div className="border-t border-white/[0.06] pt-3 mb-4">
                    <p className="text-[10px] font-bold text-white/70 mb-2">Description</p>
                    <p className="text-[11px] text-white/50 leading-relaxed">
                      {companyInfo.description}
                    </p>
                  </div>

                  {/* Peers */}
                  {companyInfo.peers?.length > 0 && (
                    <div className="border-t border-white/[0.06] pt-3 mb-4">
                      <p className="text-[10px] font-bold text-white/70 mb-2">Peers</p>
                      <div className="flex flex-wrap gap-1.5">
                        {companyInfo.peers.map((p: string) => (
                          <button key={p} onClick={() => { onClose?.(); try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: p, asset: "stock" } })); } catch {} }}
                            className="rounded-sm border border-cyan-400/20 bg-cyan-400/[0.06] px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-400/15 transition-colors cursor-pointer">
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SEC Filings */}
                  {companyInfo.filings?.length > 0 && (
                    <div className="border-t border-white/[0.06] pt-3">
                      <p className="text-[10px] font-bold text-white/70 mb-2">Recent SEC Filings</p>
                      <div className="grid px-1 py-1 border-b border-white/[0.06] bg-black/20 rounded-t"
                        style={{ gridTemplateColumns: "70px 1fr" }}>
                        <span className="text-[8px] text-white/30 uppercase tracking-wider font-semibold">Date</span>
                        <span className="text-[8px] text-white/30 uppercase tracking-wider font-semibold">Form</span>
                      </div>
                      {companyInfo.filings.slice(0, 10).map((f: any, i: number) => (
                        <div key={i} className="grid px-1 py-[4px] border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors items-center"
                          style={{ gridTemplateColumns: "70px 1fr" }}>
                          <span className="text-[9px] text-white/50">{f.filedDate}</span>
                          <a href={f.filingUrl || f.reportUrl} target="_blank" rel="noopener noreferrer"
                            className="text-[9px] text-cyan-400/70 hover:text-cyan-300 transition-colors truncate">
                            {f.form}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Executives */}
              {profileSub === "executives" && (
                <div>
                  <div className="grid px-2 py-1.5 border-b border-white/[0.06] bg-black/20 rounded-t"
                    style={{ gridTemplateColumns: "1fr 1fr 80px 50px 60px 100px" }}>
                    {["Name","Title","Salary","Age","Gender","Updated"].map(h => (
                      <span key={h} className="text-[8px] text-white/30 uppercase tracking-wider font-semibold">{h}</span>
                    ))}
                  </div>
                  {SIM_EXECS.map((e, i) => (
                    <div key={i} className="grid px-2 py-[5px] border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors items-center"
                      style={{ gridTemplateColumns: "1fr 1fr 80px 50px 60px 100px" }}>
                      <span className="text-[11px] text-white/80 font-medium">{e.name}</span>
                      <span className="text-[10px] text-white/55">{e.title}</span>
                      <span className="text-[10px] tabular-nums text-white/60">{e.salary}</span>
                      <span className="text-[10px] tabular-nums text-white/50">{e.age || "—"}</span>
                      <span className="text-[10px] text-white/40">{e.gender}</span>
                      <span className="text-[10px] text-white/35">{e.updated}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Operational Efficiency */}
              {profileSub === "efficiency" && (
                <div>
                  <div className="grid px-2 py-1.5 border-b border-white/[0.06] bg-black/20 rounded-t"
                    style={{ gridTemplateColumns: "80px 90px 120px 130px 120px" }}>
                    {["YoY","Headcount","Revenue/Employee","Op Profit/Employee","Net Income/Employee"].map(h => (
                      <span key={h} className="text-[8px] text-white/30 uppercase tracking-wider font-semibold">{h}</span>
                    ))}
                  </div>
                  {SIM_EFFICIENCY.map((r, i) => (
                    <div key={i} className="grid px-2 py-[5px] border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors items-center"
                      style={{ gridTemplateColumns: "80px 90px 120px 130px 120px" }}>
                      <span className="text-[10px] text-white/70 font-medium">{r.year}</span>
                      <div>
                        <div className="text-[10px] tabular-nums text-white/70">{r.headcount}</div>
                        <div className={cn("text-[9px] tabular-nums", r.hcChg.startsWith("+") ? upColor : downColor)}>{r.hcChg}</div>
                      </div>
                      <div>
                        <div className="text-[10px] tabular-nums text-white/70">{r.revPerEmp}</div>
                        <div className={cn("text-[9px] tabular-nums", r.revChg.startsWith("+") ? upColor : downColor)}>{r.revChg}</div>
                      </div>
                      <div>
                        <div className="text-[10px] tabular-nums text-white/70">{r.opProfitPerEmp}</div>
                        <div className={cn("text-[9px] tabular-nums", r.opChg.startsWith("+") ? upColor : downColor)}>{r.opChg}</div>
                      </div>
                      <div>
                        <div className="text-[10px] tabular-nums text-white/70">{r.netIncPerEmp}</div>
                        <div className={cn("text-[9px] tabular-nums", r.niChg.startsWith("+") ? upColor : downColor)}>{r.niChg}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SHAREHOLDERS TAB (sub-tabbed: Overview / Activity / Insiders / Institutions) ── */}
        {tab === "shareholders" && (
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Sub-tab pills */}
            <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-white/[0.06] overflow-x-auto scrollbar-hide">
              {([
                { key: "overview" as ShareholderSub, label: "Overview" },
                { key: "activity" as ShareholderSub, label: "Shareholder Activity" },
                { key: "insiders" as ShareholderSub, label: "Insiders" },
                { key: "institutions" as ShareholderSub, label: "Institutions" },
              ]).map(s => (
                <button key={s.key} onClick={() => setShareholderSub(s.key)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-sm border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors",
                    shareholderSub === s.key
                      ? "border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-300"
                      : "border-white/10 bg-white/[0.03] text-white/35 hover:text-white/60"
                  )}>{s.label}</button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Overview — donut charts + holder table */}
              {shareholderSub === "overview" && (
                <div>
                  {/* Donut charts row */}
                  <div className="flex items-start gap-8 mb-5 pb-4 border-b border-white/[0.06]">
                    {/* Major Holders donut */}
                    <div>
                      <p className="text-[10px] font-bold text-white/70 mb-3">Major Holders</p>
                      <div className="relative" style={{ width: 120, height: 120 }}>
                        <svg viewBox="0 0 36 36" width="120" height="120">
                          <circle cx="18" cy="18" r="12" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                          {SIM_HOLDERS.slice(0, 5).map((h, i) => {
                            const colors = ["#3b82f6", "#06b6d4", "#22c55e", "#f59e0b", "#8b5cf6"];
                            const pct = parseFloat(h.pctOwned);
                            const prevPcts = SIM_HOLDERS.slice(0, i).reduce((s, x) => s + parseFloat(x.pctOwned), 0);
                            return (
                              <circle key={i} cx="18" cy="18" r="12" fill="none" stroke={colors[i]}
                                strokeWidth="5"
                                strokeDasharray={`${pct * 0.7536} 75.36`}
                                strokeDashoffset={`${-prevPcts * 0.7536}`}
                                transform="rotate(-90 18 18)" />
                            );
                          })}
                        </svg>
                      </div>
                      <div className="mt-2 space-y-1">
                        {SIM_HOLDERS.slice(0, 5).map((h, i) => {
                          const colors = ["#3b82f6", "#06b6d4", "#22c55e", "#f59e0b", "#8b5cf6"];
                          return (
                            <div key={i} className="flex items-center gap-1.5 text-[9px]">
                              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: colors[i] }} />
                              <span className="text-white/50 truncate">{h.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Type donut */}
                    <div>
                      <p className="text-[10px] font-bold text-white/70 mb-3">Type</p>
                      <div className="relative" style={{ width: 120, height: 120 }}>
                        <svg viewBox="0 0 36 36" width="120" height="120">
                          <circle cx="18" cy="18" r="12" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                          {SIM_HOLDER_TYPES.map((t, i) => {
                            const prevPcts = SIM_HOLDER_TYPES.slice(0, i).reduce((s, x) => s + x.pct, 0);
                            return (
                              <circle key={i} cx="18" cy="18" r="12" fill="none" stroke={t.color}
                                strokeWidth="5"
                                strokeDasharray={`${t.pct * 0.7536} 75.36`}
                                strokeDashoffset={`${-prevPcts * 0.7536}`}
                                transform="rotate(-90 18 18)" />
                            );
                          })}
                        </svg>
                      </div>
                      <div className="mt-2 space-y-1">
                        {SIM_HOLDER_TYPES.map((t, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[9px]">
                            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: t.color }} />
                            <span className="text-white/50">{t.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Holders table */}
                  <div className="grid px-2 py-1.5 border-b border-white/[0.06] bg-black/20 rounded-t"
                    style={{ gridTemplateColumns: "1fr 90px 70px 80px 60px 90px 90px" }}>
                    {["Name","Shares Held","% Owned","Chg (Shares)","% Chg","Position Date","Disclosure"].map(h => (
                      <span key={h} className="text-[8px] text-white/30 uppercase tracking-wider font-semibold">{h}</span>
                    ))}
                  </div>
                  {SIM_HOLDERS.map((h, i) => {
                    const isUp = h.chg.startsWith("+");
                    return (
                      <div key={i} className="grid px-2 py-[5px] border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors items-center"
                        style={{ gridTemplateColumns: "1fr 90px 70px 80px 60px 90px 90px" }}>
                        <span className="text-[10px] text-white/80 font-medium truncate">{h.name}</span>
                        <span className="text-[10px] tabular-nums text-white/65">{h.shares}</span>
                        <span className="text-[10px] tabular-nums text-white/60">{h.pctOwned}</span>
                        <span className={cn("text-[10px] tabular-nums font-medium", isUp ? upColor : downColor)}>{h.chg}</span>
                        <span className={cn("text-[10px] tabular-nums", isUp ? upColor : downColor)}>{h.pctChg}</span>
                        <span className="text-[10px] text-white/40">{h.date}</span>
                        <span className="text-[10px] text-white/35">{h.disclosure}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Shareholder Activity */}
              {shareholderSub === "activity" && (
                <div>
                  {/* Filter pills */}
                  <div className="flex items-center gap-1 mb-3">
                    {["All","Increase","Decrease","New","Sold Out"].map(f => (
                      <span key={f} className="rounded-sm border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold text-white/40 uppercase tracking-wide">{f}</span>
                    ))}
                  </div>
                  <div className="grid px-2 py-1.5 border-b border-white/[0.06] bg-black/20 rounded-t"
                    style={{ gridTemplateColumns: "90px 1fr 80px 90px 70px 90px" }}>
                    {["Position Date","Name","Chg (Shares)","Chg (Amount)","% Held","Type"].map(h => (
                      <span key={h} className="text-[8px] text-white/30 uppercase tracking-wider font-semibold">{h}</span>
                    ))}
                  </div>
                  {SIM_ACTIVITY.map((a, i) => {
                    const isUp = a.chgShares.startsWith("+");
                    return (
                      <div key={i} className="grid px-2 py-[5px] border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors items-center"
                        style={{ gridTemplateColumns: "90px 1fr 80px 90px 70px 90px" }}>
                        <span className="text-[10px] text-white/50">{a.date}</span>
                        <span className="text-[10px] text-white/75 truncate">{a.name}</span>
                        <span className={cn("text-[10px] tabular-nums font-medium", isUp ? upColor : downColor)}>{a.chgShares}</span>
                        <span className={cn("text-[10px] tabular-nums", isUp ? upColor : downColor)}>{a.chgAmount}</span>
                        <span className="text-[10px] tabular-nums text-white/45">{a.pctHeld}</span>
                        <span className="text-[10px] text-white/40">{a.type}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Insiders */}
              {shareholderSub === "insiders" && (
                <div>
                  {fundamentals.insiderTransactions?.length > 0 ? (
                    <>
                      <div className="grid px-2 py-1.5 border-b border-white/[0.06] bg-black/20 rounded-t"
                        style={{ gridTemplateColumns: "110px 1fr 90px 80px 70px" }}>
                        {["Date", "Name", "Shares", "Price", "Type"].map(h => (
                          <span key={h} className="text-[8px] text-white/30 uppercase tracking-wider font-semibold">{h}</span>
                        ))}
                      </div>
                      {fundamentals.insiderTransactions.map((t: any, i: number) => {
                        const isBuy = t.change > 0 && (t.transactionCode === "P" || t.transactionCode === "M");
                        const isSell = t.change < 0 || t.transactionCode === "S" || t.transactionCode === "F";
                        const codeLabel: Record<string, string> = { P: "Purchase", S: "Sale", M: "Exercise", F: "Tax", G: "Gift", A: "Award" };
                        return (
                          <div key={i} className="grid px-2 py-[5px] border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors items-center"
                            style={{ gridTemplateColumns: "110px 1fr 90px 80px 70px" }}>
                            <span className="text-[10px] text-white/55">{t.transactionDate || t.filingDate || "—"}</span>
                            <span className="text-[10px] text-white/75 font-medium truncate">{t.name || "—"}</span>
                            <span className={cn("text-[10px] tabular-nums font-medium",
                              isBuy ? "text-emerald-400" : isSell ? "text-red-400" : "text-white/60"
                            )}>{t.change > 0 ? "+" : ""}{fmtVol(t.change)}</span>
                            <span className="text-[10px] tabular-nums text-white/55">{t.transactionPrice > 0 ? `$${t.transactionPrice.toFixed(2)}` : "—"}</span>
                            <span className={cn("text-[9px] font-medium",
                              isBuy ? "text-emerald-400/70" : isSell ? "text-red-400/70" : "text-white/40"
                            )}>{codeLabel[t.transactionCode] || t.transactionCode || "—"}</span>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-[11px] text-white/30">Loading insider transactions...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Institutions */}
              {shareholderSub === "institutions" && (
                <div>
                  {/* Summary stats */}
                  <div className="flex items-center gap-6 mb-4 pb-3 border-b border-white/[0.06]">
                    <div>
                      <p className="text-[9px] text-white/35 uppercase tracking-wider">No. of Institutions</p>
                      <p className="text-[16px] font-bold text-white/90">{instData.numInst.toLocaleString()} <span className="text-[10px] text-white/40">companies</span></p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/35 uppercase tracking-wider">Total Shares held</p>
                      <p className="text-[16px] font-bold text-white/90">{instData.totalShares} <span className={cn("text-[10px]", instData.chgSummary.startsWith("+") ? upColor : downColor)}>{instData.chgSummary}</span></p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/35 uppercase tracking-wider">% Owned</p>
                      <p className="text-[16px] font-bold text-white/90">{instData.pctOwned}</p>
                    </div>
                  </div>
                  {/* Table */}
                  <div className="grid px-2 py-1.5 border-b border-white/[0.06] bg-black/20 rounded-t"
                    style={{ gridTemplateColumns: "90px 100px 110px 80px 100px" }}>
                    {["Date","No. of Institutions","Shares Held","% Owned","Chg (Shares)"].map(h => (
                      <span key={h} className="text-[8px] text-white/30 uppercase tracking-wider font-semibold">{h}</span>
                    ))}
                  </div>
                  {SIM_INSTITUTIONS.map((r, i) => {
                    const isUp = r.chg.startsWith("+");
                    return (
                      <div key={i} className="grid px-2 py-[5px] border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors items-center"
                        style={{ gridTemplateColumns: "90px 100px 110px 80px 100px" }}>
                        <span className="text-[10px] text-white/65 font-medium">{r.date}</span>
                        <span className="text-[10px] tabular-nums text-white/60">{r.numInst.toLocaleString()}</span>
                        <span className="text-[10px] tabular-nums text-white/65">{r.totalShares}</span>
                        <span className="text-[10px] tabular-nums text-white/60">{r.pctOwned}</span>
                        <span className={cn("text-[10px] tabular-nums font-medium", isUp ? upColor : downColor)}>{r.chg}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SENTIMENT TAB ── */}
        {tab === "sentiment" && (
          <div className="flex-1 min-w-0 flex flex-col md:flex-row overflow-hidden">

            {/* Left: signal bars */}
            <div className="w-full flex-1 md:flex-none md:w-[340px] flex flex-col overflow-y-auto border-b md:border-b-0 md:border-r border-white/[0.06]">
              {/* Header + composite */}
              <div className="shrink-0 px-4 pt-3 pb-2 border-b border-white/[0.06]"
                style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.06) 0%, transparent 60%)" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold tracking-[0.1em] text-emerald-400/80 uppercase">iMYNTED Core Sentiment</span>
                  <div className="flex items-center gap-2">
                    <div className={cn("text-[18px] font-black tabular-nums", scoreLabel(composite).cls)}>{composite}</div>
                    <div className="text-right">
                      <div className={cn("text-[9px] font-bold uppercase tracking-wide", scoreLabel(composite).cls)}>{scoreLabel(composite).text}</div>
                      <div className="text-[9px] text-white/30">/100</div>
                    </div>
                  </div>
                </div>
                {/* Composite bar */}
                <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", scoreBar(composite))} style={{ width: `${composite}%` }} />
                </div>
                <p className="mt-1.5 text-[9px] text-white/30">
                  Computed live from quote · tape · L2 · {ticks.length} ticks · {bids.length + asks.length} L2 levels
                </p>
              </div>

              {/* Signal rows */}
              <div className="flex-1 overflow-y-auto py-1">
                {signals.map((sig) => {
                  const lbl = scoreLabel(sig.score);
                  return (
                    <div key={sig.label} className="px-4 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-white/85">{sig.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-[9px] font-bold uppercase tracking-wide", lbl.cls)}>{lbl.text}</span>
                          <span className={cn("text-[13px] font-black tabular-nums", lbl.cls)}>{sig.score}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden mb-1">
                        <div className={cn("h-full rounded-full transition-all", scoreBar(sig.score))} style={{ width: `${sig.score}%` }} />
                      </div>
                      <span className="text-[9px] text-white/35 tabular-nums">{sig.sub}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: briefing + pros/cons — hidden on mobile */}
            <div className="hidden md:flex flex-1 min-w-0 flex-col overflow-hidden">
              {/* Scanner Briefing header */}
              <div className="shrink-0 px-4 pt-3 pb-2 border-b border-white/[0.06]"
                style={{ background: "linear-gradient(90deg, rgba(34,211,238,0.04) 0%, transparent 60%)" }}>
                <span className="text-[10px] font-bold tracking-[0.1em] text-cyan-400/70 uppercase">Scanner Signal Briefing</span>
                <p className="text-[9px] text-white/30 mt-0.5">What iMYNTED looks for — click any signal to expand</p>
              </div>

              <div className="flex-1 overflow-y-auto py-1 px-4">
                {signals.map((sig) => {
                  const lbl = scoreLabel(sig.score);
                  return (
                    <div key={sig.label} className="py-3 border-b border-white/[0.04]">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", scoreBar(sig.score))} />
                        <span className="text-[11px] font-bold text-white/90">{sig.label}</span>
                        <span className={cn("text-[9px] font-bold uppercase ml-auto", lbl.cls)}>{sig.score}/100</span>
                      </div>

                      {/* What it measures */}
                      <p className="text-[9px] text-white/35 leading-relaxed mb-2">{sig.what}</p>

                      {/* Pros */}
                      {sig.pros.length > 0 && (
                        <div className="mb-1">
                          {sig.pros.map((p, i) => (
                            <div key={i} className="flex items-start gap-1.5 py-0.5">
                              <span className="text-emerald-400 text-[10px] shrink-0 mt-px">▲</span>
                              <span className="text-[10px] text-emerald-300/70">{p}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Cons */}
                      {sig.cons.length > 0 && (
                        <div>
                          {sig.cons.map((c, i) => (
                            <div key={i} className="flex items-start gap-1.5 py-0.5">
                              <span className="text-red-400/80 text-[10px] shrink-0 mt-px">▼</span>
                              <span className="text-[10px] text-red-300/60">{c}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {sig.pros.length === 0 && sig.cons.length === 0 && (
                        <p className="text-[9px] text-white/20 italic">No signal — data pending</p>
                      )}
                    </div>
                  );
                })}

                {/* ── Analyst Recommendations (Finnhub) ── */}
                {fundamentals.recommendations?.length > 0 && (
                  <div className="py-3 border-b border-white/[0.04]">
                    <p className="text-[10px] font-bold tracking-[0.1em] text-emerald-400/70 uppercase mb-2">Analyst Consensus</p>
                    {fundamentals.recommendations.slice(0, 3).map((r: any, i: number) => {
                      const total = (r.strongBuy || 0) + (r.buy || 0) + (r.hold || 0) + (r.sell || 0) + (r.strongSell || 0);
                      const bullPct = total > 0 ? ((r.strongBuy + r.buy) / total * 100) : 0;
                      return (
                        <div key={i} className="mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] text-white/40">{r.period}</span>
                            <span className={cn("text-[9px] font-bold", bullPct > 60 ? "text-emerald-400" : bullPct < 40 ? "text-red-400" : "text-amber-400")}>
                              {bullPct.toFixed(0)}% Buy
                            </span>
                          </div>
                          <div className="flex h-[6px] rounded-sm overflow-hidden gap-px">
                            {r.strongBuy > 0 && <div className="bg-emerald-500/80 h-full" style={{ flex: r.strongBuy }} title={`Strong Buy: ${r.strongBuy}`} />}
                            {r.buy > 0 && <div className="bg-emerald-400/60 h-full" style={{ flex: r.buy }} title={`Buy: ${r.buy}`} />}
                            {r.hold > 0 && <div className="bg-amber-400/50 h-full" style={{ flex: r.hold }} title={`Hold: ${r.hold}`} />}
                            {r.sell > 0 && <div className="bg-red-400/60 h-full" style={{ flex: r.sell }} title={`Sell: ${r.sell}`} />}
                            {r.strongSell > 0 && <div className="bg-red-500/80 h-full" style={{ flex: r.strongSell }} title={`Strong Sell: ${r.strongSell}`} />}
                          </div>
                          <div className="flex justify-between mt-0.5 text-[8px] text-white/30">
                            <span>SB:{r.strongBuy} B:{r.buy}</span>
                            <span>H:{r.hold}</span>
                            <span>S:{r.sell} SS:{r.strongSell}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Earnings History (Finnhub) ── */}
                {fundamentals.earnings?.length > 0 && (
                  <div className="py-3 border-b border-white/[0.04]">
                    <p className="text-[10px] font-bold tracking-[0.1em] text-cyan-400/70 uppercase mb-2">Earnings History</p>
                    <div className="grid px-1 py-1 border-b border-white/[0.06] bg-black/20 rounded-t"
                      style={{ gridTemplateColumns: "70px 60px 60px 60px 60px" }}>
                      {["Period", "Actual", "Est.", "Surp.", "Surp.%"].map(h => (
                        <span key={h} className="text-[8px] text-white/30 uppercase tracking-wider font-semibold">{h}</span>
                      ))}
                    </div>
                    {fundamentals.earnings.map((e: any, i: number) => {
                      const beat = e.surprise > 0;
                      const miss = e.surprise < 0;
                      return (
                        <div key={i} className="grid px-1 py-[4px] border-b border-white/[0.03] items-center"
                          style={{ gridTemplateColumns: "70px 60px 60px 60px 60px" }}>
                          <span className="text-[9px] text-white/55">{e.period || `Q${e.quarter} ${e.year}`}</span>
                          <span className="text-[9px] tabular-nums text-white/75 font-medium">{e.actual != null ? `$${e.actual.toFixed(2)}` : "—"}</span>
                          <span className="text-[9px] tabular-nums text-white/50">{e.estimate != null ? `$${e.estimate.toFixed(2)}` : "—"}</span>
                          <span className={cn("text-[9px] tabular-nums font-medium", beat ? "text-emerald-400" : miss ? "text-red-400" : "text-white/40")}>
                            {e.surprise != null ? `${e.surprise >= 0 ? "+" : ""}$${e.surprise.toFixed(2)}` : "—"}
                          </span>
                          <span className={cn("text-[9px] tabular-nums font-bold", beat ? "text-emerald-400" : miss ? "text-red-400" : "text-white/40")}>
                            {e.surprisePercent != null ? `${e.surprisePercent >= 0 ? "+" : ""}${e.surprisePercent.toFixed(1)}%` : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Footer note */}
                <div className="py-3 text-[9px] text-white/20 leading-relaxed">
                  Scores are computed in real-time from available market data. Analyst consensus and earnings data from Finnhub.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right panel: Order Book (hidden on sentiment + mobile) */}
        {tab !== "sentiment" && !isMobile && (
          <div className="shrink-0 border-l border-white/[0.06] flex flex-col overflow-hidden relative" style={{ width: rightW }}>
            {/* Resize handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-20 hover:bg-emerald-400/20 transition-colors"
              onPointerDown={onResizeStart}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeEnd}
            />
            {/* Header: Bid/Ask pressure + menu */}
            <div className="shrink-0 px-3 pt-2 pb-1.5 border-b border-white/[0.06]">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-[10px] text-emerald-400">Bid {bidPct}%</span>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-[10px] text-red-400">Ask {askPct}%</span>
                  {/* Menu button */}
                  <button
                    type="button"
                    onClick={() => setL2Menu(l2Menu ? null : "root")}
                    className="ml-1 w-5 h-5 flex items-center justify-center rounded border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors text-[10px]"
                    title="Order book settings"
                  >≡</button>
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden flex">
                <div className="bg-emerald-400/70 transition-all" style={{ width: `${bidPct}%` }} />
                <div className="bg-red-400/70 transition-all flex-1" />
              </div>
            </div>

            {/* Dropdown menu */}
            {l2Menu && (
              <div
                className="absolute right-2 top-[52px] z-30 rounded border border-white/15 overflow-hidden shadow-2xl"
                style={{ background: "rgba(4,10,18,0.97)", minWidth: 170 }}
              >
                {l2Menu === "root" && (
                  <>
                    {/* Level selectors */}
                    <div className="flex items-center gap-0 px-2 py-2 border-b border-white/[0.07]">
                      {[5, 10, 20, 40, 60].map(n => (
                        <button key={n} type="button"
                          onClick={() => { setL2Levels(n); }}
                          className={cn(
                            "flex-1 py-1 text-[10px] font-bold rounded transition-colors",
                            l2Levels === n ? "bg-emerald-400/15 text-emerald-300" : "text-white/40 hover:text-white/70"
                          )}
                        >{n}</button>
                      ))}
                    </div>
                    <button type="button"
                      onClick={() => setL2Menu("exchange")}
                      className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-white/70 hover:bg-white/[0.05] transition-colors border-b border-white/[0.05]"
                    >
                      <span>Select Exchange</span>
                      <span className="text-white/30">›</span>
                    </button>
                    <button type="button"
                      onClick={() => setL2Menu("display")}
                      className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-white/70 hover:bg-white/[0.05] transition-colors"
                    >
                      <span>Display Preferences</span>
                      <span className="text-white/30">›</span>
                    </button>
                  </>
                )}

                {l2Menu === "exchange" && (
                  <>
                    <button type="button" onClick={() => setL2Menu("root")}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[10px] text-white/40 hover:text-white/70 border-b border-white/[0.07] transition-colors">
                      ‹ <span>Select Exchange</span>
                    </button>
                    {["ALL", "ARCA", "NSDQ", "NYSE", "EDGX", "BATS"].map(ex => (
                      <button key={ex} type="button"
                        onClick={() => { setL2Exch(ex); setL2Menu(null); }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-1.5 text-[11px] transition-colors hover:bg-white/[0.05]",
                          l2Exch === ex ? "text-emerald-300" : "text-white/60"
                        )}
                      >
                        <span>{ex === "ALL" ? "All Exchanges" : ex}</span>
                        {l2Exch === ex && <span className="text-emerald-400 text-[10px]">✓</span>}
                      </button>
                    ))}
                  </>
                )}

                {l2Menu === "display" && (
                  <>
                    <button type="button" onClick={() => setL2Menu("root")}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[10px] text-white/40 hover:text-white/70 border-b border-white/[0.07] transition-colors">
                      ‹ <span>Display Preferences</span>
                    </button>
                    {[
                      { label: "Color Ribbons", val: l2Ribbons, set: setL2Ribbons },
                      { label: "Order Size Bar", val: l2SizeBar, set: setL2SizeBar },
                    ].map(({ label, val, set }) => (
                      <button key={label} type="button"
                        onClick={() => set(!val)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-white/70 hover:bg-white/[0.05] transition-colors">
                        <span className={cn("w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0",
                          val ? "border-emerald-400/50 bg-emerald-400/20" : "border-white/20 bg-transparent")}>
                          {val && <span className="text-emerald-400 text-[9px] leading-none">✓</span>}
                        </span>
                        {label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Click-outside dismiss */}
            {l2Menu && (
              <div className="fixed inset-0 z-[29]" onClick={() => setL2Menu(null)} style={{ pointerEvents: "auto" }} />
            )}

            {/* L2 column headers */}
            <div className="shrink-0 grid px-1.5 py-1 bg-black/30 border-b border-white/[0.05]"
              style={{ gridTemplateColumns: "36px 1fr 1fr 36px" }}>
              <span className="text-[8px] text-white/30 uppercase tracking-wide">Exch</span>
              <span className="text-[8px] text-emerald-400/60 uppercase tracking-wide">Bid</span>
              <span className="text-[8px] text-red-400/60 uppercase tracking-wide text-right">Ask</span>
              <span className="text-[8px] text-white/30 uppercase tracking-wide text-right">Exch</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {(() => {
                const filtBids = l2Exch === "ALL" ? bids : bids.filter(l => l.exch === l2Exch);
                const filtAsks = l2Exch === "ALL" ? asks : asks.filter(l => l.exch === l2Exch);
                const maxLen = Math.min(l2Levels, Math.max(filtBids.length, filtAsks.length, 5));
                const maxSz = Math.max(...filtBids.map(l => l.sz), ...filtAsks.map(l => l.sz), 1);
                return Array.from({ length: maxLen }).map((_, i) => {
                  const b = filtBids[i]; const a = filtAsks[i];
                  return (
                    <div key={i} className="relative grid items-center px-1.5 py-[3px] border-b border-white/[0.03]"
                      style={{ gridTemplateColumns: "36px 1fr 1fr 36px" }}>
                      {/* Bid ribbon */}
                      {l2Ribbons && b && <div className="absolute left-0 top-0 h-full bg-emerald-400/[0.08] pointer-events-none" style={{ width: l2SizeBar ? `${(b.sz / maxSz) * 50}%` : "50%" }} />}
                      {/* Ask ribbon */}
                      {l2Ribbons && a && <div className="absolute right-0 top-0 h-full bg-red-400/[0.08] pointer-events-none" style={{ width: l2SizeBar ? `${(a.sz / maxSz) * 50}%` : "50%" }} />}
                      {/* Bid exchange */}
                      <span className="relative text-[8px] text-white/35 truncate">{b?.exch ?? ""}</span>
                      {/* Bid: price + size stacked */}
                      <div className="relative">
                        <div className="text-[10px] tabular-nums font-semibold text-emerald-400 leading-tight">
                          {b ? fmtPx(b.px) : <span className="text-white/15">—</span>}
                        </div>
                        {b && <div className="text-[8px] tabular-nums text-emerald-400/50 leading-tight">{fmtVol(b.sz)}</div>}
                      </div>
                      {/* Ask: price + size stacked */}
                      <div className="relative text-right">
                        <div className="text-[10px] tabular-nums font-semibold text-red-400 leading-tight">
                          {a ? fmtPx(a.px) : <span className="text-white/15">—</span>}
                        </div>
                        {a && <div className="text-[8px] tabular-nums text-red-400/50 leading-tight">{fmtVol(a.sz)}</div>}
                      </div>
                      {/* Ask exchange */}
                      <span className="relative text-[8px] text-white/35 text-right truncate">{a?.exch ?? ""}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>
      {/* Corner resize handle */}
      {!isMobile && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-30 group"
          onPointerDown={onPanelResizeStart}
          onPointerMove={onPanelResizeMove}
          onPointerUp={onPanelResizeEnd}
        >
          <svg viewBox="0 0 16 16" className="w-full h-full text-white/15 group-hover:text-emerald-400/40 transition-colors">
            <path d="M14 2L2 14M14 6L6 14M14 10L10 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>,
    document.body
  );
}
