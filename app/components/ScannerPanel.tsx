"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type RawRow = Record<string, any>;
type Tab = "gainers" | "losers" | "unusual" | "news" | "halts";

type Row = {
  symbol: string;

  // normal scanner fields
  price: number;
  change: number;
  changePct: number;
  volume: number;
  volumeLabel?: string;
  tag?: string;

  // halts-only fields
  haltStatus?: string;
  haltReason?: string;
  haltTime?: string; // display
  haltMs?: number; // sort
};

type ApiResponse = {
  provider?: string;
  type?: string;
  rows?: RawRow[];
  ts?: string;
};

type HaltItem = {
  id?: string;
  symbol?: string;
  status?: string;
  reason?: string;
  venue?: string;
  published?: string;
  title?: string;
  url?: string;
  ts?: string;
  asOf?: string;
  time?: string;
};

type HaltsApiAllResp = {
  mode?: "all" | "single" | "bulk";
  provider?: string;
  items?: HaltItem[];
  ts?: string;
  error?: string;
};

type NewsCountsResp = {
  ok?: boolean;
  provider?: string;
  asset?: "stock" | "crypto";
  symbols?: string[];
  counts?: Record<string, number>;
  ts?: string;
  error?: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/** Robust numeric parser */
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

function normSym(s: any) {
  return String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "")
    .trim();
}

function safeTimeStr(it: HaltItem) {
  return it.published || it.ts || it.asOf || it.time || "";
}

function timeMsFrom(it: HaltItem) {
  const t = safeTimeStr(it);
  const d = new Date(t);
  const ms = d.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function hhmmFromRaw(t?: string) {
  if (!t) return "";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isHaltedStatus(status?: string) {
  const s = (status || "").toLowerCase();
  if (!s) return false;
  if (s.includes("resum")) return false;
  return s.includes("halt") || s.includes("pause");
}

function statusPretty(status?: string) {
  const s = (status || "").trim();
  return s || "Halted";
}

function reasonPretty(it: HaltItem) {
  const r = (it.reason || "").trim();
  if (r) return r;
  const title = (it.title || "").trim();
  if (!title) return "";
  const parts = title.split(" - ");
  if (parts.length >= 2) return parts.slice(1).join(" - ").trim();
  return "";
}

function HaltBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-200">
      HALT <span className="text-rose-100">{count}</span>
    </span>
  );
}

function NewsBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-200">
      NEWS <span className="text-sky-100">{count}</span>
    </span>
  );
}

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

  // halts feed + counts
  const [haltItems, setHaltItems] = useState<HaltItem[]>([]);
  const [haltCounts, setHaltCounts] = useState<Record<string, number>>({});
  const [haltTotal, setHaltTotal] = useState<number>(0);

  // news counts for visible symbols
  const [newsCounts, setNewsCounts] = useState<Record<string, number>>({});
  const [newsTotal, setNewsTotal] = useState<number>(0);

  const listRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLInputElement | null>(null);
  const [sel, setSel] = useState(0);

  // ✅ Poll halts feed always (30s)
  useEffect(() => {
    let alive = true;
    let t: any;

    async function pollHalts() {
      try {
        const res = await fetch(`/api/market/halts?mode=all`, { cache: "no-store" });
        const j = (await res.json()) as HaltsApiAllResp;
        if (!alive) return;

        const items = Array.isArray(j.items) ? j.items : [];
        setHaltItems(items);

        const counts: Record<string, number> = {};
        for (const it of items) {
          const s = normSym(it.symbol);
          if (!s) continue;
          if (!isHaltedStatus(it.status)) continue;
          counts[s] = (counts[s] || 0) + 1;
        }
        setHaltCounts(counts);
        setHaltTotal(Object.values(counts).reduce((a, b) => a + b, 0));
      } catch {
        // keep last-known
      } finally {
        if (!alive) return;
        t = setTimeout(pollHalts, 30_000);
      }
    }

    pollHalts();
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, []);

  // ✅ Poll scanner endpoint only when tab != halts
  useEffect(() => {
    if (tab === "halts") return;

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

  // ✅ Effective rows: scanner rows OR derived halts rows
  const effectiveRows: Row[] = useMemo(() => {
    if (tab !== "halts") return rows;

    const bySym = new Map<string, { sym: string; count: number; latestMs: number; item: HaltItem }>();

    for (const it of haltItems) {
      const s = normSym(it.symbol);
      if (!s) continue;
      if (!isHaltedStatus(it.status)) continue;

      const ms = timeMsFrom(it);
      const cur = bySym.get(s);
      if (!cur) {
        bySym.set(s, { sym: s, count: 1, latestMs: ms, item: it });
      } else {
        cur.count += 1;
        if (ms >= cur.latestMs) {
          cur.latestMs = ms;
          cur.item = it;
        }
      }
    }

    const out: Row[] = [];
    for (const v of bySym.values()) {
      const it = v.item;
      out.push({
        symbol: v.sym,
        price: NaN,
        change: NaN,
        changePct: NaN,
        volume: NaN,
        tag: "",

        haltStatus: statusPretty(it.status),
        haltReason: reasonPretty(it) || "—",
        haltTime: hhmmFromRaw(safeTimeStr(it)) || "—",
        haltMs: v.latestMs || 0,
      });
    }

    out.sort(
      (a, b) =>
        (b.haltMs || 0) - (a.haltMs || 0) || a.symbol.localeCompare(b.symbol)
    );

    return out;
  }, [tab, rows, haltItems]);

  // Filter
  const filtered = useMemo(() => {
    const qq = q.trim().toUpperCase();
    return effectiveRows.filter((r) => (qq ? r.symbol.includes(qq) : true));
  }, [effectiveRows, q]);

  // ✅ Poll NEWS counts for the currently visible symbols (12s)
  const visibleSymbolsKey = useMemo(() => {
    const syms = Array.from(new Set(filtered.map((r) => r.symbol))).slice(0, 30);
    return syms.join(",");
  }, [filtered]);

  useEffect(() => {
    let alive = true;
    let timer: any;

    async function loadNewsCounts() {
      try {
        const syms = visibleSymbolsKey ? visibleSymbolsKey.split(",").filter(Boolean) : [];
        if (!syms.length) {
          setNewsCounts({});
          setNewsTotal(0);
          return;
        }

        const url = new URL(`/api/market/news-counts`, window.location.origin);
        url.searchParams.set("asset", "stock");
        url.searchParams.set("symbols", syms.join(","));

        const res = await fetch(url.toString(), { cache: "no-store" });
        const j = (await res.json()) as NewsCountsResp;

        if (!alive) return;

        const counts = j?.counts || {};
        const next: Record<string, number> = {};
        for (const s of syms) {
          const v = Number(counts?.[s] ?? 0);
          next[s] = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
        }

        setNewsCounts(next);
        setNewsTotal(Object.values(next).reduce((a, b) => a + b, 0));
      } catch {
        // keep last-known (no crash)
      }
    }

    loadNewsCounts();
    timer = window.setInterval(loadNewsCounts, 12_000);

    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
  }, [visibleSymbolsKey]);

  // Selection validity
  useEffect(() => {
    if (filtered.length === 0) setSel(0);
    else setSel((s) => Math.max(0, Math.min(s, filtered.length - 1)));
  }, [filtered.length]);

  // Auto-select focused symbol
  useEffect(() => {
    if (!focusSymbol) return;
    const idx = filtered.findIndex((r) => r.symbol === focusSymbol);
    if (idx >= 0) setSel(idx);
  }, [focusSymbol, filtered]);

  // Keep selected visible
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

      if (!isTyping && e.key === ".") {
        e.preventDefault();
        filterRef.current?.focus();
        return;
      }

      if (isTyping && t !== filterRef.current) return;

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

  const showScannerControls = tab !== "halts";
  const haltsMode = tab === "halts";

  return (
    <div className={cn("h-full min-h-0 w-full flex flex-col", className)}>
      {/* Controls */}
      <div className="shrink-0 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
            {TABS.map((t) => {
              const isHaltsTab = t.key === "halts";
              const isNewsTab = t.key === "news";

              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] transition inline-flex items-center gap-2",
                    tab === t.key ? "bg-white/80 text-black" : "text-white/75 hover:bg-white/10"
                  )}
                >
                  <span>{t.label}</span>

                  {isHaltsTab && haltTotal > 0 ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                        tab === t.key
                          ? "bg-black/20 text-black"
                          : "bg-rose-500/10 text-rose-200 border border-rose-500/20"
                      )}
                    >
                      {haltTotal}
                    </span>
                  ) : null}

                  {isNewsTab && newsTotal > 0 ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                        tab === t.key
                          ? "bg-black/20 text-black"
                          : "bg-sky-500/10 text-sky-200 border border-sky-500/20"
                      )}
                    >
                      {newsTotal}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <input
            ref={filterRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter… (AAPL)"
            spellCheck={false}
            className="w-[160px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/85 outline-none placeholder:text-white/30"
          />

          {showScannerControls ? (
            <>
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
            </>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
              Halts feed • updates ~30s
            </div>
          )}

          <div className="ml-auto text-[11px] text-white/35">
            Focus <span className="text-white/70">{focusSymbol || "-"}</span> • Rows{" "}
            <span className="text-white/70">{filtered.length}</span>
            {status ? <span className="ml-2 text-red-300">({status})</span> : null}
          </div>
        </div>
      </div>

      {/* Header */}
      {haltsMode ? (
        <div className="shrink-0 grid grid-cols-12 gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] font-semibold text-white/55">
          <div className="col-span-2">SYM</div>
          <div className="col-span-3">STATUS</div>
          <div className="col-span-5">REASON</div>
          <div className="col-span-2 text-right">TIME</div>
        </div>
      ) : (
        <div className="shrink-0 grid grid-cols-12 gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] font-semibold text-white/55">
          <div className="col-span-2">SYM</div>
          <div className="col-span-2 text-right">PX</div>
          <div className="col-span-2 text-right">CHG</div>
          <div className="col-span-2 text-right">CHG%</div>
          <div className="col-span-2 text-right">VOL</div>
          <div className="col-span-2 text-right">TAG</div>
        </div>
      )}

      {/* Body */}
      <div
        ref={listRef}
        className="mt-2 flex-1 min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20"
      >
        {filtered.length === 0 ? (
          <div className="p-4 text-[12px] text-white/45">
            {haltsMode ? "No active halts right now." : "No rows."}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((r, idx) => {
              const selected = idx === sel;
              const up = (r.changePct ?? 0) >= 0;

              const haltCount = haltCounts[r.symbol] || 0;
              const newsCount = newsCounts[r.symbol] || 0;

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
                  <div
                    className={cn(
                      "absolute left-0 top-0 h-full w-[3px]",
                      selected ? "bg-emerald-400/70" : "bg-transparent"
                    )}
                  />

                  {/* SYM */}
                  <div
                    className={cn(
                      "col-span-2 font-semibold flex items-center",
                      selected ? "text-white" : "text-white/85",
                      focusSymbol && r.symbol === focusSymbol && "text-emerald-200"
                    )}
                  >
                    <span>{r.symbol}</span>
                    <NewsBadge count={newsCount} />
                    <HaltBadge count={haltCount} />
                  </div>

                  {haltsMode ? (
                    <>
                      <div className="col-span-3 text-white/80">{r.haltStatus || "—"}</div>
                      <div className="col-span-5 text-white/70 truncate">{r.haltReason || "—"}</div>
                      <div className="col-span-2 text-right text-white/60 tabular-nums">{r.haltTime || "—"}</div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 pt-2 text-[10px] text-white/35">
        Hotkeys: <span className="text-white/60">↑/↓</span> select •{" "}
        <span className="text-white/60">Enter</span> pick •{" "}
        <span className="text-white/60">.</span> filter •{" "}
        <span className="text-white/60">Esc</span> clear
      </div>
    </div>
  );
}
