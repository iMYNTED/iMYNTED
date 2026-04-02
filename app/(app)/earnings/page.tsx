"use client";

import { useEffect, useMemo, useState } from "react";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ── Types ── */
type ViewMode = "day" | "week" | "month";
type Session = "pre" | "intraday" | "post";
type SortKey = "hot" | "mktCap" | "optVol" | "iv" | "ivRank" | "ivPct";

interface EarningsEntry {
  symbol: string;
  name: string;
  session: Session;
  date: string;
  mktCap: number;
  optVol: number;
  iv: number;
  ivRank: number;
  ivPct: number;
  hot: number;
  color: string;
  price: number;
  fiscalYear: string;
  peTTM: number;
  actRevenue: string;
  estRevenue: string;
}

/* ── iMYNTED pill style — matches sector heatmap pills ── */
function pillStyle(symbol: string): React.CSSProperties {
  const h = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const variant = h % 6;
  // iMYNTED sector-style pill gradients — strong, visible, "pops"
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

/* ── Generate massive mock earnings data ── */
function generateEarnings(): EarningsEntry[] {
  const base = new Date();
  const monday = new Date(base);
  monday.setDate(base.getDate() - base.getDay() + 1);

  // Huge symbol list — real tickers for realism
  const POOL: Array<[string, string]> = [
    ["ABVX","Abivax"],["PPHC","PHP Ventures"],["WRD","WRD Ent"],["BNGO","Bionano"],["LAR","Larimar"],
    ["AGBK","AgriBank"],["CMCL","Camelot"],["WHGLY","WH Group"],["IRDEY","iRobot"],["CHFHY","ChemFab"],
    ["WUXAY","WuXi Bio"],["FRSHY","FreshPet"],["HLDCY","Heidelberg"],["LPGCY","LPGC Holdings"],
    ["CEBUY","Ceb Inc"],["SZGPY","Suzuki"],["HDVTY","HD Vista"],["TYCMY","Toyota"],["MNTHY","Mondelez"],
    ["NGCRY","Nagarro"],["GMHS","GreenMed"],["BLRX","BioLineRx"],["MOB","Mobius"],["MOHCY","Mohan"],
    ["EVTL","Vertical Aero"],["HSAI","Hesai Group"],["CNXC","Concentrix"],["ACHV","Achieve Life"],
    ["LENZ","Lenz Thera"],["VELO","Velo3D"],["CMCM","Cheetah"],["PESI","Perma-Pipe"],
    ["SFD","Sandfire Res"],["NRXP","NRx Pharma"],["CNM","Core & Main"],["FENC","Fennec Pharma"],
    ["KGFHY","Kingfisher"],["BSEM","Biosemi"],["MXUBY","Maximus"],["WILC","G. Willi-Food"],
    ["GME","GameStop"],["BZAI","Banzai Intl"],["PDD","PDD Holdings"],["CHWY","Chewy"],
    ["KC","Kingsoft Cloud"],["KALV","KalVista"],["PAYX","Paychex"],["CTAS","Cintas"],
    ["WGO","Winnebago"],["EDAP","EDAP TMS"],["CGNT","Cognyte"],["BZUN","Baozun"],
    ["AIR","AAR Corp"],["ENLV","Enlivex"],["EPSN","Epsilon"],["SY","So-Young"],
    ["ZH","Zhihu"],["MLKN","MillerKnoll"],["EPAC","Enerpac"],["CTSO","Cytosorbents"],
    ["BYND","Beyond Meat"],["JBS","JBS Foods"],["PONY","Pony AI"],["WYFI","WiFi Sys"],
    ["CMC","Commercial Metals"],["DBI","Designer Brands"],["LOVE","Lovesac"],["REX","REX Energy"],
    ["SCVL","Shoe Carnival"],["RMTI","Rockwell Med"],["ABOS","Aclarion"],["DOO","BRP Inc"],
    ["KNOP","KNOT Offshore"],["NXGPY","Nexgen"],["MDIKY","Medika"],["SPRO","Spero Thera"],
    ["VERI","Veritone"],["AGX","Argan Inc"],["TMC","TMC Metals"],["KOPN","Kopin Corp"],
    ["HUMA","Humacyte"],["AUTL","Autolus"],["LGN","Logan Ridge"],["CUK","Carnival UK"],
    ["CCL","Carnival Corp"],["ORGN","Origin Materials"],["CRCCY","CRCC High-Tech"],
    ["ATONY","AutoNation"],["FRTRY","Forterra"],["GWLLY","Great Wall"],["BACHY","Bank of China"],
    ["BATL","Battalion Oil"],["NVDA","NVIDIA"],["TSLA","Tesla"],["AAPL","Apple"],
    ["MSFT","Microsoft"],["AMZN","Amazon"],["META","Meta"],["NFLX","Netflix"],
    ["AMD","Advanced Micro"],["INTC","Intel"],["PLTR","Palantir"],["COIN","Coinbase"],
    ["SOFI","SoFi"],["NIO","NIO Inc"],["BA","Boeing"],["DIS","Disney"],
    ["JPM","JPMorgan"],["GS","Goldman Sachs"],["BAC","Bank of America"],
    ["RBLX","Roblox"],["SNAP","Snap Inc"],["UBER","Uber"],
    ["LYFT","Lyft"],["DASH","DoorDash"],["ABNB","Airbnb"],["SQ","Block Inc"],
    // Extra tickers for density
    ["DLMAY","Dollarama"],["XIACY","Xiaomi"],["CRCBY","China Resources"],
    ["WXXWY","WiXX Corp"],["DPNEY","Dupont"],["DLNDY","Dolland"],
    ["SMTI","Sanmina"],["LITB","LightBridge"],["HMR","Helmerich"],["LEAT","Leatt Corp"],
    ["FRBP","FRB Corp"],["GUTS","Gutsense"],["DLPN","Delphinus"],["SSHLY","SSH Ltd"],
    ["BCCMY","BCCMedia"],["ERCLY","Eraclea"],["DELKY","Delkor"],["VIOT","VioTech"],
    ["WDH","WD Holdings"],["REED","Reed Elsevier"],["LOCL","Local Corp"],
    ["NPACY","NPC Asia"],["QTI","QTI Inc"],["SNBOY","Shenbo"],["JHPCY","JHP Corp"],
    ["SHZNY","Shenzhen"],["URMCY","Uralmech"],["KSHTY","Kashito"],["TVBCY","TVB Corp"],
    ["ICU","SeaStar Med"],["PLNH","Planet Hemp"],["TIVC","TiVo Corp"],
    ["MCHX","Marchex"],["PMI","Phillip Morris"],["OIBRQ","Oi SA"],["OIBZQ","Oi SA B"],
    ["EQUEY","Equey"],["AAPG","AAPG Inc"],["PNGAY","Ping An"],["CIIHF","China Int"],
    ["CIIHY","China Intl"],["XTEPY","Extepy"],["PPCCY","PPC Corp"],["SNFRY","Sanofi"],
    ["PIAIF","Pia Inc B"],["CRBJY","CRB Corp"],["MPNGY","MPNG Corp"],["CHPXF","Chapex"],
    ["CGASY","CGA Corp"],["SHMAY","Shimao"],["HNNMY","Hennam"],["CSWYY","Cosway"],
    ["HSHCY","HSH Corp"],["HRSHF","Hersha"],["LPPSY","LPPS Inc"],["DNOPY","Denop"],
    ["RKAGY","RKA Group"],["PBSFY","PBS Fin"],["IPHA","Innov Pharma"],
    ["TEZNY","Tezan"],["QIHCF","QIH Corp"],["CNINF","CNN Fin"],["IVBIY","IVB Inc"],
    ["KPELY","Kopel"],["SYYNY","Syyn Corp"],["JIAXF","Jia Xing"],
    ["TSGTY","TSGT Corp"],["TSGTF","TSGT Fin"],
    ["CFEIY","CFE Inc"],["TSYHY","TSY Corp"],["DELHY","Delhi Corp"],["HPGLY","HPG Ltd"],
    ["SKYX","Sky Holdings"],["SNWV","SunWave"],
    ["DERM","Dermata"],["CLGN","Collplant"],["AICAF","AIC Corp"],["POAHY","PostNL"],
    ["CEVIY","CEV Inc"],["BYDDY","BYD Co"],["ZSHGY","ZSH Group"],["FBIOP","Fortress Bio"],
  ];

  const entries: EarningsEntry[] = [];
  const rng = (s: number) => ((s * 16807 + 1) % 2147483647) / 2147483647;

  for (let i = 0; i < POOL.length; i++) {
    const [sym, name] = POOL[i];
    const h = sym.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const r1 = rng(h * 31 + i); const r2 = rng(h * 47 + i); const r3 = rng(h * 73 + i);

    const dayOff = Math.floor(r1 * 7); // 0-6 (Mon-Sun)
    const session: Session = r2 < 0.45 ? "pre" : r2 < 0.9 ? "post" : "intraday";

    const d = new Date(monday);
    d.setDate(d.getDate() + dayOff);

    const r4 = rng(h * 97 + i);
    const price = +(1 + r4 * 400).toFixed(2);
    const pe = r3 > 0.3 ? +(3 + r2 * 40).toFixed(3) : 0;
    const rev = r1 > 0.5 ? `${(10 + r3 * 2000).toFixed(0)}M` : "";
    const estRev = r2 > 0.4 ? `${(10 + r1 * 2000).toFixed(0)}M` : "";

    entries.push({
      symbol: sym, name, session,
      date: d.toISOString().slice(0, 10),
      mktCap: Math.round(100000000 + r3 * 50000000000),
      optVol: Math.round(500 + r1 * 80000),
      iv: Math.round(20 + r2 * 150),
      ivRank: Math.round(r3 * 100),
      ivPct: Math.round(r2 * 100),
      hot: Math.round(r1 * 100),
      color: "", // unused — using pillBg() inline
      price,
      fiscalYear: `2025Q${1 + Math.floor(r4 * 4)}`,
      peTTM: pe,
      actRevenue: rev,
      estRevenue: estRev,
    });
  }

  return entries;
}

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtMktCap(v: number) {
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  return `${(v / 1e3).toFixed(0)}K`;
}
function fmtVol(v: number) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "hot", label: "Hot" },
  { key: "mktCap", label: "Market Cap" },
  { key: "optVol", label: "Options Volume" },
  { key: "iv", label: "IV" },
  { key: "ivRank", label: "IV Rank" },
  { key: "ivPct", label: "IV Percentile" },
];

/* ── Component ── */
export default function EarningsCalendarPage() {
  const [view, setView] = useState<ViewMode>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [sortBy, setSortBy] = useState<SortKey>("optVol");
  const [sortOpen, setSortOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const [liveEarnings, setLiveEarnings] = useState<EarningsEntry[] | null>(null);

  // Fetch real earnings from Finnhub when week changes
  useEffect(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const from = monday.toISOString().split("T")[0];
    const to = sunday.toISOString().split("T")[0];

    (async () => {
      try {
        const res = await fetch(`/api/market/earnings?from=${from}&to=${to}`, { cache: "no-store" });
        const j = await res.json();
        if (!j?.ok || !j.entries?.length) return;

        const rng = (s: number) => ((s * 16807 + 1) % 2147483647) / 2147483647;
        const entries: EarningsEntry[] = j.entries.map((e: any, i: number) => {
          const h = (e.symbol || "").split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
          const r1 = rng(h * 31 + i); const r2 = rng(h * 47 + i); const r3 = rng(h * 73 + i);
          const session: Session = e.hour === "bmo" ? "pre" : e.hour === "amc" ? "post" : "intraday";
          return {
            symbol: e.symbol, name: e.symbol, session,
            date: e.date,
            mktCap: Math.round(100000000 + r3 * 50000000000),
            optVol: Math.round(500 + r1 * 80000),
            iv: Math.round(20 + r2 * 150),
            ivRank: Math.round(r3 * 100),
            ivPct: Math.round(r2 * 100),
            hot: Math.round(r1 * 100),
            color: "",
            price: 0,
            fiscalYear: `${e.year || 2026}Q${e.quarter || 1}`,
            peTTM: 0,
            actRevenue: e.revenueActual ? `${(e.revenueActual / 1e6).toFixed(0)}M` : "",
            estRevenue: e.revenueEstimate ? `${(e.revenueEstimate / 1e6).toFixed(0)}M` : "",
          };
        });
        setLiveEarnings(entries);
      } catch {}
    })();
  }, [weekOffset]);

  const allEarnings = liveEarnings ?? generateEarnings();

  const currentMonday = useMemo(() => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);


  // Sort function
  function sortFn(a: EarningsEntry, b: EarningsEntry) {
    if (sortBy === "mktCap") return b.mktCap - a.mktCap;
    if (sortBy === "optVol") return b.optVol - a.optVol;
    if (sortBy === "iv") return b.iv - a.iv;
    if (sortBy === "ivRank") return b.ivRank - a.ivRank;
    if (sortBy === "ivPct") return b.ivRank - a.ivRank;
    return b.hot - a.hot;
  }

  // Group by day + filter
  const byDay = useMemo(() => {
    const q = filter.toUpperCase().trim();
    const filtered = q ? allEarnings.filter(e => e.symbol.includes(q) || e.name.toUpperCase().includes(q)) : allEarnings;
    const map: Record<number, EarningsEntry[]> = {};
    for (let i = 0; i < 7; i++) map[i] = [];
    for (const e of filtered) {
      const ed = new Date(e.date + "T00:00:00");
      const diff = Math.round((ed.getTime() - currentMonday.getTime()) / 86400000);
      if (diff >= 0 && diff < 7) map[diff].push(e);
    }
    for (const k of Object.keys(map)) map[Number(k)].sort(sortFn);
    return map;
  }, [allEarnings, currentMonday, sortBy, filter]);

  // Stats
  const totalCount = useMemo(() => Object.values(byDay).flat().length, [byDay]);
  const preCount = useMemo(() => Object.values(byDay).flat().filter(e => e.session === "pre" || e.session === "intraday").length, [byDay]);
  const postCount = useMemo(() => Object.values(byDay).flat().filter(e => e.session === "post").length, [byDay]);
  const highestIV = useMemo(() => {
    const all = Object.values(byDay).flat();
    if (!all.length) return null;
    return all.reduce((best, e) => e.iv > (best?.iv ?? 0) ? e : best, all[0]);
  }, [byDay]);

  function openDetail(sym: string) {
    try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: sym, asset: "stock" } })); } catch {}
  }
  function fireTrade(action: "BUY" | "SELL", sym: string) {
    try { window.dispatchEvent(new CustomEvent("imynted:tradeAction", { detail: { action, asset: "stock", symbol: sym } })); } catch {}
  }

  const selectedSortLabel = SORT_OPTIONS.find(s => s.key === sortBy)?.label ?? "Options Volume";

  return (
    <div className="h-full min-h-0 overflow-y-auto"
      style={{ background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)" }}>

      {/* iMYNTED signature glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 55% 35% at 5% 0%, rgba(52,211,153,0.07) 0%, transparent 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 30% 20% at 95% 100%, rgba(34,211,238,0.04) 0%, transparent 100%)" }} />
      </div>

      <div className="relative z-10 px-2 md:px-4 py-3 space-y-3">

        {/* Header — iMYNTED brand */}
        <div className="rounded-sm border border-emerald-400/[0.08] px-3 md:px-4 py-3"
          style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.05) 0%, rgba(4,10,18,0.95) 40%)" }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-[0.14em] text-emerald-400/80 uppercase">iMYNTED</span>
              <span className="text-white/15">|</span>
              <h1 className="text-[16px] md:text-[18px] font-bold text-white tracking-wide">EARNINGS CALENDAR</h1>
              <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/[0.06] px-1.5 py-0.5 text-[8px] font-bold text-emerald-400/70 uppercase tracking-wider">LIVE</span>
            </div>
            {/* Summary chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="rounded-sm border border-emerald-400/15 bg-emerald-400/[0.04] px-2 py-0.5 text-[9px] text-emerald-300/70">
                <span className="font-bold text-emerald-300">{totalCount}</span> earnings
              </span>
              <span className="rounded-sm border border-cyan-400/15 bg-cyan-400/[0.04] px-2 py-0.5 text-[9px] text-cyan-400/70">
                Pre <span className="font-bold">{preCount}</span>
              </span>
              <span className="rounded-sm border border-amber-400/15 bg-amber-400/[0.04] px-2 py-0.5 text-[9px] text-amber-400/70">
                Post <span className="font-bold">{postCount}</span>
              </span>
              {highestIV && (
                <span className="rounded-sm border border-red-400/15 bg-red-400/[0.04] px-2 py-0.5 text-[9px] text-red-400/70">
                  Top IV: <span className="font-bold">{highestIV.symbol} {highestIV.iv}%</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between gap-2 flex-wrap rounded-sm border border-emerald-400/[0.06] px-3 py-2"
          style={{ background: "rgba(4,10,18,0.6)" }}>
          {/* View toggle */}
          <div className="flex items-center gap-0 rounded-sm border border-emerald-400/[0.12] overflow-hidden">
            {(["day", "week", "month"] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn("px-3 py-1 text-[10px] font-bold capitalize transition-colors",
                  view === v ? "bg-emerald-400/15 text-emerald-300 border-r border-emerald-400/20" : "bg-white/[0.02] text-white/40 hover:text-white/60 border-r border-white/[0.06]"
                )}>{v}</button>
            ))}
          </div>

          {/* Month/Year picker + arrows */}
          <div className="flex items-center gap-2">
            <select
              value={`${currentMonday.getFullYear()}-${String(currentMonday.getMonth() + 1).padStart(2, "0")}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                const target = new Date(y, m - 1, 1);
                // Find the Monday of that week
                const dayOfWeek = target.getDay();
                const mondayTarget = new Date(target);
                mondayTarget.setDate(target.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
                // Calculate week offset from current week
                const now = new Date();
                const currentMon = new Date(now);
                currentMon.setDate(now.getDate() - now.getDay() + 1);
                currentMon.setHours(0, 0, 0, 0);
                const diff = Math.round((mondayTarget.getTime() - currentMon.getTime()) / (7 * 86400000));
                setWeekOffset(diff);
              }}
              className="rounded-sm border border-emerald-400/[0.12] bg-black/40 px-2 py-1 text-[13px] font-semibold text-white outline-none focus:border-emerald-400/30 appearance-none cursor-pointer"
              style={{ backgroundImage: "none" }}
            >
              {Array.from({ length: 24 }, (_, i) => {
                const d = new Date();
                d.setMonth(d.getMonth() - 6 + i);
                const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                return <option key={val} value={val} className="bg-[#060e18]">{label}</option>;
              })}
            </select>
            <button onClick={() => setWeekOffset(w => w - 1)}
              className="rounded-sm border border-emerald-400/[0.12] bg-emerald-400/[0.03] w-7 h-7 flex items-center justify-center text-[11px] text-white/50 hover:text-emerald-300 hover:bg-emerald-400/[0.08] transition-colors">◀</button>
            <button onClick={() => setWeekOffset(w => w + 1)}
              className="rounded-sm border border-emerald-400/[0.12] bg-emerald-400/[0.03] w-7 h-7 flex items-center justify-center text-[11px] text-white/50 hover:text-emerald-300 hover:bg-emerald-400/[0.08] transition-colors">▶</button>
            <button onClick={() => setWeekOffset(0)}
              className="rounded-sm border border-white/10 bg-white/[0.03] px-2 py-1 text-[9px] text-white/40 hover:text-white/70 transition-colors">Today</button>
          </div>

          {/* Filter */}
          <input
            value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="Search symbol..."
            className="w-[120px] md:w-[160px] rounded-sm border border-emerald-400/[0.1] bg-black/30 px-2.5 py-1.5 text-[10px] text-white outline-none placeholder:text-white/25 focus:border-emerald-400/30"
          />

          {/* Sort dropdown */}
          <div className="relative ml-auto">
            <button onClick={() => setSortOpen(!sortOpen)}
              className="flex items-center gap-1.5 rounded-sm border border-emerald-400/[0.12] bg-emerald-400/[0.03] px-3 py-1.5 text-[10px] text-white/60 hover:text-emerald-300 transition-colors">
              <span>{selectedSortLabel}</span>
              <span className="text-[8px]">▼</span>
            </button>
            {sortOpen && (
              <div className="absolute top-full right-0 mt-1 z-50 rounded-sm border border-emerald-400/15 overflow-hidden min-w-[160px]"
                style={{ background: "rgba(5,12,20,0.98)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                {SORT_OPTIONS.map(s => (
                  <button key={s.key} type="button"
                    onClick={() => { setSortBy(s.key); setSortOpen(false); }}
                    className={cn("w-full text-left px-3 py-2 text-[11px] transition-colors flex items-center justify-between",
                      sortBy === s.key ? "bg-emerald-400/[0.08] text-emerald-300" : "text-white/60 hover:bg-white/[0.04]"
                    )}>
                    <span>{s.label}</span>
                    {sortBy === s.key && <span className="text-emerald-400">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Day view — detailed table */}
        {view === "day" && (() => {
          const todayEntries = Object.values(byDay).flat().sort(sortFn);
          return (
            <div className="rounded-sm border border-white/[0.06] overflow-x-auto" style={{ background: "rgba(6,14,24,0.6)" }}>
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[60px_1fr_70px_80px_70px_80px_50px_60px_65px_65px_80px_80px] gap-1 px-3 py-2 border-b border-white/[0.06] bg-black/30 text-[9px] text-white/35 uppercase tracking-wider font-semibold">
                  <span>Date</span><span>Symbol / Name</span><span className="text-right">Fiscal</span><span className="text-right">Mkt Cap</span>
                  <span className="text-right">Price</span><span className="text-right">Opt Vol</span><span className="text-right">IV</span>
                  <span className="text-right">IV Rank</span><span className="text-right">IV Pct</span><span className="text-right">P/E TTM</span>
                  <span className="text-right">Act Rev</span><span className="text-right">Est Rev</span>
                </div>
                {todayEntries.map((e, i) => (
                  <div key={`${e.symbol}-${i}`}
                    className="grid grid-cols-[60px_1fr_70px_80px_70px_80px_50px_60px_65px_65px_80px_80px] gap-1 px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors group cursor-pointer"
                    onClick={() => openDetail(e.symbol)}>
                    <span className="text-[10px] text-white/35 tabular-nums self-center">{e.date.slice(5)}</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center h-[28px] min-w-[38px] px-2 rounded-sm text-[10px] font-bold text-white/90 shrink-0 border" style={pillStyle(e.symbol)}>
                        {e.symbol}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-white/90 group-hover:text-emerald-300 transition-colors truncate">{e.symbol}</div>
                        <div className="text-[9px] text-white/30 truncate">{e.name}</div>
                      </div>
                      <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button type="button" onClick={(ev) => { ev.stopPropagation(); fireTrade("BUY", e.symbol); }}
                          className="h-5 rounded-sm border border-emerald-400/25 bg-emerald-400/[0.08] px-1.5 text-[8px] font-bold text-emerald-300">B</button>
                        <button type="button" onClick={(ev) => { ev.stopPropagation(); fireTrade("SELL", e.symbol); }}
                          className="h-5 rounded-sm border border-red-400/25 bg-red-400/[0.08] px-1.5 text-[8px] font-bold text-red-300">S</button>
                      </div>
                    </div>
                    <span className="text-[10px] text-white/50 text-right self-center tabular-nums">{e.fiscalYear}</span>
                    <span className="text-[10px] text-white/60 text-right self-center tabular-nums">{fmtMktCap(e.mktCap)}</span>
                    <span className={cn("text-[10px] text-right self-center tabular-nums font-semibold", e.price > 0 ? "text-white/70" : "text-white/30")}>{e.price > 0 ? e.price.toFixed(2) : "—"}</span>
                    <span className="text-[10px] text-white/50 text-right self-center tabular-nums">{e.optVol > 0 ? fmtVol(e.optVol) : "0"}</span>
                    <span className="text-[10px] text-white/50 text-right self-center tabular-nums">{e.iv}%</span>
                    <span className="text-[10px] text-white/50 text-right self-center tabular-nums">{e.ivRank}%</span>
                    <span className="text-[10px] text-white/50 text-right self-center tabular-nums">{e.ivPct}%</span>
                    <span className="text-[10px] text-white/50 text-right self-center tabular-nums">{e.peTTM > 0 ? e.peTTM.toFixed(3) : "Loss"}</span>
                    <span className="text-[10px] text-white/40 text-right self-center tabular-nums">{e.actRevenue || "—"}</span>
                    <span className="text-[10px] text-white/40 text-right self-center tabular-nums">{e.estRevenue || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Calendar grid — week + month view */}
        {(view === "week" || view === "month") && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-0 border border-emerald-400/[0.08] rounded-sm overflow-hidden"
          style={{ boxShadow: "0 0 0 1px rgba(52,211,153,0.03), 0 12px 40px rgba(0,0,0,0.4)" }}>
          {Array.from({ length: 7 }).map((_, dayIdx) => {
            const date = new Date(currentMonday);
            date.setDate(date.getDate() + dayIdx);
            const isToday = new Date().toDateString() === date.toDateString();
            const entries = byDay[dayIdx] || [];
            const preMkt = entries.filter(e => e.session === "pre" || e.session === "intraday");
            const postMkt = entries.filter(e => e.session === "post");

            return (
              <div key={dayIdx} className={cn(
                "min-h-[300px] border-r border-b border-emerald-400/[0.06] last:border-r-0",
                isToday ? "bg-emerald-400/[0.04]" : ""
              )} style={{ background: isToday ? "rgba(52,211,153,0.02)" : "rgba(4,10,18,0.5)" }}>

                {/* Day header */}
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-emerald-400/[0.08] sticky top-0 z-10"
                  style={{ background: isToday ? "linear-gradient(90deg, rgba(52,211,153,0.08) 0%, rgba(4,10,18,0.9) 100%)" : "linear-gradient(90deg, rgba(52,211,153,0.03) 0%, rgba(4,10,18,0.9) 100%)" }}>
                  <div className="flex items-center gap-1">
                    <span className={cn("text-[11px] font-bold", isToday ? "text-emerald-400" : "text-white/60")}>{DAYS_SHORT[dayIdx]}</span>
                    {entries.length > 0 && (
                      <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/[0.06] px-1.5 text-[8px] font-bold text-emerald-400/70 tabular-nums">{entries.length}</span>
                    )}
                  </div>
                  <span className={cn("text-[11px] tabular-nums font-bold",
                    isToday ? "text-emerald-400 bg-emerald-400/15 rounded-full w-6 h-6 flex items-center justify-center" : "text-white/35"
                  )}>{date.getDate()}</span>
                </div>

                {/* Sub-headers */}
                <div className="grid grid-cols-2 text-[7px] uppercase tracking-widest border-b border-emerald-400/[0.06]"
                  style={{ background: "rgba(4,10,18,0.3)" }}>
                  <span className="px-1.5 py-1 text-cyan-400/60 border-r border-emerald-400/[0.06] font-bold">Pre & Intraday</span>
                  <span className="px-1.5 py-1 text-amber-400/60 font-bold">Post Market</span>
                </div>

                {/* Two columns: Pre | Post */}
                <div className="grid grid-cols-2 min-h-[250px]">
                  {/* Pre & Intraday column */}
                  <div className="border-r border-emerald-400/[0.05] px-1 py-1 space-y-0.5">
                    {preMkt.length === 0 && <div className="text-[8px] text-white/10 text-center mt-4">—</div>}
                    {preMkt.map((e, ei) => (
                      <div key={`pre-${dayIdx}-${ei}`} className="relative group">
                        <button type="button" onClick={() => openDetail(e.symbol)}
                          title={`${e.name} · Cap: ${fmtMktCap(e.mktCap)} · OptVol: ${fmtVol(e.optVol)} · IV: ${e.iv}%`}
                          className="w-full flex items-center gap-1.5 px-1 py-[4px] rounded-sm hover:bg-emerald-400/[0.08] transition-colors text-left border border-transparent hover:border-emerald-400/15">
                          <span className="inline-flex items-center justify-center h-[28px] min-w-[38px] px-2 rounded-sm text-[10px] font-bold text-white/90 shrink-0 border" style={pillStyle(e.symbol)}>
                            {e.symbol}
                          </span>
                        </button>
                        {/* Hover trade pills — desktop only */}
                        <div className="hidden sm:flex absolute right-0 top-0 h-full items-center gap-0.5 pr-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button type="button" onClick={(ev) => { ev.stopPropagation(); fireTrade("BUY", e.symbol); }}
                            className="h-4 rounded-sm border border-emerald-400/30 bg-emerald-400/10 px-1 text-[7px] font-bold text-emerald-300">B</button>
                          <button type="button" onClick={(ev) => { ev.stopPropagation(); fireTrade("SELL", e.symbol); }}
                            className="h-4 rounded-sm border border-red-400/30 bg-red-400/10 px-1 text-[7px] font-bold text-red-300">S</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Post Market column */}
                  <div className="px-1 py-1 space-y-0.5">
                    {postMkt.length === 0 && <div className="text-[8px] text-white/10 text-center mt-4">—</div>}
                    {postMkt.map((e, ei) => (
                      <div key={`post-${dayIdx}-${ei}`} className="relative group">
                        <button type="button" onClick={() => openDetail(e.symbol)}
                          title={`${e.name} · Cap: ${fmtMktCap(e.mktCap)} · OptVol: ${fmtVol(e.optVol)} · IV: ${e.iv}%`}
                          className="w-full flex items-center gap-1.5 px-1 py-[4px] rounded-sm hover:bg-amber-400/[0.06] transition-colors text-left border border-transparent hover:border-amber-400/15">
                          <span className="inline-flex items-center justify-center h-[28px] min-w-[38px] px-2 rounded-sm text-[10px] font-bold text-white/90 shrink-0 border" style={pillStyle(e.symbol)}>
                            {e.symbol}
                          </span>
                        </button>
                        <div className="hidden sm:flex absolute right-0 top-0 h-full items-center gap-0.5 pr-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button type="button" onClick={(ev) => { ev.stopPropagation(); fireTrade("BUY", e.symbol); }}
                            className="h-4 rounded-sm border border-emerald-400/30 bg-emerald-400/10 px-1 text-[7px] font-bold text-emerald-300">B</button>
                          <button type="button" onClick={(ev) => { ev.stopPropagation(); fireTrade("SELL", e.symbol); }}
                            className="h-4 rounded-sm border border-red-400/30 bg-red-400/10 px-1 text-[7px] font-bold text-red-300">S</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {entries.length === 0 && (
                  <div className="text-[9px] text-white/10 text-center py-6">No Data</div>
                )}
              </div>
            );
          })}
        </div>
        )}

        {/* Bottom ticker bar */}
        <div className="flex items-center gap-4 text-[10px] tabular-nums rounded-sm border border-emerald-400/[0.06] px-3 py-2 overflow-x-auto scrollbar-hide"
          style={{ background: "rgba(4,10,18,0.6)" }}>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-400/60" />
            <span className="text-white/35 font-semibold">Market Closed</span>
          </span>
          <span className="text-white/40 shrink-0">Dow Jones <span className="text-red-400 font-semibold">45,166.64 ▼ -793.47 -1.73%</span></span>
          <span className="text-white/40 shrink-0">NASDAQ <span className="text-red-400 font-semibold">20,948.36 ▼ -459.72 -2.15%</span></span>
          <span className="text-white/40 shrink-0">S&P 500 <span className="text-red-400 font-semibold">6,368.85 ▼ -108.31 -1.67%</span></span>
        </div>
      </div>
    </div>
  );
}
