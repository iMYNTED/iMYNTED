"use client";

import React, { useEffect, useMemo, useState } from "react";

type ScannerType = "gainers" | "losers" | "unusual" | "newspike";

type ApiRow = {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  volumeLabel?: string;
  tag: "Gainer" | "Loser" | "Unusual Vol" | "News Spike";
};

type ApiResponse = {
  provider?: string;
  type?: string;
  rows?: ApiRow[];
  ts?: string;
};

export type ScannerPanelProps = {
  activeSymbol?: string;
  onPickSymbol?: (symbol: string) => void;
  defaultType?: ScannerType;
  refreshSeconds?: number;
};

function fmtPrice(v: number) {
  return `$${v.toFixed(2)}`;
}

function fmtChg(change: number, changePct: number) {
  const c = `${change >= 0 ? "+" : ""}${change.toFixed(2)}`;
  const p = `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`;
  return `${c} (${p})`;
}

function chgClass(v: number) {
  return v >= 0 ? "text-emerald-300" : "text-red-300";
}

function Tab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1.5 text-[12px] font-semibold",
        active
          ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30"
          : "bg-white/5 text-white/70 hover:bg-white/10",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function ScannerPanel({
  activeSymbol,
  onPickSymbol,
  defaultType = "gainers",
  refreshSeconds = 9,
}: ScannerPanelProps) {
  const [type, setType] = useState<ScannerType>(defaultType);
  const [rows, setRows] = useState<ApiRow[]>([]);
  const [provider, setProvider] = useState<string>("mock");
  const [loading, setLoading] = useState(false);
  const [secLeft, setSecLeft] = useState(refreshSeconds);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    if (type === "gainers") return "Top Gainers";
    if (type === "losers") return "Top Losers";
    if (type === "unusual") return "Unusual Vol";
    return "News Spike";
  }, [type]);

  async function fetchNow(currentType: ScannerType) {
    setLoading(true);
    try {
      const url = `/api/market/scanner?type=${currentType}`;
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) {
        setError(`${url} → HTTP ${res.status}`);
        return;
      }

      const json = (await res.json()) as ApiResponse;
      setProvider(json.provider ?? "mock");

      const list = Array.isArray(json.rows) ? json.rows : [];
      if (list.length) {
        setRows(list);
        setError(null);
      }
    } catch (e: any) {
      setError(e?.message ?? "Scanner fetch failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNow(type);
    setSecLeft(refreshSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => {
    const t = setInterval(() => {
      setSecLeft((s) => {
        if (s <= 1) {
          fetchNow(type);
          return refreshSeconds;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, refreshSeconds]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="text-[12px] font-semibold text-white/80">
          Scanners (Terminal)
        </div>
        <div className="ml-auto flex items-center gap-3 text-[11px] text-white/50">
          <span>{loading ? "Updating…" : `Auto refresh ${secLeft}s`}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <Tab active={type === "gainers"} onClick={() => setType("gainers")}>
          Top Gainers
        </Tab>
        <Tab active={type === "losers"} onClick={() => setType("losers")}>
          Top Losers
        </Tab>
        <Tab active={type === "unusual"} onClick={() => setType("unusual")}>
          Unusual Vol
        </Tab>
        <Tab active={type === "newspike"} onClick={() => setType("newspike")}>
          News Spike
        </Tab>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
        <div className="px-3 py-2 text-[11px] text-white/50 flex items-center justify-between">
          <span>
            {title} • Source: {provider}
          </span>
          <span className="text-white/35">/api/market/scanner</span>
        </div>

        {error && (
          <div className="px-3 py-2 text-[11px] text-red-300 border-y border-white/10 bg-white/5">
            Scanner error: {error}
          </div>
        )}

        <div className="grid grid-cols-[1.2fr_1fr_1.4fr_0.9fr] gap-2 border-y border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/70">
          <div>Symbol</div>
          <div className="text-right">Price</div>
          <div className="text-right">Chg</div>
          <div className="text-right">Vol</div>
        </div>

        <div className="max-h-[320px] overflow-auto">
          {rows.map((r) => {
            const isActive =
              activeSymbol?.toUpperCase() === r.symbol.toUpperCase();

            return (
              <button
                key={`${type}-${r.symbol}`}
                type="button"
                onClick={() => onPickSymbol?.(r.symbol)}
                className={[
                  "w-full grid grid-cols-[1.2fr_1fr_1.4fr_0.9fr] gap-2 px-3 py-2 text-[12px]",
                  "border-b border-white/5 hover:bg-white/5",
                  isActive ? "bg-emerald-500/15" : "bg-transparent",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{r.symbol}</span>
                  {isActive && (
                    <span className="rounded-full bg-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-200 ring-1 ring-emerald-400/30">
                      ACTIVE
                    </span>
                  )}
                </div>

                <div className="text-right tabular-nums text-white/80">
                  {fmtPrice(r.price)}
                </div>

                <div className={["text-right tabular-nums", chgClass(r.changePct)].join(" ")}>
                  {fmtChg(r.change, r.changePct)}
                </div>

                <div className="text-right tabular-nums text-white/60">
                  {r.volumeLabel ?? r.volume.toLocaleString()}
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-3 py-2 text-[11px] text-white/40">
          Click a row to set Active Symbol.
        </div>
      </div>
    </div>
  );
}
