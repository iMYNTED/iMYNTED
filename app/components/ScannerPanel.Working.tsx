"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type RawRow = Record<string, any>;

type Row = {
  symbol: string;
  price: number;
  change: number;
  changePct: number; // may be NaN if API doesn't provide it
  volume: number;
  volumeLabel?: string;
  tag?: string;
};

type ApiResponse = {
  provider?: string;
  type?: string;
  rows?: RawRow[];
  ts?: string;
};

type Tab = "gainers" | "losers" | "unusual" | "news" | "halts";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/** Robust numeric parser:
 * supports: 123, "123", "1,234.56", "+3.10", "4.63%", null/undefined
 */
function n(v: any): number {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;

  if (typeof v === "string") {
    const s = v.trim().replace(/,/g, "").replace(/%/g, "");
    const x = Number(s);
    return Number.isFinite(x) ? x : NaN;
  }

  const x = Number(v);
  return Number.isFinite(x) ? x : NaN;
}

function fmtPx(x: number) {
  if (!Number.isFinite(x)) return "-";
  return x >= 1 ? x.toFixed(2) : x.toFixed(4);
}

function fmtSigned(x: number) {
  if (!Number.isFinite(x)) return "-";
  const s = x >= 0 ? "+" : "";
  return s + (Math.abs(x) >= 1 ? x.toFixed(2) : x.toFixed(4));
}

function fmtPct(x: number) {
  if (!Number.isFinite(x)) return "-";
  const s = x >= 0 ? "+" : "";
  return `${s}${x.toFixed(2)}%`;
}

function volLabel(v: number, fallback?: string) {
  if (fallback) return fallback;
  if (!Number.isFinite(v)) return "-";
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + "B";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(2) + "K";
  return String(Math.round(v));
}

/** Always compute pct if missing:
 * pct = chg / (px - chg) * 100
 */
function computePct(price: number, change: number, provided: number) {
  if (Number.isFinite(provided)) return provided;
  if (!Number.isFinite(price) || !Number.isFinite(change)) return NaN;
  const prev = price - change;
  if (!Number.isFinite(prev) || prev === 0) return NaN;
  return (change / prev) * 100;
}

function normalize(r: RawRow): Row {
  const symbol = String(r.symbol ?? r.ticker ?? r.sym ?? "")
    .toUpperCase()
    .trim();

  const price = n(r.price ?? r.px ?? r.last ?? r.lastPrice ?? r.ltp);
  const change = n(r.change ?? r.chg ?? r.delta ?? r.net ?? r.netChange);
  const providedPct = n(r.changePct ?? r.chgPct ?? r.pct ?? r.percent ?? r.netPct);
  const changePct = computePct(price, change, providedPct);

  const volume = n(r.volume ?? r.vol ?? r.v ?? r.totalVolume);
  const volumeLabel = (r.volumeLabel ?? r.volLabel ?? r.volume_label) as string | undefined;
  const tag = (r.tag ?? r.type ?? r.label) as string | undefined;

  return { symbol, price, change, changePct, volume, volumeLabel, tag };
}

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "gainers", label: "GAINERS" },
  { key: "losers", label: "LOSERS" },
  { key: "unusual", label: "UNUSUAL" },
  { key: "news", label: "NEWS" },
  { key: "halts", label: "HALTS" },
];

export default function ScannerPanel({
  symbol,
  onPickSymbol,
  className,
}: {
  symbol?: string;
  onPickSymbol?: (s: string) => void;
  className?: string;
}) {
  const focusSymbol = useMemo(() => (symbol || "").toUpperCase().trim(), [symbol]);

  const [tab, setTab] = useState<Tab>("gainers");
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [paused, setPaused] = useState(false);
  const [pollMs, setPollMs] = useState(1500);
  const [compact, setCompact] = useState(true);
  const [status, setStatus] = useState<string>("");

  const listRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLInputElement | null>(null);
  const [sel, setSel] = useState(0);

  // Poll endpoint
  useEffect(() => {
    let alive = true;
    let t: any;

    async function poll() {
      try {
        setStatus("");
        const res = await fetch(`/api/market/scanner?type=${encodeURIComponent(tab)}`, {
          cache: "no-store",
        });
        if (!alive) return;

        if (!res.ok) {
          setRows([]);
          setStatus(`HTTP ${res.status}`);
          return;
        }

        const json = (await res.json()) as ApiResponse;
        const raw = Array.isArray(json?.rows) ? json.rows : [];
        const next = raw.map(normalize).filter((r) => r.symbol);

        setRows(next);
      } catch {
        if (!alive) return;
        setRows([]);
        setStatus("Fetch error");
      } finally {
        if (!alive) return;
        t = setTimeout(poll, pollMs);
      }
    }

    if (!paused) poll();
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [paused, pollMs, tab]);

  // Filter rows
  const filtered = useMemo(() => {
    const qq = q.trim().toUpperCase();
    return rows.filter((r) => (qq ? r.symbol.includes(qq) : true));
  }, [rows, q]);

  // Keep selection valid
  useEffect(() => {
    if (filtered.length === 0) setSel(0);
    else setSel((s) => Math.max(0, Math.min(s, filtered.length - 1)));
  }, [filtered.length]);

  // Auto-select focused symbol if present
  useEffect(() => {
    if (!focusSymbol) return;
    const idx = filtered.findIndex((r) => r.symbol === focusSymbol);
    if (idx >= 0) setSel(idx);
  }, [focusSymbol, filtered]);

  // Keep selected row visible
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const row = el.querySelector<HTMLElement>(`[data-row="${sel}"]`);
    if (row) row.scrollIntoView({ block: "nearest" });
  }, [sel]);

  // Hotkeys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const isTyping =
        t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || (t as any)?.isContentEditable;

      // "." focuses filter
      if (!isTyping && e.key === ".") {
        e.preventDefault();
        filterRef.current?.focus();
        return;
      }

      // don't steal keystrokes from other inputs
      if (isTyping && t !== filterRef.current) return;

      // Esc clears filter
      if (e.key === "Escape") {
        if (document.activeElement === filterRef.current || q) {
          e.preventDefault();
          setQ("");
          filterRef.current?.blur();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((s) => Math.min(s + 1, Math.max(0, filtered.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => Math.max(s - 1, 0));
        return;
      }

      if (e.key === "Enter") {
        if (filtered.length > 0) {
          e.preventDefault();
          const pick = filtered[Math.max(0, Math.min(sel, filtered.length - 1))];
          if (pick?.symbol) onPickSymbol?.(pick.symbol);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, onPickSymbol, q, sel]);

  return (
    <div className={cn("h-full min-h-0 w-full", className)}>
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] transition",
                tab === t.key ? "bg-white/80 text-black" : "text-white/75 hover:bg-white/10"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          ref={filterRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter… (AAPL)"
          spellCheck={false}
          className="w-[160px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/85 outline-none placeholder:text-white/30"
        />

        <button
          onClick={() => setPaused((p) => !p)}
          className={cn(
            "rounded-xl border border-white/10 px-3 py-2 text-[12px]",
            paused ? "bg-white/10 text-white/80" : "bg-black/30 text-white/80 hover:bg-white/10"
          )}
        >
          {paused ? "Paused" : "Live"}
        </button>

        <button
          onClick={() => setCompact((c) => !c)}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80 hover:bg-white/10"
        >
          {compact ? "Compact" : "Comfort"}
        </button>

        <select
          value={pollMs}
          onChange={(e) => setPollMs(Number(e.target.value))}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80"
        >
          <option value={1000}>1s</option>
          <option value={1500}>1.5s</option>
          <option value={2000}>2s</option>
          <option value={3000}>3s</option>
        </select>

        <div className="ml-auto text-[11px] text-white/35">
          Focus <span className="text-white/70">{focusSymbol || "-"}</span> • Rows{" "}
          <span className="text-white/70">{filtered.length}</span>
          {status ? <span className="ml-2 text-red-300">({status})</span> : null}
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-12 gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] font-semibold text-white/55">
        <div className="col-span-2">SYM</div>
        <div className="col-span-2 text-right">PX</div>
        <div className="col-span-2 text-right">CHG</div>
        <div className="col-span-2 text-right">CHG%</div>
        <div className="col-span-2 text-right">VOL</div>
        <div className="col-span-2 text-right">TAG</div>
      </div>

      {/* Body */}
      <div
        ref={listRef}
        className="mt-2 h-full min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20"
      >
        {filtered.length === 0 ? (
          <div className="p-4 text-[12px] text-white/45">No rows.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((r, idx) => {
              const selected = idx === sel;
              const up = (r.changePct ?? 0) >= 0;

              return (
                <button
                  key={`${r.symbol}-${idx}`}
                  data-row={idx}
                  onClick={() => {
                    setSel(idx);
                    onPickSymbol?.(r.symbol);
                  }}
                  className={cn(
                    "relative w-full text-left grid grid-cols-12 gap-2 px-3",
                    compact ? "py-1.5" : "py-2.5",
                    selected ? "bg-white/10" : "hover:bg-white/5"
                  )}
                  title="Click to set symbol • ↑/↓ select • Enter pick • '.' focus filter • Esc clear"
                >
                  {/* Active bar */}
                  <div
                    className={cn(
                      "absolute left-0 top-0 h-full w-[3px]",
                      selected ? "bg-emerald-400/70" : "bg-transparent"
                    )}
                  />

                  <div
                    className={cn(
                      "col-span-2 font-semibold",
                      selected ? "text-white" : "text-white/85",
                      focusSymbol && r.symbol === focusSymbol && "text-emerald-200"
                    )}
                  >
                    {r.symbol}
                  </div>

                  <div className={cn("col-span-2 text-right tabular-nums", selected ? "text-white/90" : "text-white/75")}>
                    {fmtPx(r.price)}
                  </div>

                  <div
                    className={cn(
                      "col-span-2 text-right tabular-nums font-semibold",
                      up ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {fmtSigned(r.change)}
                  </div>

                  <div
                    className={cn(
                      "col-span-2 text-right tabular-nums font-semibold",
                      up ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {fmtPct(r.changePct)}
                  </div>

                  <div className={cn("col-span-2 text-right tabular-nums", selected ? "text-white/80" : "text-white/70")}>
                    {volLabel(r.volume, r.volumeLabel)}
                  </div>

                  <div className={cn("col-span-2 text-right text-[11px]", selected ? "text-white/60" : "text-white/45")}>
                    {r.tag || "-"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-2 text-[10px] text-white/35">
        Hotkeys: <span className="text-white/60">↑/↓</span> select •{" "}
        <span className="text-white/60">Enter</span> pick •{" "}
        <span className="text-white/60">.</span> filter •{" "}
        <span className="text-white/60">Esc</span> clear
      </div>
    </div>
  );
}
