// app/components/SymbolHeader.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Quote = {
  symbol: string;

  price?: number;
  bid?: number;
  ask?: number;
  mid?: number;
  last?: number;

  chg?: number;
  chgPct?: number;
  vol?: number;
  high?: number;
  low?: number;
  open?: number;
  prevClose?: number;

  ts?: string;
  provider?: string;
  warn?: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function n(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;
  const x = typeof v === "string" ? Number(v.replace(/,/g, "").trim()) : Number(v);
  return Number.isFinite(x) ? x : undefined;
}

/* ========================= ROBUST UNWRAP ========================= */

function unwrapPayload(json: any) {
  const root = json ?? {};
  let d: any = root;

  for (let i = 0; i < 6; i += 1) {
    if (!d || typeof d !== "object") break;

    if (d.quote && typeof d.quote === "object") {
      d = d.quote;
      continue;
    }
    if (d.data && typeof d.data === "object") {
      d = d.data;
      continue;
    }
    if (d.result && typeof d.result === "object") {
      d = d.result;
      continue;
    }
    if (d.payload && typeof d.payload === "object") {
      d = d.payload;
      continue;
    }

    break;
  }

  return { root, data: d };
}

/* ========================= PRICE LOGIC ========================= */

function computeMid(bid?: number, ask?: number) {
  if (typeof bid !== "number" || typeof ask !== "number") return undefined;
  if (!Number.isFinite(bid) || !Number.isFinite(ask)) return undefined;
  if (bid <= 0 || ask <= 0) return undefined;
  return (bid + ask) / 2;
}

/* ========================= SYMBOL NORMALIZATION ========================= */

function isCryptoSymbol(sym: string) {
  const s = (sym || "").toUpperCase().trim();
  if (!s) return false;
  if (s.includes("-USD")) return true;
  return ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "BNB", "MATIC"].includes(s);
}

function normSym(raw: string) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.\-]/g, "");
}

function normalizeCryptoSymbol(raw: string) {
  const s = normSym(raw);
  if (!s) return "BTC-USD";
  if (s.includes("-")) return s;
  if (s.endsWith("USD")) return s.replace(/USD$/, "-USD");
  return `${s}-USD`;
}

function normalizeStockSymbol(raw: string) {
  let s = normSym(raw);
  if (!s) return "AAPL";
  s = s.replace(/-USD$/i, "");
  s = s.replace(/[0-9]+$/, "");
  if (s.includes("-")) return "AAPL";
  s = s.replace(/[^A-Z0-9.]/g, "");
  return s || "AAPL";
}

function normalizeSymbol(asset: "stock" | "crypto", raw: string) {
  return asset === "crypto" ? normalizeCryptoSymbol(raw) : normalizeStockSymbol(raw);
}

/* ========================= FORMATTERS ========================= */

function fmtPx(v?: number, sym?: string) {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  const crypto = isCryptoSymbol(sym || "");
  if (!crypto) return v >= 1 ? v.toFixed(2) : v.toFixed(4);
  if (v >= 100) return v.toFixed(2);
  if (v >= 1) return v.toFixed(4);
  return v.toFixed(6);
}

function fmtPct(v?: number) {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(2)}%`;
}

function fmtSigned(v?: number) {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  const s = v > 0 ? "+" : "";
  const abs = Math.abs(v);
  const dec = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return s + v.toFixed(dec);
}

function fmtVol(v?: number) {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
  return Math.round(v).toLocaleString();
}

function hhmmss(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function Stat({ label, value }: { label: string; value: string }) {
  const labelColor =
    label === "H" ? "text-emerald-400/60" :
    label === "L" ? "text-red-400/60" :
    label === "VOL" ? "text-white/35" :
    "text-white/35";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={labelColor}>{label}</span>
      <span className="tabular-nums text-white/75">{value}</span>
    </span>
  );
}

/* ========================= EVENT BUS ========================= */

function emitEvent(names: string[], detail: any) {
  try {
    for (const name of names) {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    }
  } catch {}
}

function emitCanonicalQuote(q: Quote, asset: "stock" | "crypto") {
  const canonicalSymbol = normalizeSymbol(asset, q.symbol);

  emitEvent(["imynted:quote", "imynted:quoteUpdate", "msa:quote"], {
    symbol: canonicalSymbol,
    asset,

    price: q.price,
    last: q.last,
    bid: q.bid,
    ask: q.ask,
    mid: q.mid,

    chg: q.chg,
    chgPct: q.chgPct,
    vol: q.vol,
    high: q.high,
    low: q.low,
    open: q.open,
    prevClose: q.prevClose,

    ts: q.ts,
    provider: q.provider,
    warn: q.warn,

    rawSymbol: String(q.symbol || "").toUpperCase().trim(),
    source: "SymbolHeader",
    tsLocal: Date.now(),
  });
}

/* ========================= COMPONENT ========================= */

export default function SymbolHeader({
  symbol,
  asset,
  intervalMs = 2500,
  className,
}: {
  symbol: string;
  asset?: "stock" | "crypto";
  intervalMs?: number;
  className?: string;
}) {
  const inferredAsset: "stock" | "crypto" = asset ?? (isCryptoSymbol(symbol) ? "crypto" : "stock");
  const sym = useMemo(() => normalizeSymbol(inferredAsset, symbol), [symbol, inferredAsset]);

  const symRef = useRef(sym);
  const assetRef = useRef<"stock" | "crypto">(inferredAsset);

  useEffect(() => {
    symRef.current = sym;
    assetRef.current = inferredAsset;
  }, [sym, inferredAsset]);

  const [q, setQ] = useState<Quote | null>(null);
  const [err, setErr] = useState("");

  const alive = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);
  const lastOkAtRef = useRef<number>(0);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    function onSymbol(ev: Event) {
      const d = (ev as CustomEvent).detail || {};
      const a = (d.asset === "crypto" ? "crypto" : "stock") as "stock" | "crypto";
      const s = String(d.symbol || "").trim();
      if (!s) return;

      assetRef.current = a;
      symRef.current = normalizeSymbol(a, s);
    }

    window.addEventListener("imynted:symbol", onSymbol as EventListener);
    window.addEventListener("msa:symbol", onSymbol as EventListener);

    return () => {
      window.removeEventListener("imynted:symbol", onSymbol as EventListener);
      window.removeEventListener("msa:symbol", onSymbol as EventListener);
    };
  }, []);

  useEffect(() => {
    let timer: number | undefined;

    async function poll() {
      const curSym = symRef.current;
      const curAsset = assetRef.current;
      if (!curSym) return;

      const myReq = ++reqIdRef.current;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        setErr("");

        const qs = new URLSearchParams();
        qs.set("symbol", curSym);
        qs.set("asset", curAsset);

        const res = await fetch(`/api/market/quote?${qs.toString()}`, {
          cache: "no-store",
          signal: ac.signal,
        });

        if (!res.ok) throw new Error(`quote ${res.status}`);

        const json: any = await res.json().catch(() => ({}));
        const { root, data } = unwrapPayload(json);

        if (root?.ok === false) {
          throw new Error(String(root?.error || root?.warn || "quote failed"));
        }

        const bid = n(data?.bid ?? data?.b);
        const ask = n(data?.ask ?? data?.a);
        const mid = computeMid(bid, ask);
        const explicitPrice = n(data?.price);
        const lastRaw = n(data?.last ?? data?.px ?? data?.c);
        const price = mid ?? explicitPrice ?? lastRaw;
        const last = lastRaw ?? price;

        const out: Quote = {
          symbol: normalizeSymbol(curAsset, String(data?.symbol ?? curSym).toUpperCase()),

          price,
          bid,
          ask,
          mid,
          last,

          chg: n(data?.chg ?? data?.change ?? data?.delta ?? data?.net),
          chgPct: n(data?.chgPct ?? data?.changePct ?? data?.pct ?? data?.percent),

          vol: n(data?.vol ?? data?.volume ?? data?.v),
          high: n(data?.high ?? data?.h ?? data?.dayHigh),
          low: n(data?.low ?? data?.l ?? data?.dayLow),
          open: n(data?.open ?? data?.o),
          prevClose: n(data?.prevClose ?? data?.pc ?? data?.previousClose),

          ts: typeof data?.ts === "string" ? data.ts : root?.ts,
          provider: root?.provider ?? data?.provider,
          warn: root?.warn ?? data?.warn,
        };

        if (
          out.chgPct === undefined &&
          out.chg !== undefined &&
          out.prevClose !== undefined &&
          out.prevClose !== 0
        ) {
          out.chgPct = (out.chg / out.prevClose) * 100;
        }

        if (!alive.current) return;
        if (myReq !== reqIdRef.current) return;

        setQ(out);
        lastOkAtRef.current = Date.now();
        emitCanonicalQuote(out, curAsset);
      } catch (e: any) {
        if (!alive.current) return;
        if (e?.name === "AbortError") return;
        setErr(e?.message ? String(e.message) : "quote failed");
      } finally {
        if (!alive.current) return;
        timer = window.setTimeout(poll, Math.max(800, intervalMs));
      }
    }

    poll();

    return () => {
      if (timer) window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [intervalMs]);

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

  const spr = q?.bid !== undefined && q?.ask !== undefined ? Math.max(0, q.ask - q.bid) : undefined;
  const showMid = q?.mid !== undefined && q?.bid !== undefined && q?.ask !== undefined;

  const stale = useMemo(() => {
    const t = lastOkAtRef.current;
    if (!t) return false;
    return now - t > Math.max(6000, intervalMs * 3);
  }, [now, intervalMs]);

  const displaySym = q?.symbol || sym;

  return (
    <div
      className={cn("relative z-10 rounded-xl border border-emerald-400/[0.08] px-3 py-2", className)}
      style={{
        background: "linear-gradient(135deg, #050d14 0%, #060e18 60%, #050c12 100%)",
        boxShadow: "0 0 0 1px rgba(52,211,153,0.04), inset 80px 0 120px -40px rgba(52,211,153,0.05), inset -40px 0 80px -40px rgba(34,211,238,0.03)",
      }}
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm font-semibold">{displaySym || "—"}</span>

          <span className="tabular-nums text-sm font-semibold">
            {fmtPx(q?.price, displaySym)}
            {showMid ? <span className="ml-1 text-[11px] text-white/35">(mid)</span> : null}
          </span>

          <span className={cn("tabular-nums text-xs font-medium", chgClass)}>
            {fmtSigned(chg)} ({fmtPct(chgPct)})
          </span>

          <span className="tabular-nums text-[11px]">
            <span className="text-emerald-400/60">bid</span> <span className="text-emerald-400/90">{fmtPx(q?.bid, displaySym)}</span>{" "}
            <span className="text-white/20">/ </span><span className="text-red-400/60">ask</span> <span className="text-red-400/90">{fmtPx(q?.ask, displaySym)}</span>{" "}
            <span className="text-white/20">/ </span><span className="text-cyan-400/50">spr</span> <span className="text-white/55">{fmtPx(spr, displaySym)}</span>
          </span>

          <span className="text-[11px] text-white/35">
            {q?.provider ? q.provider : ""}
            {q?.warn ? <span className="text-white/25"> • {q.warn}</span> : null}
            {q?.ts ? <span className="text-white/25"> • {hhmmss(q.ts)}</span> : null}
            {stale ? <span className="ml-2 text-yellow-200/70">STALE</span> : null}
            {err ? <span className="ml-2 text-rose-200/80">! {err}</span> : null}
          </span>
        </div>

        <div className="overflow-x-auto whitespace-nowrap text-[11px] md:justify-self-end">
          <div className="flex items-center gap-4">
            <Stat label="VOL" value={fmtVol(q?.vol)} />
            <Stat label="H" value={fmtPx(q?.high, displaySym)} />
            <Stat label="L" value={fmtPx(q?.low, displaySym)} />
            <Stat label="O" value={fmtPx(q?.open, displaySym)} />
            <Stat label="PC" value={fmtPx(q?.prevClose, displaySym)} />
          </div>
        </div>
      </div>
    </div>
  );
}
