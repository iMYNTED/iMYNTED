"use client";

import React, { useMemo, useState } from "react";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ── Types ── */
type PatternType = "bullish" | "bearish" | "neutral";
type Timeframe = "1D" | "1W" | "1M" | "3M";

interface PatternEntry {
  symbol: string;
  name: string;
  pattern: string;
  patternType: PatternType;
  timeframe: Timeframe;
  price: number;
  changePct: number;
  targetPrice: number;
  targetPct: number;
  confidence: number; // 0-100
  breakoutDate: string;
  volume: string;
  mktCap: string;
}

/* ── iMYNTED pill style ── */
function pillStyle(name: string): React.CSSProperties {
  const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const variant = h % 12;
  const styles: Array<{ bg: string; border: string }> = [
    { bg: "linear-gradient(135deg, rgba(52,211,153,0.55) 0%, rgba(6,78,59,0.70) 100%)", border: "rgba(52,211,153,0.40)" },
    { bg: "linear-gradient(135deg, rgba(34,211,238,0.55) 0%, rgba(8,60,90,0.70) 100%)", border: "rgba(34,211,238,0.35)" },
    { bg: "linear-gradient(135deg, rgba(45,212,191,0.55) 0%, rgba(15,80,80,0.65) 100%)", border: "rgba(45,212,191,0.35)" },
    { bg: "linear-gradient(135deg, rgba(99,102,241,0.55) 0%, rgba(30,27,75,0.70) 100%)", border: "rgba(99,102,241,0.35)" },
    { bg: "linear-gradient(135deg, rgba(168,85,247,0.50) 0%, rgba(59,7,100,0.65) 100%)", border: "rgba(168,85,247,0.30)" },
    { bg: "linear-gradient(135deg, rgba(244,114,182,0.50) 0%, rgba(80,20,60,0.65) 100%)", border: "rgba(244,114,182,0.30)" },
    { bg: "linear-gradient(135deg, rgba(251,146,60,0.50) 0%, rgba(80,40,10,0.65) 100%)", border: "rgba(251,146,60,0.30)" },
    { bg: "linear-gradient(135deg, rgba(248,113,113,0.50) 0%, rgba(80,20,20,0.65) 100%)", border: "rgba(248,113,113,0.30)" },
    { bg: "linear-gradient(135deg, rgba(56,189,248,0.55) 0%, rgba(12,50,80,0.70) 100%)", border: "rgba(56,189,248,0.35)" },
    { bg: "linear-gradient(135deg, rgba(52,211,153,0.45) 0%, rgba(34,211,238,0.30) 100%)", border: "rgba(52,211,153,0.35)" },
    { bg: "linear-gradient(135deg, rgba(245,158,11,0.50) 0%, rgba(80,50,5,0.65) 100%)", border: "rgba(245,158,11,0.30)" },
    { bg: "linear-gradient(135deg, rgba(139,92,246,0.50) 0%, rgba(50,20,80,0.65) 100%)", border: "rgba(139,92,246,0.30)" },
  ];
  return { background: styles[variant].bg, borderColor: styles[variant].border };
}

/* ── Pattern definitions ── */
const PATTERNS: Array<{ name: string; type: PatternType; icon: string; desc: string }> = [
  { name: "Bull Flag", type: "bullish", icon: "🚩", desc: "Consolidation after sharp upward move — breakout continuation expected" },
  { name: "Cup & Handle", type: "bullish", icon: "☕", desc: "U-shaped recovery with small pullback handle — strong bullish continuation" },
  { name: "Ascending Triangle", type: "bullish", icon: "△", desc: "Higher lows pressing against resistance — breakout above flat top" },
  { name: "Double Bottom", type: "bullish", icon: "W", desc: "Two equal lows with neckline break — reversal from downtrend" },
  { name: "Inverse Head & Shoulders", type: "bullish", icon: "⊥", desc: "Three troughs, middle deepest — strong bullish reversal signal" },
  { name: "Falling Wedge", type: "bullish", icon: "◣", desc: "Converging downward trendlines — bullish breakout expected" },
  { name: "Bear Flag", type: "bearish", icon: "🏴", desc: "Consolidation after sharp drop — breakdown continuation expected" },
  { name: "Head & Shoulders", type: "bearish", icon: "⊤", desc: "Three peaks, middle tallest — classic bearish reversal" },
  { name: "Descending Triangle", type: "bearish", icon: "▽", desc: "Lower highs pressing against support — breakdown below flat bottom" },
  { name: "Double Top", type: "bearish", icon: "M", desc: "Two equal highs with neckline break — reversal from uptrend" },
  { name: "Rising Wedge", type: "bearish", icon: "◢", desc: "Converging upward trendlines — bearish breakdown expected" },
  { name: "Symmetrical Triangle", type: "neutral", icon: "◇", desc: "Converging trendlines — breakout direction uncertain, watch volume" },
  { name: "Rectangle", type: "neutral", icon: "▭", desc: "Range-bound between support and resistance — break either way" },
  { name: "Pennant", type: "neutral", icon: "▸", desc: "Small symmetrical consolidation after strong move — continuation pattern" },
];

/* ── Mock data ── */
function generatePatterns(): PatternEntry[] {
  const rng = (s: number) => ((s * 16807 + 1) % 2147483647) / 2147483647;

  const STOCKS: Array<[string, string, number]> = [
    ["NVDA", "NVIDIA Corp.", 171.24], ["TSLA", "Tesla Inc.", 372.11], ["AAPL", "Apple Inc.", 252.89],
    ["MSFT", "Microsoft Corp.", 365.97], ["AMZN", "Amazon.com", 208.56], ["META", "Meta Platforms", 547.54],
    ["GOOGL", "Alphabet Inc.", 280.74], ["AMD", "Advanced Micro", 203.77], ["NFLX", "Netflix Inc.", 875.40],
    ["PLTR", "Palantir Tech", 147.56], ["COIN", "Coinbase Global", 265.80], ["SOFI", "SoFi Technologies", 14.20],
    ["BA", "Boeing Co.", 178.50], ["DIS", "Walt Disney", 112.30], ["JPM", "JPMorgan Chase", 212.44],
    ["V", "Visa Inc.", 310.50], ["GS", "Goldman Sachs", 580.40], ["INTC", "Intel Corp.", 44.10],
    ["MU", "Micron Technology", 355.46], ["BABA", "Alibaba Group", 85.30], ["NIO", "NIO Inc.", 5.80],
    ["SNAP", "Snap Inc.", 12.40], ["UBER", "Uber Technologies", 78.90], ["SQ", "Block Inc.", 68.50],
    ["RBLX", "Roblox Corp.", 52.80], ["ABNB", "Airbnb Inc.", 145.20], ["SHOP", "Shopify Inc.", 78.40],
    ["CRWD", "CrowdStrike", 345.60], ["SNOW", "Snowflake Inc.", 165.20], ["DDOG", "Datadog Inc.", 128.40],
    ["NET", "Cloudflare Inc.", 92.80], ["ZS", "Zscaler Inc.", 198.50], ["PANW", "Palo Alto Networks", 320.10],
    ["MRVL", "Marvell Technology", 78.60], ["AVGO", "Broadcom Inc.", 181.30], ["QCOM", "Qualcomm Inc.", 163.30],
    ["TXN", "Texas Instruments", 187.72], ["LRCX", "Lam Research", 78.40], ["KLAC", "KLA Corp.", 680.20],
    ["ON", "ON Semiconductor", 58.30], ["SMCI", "Super Micro Computer", 42.80], ["ARM", "Arm Holdings", 148.60],
    ["GME", "GameStop Corp.", 28.40], ["RIVN", "Rivian Automotive", 12.80], ["LCID", "Lucid Group", 3.20],
    ["MARA", "Marathon Digital", 22.40], ["RIOT", "Riot Platforms", 11.80], ["HOOD", "Robinhood Markets", 42.30],
    ["DELL", "Dell Technologies", 118.40], ["HPE", "Hewlett Packard Ent", 18.90], ["WBD", "Warner Bros.", 11.20],
  ];

  const entries: PatternEntry[] = [];
  const TFS: Timeframe[] = ["1D", "1W", "1M", "3M"];

  for (let i = 0; i < STOCKS.length; i++) {
    const [sym, name, basePrice] = STOCKS[i];
    const h = sym.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const r1 = rng(h * 31 + i); const r2 = rng(h * 47 + i); const r3 = rng(h * 73 + i); const r4 = rng(h * 97 + i);

    // Cycle patterns using index + hash for even distribution across all 14 patterns
    const pat = PATTERNS[(i + h) % PATTERNS.length];
    const tf = TFS[(i * 3 + h) % TFS.length];
    const changePct = +((r3 - 0.4) * 15).toFixed(2);
    const confidence = Math.round(40 + r4 * 55);
    const targetPct = pat.type === "bullish" ? +(5 + r1 * 25).toFixed(1) : pat.type === "bearish" ? +(-5 - r2 * 20).toFixed(1) : +((r3 - 0.5) * 15).toFixed(1);
    const targetPrice = +(basePrice * (1 + targetPct / 100)).toFixed(2);

    entries.push({
      symbol: sym, name,
      pattern: pat.name, patternType: pat.type, timeframe: tf,
      price: basePrice, changePct, targetPrice, targetPct, confidence,
      breakoutDate: `Mar ${20 + Math.floor(r4 * 8)}, 2026`,
      volume: r1 > 0.5 ? `${(10 + r2 * 200).toFixed(0)}M` : `${(100 + r3 * 900).toFixed(0)}K`,
      mktCap: `${(1 + r4 * 50).toFixed(1)}B`,
    });
  }

  return entries.sort((a, b) => b.confidence - a.confidence);
}

function typeColor(t: PatternType) {
  return t === "bullish" ? "text-emerald-400" : t === "bearish" ? "text-red-400" : "text-amber-400";
}
function typeBorder(t: PatternType) {
  return t === "bullish" ? "border-emerald-400/25 bg-emerald-400/[0.08]" : t === "bearish" ? "border-red-400/25 bg-red-400/[0.08]" : "border-amber-400/25 bg-amber-400/[0.08]";
}
function confColor(v: number) {
  if (v >= 75) return "text-emerald-400";
  if (v >= 55) return "text-amber-400";
  return "text-red-400";
}
function confBar(v: number) {
  if (v >= 75) return "bg-emerald-400/50";
  if (v >= 55) return "bg-amber-400/50";
  return "bg-red-400/50";
}

/* ── Component ── */
export default function PatternFinderPage() {
  const [filterType, setFilterType] = useState<"all" | PatternType>("all");
  const [filterTF, setFilterTF] = useState<"all" | Timeframe>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const allPatterns = useMemo(() => generatePatterns(), []);

  const filtered = useMemo(() => {
    let list = allPatterns;
    if (filterType !== "all") list = list.filter(p => p.patternType === filterType);
    if (filterTF !== "all") list = list.filter(p => p.timeframe === filterTF);
    const q = search.toUpperCase().trim();
    if (q) list = list.filter(p => p.symbol.includes(q) || p.name.toUpperCase().includes(q) || p.pattern.toUpperCase().includes(q));
    return list;
  }, [allPatterns, filterType, filterTF, search]);

  function openDetail(sym: string) {
    try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: sym, asset: "stock" } })); } catch {}
  }
  function fireTrade(action: "BUY" | "SELL", sym: string) {
    try { window.dispatchEvent(new CustomEvent("imynted:tradeAction", { detail: { action, asset: "stock", symbol: sym } })); } catch {}
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto"
      style={{ background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)" }}>

      <div className="pointer-events-none fixed inset-0 z-0">
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 55% 35% at 5% 0%, rgba(52,211,153,0.07) 0%, transparent 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 30% 20% at 95% 100%, rgba(34,211,238,0.04) 0%, transparent 100%)" }} />
      </div>

      <div className="relative z-10 px-3 md:px-5 py-4 space-y-4">

        {/* Header */}
        <div className="rounded-sm border border-emerald-400/[0.08] px-3 md:px-4 py-3"
          style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.05) 0%, rgba(4,10,18,0.95) 40%)" }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-[0.14em] text-emerald-400/80 uppercase">iMYNTED</span>
              <span className="text-white/15">|</span>
              <h1 className="text-[16px] md:text-[18px] font-bold text-white tracking-wide">PATTERN FINDER</h1>
              <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/[0.06] px-1.5 py-0.5 text-[8px] font-bold text-emerald-400/70 uppercase tracking-wider">AI</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-sm border border-emerald-400/15 bg-emerald-400/[0.04] px-2 py-0.5 text-[9px] text-emerald-300/70">
                <span className="font-bold">{filtered.length}</span> patterns detected
              </span>
              <span className="rounded-sm border border-emerald-400/15 bg-emerald-400/[0.04] px-2 py-0.5 text-[9px] text-emerald-300/70">
                Bull <span className="font-bold text-emerald-300">{allPatterns.filter(p => p.patternType === "bullish").length}</span>
              </span>
              <span className="rounded-sm border border-red-400/15 bg-red-400/[0.04] px-2 py-0.5 text-[9px] text-red-400/70">
                Bear <span className="font-bold">{allPatterns.filter(p => p.patternType === "bearish").length}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap rounded-sm border border-emerald-400/[0.06] px-3 py-2"
          style={{ background: "rgba(4,10,18,0.6)" }}>
          {/* View + Type filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-0 rounded-sm border border-emerald-400/[0.12] overflow-hidden">
              {(["grid", "list"] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={cn("px-3 py-1.5 text-[10px] font-bold transition-colors",
                    view === v ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.02] text-white/40 hover:text-white/60"
                  )}>{v === "grid" ? "⊞" : "☰"}</button>
              ))}
            </div>

            <div className="flex items-center gap-0 rounded-sm border border-emerald-400/[0.12] overflow-hidden">
              {(["all", "bullish", "bearish", "neutral"] as const).map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={cn("px-2.5 py-1.5 text-[9px] font-bold uppercase transition-colors",
                    filterType === t ? (t === "bullish" ? "bg-emerald-400/15 text-emerald-300" : t === "bearish" ? "bg-red-400/15 text-red-300" : t === "neutral" ? "bg-amber-400/15 text-amber-300" : "bg-emerald-400/15 text-emerald-300") : "bg-white/[0.02] text-white/40 hover:text-white/60"
                  )}>{t}</button>
              ))}
            </div>

            {/* Timeframe */}
            <div className="flex items-center gap-0 rounded-sm border border-emerald-400/[0.12] overflow-hidden">
              {(["all", "1D", "1W", "1M", "3M"] as const).map(t => (
                <button key={t} onClick={() => setFilterTF(t as any)}
                  className={cn("px-2 py-1.5 text-[9px] font-bold transition-colors",
                    filterTF === t ? "bg-cyan-400/15 text-cyan-300" : "bg-white/[0.02] text-white/40 hover:text-white/60"
                  )}>{t === "all" ? "ALL" : t}</button>
              ))}
            </div>
          </div>

          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pattern or symbol..."
            className="w-[140px] md:w-[200px] rounded-sm border border-emerald-400/[0.1] bg-black/30 px-2.5 py-1.5 text-[10px] text-white outline-none placeholder:text-white/25 focus:border-emerald-400/30"
          />
        </div>

        {/* Pattern legend */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          {PATTERNS.slice(0, 8).map(p => (
            <button key={p.name} type="button"
              onClick={() => setSearch(p.name)}
              className={cn("shrink-0 rounded-sm border px-2 py-1 text-[8px] font-bold transition-colors", typeBorder(p.type), typeColor(p.type))}>
              {p.icon} {p.name}
            </button>
          ))}
        </div>

        {/* Grid view */}
        {view === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((p, i) => (
              <div key={`${p.symbol}-${i}`}
                className="rounded-sm border border-emerald-400/[0.08] p-3 hover:border-emerald-400/20 transition-colors cursor-pointer group"
                style={{ background: "rgba(6,14,24,0.6)", boxShadow: "0 0 0 1px rgba(52,211,153,0.03)" }}
                onClick={() => openDetail(p.symbol)}>

                {/* Symbol + pattern badge */}
                <div className="flex items-start gap-2 mb-2">
                  <span className="inline-flex items-center justify-center h-[44px] min-w-[44px] px-2 rounded-sm text-[12px] font-bold text-white shrink-0 border" style={pillStyle(p.symbol)}>
                    {p.symbol}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-white/90 group-hover:text-emerald-300 transition-colors truncate">{p.name}</div>
                    <div className={cn("rounded-sm border px-1.5 py-0.5 text-[8px] font-bold inline-block mt-0.5", typeBorder(p.patternType))}>
                      {p.pattern}
                    </div>
                  </div>
                  <span className="text-[9px] text-white/30 shrink-0">{p.timeframe}</span>
                </div>

                {/* Stats */}
                <div className="space-y-1.5 text-[9px]">
                  <div className="flex justify-between">
                    <span className="text-white/35">Price</span>
                    <span className={cn("font-bold tabular-nums", p.changePct >= 0 ? "text-emerald-400" : "text-red-400")}>
                      ${p.price.toFixed(2)} ({p.changePct >= 0 ? "+" : ""}{p.changePct}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/35">Target</span>
                    <span className={cn("font-bold tabular-nums", p.targetPct >= 0 ? "text-emerald-400" : "text-red-400")}>
                      ${p.targetPrice.toFixed(2)} ({p.targetPct >= 0 ? "+" : ""}{p.targetPct}%)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/35">Confidence</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className={cn("h-full rounded-full", confBar(p.confidence))} style={{ width: `${p.confidence}%` }} />
                      </div>
                      <span className={cn("font-bold tabular-nums", confColor(p.confidence))}>{p.confidence}%</span>
                    </div>
                  </div>
                </div>

                {/* Trade buttons */}
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={(e) => { e.stopPropagation(); fireTrade("BUY", p.symbol); }}
                    className="flex-1 h-6 rounded-sm border border-emerald-400/25 bg-emerald-400/[0.08] text-[9px] font-bold text-emerald-300 hover:bg-emerald-400/15 transition-colors">BUY</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); fireTrade("SELL", p.symbol); }}
                    className="flex-1 h-6 rounded-sm border border-red-400/25 bg-red-400/[0.08] text-[9px] font-bold text-red-300 hover:bg-red-400/15 transition-colors">SELL</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List view */}
        {view === "list" && (
          <div className="rounded-sm border border-emerald-400/[0.08] overflow-x-auto"
            style={{ background: "rgba(6,14,24,0.6)", boxShadow: "0 0 0 1px rgba(52,211,153,0.03), 0 12px 40px rgba(0,0,0,0.4)" }}>
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[40px_1fr_130px_60px_80px_100px_80px_80px] gap-2 px-3 py-2 border-b border-emerald-400/[0.08] text-[9px] text-white/35 uppercase tracking-wider font-semibold"
                style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.03) 0%, transparent 50%)" }}>
                <span>No.</span><span>Symbol / Pattern</span><span>Pattern</span><span className="text-right">TF</span>
                <span className="text-right">Price</span><span className="text-right">Target</span>
                <span className="text-right">Confidence</span><span className="text-right">Breakout</span>
              </div>
              {filtered.map((p, i) => (
                <div key={`${p.symbol}-${i}`}
                  className="grid grid-cols-[40px_1fr_130px_60px_80px_100px_80px_80px] gap-2 px-3 py-2.5 border-b border-white/[0.03] hover:bg-emerald-400/[0.03] transition-colors group cursor-pointer"
                  onClick={() => openDetail(p.symbol)}>
                  <span className="text-[10px] text-white/30 tabular-nums self-center">{i + 1}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center justify-center h-[28px] min-w-[38px] px-2 rounded-sm text-[10px] font-bold text-white/90 shrink-0 border" style={pillStyle(p.symbol)}>
                      {p.symbol}
                    </span>
                    <span className="text-[10px] text-white/50 truncate">{p.name}</span>
                    <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button type="button" onClick={(e) => { e.stopPropagation(); fireTrade("BUY", p.symbol); }}
                        className="h-5 rounded-sm border border-emerald-400/25 bg-emerald-400/[0.08] px-1.5 text-[8px] font-bold text-emerald-300">B</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); fireTrade("SELL", p.symbol); }}
                        className="h-5 rounded-sm border border-red-400/25 bg-red-400/[0.08] px-1.5 text-[8px] font-bold text-red-300">S</button>
                    </div>
                  </div>
                  <span className={cn("text-[10px] font-semibold self-center", typeColor(p.patternType))}>{p.pattern}</span>
                  <span className="text-[10px] text-white/50 text-right self-center">{p.timeframe}</span>
                  <span className={cn("text-[10px] text-right self-center tabular-nums font-semibold", p.changePct >= 0 ? "text-emerald-400" : "text-red-400")}>
                    ${p.price.toFixed(2)}
                  </span>
                  <span className={cn("text-[10px] text-right self-center tabular-nums font-semibold", p.targetPct >= 0 ? "text-emerald-400" : "text-red-400")}>
                    ${p.targetPrice.toFixed(2)} ({p.targetPct >= 0 ? "+" : ""}{p.targetPct}%)
                  </span>
                  <div className="flex items-center justify-end gap-1 self-center">
                    <div className="w-12 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className={cn("h-full rounded-full", confBar(p.confidence))} style={{ width: `${p.confidence}%` }} />
                    </div>
                    <span className={cn("text-[10px] font-bold tabular-nums", confColor(p.confidence))}>{p.confidence}%</span>
                  </div>
                  <span className="text-[10px] text-white/35 text-right self-center">{p.breakoutDate}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom ticker */}
        <div className="flex items-center gap-4 text-[10px] tabular-nums rounded-sm border border-emerald-400/[0.06] px-3 py-2 overflow-x-auto scrollbar-hide"
          style={{ background: "rgba(4,10,18,0.6)" }}>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400/60 animate-pulse" />
            <span className="text-white/35 font-semibold">Pattern Scanner Active</span>
          </span>
          <span className="text-white/30 shrink-0">Scanning {allPatterns.length} stocks across {PATTERNS.length} patterns</span>
          <span className="text-white/40 shrink-0">Dow <span className="text-red-400 font-semibold">45,166.64 -1.73%</span></span>
          <span className="text-white/40 shrink-0">S&P <span className="text-red-400 font-semibold">6,368.85 -1.67%</span></span>
        </div>
      </div>
    </div>
  );
}
