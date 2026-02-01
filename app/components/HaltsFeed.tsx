"use client";

import React, { useEffect, useMemo, useState } from "react";

type HaltItem = {
  id?: string;
  symbol: string;
  status?: string;
  reason?: string;
  venue?: string;
  published?: string;
  title?: string;
  url?: string;
};

type HaltsAllResponse = {
  mode: "all";
  provider: string;
  items: HaltItem[];
  ts: string;
  error?: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function normSym(s: string) {
  return (s || "").toUpperCase().replace(/[^A-Z.\-]/g, "").trim();
}

function hhmm(ts?: string) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function HaltsFeed({
  selectedSymbol,
  onPickSymbol,
  refreshMs = 60000,
}: {
  selectedSymbol?: string;
  onPickSymbol?: (symbol: string) => void;
  refreshMs?: number;
}) {
  const picked = useMemo(() => normSym(selectedSymbol || ""), [selectedSymbol]);

  const [items, setItems] = useState<HaltItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<string>("—");
  const [error, setError] = useState<string | undefined>(undefined);
  const [ts, setTs] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/market/halts?mode=all", { cache: "no-store" });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setItems([]);
        return;
      }
      const json = (await res.json()) as HaltsAllResponse;
      setProvider(json.provider || "—");
      setItems(Array.isArray(json.items) ? json.items : []);
      setTs(json.ts || "");
      setError(json.error);
    } catch (e: any) {
      setError(e?.message ?? "Fetch failed");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, Math.max(15000, refreshMs));
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMs]);

  // Show newest-ish first (RSS order may already be newest first)
  const rows = useMemo(() => {
    return [...items].slice(0, 200);
  }, [items]);

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="text-[11px] text-muted-foreground">
          {loading ? "Refreshing…" : `Provider: ${provider}`}
          {ts ? <span className="ml-2">• {hhmm(ts)}</span> : null}
          {error ? <span className="ml-2 text-red-400">• {error}</span> : null}
        </div>

        <button
          onClick={load}
          className="rounded-xl border border-white/10 px-2 py-1 text-[11px] hover:bg-muted/50"
          title="Refresh now"
        >
          ↻
        </button>
      </div>

      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] text-muted-foreground border-b border-white/10">
        <div className="col-span-2">SYM</div>
        <div className="col-span-2">STATUS</div>
        <div className="col-span-6">REASON</div>
        <div className="col-span-2 text-right">TIME</div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">
            {loading ? "Loading halts…" : "No current halts."}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {rows.map((it, idx) => {
              const sym = normSym(it.symbol);
              const selected = picked && sym === picked;

              const status = (it.status || "").toLowerCase();
              const statusClass =
                status.includes("halt")
                  ? "text-red-300"
                  : status.includes("pause")
                  ? "text-amber-300"
                  : status.includes("resum")
                  ? "text-emerald-300"
                  : "text-muted-foreground";

              return (
                <button
                  key={it.id || `${sym}-${idx}`}
                  onClick={() => onPickSymbol?.(sym)}
                  className={cn(
                    "w-full text-left px-3 py-2 grid grid-cols-12 gap-2 items-center hover:bg-muted/40",
                    selected ? "bg-muted/60" : ""
                  )}
                  title="Click to set symbol"
                >
                  <div className="col-span-2 font-semibold truncate">{sym}</div>

                  <div className={cn("col-span-2 text-[11px] truncate", statusClass)}>
                    {it.status || "—"}
                  </div>

                  <div className="col-span-6 text-[11px] text-muted-foreground truncate">
                    {it.reason || it.title || "—"}
                  </div>

                  <div className="col-span-2 text-right text-[11px] text-muted-foreground">
                    {hhmm(it.published)}
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
