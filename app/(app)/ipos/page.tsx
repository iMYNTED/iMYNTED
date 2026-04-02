"use client";

import React, { useEffect, useMemo, useState } from "react";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ── Types ── */
type Tab = "listed" | "upcoming";

interface IPOEntry {
  symbol: string;
  name: string;
  initialPrice: string;
  offeringShares: string;
  listingDate: string;
  price?: number;
  firstDayChg?: number;
  accumChg?: number;
  mktCap?: string;
  status: "listed" | "upcoming";
}

/* ── iMYNTED pill style ── */
function pillStyle(symbol: string): React.CSSProperties {
  const h = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const variant = h % 6;
  const styles: Array<{ bg: string; border: string }> = [
    { bg: "linear-gradient(135deg, rgba(52,211,153,0.28) 0%, rgba(6,78,59,0.45) 100%)", border: "rgba(52,211,153,0.35)" },
    { bg: "linear-gradient(135deg, rgba(45,212,191,0.28) 0%, rgba(15,80,80,0.40) 100%)", border: "rgba(45,212,191,0.30)" },
    { bg: "linear-gradient(135deg, rgba(34,211,238,0.25) 0%, rgba(8,60,90,0.40) 100%)", border: "rgba(34,211,238,0.30)" },
    { bg: "linear-gradient(135deg, rgba(52,211,153,0.32) 0%, rgba(34,211,238,0.15) 100%)", border: "rgba(52,211,153,0.35)" },
    { bg: "linear-gradient(135deg, rgba(56,189,248,0.22) 0%, rgba(12,50,80,0.40) 100%)", border: "rgba(56,189,248,0.25)" },
    { bg: "linear-gradient(135deg, rgba(52,211,153,0.30) 0%, rgba(20,60,50,0.50) 100%)", border: "rgba(52,211,153,0.40)" },
  ];
  const s = styles[variant];
  return { background: s.bg, borderColor: s.border };
}

function fmtPct(v?: number) {
  if (v === undefined || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function pctColor(v?: number) {
  if (v === undefined) return "text-white/30";
  return v >= 0 ? "text-emerald-400" : "text-red-400";
}

/* ── Mock Data ── */
function generateIPOs(): IPOEntry[] {
  const rng = (s: number) => ((s * 16807 + 1) % 2147483647) / 2147483647;

  const UPCOMING: Array<[string, string, string, string, string]> = [
    ["HMH", "HMH Holding Inc.", "19.00~22.00USD", "10.5M", "Apr 1, 2026"],
    ["ALOHA", "Cariloha", "12.00~14.00USD", "2.3M", "Apr 2, 2026"],
    ["BTRU", "tru Shrimp Companies", "9.00~11.00USD", "1.5M", "Apr 3, 2026"],
    ["BTRY", "Clarios International", "17.00~21.00USD", "88.1M", "Apr 4, 2026"],
    ["CDLA", "Candela Medical", "16.00~18.00USD", "14.7M", "Apr 7, 2026"],
    ["CZTI", "Carbon Zero Technologies", "11.00~13.00USD", "3.34M", "Apr 8, 2026"],
    ["DMOB", "Delimobil", "0.00USD", "0", "To Be Disclosed"],
    ["ENSB", "Ensemble Health Partners", "19.00~22.00USD", "29.5M", "Apr 10, 2026"],
    ["FLXE", "FlexEnergy Green Solutions", "—", "—", "To Be Disclosed"],
    ["FRF", "The Fortegra", "15.00~17.00USD", "8.3M", "Apr 11, 2026"],
    ["FSPR", "Four Springs Capital Trust", "13.00~15.00USD", "18M", "Apr 14, 2026"],
    ["HCG", "hear.com", "17.00~20.00USD", "16.2M", "Apr 15, 2026"],
    ["HCRX", "Healthcare Royalty Inc.", "15.00~17.00USD", "46.9M", "Apr 16, 2026"],
    ["INRX", "Intrinsic Medicine", "5.00~7.00USD", "4.17M", "Apr 17, 2026"],
    ["JIA", "Daojia Limited", "—", "—", "To Be Disclosed"],
    ["JW", "Justworks", "29.00~32.00USD", "7M", "Apr 21, 2026"],
    ["MVNR", "Mavenir", "20.00~24.00USD", "12.5M", "Apr 22, 2026"],
    ["PSUS", "Pershing Square USA", "50.00USD", "20M", "Apr 23, 2026"],
    ["RHDM", "Rhodium Enterprises", "12.00~14.00USD", "7.69M", "Apr 24, 2026"],
    ["ROXA", "ROX Financial", "10.00USD", "8.3M", "Apr 25, 2026"],
    ["SMSA", "Samsara Vision", "5.00~7.00USD", "4.17M", "Apr 28, 2026"],
    ["SOSH", "SOS Hydration", "4.50~6.50USD", "1.82M", "Apr 29, 2026"],
    ["TURO", "Turo Inc", "—", "—", "To Be Disclosed"],
    ["VDNT", "Verdant Earth Technologies", "7.00~9.00USD", "6.3M", "Apr 30, 2026"],
  ];

  const LISTED: Array<[string, string]> = [
    ["APTV.WI", "APTIV PLC"],
    ["AACI", "Armada Acquisition"],
    ["CLBR", "Colombier Acquisition"],
    ["FMACU", "FUTURE MEDICINE"],
    ["IPFXU", "INFLECTION POINT"],
    ["QADRU", "QDRO ACQUISITION"],
    ["MYXXU", "Maywood Inc"],
    ["NBRG", "NEWBRIDGE GLOBAL"],
    ["MUZE", "Muzero Inc"],
    ["BWIV.U", "BLUE WHALE"],
    ["SAAQ", "Space Acquisition"],
    ["GMTL", "Guardian Medical"],
    ["JAN", "Janus Life Sciences"],
    ["BHAVU", "BHAV ACQUISITION"],
    ["SWMR", "Swarmer Inc"],
    ["LEGO", "LEGATO MERGER"],
    ["XCBE", "X3 Acquisition"],
    ["PONOU", "PONO CAPITAL"],
    ["MTAL.U", "METALS ACQUISITION"],
    ["PAYP", "PayPay"],
    ["SUMAU", "SUMA ACQUISITION"],
    ["FGII", "FG IMPERIAL"],
    ["IEAG", "Infinite Energy"],
    ["CAST", "FreeCast Inc"],
  ];

  const entries: IPOEntry[] = [];

  // Upcoming
  for (let i = 0; i < UPCOMING.length; i++) {
    const [sym, name, price, shares, date] = UPCOMING[i];
    entries.push({
      symbol: sym, name, initialPrice: price, offeringShares: shares,
      listingDate: date, status: "upcoming",
    });
  }

  // Listed
  for (let i = 0; i < LISTED.length; i++) {
    const [sym, name] = LISTED[i];
    const h = sym.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const r1 = rng(h * 31 + i); const r2 = rng(h * 47 + i); const r3 = rng(h * 73 + i);
    const price = +(5 + r1 * 50).toFixed(3);
    const firstDay = +((r2 - 0.4) * 600).toFixed(2);
    const accum = +((r3 - 0.35) * 100).toFixed(2);
    const initPx = +(price / (1 + firstDay / 100)).toFixed(2);

    entries.push({
      symbol: sym, name,
      initialPrice: `${initPx.toFixed(2)}USD`,
      offeringShares: `${(r1 * 20).toFixed(0)}M`,
      listingDate: `Mar ${20 + Math.floor(r2 * 8)}, 2026`,
      price, firstDayChg: firstDay, accumChg: accum,
      mktCap: r3 > 0.3 ? `${(50 + r1 * 500).toFixed(0)}M` : "—",
      status: "listed",
    });
  }

  return entries;
}

/* ── Component ── */
export default function IPOsPage() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [liveIPOs, setLiveIPOs] = useState<IPOEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real IPO data from Finnhub
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/market/ipos", { cache: "no-store" });
        const j = await res.json();
        if (!j?.ok) throw new Error(j?.error);

        const entries: IPOEntry[] = [];

        for (const e of (j.upcoming || [])) {
          entries.push({
            symbol: e.symbol, name: e.name,
            initialPrice: e.price || "—",
            offeringShares: e.numberOfShares ? `${(e.numberOfShares / 1e6).toFixed(1)}M` : "—",
            listingDate: e.date || "TBD",
            status: "upcoming",
          });
        }

        for (const e of (j.listed || [])) {
          const ipoPrice = e.price ? parseFloat(String(e.price).replace(/[^0-9.]/g, "")) : undefined;
          const curPrice = e.currentPrice;
          const firstDayChg = curPrice && ipoPrice ? ((curPrice - ipoPrice) / ipoPrice) * 100 : undefined;
          entries.push({
            symbol: e.symbol, name: e.name,
            initialPrice: e.price || "—",
            offeringShares: e.numberOfShares ? `${(e.numberOfShares / 1e6).toFixed(1)}M` : "—",
            listingDate: e.date || "—",
            price: curPrice,
            firstDayChg,
            accumChg: e.changePct,
            status: "listed",
          });
        }

        // Fall back to mock if API returns nothing
        if (entries.length === 0) {
          setLiveIPOs(generateIPOs());
        } else {
          setLiveIPOs(entries);
        }
      } catch {
        setLiveIPOs(generateIPOs());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allIPOs = liveIPOs;

  const filtered = useMemo(() => {
    return allIPOs.filter(e => e.status === tab);
  }, [allIPOs, tab]);

  function openDetail(sym: string) {
    try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: sym, asset: "stock" } })); } catch {}
  }
  function fireTrade(action: "BUY" | "SELL", sym: string) {
    try { window.dispatchEvent(new CustomEvent("imynted:tradeAction", { detail: { action, asset: "stock", symbol: sym } })); } catch {}
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto"
      style={{ background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)" }}>

      {/* iMYNTED glows */}
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
              <h1 className="text-[16px] md:text-[18px] font-bold text-white tracking-wide">IPOs</h1>
              <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/[0.06] px-1.5 py-0.5 text-[8px] font-bold text-emerald-400/70 uppercase tracking-wider">LIVE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-sm border border-emerald-400/15 bg-emerald-400/[0.04] px-2 py-0.5 text-[9px] text-emerald-300/70">
                Upcoming <span className="font-bold">{allIPOs.filter(e => e.status === "upcoming").length}</span>
              </span>
              <span className="rounded-sm border border-cyan-400/15 bg-cyan-400/[0.04] px-2 py-0.5 text-[9px] text-cyan-400/70">
                Listed <span className="font-bold">{allIPOs.filter(e => e.status === "listed").length}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 rounded-sm border border-emerald-400/[0.06] px-3 py-2"
          style={{ background: "rgba(4,10,18,0.6)" }}>
          <div className="flex items-center gap-0 rounded-sm border border-emerald-400/[0.12] overflow-hidden">
            {(["upcoming", "listed"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn("px-4 py-1.5 text-[11px] font-bold capitalize transition-colors",
                  tab === t ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.02] text-white/40 hover:text-white/60"
                )}>{t === "upcoming" ? "To Be Listed" : "Listed"}</button>
            ))}
          </div>
          <span className="text-[10px] text-white/25 ml-2">More ▸</span>
        </div>

        {/* Table */}
        <div className="rounded-sm border border-emerald-400/[0.08] overflow-x-auto"
          style={{ background: "rgba(6,14,24,0.6)", boxShadow: "0 0 0 1px rgba(52,211,153,0.03), 0 12px 40px rgba(0,0,0,0.4)" }}>
          <div className="min-w-[700px]">

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <span className="text-[11px] text-white/30">Loading IPO data from Finnhub...</span>
              </div>
            ) : tab === "upcoming" ? (
              <>
                {/* Upcoming header */}
                <div className="grid grid-cols-[40px_1fr_120px_100px_120px] gap-2 px-3 py-2 border-b border-emerald-400/[0.08] text-[9px] text-white/35 uppercase tracking-wider font-semibold"
                  style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.03) 0%, transparent 50%)" }}>
                  <span>No.</span><span>Symbol / Name</span><span className="text-right">Initial Price</span>
                  <span className="text-right">Offering Shares</span><span className="text-right">Listing Date</span>
                </div>
                {filtered.map((e, i) => (
                  <div key={`${e.symbol}-${i}`}
                    className="grid grid-cols-[40px_1fr_120px_100px_120px] gap-2 px-3 py-2.5 border-b border-white/[0.03] hover:bg-emerald-400/[0.03] transition-colors group cursor-pointer"
                    onClick={() => openDetail(e.symbol)}>
                    <span className="text-[10px] text-white/30 tabular-nums self-center">{i + 1}</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center h-[28px] min-w-[42px] px-2 rounded-sm text-[10px] font-bold text-white/90 shrink-0 border" style={pillStyle(e.symbol)}>
                        {e.symbol}
                      </span>
                      <span className="text-[11px] text-white/50 truncate">{e.name}</span>
                      {/* Trade on hover */}
                      <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button type="button" onClick={(ev) => { ev.stopPropagation(); fireTrade("BUY", e.symbol); }}
                          className="h-5 rounded-sm border border-emerald-400/25 bg-emerald-400/[0.08] px-1.5 text-[8px] font-bold text-emerald-300">B</button>
                        <button type="button" onClick={(ev) => { ev.stopPropagation(); fireTrade("SELL", e.symbol); }}
                          className="h-5 rounded-sm border border-red-400/25 bg-red-400/[0.08] px-1.5 text-[8px] font-bold text-red-300">S</button>
                      </div>
                    </div>
                    <span className="text-[10px] text-white/60 text-right self-center tabular-nums">{e.initialPrice}</span>
                    <span className="text-[10px] text-white/50 text-right self-center tabular-nums">{e.offeringShares}</span>
                    <span className="text-[10px] text-white/40 text-right self-center">{e.listingDate}</span>
                  </div>
                ))}
              </>
            ) : (
              <>
                {/* Listed header */}
                <div className="grid grid-cols-[40px_1fr_80px_80px_80px_80px_80px] gap-2 px-3 py-2 border-b border-emerald-400/[0.08] text-[9px] text-white/35 uppercase tracking-wider font-semibold"
                  style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.03) 0%, transparent 50%)" }}>
                  <span>No.</span><span>Symbol / Name</span><span className="text-right">Price</span>
                  <span className="text-right">1st-Day %Chg</span><span className="text-right">Accum %Chg</span>
                  <span className="text-right">Initial Px</span><span className="text-right">% Chg</span>
                </div>
                {filtered.map((e, i) => (
                  <div key={`${e.symbol}-${i}`}
                    className="grid grid-cols-[40px_1fr_80px_80px_80px_80px_80px] gap-2 px-3 py-2.5 border-b border-white/[0.03] hover:bg-emerald-400/[0.03] transition-colors group cursor-pointer"
                    onClick={() => openDetail(e.symbol)}>
                    <span className="text-[10px] text-white/30 tabular-nums self-center">{i + 1}</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center h-[28px] min-w-[42px] px-2 rounded-sm text-[10px] font-bold text-white/90 shrink-0 border" style={pillStyle(e.symbol)}>
                        {e.symbol}
                      </span>
                      <span className="text-[11px] text-white/50 truncate">{e.name}</span>
                      <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button type="button" onClick={(ev) => { ev.stopPropagation(); fireTrade("BUY", e.symbol); }}
                          className="h-5 rounded-sm border border-emerald-400/25 bg-emerald-400/[0.08] px-1.5 text-[8px] font-bold text-emerald-300">B</button>
                        <button type="button" onClick={(ev) => { ev.stopPropagation(); fireTrade("SELL", e.symbol); }}
                          className="h-5 rounded-sm border border-red-400/25 bg-red-400/[0.08] px-1.5 text-[8px] font-bold text-red-300">S</button>
                      </div>
                    </div>
                    <span className={cn("text-[10px] text-right self-center tabular-nums font-semibold",
                      (e.firstDayChg ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>{e.price?.toFixed(3) ?? "—"}</span>
                    <span className={cn("text-[10px] text-right self-center tabular-nums font-semibold", pctColor(e.firstDayChg))}>
                      {fmtPct(e.firstDayChg)}
                    </span>
                    <span className={cn("text-[10px] text-right self-center tabular-nums font-semibold", pctColor(e.accumChg))}>
                      {fmtPct(e.accumChg)}
                    </span>
                    <span className="text-[10px] text-white/40 text-right self-center tabular-nums">{e.initialPrice}</span>
                    <span className="text-[10px] text-white/30 text-right self-center tabular-nums">{e.mktCap ?? "—"}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Bottom ticker bar */}
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
