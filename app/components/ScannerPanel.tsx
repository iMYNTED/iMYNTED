"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type ScanRow = {
  symbol: string;
  price?: number;
  chg?: number;
  chgPct?: number | string;
  vol?: number;
  float?: number;
  news?: number;
  halted?: boolean;
  [k: string]: any;
};

type TabKey = "gainers" | "losers" | "unusual" | "news" | "halts";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtNum(n?: number) {
  if (n === undefined || n === null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
  return String(v.toFixed(0));
}

function fmtPrice(n?: number) {
  if (n === undefined || n === null || Number.isNaN(Number(n))) return "—";
  return Number(n).toFixed(2);
}

function normalizePct(n: any): number | null {
  const v = Number(n);
  if (Number.isNaN(v)) return null;
  return Math.abs(v) <= 1 ? v * 100 : v;
}

function mapRows(raw: any): ScanRow[] {
  const rows: any[] = Array.isArray(raw) ? raw : raw?.rows ?? raw?.data ?? raw?.items ?? [];
  return (rows || [])
    .map((x: any) => {
      const symbol = String(x.symbol || x.ticker || x.sym || "").toUpperCase();
      const price = Number(x.price ?? x.last ?? x.lastPrice ?? x.p ?? NaN);
      const chg = Number(x.chg ?? x.change ?? x.dollarChange ?? NaN);
      const chgPct = x.chgPct ?? x.changePercent ?? x.pct ?? x.percentChange ?? x.dp;
      const vol = Number(x.vol ?? x.volume ?? x.v ?? NaN);
      const float = Number(x.float ?? x.floatShares ?? x.shares_float ?? NaN);
      const news = Number(x.news ?? x.newsCount ?? x.articles ?? NaN);
      const halted = Boolean(x.halted ?? x.isHalted ?? x.halt ?? false);

      return {
        ...x,
        symbol,
        price: Number.isFinite(price) ? price : undefined,
        chg: Number.isFinite(chg) ? chg : undefined,
        chgPct,
        vol: Number.isFinite(vol) ? vol : undefined,
        float: Number.isFinite(float) ? float : undefined,
        news: Number.isFinite(news) ? news : undefined,
        halted,
      };
    })
    .filter((r: ScanRow) => r.symbol);
}

const TAB_META: Array<{ key: TabKey; label: string }> = [
  { key: "gainers", label: "Top Gainers" },
  { key: "losers", label: "Top Losers" },
  { key: "unusual", label: "Unusual Vol" },
  { key: "news", label: "News Spike" },
  { key: "halts", label: "HALTS" },
];

export default function ScannerPanel() {
  const [tab, setTab] = useState<TabKey>("gainers");
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const [q, setQ] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  async function fetchScan(activeTab: TabKey) {
    setLoading(true);
    setErr("");
    try {
      // UI supports per-tab; if API ignores it, we still client-sort.
      const res = await fetch(`/api/market/scanners?tab=${encodeURIComponent(activeTab)}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const res2 = await fetch(`/api/market/scanners`, { cache: "no-store" });
        if (!res2.ok) throw new Error(`Scanners API ${res.status}/${res2.status}`);
        const raw2 = await res2.json();
        setRows(mapRows(raw2));
      } else {
        const raw = await res.json();
        setRows(mapRows(raw));
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load scanners");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    fetchScan(tab);
    const t = setInterval(() => {
      if (!alive) return;
      fetchScan(tab);
    }, 6_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const filtered = useMemo(() => {
    const needle = q.trim().toUpperCase();
    let list = rows.slice();

    // Client sorting/filtering as a fallback if API isn't tab-aware.
    if (tab === "halts") list = list.filter((r) => r.halted);
    if (tab === "news") list = list.sort((a, b) => (b.news || 0) - (a.news || 0));
    if (tab === "unusual") list = list.sort((a, b) => (b.vol || 0) - (a.vol || 0));
    if (tab === "gainers")
      list = list.sort((a, b) => (normalizePct(b.chgPct) || 0) - (normalizePct(a.chgPct) || 0));
    if (tab === "losers")
      list = list.sort((a, b) => (normalizePct(a.chgPct) || 0) - (normalizePct(b.chgPct) || 0));

    if (needle) list = list.filter((r) => r.symbol.includes(needle));
    return list.slice(0, 200);
  }, [rows, tab, q]);

  function pctClass(v: any) {
    const p = normalizePct(v);
    if (p === null) return "text-muted-foreground";
    return p >= 0 ? "text-emerald-400" : "text-red-400";
  }

  function chgClass(v?: number) {
    if (v === undefined) return "text-muted-foreground";
    return v >= 0 ? "text-emerald-400" : "text-red-400";
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Sticky controls */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="text-sm font-semibold">Scanners</div>
          <button
            className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-muted"
            onClick={() => fetchScan(tab)}
            disabled={loading}
            title="Refresh"
          >
            {loading ? "..." : "↻"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 px-3 pb-2">
          {TAB_META.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                requestAnimationFrame(() => {
                  if (scrollRef.current) scrollRef.current.scrollTop = 0;
                });
              }}
              className={cn(
                "rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-muted",
                tab === t.key && "bg-muted"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Symbol…"
            className="h-8 w-[160px] rounded-md border border-white/10 bg-background px-2 text-sm outline-none focus:ring-2"
          />
          {err ? <span className="text-xs text-red-500">{err}</span> : null}
        </div>
      </div>

      {/* Scroll area */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-12 gap-2 border-b border-white/10 px-3 py-2 text-[11px] text-muted-foreground">
          <div className="col-span-2">SYM</div>
          <div className="col-span-2 text-right">LAST</div>
          <div className="col-span-2 text-right">CHG</div>
          <div className="col-span-2 text-right">CHG%</div>
          <div className="col-span-2 text-right">VOL</div>
          <div className="col-span-2 text-right">FLOAT</div>
        </div>

        {filtered.length === 0 && !loading ? (
          <div className="p-4 text-sm text-muted-foreground">No rows.</div>
        ) : (
          filtered.map((r) => {
            const pct = normalizePct(r.chgPct);
            const isHalt = Boolean(r.halted);
            const news = r.news;

            return (
              <div
                key={r.symbol}
                className={cn(
                  "grid grid-cols-12 gap-2 border-b border-white/10 px-3 py-2 text-sm hover:bg-muted/50",
                  isHalt && "bg-muted/40"
                )}
              >
                <div className="col-span-2 flex items-center gap-2">
                  <span className="font-semibold">{r.symbol}</span>
                  {isHalt && (
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold">
                      HALT
                    </span>
                  )}
                  {Number.isFinite(news) && (news || 0) > 0 && (
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold">
                      NEWS {news}
                    </span>
                  )}
                </div>

                <div className="col-span-2 text-right tabular-nums">{fmtPrice(r.price)}</div>
                <div className={cn("col-span-2 text-right tabular-nums", chgClass(r.chg))}>
                  {r.chg === undefined ? "—" : r.chg.toFixed(2)}
                </div>
                <div className={cn("col-span-2 text-right tabular-nums", pctClass(r.chgPct))}>
                  {pct === null ? "—" : `${pct.toFixed(2)}%`}
                </div>
                <div className="col-span-2 text-right tabular-nums">{fmtNum(r.vol)}</div>
                <div className="col-span-2 text-right tabular-nums">{fmtNum(r.float)}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
