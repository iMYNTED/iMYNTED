// app/components/TapePanel.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSettings } from "./SettingsContext";

/* ── Types ─────────────────────────────────────────────────────── */
type Side  = "B" | "S" | "M";
type Tab   = "ticks" | "summary";
type Density = "compact" | "normal" | "large";

interface Print { ts: string; price: number; size: number; side?: Side; venue?: string }
interface CanonQuote {
  symbol?: string; asset?: "stock" | "crypto"; price?: number; last?: number;
  mid?: number; bid?: number; ask?: number; ts?: string; provider?: string; warn?: string;
}
interface TapeResp {
  ok?: boolean; provider?: string; asset?: "stock" | "crypto"; symbol?: string;
  price?: number; last?: number; mid?: number; bid?: number; ask?: number;
  ts?: string; prints?: Print[]; data?: Print[];
  warning?: string; warn?: string; error?: string;
}

/* ── Constants ─────────────────────────────────────────────────── */
const DENSITY_COLS:   Record<Density, number> = { compact: 3, normal: 2, large: 1 };
const DENSITY_ROW_H:  Record<Density, number> = { compact: 20, normal: 26, large: 34 };
const DENSITY_PRICE:  Record<Density, number> = { compact: 10, normal: 12, large: 14 };
const DENSITY_TIME:   Record<Density, number> = { compact: 8,  normal: 9,  large: 10 };
const DENSITY_SIZE:   Record<Density, number> = { compact: 8,  normal: 10, large: 12 };

/* ── Helpers ───────────────────────────────────────────────────── */
function cn(...xs: Array<string | false | null | undefined>) { return xs.filter(Boolean).join(" "); }

function hhmmss(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}

function n(v: any) {
  const x = typeof v === "string" ? Number(v.replace(/,/g,"").trim()) : Number(v);
  return Number.isFinite(x) ? x : 0;
}
function nU(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;
  const x = typeof v === "string" ? Number(v.replace(/,/g,"").trim()) : Number(v);
  return Number.isFinite(x) ? x : undefined;
}

function fmtPx(v: number, asset: string) {
  if (!Number.isFinite(v)) return "—";
  if (asset === "crypto") { if (v >= 100) return v.toFixed(2); if (v >= 1) return v.toFixed(4); return v.toFixed(6); }
  return v >= 1 ? v.toFixed(2) : v.toFixed(4);
}
function fmtVol(v: number) {
  if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v/1_000).toFixed(1)}K`;
  if (v >= 1)         return String(Math.round(v));
  if (v >= 0.01)      return v.toFixed(2);
  if (v >= 0.001)     return v.toFixed(3);
  if (v > 0)          return v.toFixed(4);
  return "0";
}

function printSig(p?: Partial<Print> | null) {
  if (!p) return "";
  return `${p.ts}|${Number.isFinite(Number(p.price))?Number(p.price):0}|${Number.isFinite(Number(p.size))?Number(p.size):0}|${p.side||"M"}`;
}

function normSym(raw: string) {
  return String(raw||"").trim().toUpperCase().replace(/\s+/g,"").replace(/[^A-Z0-9.\-]/g,"");
}
function normalizeCryptoSymbol(raw: string) {
  const s = normSym(raw); if (!s) return "BTC-USD";
  if (s.includes("-")) return s;
  if (s.endsWith("USD")) return s.replace(/USD$/,"-USD");
  return `${s}-USD`;
}
function normalizeStockSymbol(raw: string) {
  let s = normSym(raw); if (!s) return "AAPL";
  s = s.replace(/-USD$/i,"").replace(/[0-9]+$/,"");
  if (s.includes("-")) return "AAPL";
  return s.replace(/[^A-Z0-9.]/g,"") || "AAPL";
}
function normalizeSymbol(assetKey: string, raw: string) {
  return assetKey === "crypto" ? normalizeCryptoSymbol(raw) : normalizeStockSymbol(raw);
}

/* ── Ring Chart ─────────────────────────────────────────────────── */
function RingChart({ buy, sell, neut }: { buy: number; sell: number; neut: number }) {
  const total = buy + sell + neut;
  const R = 30; const C = 2 * Math.PI * R;
  if (total === 0) return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10"/>
    </svg>
  );
  const buyPct = buy/total; const sellPct = sell/total; const neutPct = neut/total;
  const buyLen = C*buyPct; const sellLen = C*sellPct; const neutLen = C*neutPct;
  const offset0 = -C*0.25;
  const offset1 = offset0 - C*buyPct;
  const offset2 = offset1 - C*sellPct;
  return (
    <div className="relative shrink-0" style={{width:80,height:80}}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10"/>
        <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(52,211,153,0.90)" strokeWidth="10"
          strokeDasharray={`${buyLen} ${C-buyLen}`} strokeDashoffset={offset0}/>
        <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(248,113,113,0.90)" strokeWidth="10"
          strokeDasharray={`${sellLen} ${C-sellLen}`} strokeDashoffset={offset1}/>
        <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(148,163,184,0.45)" strokeWidth="10"
          strokeDasharray={`${neutLen} ${C-neutLen}`} strokeDashoffset={offset2}/>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
        <span className="text-[11px] font-black tabular-nums text-emerald-300">{(buyPct*100).toFixed(0)}%</span>
        <span className="text-[8px] text-white/30">BUY</span>
      </div>
    </div>
  );
}

/* ── Distribution Bar ─────────────────────────────────────────── */
function DistBar({ buy, sell }: { buy: number; sell: number }) {
  const total = buy + sell; if (!total) return null;
  const buyPct = (buy/total)*100;
  return (
    <div className="flex items-center gap-1.5 min-w-0 flex-1">
      <span className="text-[9px] font-bold text-emerald-400/80 tabular-nums shrink-0 w-7 text-right">{buyPct.toFixed(0)}%</span>
      <div className="relative flex-1 h-[6px] rounded-sm overflow-hidden bg-white/[0.07]">
        <div className="absolute inset-y-0 left-0 bg-emerald-400/70 rounded-l-sm transition-all duration-300" style={{width:`${buyPct}%`}}/>
        <div className="absolute inset-y-0 right-0 bg-red-400/70 rounded-r-sm transition-all duration-300" style={{width:`${100-buyPct}%`}}/>
      </div>
      <span className="text-[9px] font-bold text-red-400/80 tabular-nums shrink-0 w-7">{(100-buyPct).toFixed(0)}%</span>
    </div>
  );
}

/* ── Summary Tab ───────────────────────────────────────────────── */
function SummaryView({ prints, assetKey }: { prints: Print[]; assetKey: string }) {
  const data = useMemo(() => {
    const total = prints.length; if (!total) return null;
    let buyVol = 0, sellVol = 0, neutVol = 0, totalVol = 0;
    let priceSum = 0;
    const pxMap = new Map<string, { px: number; buy: number; sell: number; neut: number; vol: number }>();

    for (const p of prints) {
      const px  = n(p.price); const sz = n(p.size);
      const side: Side = p.side === "B" || p.side === "S" ? p.side : "M";
      priceSum += px; totalVol += sz;
      if (side === "B") buyVol += sz; else if (side === "S") sellVol += sz; else neutVol += sz;
      const key = px.toFixed(4);
      const e = pxMap.get(key) || { px, buy:0, sell:0, neut:0, vol:0 };
      if (side === "B") e.buy += sz; else if (side === "S") e.sell += sz; else e.neut += sz;
      e.vol += sz; pxMap.set(key, e);
    }

    const levels = [...pxMap.values()].sort((a,b) => b.px - a.px)
      .map(l => ({ ...l, pctVol: totalVol ? (l.vol/totalVol)*100 : 0 }));
    const maxVol = Math.max(...levels.map(l => l.vol), 1);

    return { avgPx: priceSum/total, totalTrades: total, totalVol, buyVol, sellVol, neutVol, levels, maxVol };
  }, [prints]);

  if (!data) return (
    <div className="flex-1 flex items-center justify-center text-[11px] text-white/25">No data yet.</div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

      {/* Overview + Ring */}
      <div className="shrink-0 flex gap-3 p-3 border-b border-white/[0.06]">
        {/* Overview stats */}
        <div className="flex-1 grid grid-cols-3 gap-2">
          {[
            { label: "AVG PRICE", val: fmtPx(data.avgPx, assetKey), color: "text-white/80" },
            { label: "TOTAL TRADES", val: fmtVol(data.totalTrades), color: "text-cyan-300/80" },
            { label: "VOLUME", val: fmtVol(data.totalVol), color: "text-white/80" },
          ].map(({ label, val, color }) => (
            <div key={label} className="rounded-sm border border-white/[0.07] bg-white/[0.03] px-2.5 py-2 flex flex-col gap-0.5">
              <span className="text-[7px] font-black uppercase tracking-widest text-white/25">{label}</span>
              <span className={cn("text-[14px] font-black tabular-nums leading-none", color)}>{val}</span>
            </div>
          ))}
        </div>

        {/* Ring chart + legend */}
        <div className="shrink-0 flex items-center gap-3">
          <RingChart buy={data.buyVol} sell={data.sellVol} neut={data.neutVol} />
          <div className="flex flex-col gap-1.5">
            {[
              { label: "ACTIVE BUY",  val: fmtVol(data.buyVol),  color: "text-emerald-400", dot: "bg-emerald-400/80" },
              { label: "ACTIVE SELL", val: fmtVol(data.sellVol), color: "text-red-400",     dot: "bg-red-400/80" },
              { label: "NEUTRAL",     val: fmtVol(data.neutVol), color: "text-slate-400",   dot: "bg-slate-400/50" },
            ].map(({ label, val, color, dot }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-sm shrink-0", dot)} />
                <div className="flex flex-col">
                  <span className="text-[7px] font-black uppercase tracking-widest text-white/25">{label}</span>
                  <span className={cn("text-[12px] font-black tabular-nums leading-none", color)}>{val}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Price-level table */}
      <div className="shrink-0 grid px-3 py-1.5 border-b border-white/[0.04]"
        style={{ gridTemplateColumns: "1fr 56px 56px 52px 1fr 40px" }}>
        {["PRICE","A.BUY","A.SELL","NEUT","SIZE","% VOL"].map((h,i) => (
          <span key={h} className={cn("text-[8px] font-black uppercase tracking-widest text-white/22",
            i >= 1 && "text-right")}>{h}</span>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {data.levels.map((lvl, i) => {
          const dom = lvl.buy > lvl.sell ? "buy" : lvl.sell > lvl.buy ? "sell" : "neut";
          const barBuyW  = (lvl.buy  / data.maxVol) * 100;
          const barSellW = (lvl.sell / data.maxVol) * 100;
          const barNeutW = (lvl.neut / data.maxVol) * 100;
          return (
            <div key={`${lvl.px}-${i}`}
              className="grid items-center px-3 border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors"
              style={{ gridTemplateColumns: "1fr 56px 56px 52px 1fr 40px", height: 24 }}>
              <span className={cn("text-[11px] font-black tabular-nums",
                dom === "buy" ? "text-emerald-300" : dom === "sell" ? "text-red-300" : "text-white/60")}>
                {fmtPx(lvl.px, assetKey)}
              </span>
              <span className="text-[10px] tabular-nums text-emerald-400/80 text-right">{fmtVol(lvl.buy)}</span>
              <span className="text-[10px] tabular-nums text-red-400/80 text-right">{fmtVol(lvl.sell)}</span>
              <span className="text-[10px] tabular-nums text-white/35 text-right">{fmtVol(lvl.neut)}</span>
              {/* Stacked size bar */}
              <div className="px-1.5">
                <div className="relative h-[5px] rounded-sm overflow-hidden bg-white/[0.06]">
                  <div className="absolute inset-y-0 left-0 bg-emerald-400/60 rounded-sm"
                    style={{ width: `${barBuyW}%` }} />
                  <div className="absolute inset-y-0 bg-red-400/60 rounded-sm"
                    style={{ left: `${barBuyW}%`, width: `${barSellW}%` }} />
                  <div className="absolute inset-y-0 bg-white/20 rounded-sm"
                    style={{ left: `${barBuyW + barSellW}%`, width: `${barNeutW}%` }} />
                </div>
              </div>
              <span className="text-[9px] tabular-nums text-white/35 text-right">{lvl.pctVol.toFixed(1)}%</span>
            </div>
          );
        })}
        {data.levels.length === 0 && (
          <div className="px-3 py-6 text-[11px] text-white/25">Accumulating data…</div>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────── */
export function TapePanel({ symbol, asset }: { symbol: string; asset?: "stock" | "crypto" | string }) {
  const { upColor, downColor, upRgba, downRgba, settings } = useSettings();
  const assetKey = useMemo(() => (asset || "stock").toLowerCase().trim(), [asset]);
  const sym      = useMemo(() => normalizeSymbol(assetKey, symbol), [assetKey, symbol]);

  const MAX_ROWS  = 700;
  const REQUEST_N = 650;

  const [prints, setPrints]           = useState<Print[]>([]);
  const [err, setErr]                 = useState<string>("");
  const [isLive, setIsLive]           = useState(true);
  const [tab, setTab]                 = useState<Tab>("ticks");
  const [density, setDensity]         = useState<Density>("normal");
  const [sideFilter, setSideFilter]   = useState<"ALL" | "B" | "S">("ALL");
  const [minSize, setMinSize]         = useState(0);
  const [detached, setDetached]       = useState(false);

  const [dragPos, setDragPos] = useState({ x: 100, y: 80 });
  const dragRef = useRef<{ ox: number; oy: number } | null>(null);
  function onDragStart(e: React.PointerEvent) { e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { ox: e.clientX-dragPos.x, oy: e.clientY-dragPos.y }; }
  function onDragMove(e: React.PointerEvent) { if (!dragRef.current) return; setDragPos({ x: e.clientX-dragRef.current.ox, y: e.clientY-dragRef.current.oy }); }
  function onDragEnd() { dragRef.current = null; }

  const [buyVol, setBuyVol]   = useState(0);
  const [sellVol, setSellVol] = useState(0);
  const [snap, setSnap] = useState<{ px?: number; mid?: number; bid?: number; ask?: number; last?: number; warn?: string }>({});
  const snapOkAtRef = useRef<number>(0);

  const sweepThreshold = useMemo(() => assetKey === "crypto" ? 2 : 1200, [assetKey]);
  const blockThreshold = useMemo(() => assetKey === "crypto" ? 10 : 5000, [assetKey]);

  const [lastSweepSide, setLastSweepSide] = useState<"B" | "S" | null>(null);
  const lastSweepSideRef = useRef<"B" | "S" | null>(null);
  const [sweepStreak, setSweepStreak] = useState(0);
  const sweepTimesRef = useRef<number[]>([]);
  const [burst, setBurst] = useState(false);
  const lastSeenSigRef = useRef<string>("");
  const [flashKey, setFlashKey] = useState("");
  const abortRef    = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const aliveRef    = useRef(true);
  const symRef      = useRef(sym);

  useEffect(() => { lastSweepSideRef.current = lastSweepSide; }, [lastSweepSide]);

  useEffect(() => {
    symRef.current = sym;
    setBuyVol(0); setSellVol(0); setSweepStreak(0); setLastSweepSide(null);
    setBurst(false); sweepTimesRef.current = []; lastSeenSigRef.current = "";
    setFlashKey(""); setPrints([]); setErr(""); setSnap({}); snapOkAtRef.current = 0;
  }, [sym, assetKey]);

  useEffect(() => { if (!isLive) { abortRef.current?.abort(); inFlightRef.current = false; } }, [isLive]);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; abortRef.current?.abort(); }; }, []);

  /* Finnhub WebSocket for real-time trades (stocks only, market hours) */
  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    if (!isLive || assetKey === "crypto") return;
    let alive = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: any;

    async function connect() {
      try {
        const res = await fetch("/api/market/ws-token");
        const j = await res.json();
        if (!j?.ok || !j.wsUrl || !alive) return;

        ws = new WebSocket(j.wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!alive || !ws) return;
          ws.send(JSON.stringify({ type: "subscribe", symbol: symRef.current }));
        };

        ws.onmessage = (ev) => {
          if (!alive) return;
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type !== "trade" || !Array.isArray(msg.data)) return;
            const newPrints: Print[] = msg.data
              .filter((t: any) => {
                const s = String(t.s || "").toUpperCase();
                return s === symRef.current;
              })
              .map((t: any) => ({
                ts: new Date(t.t).toISOString(),
                price: t.p,
                size: t.v || 0,
                side: "M" as Side, // Finnhub WS doesn't provide side
                venue: "LIVE",
              }));
            if (newPrints.length === 0) return;

            setPrints(prev => {
              const merged = [...newPrints, ...prev].slice(0, MAX_ROWS);
              const newest = merged[0];
              const sig = printSig(newest);
              if (sig && sig !== lastSeenSigRef.current) {
                lastSeenSigRef.current = sig;
                setFlashKey(sig);
                window.setTimeout(() => setFlashKey(""), 200);
              }
              return merged;
            });
          } catch {}
        };

        ws.onclose = () => {
          wsRef.current = null;
          if (alive) reconnectTimer = setTimeout(connect, 5000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        if (alive) reconnectTimer = setTimeout(connect, 10000);
      }
    }

    connect();

    return () => {
      alive = false;
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        try { wsRef.current.send(JSON.stringify({ type: "unsubscribe", symbol: symRef.current })); } catch {}
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [sym, assetKey, isLive]);

  // Re-subscribe when symbol changes while WS is open
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // Unsubscribe old, subscribe new — symRef already updated by the reset effect
    ws.send(JSON.stringify({ type: "subscribe", symbol: sym }));
  }, [sym]);

  /* Quote bus */
  useEffect(() => {
    function onQuote(ev: any) {
      const d: CanonQuote = ev?.detail || {};
      const ea = d?.asset === "crypto" ? "crypto" : "stock";
      if (ea !== (assetKey === "crypto" ? "crypto" : "stock")) return;
      const esym = normalizeSymbol(assetKey, String(d?.symbol||"").toUpperCase().trim());
      if (!esym || esym !== sym) return;
      snapOkAtRef.current = Date.now();
      setSnap({ px: typeof d.price==="number"?d.price:undefined, mid: typeof d.mid==="number"?d.mid:undefined, bid: typeof d.bid==="number"?d.bid:undefined, ask: typeof d.ask==="number"?d.ask:undefined, last: typeof d.last==="number"?d.last:undefined, warn: typeof d.warn==="string"?d.warn:undefined });
    }
    window.addEventListener("imynted:quote",       onQuote as any);
    window.addEventListener("imynted:quoteUpdate", onQuote as any);
    window.addEventListener("msa:quote",           onQuote as any);
    return () => {
      window.removeEventListener("imynted:quote",       onQuote as any);
      window.removeEventListener("imynted:quoteUpdate", onQuote as any);
      window.removeEventListener("msa:quote",           onQuote as any);
    };
  }, [sym, assetKey]);

  /* Poll loop */
  useEffect(() => {
    if (!isLive) return;
    let timer: any;
    async function poll() {
      if (!aliveRef.current) return;
      if (inFlightRef.current) { timer = window.setTimeout(poll, 900); return; }
      inFlightRef.current = true;
      abortRef.current?.abort();
      const ac = new AbortController(); abortRef.current = ac;
      try {
        const qs = new URLSearchParams({ symbol: sym, n: String(REQUEST_N) });
        if (assetKey) qs.set("asset", assetKey);
        const res  = await fetch(`/api/market/tape?${qs}`, { cache:"no-store", signal: ac.signal });
        if (!res.ok) throw new Error(`Tape ${res.status}`);
        const json: TapeResp = await res.json().catch(() => ({}));
        if (!aliveRef.current) return;
        if (symRef.current !== sym) return; // stale response for old symbol

        if (json?.ok === false) setErr(String(json.error||json.warning||json.warn||"Error")); else setErr("");

        const busFresh = snapOkAtRef.current && Date.now()-snapOkAtRef.current < 3500;
        if (!busFresh) {
          setSnap(prev => ({
            ...prev,
            px:   nU(json.price) ?? prev.px,
            last: nU(json.last)  ?? nU(json.price) ?? prev.last,
            mid:  nU(json.mid)   ?? prev.mid,
            bid:  nU(json.bid)   ?? prev.bid,
            ask:  nU(json.ask)   ?? prev.ask,
          }));
        }

        const next: Print[] = (Array.isArray(json.prints)?json.prints:null)
          || (Array.isArray(json.data)?json.data:null)
          || (Array.isArray(json)?json as any:[]);

        setPrints(prev => {
          const merged = (next?.length ? [...next] : prev).slice(0, MAX_ROWS);
          const newest = merged[0]; const sig = printSig(newest);
          if (sig && sig !== lastSeenSigRef.current) {
            lastSeenSigRef.current = sig;
            setFlashKey(sig); window.setTimeout(() => setFlashKey(""), 200);
            const sz = n(newest?.size||0);
            const side: Side = newest?.side==="B"||newest?.side==="S"?newest.side:"M";
            if (side==="B") setBuyVol(x=>x+sz);
            if (side==="S") setSellVol(x=>x+sz);
            if (sz >= sweepThreshold && (side==="B"||side==="S")) {
              const prior = lastSweepSideRef.current;
              setSweepStreak(cur => prior===side ? cur+1 : 1);
              setLastSweepSide(side);
              const now = Date.now();
              sweepTimesRef.current = [...sweepTimesRef.current, now].filter(t => now-t<=6000);
              const hit = sweepTimesRef.current.length >= 3;
              setBurst(hit); if (hit) window.setTimeout(() => setBurst(false), 1000);
            }
          }
          return merged;
        });
      } catch(e: any) {
        if (!aliveRef.current || e?.name==="AbortError") return;
        setErr(e?.message||"Tape error");
      } finally {
        inFlightRef.current = false;
        if (!aliveRef.current) return;
        timer = window.setTimeout(poll, 900);
      }
    }
    poll();
    return () => { if (timer) window.clearTimeout(timer); abortRef.current?.abort(); inFlightRef.current = false; };
  }, [sym, assetKey, isLive, sweepThreshold]);

  /* Filtered prints */
  const filteredPrints = useMemo(() => {
    let p = prints;
    if (sideFilter !== "ALL") p = p.filter(r => r.side === sideFilter);
    if (minSize > 0)          p = p.filter(r => n(r.size) >= minSize);
    return p;
  }, [prints, sideFilter, minSize]);

  const net = buyVol - sellVol;

  /* ── Density config ── */
  const cols   = DENSITY_COLS[density];
  const rowH   = DENSITY_ROW_H[density];
  const priceF = DENSITY_PRICE[density];
  const timeF  = DENSITY_TIME[density];
  const sizeF  = DENSITY_SIZE[density];

  /* ── Shared header ── */
  const header = (
    <div className="shrink-0 border-b border-white/[0.07]" style={{ background: "rgba(2,8,18,0.92)" }}>

      {/* Row 1: brand + tabs + symbol pill + controls */}
      <div className="flex items-center gap-2 h-[38px] px-3 border-b border-white/[0.06]">

        {/* iMYNTED brand label */}
        <div className="flex items-center gap-1.5 shrink-0 mr-1">
          <span className="text-[8px] font-black tracking-[0.18em] uppercase"
            style={{ color: "rgba(52,211,153,0.85)" }}>iMYNTED</span>
          <span className="text-white/[0.12]">|</span>
          <span className="text-[8px] font-black tracking-[0.14em] uppercase text-white/30">TAPE</span>
        </div>

        {/* TICKS / SUMMARY tabs */}
        <div className="flex rounded-sm border border-white/[0.09] overflow-hidden shrink-0">
          {(["ticks","summary"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} type="button"
              className={cn(
                "px-3 py-1 text-[9px] font-black tracking-widest uppercase transition-colors",
                tab === t
                  ? "bg-emerald-400/[0.13] text-emerald-300 border-r border-white/[0.06]"
                  : "text-white/28 hover:text-white/60 border-r border-white/[0.04] last:border-0"
              )}>
              {t === "ticks" ? "TICKS" : "SUMMARY"}
            </button>
          ))}
        </div>

        {/* Symbol pill */}
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-sm border shrink-0",
          assetKey === "crypto"
            ? "border-amber-400/25 bg-amber-400/[0.06]"
            : "border-emerald-400/20 bg-emerald-400/[0.05]"
        )}>
          <span className="text-[13px] font-black text-white/90 tracking-wide">{sym}</span>
          <span className={cn(
            "text-[7px] font-black uppercase tracking-widest px-1.5 py-px rounded-sm border",
            assetKey === "crypto"
              ? "border-amber-400/35 text-amber-300/90 bg-amber-400/[0.12]"
              : "border-cyan-400/30 text-cyan-300/80 bg-cyan-400/[0.10]"
          )}>
            {assetKey.toUpperCase()}
          </span>
        </div>

        {/* Sweep / Burst badges */}
        {sweepStreak >= 2 && lastSweepSide && (
          <span className={cn("shrink-0 rounded-sm border px-2 py-px text-[9px] font-black tracking-wider",
            lastSweepSide==="B" ? "border-emerald-400/45 text-emerald-200 bg-emerald-400/[0.10]"
                                : "border-red-400/45 text-red-200 bg-red-400/[0.10]")}>
            {lastSweepSide==="B"?"BUY":"SELL"} ×{sweepStreak}
          </span>
        )}
        {burst && (
          <span className="shrink-0 rounded-sm border border-yellow-400/45 bg-yellow-400/[0.10] px-2 py-px text-[9px] font-black tracking-wider text-yellow-200 animate-pulse">
            BURST
          </span>
        )}

        <div className="flex-1" />

        {/* Bid × Ask pills */}
        {(snap.bid !== undefined || snap.ask !== undefined) && (
          <div className="flex items-center gap-1 mr-2 shrink-0">
            {snap.bid !== undefined && (
              <span className="px-1.5 py-px rounded-sm border border-emerald-400/20 bg-emerald-400/[0.07] text-[10px] font-bold tabular-nums text-emerald-300">
                {fmtPx(n(snap.bid), assetKey)}
              </span>
            )}
            {snap.bid !== undefined && snap.ask !== undefined && (
              <span className="text-white/15 text-[9px]">×</span>
            )}
            {snap.ask !== undefined && (
              <span className="px-1.5 py-px rounded-sm border border-red-400/20 bg-red-400/[0.07] text-[10px] font-bold tabular-nums text-red-300">
                {fmtPx(n(snap.ask), assetKey)}
              </span>
            )}
          </div>
        )}

        {/* Live indicator + button */}
        <button onClick={() => setIsLive(v=>!v)} type="button"
          className={cn("shrink-0 flex items-center gap-1.5 rounded-sm border px-2 py-px text-[9px] font-black tracking-widest uppercase transition-colors mr-1",
            isLive ? "border-emerald-400/30 text-emerald-400/90 bg-emerald-400/[0.07]" : "border-white/10 text-white/30")}>
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
          {isLive ? "LIVE" : "PAUSED"}
        </button>
        <button onClick={() => setDetached(v=>!v)} type="button"
          className="text-[12px] text-white/20 hover:text-emerald-400 transition-colors px-1">⧉</button>
      </div>

      {/* Row 2: vol stat pills + dist bar */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* BUY pill */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-emerald-400/20 bg-emerald-400/[0.06] shrink-0">
          <span className="text-[7px] font-black uppercase tracking-widest text-emerald-400/60">BUY</span>
          <span className="text-[11px] font-black tabular-nums text-emerald-300">{fmtVol(buyVol)}</span>
        </div>
        {/* SELL pill */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-red-400/20 bg-red-400/[0.06] shrink-0">
          <span className="text-[7px] font-black uppercase tracking-widest text-red-400/60">SELL</span>
          <span className="text-[11px] font-black tabular-nums text-red-300">{fmtVol(sellVol)}</span>
        </div>
        {/* NET pill */}
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-sm border shrink-0",
          net >= 0 ? "border-emerald-400/20 bg-emerald-400/[0.04]" : "border-red-400/20 bg-red-400/[0.04]"
        )}>
          <span className="text-[7px] font-black uppercase tracking-widest text-white/25">NET</span>
          <span className={cn("text-[11px] font-black tabular-nums", net>=0?"text-emerald-300":"text-red-300")}>
            {net>=0?"+":""}{fmtVol(net)}
          </span>
        </div>
        <DistBar buy={buyVol} sell={sellVol} />
        <span className="text-[8px] text-white/18 tabular-nums shrink-0">{prints.length.toLocaleString()} rows</span>
      </div>

      {/* Row 3: filters + density (only on ticks tab) */}
      {tab === "ticks" && (
        <div className="flex items-center gap-2 px-3 pb-1.5">
          {/* Side filter */}
          <div className="flex rounded-sm border border-white/[0.08] overflow-hidden shrink-0">
            {(["ALL","B","S"] as const).map(f => (
              <button key={f} onClick={() => setSideFilter(f)} type="button"
                className={cn("px-2.5 py-1 text-[8px] font-black tracking-widest uppercase transition-colors",
                  sideFilter===f
                    ? f==="B" ? "bg-emerald-400/[0.15] text-emerald-300"
                      : f==="S" ? "bg-red-400/[0.15] text-red-300"
                      : "bg-white/[0.08] text-white/80"
                    : "text-white/25 hover:text-white/55"
                )}>
                {f==="ALL"?"ALL":f==="B"?"BUY":"SELL"}
              </button>
            ))}
          </div>
          {/* Min size */}
          <div className="flex items-center gap-1">
            {[0, 100, 500, 1000, 5000].map(v => (
              <button key={v} onClick={() => setMinSize(v)} type="button"
                className={cn("px-2 py-px rounded-sm text-[8px] font-bold tabular-nums border transition-colors",
                  minSize===v ? "border-emerald-400/35 text-emerald-300 bg-emerald-400/[0.08]"
                              : "border-transparent text-white/25 hover:text-white/55")}>
                {v===0?"ALL":v>=1000?`${v/1000}K`:v}
              </button>
            ))}
          </div>
          <div className="flex-1"/>
          {/* Density selector */}
          <div className="flex rounded-sm border border-white/[0.08] overflow-hidden shrink-0">
            {(["compact","normal","large"] as Density[]).map(d => (
              <button key={d} onClick={() => setDensity(d)} type="button"
                className={cn("px-2 py-px text-[8px] font-black uppercase tracking-wider transition-colors",
                  density===d ? "bg-white/[0.08] text-white/80" : "text-white/22 hover:text-white/55")}>
                {d==="compact"?"S":d==="normal"?"M":"L"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  /* ── Split prints into columns (top-to-bottom per column) ── */
  const columnizedPrints = useMemo(() => {
    if (cols <= 1) return [filteredPrints];
    const rowsPerCol = Math.ceil(filteredPrints.length / cols);
    return Array.from({ length: cols }, (_, ci) =>
      filteredPrints.slice(ci * rowsPerCol, (ci + 1) * rowsPerCol)
    );
  }, [filteredPrints, cols]);

  /* ── Render a single tick row ── */
  function TickRow({ p, idx }: { p: Print; idx: number }) {
    const side: Side = p.side==="B"||p.side==="S" ? p.side : "M";
    const sz         = n(p.size);
    const isSweep    = sz >= sweepThreshold && (side==="B"||side==="S");
    const isBlock    = sz >= blockThreshold && (side==="B"||side==="S");
    const isFlash    = printSig(p) === flashKey;

    const rowBg =
      isBlock ? side==="B" ? "rgba(52,211,153,0.11)" : "rgba(248,113,113,0.11)" :
      isSweep ? side==="B" ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)" :
      isFlash ? "rgba(255,255,255,0.07)" :
      side==="B" ? "rgba(52,211,153,0.025)" :
      side==="S" ? "rgba(248,113,113,0.025)" :
      "transparent";

    return (
      <div key={`${p.ts}-${idx}`}
        className="relative flex items-center gap-1.5 px-2.5 overflow-hidden"
        style={{
          height: rowH, background: rowBg,
          borderBottom: side==="B" ? "1px solid rgba(52,211,153,0.08)"
                      : side==="S" ? "1px solid rgba(248,113,113,0.08)"
                      : "1px solid rgba(255,255,255,0.03)",
        }}>
        {/* Left glow — contained by relative+overflow-hidden on parent */}
        {side !== "M" && (
          <div className="absolute inset-y-0 left-0 w-1/4 pointer-events-none"
            style={{ background: side==="B"
              ? "linear-gradient(to right, rgba(52,211,153,0.10), transparent)"
              : "linear-gradient(to right, rgba(248,113,113,0.10), transparent)" }}/>
        )}
        <span className="tabular-nums text-white/30 shrink-0 z-10" style={{ fontSize: timeF }}>
          {hhmmss(p.ts)}
        </span>
        <span className={cn("tabular-nums font-bold flex-1 min-w-0 z-10",
          side==="B" ? "text-emerald-300" : side==="S" ? "text-red-300" : "text-white/65")}
          style={{ fontSize: priceF }}>
          {fmtPx(n(p.price), assetKey)}
        </span>
        <span className="tabular-nums text-white/65 shrink-0 font-medium z-10" style={{ fontSize: sizeF }}>
          {fmtVol(sz)}
        </span>
        {/* Side pill — iMYNTED branded */}
        <span className={cn(
          "shrink-0 z-10 rounded-sm border px-1.5 py-px font-black tracking-widest uppercase leading-none",
          isBlock
            ? side==="B" ? "border-emerald-400/60 text-emerald-200 bg-emerald-400/[0.18] text-[8px]"
                         : side==="S" ? "border-red-400/60 text-red-200 bg-red-400/[0.18] text-[8px]"
                         : "border-white/20 text-white/50 bg-white/[0.06] text-[8px]"
            : isSweep
            ? side==="B" ? "border-emerald-400/45 text-emerald-300 bg-emerald-400/[0.12] text-[8px]"
                         : side==="S" ? "border-red-400/45 text-red-300 bg-red-400/[0.12] text-[8px]"
                         : "border-white/15 text-white/35 bg-transparent text-[8px]"
            : side==="B" ? "border-emerald-400/25 text-emerald-400/80 bg-emerald-400/[0.07] text-[8px]"
            : side==="S" ? "border-red-400/25 text-red-400/80 bg-red-400/[0.07] text-[8px]"
            : "border-white/10 text-white/20 bg-transparent text-[8px]"
        )}>
          {isBlock
            ? side==="B" ? "BLK B" : side==="S" ? "BLK S" : "M"
            : isSweep
            ? side==="B" ? "SWP B" : side==="S" ? "SWP S" : "M"
            : side==="B" ? "B" : side==="S" ? "S" : "M"}
        </span>
      </div>
    );
  }

  /* ── Ticks view ── */
  const ticksView = (
    <div className="flex-1 min-h-0 overflow-auto">
      {filteredPrints.length === 0 ? (
        <div className="px-3 py-6 text-[11px] text-white/25">
          {prints.length > 0 ? "No prints match filter." : "No tape data yet."}
        </div>
      ) : (
        <div className="flex min-h-full">
          {columnizedPrints.map((col, ci) => (
            <div key={ci} className="flex-1 min-w-0"
              style={{ borderRight: ci < columnizedPrints.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              {col.map((p, idx) => <TickRow key={`${ci}-${p.ts}-${idx}`} p={p} idx={idx} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /* ── Full panel ── */
  const fullPanel = (
    <div className="h-full min-h-0 flex flex-col" style={{ background: "linear-gradient(180deg,#020b14 0%,#010710 100%)" }}>
      {header}
      {err && (
        <div className="shrink-0 border-b border-red-500/20 bg-red-500/10 px-3 py-1 text-[10px] text-red-300">{err}</div>
      )}
      {tab === "ticks" ? ticksView : <SummaryView prints={prints} assetKey={assetKey}/>}
    </div>
  );

  return (
    <>
      {fullPanel}
      {detached && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9996]" style={{ pointerEvents:"none" }}>
          <div className="absolute border border-emerald-400/[0.08] rounded-sm overflow-hidden flex flex-col"
            style={{
              left: dragPos.x, top: dragPos.y, width:"60vw", height:"calc(100vh - 60px)",
              pointerEvents:"auto",
              background: ["radial-gradient(ellipse 70% 35% at 8% 0%, rgba(52,211,153,0.08) 0%, transparent 100%)",
                "linear-gradient(180deg, rgba(5,11,22,0.99) 0%, rgba(2,6,14,0.99) 100%)"].join(", "),
              boxShadow:"0 0 0 1px rgba(52,211,153,0.06), 0 25px 60px rgba(0,0,0,0.75)",
            }}>
            <div className="flex items-center h-8 px-3 border-b border-emerald-400/[0.08] cursor-move select-none shrink-0"
              style={{ background:"linear-gradient(90deg, rgba(52,211,153,0.07) 0%, transparent 60%)" }}
              onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd}>
              <span className="text-[10px] text-emerald-400/90 font-black tracking-[0.18em] uppercase">iMYNTED · TAPE</span>
              <div className="ml-auto">
                <button type="button" onClick={() => setDetached(false)} className="text-white/30 hover:text-white text-[14px] transition-colors leading-none">✕</button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">{fullPanel}</div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default TapePanel;
