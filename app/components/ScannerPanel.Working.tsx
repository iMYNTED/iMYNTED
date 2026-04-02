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

  // universe-engine scoring (optional)
  totalScore?: number;

  // halts-only fields
  haltStatus?: string;
  haltReason?: string;
  haltTime?: string; // display
  haltMs?: number; // sort
};

type ApiResponse = {
  ok?: boolean;
  provider?: string;
  type?: string;
  rows?: any; // can be array OR wrapper
  data?: any; // can be array OR wrapper
  ts?: string;
  error?: string;
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

/* Symbol normalization: strip junk trailing digits; preserve BRK.B / BTC-USD */
function cleanSymbol(raw: any) {
  let s = String(raw ?? "").toUpperCase().trim().replace(/\s+/g, "");
  if (!s) return "";

  if (s.includes("-USD")) return s.replace(/[^A-Z0-9.\-]/g, "");
  s = s.replace(/[^A-Z0-9.\-]/g, "");
  s = s.replace(/-USD$/i, "");
  s = s.replace(/[0-9]+$/, "");
  return s;
}

/**
 * Robust rows unwrapping so UI never shows “No rows”
 * if the API returns {data:[...]}, {data:{rows:[...]}}, or wraps rows.
 */
function unwrapRowsLike(json: any): RawRow[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.rows)) return json.rows;
  if (Array.isArray(json.data)) return json.data;

  if (json.data && typeof json.data === "object") {
    const d = json.data;
    if (Array.isArray(d.rows)) return d.rows;
    if (Array.isArray(d.data)) return d.data;
  }

  if (json.rows && typeof json.rows === "object") {
    const r = json.rows;
    if (Array.isArray(r.rows)) return r.rows;
    if (Array.isArray(r.data)) return r.data;
  }

  return [];
}

function defaultTagForTab(tab: Tab) {
  if (tab === "halts") return "halts";
  return tab;
}

function normalize(r: RawRow, tab: Tab): Row {
  const symbol = cleanSymbol(r.symbol ?? r.ticker ?? r.sym ?? "");

  const price = n(r.price ?? r.px ?? r.last ?? r.lastPrice ?? r.ltp);
  const change = n(r.change ?? r.chg ?? r.delta ?? r.net ?? r.netChange);
  const providedPct = n(r.changePct ?? r.chgPct ?? r.pct ?? r.percent ?? r.netPct);
  const changePct = computePct(price, change, providedPct);

  const volume = n(r.volume ?? r.vol ?? r.v ?? r.totalVolume);
  const volumeLabel = (r.volumeLabel ?? r.volLabel ?? r.volume_label) as string | undefined;

  const rawTag = (r.tag ?? r.type ?? r.label) as string | undefined;
  const tag = (rawTag && String(rawTag).trim()) || defaultTagForTab(tab);

  const totalScore = n(r.totalScore ?? r.score ?? r.rankScore ?? r.total_score);

  return {
    symbol,
    price,
    change,
    changePct,
    volume,
    volumeLabel,
    tag,
    totalScore: Number.isFinite(totalScore) ? totalScore : undefined,
  };
}

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "gainers", label: "GAINERS" },
  { key: "losers", label: "LOSERS" },
  { key: "unusual", label: "UNUSUAL" },
  { key: "news", label: "NEWS" },
  { key: "halts", label: "HALTS" },
];

function normSym(s: any) {
  return cleanSymbol(s);
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

function MiniBadge({ count, tone }: { count: number; tone: "rose" | "sky" }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-md border px-1 text-[10px] font-semibold leading-none",
        tone === "rose"
          ? "border-rose-500/25 bg-rose-500/10 text-rose-200"
          : "border-sky-500/25 bg-sky-500/10 text-sky-200"
      )}
    >
      {count}
    </span>
  );
}

/** Scanner -> Trader event bus */
function fireTradeAction(action: "BUY" | "SELL", symbol: string) {
  try {
    window.dispatchEvent(
      new CustomEvent("imynted:tradeAction", {
        detail: { action, asset: "stock", symbol },
      })
    );
  } catch {}
}

function fmtScoreInline(x?: number) {
  if (!Number.isFinite(x as any)) return "-";
  return String(Math.round(x as number));
}

/** One-letter tag glyph (no pill in compact) */
function tagToGlyph(tagRaw?: string) {
  const t = String(tagRaw || "").toLowerCase().trim();
  if (t.includes("gain")) return "G";
  if (t.includes("lose")) return "L";
  if (t.includes("unusual")) return "U";
  if (t.includes("news")) return "N";
  if (t.includes("halt")) return "H";
  return "·";
}

type SortMode = "auto" | "score" | "move";
type SortModeByTab = Partial<Record<Tab, SortMode>>;

export default function ScannerPanel({
  symbol,
  onPickSymbol,
  className,
}: {
  symbol?: string;
  onPickSymbol?: (s: string) => void;
  className?: string;
}) {
  const focusSymbol = useMemo(() => cleanSymbol(symbol || ""), [symbol]);
  const [tab, setTab] = useState<Tab>("gainers");

  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [paused, setPaused] = useState(false);
  const [pollMs, setPollMs] = useState(1500);
  const [compact, setCompact] = useState(true);
  const [status, setStatus] = useState<string>("");

  const [sortModeByTab, setSortModeByTab] = useState<SortModeByTab>({
    gainers: "auto",
    losers: "auto",
    unusual: "auto",
    news: "auto",
    halts: "auto",
  });

  const sortMode: SortMode = sortModeByTab[tab] ?? "auto";
  const setSortModeForTab = (t: Tab, mode: SortMode) => setSortModeByTab((m) => ({ ...m, [t]: mode }));

  const [haltItems, setHaltItems] = useState<HaltItem[]>([]);
  const [haltCounts, setHaltCounts] = useState<Record<string, number>>({});
  const [haltTotal, setHaltTotal] = useState<number>(0);

  const [newsCounts, setNewsCounts] = useState<Record<string, number>>({});
  const [newsTotal, setNewsTotal] = useState<number>(0);

  const listRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLInputElement | null>(null);
  const [sel, setSel] = useState(0);

  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Poll halts feed (30s)
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

  // Poll scanner (unless halts)
  useEffect(() => {
    if (tab === "halts") return;

    let alive = true;
    let t: any;

    async function poll() {
      try {
        setStatus("");
        const res = await fetch(`/api/scanner?type=${encodeURIComponent(tab)}`, { cache: "no-store" });
        if (!alive) return;

        if (!res.ok) {
          setRows([]);
          setStatus(`HTTP ${res.status}`);
          return;
        }

        const json = (await res.json()) as ApiResponse;

        if (json?.ok === false) {
          setRows([]);
          setStatus(json?.error || "Scanner error");
          return;
        }

        const raw = unwrapRowsLike(json);
        const next = raw.map((rr) => normalize(rr, tab)).filter((r) => r.symbol);

        setRows(next);

        if (!next.length) {
          const keys = Object.keys(json || {}).slice(0, 10).join(",");
          setStatus(`0 rows (keys: ${keys})`);
        }
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

  const showScore = useMemo(() => rows.some((r) => Number.isFinite(r.totalScore as any)), [rows]);

  // Normalize impossible states
  useEffect(() => {
    if (tab === "halts") {
      if (sortMode !== "auto") setSortModeForTab("halts", "auto");
      return;
    }
    if (!showScore && sortMode === "score") setSortModeForTab(tab, "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, showScore]);

  const scoreSortActive = useMemo(() => tab !== "halts" && showScore && (sortMode === "score" || sortMode === "auto"), [
    tab,
    showScore,
    sortMode,
  ]);
  const moveSortActive = useMemo(() => tab !== "halts" && sortMode === "move", [tab, sortMode]);

  const effectiveRows: Row[] = useMemo(() => {
    if (tab === "halts") {
      const bySym = new Map<string, { sym: string; latestMs: number; item: HaltItem }>();

      for (const it of haltItems) {
        const s = normSym(it.symbol);
        if (!s) continue;
        if (!isHaltedStatus(it.status)) continue;

        const ms = timeMsFrom(it);
        const cur = bySym.get(s);
        if (!cur) bySym.set(s, { sym: s, latestMs: ms, item: it });
        else if (ms >= cur.latestMs) bySym.set(s, { sym: s, latestMs: ms, item: it });
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

      out.sort((a, b) => (b.haltMs || 0) - (a.haltMs || 0) || a.symbol.localeCompare(b.symbol));
      return out;
    }

    const out = [...rows];
    const hasScores = out.some((r) => Number.isFinite(r.totalScore as any));
    const wantScoreSort = hasScores && (sortMode === "score" || sortMode === "auto");

    if (wantScoreSort) {
      out.sort(
        (a, b) =>
          (Number.isFinite(b.totalScore as any) ? (b.totalScore as number) : -Infinity) -
            (Number.isFinite(a.totalScore as any) ? (a.totalScore as number) : -Infinity) ||
          (Number.isFinite(b.changePct) ? b.changePct : 0) - (Number.isFinite(a.changePct) ? a.changePct : 0) ||
          a.symbol.localeCompare(b.symbol)
      );
      return out;
    }

    if (tab === "losers") {
      out.sort(
        (a, b) =>
          (Number.isFinite(a.changePct) ? a.changePct : Infinity) - (Number.isFinite(b.changePct) ? b.changePct : Infinity) ||
          a.symbol.localeCompare(b.symbol)
      );
      return out;
    }

    out.sort(
      (a, b) =>
        (Number.isFinite(b.changePct) ? b.changePct : -Infinity) - (Number.isFinite(a.changePct) ? a.changePct : -Infinity) ||
        a.symbol.localeCompare(b.symbol)
    );
    return out;
  }, [tab, rows, haltItems, sortMode]);

  const filtered = useMemo(() => {
    const qq = q.trim().toUpperCase();
    return effectiveRows.filter((r) => (qq ? cleanSymbol(r.symbol).includes(qq) : true));
  }, [effectiveRows, q]);

  const visibleSymbols = useMemo(() => {
    return Array.from(new Set(filtered.map((r) => cleanSymbol(r.symbol)))).filter(Boolean).slice(0, 30);
  }, [filtered]);

  const visibleSymbolsKey = useMemo(() => visibleSymbols.join(","), [visibleSymbols]);

  // Poll NEWS counts (12s)
  useEffect(() => {
    if (!mountedRef.current) return;

    let alive = true;
    let timer: any;

    async function loadNewsCounts() {
      try {
        const syms = visibleSymbols;
        if (!syms.length) {
          setNewsCounts({});
          setNewsTotal(0);
          return;
        }

        const qs = new URLSearchParams();
        qs.set("asset", "stock");
        qs.set("symbols", syms.join(","));

        const res = await fetch(`/api/market/news-counts?${qs.toString()}`, { cache: "no-store" });
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
        // keep last-known
      }
    }

    loadNewsCounts();
    timer = window.setInterval(loadNewsCounts, 12_000);

    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSymbolsKey]);

  useEffect(() => {
    if (filtered.length === 0) setSel(0);
    else setSel((s) => Math.max(0, Math.min(s, filtered.length - 1)));
  }, [filtered.length]);

  useEffect(() => {
    if (!focusSymbol) return;
    const idx = filtered.findIndex((r) => cleanSymbol(r.symbol) === focusSymbol);
    if (idx >= 0) setSel(idx);
  }, [focusSymbol, filtered]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const row = el.querySelector<HTMLElement>(`[data-row="${sel}"]`);
    if (row) row.scrollIntoView({ block: "nearest" });
  }, [sel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const isTyping = t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || (t as any)?.isContentEditable;

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

      // Quick trade hotkeys (only when not typing)
      if (!isTyping && (e.key === "b" || e.key === "B")) {
        const pick = filtered[Math.max(0, Math.min(sel, filtered.length - 1))];
        const sym = cleanSymbol(pick?.symbol);
        if (sym) {
          e.preventDefault();
          onPickSymbol?.(sym);
          fireTradeAction("BUY", sym);
        }
        return;
      }
      if (!isTyping && (e.key === "s" || e.key === "S")) {
        const pick = filtered[Math.max(0, Math.min(sel, filtered.length - 1))];
        const sym = cleanSymbol(pick?.symbol);
        if (sym) {
          e.preventDefault();
          onPickSymbol?.(sym);
          fireTradeAction("SELL", sym);
        }
        return;
      }

      if (e.key === "Enter") {
        if (filtered.length > 0) {
          e.preventDefault();
          const pick = filtered[Math.max(0, Math.min(sel, filtered.length - 1))];
          const sym = cleanSymbol(pick?.symbol);
          if (sym) onPickSymbol?.(sym);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, onPickSymbol, q, sel]);

  const showScannerControls = tab !== "halts";
  const haltsMode = tab === "halts";

  // Columns: enforce declutter
  // - Compact: SYM | PX | CHG% | VOL | SCORE?
  // - Comfort: SYM | PX | CHG | CHG% | VOL | SCORE? | TAG
  const gridCols = useMemo(() => {
    if (haltsMode) {
      // SYM | STATUS | REASON | TIME
      return "grid-cols-[minmax(0,1.2fr)_minmax(0,1.05fr)_minmax(0,1.7fr)_minmax(0,.7fr)]";
    }

    if (compact) {
      if (showScore) return "grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,.95fr)_48px]";
      return "grid-cols-[minmax(0,1.7fr)_minmax(0,1.05fr)_minmax(0,1.05fr)_minmax(0,1fr)]";
    }

    // Comfort
    if (showScore) {
      return "grid-cols-[minmax(0,1.45fr)_minmax(0,.95fr)_minmax(0,.9fr)_minmax(0,.85fr)_minmax(0,.8fr)_48px_32px]";
    }
    return "grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,.95fr)_minmax(0,.9fr)_minmax(0,.85fr)_32px]";
  }, [haltsMode, compact, showScore]);

  const onToggleScoreSort = () => {
    if (!showScore || tab === "halts") return;
    setSortModeByTab((m) => {
      const cur = (m[tab] ?? "auto") as SortMode;
      const next: SortMode = cur === "move" ? "score" : "move";
      return { ...m, [tab]: next };
    });
  };

  return (
    <div className={cn("h-full min-h-0 w-full flex flex-col", className)}>
      {/* Controls (de-cluttered: primary row + tiny status row) */}
      <div className="shrink-0 pb-2">
        <div className="flex items-center gap-2">
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
                  type="button"
                >
                  <span>{t.label}</span>
                  {isHaltsTab && haltTotal > 0 ? (
                    <span
                      className={cn(
                        "inline-flex items-center justify-center h-4 min-w-[16px] rounded-md px-1 text-[10px] font-semibold leading-none",
                        tab === t.key ? "bg-black/20 text-black" : "bg-rose-500/10 text-rose-200 border border-rose-500/20"
                      )}
                    >
                      {haltTotal}
                    </span>
                  ) : null}
                  {isNewsTab && newsTotal > 0 ? (
                    <span
                      className={cn(
                        "inline-flex items-center justify-center h-4 min-w-[16px] rounded-md px-1 text-[10px] font-semibold leading-none",
                        tab === t.key ? "bg-black/20 text-black" : "bg-sky-500/10 text-sky-200 border border-sky-500/20"
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
            placeholder="Filter… (.)"
            spellCheck={false}
            className="w-[170px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/85 outline-none placeholder:text-white/30"
          />

          <div className="ml-auto flex items-center gap-2">
            {showScannerControls ? (
              <>
                <button
                  onClick={() => setPaused((p) => !p)}
                  className={cn(
                    "rounded-xl border border-white/10 px-3 py-2 text-[12px]",
                    paused ? "bg-white/10 text-white/80" : "bg-black/30 text-white/80 hover:bg-white/10"
                  )}
                  type="button"
                  title="Toggle live polling"
                >
                  {paused ? "Paused" : "Live"}
                </button>

                <button
                  onClick={() => setCompact((c) => !c)}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80 hover:bg-white/10"
                  type="button"
                  title="Toggle density"
                >
                  {compact ? "Compact" : "Comfort"}
                </button>

                <select
                  value={pollMs}
                  onChange={(e) => setPollMs(Number(e.target.value))}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80"
                  title="Polling interval"
                >
                  <option value={1000}>1s</option>
                  <option value={1500}>1.5s</option>
                  <option value={2000}>2s</option>
                  <option value={3000}>3s</option>
                </select>
              </>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
                Halts feed • ~30s
              </div>
            )}
          </div>
        </div>

        {/* Tiny status line (quiet) */}
        <div className="mt-2 flex items-center justify-between text-[10px] text-white/35">
          <div className="truncate">
            Focus <span className="text-white/60">{focusSymbol || "-"}</span> • Rows{" "}
            <span className="text-white/60">{filtered.length}</span>
            {status ? <span className="ml-2 text-rose-200/80">({status})</span> : null}
          </div>
          <div className="text-white/25">
            Hotkeys: <span className="text-white/45">↑/↓</span> • <span className="text-white/45">Enter</span> •{" "}
            <span className="text-white/45">.</span> filter • <span className="text-white/45">B</span>/<span className="text-white/45">S</span>{" "}
            trade • <span className="text-white/45">Esc</span>
          </div>
        </div>
      </div>

      {/* Header */}
      {haltsMode ? (
        <div
          className={cn(
            "shrink-0 grid gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] font-semibold text-white/55",
            gridCols
          )}
        >
          <div className="min-w-0">SYM</div>
          <div className="min-w-0">STATUS</div>
          <div className="min-w-0">REASON</div>
          <div className="min-w-0 text-right">TIME</div>
        </div>
      ) : (
        <div
          className={cn(
            "shrink-0 grid gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] font-semibold text-white/55",
            gridCols
          )}
        >
          <div className="min-w-0">SYM</div>
          <div className="min-w-0 text-right">PX</div>
          {!compact ? <div className="min-w-0 text-right">CHG</div> : null}
          <div className="min-w-0 text-right">CHG%</div>
          <div className="min-w-0 text-right">VOL</div>

          {showScore ? (
            <button
              type="button"
              onClick={onToggleScoreSort}
              className={cn(
                "min-w-0 text-right inline-flex items-center justify-end gap-1 rounded-md px-1 py-0.5 hover:bg-white/5",
                scoreSortActive ? "text-white/80" : "text-white/55"
              )}
              title="Toggle sort: score vs move"
            >
              <span>S</span>
              <span className={cn("text-[10px]", scoreSortActive ? "text-white/60" : "text-white/25")}>
                {scoreSortActive ? "▼" : moveSortActive ? "•" : ""}
              </span>
            </button>
          ) : null}

          {!compact ? <div className="min-w-0 text-center">T</div> : null}
        </div>
      )}

      {/* Body */}
      <div ref={listRef} className="mt-2 flex-1 min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20">
        {filtered.length === 0 ? (
          <div className="p-4 text-[12px] text-white/45">{haltsMode ? "No active halts right now." : "No rows."}</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((r, idx) => {
              const selected = idx === sel;
              const up = (r.changePct ?? 0) >= 0;

              const sym = cleanSymbol(r.symbol);
              const haltCount = haltCounts[sym] || 0;
              const newsCount = newsCounts[sym] || 0;

              const displayTag = (r.tag && String(r.tag).trim()) || defaultTagForTab(tab);

              return (
                <div
                  key={`${sym}-${idx}`}
                  data-row={idx}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSel(idx);
                    onPickSymbol?.(sym);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setSel(idx);
                      onPickSymbol?.(sym);
                    }
                  }}
                  className={cn(
                    "group relative w-full text-left grid px-3 select-none",
                    gridCols,
                    "gap-2",
                    compact ? "py-1" : "py-2",
                    selected ? "bg-white/10" : "hover:bg-white/5"
                  )}
                >
                  <div className={cn("absolute left-0 top-0 h-full w-[3px]", selected ? "bg-emerald-400/70" : "bg-transparent")} />

                  {/* Actions: only on hover or selected */}
                  {!haltsMode ? (
                    <div
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1",
                        selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                        "transition-opacity"
                      )}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onPickSymbol?.(sym);
                          fireTradeAction("BUY", sym);
                        }}
                        className="h-6 w-[46px] rounded-full border border-emerald-500/25 bg-emerald-500/10 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/15"
                        title="Buy (B)"
                      >
                        BUY
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onPickSymbol?.(sym);
                          fireTradeAction("SELL", sym);
                        }}
                        className="h-6 w-[46px] rounded-full border border-rose-500/25 bg-rose-500/10 text-[10px] font-semibold text-rose-200 hover:bg-rose-500/15"
                        title="Sell (S)"
                      >
                        SELL
                      </button>
                    </div>
                  ) : null}

                  {/* SYM */}
                  <div
                    className={cn(
                      "min-w-0 font-semibold flex items-center",
                      selected ? "text-white" : "text-white/85",
                      focusSymbol && sym === focusSymbol && "text-emerald-200"
                    )}
                  >
                    <span className="truncate">{sym}</span>
                    <MiniBadge count={newsCount} tone="sky" />
                    <MiniBadge count={haltCount} tone="rose" />
                  </div>

                  {haltsMode ? (
                    <>
                      <div className="min-w-0 text-white/80 truncate">{r.haltStatus || "—"}</div>
                      <div className="min-w-0 text-white/70 truncate">{r.haltReason || "—"}</div>
                      <div className="min-w-0 text-right text-white/60 tabular-nums truncate">{r.haltTime || "—"}</div>
                    </>
                  ) : (
                    <>
                      <div className={cn("min-w-0 text-right tabular-nums truncate", selected ? "text-white/90" : "text-white/75")}>
                        {fmtPx(r.price)}
                      </div>

                      {!compact ? (
                        <div
                          className={cn(
                            "min-w-0 text-right tabular-nums font-semibold truncate",
                            up ? "text-emerald-400" : "text-red-400"
                          )}
                        >
                          {fmtSigned(r.change)}
                        </div>
                      ) : null}

                      <div
                        className={cn(
                          "min-w-0 text-right tabular-nums font-semibold truncate",
                          up ? "text-emerald-400" : "text-red-400"
                        )}
                      >
                        {fmtPct(r.changePct)}
                      </div>

                      <div className={cn("min-w-0 text-right tabular-nums truncate", selected ? "text-white/80" : "text-white/70")}>
                        {volLabel(r.volume, r.volumeLabel)}
                      </div>

                      {showScore ? (
                        <div className={cn("min-w-0 text-right tabular-nums", compact ? "text-white/65" : "text-white/70")}>
                          {fmtScoreInline(r.totalScore)}
                        </div>
                      ) : null}

                      {!compact ? (
                        <div className="min-w-0 text-center text-[11px] text-white/35 tabular-nums">{tagToGlyph(displayTag)}</div>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer (quiet) */}
      {showScore && tab !== "halts" ? (
        <div className="shrink-0 pt-2 text-[10px] text-white/30">
          Sort: <span className="text-white/45">{scoreSortActive ? "SCORE" : "MOVE"}</span> (click S)
        </div>
      ) : (
        <div className="shrink-0 pt-2 text-[10px] text-white/25"> </div>
      )}
    </div>
  );
}