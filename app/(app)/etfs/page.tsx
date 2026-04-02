"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ── Types ─────────────────────────────────────────────────────── */

type Category = "Broad" | "Sector" | "Thematic" | "FixedIncome" | "International" | "Commodities" | "Volatility";

interface EtfMeta {
  ticker:   string;
  name:     string;
  category: Category;
  base:     number;
  aum:      number;    // billions
  expRatio: number;    // decimal e.g. 0.0003
  issuer:   string;
  divYield: number;    // decimal e.g. 0.0132
  w52hi:    number;
  w52lo:    number;
}

interface EtfRow extends EtfMeta {
  price:  number;
  prev:   number;
  chg:    number;
  pct:    number;
  bid:    number;
  ask:    number;
  volume: number;
}

type LivePrice = { price: number; bid: number; ask: number; chg: number; pct: number; dir: 1 | -1 };

/* ── ETF Catalog ───────────────────────────────────────────────── */

const TICK = 0.01;

const ETF_DATA: EtfMeta[] = [
  // Broad Market
  { ticker: "SPY",  name: "SPDR S&P 500 ETF",               category: "Broad",         base: 560,  aum: 540,  expRatio: 0.000945, issuer: "SSGA",       divYield: 0.0132, w52hi: 613, w52lo: 483 },
  { ticker: "QQQ",  name: "Invesco NASDAQ 100 ETF",          category: "Broad",         base: 472,  aum: 230,  expRatio: 0.0020,   issuer: "Invesco",    divYield: 0.0062, w52hi: 540, w52lo: 394 },
  { ticker: "IWM",  name: "iShares Russell 2000 ETF",        category: "Broad",         base: 198,  aum: 65,   expRatio: 0.0019,   issuer: "BlackRock",  divYield: 0.0141, w52hi: 244, w52lo: 186 },
  { ticker: "DIA",  name: "SPDR Dow Jones Industrial ETF",   category: "Broad",         base: 411,  aum: 35,   expRatio: 0.0016,   issuer: "SSGA",       divYield: 0.0165, w52hi: 449, w52lo: 356 },
  { ticker: "VTI",  name: "Vanguard Total Stock Market ETF", category: "Broad",         base: 252,  aum: 450,  expRatio: 0.0003,   issuer: "Vanguard",   divYield: 0.0138, w52hi: 275, w52lo: 217 },
  { ticker: "VOO",  name: "Vanguard S&P 500 ETF",            category: "Broad",         base: 513,  aum: 480,  expRatio: 0.0003,   issuer: "Vanguard",   divYield: 0.0133, w52hi: 562, w52lo: 442 },
  { ticker: "VUG",  name: "Vanguard Growth ETF",             category: "Broad",         base: 358,  aum: 140,  expRatio: 0.0004,   issuer: "Vanguard",   divYield: 0.0056, w52hi: 393, w52lo: 293 },
  { ticker: "VTV",  name: "Vanguard Value ETF",              category: "Broad",         base: 153,  aum: 115,  expRatio: 0.0004,   issuer: "Vanguard",   divYield: 0.0221, w52hi: 165, w52lo: 135 },
  // Sector
  { ticker: "XLF",  name: "Financial Select SPDR",           category: "Sector",        base: 45,   aum: 44,   expRatio: 0.0009,   issuer: "SSGA",       divYield: 0.0172, w52hi: 51,  w52lo: 36  },
  { ticker: "XLK",  name: "Technology Select SPDR",          category: "Sector",        base: 220,  aum: 74,   expRatio: 0.0009,   issuer: "SSGA",       divYield: 0.0067, w52hi: 246, w52lo: 175 },
  { ticker: "XLE",  name: "Energy Select SPDR",              category: "Sector",        base: 92,   aum: 35,   expRatio: 0.0009,   issuer: "SSGA",       divYield: 0.0342, w52hi: 101, w52lo: 82  },
  { ticker: "XLV",  name: "Health Care Select SPDR",         category: "Sector",        base: 140,  aum: 37,   expRatio: 0.0009,   issuer: "SSGA",       divYield: 0.0158, w52hi: 158, w52lo: 126 },
  { ticker: "XLY",  name: "Consumer Discretionary SPDR",     category: "Sector",        base: 192,  aum: 21,   expRatio: 0.0009,   issuer: "SSGA",       divYield: 0.0071, w52hi: 218, w52lo: 162 },
  { ticker: "XLP",  name: "Consumer Staples Select SPDR",    category: "Sector",        base: 78,   aum: 14,   expRatio: 0.0009,   issuer: "SSGA",       divYield: 0.0274, w52hi: 82,  w52lo: 70  },
  { ticker: "XLI",  name: "Industrial Select SPDR",          category: "Sector",        base: 130,  aum: 22,   expRatio: 0.0009,   issuer: "SSGA",       divYield: 0.0138, w52hi: 144, w52lo: 112 },
  { ticker: "XLU",  name: "Utilities Select SPDR",           category: "Sector",        base: 75,   aum: 14,   expRatio: 0.0009,   issuer: "SSGA",       divYield: 0.0312, w52hi: 80,  w52lo: 62  },
  // Thematic
  { ticker: "ARKK", name: "ARK Innovation ETF",              category: "Thematic",      base: 52,   aum: 6.8,  expRatio: 0.0075,   issuer: "ARK Invest", divYield: 0,      w52hi: 65,  w52lo: 38  },
  { ticker: "SOXX", name: "iShares Semiconductor ETF",       category: "Thematic",      base: 198,  aum: 12,   expRatio: 0.0035,   issuer: "BlackRock",  divYield: 0.0084, w52hi: 258, w52lo: 168 },
  { ticker: "HACK", name: "ETFMG Prime Cyber Security ETF",  category: "Thematic",      base: 64,   aum: 1.9,  expRatio: 0.0060,   issuer: "ETF MG",     divYield: 0.0028, w52hi: 72,  w52lo: 53  },
  { ticker: "AIQ",  name: "Global X AI & Technology ETF",    category: "Thematic",      base: 33,   aum: 1.2,  expRatio: 0.0068,   issuer: "Global X",   divYield: 0.0012, w52hi: 40,  w52lo: 26  },
  { ticker: "BOTZ", name: "Global X Robotics & AI ETF",      category: "Thematic",      base: 27,   aum: 2.4,  expRatio: 0.0068,   issuer: "Global X",   divYield: 0.0032, w52hi: 33,  w52lo: 21  },
  { ticker: "FINX", name: "Global X FinTech ETF",            category: "Thematic",      base: 34,   aum: 0.8,  expRatio: 0.0068,   issuer: "Global X",   divYield: 0,      w52hi: 42,  w52lo: 28  },
  // Fixed Income
  { ticker: "TLT",  name: "iShares 20+ Year Treasury Bond",  category: "FixedIncome",   base: 94,   aum: 56,   expRatio: 0.0015,   issuer: "BlackRock",  divYield: 0.0482, w52hi: 100, w52lo: 83  },
  { ticker: "IEF",  name: "iShares 7-10 Year Treasury Bond", category: "FixedIncome",   base: 98,   aum: 33,   expRatio: 0.0015,   issuer: "BlackRock",  divYield: 0.0385, w52hi: 104, w52lo: 92  },
  { ticker: "HYG",  name: "iShares iBoxx HY Corp Bond ETF",  category: "FixedIncome",   base: 78,   aum: 16,   expRatio: 0.0049,   issuer: "BlackRock",  divYield: 0.0632, w52hi: 80,  w52lo: 72  },
  { ticker: "LQD",  name: "iShares iBoxx IG Corp Bond ETF",  category: "FixedIncome",   base: 108,  aum: 35,   expRatio: 0.0014,   issuer: "BlackRock",  divYield: 0.0465, w52hi: 113, w52lo: 98  },
  { ticker: "BND",  name: "Vanguard Total Bond Market ETF",  category: "FixedIncome",   base: 72,   aum: 105,  expRatio: 0.0003,   issuer: "Vanguard",   divYield: 0.0388, w52hi: 75,  w52lo: 68  },
  { ticker: "AGG",  name: "iShares Core US Aggregate Bond",  category: "FixedIncome",   base: 96,   aum: 112,  expRatio: 0.0003,   issuer: "BlackRock",  divYield: 0.0374, w52hi: 100, w52lo: 90  },
  // International
  { ticker: "EFA",  name: "iShares MSCI EAFE ETF",           category: "International", base: 78,   aum: 52,   expRatio: 0.0032,   issuer: "BlackRock",  divYield: 0.0348, w52hi: 84,  w52lo: 68  },
  { ticker: "EEM",  name: "iShares MSCI Emerging Markets",   category: "International", base: 42,   aum: 26,   expRatio: 0.0068,   issuer: "BlackRock",  divYield: 0.0214, w52hi: 46,  w52lo: 37  },
  { ticker: "FXI",  name: "iShares China Large-Cap ETF",     category: "International", base: 28,   aum: 6.2,  expRatio: 0.0074,   issuer: "BlackRock",  divYield: 0.0392, w52hi: 33,  w52lo: 22  },
  { ticker: "VEA",  name: "Vanguard FTSE Developed Markets", category: "International", base: 48,   aum: 115,  expRatio: 0.0005,   issuer: "Vanguard",   divYield: 0.0352, w52hi: 52,  w52lo: 41  },
  { ticker: "VWO",  name: "Vanguard FTSE Emerging Markets",  category: "International", base: 44,   aum: 78,   expRatio: 0.0008,   issuer: "Vanguard",   divYield: 0.0327, w52hi: 48,  w52lo: 39  },
  // Commodities
  { ticker: "GLD",  name: "SPDR Gold Shares",                category: "Commodities",   base: 240,  aum: 72,   expRatio: 0.0040,   issuer: "SSGA",       divYield: 0,      w52hi: 296, w52lo: 185 },
  { ticker: "SLV",  name: "iShares Silver Trust",            category: "Commodities",   base: 28,   aum: 12,   expRatio: 0.0050,   issuer: "BlackRock",  divYield: 0,      w52hi: 36,  w52lo: 21  },
  { ticker: "USO",  name: "United States Oil Fund",          category: "Commodities",   base: 72,   aum: 3.4,  expRatio: 0.0083,   issuer: "USCF",       divYield: 0,      w52hi: 84,  w52lo: 61  },
  { ticker: "DBA",  name: "Invesco DB Agriculture Fund",     category: "Commodities",   base: 22,   aum: 1.4,  expRatio: 0.0093,   issuer: "Invesco",    divYield: 0,      w52hi: 25,  w52lo: 19  },
  { ticker: "PDBC", name: "Invesco Optimum Yield Commodity", category: "Commodities",   base: 16,   aum: 3.8,  expRatio: 0.0059,   issuer: "Invesco",    divYield: 0.0744, w52hi: 19,  w52lo: 14  },
  // Volatility / Leveraged
  { ticker: "UVXY", name: "ProShares Ultra VIX Short-Term",  category: "Volatility",    base: 14,   aum: 0.8,  expRatio: 0.0095,   issuer: "ProShares",  divYield: 0,      w52hi: 24,  w52lo: 8   },
  { ticker: "TQQQ", name: "ProShares UltraPro QQQ (3x)",     category: "Volatility",    base: 58,   aum: 22,   expRatio: 0.0088,   issuer: "ProShares",  divYield: 0.0058, w52hi: 82,  w52lo: 34  },
  { ticker: "UPRO", name: "ProShares UltraPro S&P 500 (3x)", category: "Volatility",    base: 72,   aum: 4.2,  expRatio: 0.0093,   issuer: "ProShares",  divYield: 0.0041, w52hi: 98,  w52lo: 42  },
  { ticker: "SQQQ", name: "ProShares UltraPro Short QQQ",    category: "Volatility",    base: 8,    aum: 4.4,  expRatio: 0.0093,   issuer: "ProShares",  divYield: 0,      w52hi: 18,  w52lo: 6   },
  { ticker: "SPXS", name: "Direxion Daily S&P 500 Bear 3x",  category: "Volatility",    base: 10,   aum: 1.2,  expRatio: 0.0094,   issuer: "Direxion",   divYield: 0,      w52hi: 22,  w52lo: 8   },
];

const CATEGORIES: { id: Category | "All"; label: string; short: string }[] = [
  { id: "All",           label: "All ETFs",      short: "ALL"   },
  { id: "Broad",         label: "Broad Market",  short: "BROD"  },
  { id: "Sector",        label: "Sector",        short: "SECT"  },
  { id: "Thematic",      label: "Thematic",      short: "THME"  },
  { id: "FixedIncome",   label: "Fixed Income",  short: "BOND"  },
  { id: "International", label: "International", short: "INTL"  },
  { id: "Commodities",   label: "Commodities",   short: "CMD"   },
  { id: "Volatility",    label: "Vol/Leveraged", short: "VOL"   },
];

const SIDEBAR_ETFS = ["SPY", "QQQ", "IWM", "DIA", "XLF", "XLK", "XLE", "GLD", "TLT", "EFA", "TQQQ", "UVXY"];

/* ── Build rows ────────────────────────────────────────────────── */

function buildRows(meta: EtfMeta[]): EtfRow[] {
  return meta.map((m, i) => {
    const seed     = m.ticker.charCodeAt(0) * 13 + i * 7;
    const drift    = ((seed % 21) - 10) * 0.005 * m.base;
    const price    = Math.round((m.base + drift) * 100) / 100;
    const prevDrift = ((seed * 3 % 15) - 7) * 0.004 * m.base;
    const prev     = Math.round((m.base + prevDrift) * 100) / 100;
    const chg      = Math.round((price - prev) * 100) / 100;
    const pct      = Number(((chg / prev) * 100).toFixed(2));
    return {
      ...m, price, prev, chg, pct,
      bid:    Math.round((price - TICK) * 100) / 100,
      ask:    Math.round((price + TICK) * 100) / 100,
      volume: Math.round(500_000 + ((seed * 9337) % 50_000_000)),
    };
  });
}

/* ── Formatters ────────────────────────────────────────────────── */

function fmtPx(px: number): string {
  if (!Number.isFinite(px)) return "—";
  return px.toFixed(2);
}

function fmtVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function fmtAum(b: number): string {
  if (b >= 1000) return `$${(b / 1000).toFixed(1)}T`;
  if (b >= 1) return `$${b.toFixed(1)}B`;
  return `$${(b * 1000).toFixed(0)}M`;
}

/* ── Sparkline ─────────────────────────────────────────────────── */

function Spark({ positive, seed }: { positive: boolean; seed: number }) {
  const pts = useMemo(() => {
    const arr: number[] = [];
    let v = 50;
    for (let i = 0; i < 20; i++) {
      v = Math.max(10, Math.min(90, v + (((seed * (i + 1) * 7) % 21) - 10) * 0.8));
      arr.push(v);
    }
    arr[arr.length - 1] = positive ? Math.max(arr[arr.length - 1], 55) : Math.min(arr[arr.length - 1], 45);
    return arr;
  }, [positive, seed]);

  const d = "M " + pts.map((y, i) => `${(i / (pts.length - 1)) * 60},${50 - (y - 50) * 0.45}`).join(" L ");

  return (
    <svg width="60" height="22" viewBox="0 0 60 50" preserveAspectRatio="none" className="shrink-0 opacity-80">
      <path
        d={d} fill="none"
        stroke={positive ? "rgba(52,211,153,0.75)" : "rgba(239,68,68,0.75)"}
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Detail Panel ──────────────────────────────────────────────── */

interface DetailTick { ts: string; price: number; dir: 1 | -1 }

function DetailPanel({ row, live }: { row: EtfRow; live: LivePrice | null }) {
  const router = useRouter();
  const [ticks, setTicks] = useState<DetailTick[]>([]);
  const tickRef = useRef(0);

  const price    = live?.price ?? row.price;
  const chg      = live?.chg   ?? row.chg;
  const pct      = live?.pct   ?? row.pct;
  const bid      = live?.bid   ?? row.bid;
  const ask      = live?.ask   ?? row.ask;
  const positive = chg >= 0;

  const w52pct = row.w52hi - row.w52lo > 0
    ? ((price - row.w52lo) / (row.w52hi - row.w52lo)) * 100
    : 50;

  // Seed tick tape on symbol change
  useEffect(() => {
    tickRef.current = 0;
    const now = Date.now();
    const s = row.ticker.charCodeAt(0) + row.price;
    const pad = (n: number) => String(n).padStart(2, "0");
    setTicks(
      Array.from({ length: 14 }, (_, i) => {
        const delta = (((s + i * 7) % 7) - 3) * TICK;
        const p = Math.round((row.price + delta) * 100) / 100;
        const t = new Date(now - (14 - i) * 2800);
        return { ts: `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`, price: p, dir: (delta >= 0 ? 1 : -1) as 1 | -1 };
      }).reverse()
    );
  }, [row.ticker]);

  // Live tick updates
  useEffect(() => {
    const s = row.ticker.charCodeAt(0) + row.price;
    const pad = (n: number) => String(n).padStart(2, "0");
    const iv = setInterval(() => {
      const id = ++tickRef.current;
      const delta = (((id * 7 + s) % 7) - 3) * TICK;
      const p = Math.round((price + delta) * 100) / 100;
      const t = new Date();
      const ts = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
      setTicks(prev => [{ ts, price: p, dir: (delta >= 0 ? 1 : -1) as 1 | -1 }, ...prev.slice(0, 29)]);
    }, 1800);
    return () => clearInterval(iv);
  }, [row.ticker, price]);

  function openInTerminal() {
    try { localStorage.setItem("imynted:etf:open", JSON.stringify({ symbol: row.ticker, asset: "etf" })); } catch {}
    router.push("/dashboard");
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "rgba(3,7,14,0.7)" }}>

      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[8px] font-black tracking-widest text-emerald-400/70 uppercase px-1.5 py-0.5 rounded border border-emerald-400/20 bg-emerald-400/[0.07] shrink-0">
            ETF
          </span>
          <span className="text-[9px] text-white/35 font-mono">{row.ticker}</span>
          <span className="text-[9px] text-white/20">·</span>
          <span className="text-[9px] text-white/30">{row.category}</span>
        </div>
        <p className="text-[10px] text-white/40 leading-tight mb-2 truncate">{row.name}</p>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className={cn("text-[24px] font-black tabular-nums leading-none", positive ? "text-emerald-300" : "text-red-400")}>
              ${fmtPx(price)}
            </p>
            <p className={cn("text-[11px] font-semibold tabular-nums mt-0.5", positive ? "text-emerald-400" : "text-red-400")}>
              {positive ? "+" : ""}${fmtPx(chg)}&nbsp;&nbsp;{positive ? "+" : ""}{pct.toFixed(2)}%
            </p>
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            <div className="flex items-center gap-1">
              <button
                onClick={() => { try { window.dispatchEvent(new CustomEvent("imynted:tradeAction", { detail: { action: "BUY", asset: "stock", symbol: row.ticker } })); } catch {} }}
                className="rounded-sm border border-emerald-400/25 bg-emerald-400/[0.08] px-2.5 py-1 text-[9px] font-bold text-emerald-300 hover:bg-emerald-400/[0.15] transition-colors"
              >BUY</button>
              <button
                onClick={() => { try { window.dispatchEvent(new CustomEvent("imynted:tradeAction", { detail: { action: "SELL", asset: "stock", symbol: row.ticker } })); } catch {} }}
                className="rounded-sm border border-red-400/25 bg-red-400/[0.08] px-2.5 py-1 text-[9px] font-bold text-red-300 hover:bg-red-400/[0.15] transition-colors"
              >SELL</button>
            </div>
            <button
              onClick={() => { try { navigator.clipboard.writeText(row.ticker); } catch {} }}
              className="rounded border border-white/[0.07] px-2.5 py-1 text-[9px] text-white/25 hover:text-white/55 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      {/* Bid / Ask */}
      <div className="shrink-0 grid grid-cols-2 border-b border-white/[0.06]">
        <div className="px-3 py-2 border-r border-white/[0.04]">
          <p className="text-[8px] text-white/20 uppercase tracking-widest mb-0.5">Bid</p>
          <p className="text-[13px] font-bold text-emerald-300/80 tabular-nums">${fmtPx(bid)}</p>
        </div>
        <div className="px-3 py-2">
          <p className="text-[8px] text-white/20 uppercase tracking-widest mb-0.5">Ask</p>
          <p className="text-[13px] font-bold text-red-300/80 tabular-nums">${fmtPx(ask)}</p>
        </div>
      </div>

      {/* 52-week range */}
      <div className="shrink-0 px-3 py-2.5 border-b border-white/[0.06]">
        <div className="flex justify-between mb-1.5">
          <span className="text-[8px] text-white/18">52W Lo: ${fmtPx(row.w52lo)}</span>
          <span className="text-[8px] text-white/18">52W Hi: ${fmtPx(row.w52hi)}</span>
        </div>
        <div className="relative h-1 rounded-full bg-white/[0.06]">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-emerald-400/35"
            style={{ width: `${Math.min(100, Math.max(0, w52pct))}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400 border border-black"
            style={{ left: `calc(${Math.min(100, Math.max(0, w52pct))}% - 4px)` }}
          />
        </div>
        <p className="text-[8px] text-white/15 mt-1">{w52pct.toFixed(0)}% of 52-wk range</p>
      </div>

      {/* Stats grid */}
      <div className="shrink-0 grid grid-cols-2 border-b border-white/[0.06]">
        {[
          { l: "AUM",        v: fmtAum(row.aum),                                                   s: "assets under mgmt" },
          { l: "Exp Ratio",  v: `${(row.expRatio * 100).toFixed(4)}%`,                             s: "annual fee"        },
          { l: "Div Yield",  v: row.divYield > 0 ? `${(row.divYield * 100).toFixed(2)}%` : "—",   s: "trailing 12m"      },
          { l: "Issuer",     v: row.issuer,                                                         s: ""                  },
          { l: "Prev Close", v: `$${fmtPx(row.prev)}`,                                             s: "last close"        },
          { l: "Spread",     v: `$${fmtPx(ask - bid)}`,                                            s: "bid-ask"           },
          { l: "Volume",     v: fmtVol(row.volume),                                                s: "shares today"      },
          { l: "Category",   v: row.category,                                                       s: ""                  },
        ].map(s => (
          <div key={s.l} className="px-3 py-2 border-r border-b border-white/[0.03] even:border-r-0">
            <p className="text-[8px] text-white/20 uppercase tracking-widest mb-0.5">{s.l}</p>
            <p className="text-[11px] font-bold text-white/75 tabular-nums truncate">{s.v}</p>
            {s.s && <p className="text-[8px] text-white/18">{s.s}</p>}
          </div>
        ))}
      </div>

      {/* Tick tape */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="shrink-0 grid grid-cols-3 px-3 py-1.5 border-b border-white/[0.04]">
          <span className="text-[8px] text-white/18 uppercase tracking-widest">Time</span>
          <span className="text-[8px] text-white/18 uppercase tracking-widest text-right">Price</span>
          <span className="text-[8px] text-white/18 uppercase tracking-widest text-right">Dir</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {ticks.map((t, i) => (
            <div key={i} className={cn("grid grid-cols-3 px-3 py-[3px] border-b border-white/[0.02]", i === 0 && "bg-white/[0.02]")}>
              <span className="text-[10px] text-white/22 tabular-nums font-mono">{t.ts}</span>
              <span className={cn("text-[10px] font-bold tabular-nums text-right", t.dir === 1 ? "text-emerald-300" : "text-red-400")}>
                ${fmtPx(t.price)}
              </span>
              <span className={cn("text-[9px] text-right", t.dir === 1 ? "text-emerald-400" : "text-red-400")}>
                {t.dir === 1 ? "▲" : "▼"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */

type SortCol = "ticker" | "price" | "chg" | "pct" | "volume" | "aum" | "expRatio";

export default function EtfsPage() {
  const [category, setCategory]     = useState<Category | "All">("All");
  const [selected, setSelected]     = useState<EtfRow | null>(null);
  const [sortCol, setSortCol]       = useState<SortCol>("ticker");
  const [sortDir, setSortDir]       = useState<1 | -1>(1);
  const [livePrices, setLivePrices] = useState<Map<string, LivePrice>>(new Map());

  const allRows = useMemo(() => buildRows(ETF_DATA), []);

  // Seed live prices from static rows
  useEffect(() => {
    const m = new Map<string, LivePrice>();
    for (const r of allRows) {
      m.set(r.ticker, { price: r.price, bid: r.bid, ask: r.ask, chg: r.chg, pct: r.pct, dir: r.chg >= 0 ? 1 : -1 });
    }
    setLivePrices(m);
  }, [allRows]);

  // Tick random subset every 2s
  useEffect(() => {
    if (allRows.length === 0) return;
    const iv = setInterval(() => {
      setLivePrices(prev => {
        const next = new Map(prev);
        const keys = [...next.keys()];
        for (let n = 0; n < 6; n++) {
          const tk  = keys[Math.floor(Math.random() * keys.length)];
          const cur = next.get(tk); if (!cur) continue;
          const row = allRows.find(r => r.ticker === tk); if (!row) continue;
          const dir: 1 | -1 = Math.random() < 0.52 ? 1 : -1;
          const np  = Math.round((cur.price + dir * TICK * (1 + Math.floor(Math.random() * 3))) * 100) / 100;
          const nc  = Math.round((np - row.prev) * 100) / 100;
          const npt = Number(((nc / row.prev) * 100).toFixed(2));
          next.set(tk, { price: np, bid: np - TICK, ask: np + TICK, chg: nc, pct: npt, dir });
        }
        return next;
      });
    }, 2000);
    return () => clearInterval(iv);
  }, [allRows]);

  const sidebarRows = useMemo(() => {
    return SIDEBAR_ETFS
      .map(ticker => {
        const row  = allRows.find(r => r.ticker === ticker);
        const live = livePrices.get(ticker);
        return row ? { ticker, row, live } : null;
      })
      .filter(Boolean) as { ticker: string; row: EtfRow; live: LivePrice | undefined }[];
  }, [allRows, livePrices]);

  const tableRows = useMemo(() => {
    const base   = category === "All" ? allRows : allRows.filter(r => r.category === category);
    const merged = base.map(r => {
      const live = livePrices.get(r.ticker);
      return live ? { ...r, price: live.price, bid: live.bid, ask: live.ask, chg: live.chg, pct: live.pct } : r;
    });
    return [...merged].sort((a, b) => {
      if (sortCol === "ticker") return sortDir * a.ticker.localeCompare(b.ticker);
      return sortDir * ((a[sortCol] as number) - (b[sortCol] as number));
    });
  }, [allRows, category, sortCol, sortDir, livePrices]);

  // Auto-select first row once
  useEffect(() => {
    if (!selected && tableRows.length > 0) setSelected(tableRows[0]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSort = useCallback((col: SortCol) => {
    setSortCol(prev => {
      if (prev === col) { setSortDir(d => (d === 1 ? -1 : 1)); return col; }
      setSortDir(1);
      return col;
    });
  }, []);

  function selectTicker(ticker: string) {
    const row = allRows.find(r => r.ticker === ticker);
    if (row) setSelected(row);
    setCategory("All");
  }

  const selectedLive = selected ? (livePrices.get(selected.ticker) ?? null) : null;

  const TH = ({ col, label, right }: { col: SortCol; label: string; right?: boolean }) => (
    <th
      onClick={() => toggleSort(col)}
      className={cn(
        "px-3 py-2 text-[8px] font-black uppercase tracking-widest cursor-pointer select-none hover:text-white/60 transition-colors whitespace-nowrap",
        sortCol === col ? "text-emerald-400/80" : "text-white/25",
        right && "text-right"
      )}
    >
      {label}{sortCol === col ? (sortDir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div
      className="h-full flex flex-col md:flex-row overflow-hidden"
      style={{ background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)" }}
    >

      {/* ── Left sidebar ─────────────────────────────── */}
      <div className="w-full md:w-[196px] shrink-0 md:h-full flex flex-row md:flex-col border-b md:border-b-0 md:border-r border-white/[0.06] overflow-x-auto md:overflow-x-visible md:overflow-y-auto max-h-[100px] md:max-h-full">

        <div className="shrink-0 px-3 pt-3.5 pb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black tracking-[0.14em] text-emerald-400/80 uppercase">iMYNTED</span>
            <span className="text-white/[0.15] text-[9px]">|</span>
            <span className="text-[12px] font-bold text-white/80 tracking-wide">ETFs</span>
          </div>
          <p className="text-[8px] text-white/20 mt-0.5">{allRows.length} funds · sim</p>
        </div>

        <div className="shrink-0 px-2 py-2 flex flex-wrap gap-1 border-b border-white/[0.06]">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "px-2 py-1 rounded-sm text-[9px] font-bold transition-colors border",
                category === c.id
                  ? "bg-emerald-400/[0.12] text-emerald-300 border-emerald-400/30"
                  : "bg-white/[0.03] text-white/35 hover:text-white/60 border-white/[0.06]"
              )}
            >
              {c.short}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {sidebarRows
            .filter(s => category === "All" || s.row.category === category)
            .map(s => {
              const livePx  = s.live?.price ?? s.row.price;
              const liveChg = s.live?.chg   ?? s.row.chg;
              const livePct = s.live?.pct   ?? s.row.pct;
              const pos     = liveChg >= 0;
              const isActive = selected?.ticker === s.ticker;
              return (
                <button
                  key={s.ticker}
                  onClick={() => selectTicker(s.ticker)}
                  className={cn(
                    "w-full px-3 py-2.5 flex items-center gap-2 border-b border-white/[0.03] transition-colors text-left",
                    isActive
                      ? "bg-emerald-400/[0.07] border-l-[2px] border-l-emerald-400/40"
                      : "hover:bg-white/[0.025] border-l-[2px] border-l-transparent"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[11px] font-black text-white/80 font-mono">{s.ticker}</span>
                      <span className={cn("text-[9px] font-semibold tabular-nums", pos ? "text-emerald-400/80" : "text-red-400/80")}>
                        {pos ? "+" : ""}{livePct.toFixed(2)}%
                      </span>
                    </div>
                    <p className={cn("text-[10px] font-bold tabular-nums", pos ? "text-emerald-300" : "text-red-400")}>
                      ${fmtPx(livePx)}
                    </p>
                  </div>
                  <Spark positive={pos} seed={s.ticker.charCodeAt(0) * 13} />
                </button>
              );
            })}
        </div>

        <div className="shrink-0 px-3 py-1.5 border-t border-white/[0.04]">
          <p className="text-[8px] text-white/14">Sim · No live feed connected</p>
        </div>
      </div>

      {/* ── Center table ─────────────────────────────── */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">

        <div
          className="shrink-0 flex items-center gap-3 px-4 h-[38px] border-b border-white/[0.06]"
          style={{ background: "rgba(3,7,14,0.5)" }}
        >
          <span className="text-[10px] font-bold text-white/35 tracking-wide">
            {category === "All" ? "All ETFs" : CATEGORIES.find(c => c.id === category)?.label ?? category}
          </span>
          <span className="text-[9px] text-white/18 tabular-nums">{tableRows.length} funds</span>
          <div className="ml-auto flex items-center gap-1">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "px-2 py-1 rounded text-[9px] font-semibold border transition-colors",
                  category === c.id
                    ? "bg-emerald-400/[0.08] text-emerald-300 border-emerald-400/20"
                    : "text-white/22 hover:text-white/50 border-transparent"
                )}
              >
                {c.short}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10" style={{ background: "rgba(3,7,14,0.97)" }}>
              <tr className="border-b border-white/[0.06]">
                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/18 w-7">#</th>
                <TH col="ticker"   label="Ticker"  />
                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25">Name</th>
                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25">Cat</th>
                <TH col="price"    label="Price"   right />
                <TH col="pct"      label="% Chg"   right />
                <TH col="chg"      label="Chg"     right />
                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25 text-right">Bid</th>
                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25 text-right">Ask</th>
                <TH col="volume"   label="Volume"  right />
                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25 text-right">52W Hi</th>
                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25 text-right">52W Lo</th>
                <TH col="aum"      label="AUM"     right />
                <TH col="expRatio" label="Exp%"    right />
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, idx) => {
                const pos        = row.chg >= 0;
                const isSelected = selected?.ticker === row.ticker;
                const dir        = livePrices.get(row.ticker)?.dir;
                return (
                  <tr
                    key={row.ticker}
                    onClick={() => { setSelected(row); try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: row.ticker, asset: "stock" } })); } catch {} }}
                    className={cn(
                      "border-b border-white/[0.025] cursor-pointer transition-colors group",
                      isSelected ? "bg-emerald-400/[0.05]" : "hover:bg-white/[0.02]"
                    )}
                  >
                    <td className="px-3 py-1.5 text-[10px] text-white/14 tabular-nums">{idx + 1}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center h-[24px] min-w-[34px] px-1.5 rounded-sm text-[9px] font-bold text-white/90 shrink-0 border border-emerald-400/20"
                          style={{ background: `linear-gradient(135deg, rgba(52,211,153,${isSelected ? "0.30" : "0.18"}) 0%, rgba(6,78,59,0.40) 100%)` }}>
                          {row.ticker}
                        </span>
                        {dir && (
                          <span className={cn("text-[8px]", dir === 1 ? "text-emerald-400" : "text-red-400")}>
                            {dir === 1 ? "▲" : "▼"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 max-w-[200px] truncate text-[10px] text-white/35">{row.name}</td>
                    <td className="px-3 py-1.5 text-[9px] text-white/22 whitespace-nowrap">{row.category}</td>
                    <td className={cn("px-3 py-1.5 text-[11px] font-bold tabular-nums text-right", pos ? "text-emerald-300" : "text-red-400")}>
                      ${fmtPx(row.price)}
                    </td>
                    <td className={cn("px-3 py-1.5 text-[11px] font-semibold tabular-nums text-right", pos ? "text-emerald-400" : "text-red-400")}>
                      {pos ? "+" : ""}{row.pct.toFixed(2)}%
                    </td>
                    <td className={cn("px-3 py-1.5 text-[10px] tabular-nums text-right", pos ? "text-emerald-400/60" : "text-red-400/60")}>
                      {pos ? "+" : ""}${fmtPx(row.chg)}
                    </td>
                    <td className="px-3 py-1.5 text-[10px] text-emerald-400/50 tabular-nums text-right">${fmtPx(row.bid)}</td>
                    <td className="px-3 py-1.5 text-[10px] text-red-400/50   tabular-nums text-right">${fmtPx(row.ask)}</td>
                    <td className="px-3 py-1.5 text-[10px] text-white/45 tabular-nums text-right">{fmtVol(row.volume)}</td>
                    <td className="px-3 py-1.5 text-[10px] text-white/28 tabular-nums text-right">${fmtPx(row.w52hi)}</td>
                    <td className="px-3 py-1.5 text-[10px] text-white/28 tabular-nums text-right">${fmtPx(row.w52lo)}</td>
                    <td className="px-3 py-1.5 text-[10px] text-white/45 tabular-nums text-right">{fmtAum(row.aum)}</td>
                    <td className="px-3 py-1.5 text-[10px] text-white/30 tabular-nums text-right">{(row.expRatio * 100).toFixed(4)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Right detail panel — hidden on mobile ── */}
      <div className="hidden md:block w-[272px] shrink-0 h-full border-l border-white/[0.06] overflow-hidden">
        {selected ? (
          <DetailPanel key={selected.ticker} row={selected} live={selectedLive} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-[11px] text-white/20">Select an ETF</p>
          </div>
        )}
      </div>
    </div>
  );
}
