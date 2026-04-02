// app/components/TraderPanel.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type AssetType = "stock" | "crypto";
type TradeAction = "BUY" | "SELL" | "FLAT";
type OrderType = "MARKET" | "LIMIT";
type TIF = "DAY" | "GTC" | "IOC";
type Session = "RTH" | "EXT" | "OVERNIGHT" | "24H";

type Ticket = {
  side: TradeAction;
  asset: AssetType;
  symbol: string;
  orderType: OrderType;
  qty: string;
  limit: string;
  tif: TIF;
  session: Session;
  takeProfit: boolean;
  stopLoss: boolean;
  tp: string;
  sl: string;
};

type QuoteMini = {
  mid?: number;
  bid?: number;
  ask?: number;
  last?: number;
  price?: number;
  ts?: string;
  provider?: string;
  warn?: string;
};

/* ── helpers ──────────────────────────────────────────────────────── */

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function normSym(raw: string) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.\-]/g, "");
}

function isCryptoBase(raw: string) {
  const s = (raw || "").toUpperCase().trim();
  if (!s) return false;
  if (s.includes("-USD")) return true;
  return ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "BNB", "MATIC"].includes(s);
}

function normalizeCryptoSymbol(raw: string) {
  const s = normSym(raw);
  if (!s) return "BTC-USD";
  if (s.includes("-")) return s;
  if (s.endsWith("USD")) return s.replace(/USD$/, "-USD");
  if (isCryptoBase(s)) return `${s}-USD`;
  return "BTC-USD";
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

function normalizeSymbol(asset: AssetType, raw: string) {
  return asset === "crypto" ? normalizeCryptoSymbol(raw) : normalizeStockSymbol(raw);
}

function toNum(x: any): number | undefined {
  if (x === null || x === undefined) return undefined;
  const v = typeof x === "number" ? x : Number(String(x).replace(/,/g, "").trim());
  return Number.isFinite(v) ? v : undefined;
}

function decFor(asset: AssetType, px: number) {
  if (asset === "stock") return px >= 1 ? 2 : 4;
  if (px >= 100) return 2;
  if (px >= 1) return 4;
  return 6;
}

function fmtPx(px?: number, asset: AssetType = "stock") {
  if (!Number.isFinite(px)) return "—";
  const v = Number(px);
  return v.toFixed(decFor(asset, v));
}

function tickFor(asset: AssetType, px: number) {
  if (!Number.isFinite(px) || px <= 0) return 0.01;
  if (asset === "stock") return px >= 1 ? 0.01 : 0.0001;
  if (px >= 100) return 0.05;
  if (px >= 1) return 0.01;
  if (px >= 0.01) return 0.0001;
  return 0.000001;
}

function safeMid(bid?: number, ask?: number) {
  if (typeof bid !== "number" || typeof ask !== "number") return undefined;
  if (!Number.isFinite(bid) || !Number.isFinite(ask)) return undefined;
  if (bid <= 0 || ask <= 0) return undefined;
  return (bid + ask) / 2;
}

function computeMid(bid?: number, ask?: number) {
  return safeMid(bid, ask);
}

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

function readLastTradeAction():
  | { action: TradeAction; asset: AssetType; symbol: string; ts?: number }
  | null {
  try {
    const raw = localStorage.getItem("imynted_last_trade_action");
    if (!raw) return null;
    const j = JSON.parse(raw);
    const action = String(j?.action || "").toUpperCase() as TradeAction;
    const asset = (j?.asset === "crypto" ? "crypto" : "stock") as AssetType;
    const symbol = String(j?.symbol || "");
    if (!symbol) return null;
    if (action !== "BUY" && action !== "SELL" && action !== "FLAT") return null;
    return { action, asset, symbol, ts: typeof j?.ts === "number" ? j.ts : undefined };
  } catch {
    return null;
  }
}

function writeLastTradeAction(action: TradeAction, asset: AssetType, symbol: string) {
  try {
    localStorage.setItem("imynted_last_trade_action", JSON.stringify({ action, asset, symbol, ts: Date.now() }));
  } catch {}
}

function emitSymbolPick(asset: AssetType, rawSymbol: string) {
  const symbol = normalizeSymbol(asset, rawSymbol);
  if (!symbol) return;

  const detail = { asset, symbol, sym: symbol };

  try {
    window.dispatchEvent(new CustomEvent("imynted:symbolPick", { detail }));
  } catch {}

  try {
    window.dispatchEvent(new CustomEvent("imynted:symbol", { detail }));
  } catch {}
}

const SESSION_LABELS: Record<Session, string> = {
  RTH: "Regular Trading Hours",
  EXT: "RTH + Pre/Post-Mkt",
  OVERNIGHT: "Overnight Trading",
  "24H": "24 Hour Trading",
};

/* ── component ───────────────────────────────────────────────────── */

export default function TraderPanel(props: { symbol: string; asset: AssetType }) {
  const propAsset = (props?.asset === "crypto" ? "crypto" : "stock") as AssetType;

  const propSym = useMemo(() => {
    return normalizeSymbol(propAsset, props?.symbol);
  }, [propAsset, props?.symbol]);

  const [ticket, setTicket] = useState<Ticket>(() => ({
    side: "FLAT",
    asset: propAsset,
    symbol: propSym || (propAsset === "crypto" ? "BTC-USD" : "AAPL"),
    orderType: "MARKET",
    qty: propAsset === "crypto" ? "0.1" : "10",
    limit: "",
    tif: "DAY",
    session: "RTH",
    takeProfit: false,
    stopLoss: false,
    tp: "",
    sl: "",
  }));

  const [quote, setQuote] = useState<QuoteMini>({});
  const [err, setErr] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  const [lastOkAt, setLastOkAt] = useState<number>(0);
  const lastOkAtRef = useRef<number>(0);

  useEffect(() => {
    lastOkAtRef.current = lastOkAt;
  }, [lastOkAt]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    setTicket((t) => {
      const nextAsset = propAsset;
      const nextSymbol = propSym || (nextAsset === "crypto" ? "BTC-USD" : "AAPL");
      const switchingAsset = t.asset !== nextAsset;
      const switchingSymbol = t.symbol !== nextSymbol;

      return {
        ...t,
        asset: nextAsset,
        symbol: nextSymbol,
        qty: switchingAsset ? (nextAsset === "crypto" ? "0.1" : "10") : t.qty,
        limit: switchingAsset || (switchingSymbol && t.orderType === "MARKET") ? "" : t.limit,
      };
    });
  }, [propAsset, propSym]);

  const sym = useMemo(() => {
    return normalizeSymbol(ticket.asset, ticket.symbol);
  }, [ticket.asset, ticket.symbol]);

  const symRef = useRef(sym);
  const assetRef = useRef<AssetType>(ticket.asset);

  useEffect(() => {
    symRef.current = sym;
    assetRef.current = ticket.asset;
  }, [sym, ticket.asset]);

  useEffect(() => {
    const last = readLastTradeAction();
    if (!last) return;

    const ts = typeof last.ts === "number" ? last.ts : 0;
    const RECENT_MS = 90_000;
    if (!ts || Date.now() - ts > RECENT_MS) return;

    const lastAsset = last.asset;
    const lastSym = normalizeSymbol(lastAsset, last.symbol);
    const currentSym = propSym || (propAsset === "crypto" ? "BTC-USD" : "AAPL");

    if (lastAsset !== propAsset) return;
    if (lastSym !== currentSym) return;

    setTicket((t) => ({
      ...t,
      side: last.action,
      orderType: last.action === "FLAT" ? t.orderType : "MARKET",
      limit: last.action === "FLAT" ? t.limit : "",
    }));
  }, [propAsset, propSym]);

  useEffect(() => {
    function onTradeAction(e: Event) {
      const d = (e as CustomEvent).detail || {};
      const action = (d.action as TradeAction | undefined) || undefined;
      const a = (d.asset === "crypto" ? "crypto" : "stock") as AssetType;
      const s = String(d.symbol || d.sym || "").toUpperCase().trim();

      if (!action || !s) return;

      setTicket((t) => {
        const nextSym = normalizeSymbol(a, s);
        const switchingAsset = t.asset !== a;
        return {
          ...t,
          side: action,
          asset: a,
          symbol: nextSym || t.symbol,
          orderType: action === "FLAT" ? t.orderType : "MARKET",
          qty: switchingAsset ? (a === "crypto" ? "0.1" : "10") : t.qty,
          limit: action === "FLAT" ? t.limit : "",
        };
      });

      writeLastTradeAction(action, a, s);
    }

    window.addEventListener("imynted:tradeAction", onTradeAction as EventListener);
    window.addEventListener("imynted:trade", onTradeAction as EventListener);

    return () => {
      window.removeEventListener("imynted:tradeAction", onTradeAction as EventListener);
      window.removeEventListener("imynted:trade", onTradeAction as EventListener);
    };
  }, []);

  useEffect(() => {
    function onQuote(ev: Event) {
      const d = (ev as CustomEvent).detail || {};
      const esymRaw = String(d.symbol || "").toUpperCase().trim();
      const easset = (d.asset === "crypto" ? "crypto" : "stock") as AssetType;

      if (!esymRaw) return;
      if (easset !== assetRef.current) return;

      const esym = normalizeSymbol(easset, esymRaw);
      if (esym !== symRef.current) return;

      const bid = toNum(d.bid);
      const ask = toNum(d.ask);
      const midFromBus = toNum(d.mid);
      const lastFromBus = toNum(d.last);
      const priceFromBus = toNum(d.price);

      const computedMid = computeMid(bid, ask);
      const resolved = computedMid ?? midFromBus ?? priceFromBus ?? lastFromBus;
      const last = lastFromBus ?? resolved;

      setErr("");
      const tsNow = Date.now();
      setLastOkAt(tsNow);
      setQuote({
        bid,
        ask,
        mid: computedMid ?? midFromBus,
        last,
        price: resolved,
        ts: typeof d.ts === "string" ? d.ts : "",
        provider: typeof d.provider === "string" ? d.provider : "",
        warn: typeof d.warn === "string" ? d.warn : "",
      });
    }

    window.addEventListener("imynted:quote", onQuote as EventListener);
    window.addEventListener("imynted:quoteUpdate", onQuote as EventListener);
    window.addEventListener("msa:quote", onQuote as EventListener);

    return () => {
      window.removeEventListener("imynted:quote", onQuote as EventListener);
      window.removeEventListener("imynted:quoteUpdate", onQuote as EventListener);
      window.removeEventListener("msa:quote", onQuote as EventListener);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;

    async function fetchQuoteOnce() {
      const okAt = lastOkAtRef.current;
      const recentlyOk = okAt && Date.now() - okAt < 3500;
      if (recentlyOk) return;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const url = `/api/market/quote?symbol=${encodeURIComponent(symRef.current)}&asset=${encodeURIComponent(assetRef.current)}`;
        const res = await fetch(url, { cache: "no-store", signal: ac.signal });
        if (!res.ok) throw new Error(`quote HTTP ${res.status}`);

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) throw new Error("Non-JSON response");

        const j: any = await res.json().catch(() => ({}));
        const { root, data } = unwrapPayload(j);

        if (root?.ok === false) {
          const msg = String(root?.error || root?.warn || root?.warning || "quote failed");
          throw new Error(msg);
        }

        const bid = toNum(data?.bid ?? data?.b);
        const ask = toNum(data?.ask ?? data?.a);
        const computedMid = computeMid(bid, ask);
        const midFromFeed = toNum(data?.mid ?? data?.m ?? data?.midpoint);
        const explicitPrice = toNum(data?.price);
        const lastFromApi = toNum(data?.last ?? data?.px ?? data?.c);

        const resolved = computedMid ?? midFromFeed ?? explicitPrice ?? lastFromApi;
        const last = lastFromApi ?? resolved;

        if (!alive) return;

        setErr("");
        const tsNow = Date.now();
        setLastOkAt(tsNow);
        setQuote({
          bid,
          ask,
          last,
          mid: computedMid ?? midFromFeed,
          price: resolved,
          ts: typeof (data?.ts ?? root?.ts) === "string" ? String(data?.ts ?? root?.ts) : "",
          provider:
            typeof (root?.provider ?? data?.provider) === "string"
              ? String(root?.provider ?? data?.provider)
              : "",
          warn: typeof (root?.warn ?? data?.warn) === "string" ? String(root?.warn ?? data?.warn) : "",
        });
      } catch (e: any) {
        if (!alive) return;
        if (e?.name === "AbortError") return;
        setErr(e?.message ? String(e.message) : "quote fetch failed");
      }
    }

    fetchQuoteOnce();
    timer = window.setInterval(fetchQuoteOnce, 2500) as unknown as number;

    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
      abortRef.current?.abort();
    };
  }, []);

  const stale = useMemo(() => {
    if (!lastOkAt) return false;
    return now - lastOkAt > 8000;
  }, [now, lastOkAt]);

  const limitNum = useMemo(() => toNum(ticket.limit), [ticket.limit]);
  const qtyNum = useMemo(() => toNum(ticket.qty), [ticket.qty]);

  const canSubmit = useMemo(() => {
    if (!sym) return false;
    if (!qtyNum || qtyNum <= 0) return false;
    if (ticket.orderType === "LIMIT" && (!limitNum || limitNum <= 0)) return false;
    return true;
  }, [sym, qtyNum, ticket.orderType, limitNum]);

  function seedLimitFrom(px?: number) {
    if (!Number.isFinite(px)) return "";
    const d = decFor(ticket.asset, Number(px));
    return Number(px).toFixed(d);
  }

  function applyLimit(px?: number) {
    if (!Number.isFinite(px)) return;
    setTicket((t) => ({ ...t, orderType: "LIMIT", limit: seedLimitFrom(px) }));
  }

  function bumpLimit(dir: -1 | 1) {
    const anchor =
      Number.isFinite(limitNum)
        ? (limitNum as number)
        : Number.isFinite(quote.mid)
          ? (quote.mid as number)
          : Number.isFinite(quote.price)
            ? (quote.price as number)
            : undefined;

    if (!Number.isFinite(anchor)) return;

    const tk = tickFor(ticket.asset, anchor as number);
    const next = (anchor as number) + dir * tk;

    setTicket((t) => ({ ...t, orderType: "LIMIT", limit: seedLimitFrom(next) }));
  }

  function bumpQty(dir: -1 | 1) {
    const base = qtyNum ?? 0;
    const step = ticket.asset === "crypto" ? 0.1 : 1;
    const next = Math.max(step, base + dir * step);
    const keepDec = ticket.asset === "crypto" || String(ticket.qty).includes(".");
    const out = keepDec ? String(Number(next.toFixed(6))) : String(Math.round(next));
    setTicket((t) => ({ ...t, qty: out }));
  }

  function setQtyScaled(mult: number) {
    const base = qtyNum;
    if (!base || base <= 0) return;
    const next = base * mult;
    const keepDec = ticket.asset === "crypto" || String(ticket.qty).includes(".");
    const out = keepDec ? String(Number(next.toFixed(6))) : String(Math.max(1, Math.round(next)));
    setTicket((t) => ({ ...t, qty: out }));
  }

  function flatten() {
    setTicket((t) => ({ ...t, side: "FLAT" }));
    writeLastTradeAction("FLAT", ticket.asset, sym);
  }

  function submit(forceSide: TradeAction) {
    if (!canSubmit) return;
    if (forceSide === "FLAT") return;

    const payload = {
      ts: new Date().toISOString(),
      side: forceSide,
      asset: ticket.asset,
      symbol: sym,
      orderType: ticket.orderType,
      qty: Number(qtyNum),
      limit: ticket.orderType === "LIMIT" ? Number(limitNum) : undefined,
      tif: ticket.tif,
      session: ticket.session,
      takeProfit: ticket.takeProfit ? toNum(ticket.tp) : undefined,
      stopLoss: ticket.stopLoss ? toNum(ticket.sl) : undefined,
      quote: {
        price: quote.price,
        mid: quote.mid,
        bid: quote.bid,
        ask: quote.ask,
        last: quote.last,
        provider: quote.provider,
        ts: quote.ts,
        warn: quote.warn,
      },
      paper: true,
    };

    writeLastTradeAction(forceSide, ticket.asset, sym);

    try {
      window.dispatchEvent(new CustomEvent("imynted:orderTicketSubmit", { detail: payload }));
    } catch {}

    setTicket((t) => ({ ...t, side: "FLAT" }));
  }

  /* ── derived ───────────────────────────────────────────────────── */
  const isMkt = ticket.orderType === "MARKET";
  const isStock = ticket.asset === "stock";
  const spread = (quote.ask && quote.bid) ? (quote.ask - quote.bid) : undefined;
  const amount = (qtyNum && quote.price) ? qtyNum * quote.price : undefined;

  /* ── iMYNTED design tokens ─────────────────────────────────────── */
  // Navy tints from PanelCard gradient: rgba(5,11,20) → rgba(2,7,14)
  // Accent: cyan-400 (resize handles, interactive highlights)
  // Borders: white/10 universal, white/[0.06] dividers
  const labelCls = "text-[11px] text-white/40 w-[72px] shrink-0 font-medium tracking-wide";
  const fieldCls =
    "flex-1 h-8 bg-[rgba(4,10,18,0.7)] rounded-lg text-[12px] text-white/90 outline-none " +
    "border border-white/[0.08] focus:border-cyan-400/30 tabular-nums " +
    "placeholder:text-white/20 transition-colors";
  const selectCls =
    "flex-1 h-8 bg-[rgba(4,10,18,0.7)] rounded-lg text-[12px] text-white/90 outline-none " +
    "border border-white/[0.08] focus:border-cyan-400/30 " +
    "cursor-pointer transition-colors appearance-none";
  const stepBtn =
    "h-8 w-8 rounded-lg border border-white/[0.08] bg-[rgba(4,10,18,0.6)] " +
    "text-white/40 hover:bg-cyan-400/10 hover:border-cyan-400/20 hover:text-cyan-300/80 " +
    "transition-colors cursor-pointer flex items-center justify-center text-sm select-none";
  const quickBtn =
    "h-6 px-1.5 rounded text-[9px] text-white/30 " +
    "hover:text-cyan-300/80 hover:bg-cyan-400/10 transition-colors cursor-pointer";

  return (
    <div className="flex flex-col h-full bg-transparent overflow-y-auto">
      {/* Error bar */}
      {err && (
        <div className="px-4 py-1.5 text-[10px] text-rose-300 bg-rose-500/[0.06] border-b border-rose-500/10">
          {err}
        </div>
      )}

      {/* ── Form ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5 px-4 py-3">

        {/* Symbol */}
        <div className="flex items-center gap-2">
          <span className={labelCls}>Symbol</span>
          <div className="flex-1 flex items-center gap-1.5">
            <input
              className={cn(fieldCls, "px-2.5 font-bold text-white uppercase tracking-wide")}
              value={ticket.symbol}
              onChange={(e) => setTicket((t) => ({ ...t, symbol: e.target.value }))}
              onBlur={() => {
                const normalized = normalizeSymbol(ticket.asset, ticket.symbol);
                setTicket((t) => ({ ...t, symbol: normalized }));
                emitSymbolPick(ticket.asset, normalized);
              }}
              placeholder="Enter symbol"
            />
            <button
              type="button"
              className={cn(
                "shrink-0 h-8 px-2.5 rounded-lg border text-[10px] font-bold tracking-wide transition-colors cursor-pointer",
                isStock
                  ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/15"
                  : "border-amber-400/25 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15"
              )}
              title={isStock ? "Switch to Crypto" : "Switch to Stock"}
              onClick={() => {
                if (isStock) {
                  const nextSym = normalizeCryptoSymbol(ticket.symbol || "BTC-USD");
                  setTicket((t) => ({ ...t, asset: "crypto", symbol: nextSym, limit: "", qty: "0.1" }));
                  emitSymbolPick("crypto", nextSym);
                } else {
                  const nextSym = normalizeStockSymbol(ticket.symbol) || "AAPL";
                  setTicket((t) => ({ ...t, asset: "stock", symbol: nextSym, limit: "", qty: "10" }));
                  emitSymbolPick("stock", nextSym);
                }
              }}
            >
              {isStock ? "STK" : "CRY"}
            </button>
          </div>
        </div>

        {/* Session */}
        {isStock && (
          <div className="flex items-center gap-2">
            <span className={labelCls}>Session</span>
            <select
              value={ticket.session}
              onChange={(e) => setTicket((t) => ({ ...t, session: e.target.value as Session }))}
              className={cn(selectCls, "px-2.5")}
            >
              {(Object.keys(SESSION_LABELS) as Session[]).map((k) => (
                <option key={k} value={k}>{SESSION_LABELS[k]}</option>
              ))}
            </select>
          </div>
        )}

        {/* Order Type */}
        <div className="flex items-center gap-2">
          <span className={labelCls}>Order Type</span>
          <select
            value={ticket.orderType}
            onChange={(e) => {
              const ot = e.target.value as OrderType;
              setTicket((t) => ({
                ...t,
                orderType: ot,
                limit: ot === "LIMIT" && !t.limit
                  ? seedLimitFrom(quote.mid ?? quote.price ?? quote.last)
                  : t.limit,
              }));
            }}
            className={cn(selectCls, "px-2.5")}
          >
            <option value="LIMIT">Limit</option>
            <option value="MARKET">Market</option>
          </select>
        </div>

        {/* Price (limit) */}
        <div className={cn("flex items-center gap-2", isMkt && "opacity-30 pointer-events-none")}>
          <span className={labelCls}>Price</span>
          <button type="button" className={stepBtn} onClick={() => bumpLimit(-1)}>−</button>
          <input
            className={cn(fieldCls, "px-2.5 text-center tabular-nums")}
            value={ticket.limit}
            onChange={(e) => setTicket((t) => ({ ...t, limit: e.target.value }))}
            inputMode="decimal"
            placeholder={fmtPx(quote.mid, ticket.asset)}
            disabled={isMkt}
          />
          <button type="button" className={stepBtn} onClick={() => bumpLimit(+1)}>+</button>
          {/* Quick-set */}
          <div className="flex gap-1 shrink-0">
            <button type="button" className={quickBtn} onClick={() => applyLimit(quote.bid)} title="Set to Bid">B</button>
            <button type="button" className={quickBtn} onClick={() => applyLimit(quote.mid)} title="Set to Mid">M</button>
            <button type="button" className={quickBtn} onClick={() => applyLimit(quote.ask)} title="Set to Ask">A</button>
          </div>
        </div>

        {/* Quantity */}
        <div className="flex items-center gap-2">
          <span className={labelCls}>Quantity</span>
          <button type="button" className={stepBtn} onClick={() => bumpQty(-1)}>−</button>
          <input
            className={cn(fieldCls, "px-2.5 text-center tabular-nums")}
            value={ticket.qty}
            onChange={(e) => setTicket((t) => ({ ...t, qty: e.target.value }))}
            inputMode="decimal"
            placeholder="Qty"
          />
          <button type="button" className={stepBtn} onClick={() => bumpQty(+1)}>+</button>
          {/* Qty scale */}
          <div className="flex gap-1 shrink-0">
            <button type="button" className={quickBtn} onClick={() => setQtyScaled(0.25)}>¼</button>
            <button type="button" className={quickBtn} onClick={() => setQtyScaled(0.5)}>½</button>
            <button type="button" className={quickBtn} onClick={() => setQtyScaled(2)}>2×</button>
          </div>
        </div>

        {/* Time-in-Force */}
        <div className="flex items-center gap-2">
          <span className={labelCls}>TIF</span>
          <select
            value={ticket.tif}
            onChange={(e) => setTicket((t) => ({ ...t, tif: e.target.value as TIF }))}
            className={cn(selectCls, "px-2.5")}
          >
            <option value="DAY">Day</option>
            <option value="GTC">GTC</option>
            <option value="IOC">IOC</option>
          </select>
        </div>

        {/* Take Profit / Stop Loss */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ticket.takeProfit}
              onChange={(e) => setTicket((t) => ({ ...t, takeProfit: e.target.checked }))}
              className="w-3.5 h-3.5 rounded border-white/[0.08] bg-[rgba(4,10,18,0.8)] accent-emerald-400"
            />
            <span className="text-[11px] text-white/50">Take Profit</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ticket.stopLoss}
              onChange={(e) => setTicket((t) => ({ ...t, stopLoss: e.target.checked }))}
              className="w-3.5 h-3.5 rounded border-white/[0.08] bg-[rgba(4,10,18,0.8)] accent-rose-400"
            />
            <span className="text-[11px] text-white/50">Stop Loss</span>
          </label>
        </div>

        {/* TP / SL inputs (conditional) */}
        {(ticket.takeProfit || ticket.stopLoss) && (
          <div className="flex items-center gap-2">
            {ticket.takeProfit && (
              <div className="flex-1 flex items-center gap-1.5">
                <span className="text-[10px] text-emerald-400/50 w-6 shrink-0 font-medium">TP</span>
                <input
                  className={cn(fieldCls, "px-2 text-center text-emerald-300/90 h-7 text-[11px]")}
                  value={ticket.tp}
                  onChange={(e) => setTicket((t) => ({ ...t, tp: e.target.value }))}
                  inputMode="decimal"
                  placeholder={fmtPx(quote.ask, ticket.asset)}
                />
              </div>
            )}
            {ticket.stopLoss && (
              <div className="flex-1 flex items-center gap-1.5">
                <span className="text-[10px] text-rose-400/50 w-6 shrink-0 font-medium">SL</span>
                <input
                  className={cn(fieldCls, "px-2 text-center text-rose-300/90 h-7 text-[11px]")}
                  value={ticket.sl}
                  onChange={(e) => setTicket((t) => ({ ...t, sl: e.target.value }))}
                  inputMode="decimal"
                  placeholder={fmtPx(quote.bid, ticket.asset)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Quote & Amount summary ────────────────────────────── */}
      <div className="mx-4 rounded-lg border border-white/[0.06] bg-[rgba(4,10,18,0.4)] px-3 py-2">
        <div className="flex items-center justify-between text-[10px] tabular-nums">
          <span className="text-white/30">Bid</span>
          <span className="text-emerald-400/80 font-medium">{fmtPx(quote.bid, ticket.asset)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] tabular-nums mt-0.5">
          <span className="text-white/30">Ask</span>
          <span className="text-rose-400/80 font-medium">{fmtPx(quote.ask, ticket.asset)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] tabular-nums mt-0.5">
          <span className="text-white/30">Spread</span>
          <span className="text-white/45 font-medium">
            {spread !== undefined ? fmtPx(spread, ticket.asset) : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] tabular-nums mt-1.5 pt-1.5 border-t border-white/[0.06]">
          <span className="text-white/30">Amount</span>
          <span className="text-cyan-300/70 font-semibold">
            {amount !== undefined ? `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
          </span>
        </div>
        {stale && (
          <div className="text-[9px] text-amber-400/40 mt-1">Quote data is stale</div>
        )}
      </div>

      {/* ── Spacer ────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Action buttons ────────────────────────────────────── */}
      <div className="px-4 pb-3 pt-2 flex flex-col gap-2">
        <div className="flex gap-2">
          {/* BUY — iMYNTED ghost pill style */}
          <button
            type="button"
            onClick={() => submit("BUY")}
            disabled={!canSubmit}
            className={cn(
              "flex-1 h-9 rounded-lg border text-[13px] font-bold tracking-wide transition-all cursor-pointer",
              "border-emerald-500/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 active:bg-emerald-500/30",
              !canSubmit && "cursor-not-allowed opacity-30"
            )}
          >
            Buy
          </button>

          {/* SELL — iMYNTED ghost pill style */}
          <button
            type="button"
            onClick={() => submit("SELL")}
            disabled={!canSubmit}
            className={cn(
              "flex-1 h-9 rounded-lg border text-[13px] font-bold tracking-wide transition-all cursor-pointer",
              "border-rose-500/30 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 active:bg-rose-500/30",
              !canSubmit && "cursor-not-allowed opacity-30"
            )}
          >
            Sell
          </button>
        </div>

        {/* FLAT */}
        <button
          type="button"
          className={cn(
            "h-7 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer",
            "border-white/[0.08] bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/70"
          )}
          onClick={flatten}
        >
          Flatten Position
        </button>
      </div>
    </div>
  );
}