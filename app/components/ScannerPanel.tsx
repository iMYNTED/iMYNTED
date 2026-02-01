"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type TabKey = "gainers" | "volume" | "news" | "halts";

type Row = {
  symbol: string;
  price?: number;
  chgPct?: number;
  volume?: number;
};

type BulkCountsResponse = {
  mode?: string;
  counts?: Record<string, number>;
};

type Props = {
  selectedSymbol?: string;
  onSelectSymbol?: (symbol: string) => void;
  onPickSymbol?: (symbol: string) => void;
  refreshMs?: number; // default 12000
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function normalizeSymbol(s: string) {
  return (s || "").toUpperCase().replace(/[^A-Z.\-]/g, "").trim();
}

function toNum(v: any): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function fmtPrice(x: number | undefined) {
  if (x === undefined || x === null || !Number.isFinite(x)) return "—";
  return x.toFixed(2);
}

function fmtPct(x: number | undefined) {
  if (x === undefined || x === null || !Number.isFinite(x)) return "—";
  const sign = x > 0 ? "+" : "";
  return `${sign}${x.toFixed(2)}%`;
}

function fmtNum(x: number | undefined) {
  if (x === undefined || x === null || !Number.isFinite(x)) return "—";
  return x.toLocaleString();
}

function NewsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6h14a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H6a2 2 0 0 1-2-2V6z" />
      <path d="M8 10h8" />
      <path d="M8 14h8" />
      <path d="M8 18h5" />
      <path d="M4 20a2 2 0 0 1-2-2V6h2" />
    </svg>
  );
}

async function fetchJsonTry(urls: string[]) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      return await res.json();
    } catch {}
  }
  return null;
}

async function fetchScanner(tab: TabKey): Promise<Row[]> {
  const json = await fetchJsonTry([
    `/api/market/scanners?type=${encodeURIComponent(tab)}`,
    `/api/market/scanners?tab=${encodeURIComponent(tab)}`,
    `/api/market/scanners/${encodeURIComponent(tab)}`,
    `/api/market/scanners`,
  ]);

  const raw = Array.isArray(json) ? json : (json?.data ?? json?.rows ?? json?.items);
  if (!Array.isArray(raw)) return [];

  return raw
    .map((r: any) => {
      const symbol = normalizeSymbol(r?.symbol ?? r?.ticker ?? r?.sym ?? "");
      if (!symbol) return null;

      const price = toNum(r?.price ?? r?.last ?? r?.close);
      const chgPct = toNum(r?.chgPct ?? r?.changePercent ?? r?.pct);
      const volume = toNum(r?.volume ?? r?.vol);

      return { symbol, price, chgPct, volume } as Row;
    })
    .filter(Boolean) as Row[];
}

async function fetchCounts(endpoint: "/api/market/news" | "/api/market/halts", symbols: string[]) {
  if (!symbols.length) return {} as Record<string, number>;
  const url = `${endpoint}?symbols=${encodeURIComponent(symbols.join(","))}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return {};
    const json = (await res.json()) as BulkCountsResponse;
    return json?.counts && typeof json.counts === "object" ? json.counts : {};
  } catch {
    return {};
  }
}

export default function ScannerPanel({
  selectedSymbol,
  onSelectSymbol,
  onPickSymbol,
  refreshMs = 12000,
}: Props) {
  const [tab, setTab] = useState<TabKey>("gainers");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const [newsCounts, setNewsCounts] = useState<Record<string, number>>({});
  const [haltCounts, setHaltCounts] = useState<Record<string, number>>({});

  const picked = useMemo(() => normalizeSymbol(selectedSymbol || ""), [selectedSymbol]);

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  function pickSymbol(sym: string) {
    const s = normalizeSymbol(sym);
    if (!s) return;
    onSelectSymbol?.(s);
    onPickSymbol?.(s);
  }

  const loadAll = async () => {
    setLoading(true);
    try {
      const scannerRows = await fetchScanner(tab);
      if (!aliveRef.current) return;
      setRows(scannerRows);

      const syms = Array.from(new Set(scannerRows.map((r) => r.symbol))).slice(0, 25);

      const [nc, hc] = await Promise.all([
        fetchCounts("/api/market/news", syms),
        fetchCounts("/api/market/halts", syms),
      ]);

      if (!aliveRef.current) return;
      setNewsCounts(nc);
      setHaltCounts(hc);
    } finally {
      if (!aliveRef.current) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const id = window.setInterval(loadAll, Math.max(3000, refreshMs));
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, refreshMs]);

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "gainers", label: "Top Gainers" },
    { key: "volume", label: "Unusual Volume" },
    { key: "news", label: "News Spike" },
    { key: "halts", label: "Halts" },
  ];

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-2 py-2">
        {tabs.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-xs transition",
                active
                  ? "border-white/20 bg-muted"
                  : "border-white/10 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2 pr-1">
          <div className="text-[11px] text-muted-foreground">
            {loading ? "Refreshing…" : `Refresh ${Math.round(refreshMs / 1000)}s`}
          </div>
          <button
            onClick={loadAll}
            className="rounded-xl border border-white/10 px-2 py-1 text-[11px] hover:bg-muted/50"
            title="Refresh now"
          >
            ↻
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] text-muted-foreground border-b border-white/10">
        <div className="col-span-6">SYMBOL</div>
        <div className="col-span-3 text-right">PRICE</div>
        <div className="col-span-2 text-right">CHG%</div>
        <div className="col-span-1 text-right">VOL</div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">
            {loading ? "Loading…" : "No rows"}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {rows.map((r) => {
              const isSelected = picked && r.symbol === picked;

              const pct = r.chgPct;
              const pctClass =
                typeof pct === "number"
                  ? pct > 0
                    ? "text-emerald-400"
                    : pct < 0
                    ? "text-red-400"
                    : "text-muted-foreground"
                  : "text-muted-foreground";

              const n = newsCounts[r.symbol] ?? 0;
              const h = haltCounts[r.symbol] ?? 0;

              return (
                <button
                  key={r.symbol}
                  onClick={() => pickSymbol(r.symbol)}
                  className={cn(
                    "w-full text-left px-3 py-2 grid grid-cols-12 gap-2 items-center",
                    "hover:bg-muted/40",
                    isSelected ? "bg-muted/60" : ""
                  )}
                >
                  <div className="col-span-6 flex items-center gap-2 min-w-0">
                    <span className="font-semibold truncate">{r.symbol}</span>

                    {/* NEWS */}
                    {n > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-background/50 px-2 py-0.5 text-[11px]">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                          <NewsIcon className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-muted-foreground">NEWS</span>
                        <span className="inline-flex min-w-[18px] justify-center rounded-full bg-emerald-500/20 px-1.5">
                          {n}
                        </span>
                      </span>
                    ) : null}

                    {/* HALT */}
                    {h > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-300">
                        HALT
                        <span className="inline-flex min-w-[18px] justify-center rounded-full bg-red-500/20 px-1.5">
                          {h}
                        </span>
                      </span>
                    ) : null}
                  </div>

                  <div className="col-span-3 text-right tabular-nums">{fmtPrice(r.price)}</div>
                  <div className={cn("col-span-2 text-right tabular-nums", pctClass)}>
                    {fmtPct(r.chgPct)}
                  </div>
                  <div className="col-span-1 text-right tabular-nums text-muted-foreground">
                    {fmtNum(r.volume)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
