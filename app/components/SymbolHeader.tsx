"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Quote = {
  symbol: string;

  price?: number;
  bid?: number;
  ask?: number;

  chg?: number;
  chgPct?: number;
  vol?: number;
  high?: number;
  low?: number;
  open?: number;
  prevClose?: number;

  ts?: string;
  provider?: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function n(v: any): number | undefined {
  const x = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(x) ? x : undefined;
}

function fmtPx(v?: number) {
  if (v === undefined) return "—";
  return v >= 1 ? v.toFixed(2) : v.toFixed(4);
}

function fmtPct(v?: number) {
  if (v === undefined) return "—";
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(2)}%`;
}

function fmtSigned(v?: number) {
  if (v === undefined) return "—";
  const s = v > 0 ? "+" : "";
  return s + (Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(4));
}

function fmtVol(v?: number) {
  if (v === undefined) return "—";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
  return Math.round(v).toLocaleString();
}

async function fetchQuote(symbol: string): Promise<Quote | null> {
  const s = (symbol || "").toUpperCase().trim();
  if (!s) return null;

  // ✅ only call the route you actually have
  const url = `/api/market/quote?symbol=${encodeURIComponent(s)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  // ✅ if server returns HTML, don’t parse as JSON
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;

  const json: any = await res.json();
  const data = json?.data ?? json ?? {};

  const out: Quote = {
    symbol: String(data.symbol ?? s).toUpperCase(),

    price: n(data.price ?? data.last ?? data.px ?? data.c),
    bid: n(data.bid ?? data.b),
    ask: n(data.ask ?? data.a),

    chg: n(data.chg ?? data.change ?? data.delta ?? data.net),
    chgPct: n(data.chgPct ?? data.changePct ?? data.pct ?? data.percent),

    vol: n(data.vol ?? data.volume ?? data.v),
    // your API uses dayHigh/dayLow, so map those too
    high: n(data.high ?? data.h ?? data.dayHigh),
    low: n(data.low ?? data.l ?? data.dayLow),
    open: n(data.open ?? data.o),
    prevClose: n(data.prevClose ?? data.pc ?? data.previousClose),

    ts: typeof (data.ts ?? json?.ts) === "string" ? String(data.ts ?? json.ts) : undefined,
    provider:
      typeof (json?.provider ?? data?.provider) === "string"
        ? String(json.provider ?? data.provider)
        : undefined,
  };

  if (
    out.chgPct === undefined &&
    out.chg !== undefined &&
    out.prevClose !== undefined &&
    out.prevClose !== 0
  ) {
    out.chgPct = (out.chg / out.prevClose) * 100;
  }

  return out;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-white/35">{label}</span>
      <span className="text-white/75 tabular-nums">{value}</span>
    </span>
  );
}

export default function SymbolHeader({
  symbol,
  intervalMs = 2500,
  className,
}: {
  symbol: string;
  intervalMs?: number;
  className?: string;
}) {
  const sym = useMemo(() => (symbol || "").toUpperCase().trim(), [symbol]);
  const [q, setQ] = useState<Quote | null>(null);
  const [err, setErr] = useState("");

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let t: any;

    async function poll() {
      try {
        setErr("");
        const next = await fetchQuote(sym);
        if (!alive.current) return;
        if (next) setQ(next);
      } catch {
        if (!alive.current) return;
        setErr("fetch");
      } finally {
        if (!alive.current) return;
        t = setTimeout(poll, Math.max(800, intervalMs));
      }
    }

    if (sym) poll();
    return () => {
      if (t) clearTimeout(t);
    };
  }, [sym, intervalMs]);

  const chg = q?.chg;
  const chgPct = q?.chgPct;

  const chgClass =
    typeof chg === "number"
      ? chg > 0
        ? "text-emerald-400"
        : chg < 0
        ? "text-red-400"
        : "text-white/60"
      : "text-white/60";

  const spr =
    q?.bid !== undefined && q?.ask !== undefined ? Math.max(0, q.ask - q.bid) : undefined;

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-background px-3 py-2",
        "relative z-10",
        className
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] md:items-center gap-2">
        <div className="min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm font-semibold">{sym || "—"}</span>

          <span className="text-sm font-semibold tabular-nums">{fmtPx(q?.price)}</span>

          <span className={cn("text-xs font-medium tabular-nums", chgClass)}>
            {fmtSigned(chg)} ({fmtPct(chgPct)})
          </span>

          <span className="text-[11px] text-white/45 tabular-nums">
            <span className="text-white/30">bid</span> {fmtPx(q?.bid)}{" "}
            <span className="text-white/30">/ ask</span> {fmtPx(q?.ask)}{" "}
            <span className="text-white/30">/ spr</span> {fmtPx(spr)}
          </span>

          <span className="text-[11px] text-white/35">
            {q?.provider ? q.provider : ""}
            {err ? (q?.provider ? " • !" : "!") : ""}
          </span>
        </div>

        <div
          className={cn(
            "md:justify-self-end",
            "overflow-x-auto",
            "whitespace-nowrap",
            "text-[11px]",
            "[-ms-overflow-style:none] [scrollbar-width:none]"
          )}
        >
          <div className="flex items-center gap-4">
            <Stat label="VOL" value={fmtVol(q?.vol)} />
            <Stat label="H" value={fmtPx(q?.high)} />
            <Stat label="L" value={fmtPx(q?.low)} />
            <Stat label="O" value={fmtPx(q?.open)} />
            <Stat label="PC" value={fmtPx(q?.prevClose)} />
            {q?.ts ? <span className="text-white/25">{q.ts}</span> : null}
          </div>
        </div>
      </div>

      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
