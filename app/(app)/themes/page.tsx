"use client";

import React, { useMemo, useState } from "react";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ── Types ── */
interface ThemeStock {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  mktCap: string;
}

interface InvestmentTheme {
  id: string;
  name: string;
  icon: string;
  description: string;
  changePct: number; // avg theme performance
  stocks: ThemeStock[];
  color: string; // gradient accent
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

/* ── Theme Data ── */
const THEMES: InvestmentTheme[] = [
  {
    id: "ai", name: "Artificial Intelligence", icon: "🤖",
    description: "Companies building or deploying AI technologies — chips, models, cloud AI services, and enterprise AI tools.",
    changePct: 2.84, color: "emerald",
    stocks: [
      { symbol: "NVDA", name: "NVIDIA Corp.", price: 171.24, changePct: 3.42, mktCap: "4.2T" },
      { symbol: "MSFT", name: "Microsoft Corp.", price: 365.97, changePct: 1.89, mktCap: "2.7T" },
      { symbol: "GOOGL", name: "Alphabet Inc.", price: 280.74, changePct: 2.15, mktCap: "1.7T" },
      { symbol: "META", name: "Meta Platforms", price: 547.54, changePct: 3.21, mktCap: "1.4T" },
      { symbol: "AMD", name: "Advanced Micro", price: 203.77, changePct: 4.12, mktCap: "328B" },
      { symbol: "PLTR", name: "Palantir Tech", price: 147.56, changePct: 5.61, mktCap: "340B" },
      { symbol: "SNOW", name: "Snowflake Inc.", price: 165.20, changePct: 1.24, mktCap: "54B" },
      { symbol: "CRWD", name: "CrowdStrike", price: 345.60, changePct: 2.44, mktCap: "83B" },
    ],
  },
  {
    id: "ev", name: "Electric Vehicles", icon: "⚡",
    description: "EV manufacturers, battery tech, charging infrastructure, and autonomous driving companies.",
    changePct: -1.32, color: "cyan",
    stocks: [
      { symbol: "TSLA", name: "Tesla Inc.", price: 372.11, changePct: -2.76, mktCap: "1.2T" },
      { symbol: "RIVN", name: "Rivian Automotive", price: 12.80, changePct: -3.41, mktCap: "13B" },
      { symbol: "LCID", name: "Lucid Group", price: 3.20, changePct: -1.88, mktCap: "7.4B" },
      { symbol: "NIO", name: "NIO Inc.", price: 5.80, changePct: -0.52, mktCap: "10.8B" },
      { symbol: "LI", name: "Li Auto Inc.", price: 28.40, changePct: 1.23, mktCap: "29B" },
      { symbol: "XPEV", name: "XPeng Inc.", price: 18.90, changePct: -1.05, mktCap: "17B" },
      { symbol: "QS", name: "QuantumScape", price: 5.40, changePct: -2.18, mktCap: "2.7B" },
    ],
  },
  {
    id: "space", name: "Space & Aerospace", icon: "🚀",
    description: "Space exploration, satellite networks, defense aerospace, and launch technology companies.",
    changePct: 1.56, color: "indigo",
    stocks: [
      { symbol: "BA", name: "Boeing Co.", price: 178.50, changePct: 0.84, mktCap: "106B" },
      { symbol: "LMT", name: "Lockheed Martin", price: 480.30, changePct: 1.12, mktCap: "115B" },
      { symbol: "RTX", name: "RTX Corp.", price: 125.60, changePct: 1.78, mktCap: "180B" },
      { symbol: "RKLB", name: "Rocket Lab", price: 22.40, changePct: 4.32, mktCap: "10.8B" },
      { symbol: "ASTS", name: "AST SpaceMobile", price: 28.60, changePct: 2.11, mktCap: "9.2B" },
      { symbol: "LUNR", name: "Intuitive Machines", price: 14.80, changePct: 3.45, mktCap: "4.1B" },
    ],
  },
  {
    id: "cannabis", name: "Cannabis", icon: "🌿",
    description: "Cannabis cultivation, distribution, biotech, and ancillary services companies.",
    changePct: -3.21, color: "green",
    stocks: [
      { symbol: "TLRY", name: "Tilray Brands", price: 1.68, changePct: -4.52, mktCap: "1.3B" },
      { symbol: "CGC", name: "Canopy Growth", price: 4.20, changePct: -3.18, mktCap: "3.5B" },
      { symbol: "CRON", name: "Cronos Group", price: 2.15, changePct: -2.84, mktCap: "810M" },
      { symbol: "MJ", name: "ETFMG Cannabis ETF", price: 3.80, changePct: -2.94, mktCap: "250M" },
      { symbol: "SNDL", name: "SNDL Inc.", price: 1.92, changePct: -3.56, mktCap: "530M" },
    ],
  },
  {
    id: "fintech", name: "Fintech & Payments", icon: "💳",
    description: "Digital payments, neobanks, blockchain finance, and financial infrastructure.",
    changePct: 1.15, color: "amber",
    stocks: [
      { symbol: "V", name: "Visa Inc.", price: 310.50, changePct: 0.92, mktCap: "640B" },
      { symbol: "MA", name: "Mastercard", price: 520.40, changePct: 1.04, mktCap: "510B" },
      { symbol: "SQ", name: "Block Inc.", price: 68.50, changePct: 2.34, mktCap: "42B" },
      { symbol: "PYPL", name: "PayPal Holdings", price: 68.90, changePct: 1.56, mktCap: "73B" },
      { symbol: "SOFI", name: "SoFi Technologies", price: 14.20, changePct: 3.12, mktCap: "16B" },
      { symbol: "COIN", name: "Coinbase Global", price: 265.80, changePct: -1.24, mktCap: "53B" },
      { symbol: "HOOD", name: "Robinhood Markets", price: 42.30, changePct: 1.88, mktCap: "37B" },
    ],
  },
  {
    id: "clean", name: "Clean Energy", icon: "☀️",
    description: "Solar, wind, hydrogen, and energy storage — the transition to renewable power.",
    changePct: -0.87, color: "teal",
    stocks: [
      { symbol: "ENPH", name: "Enphase Energy", price: 118.40, changePct: -1.24, mktCap: "15.8B" },
      { symbol: "SEDG", name: "SolarEdge Tech", price: 22.60, changePct: -2.88, mktCap: "1.3B" },
      { symbol: "FSLR", name: "First Solar", price: 185.30, changePct: 1.42, mktCap: "19.8B" },
      { symbol: "NEE", name: "NextEra Energy", price: 82.40, changePct: 0.65, mktCap: "170B" },
      { symbol: "PLUG", name: "Plug Power", price: 2.10, changePct: -3.45, mktCap: "1.5B" },
      { symbol: "BE", name: "Bloom Energy", price: 12.80, changePct: -0.94, mktCap: "2.9B" },
    ],
  },
  {
    id: "biotech", name: "Biotech & Genomics", icon: "🧬",
    description: "Gene therapy, CRISPR, drug development, mRNA platforms, and precision medicine.",
    changePct: 0.42, color: "rose",
    stocks: [
      { symbol: "MRNA", name: "Moderna Inc.", price: 35.80, changePct: 1.24, mktCap: "13.6B" },
      { symbol: "CRSP", name: "CRISPR Therapeutics", price: 48.20, changePct: 2.14, mktCap: "3.8B" },
      { symbol: "NTLA", name: "Intellia Therapeutics", price: 18.40, changePct: -0.86, mktCap: "1.6B" },
      { symbol: "BEAM", name: "Beam Therapeutics", price: 22.60, changePct: 0.44, mktCap: "1.5B" },
      { symbol: "PACB", name: "PacBio", price: 1.80, changePct: -1.65, mktCap: "560M" },
      { symbol: "ILMN", name: "Illumina Inc.", price: 118.90, changePct: 0.72, mktCap: "18.5B" },
    ],
  },
  {
    id: "cyber", name: "Cybersecurity", icon: "🛡️",
    description: "Enterprise security, zero-trust, cloud protection, and threat intelligence platforms.",
    changePct: 2.18, color: "sky",
    stocks: [
      { symbol: "CRWD", name: "CrowdStrike", price: 345.60, changePct: 2.44, mktCap: "83B" },
      { symbol: "PANW", name: "Palo Alto Networks", price: 320.10, changePct: 1.89, mktCap: "104B" },
      { symbol: "ZS", name: "Zscaler Inc.", price: 198.50, changePct: 2.56, mktCap: "28B" },
      { symbol: "FTNT", name: "Fortinet Inc.", price: 92.40, changePct: 1.74, mktCap: "71B" },
      { symbol: "S", name: "SentinelOne", price: 22.80, changePct: 3.18, mktCap: "7.2B" },
      { symbol: "NET", name: "Cloudflare Inc.", price: 92.80, changePct: 1.42, mktCap: "31B" },
    ],
  },
  {
    id: "metaverse", name: "Metaverse & Gaming", icon: "🎮",
    description: "Virtual worlds, VR/AR hardware, game engines, and digital entertainment.",
    changePct: 0.74, color: "purple",
    stocks: [
      { symbol: "META", name: "Meta Platforms", price: 547.54, changePct: 3.21, mktCap: "1.4T" },
      { symbol: "RBLX", name: "Roblox Corp.", price: 52.80, changePct: 1.56, mktCap: "32B" },
      { symbol: "U", name: "Unity Software", price: 19.35, changePct: -0.82, mktCap: "7.4B" },
      { symbol: "SNAP", name: "Snap Inc.", price: 12.40, changePct: -1.24, mktCap: "19.6B" },
      { symbol: "TTWO", name: "Take-Two Interactive", price: 185.60, changePct: 0.94, mktCap: "31B" },
      { symbol: "EA", name: "Electronic Arts", price: 142.80, changePct: 0.56, mktCap: "38B" },
    ],
  },
  {
    id: "dividend", name: "Dividend Aristocrats", icon: "💰",
    description: "Blue-chip companies with 25+ years of consecutive dividend increases.",
    changePct: 0.38, color: "amber",
    stocks: [
      { symbol: "JNJ", name: "Johnson & Johnson", price: 158.40, changePct: 0.32, mktCap: "380B" },
      { symbol: "KO", name: "Coca-Cola Co.", price: 62.40, changePct: 0.18, mktCap: "270B" },
      { symbol: "PG", name: "Procter & Gamble", price: 172.30, changePct: 0.44, mktCap: "405B" },
      { symbol: "PEP", name: "PepsiCo Inc.", price: 168.90, changePct: 0.28, mktCap: "232B" },
      { symbol: "MCD", name: "McDonald's Corp.", price: 295.80, changePct: 0.52, mktCap: "213B" },
      { symbol: "XOM", name: "Exxon Mobil", price: 118.40, changePct: 0.64, mktCap: "470B" },
    ],
  },
  {
    id: "quantum", name: "Quantum Computing", icon: "⚛️",
    description: "Companies developing quantum processors, algorithms, and hybrid classical-quantum systems.",
    changePct: 5.42, color: "violet",
    stocks: [
      { symbol: "IONQ", name: "IonQ Inc.", price: 32.40, changePct: 6.82, mktCap: "7.1B" },
      { symbol: "RGTI", name: "Rigetti Computing", price: 12.80, changePct: 8.24, mktCap: "2.4B" },
      { symbol: "QBTS", name: "D-Wave Quantum", price: 8.40, changePct: 4.56, mktCap: "1.8B" },
      { symbol: "QUBT", name: "Quantum Computing", price: 14.20, changePct: 3.84, mktCap: "2.1B" },
      { symbol: "ARQQ", name: "Arqit Quantum", price: 5.60, changePct: 2.12, mktCap: "680M" },
    ],
  },
  {
    id: "realestate", name: "Real Estate & REITs", icon: "🏢",
    description: "Real estate investment trusts — data centers, logistics, residential, and commercial properties.",
    changePct: -0.24, color: "orange",
    stocks: [
      { symbol: "PLD", name: "Prologis Inc.", price: 118.40, changePct: 0.42, mktCap: "110B" },
      { symbol: "AMT", name: "American Tower", price: 205.80, changePct: -0.38, mktCap: "96B" },
      { symbol: "EQIX", name: "Equinix Inc.", price: 820.40, changePct: 0.24, mktCap: "78B" },
      { symbol: "O", name: "Realty Income", price: 55.20, changePct: -0.62, mktCap: "48B" },
      { symbol: "SPG", name: "Simon Property", price: 162.40, changePct: -0.84, mktCap: "52B" },
    ],
  },
];

/* ── Component ── */
export default function InvestmentThemesPage() {
  const [search, setSearch] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"perf" | "name" | "stocks">("perf");
  const detailRef = React.useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let list = THEMES;
    const q = search.toUpperCase().trim();
    if (q) list = list.filter(t => t.name.toUpperCase().includes(q) || t.stocks.some(s => s.symbol.includes(q)));
    if (sortBy === "perf") list = [...list].sort((a, b) => b.changePct - a.changePct);
    if (sortBy === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "stocks") list = [...list].sort((a, b) => b.stocks.length - a.stocks.length);
    return list;
  }, [search, sortBy]);

  const activeTheme = selectedTheme ? THEMES.find(t => t.id === selectedTheme) : null;

  function openDetail(sym: string) {
    try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: sym, asset: "stock" } })); } catch {}
  }
  function fireTrade(action: "BUY" | "SELL", sym: string) {
    try { window.dispatchEvent(new CustomEvent("imynted:tradeAction", { detail: { action, asset: "stock", symbol: sym } })); } catch {}
  }

  React.useEffect(() => {
    if (selectedTheme && detailRef.current) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }, [selectedTheme]);

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
              <h1 className="text-[16px] md:text-[18px] font-bold text-white tracking-wide">INVESTMENT THEMES</h1>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-sm border border-emerald-400/15 bg-emerald-400/[0.04] px-2 py-0.5 text-[9px] text-emerald-300/70">
                <span className="font-bold">{THEMES.length}</span> themes
              </span>
              <span className="rounded-sm border border-emerald-400/15 bg-emerald-400/[0.04] px-2 py-0.5 text-[9px] text-emerald-300/70">
                <span className="font-bold">{THEMES.reduce((s, t) => s + t.stocks.length, 0)}</span> stocks
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap rounded-sm border border-emerald-400/[0.06] px-3 py-2"
          style={{ background: "rgba(4,10,18,0.6)" }}>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/30 uppercase">Sort</span>
            {(["perf", "name", "stocks"] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)}
                className={cn("rounded-sm border px-2.5 py-1 text-[9px] font-bold transition-colors",
                  sortBy === s ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/[0.06] bg-white/[0.02] text-white/40"
                )}>{s === "perf" ? "Performance" : s === "name" ? "A-Z" : "# Stocks"}</button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search themes or stocks..."
            className="w-[140px] md:w-[200px] rounded-sm border border-emerald-400/[0.1] bg-black/30 px-2.5 py-1.5 text-[10px] text-white outline-none placeholder:text-white/25 focus:border-emerald-400/30" />
        </div>

        {/* Theme grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(theme => {
            const isActive = selectedTheme === theme.id;
            const up = theme.changePct >= 0;
            return (
              <div key={theme.id}
                className={cn("rounded-sm border p-3 cursor-pointer transition-all",
                  isActive ? "border-emerald-400/30 ring-1 ring-emerald-400/20" : "border-emerald-400/[0.08] hover:border-emerald-400/20"
                )}
                style={{ background: "rgba(6,14,24,0.6)", boxShadow: isActive ? "0 0 20px rgba(52,211,153,0.06)" : undefined }}
                onClick={() => setSelectedTheme(isActive ? null : theme.id)}>

                {/* Theme header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[22px]">{theme.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-white/90 truncate">{theme.name}</div>
                    <div className="text-[9px] text-white/35">{theme.stocks.length} stocks</div>
                  </div>
                  <span className={cn("rounded-sm border px-2 py-0.5 text-[11px] font-bold tabular-nums",
                    up ? "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-400" : "border-red-400/25 bg-red-400/[0.08] text-red-400"
                  )}>{up ? "+" : ""}{theme.changePct.toFixed(2)}%</span>
                </div>

                <p className="text-[9px] text-white/30 leading-relaxed mb-3 line-clamp-2">{theme.description}</p>

                {/* Stock pills */}
                <div className="flex flex-wrap gap-1">
                  {theme.stocks.slice(0, 6).map(s => (
                    <button key={s.symbol} type="button"
                      onClick={(e) => { e.stopPropagation(); openDetail(s.symbol); }}
                      className="inline-flex items-center justify-center h-[22px] min-w-[34px] px-1.5 rounded-sm text-[8px] font-bold text-white/90 border hover:brightness-125 transition-all"
                      style={pillStyle(s.symbol)}>
                      {s.symbol}
                    </button>
                  ))}
                  {theme.stocks.length > 6 && (
                    <span className="text-[8px] text-white/25 self-center">+{theme.stocks.length - 6}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Expanded theme detail */}
        {activeTheme && (
          <div ref={detailRef} className="rounded-sm border border-emerald-400/[0.12] overflow-hidden"
            style={{ background: "rgba(6,14,24,0.7)", boxShadow: "0 0 0 1px rgba(52,211,153,0.05), 0 12px 40px rgba(0,0,0,0.4)" }}>

            <div className="px-4 py-3 border-b border-emerald-400/[0.08] flex items-center justify-between"
              style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.05) 0%, transparent 50%)" }}>
              <div className="flex items-center gap-2">
                <span className="text-[24px]">{activeTheme.icon}</span>
                <div>
                  <h2 className="text-[14px] font-bold text-white">{activeTheme.name}</h2>
                  <p className="text-[9px] text-white/35">{activeTheme.description}</p>
                </div>
              </div>
              <button onClick={() => setSelectedTheme(null)} className="text-white/30 hover:text-white/60 text-[18px] transition-colors">✕</button>
            </div>

            {/* Stocks table */}
            <div className="min-w-[500px]">
              <div className="grid grid-cols-[40px_1fr_80px_80px_80px_100px] gap-2 px-4 py-2 border-b border-emerald-400/[0.06] text-[9px] text-white/35 uppercase tracking-wider font-semibold">
                <span>No.</span><span>Symbol / Name</span><span className="text-right">Price</span>
                <span className="text-right">% Chg</span><span className="text-right">Mkt Cap</span><span className="text-right">Trade</span>
              </div>
              {activeTheme.stocks.map((s, i) => {
                const up = s.changePct >= 0;
                return (
                  <div key={s.symbol}
                    className="grid grid-cols-[40px_1fr_80px_80px_80px_100px] gap-2 px-4 py-2.5 border-b border-white/[0.03] hover:bg-emerald-400/[0.03] transition-colors group cursor-pointer"
                    onClick={() => openDetail(s.symbol)}>
                    <span className="text-[10px] text-white/30 self-center">{i + 1}</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center h-[26px] min-w-[38px] px-2 rounded-sm text-[9px] font-bold text-white/90 shrink-0 border" style={pillStyle(s.symbol)}>
                        {s.symbol}
                      </span>
                      <span className="text-[10px] text-white/50 truncate">{s.name}</span>
                    </div>
                    <span className="text-[10px] text-white/70 text-right self-center tabular-nums font-semibold">${s.price.toFixed(2)}</span>
                    <span className={cn("text-[10px] text-right self-center tabular-nums font-semibold", up ? "text-emerald-400" : "text-red-400")}>
                      {up ? "+" : ""}{s.changePct.toFixed(2)}%
                    </span>
                    <span className="text-[10px] text-white/40 text-right self-center">{s.mktCap}</span>
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={(e) => { e.stopPropagation(); fireTrade("BUY", s.symbol); }}
                        className="h-5 rounded-sm border border-emerald-400/25 bg-emerald-400/[0.08] px-2 text-[8px] font-bold text-emerald-300">BUY</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); fireTrade("SELL", s.symbol); }}
                        className="h-5 rounded-sm border border-red-400/25 bg-red-400/[0.08] px-2 text-[8px] font-bold text-red-300">SELL</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom ticker */}
        <div className="flex items-center gap-4 text-[10px] tabular-nums rounded-sm border border-emerald-400/[0.06] px-3 py-2 overflow-x-auto scrollbar-hide"
          style={{ background: "rgba(4,10,18,0.6)" }}>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400/60 animate-pulse" />
            <span className="text-white/35 font-semibold">Themes Active</span>
          </span>
          <span className="text-white/30 shrink-0">Top: <span className="text-emerald-400 font-semibold">{THEMES.reduce((best, t) => t.changePct > best.changePct ? t : best, THEMES[0]).name}</span></span>
          <span className="text-white/40 shrink-0">Dow <span className="text-red-400 font-semibold">45,166.64 -1.73%</span></span>
          <span className="text-white/40 shrink-0">S&P <span className="text-red-400 font-semibold">6,368.85 -1.67%</span></span>
        </div>
      </div>
    </div>
  );
}
