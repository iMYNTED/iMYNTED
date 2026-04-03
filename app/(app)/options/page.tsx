"use client";

import React, { useEffect, useRef, useState } from "react";
import StockDetailPanel from "@/app/components/StockDetailPanel";

export default function OptionsPage() {
  const [symbol, setSymbol] = useState("SPY");
  const [panelOpen, setPanelOpen] = useState(true);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ symbol: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<any>(null);

  // Debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const term = q.trim();
    if (!term) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(term)}`);
        const j = await res.json();
        if (j?.ok && Array.isArray(j.results)) { setResults(j.results); setOpen(j.results.length > 0); }
      } catch { setResults([]); }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [q]);

  function pick(sym: string) {
    setSymbol(sym.toUpperCase());
    setPanelOpen(true);
    setQ("");
    setOpen(false);
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)" }}>

      {/* Symbol search header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-emerald-400/[0.08]"
        style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.06) 0%, rgba(4,10,18,0.96) 40%)" }}>
        <span className="text-[10px] font-black tracking-[0.15em] text-emerald-400/80 uppercase">iMYNTED</span>
        <span className="text-[12px] font-bold text-white/70">Options Trader</span>

        <div className="relative ml-4 w-[260px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim()) pick(q.trim());
              if (e.key === "Escape") { setQ(""); setOpen(false); }
            }}
            placeholder={`Search symbol... (current: ${symbol})`}
            spellCheck={false}
            autoComplete="off"
            className="w-full h-8 rounded-sm border border-white/10 bg-white/[0.04] px-3 text-[11px] text-white/80 placeholder:text-white/30 outline-none focus:border-emerald-400/30 transition-colors"
          />
          {open && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-0.5 z-50 rounded-sm border border-white/15 bg-[rgba(4,10,18,0.98)] shadow-xl max-h-[250px] overflow-auto">
              {results.map((r, i) => (
                <button key={`${r.symbol}-${i}`} type="button"
                  className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-white/[0.06] transition-colors text-left"
                  onMouseDown={(e) => { e.preventDefault(); pick(r.symbol); }}>
                  <span className="text-[11px] font-bold text-emerald-300 w-[50px] shrink-0">{r.symbol}</span>
                  <span className="text-[10px] text-white/50 truncate flex-1">{r.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick symbol pills */}
        <div className="flex items-center gap-1 ml-2">
          {["SPY","TSLA","AAPL","NVDA","QQQ","META","AMZN","MSFT"].map(s => (
            <button key={s} onClick={() => pick(s)}
              className={`rounded-sm border px-2 py-0.5 text-[9px] font-bold uppercase transition-colors ${
                symbol === s
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                  : "border-white/8 bg-black/20 text-white/35 hover:text-white/60"
              }`}>{s}</button>
          ))}
        </div>
      </div>

      {/* StockDetailPanel — renders as portal overlay */}
      {panelOpen && (
        <StockDetailPanel
          symbol={symbol}
          asset="stock"
          onClose={() => setPanelOpen(false)}
          defaultTab="options"
        />
      )}
    </div>
  );
}
