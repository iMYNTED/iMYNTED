"use client";

import React, { useMemo, useState } from "react";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ── Types ── */
type Impact = "high" | "medium" | "low";
type Region = "US" | "EU" | "UK" | "JP" | "CN" | "CA" | "AU" | "Global";

interface EconEvent {
  date: string;
  time: string;
  region: Region;
  event: string;
  impact: Impact;
  actual?: string;
  forecast?: string;
  previous?: string;
  category: string;
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

const IMPACT_CFG = {
  high:   { label: "HIGH",   dot: "bg-red-500",    text: "text-red-400",    border: "border-red-400/25 bg-red-400/[0.08]" },
  medium: { label: "MED",    dot: "bg-amber-500",  text: "text-amber-400",  border: "border-amber-400/25 bg-amber-400/[0.08]" },
  low:    { label: "LOW",    dot: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-400/25 bg-emerald-400/[0.08]" },
};

const REGION_FLAGS: Record<Region, string> = {
  US: "🇺🇸", EU: "🇪🇺", UK: "🇬🇧", JP: "🇯🇵", CN: "🇨🇳", CA: "🇨🇦", AU: "🇦🇺", Global: "🌐",
};

/* ── Mock Data ── */
function generateEvents(): EconEvent[] {
  const base = new Date();
  const monday = new Date(base);
  monday.setDate(base.getDate() - base.getDay() + 1);

  const EVENTS: Array<Omit<EconEvent, "date">> = [
    // Monday
    { time: "08:30", region: "US", event: "Chicago Fed National Activity Index", impact: "low", forecast: "0.18", previous: "0.23", category: "Economic Activity" },
    { time: "10:00", region: "US", event: "New Home Sales", impact: "medium", forecast: "680K", previous: "664K", category: "Housing" },
    { time: "10:30", region: "US", event: "Dallas Fed Manufacturing Index", impact: "low", forecast: "-8.0", previous: "-11.3", category: "Manufacturing" },
    { time: "04:00", region: "EU", event: "ECB Lagarde Speech", impact: "high", category: "Central Bank" },
    { time: "19:50", region: "JP", event: "BOJ Meeting Minutes", impact: "medium", category: "Central Bank" },
    // Tuesday
    { time: "08:30", region: "US", event: "Durable Goods Orders MoM", impact: "high", forecast: "0.5%", previous: "-1.0%", actual: "0.9%", category: "Manufacturing" },
    { time: "09:00", region: "US", event: "S&P/Case-Shiller Home Price YoY", impact: "medium", forecast: "4.5%", previous: "4.4%", category: "Housing" },
    { time: "10:00", region: "US", event: "CB Consumer Confidence", impact: "high", forecast: "94.0", previous: "92.9", actual: "92.9", category: "Consumer" },
    { time: "10:00", region: "US", event: "Richmond Fed Manufacturing Index", impact: "medium", forecast: "-6", previous: "-4", category: "Manufacturing" },
    { time: "05:00", region: "EU", event: "ECB Financial Stability Review", impact: "medium", category: "Central Bank" },
    // Wednesday
    { time: "07:00", region: "US", event: "MBA Mortgage Applications", impact: "low", previous: "6.2%", category: "Housing" },
    { time: "08:30", region: "US", event: "GDP QoQ (2nd Estimate)", impact: "high", forecast: "2.3%", previous: "2.3%", actual: "2.4%", category: "GDP" },
    { time: "10:00", region: "US", event: "Pending Home Sales MoM", impact: "medium", forecast: "1.0%", previous: "-4.6%", category: "Housing" },
    { time: "10:30", region: "US", event: "EIA Crude Oil Inventories", impact: "medium", forecast: "-1.5M", previous: "-4.2M", category: "Energy" },
    { time: "14:00", region: "US", event: "Fed Beige Book", impact: "high", category: "Central Bank" },
    { time: "04:30", region: "UK", event: "BOE Gov Bailey Speech", impact: "high", category: "Central Bank" },
    // Thursday
    { time: "08:30", region: "US", event: "Initial Jobless Claims", impact: "high", forecast: "215K", previous: "220K", actual: "211K", category: "Employment" },
    { time: "08:30", region: "US", event: "PCE Price Index MoM", impact: "high", forecast: "0.3%", previous: "0.3%", actual: "0.4%", category: "Inflation" },
    { time: "08:30", region: "US", event: "Core PCE Price Index MoM", impact: "high", forecast: "0.3%", previous: "0.4%", actual: "0.3%", category: "Inflation" },
    { time: "08:30", region: "US", event: "Personal Income MoM", impact: "medium", forecast: "0.4%", previous: "0.6%", category: "Consumer" },
    { time: "08:30", region: "US", event: "Personal Spending MoM", impact: "medium", forecast: "0.5%", previous: "0.2%", category: "Consumer" },
    { time: "10:00", region: "US", event: "Michigan Consumer Sentiment (Final)", impact: "medium", forecast: "57.9", previous: "57.9", category: "Consumer" },
    { time: "01:30", region: "JP", event: "Tokyo CPI YoY", impact: "medium", forecast: "2.9%", previous: "2.8%", category: "Inflation" },
    { time: "08:30", region: "CA", event: "Canada GDP MoM", impact: "high", forecast: "0.3%", previous: "0.2%", category: "GDP" },
    // Friday
    { time: "08:30", region: "US", event: "Nonfarm Payrolls", impact: "high", forecast: "200K", previous: "151K", category: "Employment" },
    { time: "08:30", region: "US", event: "Unemployment Rate", impact: "high", forecast: "4.1%", previous: "4.1%", category: "Employment" },
    { time: "08:30", region: "US", event: "Average Hourly Earnings MoM", impact: "high", forecast: "0.3%", previous: "0.3%", category: "Employment" },
    { time: "10:00", region: "US", event: "ISM Manufacturing PMI", impact: "high", forecast: "50.5", previous: "50.3", category: "Manufacturing" },
    { time: "10:00", region: "US", event: "ISM Manufacturing Prices", impact: "medium", forecast: "56.0", previous: "62.4", category: "Manufacturing" },
    { time: "10:00", region: "US", event: "Construction Spending MoM", impact: "medium", forecast: "0.3%", previous: "-0.2%", category: "Construction" },
    { time: "04:30", region: "UK", event: "Manufacturing PMI (Final)", impact: "medium", forecast: "44.6", previous: "44.6", category: "Manufacturing" },
    { time: "05:00", region: "EU", event: "CPI YoY (Flash)", impact: "high", forecast: "2.2%", previous: "2.3%", category: "Inflation" },
    { time: "05:00", region: "EU", event: "Core CPI YoY (Flash)", impact: "high", forecast: "2.6%", previous: "2.6%", category: "Inflation" },
    { time: "21:45", region: "CN", event: "Caixin Manufacturing PMI", impact: "medium", forecast: "51.1", previous: "51.1", category: "Manufacturing" },
    // Next week preview
    { time: "10:00", region: "US", event: "JOLTS Job Openings", impact: "high", forecast: "7.6M", previous: "7.7M", category: "Employment" },
    { time: "14:00", region: "US", event: "FOMC Meeting Minutes", impact: "high", category: "Central Bank" },
    { time: "08:30", region: "US", event: "CPI MoM", impact: "high", forecast: "0.3%", previous: "0.2%", category: "Inflation" },
    { time: "08:30", region: "US", event: "Core CPI MoM", impact: "high", forecast: "0.3%", previous: "0.2%", category: "Inflation" },
    { time: "08:30", region: "US", event: "PPI MoM", impact: "medium", forecast: "0.2%", previous: "0.0%", category: "Inflation" },
    { time: "14:00", region: "US", event: "Fed Interest Rate Decision", impact: "high", forecast: "4.50%", previous: "4.50%", category: "Central Bank" },
    { time: "14:30", region: "US", event: "FOMC Press Conference", impact: "high", category: "Central Bank" },
  ];

  const entries: EconEvent[] = [];
  for (let i = 0; i < EVENTS.length; i++) {
    const dayOff = i < 5 ? 0 : i < 10 ? 1 : i < 16 ? 2 : i < 24 ? 3 : i < 34 ? 4 : 7 + (i - 34);
    const d = new Date(monday);
    d.setDate(d.getDate() + dayOff);
    entries.push({ ...EVENTS[i], date: d.toISOString().slice(0, 10) });
  }
  return entries;
}

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CATEGORIES = ["All", "Central Bank", "Employment", "Inflation", "GDP", "Manufacturing", "Housing", "Consumer", "Energy", "Construction"];

/* ── Component ── */
export default function EconomicCalendarPage() {
  const [view, setView] = useState<"list" | "week">("list");
  const [impactFilter, setImpactFilter] = useState<"all" | Impact>("all");
  const [regionFilter, setRegionFilter] = useState<"all" | Region>("all");
  const [catFilter, setCatFilter] = useState("All");
  const [weekOffset, setWeekOffset] = useState(0);
  const [search, setSearch] = useState("");

  const allEvents = useMemo(() => generateEvents(), []);

  const currentMonday = useMemo(() => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);

  const filtered = useMemo(() => {
    let list = allEvents;
    if (impactFilter !== "all") list = list.filter(e => e.impact === impactFilter);
    if (regionFilter !== "all") list = list.filter(e => e.region === regionFilter);
    if (catFilter !== "All") list = list.filter(e => e.category === catFilter);
    const q = search.toUpperCase().trim();
    if (q) list = list.filter(e => e.event.toUpperCase().includes(q) || e.region.includes(q));
    return list;
  }, [allEvents, impactFilter, regionFilter, catFilter, search]);

  // Group by date for week view
  const byDay = useMemo(() => {
    const map: Record<number, EconEvent[]> = {};
    for (let i = 0; i < 7; i++) map[i] = [];
    for (const e of filtered) {
      const ed = new Date(e.date + "T00:00:00");
      const diff = Math.round((ed.getTime() - currentMonday.getTime()) / 86400000);
      if (diff >= 0 && diff < 7) map[diff].push(e);
    }
    return map;
  }, [filtered, currentMonday]);

  const highCount = allEvents.filter(e => e.impact === "high").length;
  const monthLabel = currentMonday.toLocaleDateString("en-US", { month: "short", year: "numeric" });

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
              <h1 className="text-[16px] md:text-[18px] font-bold text-white tracking-wide">ECONOMIC CALENDAR</h1>
              <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/[0.06] px-1.5 py-0.5 text-[8px] font-bold text-emerald-400/70 uppercase tracking-wider">LIVE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-sm border border-red-400/15 bg-red-400/[0.04] px-2 py-0.5 text-[9px] text-red-400/70">
                High Impact <span className="font-bold">{highCount}</span>
              </span>
              <span className="rounded-sm border border-emerald-400/15 bg-emerald-400/[0.04] px-2 py-0.5 text-[9px] text-emerald-300/70">
                <span className="font-bold">{filtered.length}</span> events
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap rounded-sm border border-emerald-400/[0.06] px-3 py-2"
          style={{ background: "rgba(4,10,18,0.6)" }}>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View */}
            <div className="flex items-center gap-0 rounded-sm border border-emerald-400/[0.12] overflow-hidden">
              {(["list", "week"] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={cn("px-3 py-1.5 text-[10px] font-bold capitalize transition-colors",
                    view === v ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.02] text-white/40"
                  )}>{v}</button>
              ))}
            </div>

            {/* Impact */}
            <div className="flex items-center gap-0 rounded-sm border border-emerald-400/[0.12] overflow-hidden">
              {(["all", "high", "medium", "low"] as const).map(i => (
                <button key={i} onClick={() => setImpactFilter(i)}
                  className={cn("px-2 py-1.5 text-[9px] font-bold uppercase transition-colors",
                    impactFilter === i ? (i === "high" ? "bg-red-400/15 text-red-300" : i === "medium" ? "bg-amber-400/15 text-amber-300" : i === "low" ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-400/15 text-emerald-300") : "bg-white/[0.02] text-white/40"
                  )}>{i}</button>
              ))}
            </div>

            {/* Region */}
            <div className="flex items-center gap-0 rounded-sm border border-emerald-400/[0.12] overflow-hidden">
              {(["all", "US", "EU", "UK", "JP", "CN"] as const).map(r => (
                <button key={r} onClick={() => setRegionFilter(r as any)}
                  className={cn("px-2 py-1.5 text-[9px] font-bold transition-colors",
                    regionFilter === r ? "bg-cyan-400/15 text-cyan-300" : "bg-white/[0.02] text-white/40"
                  )}>{r === "all" ? "ALL" : r}</button>
              ))}
            </div>

            {/* Week nav */}
            <div className="flex items-center gap-1.5">
              <button onClick={() => setWeekOffset(w => w - 1)} className="rounded-sm border border-emerald-400/[0.12] bg-emerald-400/[0.03] w-7 h-7 flex items-center justify-center text-[11px] text-white/50 hover:text-emerald-300 transition-colors">◀</button>
              <span className="text-[12px] font-semibold text-white">{monthLabel}</span>
              <button onClick={() => setWeekOffset(w => w + 1)} className="rounded-sm border border-emerald-400/[0.12] bg-emerald-400/[0.03] w-7 h-7 flex items-center justify-center text-[11px] text-white/50 hover:text-emerald-300 transition-colors">▶</button>
            </div>
          </div>

          {/* Category + Search */}
          <div className="flex items-center gap-2">
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
              className="rounded-sm border border-emerald-400/[0.1] bg-black/30 px-2 py-1.5 text-[10px] text-white/60 outline-none">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events..."
              className="w-[120px] md:w-[160px] rounded-sm border border-emerald-400/[0.1] bg-black/30 px-2.5 py-1.5 text-[10px] text-white outline-none placeholder:text-white/25 focus:border-emerald-400/30" />
          </div>
        </div>

        {/* List view */}
        {view === "list" && (
          <div className="rounded-sm border border-emerald-400/[0.08] overflow-x-auto"
            style={{ background: "rgba(6,14,24,0.6)", boxShadow: "0 0 0 1px rgba(52,211,153,0.03), 0 12px 40px rgba(0,0,0,0.4)" }}>
            <div className="min-w-[700px]">
              <div className="grid grid-cols-[90px_50px_30px_1fr_55px_70px_70px_70px] gap-2 px-3 py-2 border-b border-emerald-400/[0.08] text-[9px] text-white/35 uppercase tracking-wider font-semibold"
                style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.03) 0%, transparent 50%)" }}>
                <span>Date / Time</span><span>Impact</span><span></span><span>Event</span>
                <span className="text-right">Actual</span><span className="text-right">Forecast</span>
                <span className="text-right">Previous</span><span className="text-right">Category</span>
              </div>
              {filtered.map((e, i) => {
                const ic = IMPACT_CFG[e.impact];
                const hasActual = !!e.actual;
                const beatForecast = hasActual && e.forecast && parseFloat(e.actual!) > parseFloat(e.forecast);
                return (
                  <div key={i} className="grid grid-cols-[90px_50px_30px_1fr_55px_70px_70px_70px] gap-2 px-3 py-2.5 border-b border-white/[0.03] hover:bg-emerald-400/[0.03] transition-colors">
                    <div className="self-center">
                      <div className="text-[10px] text-white/50 tabular-nums">{e.date.slice(5)}</div>
                      <div className="text-[9px] text-white/30 tabular-nums">{e.time} ET</div>
                    </div>
                    <div className="self-center">
                      <span className={cn("rounded-sm border px-1.5 py-0.5 text-[8px] font-bold", ic.border, ic.text)}>{ic.label}</span>
                    </div>
                    <div className="self-center text-[12px]">{REGION_FLAGS[e.region]}</div>
                    <div className="self-center">
                      <div className="text-[11px] text-white/80 font-semibold">{e.event}</div>
                      <div className="text-[9px] text-white/30">{e.region}</div>
                    </div>
                    <span className={cn("text-[10px] text-right self-center tabular-nums font-bold",
                      hasActual ? (beatForecast ? "text-emerald-400" : "text-red-400") : "text-white/20"
                    )}>{e.actual ?? "—"}</span>
                    <span className="text-[10px] text-white/50 text-right self-center tabular-nums">{e.forecast ?? "—"}</span>
                    <span className="text-[10px] text-white/35 text-right self-center tabular-nums">{e.previous ?? "—"}</span>
                    <span className="text-[9px] text-white/25 text-right self-center">{e.category}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Week view */}
        {view === "week" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-0 border border-emerald-400/[0.08] rounded-sm overflow-hidden"
            style={{ boxShadow: "0 0 0 1px rgba(52,211,153,0.03), 0 12px 40px rgba(0,0,0,0.4)" }}>
            {Array.from({ length: 7 }).map((_, dayIdx) => {
              const date = new Date(currentMonday);
              date.setDate(date.getDate() + dayIdx);
              const isToday = new Date().toDateString() === date.toDateString();
              const events = byDay[dayIdx] || [];
              const highEvents = events.filter(e => e.impact === "high");

              return (
                <div key={dayIdx} className={cn(
                  "min-h-[300px] border-r border-b border-emerald-400/[0.06] last:border-r-0"
                )} style={{ background: isToday ? "rgba(52,211,153,0.02)" : "rgba(4,10,18,0.5)" }}>

                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-emerald-400/[0.08] sticky top-0 z-10"
                    style={{ background: isToday ? "linear-gradient(90deg, rgba(52,211,153,0.08) 0%, rgba(4,10,18,0.9) 100%)" : "linear-gradient(90deg, rgba(52,211,153,0.03) 0%, rgba(4,10,18,0.9) 100%)" }}>
                    <div className="flex items-center gap-1">
                      <span className={cn("text-[11px] font-bold", isToday ? "text-emerald-400" : "text-white/60")}>{DAYS_SHORT[dayIdx]}</span>
                      {events.length > 0 && (
                        <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/[0.06] px-1.5 text-[8px] font-bold text-emerald-400/70 tabular-nums">{events.length}</span>
                      )}
                      {highEvents.length > 0 && (
                        <span className="rounded-sm border border-red-400/20 bg-red-400/[0.06] px-1 text-[7px] font-bold text-red-400/70">🔴{highEvents.length}</span>
                      )}
                    </div>
                    <span className={cn("text-[11px] tabular-nums font-bold",
                      isToday ? "text-emerald-400 bg-emerald-400/15 rounded-full w-6 h-6 flex items-center justify-center" : "text-white/35"
                    )}>{date.getDate()}</span>
                  </div>

                  <div className="px-1 py-1 space-y-0.5">
                    {events.length === 0 && <div className="text-[8px] text-white/10 text-center mt-8">No events</div>}
                    {events.map((e, ei) => {
                      const ic = IMPACT_CFG[e.impact];
                      return (
                        <div key={ei} className="flex items-start gap-1 px-1 py-1 rounded-sm hover:bg-white/[0.03] transition-colors">
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-1", ic.dot)} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[9px] text-white/70 font-semibold truncate">{e.event}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[8px] text-white/25 tabular-nums">{e.time}</span>
                              <span className="text-[8px]">{REGION_FLAGS[e.region]}</span>
                              {e.actual && <span className="text-[8px] text-emerald-400/70 font-bold">{e.actual}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom ticker */}
        <div className="flex items-center gap-4 text-[10px] tabular-nums rounded-sm border border-emerald-400/[0.06] px-3 py-2 overflow-x-auto scrollbar-hide"
          style={{ background: "rgba(4,10,18,0.6)" }}>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400/60 animate-pulse" />
            <span className="text-white/35 font-semibold">Calendar Active</span>
          </span>
          <span className="text-white/30 shrink-0">Next: <span className="text-red-400 font-semibold">Nonfarm Payrolls</span> · Fri 08:30 ET</span>
          <span className="text-white/40 shrink-0">Dow <span className="text-red-400 font-semibold">45,166.64 -1.73%</span></span>
          <span className="text-white/40 shrink-0">S&P <span className="text-red-400 font-semibold">6,368.85 -1.67%</span></span>
        </div>
      </div>
    </div>
  );
}
