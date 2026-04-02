"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSettings } from "./SettingsContext";

type Row = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  chgPct24h: number;
  vol24h: number;
  mcap: number;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtCompact(n: number) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "0";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
  return String(Math.round(v));
}

function fmtPrice(n: number) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "0";
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

export default function CryptoMoversPanel({
  onPickSymbol,
  refreshMs = 60_000,
}: {
  onPickSymbol?: (sym: string) => void;
  refreshMs?: number;
}) {
  useSettings(); // keep provider mounted
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [mode, setMode] = useState<"movers" | "gainers" | "losers">("movers");
  const [q, setQ] = useState("");
  const [detached, setDetached] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 80, y: 40 });
  const dragStartRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  function onDragStart(e: React.PointerEvent) {
    dragStartRef.current = { mx: e.clientX, my: e.clientY, ox: dragPos.x, oy: dragPos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragStartRef.current) return;
    setDragPos({ x: dragStartRef.current.ox + (e.clientX - dragStartRef.current.mx), y: dragStartRef.current.oy + (e.clientY - dragStartRef.current.my) });
  }
  function onDragEnd() { dragStartRef.current = null; }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/crypto/movers", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `Movers API ${res.status}`);
      setRows(Array.isArray(j?.data) ? j.data : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load crypto movers");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    load();
    const t = setInterval(() => {
      if (!alive) return;
      load();
    }, refreshMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMs]);

  const filtered = useMemo(() => {
    let copy = [...rows];
    if (mode === "gainers") copy = copy.sort((a, b) => b.chgPct24h - a.chgPct24h);
    else if (mode === "losers") copy = copy.sort((a, b) => a.chgPct24h - b.chgPct24h);
    if (q) {
      const term = q.toUpperCase();
      copy = copy.filter(r => r.symbol.includes(term) || r.name.toUpperCase().includes(term));
    }
    return copy.slice(0, 25);
  }, [rows, mode, q]);

  /* ── iMYNTED pill helper ── */
  function modePill(key: typeof mode, label: string, activeColor: string) {
    const active = mode === key;
    return (
      <button
        onClick={() => setMode(key)}
        className={cn(
          "rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
          active ? activeColor : "border-white/8 bg-black/20 text-white/40 hover:bg-white/5 hover:text-white/60"
        )}
      >
        {label}
      </button>
    );
  }

  const moversBody = (
    <div className="h-full min-h-0 flex flex-col">
      {/* ── Header: iMYNTED branded ── */}
      <div className="shrink-0 px-2.5 py-1.5 border-b border-white/[0.06] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {modePill("movers", "Movers", "border-cyan-400/30 bg-cyan-400/10 text-cyan-300")}
          {modePill("gainers", "Gainers", "border-emerald-400/30 bg-emerald-400/10 text-emerald-300")}
          {modePill("losers", "Losers", "border-red-400/30 bg-red-400/10 text-red-300")}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-sm border border-white/8 px-1.5 py-0.5 text-[10px] text-white/30 hover:text-white/60 transition-colors"
            title="Refresh"
          >
            {loading ? "..." : "\u21BB"}
          </button>
          <button
            type="button"
            onClick={() => setDetached(!detached)}
            className="text-white/25 hover:text-cyan-400 text-[13px] transition-colors"
            title={detached ? "Reattach movers" : "Detach to window"}
          >
            {"\u29C9"}
          </button>
        </div>
      </div>

      {/* ── Symbol search / switch ── */}
      <div className="shrink-0 px-2.5 py-1 border-b border-white/[0.04]">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) {
              const sym = q.trim().toUpperCase();
              onPickSymbol?.(sym);
              try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: sym, asset: "crypto" } })); } catch {}
              setQ("");
            }
          }}
          placeholder="Type symbol + Enter to switch (e.g. BTC)"
          className="w-full rounded-sm border border-white/8 bg-white/[0.03] px-2 py-1 text-[11px] text-white/80 placeholder:text-white/25 outline-none focus:border-cyan-400/30 focus:bg-white/[0.05] transition-colors"
        />
      </div>

      {err ? (
        <div className="mx-2 mt-1 rounded-sm border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11px] text-red-200">
          {err}
        </div>
      ) : null}

      {/* ── Column headers ── */}
      <div className="shrink-0 grid px-2.5 py-1 border-b border-white/[0.04]"
        style={{ gridTemplateColumns: "minmax(60px, 1fr) minmax(70px, 1fr) minmax(60px, 1fr) minmax(60px, 1fr)" }}>
        {["SYMBOL", "PRICE", "24H%", "VOL"].map((h, i) => (
          <span key={h} className={cn(
            "text-[8px] font-black uppercase tracking-widest text-white/22",
            i >= 1 && "text-right"
          )}>{h}</span>
        ))}
      </div>

      {/* ── Rows ── */}
      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.map((r, idx) => {
          const up = r.chgPct24h >= 0;
          return (
            <button
              key={r.id}
              onClick={() => { onPickSymbol?.(r.symbol); try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: r.symbol, asset: "crypto" } })); } catch {} }}
              className={cn(
                "w-full text-left transition-colors",
                idx % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]",
                "hover:bg-white/[0.04]"
              )}
              title={r.name}
            >
              <div className="grid items-center px-2.5 py-[3px]"
                style={{ gridTemplateColumns: "minmax(60px, 1fr) minmax(70px, 1fr) minmax(60px, 1fr) minmax(60px, 1fr)" }}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={cn("text-[11px] font-bold tabular-nums truncate", up ? "text-emerald-300" : "text-red-300")}>{r.symbol}</span>
                  <span className="shrink-0 rounded-sm border border-cyan-400/20 bg-cyan-400/[0.08] px-1 py-px text-[7px] font-bold text-cyan-400/70 uppercase tracking-wide">CRYPTO</span>
                </div>
                <div className="text-right text-[11px] tabular-nums text-white/65 font-medium">{fmtPrice(r.price)}</div>
                <div className={cn("text-right text-[11px] tabular-nums font-bold", up ? "text-emerald-400" : "text-red-400")}>
                  {up ? "+" : ""}{r.chgPct24h.toFixed(2)}%
                </div>
                <div className="text-right text-[11px] tabular-nums text-white/40">{fmtCompact(r.vol24h)}</div>
              </div>
            </button>
          );
        })}

        {!filtered.length && !loading ? (
          <div className="px-3 py-6 text-[11px] text-white/25">No movers yet.</div>
        ) : null}
      </div>

      {/* ── Footer ── */}
      <div className="shrink-0 px-2.5 py-1 text-[9px] text-white/20 border-t border-white/[0.06]">
        Click a row to set symbol &bull; Refresh {Math.round(refreshMs / 1000)}s
      </div>
    </div>
  );

  return (
    <>
      {!detached ? (
        <div className="h-full min-h-0 flex flex-col overflow-hidden">
          {moversBody}
        </div>
      ) : (
        <div className="h-full min-h-0 flex flex-col items-center justify-center py-8 gap-3">
          <div className="text-white/20 text-[22px]">{"\u29C9"}</div>
          <span className="text-white/25 text-[11px] uppercase tracking-wider font-medium">Movers Detached</span>
          <button type="button" onClick={() => setDetached(false)} className="text-cyan-400/70 hover:text-cyan-400 text-[11px] transition-colors">Reattach</button>
        </div>
      )}

      {detached && createPortal(
        <div className="fixed inset-0 z-[9996]" style={{ pointerEvents: "none" }}>
          <div
            className="absolute bg-[rgba(4,10,18,0.98)] border border-white/15 rounded-sm overflow-hidden flex flex-col"
            style={{ left: dragPos.x, top: dragPos.y, width: "calc(100vw - 80px)", height: "calc(100vh - 60px)", pointerEvents: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.7)" }}
          >
            <div
              className="flex items-center h-7 px-3 border-b border-emerald-400/[0.12] cursor-move select-none shrink-0"
              style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.08) 0%, rgba(4,10,18,0.95) 40%)" }}
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
            >
              <span className="text-[10px] text-emerald-400/80 font-black tracking-[0.15em] uppercase">iMYNTED</span>
              <span className="ml-2 text-[10px] text-white/50 font-semibold">CRYPTO MOVERS</span>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={() => setDetached(false)} className="text-white/30 hover:text-white text-[14px] transition-colors leading-none">{"\u2715"}</button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {moversBody}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
