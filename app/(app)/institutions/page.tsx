"use client";

import React, { useMemo, useState } from "react";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ── Types ── */
type ViewMode = "grid" | "list";

interface Institution {
  name: string;
  mv: number;        // market value USD
  topHolding: string;
  topHoldingPct: number;
  stocksHeld: number;
  holdingsChg: number;
  changeInStocks: number;
  updated: string;
  increased: string;
  increasedAmt: string;
  country: string;
  letterBg: string;
}

/* ── iMYNTED brand pill style — varied colors with dark terminal feel ── */
function pillStyle(name: string): React.CSSProperties {
  const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const variant = h % 12;
  const styles: Array<{ bg: string; border: string }> = [
    { bg: "linear-gradient(135deg, rgba(52,211,153,0.55) 0%, rgba(6,78,59,0.70) 100%)", border: "rgba(52,211,153,0.40)" },   // emerald
    { bg: "linear-gradient(135deg, rgba(34,211,238,0.55) 0%, rgba(8,60,90,0.70) 100%)", border: "rgba(34,211,238,0.35)" },    // cyan
    { bg: "linear-gradient(135deg, rgba(45,212,191,0.55) 0%, rgba(15,80,80,0.65) 100%)", border: "rgba(45,212,191,0.35)" },   // teal
    { bg: "linear-gradient(135deg, rgba(99,102,241,0.55) 0%, rgba(30,27,75,0.70) 100%)", border: "rgba(99,102,241,0.35)" },   // indigo
    { bg: "linear-gradient(135deg, rgba(168,85,247,0.50) 0%, rgba(59,7,100,0.65) 100%)", border: "rgba(168,85,247,0.30)" },   // purple
    { bg: "linear-gradient(135deg, rgba(244,114,182,0.50) 0%, rgba(80,20,60,0.65) 100%)", border: "rgba(244,114,182,0.30)" }, // pink
    { bg: "linear-gradient(135deg, rgba(251,146,60,0.50) 0%, rgba(80,40,10,0.65) 100%)", border: "rgba(251,146,60,0.30)" },   // orange
    { bg: "linear-gradient(135deg, rgba(248,113,113,0.50) 0%, rgba(80,20,20,0.65) 100%)", border: "rgba(248,113,113,0.30)" }, // red/rose
    { bg: "linear-gradient(135deg, rgba(56,189,248,0.55) 0%, rgba(12,50,80,0.70) 100%)", border: "rgba(56,189,248,0.35)" },   // sky
    { bg: "linear-gradient(135deg, rgba(52,211,153,0.45) 0%, rgba(34,211,238,0.30) 100%)", border: "rgba(52,211,153,0.35)" }, // emerald→cyan
    { bg: "linear-gradient(135deg, rgba(245,158,11,0.50) 0%, rgba(80,50,5,0.65) 100%)", border: "rgba(245,158,11,0.30)" },    // amber
    { bg: "linear-gradient(135deg, rgba(139,92,246,0.50) 0%, rgba(50,20,80,0.65) 100%)", border: "rgba(139,92,246,0.30)" },   // violet
  ];
  const s = styles[variant];
  return { background: s.bg, borderColor: s.border };
}

function fmtMV(v: number) {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  return `${(v / 1e3).toFixed(0)}K`;
}
function fmtChg(v: number) {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

/* ── Mock Data — real institutional holders ── */
const INSTITUTIONS: Institution[] = [
  { name: "The Vanguard Group", mv: 6.86e12, topHolding: "NVDA", topHoldingPct: 9.33, stocksHeld: 4410, holdingsChg: 84.58e9, changeInStocks: 44, updated: "Mar 24, 2026", increased: "Q", increasedAmt: "+27.27M", country: "US", letterBg: "bg-blue-600" },
  { name: "BlackRock", mv: 6.03e12, topHolding: "NVDA", topHoldingPct: 7.98, stocksHeld: 4440, holdingsChg: 103.66e9, changeInStocks: 55, updated: "Mar 23, 2026", increased: "SOLS", increasedAmt: "+17.25M", country: "US", letterBg: "bg-slate-800" },
  { name: "State Street Global Advisors", mv: 2.9e12, topHolding: "NVDA", topHoldingPct: 4.08, stocksHeld: 4230, holdingsChg: 37.86e9, changeInStocks: 58, updated: "Mar 24, 2026", increased: "AVU", increasedAmt: "+5.70M", country: "US", letterBg: "bg-red-700" },
  { name: "Capital Research", mv: 1.98e12, topHolding: "AVGO", topHoldingPct: 7.51, stocksHeld: 966, holdingsChg: -21.9e9, changeInStocks: 6, updated: "Mar 23, 2026", increased: "GLXY", increasedAmt: "+18.12M", country: "US", letterBg: "bg-emerald-700" },
  { name: "FMR (Fidelity)", mv: 1.62e12, topHolding: "NVDA", topHoldingPct: 3.65, stocksHeld: 4260, holdingsChg: 3.9e9, changeInStocks: -9, updated: "Mar 23, 2026", increased: "BETA", increasedAmt: "+33.08M", country: "US", letterBg: "bg-green-600" },
  { name: "Geode Capital Management", mv: 1.6e12, topHolding: "NVDA", topHoldingPct: 2.42, stocksHeld: 4690, holdingsChg: 21.34e9, changeInStocks: 64, updated: "Mar 19, 2026", increased: "Q", increasedAmt: "+5.36M", country: "US", letterBg: "bg-teal-600" },
  { name: "Norges Bank Investment Mgmt", mv: 1.07e12, topHolding: "NVDA", topHoldingPct: 1.37, stocksHeld: 1860, holdingsChg: 39.08e9, changeInStocks: -159, updated: "Mar 23, 2026", increased: "CHR", increasedAmt: "+1.87M", country: "NO", letterBg: "bg-red-600" },
  { name: "T. Rowe Price Group", mv: 1.05e12, topHolding: "NVDA", topHoldingPct: 1.65, stocksHeld: 3330, holdingsChg: -19.13e9, changeInStocks: 62, updated: "Mar 23, 2026", increased: "PSNL", increasedAmt: "+9.24M", country: "US", letterBg: "bg-sky-600" },
  { name: "UBS Asset Management", mv: 925.21e9, topHolding: "NVDA", topHoldingPct: 1.13, stocksHeld: 5220, holdingsChg: -18.37e9, changeInStocks: 122, updated: "Mar 24, 2026", increased: "WRDLY", increasedAmt: "+26.98M", country: "CH", letterBg: "bg-red-500" },
  { name: "J.P. Morgan Asset Management", mv: 876.93e9, topHolding: "NVDA", topHoldingPct: 1.37, stocksHeld: 3220, holdingsChg: -7.82e9, changeInStocks: 52, updated: "Mar 24, 2026", increased: "ANDG", increasedAmt: "+1.64M", country: "US", letterBg: "bg-blue-800" },
  { name: "Northern Trust Global Inv", mv: 682.94e9, topHolding: "NVDA", topHoldingPct: 1.04, stocksHeld: 4160, holdingsChg: -14.69e9, changeInStocks: 74, updated: "Mar 22, 2026", increased: "MXC", increasedAmt: "+57.34K", country: "US", letterBg: "bg-purple-600" },
  { name: "Morgan Stanley", mv: 614.81e9, topHolding: "AAPL", topHoldingPct: 0.86, stocksHeld: 4600, holdingsChg: -323.87e6, changeInStocks: 85, updated: "Mar 24, 2026", increased: "TULP", increasedAmt: "+371.53K", country: "US", letterBg: "bg-blue-500" },
  { name: "Charles Schwab Investment", mv: 592.81e9, topHolding: "NVDA", topHoldingPct: 0.64, stocksHeld: 3620, holdingsChg: 6.93e9, changeInStocks: 31, updated: "Feb 13, 2026", increased: "MED", increasedAmt: "+181.62K", country: "US", letterBg: "bg-cyan-700" },
  { name: "Wellington Management Group", mv: 557.16e9, topHolding: "NVDA", topHoldingPct: 0.58, stocksHeld: 1950, holdingsChg: -24.52e9, changeInStocks: -13, updated: "Mar 24, 2026", increased: "SLD", increasedAmt: "+33.75M", country: "US", letterBg: "bg-amber-700" },
  { name: "Dimensional Fund Advisors", mv: 519.77e9, topHolding: "NVDA", topHoldingPct: 0.39, stocksHeld: 3520, holdingsChg: 1.86e9, changeInStocks: 5, updated: "Mar 18, 2026", increased: "CVEO", increasedAmt: "+628.16K", country: "US", letterBg: "bg-indigo-600" },
  { name: "BNY Mellon Asset Management", mv: 478.81e9, topHolding: "NVDA", topHoldingPct: 0.63, stocksHeld: 3520, holdingsChg: 6.72e9, changeInStocks: 43, updated: "Mar 23, 2026", increased: "BKSY", increasedAmt: "+1.65M", country: "US", letterBg: "bg-slate-600" },
  { name: "Eaton Vance Management", mv: 468.66e9, topHolding: "NVDA", topHoldingPct: 0.70, stocksHeld: 3760, holdingsChg: 634.27e6, changeInStocks: 7, updated: "Mar 15, 2026", increased: "NSIT", increasedAmt: "+478.66K", country: "US", letterBg: "bg-violet-600" },
  { name: "Legal & General Investment", mv: 455.7e9, topHolding: "NVDA", topHoldingPct: 0.71, stocksHeld: 3510, holdingsChg: -5.64e9, changeInStocks: 20, updated: "Mar 23, 2026", increased: "FCEL", increasedAmt: "+2.89M", country: "UK", letterBg: "bg-blue-700" },
  { name: "Goldman Sachs Asset Mgmt", mv: 404.42e9, topHolding: "NVDA", topHoldingPct: 0.62, stocksHeld: 3560, holdingsChg: 8.3e9, changeInStocks: 26, updated: "Mar 23, 2026", increased: "SEPN", increasedAmt: "+1.23M", country: "US", letterBg: "bg-amber-600" },
  { name: "Invesco Capital Management", mv: 332.62e9, topHolding: "NVDA", topHoldingPct: 0.30, stocksHeld: 2990, holdingsChg: -10.5e6, changeInStocks: -2, updated: "Mar 23, 2026", increased: "OPAL", increasedAmt: "+3.72M", country: "US", letterBg: "bg-emerald-600" },
  { name: "Amundi Asset Management", mv: 435.26e9, topHolding: "NVDA", topHoldingPct: 0.54, stocksHeld: 2120, holdingsChg: 15.57e9, changeInStocks: 227, updated: "Mar 16, 2026", increased: "CFACY", increasedAmt: "+5.63M", country: "FR", letterBg: "bg-blue-600" },
  { name: "Walton Enterprises, LLC", mv: 376.28e9, topHolding: "WMT", topHoldingPct: 37.66, stocksHeld: 1, holdingsChg: 0, changeInStocks: 0, updated: "Feb 3, 2026", increased: "—", increasedAmt: "", country: "US", letterBg: "bg-blue-800" },
  { name: "Teachers Insurance & Annuity", mv: 358.12e9, topHolding: "NVDA", topHoldingPct: 0.54, stocksHeld: 3210, holdingsChg: -9.73e9, changeInStocks: -119, updated: "Feb 19, 2026", increased: "MAGN", increasedAmt: "+733.92K", country: "US", letterBg: "bg-red-700" },
  { name: "Columbia Management Investment", mv: 351.02e9, topHolding: "NVDA", topHoldingPct: 0.39, stocksHeld: 2990, holdingsChg: -7.93e9, changeInStocks: 63, updated: "Mar 19, 2026", increased: "KTTA", increasedAmt: "+1.93M", country: "US", letterBg: "bg-purple-600" },
  { name: "MFS Investment Management", mv: 337.62e9, topHolding: "NVDA", topHoldingPct: 0.28, stocksHeld: 1950, holdingsChg: -12.54e9, changeInStocks: -13, updated: "Mar 13, 2026", increased: "BTU", increasedAmt: "+3.05M", country: "US", letterBg: "bg-indigo-600" },
  { name: "Managed Account Advisors LLC", mv: 329.13e9, topHolding: "NVDA", topHoldingPct: 0.36, stocksHeld: 3520, holdingsChg: 7.54e9, changeInStocks: 43, updated: "Mar 23, 2026", increased: "TPG", increasedAmt: "+7.54M", country: "US", letterBg: "bg-cyan-700" },
  { name: "Deutsche Asset & Wealth Mgmt", mv: 314.5e9, topHolding: "NVDA", topHoldingPct: 0.35, stocksHeld: 3560, holdingsChg: -12.24e9, changeInStocks: -37, updated: "Mar 24, 2026", increased: "INSP", increasedAmt: "+509.63K", country: "DE", letterBg: "bg-blue-700" },
  { name: "Invesco Ltd.", mv: 314.69e9, topHolding: "NVDA", topHoldingPct: 0.29, stocksHeld: 2210, holdingsChg: 6.88e9, changeInStocks: 43, updated: "Mar 23, 2026", increased: "ICHR", increasedAmt: "+1.68M", country: "US", letterBg: "bg-amber-600" },
  { name: "JPMorgan Chase & Co.", mv: 311.2e9, topHolding: "NVDA", topHoldingPct: 0.48, stocksHeld: 3820, holdingsChg: -13.09e9, changeInStocks: 116, updated: "Mar 24, 2026", increased: "AFLYY", increasedAmt: "+140.30M", country: "US", letterBg: "bg-blue-800" },
  { name: "AllianceBernstein", mv: 276.84e9, topHolding: "NVDA", topHoldingPct: 0.42, stocksHeld: 3420, holdingsChg: 7.34e9, changeInStocks: 37, updated: "Mar 24, 2026", increased: "CBK", increasedAmt: "+1.14M", country: "US", letterBg: "bg-sky-700" },
  { name: "Berkshire Hathaway Inc.", mv: 268.52e9, topHolding: "AAPL", topHoldingPct: 1.55, stocksHeld: 1150, holdingsChg: -350.17e6, changeInStocks: -164, updated: "Mar 3, 2026", increased: "NYT", increasedAmt: "+5.07M", country: "US", letterBg: "bg-red-800" },
  { name: "Wells Fargo & Company", mv: 260.92e9, topHolding: "AAPL", topHoldingPct: 0.36, stocksHeld: 2650, holdingsChg: -2.89e9, changeInStocks: -15, updated: "Feb 24, 2026", increased: "WEN", increasedAmt: "+2.97M", country: "US", letterBg: "bg-orange-700" },
  { name: "Franklin Resources", mv: 242.15e9, topHolding: "NVDA", topHoldingPct: 0.25, stocksHeld: 1800, holdingsChg: -2.84e9, changeInStocks: -57, updated: "Mar 13, 2026", increased: "ANDG", increasedAmt: "+970.59K", country: "US", letterBg: "bg-blue-600" },
  { name: "Fisher Investments", mv: 240.61e9, topHolding: "NVDA", topHoldingPct: 0.35, stocksHeld: 990, holdingsChg: 2.55e9, changeInStocks: 36, updated: "Feb 11, 2026", increased: "BELFA", increasedAmt: "+251.61K", country: "US", letterBg: "bg-teal-700" },
  { name: "Bank of America Corporation", mv: 239.17e9, topHolding: "AAPL", topHoldingPct: 0.27, stocksHeld: 2900, holdingsChg: -13.09e9, changeInStocks: 52, updated: "Mar 24, 2026", increased: "OM", increasedAmt: "+927.49K", country: "US", letterBg: "bg-red-600" },
  { name: "Strategic Advisers LLC", mv: 236.69e9, topHolding: "NVDA", topHoldingPct: 0.34, stocksHeld: 3810, holdingsChg: 16.38e9, changeInStocks: 212, updated: "Mar 24, 2026", increased: "BRKR", increasedAmt: "+2.13M", country: "US", letterBg: "bg-emerald-700" },
  { name: "Janus Henderson Group plc", mv: 223.41e9, topHolding: "NVDA", topHoldingPct: 0.34, stocksHeld: 3450, holdingsChg: 3.88e9, changeInStocks: -16, updated: "Mar 24, 2026", increased: "BHVN", increasedAmt: "+15.40M", country: "US", letterBg: "bg-orange-600" },
  { name: "Dodge & Cox", mv: 220.69e9, topHolding: "JCI", topHoldingPct: 9.87, stocksHeld: 143, holdingsChg: 8.3e9, changeInStocks: 26, updated: "Mar 23, 2026", increased: "TRU", increasedAmt: "+9.84M", country: "US", letterBg: "bg-slate-600" },
  { name: "HSBC Global Asset Management", mv: 208.35e9, topHolding: "NVDA", topHoldingPct: 0.27, stocksHeld: 3820, holdingsChg: -7.82e9, changeInStocks: 52, updated: "Mar 24, 2026", increased: "WTKWY", increasedAmt: "+3.70M", country: "UK", letterBg: "bg-red-500" },
  { name: "American Century Investment", mv: 197.42e9, topHolding: "NVDA", topHoldingPct: 0.26, stocksHeld: 3330, holdingsChg: -19.13e9, changeInStocks: 62, updated: "Mar 23, 2026", increased: "CVEO", increasedAmt: "+499.87K", country: "US", letterBg: "bg-blue-500" },
  { name: "Principal Global Investors", mv: 184.45e9, topHolding: "NVDA", topHoldingPct: 0.16, stocksHeld: 3100, holdingsChg: 6.93e9, changeInStocks: 31, updated: "Feb 13, 2026", increased: "SMA", increasedAmt: "+2.05M", country: "US", letterBg: "bg-purple-700" },
  { name: "Raymond James Financial", mv: 177.99e9, topHolding: "AAPL", topHoldingPct: 0.20, stocksHeld: 3860, holdingsChg: 1.86e9, changeInStocks: 5, updated: "Mar 18, 2026", increased: "NXDT", increasedAmt: "+916.90K", country: "US", letterBg: "bg-amber-700" },
  { name: "AQR Capital Management", mv: 177.2e9, topHolding: "NVDA", topHoldingPct: 0.10, stocksHeld: 2480, holdingsChg: 6.88e9, changeInStocks: 43, updated: "Mar 23, 2026", increased: "SRPT", increasedAmt: "+6.29M", country: "US", letterBg: "bg-sky-600" },
  { name: "Merrill Lynch, Pierce, Fenner", mv: 172.47e9, topHolding: "AAPL", topHoldingPct: 0.24, stocksHeld: 3520, holdingsChg: 379.23e6, changeInStocks: 31, updated: "Mar 24, 2026", increased: "SUNC", increasedAmt: "+2.37M", country: "US", letterBg: "bg-blue-900" },
  { name: "Victory Capital Management", mv: 165.4e9, topHolding: "NVDA", topHoldingPct: 0.16, stocksHeld: 3150, holdingsChg: 11.64e9, changeInStocks: -48, updated: "Feb 13, 2026", increased: "BJ", increasedAmt: "+4.70M", country: "US", letterBg: "bg-indigo-700" },
  { name: "Barclays PLC", mv: 164.39e9, topHolding: "NVDA", topHoldingPct: 0.22, stocksHeld: 3560, holdingsChg: -13.05e9, changeInStocks: 72, updated: "Mar 24, 2026", increased: "CRAC", increasedAmt: "+1.13M", country: "UK", letterBg: "bg-cyan-600" },
  { name: "Schweizerische Nationalbank", mv: 159.76e9, topHolding: "NVDA", topHoldingPct: 0.27, stocksHeld: 2220, holdingsChg: -6.67e9, changeInStocks: 19, updated: "Feb 12, 2026", increased: "Q", increasedAmt: "+573.49K", country: "CH", letterBg: "bg-red-600" },
  { name: "SoftBank Group Corp.", mv: 157.25e9, topHolding: "ARM", topHoldingPct: 86.89, stocksHeld: 28, holdingsChg: -444.02e6, changeInStocks: 4, updated: "Mar 11, 2026", increased: "XXI", increasedAmt: "+89.11M", country: "JP", letterBg: "bg-slate-800" },
  { name: "Arrowstreet Capital", mv: 156.32e9, topHolding: "MSFT", topHoldingPct: 0.20, stocksHeld: 1750, holdingsChg: 11.89e9, changeInStocks: -4, updated: "Mar 23, 2026", increased: "KROS", increasedAmt: "+1.08M", country: "US", letterBg: "bg-rose-600" },
];

/* ── Component ── */
export default function InstitutionsPage() {
  const [view, setView] = useState<ViewMode>("grid");
  const [scope, setScope] = useState<"all" | "us">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = INSTITUTIONS;
    if (scope === "us") list = list.filter(i => i.country === "US");
    const q = search.toUpperCase().trim();
    if (q) list = list.filter(i => i.name.toUpperCase().includes(q) || i.topHolding.includes(q));
    return list;
  }, [scope, search]);

  function openDetail(sym: string) {
    try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: sym, asset: "stock" } })); } catch {}
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
              <h1 className="text-[16px] md:text-[18px] font-bold text-white tracking-wide">INSTITUTIONAL TRACKER</h1>
              <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/[0.06] px-1.5 py-0.5 text-[8px] font-bold text-emerald-400/70 uppercase tracking-wider">LIVE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-sm border border-emerald-400/15 bg-emerald-400/[0.04] px-2 py-0.5 text-[9px] text-emerald-300/70">
                <span className="font-bold text-emerald-300">{filtered.length}</span> institutions
              </span>
              <span className="text-[9px] text-white/30">Currency: USD</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap rounded-sm border border-emerald-400/[0.06] px-3 py-2"
          style={{ background: "rgba(4,10,18,0.6)" }}>
          {/* View toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0 rounded-sm border border-emerald-400/[0.12] overflow-hidden">
              {(["list", "grid"] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={cn("px-3 py-1.5 text-[10px] font-bold transition-colors",
                    view === v ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.02] text-white/40 hover:text-white/60"
                  )}>{v === "list" ? "☰" : "⊞"}</button>
              ))}
            </div>

            {/* Scope toggle */}
            <div className="flex items-center gap-0 rounded-sm border border-emerald-400/[0.12] overflow-hidden">
              {(["all", "us"] as const).map(s => (
                <button key={s} onClick={() => setScope(s)}
                  className={cn("px-3 py-1.5 text-[10px] font-bold uppercase transition-colors",
                    scope === s ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.02] text-white/40 hover:text-white/60"
                  )}>{s}</button>
              ))}
            </div>
          </div>

          {/* Search */}
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search institutions..."
            className="w-[140px] md:w-[200px] rounded-sm border border-emerald-400/[0.1] bg-black/30 px-2.5 py-1.5 text-[10px] text-white outline-none placeholder:text-white/25 focus:border-emerald-400/30"
          />
        </div>

        {/* Grid view */}
        {view === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((inst, i) => (
              <div key={i} className="rounded-sm border border-emerald-400/[0.08] p-3 hover:border-emerald-400/20 transition-colors cursor-pointer"
                style={{ background: "rgba(6,14,24,0.6)", boxShadow: "0 0 0 1px rgba(52,211,153,0.03)" }}
                onClick={() => openDetail(inst.topHolding)}>

                {/* Institution header */}
                <div className="flex items-start gap-2 mb-2">
                  <span className="inline-flex items-center justify-center h-[52px] min-w-[52px] px-2 rounded-sm text-[18px] font-bold text-white shrink-0 border" style={pillStyle(inst.name)}>
                    {inst.name[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-white/90 truncate">{inst.name}</div>
                    <div className="text-[9px] text-white/35">{inst.country} MV</div>
                  </div>
                </div>

                {/* Stats — Moomoo layout */}
                <div className="space-y-1 text-[9px]">
                  <div className="flex items-center gap-2">
                    <span className="text-white/35">MV</span>
                    <span className="text-white/80 font-bold tabular-nums text-[11px]">{fmtMV(inst.mv)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/35">Top holding</span>
                    <span className="text-white/70 font-semibold">{inst.topHolding} {inst.topHoldingPct}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={inst.holdingsChg >= 0 ? "text-emerald-400/80 font-semibold" : "text-red-400/80 font-semibold"}>
                      {inst.holdingsChg >= 0 ? "Increased" : "Decreased"}
                    </span>
                    <span className={cn("font-semibold tabular-nums", inst.holdingsChg >= 0 ? "text-emerald-400/70" : "text-red-400/70")}>
                      {inst.increased} {inst.increasedAmt}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List view */}
        {view === "list" && (
          <div className="rounded-sm border border-emerald-400/[0.08] overflow-x-auto"
            style={{ background: "rgba(6,14,24,0.6)", boxShadow: "0 0 0 1px rgba(52,211,153,0.03), 0 12px 40px rgba(0,0,0,0.4)" }}>
            <div className="min-w-[800px]">
              {/* Header */}
              <div className="grid grid-cols-[1fr_90px_100px_90px_90px_90px] gap-2 px-3 py-2 border-b border-emerald-400/[0.08] text-[9px] text-white/35 uppercase tracking-wider font-semibold"
                style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.03) 0%, transparent 50%)" }}>
                <span>Institutions Name</span>
                <span className="text-right">US MV(USD)</span>
                <span className="text-right">Holdings Chg</span>
                <span className="text-right">Stocks Held</span>
                <span className="text-right">Change in Stocks</span>
                <span className="text-right">Updated</span>
              </div>

              {filtered.map((inst, i) => (
                <div key={i}
                  className="grid grid-cols-[1fr_90px_100px_90px_90px_90px] gap-2 px-3 py-2.5 border-b border-white/[0.03] hover:bg-emerald-400/[0.03] transition-colors group cursor-pointer"
                  onClick={() => openDetail(inst.topHolding)}>
                  {/* Name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center justify-center h-[26px] min-w-[26px] px-1 rounded-sm text-[10px] font-bold text-white shrink-0 border" style={pillStyle(inst.name)}>
                      {inst.name[0]}
                    </span>
                    <span className="text-[11px] text-white/80 truncate group-hover:text-emerald-300 transition-colors">{inst.name}</span>
                  </div>
                  <span className="text-[10px] text-white/70 text-right self-center tabular-nums font-semibold">{fmtMV(inst.mv)}</span>
                  <span className={cn("text-[10px] text-right self-center tabular-nums font-semibold",
                    inst.holdingsChg >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>{fmtChg(inst.holdingsChg)}</span>
                  <span className="text-[10px] text-white/60 text-right self-center tabular-nums">{inst.stocksHeld.toLocaleString()}</span>
                  <span className={cn("text-[10px] text-right self-center tabular-nums font-semibold",
                    inst.changeInStocks >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>{inst.changeInStocks >= 0 ? "+" : ""}{inst.changeInStocks}</span>
                  <span className="text-[10px] text-white/40 text-right self-center">{inst.updated}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom ticker */}
        <div className="flex items-center gap-4 text-[10px] tabular-nums rounded-sm border border-emerald-400/[0.06] px-3 py-2 overflow-x-auto scrollbar-hide"
          style={{ background: "rgba(4,10,18,0.6)" }}>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-400/60" />
            <span className="text-white/35 font-semibold">Market Closed</span>
          </span>
          <span className="text-white/40 shrink-0">Dow Jones <span className="text-red-400 font-semibold">45,166.64 -1.73%</span></span>
          <span className="text-white/40 shrink-0">NASDAQ <span className="text-red-400 font-semibold">20,948.36 -2.15%</span></span>
          <span className="text-white/40 shrink-0">S&P 500 <span className="text-red-400 font-semibold">6,368.85 -1.67%</span></span>
        </div>
      </div>
    </div>
  );
}
