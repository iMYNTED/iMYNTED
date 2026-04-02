// app/components/TraderCard.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type AssetType = "stock" | "crypto";
type Side = "BUY" | "SELL" | "FLAT";
type OrderType = "MARKET" | "LIMIT";
type TIF = "DAY" | "GTC" | "IOC" | "FOK";

type QuotePayload = {
  ok?: boolean;
  ts?: string;
  provider?: string;
  warn?: string;

  data?: any;
  quote?: any;

  symbol?: string;
  asset?: AssetType;
  price?: number;
  bid?: number;
  ask?: number;
  mid?: number;
  last?: number;
};

type CanonQuote = {
  symbol?: string;
  asset?: AssetType;
  price?: number;
  last?: number;
  mid?: number;
  bid?: number;
  ask?: number;
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

function isCryptoSymbol(sym: string) {
  const s = (sym || "").toUpperCase().trim();
  if (!s) return false;
  if (s.includes("-USD")) return true;
  return ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "BNB", "MATIC"].includes(s);
}

/**
 * Keep crypto normalization as-is.
 * Stock normalization must match terminal:
 * - strip junk
 * - strip trailing digits
 * - if contains "-" -> "AAPL" (your rule)
 * - allow "." (BRK.B)
 */
function normalizeSymbol(asset: AssetType, raw: string) {
  const s0 = (raw || "").toUpperCase().trim();
  if (!s0) return asset === "crypto" ? "BTC-USD" : "AAPL";

  if (asset === "crypto") {
    if (s0.includes("-")) return s0;
    if (s0.endsWith("USD")) return s0.replace(/USD$/, "-USD");
    if (isCryptoSymbol(s0)) return `${s0}-USD`;
    return "BTC-USD";
  }

  // stock
  let s = s0.replace(/\s+/g, "");
  s = s.replace(/[^A-Z0-9.\-]/g, "");
  s = s.replace(/[0-9]+$/, "");
  if (s.includes("-")) return "AAPL";
  s = s.replace(/[^A-Z0-9.]/g, "");
  return s || "AAPL";
}

function decFor(asset: AssetType, px: number) {
  if (asset === "stock") return px >= 1 ? 2 : 4;
  if (px >= 100) return 2;
  if (px >= 1) return 4;
  return 6;
}

function fmtPx(x: number | undefined, asset: AssetType) {
  if (x === undefined || x === null || !Number.isFinite(x)) return "—";
  const d = decFor(asset, Number(x));
  return Number(x).toFixed(d);
}

function clampNum(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSet<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function computeMid(bid?: number, ask?: number) {
  if (
    typeof bid === "number" &&
    typeof ask === "number" &&
    Number.isFinite(bid) &&
    Number.isFinite(ask) &&
    bid > 0 &&
    ask > 0
  ) {
    return (bid + ask) / 2;
  }
  return undefined;
}

/**
 * Normalize route shapes (supports double-wrapped payloads).
 *
 * ARCHMAGE RULE (ALIGN WITH SymbolHeader / Tape):
 * Price priority:
 *   1) mid (computed from bid/ask when present, else feed mid fields)
 *   2) explicit price
 *   3) last fallback
 */
function unwrapQuote(j: QuotePayload | any, fallbackSymbol: string, fallbackAsset: AssetType) {
  const wrapper = j ?? {};

  let d: any = wrapper;
  for (let i = 0; i < 6; i++) {
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

  const symRaw = String(d?.symbol ?? wrapper?.symbol ?? fallbackSymbol ?? "").toUpperCase();
  const asset = (d?.asset ?? wrapper?.asset ?? fallbackAsset) as AssetType;
  const sym = normalizeSymbol(asset, symRaw);

  const bid = n(d?.bid ?? d?.b);
  const ask = n(d?.ask ?? d?.a);

  const midFromL2 = computeMid(bid, ask);
  const midFromFeed = n(d?.mid ?? d?.m ?? d?.midpoint);
  const mid = midFromL2 ?? midFromFeed;

  const explicitPrice = n(d?.price);
  const last = n(d?.last ?? d?.px ?? d?.c);

  const price = mid ?? explicitPrice ?? last;

  const tsRaw = d?.ts ?? wrapper?.ts;
  const providerRaw = d?.provider ?? wrapper?.provider;
  const warnRaw = wrapper?.warn ?? d?.warn;

  return {
    ok: wrapper?.ok ?? true,
    ts: typeof tsRaw === "string" ? String(tsRaw) : "",
    provider: typeof providerRaw === "string" ? String(providerRaw) : "",
    warn: typeof warnRaw === "string" ? String(warnRaw) : "",
    symbol: sym,
    asset,
    price,
    bid,
    ask,
    mid,
    last,
  };
}

function sideBtnCls(side: Side, active: boolean) {
  const base = "h-11 rounded-2xl border text-sm font-semibold transition-colors select-none";
  const act = active ? "opacity-100" : "opacity-80 hover:opacity-100";

  if (side === "BUY") {
    return cn(
      base,
      act,
      active
        ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-100"
        : "border-emerald-500/25 bg-black/20 text-emerald-200"
    );
  }
  if (side === "SELL") {
    return cn(
      base,
      act,
      active
        ? "border-rose-500/40 bg-rose-500/20 text-rose-100"
        : "border-rose-500/25 bg-black/20 text-rose-200"
    );
  }
  return cn(
    base,
    act,
    active ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-black/20 text-white/70"
  );
}

function pillCls() {
  return "inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70";
}

function fieldCls() {
  return "h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white/85 outline-none focus:ring-2 focus:ring-white/10";
}

export default function TraderCard({ symbol, asset }: { symbol: string; asset: AssetType }) {
  const sym = useMemo(() => normalizeSymbol(asset, symbol), [asset, symbol]);
  const lsKey = useMemo(() => `imynted_trader_${asset}_${sym}`, [asset, sym]);

  // keep the latest sym/asset for stable event listeners
  const symRef = useRef(sym);
  const assetRef = useRef(asset);
  useEffect(() => {
    symRef.current = sym;
    assetRef.current = asset;
  }, [sym, asset]);

  const [side, setSide] = useState<Side>("BUY");
  const [orderType, setOrderType] = useState<OrderType>("LIMIT");
  const [tif, setTif] = useState<TIF>("DAY");

  const [qty, setQty] = useState<string>(asset === "crypto" ? "0.1" : "100");
  const [limitPx, setLimitPx] = useState<string>("");

  // keep latest limit text for stable listeners (avoid limitPx dependency)
  const limitPxRef = useRef(limitPx);
  useEffect(() => {
    limitPxRef.current = limitPx;
  }, [limitPx]);

  const [quote, setQuote] = useState<{
    ts?: string;
    provider?: string;
    warn?: string;
    price?: number; // resolved display px
    bid?: number;
    ask?: number;
    mid?: number;
    last?: number; // raw last
  }>({});

  const [status, setStatus] = useState<string | null>(null);
  const didHydrate = useRef(false);

  // prevent “seed limit” from re-firing on re-renders while still allowing symbol changes
  const seededRef = useRef<string>("");

  useEffect(() => {
    const saved = lsGet(lsKey, null as any);
    if (saved && typeof saved === "object") {
      if (saved.side) setSide(saved.side);
      if (saved.orderType) setOrderType(saved.orderType);
      if (saved.tif) setTif(saved.tif);
      if (saved.qty !== undefined) setQty(String(saved.qty));
      if (saved.limitPx !== undefined && saved.limitPx !== null) setLimitPx(String(saved.limitPx));
    } else {
      setLimitPx("");
    }

    didHydrate.current = true;
    seededRef.current = "";
  }, [lsKey]);

  useEffect(() => {
    if (!didHydrate.current) return;
    lsSet(lsKey, { side, orderType, tif, qty, limitPx });
  }, [lsKey, side, orderType, tif, qty, limitPx]);

  function maybeSeedLimit(q: any, wantSym: string, wantAsset: AssetType) {
    const cur = (limitPxRef.current || "").trim();
    if (cur) return;
    if (seededRef.current === wantSym) return;

    const seed = q.mid ?? q.price ?? q.bid ?? q.ask ?? q.last;
    if (seed === undefined) return;

    const dd = decFor(wantAsset, seed);
    setLimitPx(Number(seed).toFixed(dd));
    seededRef.current = wantSym;
  }

  /* =========================
   * Quote bus only (authoritative)
   * ========================= */
  useEffect(() => {
    function onQuote(ev: any) {
      const d: CanonQuote = ev?.detail || {};
      const esymRaw = String(d?.symbol || "").toUpperCase().trim();
      const easset = (d?.asset === "crypto" ? "crypto" : "stock") as AssetType;
      if (!esymRaw) return;

      if (easset !== assetRef.current) return;

      const wantSym = symRef.current;
      const gotSym = normalizeSymbol(assetRef.current, esymRaw);
      if (gotSym !== wantSym) return;

      const j = {
        ok: true,
        ts: d.ts,
        provider: d.provider,
        warn: d.warn,
        symbol: gotSym,
        asset: easset,
        bid: d.bid,
        ask: d.ask,
        mid: d.mid,
        price: d.price,
        last: d.last,
      };

      const q = unwrapQuote(j, wantSym, assetRef.current);
      setQuote(q);
      maybeSeedLimit(q, wantSym, assetRef.current);
    }

    window.addEventListener("imynted:quote", onQuote as any);
    window.addEventListener("imynted:quoteUpdate", onQuote as any);
    window.addEventListener("msa:quote", onQuote as any);
    return () => {
      window.removeEventListener("imynted:quote", onQuote as any);
      window.removeEventListener("imynted:quoteUpdate", onQuote as any);
      window.removeEventListener("msa:quote", onQuote as any);
    };
  }, []);

  const bid = n(quote.bid);
  const ask = n(quote.ask);

  // mid from L2 when possible
  const mid = computeMid(bid, ask) ?? n(quote.mid);

  // raw last trade
  const lastTrade = n(quote.last);

  // canonical display px (resolved in unwrapQuote)
  const px = n(quote.price);

  const spr = bid !== undefined && ask !== undefined ? Math.max(0, ask - bid) : undefined;

  const qtyNum = clampNum(n(qty) ?? 0, 0, 1_000_000_000);
  const pxNum = n(limitPx);

  const estNotional = useMemo(() => {
    const chosen = orderType === "MARKET" ? mid ?? px ?? lastTrade ?? 0 : pxNum ?? 0;
    if (!chosen || !qtyNum) return 0;
    return chosen * qtyNum;
  }, [orderType, mid, px, lastTrade, pxNum, qtyNum]);

  function bumpLimit(to: "bid" | "ask" | "mid" | "last" | "px") {
    const v =
      to === "bid" ? bid :
      to === "ask" ? ask :
      to === "mid" ? mid :
      to === "px" ? px :
      lastTrade;

    if (v !== undefined) {
      const d = decFor(asset, v);
      setLimitPx(Number(v).toFixed(d));
      seededRef.current = sym;
    }
  }

  function emitTicket(forceSide: Side) {
    setStatus(null);

    if (forceSide === "FLAT") {
      setStatus("FLAT queued (sim).");
      return;
    }

    if (!qtyNum || qtyNum <= 0) {
      setStatus("Enter a valid quantity.");
      return;
    }

    if (orderType === "LIMIT" && (pxNum === undefined || pxNum <= 0)) {
      setStatus("Enter a valid limit price.");
      return;
    }

    const payload = {
      ts: new Date().toISOString(),
      side: forceSide,
      asset,
      symbol: sym,
      orderType,
      qty: Number(qtyNum),
      limit: orderType === "LIMIT" ? Number(pxNum) : undefined,
      tif,
      quote: {
        mid,
        bid,
        ask,
        px,        // resolved display price
        last: lastTrade, // raw last trade
        provider: quote.provider,
        ts: quote.ts,
        warn: quote.warn,
      },
      paper: true,
    };

    try {
      window.dispatchEvent(new CustomEvent("imynted:orderTicketSubmit", { detail: payload }));
    } catch {}

    const pxLabel = orderType === "MARKET" ? "MKT" : `LMT ${pxNum !== undefined ? fmtPx(pxNum, asset) : "—"}`;
    setStatus(`${forceSide} ${qtyNum} ${sym} @ ${pxLabel} • ${tif} (sim)`);
  }

  const timeLabel =
    quote.ts
      ? (() => {
          const d = new Date(quote.ts);
          if (Number.isNaN(d.getTime())) return "";
          return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        })()
      : "";

  return (
    <div className="h-full min-h-0 p-3 flex flex-col gap-3">
      {/* Top line */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={pillCls()}>
          SYM <span className="font-semibold text-white/85">{sym}</span>
        </span>

        <span className={pillCls()}>
          bid <span className="font-semibold text-emerald-200">{fmtPx(bid, asset)}</span>
        </span>
        <span className={pillCls()}>
          ask <span className="font-semibold text-rose-200">{fmtPx(ask, asset)}</span>
        </span>
        <span className={pillCls()}>
          spr <span className="font-semibold text-white/75">{fmtPx(spr, asset)}</span>
        </span>
        <span className={pillCls()}>
          mid <span className="font-semibold text-white/85">{fmtPx(mid, asset)}</span>
        </span>
        <span className={pillCls()}>
          last <span className="font-semibold text-white/85">{fmtPx(lastTrade, asset)}</span>
        </span>
        <span className={pillCls()}>
          px <span className="font-semibold text-white/95">{fmtPx(px, asset)}</span>
        </span>

        <span className="ml-auto text-[11px] text-white/40">
          {timeLabel}
          {quote.provider ? ` • ${quote.provider}` : ""}
          {quote.warn ? ` • ${quote.warn}` : ""}
        </span>
      </div>

      {/* Side */}
      <div className="grid grid-cols-3 gap-2">
        {(["BUY", "SELL", "FLAT"] as Side[]).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={sideBtnCls(s, side === s)}
            type="button"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Order type + TIF */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] text-white/55 mb-2">ORDER TYPE</div>
          <div className="flex gap-2">
            {(["MARKET", "LIMIT"] as OrderType[]).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={cn(
                  "h-9 flex-1 rounded-xl border border-white/10 text-xs font-semibold",
                  orderType === t ? "bg-white/10 text-white" : "bg-black/25 text-white/70 hover:bg-white/10"
                )}
                type="button"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] text-white/55 mb-2">TIF</div>
          <select
            value={tif}
            onChange={(e) => setTif(e.target.value as TIF)}
            className="h-9 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-xs text-white/85 outline-none focus:ring-2 focus:ring-white/10"
          >
            {(["DAY", "GTC", "IOC", "FOK"] as TIF[]).map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Qty + Limit */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] text-white/55 mb-2">QTY</div>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="decimal"
            className={fieldCls()}
            placeholder={asset === "crypto" ? "0.10" : "100"}
          />
        </div>

        <div className={cn("rounded-2xl border border-white/10 bg-black/25 p-3", orderType === "MARKET" && "opacity-70")}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] text-white/55">LIMIT</div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => bumpLimit("bid")}
                className="h-7 rounded-lg border border-white/10 bg-black/30 px-2 text-[11px] text-white/80 hover:bg-white/10"
              >
                BID
              </button>
              <button
                type="button"
                onClick={() => bumpLimit("mid")}
                className="h-7 rounded-lg border border-white/10 bg-black/30 px-2 text-[11px] text-white/80 hover:bg-white/10"
              >
                MID
              </button>
              <button
                type="button"
                onClick={() => bumpLimit("ask")}
                className="h-7 rounded-lg border border-white/10 bg-black/30 px-2 text-[11px] text-white/80 hover:bg-white/10"
              >
                ASK
              </button>
              <button
                type="button"
                onClick={() => bumpLimit("last")}
                className="h-7 rounded-lg border border-white/10 bg-black/30 px-2 text-[11px] text-white/80 hover:bg-white/10"
              >
                LAST
              </button>
            </div>
          </div>

          <input
            value={limitPx}
            onChange={(e) => setLimitPx(e.target.value)}
            inputMode="decimal"
            disabled={orderType === "MARKET"}
            className={cn(fieldCls(), "disabled:opacity-60")}
            placeholder={mid !== undefined ? String(mid) : "—"}
          />
        </div>
      </div>

      {/* Est notional */}
      <div className="rounded-2xl border border-white/10 bg-black/25 p-3 flex items-center justify-between">
        <div className="text-[11px] text-white/55">EST NOTIONAL</div>
        <div className="text-sm font-semibold text-white/85 tabular-nums">
          {estNotional ? estNotional.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={() => emitTicket(side)}
        className={cn(
          "h-12 rounded-2xl border border-white/10 font-semibold transition-opacity",
          side === "BUY" && "bg-emerald-500/20 text-emerald-100 hover:opacity-95",
          side === "SELL" && "bg-rose-500/20 text-rose-100 hover:opacity-95",
          side === "FLAT" && "bg-white/10 text-white/85 hover:opacity-95"
        )}
        type="button"
      >
        {side === "FLAT" ? "FLAT (Sim)" : `${side} (Sim)`}
      </button>

      {status ? <div className="text-sm text-white/80">{status}</div> : null}
    </div>
  );
}