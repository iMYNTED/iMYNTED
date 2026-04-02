// app/components/TraderPanelV2.tsx
// Compact two-row execution bar — Moomoo speed + Bloomberg density
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AssetType = "stock" | "crypto" | "futures";
type TradeAction = "BUY" | "SELL" | "FLAT";
type OrderType = "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT" | "TRAILING_STOP" | "MOC";
type TIF = "DAY" | "GTC" | "IOC" | "GTD";
type Session = "RTH" | "EXT" | "OVERNIGHT" | "24H";
type TraderMode = "trade" | "book";

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
  stopPrice: string;
  trailAmount: string;
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

const FUTURES_META_TRADER: Record<string, { name: string; tick: number; mult: number; sector: string }> = {
  ES:  { name: "E-mini S&P 500",    tick: 0.25,      mult: 50,    sector: "Equity Index" },
  NQ:  { name: "E-mini Nasdaq-100", tick: 0.25,      mult: 20,    sector: "Equity Index" },
  YM:  { name: "E-mini Dow",        tick: 1,         mult: 5,     sector: "Equity Index" },
  RTY: { name: "E-mini Russell 2K", tick: 0.1,       mult: 50,    sector: "Equity Index" },
  MES: { name: "Micro E-mini S&P",  tick: 0.25,      mult: 5,     sector: "Equity Index" },
  MNQ: { name: "Micro E-mini NQ",   tick: 0.25,      mult: 2,     sector: "Equity Index" },
  MYM: { name: "Micro E-mini Dow",  tick: 1,         mult: 0.5,   sector: "Equity Index" },
  CL:  { name: "Crude Oil WTI",     tick: 0.01,      mult: 1000,  sector: "Energy" },
  NG:  { name: "Natural Gas",       tick: 0.001,     mult: 10000, sector: "Energy" },
  GC:  { name: "Gold",              tick: 0.10,      mult: 100,   sector: "Metals" },
  SI:  { name: "Silver",            tick: 0.005,     mult: 5000,  sector: "Metals" },
  HG:  { name: "Copper",            tick: 0.0005,    mult: 25000, sector: "Metals" },
  ZB:  { name: "30-Year T-Bond",    tick: 0.03125,   mult: 1000,  sector: "Rates" },
  ZN:  { name: "10-Year T-Note",    tick: 0.015625,  mult: 1000,  sector: "Rates" },
  ZC:  { name: "Corn",              tick: 0.25,      mult: 50,    sector: "Ag" },
  ZS:  { name: "Soybeans",          tick: 0.25,      mult: 50,    sector: "Ag" },
  ZW:  { name: "Wheat",             tick: 0.25,      mult: 50,    sector: "Ag" },
  "6E":{ name: "Euro FX",           tick: 0.00005,   mult: 125000,sector: "FX" },
  "6J":{ name: "Japanese Yen",      tick: 0.0000005, mult: 12500000, sector: "FX" },
  "6B":{ name: "British Pound",     tick: 0.0001,    mult: 62500, sector: "FX" },
};

const FUTURES_ROOTS_TRADER = Object.keys(FUTURES_META_TRADER);

function normalizeFuturesSymbolTrader(raw: string): string {
  const s = (raw || "").toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
  const stripped = s.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "");
  if (FUTURES_META_TRADER[stripped]) return stripped;
  if (FUTURES_META_TRADER[s]) return s;
  const match = FUTURES_ROOTS_TRADER.find(r => s.startsWith(r));
  return match ?? s;
}

function isFuturesSymbolTrader(raw: string): boolean {
  return !!FUTURES_META_TRADER[normalizeFuturesSymbolTrader(raw)];
}

const POPULAR_FUTURES = [
  { sym: "ES",  label: "E-mini S&P 500",    sector: "Equity" },
  { sym: "NQ",  label: "E-mini Nasdaq-100", sector: "Equity" },
  { sym: "YM",  label: "E-mini Dow",        sector: "Equity" },
  { sym: "RTY", label: "E-mini Russell 2K", sector: "Equity" },
  { sym: "MES", label: "Micro S&P",         sector: "Equity" },
  { sym: "MNQ", label: "Micro Nasdaq",      sector: "Equity" },
  { sym: "CL",  label: "Crude Oil WTI",     sector: "Energy" },
  { sym: "NG",  label: "Natural Gas",       sector: "Energy" },
  { sym: "GC",  label: "Gold",              sector: "Metals" },
  { sym: "SI",  label: "Silver",            sector: "Metals" },
  { sym: "HG",  label: "Copper",            sector: "Metals" },
  { sym: "ZB",  label: "30-Year T-Bond",    sector: "Rates"  },
  { sym: "ZN",  label: "10-Year T-Note",    sector: "Rates"  },
  { sym: "ZC",  label: "Corn",              sector: "Ag"     },
  { sym: "ZS",  label: "Soybeans",          sector: "Ag"     },
  { sym: "ZW",  label: "Wheat",             sector: "Ag"     },
  { sym: "6E",  label: "Euro FX",           sector: "FX"     },
  { sym: "6J",  label: "Japanese Yen",      sector: "FX"     },
];

function normalizeSymbol(asset: AssetType, raw: string) {
  if (asset === "crypto") return normalizeCryptoSymbol(raw);
  if (asset === "futures") return normalizeFuturesSymbolTrader(raw);
  return normalizeStockSymbol(raw);
}

function toNum(x: any): number | undefined {
  if (x === null || x === undefined) return undefined;
  const v = typeof x === "number" ? x : Number(String(x).replace(/,/g, "").trim());
  return Number.isFinite(v) ? v : undefined;
}

function decFor(asset: AssetType, px: number) {
  if (asset === "futures") {
    if (px >= 1000) return 2;
    if (px >= 10) return 3;
    return 6;
  }
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
  if (asset === "futures") {
    // Per-contract tick — needs symbol context; use price-based fallback here
    if (px >= 10000) return 1;
    if (px >= 1000) return 0.25;
    if (px >= 100) return 0.10;
    if (px >= 10) return 0.01;
    if (px >= 1) return 0.001;
    return 0.00005;
  }
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

const SESSION_TIMES: Record<Session, string> = {
  RTH: "9:30 \u2013 16:00 ET",
  EXT: "4:00 \u2013 20:00 ET",
  OVERNIGHT: "20:00 \u2013 4:00(T+1) ET",
  "24H": "20:00 \u2013 20:00 (T+1) ET",
};

const ORDER_TYPE_BADGES: Record<OrderType, string> = {
  MARKET: "MKT",
  LIMIT: "LMT",
  STOP: "STP",
  STOP_LIMIT: "STL",
  TRAILING_STOP: "TSL",
  MOC: "MOC",
};

const MOCK_POSITION_STATS = { qty: 901, avgCost: 10.754, totalPnl: 2239.35, unrealizedPnl: 2014.41, todayPnl: 216.24 };

/* ── component ───────────────────────────────────────────────────── */

export default function TraderPanel(props: { symbol: string; asset: AssetType; className?: string }) {
  const { className } = props;
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
    stopPrice: "",
    trailAmount: "",
  }));

  const [quote, setQuote] = useState<QuoteMini>({});
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<TraderMode>("trade");
  const [orderConfirm, setOrderConfirm] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [detached, setDetached] = useState(false);
  const [symSearch, setSymSearch] = useState("");
  const [symDropOpen, setSymDropOpen] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState("paper");
  const symInputRef = useRef<HTMLInputElement | null>(null);
  const [dragPos, setDragPos] = useState({ x: 200, y: 100 });
  const dragStartRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  const BROKERS = [
    { id: "paper", name: "Paper Account", cash: "$10,000", color: "emerald" },
    { id: "rh", name: "Robinhood", cash: "—", color: "amber" },
    { id: "etrade", name: "E*Trade", cash: "—", color: "purple" },
    { id: "fidelity", name: "Fidelity", cash: "—", color: "emerald" },
    { id: "webull", name: "Webull", cash: "—", color: "cyan" },
    { id: "moomoo", name: "Moomoo", cash: "—", color: "purple" },
    { id: "ibkr", name: "Interactive Brokers", cash: "—", color: "sky" },
    { id: "schwab", name: "Charles Schwab", cash: "—", color: "amber" },
    { id: "coinbase", name: "Coinbase", cash: "—", color: "orange" },
    { id: "binance", name: "Binance", cash: "—", color: "yellow" },
  ] as const;

  const SYM_LIST: Array<{ sym: string; name: string; asset: "stock" | "crypto" }> = [
    { sym: "AAPL", name: "Apple Inc.", asset: "stock" },
    { sym: "MSFT", name: "Microsoft Corp.", asset: "stock" },
    { sym: "GOOGL", name: "Alphabet Inc.", asset: "stock" },
    { sym: "AMZN", name: "Amazon.com", asset: "stock" },
    { sym: "NVDA", name: "NVIDIA Corp.", asset: "stock" },
    { sym: "TSLA", name: "Tesla Inc.", asset: "stock" },
    { sym: "META", name: "Meta Platforms", asset: "stock" },
    { sym: "JPM", name: "JPMorgan Chase", asset: "stock" },
    { sym: "V", name: "Visa Inc.", asset: "stock" },
    { sym: "UNH", name: "UnitedHealth Group", asset: "stock" },
    { sym: "SPY", name: "SPDR S&P 500 ETF", asset: "stock" },
    { sym: "QQQ", name: "Invesco Nasdaq 100", asset: "stock" },
    { sym: "AMD", name: "AMD Inc.", asset: "stock" },
    { sym: "NFLX", name: "Netflix Inc.", asset: "stock" },
    { sym: "DIS", name: "Walt Disney", asset: "stock" },
    { sym: "BA", name: "Boeing Co.", asset: "stock" },
    { sym: "COIN", name: "Coinbase Global", asset: "stock" },
    { sym: "PLTR", name: "Palantir Technologies", asset: "stock" },
    { sym: "SOFI", name: "SoFi Technologies", asset: "stock" },
    { sym: "NIO", name: "NIO Inc.", asset: "stock" },
    { sym: "BTC-USD", name: "Bitcoin", asset: "crypto" },
    { sym: "ETH-USD", name: "Ethereum", asset: "crypto" },
    { sym: "SOL-USD", name: "Solana", asset: "crypto" },
    { sym: "XRP-USD", name: "Ripple", asset: "crypto" },
    { sym: "DOGE-USD", name: "Dogecoin", asset: "crypto" },
    { sym: "ADA-USD", name: "Cardano", asset: "crypto" },
    { sym: "AVAX-USD", name: "Avalanche", asset: "crypto" },
  ];

  const symSuggestions = useMemo(() => {
    const q = symSearch.toUpperCase().trim();
    if (!q) return SYM_LIST.slice(0, 8);
    return SYM_LIST.filter(s => s.sym.includes(q) || s.name.toUpperCase().includes(q)).slice(0, 8);
  }, [symSearch]);

  function pickSymFromSearch(sym: string, asset: "stock" | "crypto") {
    const a: AssetType = asset;
    const normalized = normalizeSymbol(a, sym);
    setTicket(t => ({ ...t, asset: a, symbol: normalized, limit: "", qty: a === "crypto" ? "0.1" : "10" }));
    emitSymbolPick(a, normalized);
    setSymSearch("");
    setSymDropOpen(false);
  }

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
    const wantsLimit = ticket.orderType === "LIMIT" || ticket.orderType === "STOP_LIMIT";
    if (wantsLimit && (!limitNum || limitNum <= 0)) return false;
    const stopNum = toNum(ticket.stopPrice);
    const wantsStop = ticket.orderType === "STOP" || ticket.orderType === "STOP_LIMIT";
    if (wantsStop && (!stopNum || stopNum <= 0)) return false;
    const trailNum = toNum(ticket.trailAmount);
    if (ticket.orderType === "TRAILING_STOP" && (!trailNum || trailNum <= 0)) return false;
    return true;
  }, [sym, qtyNum, ticket.orderType, limitNum, ticket.stopPrice, ticket.trailAmount]);

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

  const [orderStatus, setOrderStatus] = useState<{ msg: string; ok: boolean } | null>(null);

  // Map broker selector IDs to API route paths
  const BROKER_ROUTE_MAP: Record<string, string> = {
    paper: "/api/broker/alpaca",
    alpaca: "/api/broker/alpaca",
    ibkr: "/api/broker/ibkr",
    webull: "/api/broker/webull",
    schwab: "/api/broker/schwab",
    tradier: "/api/broker/tradier",
    coinbase: "/api/broker/coinbase",
    binance: "/api/broker/binance",
  };

  async function submitToBroker(side: "buy" | "sell", qty: number, orderType: string, limitPrice?: number, stopPrice?: number) {
    try {
      setOrderStatus(null);
      const typeMap: Record<string, string> = {
        MARKET: "market", LIMIT: "limit", STOP: "stop", STOP_LIMIT: "stop_limit", MOC: "market",
      };
      const brokerRoute = BROKER_ROUTE_MAP[selectedBroker] || "/api/broker/alpaca";
      const symbolForBroker = selectedBroker === "paper" || selectedBroker === "alpaca"
        ? sym.replace(/-USD$/, "") // Alpaca uses "BTC" not "BTC-USD" for crypto
        : sym;
      const res = await fetch(brokerRoute, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbolForBroker,
          qty,
          side,
          type: typeMap[orderType] || "market",
          timeInForce: ticket.tif === "GTC" ? "gtc" : "day",
          limitPrice,
          stopPrice,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setOrderStatus({ msg: `${side.toUpperCase()} ${qty} ${sym} — ${j.data?.status || "submitted"}`, ok: true });
        try { window.dispatchEvent(new CustomEvent("imynted:orderFilled", { detail: j.data })); } catch {}
      } else {
        setOrderStatus({ msg: j.error || "Order failed", ok: false });
      }
    } catch (e: any) {
      setOrderStatus({ msg: e?.message || "Order failed", ok: false });
    }
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
      limit: (ticket.orderType === "LIMIT" || ticket.orderType === "STOP_LIMIT") ? Number(limitNum) : undefined,
      stopPrice: (ticket.orderType === "STOP" || ticket.orderType === "STOP_LIMIT") ? toNum(ticket.stopPrice) : undefined,
      trailAmount: ticket.orderType === "TRAILING_STOP" ? toNum(ticket.trailAmount) : undefined,
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

    // Submit to Alpaca
    const side = forceSide === "BUY" ? "buy" as const : "sell" as const;
    const lp = (ticket.orderType === "LIMIT" || ticket.orderType === "STOP_LIMIT") ? Number(limitNum) : undefined;
    const sp = (ticket.orderType === "STOP" || ticket.orderType === "STOP_LIMIT") ? toNum(ticket.stopPrice) as number : undefined;
    submitToBroker(side, Number(qtyNum), ticket.orderType, lp, sp);

    setTicket((t) => ({ ...t, side: "FLAT" }));
  }

  /* ── derived ───────────────────────────────────────────────────── */
  const isMkt = ticket.orderType === "MARKET" || ticket.orderType === "MOC";
  const isStock = ticket.asset === "stock";
  const isFutures = ticket.asset === "futures";
  const spread = (quote.ask && quote.bid) ? (quote.ask - quote.bid) : undefined;
  const amount = (qtyNum && quote.price) ? qtyNum * quote.price : undefined;
  const needsLimit = ticket.orderType === "LIMIT" || ticket.orderType === "STOP_LIMIT";
  const needsStop = ticket.orderType === "STOP" || ticket.orderType === "STOP_LIMIT";
  const needsTrail = ticket.orderType === "TRAILING_STOP";

  const [brokerAcct, setBrokerAcct] = useState<{ cash: number; buyingPower: number } | null>(null);

  useEffect(() => {
    const route = BROKER_ROUTE_MAP[selectedBroker] || "/api/broker/alpaca";
    fetch(`${route}?action=account`, { cache: "no-store" })
      .then(r => r.json())
      .then(j => { if (j?.ok) setBrokerAcct({ cash: j.data.cash, buyingPower: j.data.buyingPower }); })
      .catch(() => {});
  }, [selectedBroker]);

  const accountStats = useMemo(() => {
    const cash = brokerAcct?.cash ?? 10000;
    const bp = brokerAcct?.buyingPower ?? 20000;
    const px = quote.price ?? quote.mid ?? quote.last ?? 0;
    return {
      settledCash: cash,
      buyingPower: bp,
      maxQtyBuy: px > 0 ? Math.floor(bp / px) : 0,
      maxQtySell: 901,
    };
  }, [quote.price, quote.mid, quote.last, brokerAcct]);

  const positionStats = MOCK_POSITION_STATS;

  function bumpStop(dir: -1 | 1) {
    const stopNum = toNum(ticket.stopPrice);
    const anchor = Number.isFinite(stopNum)
      ? (stopNum as number)
      : Number.isFinite(quote.mid) ? (quote.mid as number)
      : Number.isFinite(quote.price) ? (quote.price as number) : undefined;
    if (!Number.isFinite(anchor)) return;
    const tk = tickFor(ticket.asset, anchor as number);
    const next = (anchor as number) + dir * tk;
    setTicket((t) => ({ ...t, stopPrice: seedLimitFrom(next) }));
  }

  function submitQuick(side: TradeAction) {
    if (!sym) return;
    const qty = Number(qtyNum) || (ticket.asset === "crypto" ? 0.1 : 1);
    const payload = {
      ts: new Date().toISOString(),
      side,
      asset: ticket.asset,
      symbol: sym,
      orderType: "MARKET" as OrderType,
      qty,
      tif: ticket.tif,
      session: ticket.session,
      quote: { price: quote.price, mid: quote.mid, bid: quote.bid, ask: quote.ask, last: quote.last },
      paper: true,
    };
    writeLastTradeAction(side, ticket.asset, sym);
    try { window.dispatchEvent(new CustomEvent("imynted:orderTicketSubmit", { detail: payload })); } catch {}

    // Submit to Alpaca
    const alpacaSide = side === "BUY" ? "buy" as const : "sell" as const;
    submitToBroker(alpacaSide, qty, "MARKET");
  }

  function onDragStart(e: React.PointerEvent) {
    dragStartRef.current = { mx: e.clientX, my: e.clientY, ox: dragPos.x, oy: dragPos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragStartRef.current) return;
    setDragPos({
      x: dragStartRef.current.ox + (e.clientX - dragStartRef.current.mx),
      y: dragStartRef.current.oy + (e.clientY - dragStartRef.current.my),
    });
  }
  function onDragEnd() { dragStartRef.current = null; }

  /* ── design tokens ───────────────────────────────────────────── */
  const inputCls =
    "h-[30px] w-full rounded-md text-[12px] text-white/90 outline-none " +
    "border border-white/[0.08] bg-[rgba(5,11,22,0.8)] focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/10 tabular-nums " +
    "placeholder:text-white/20 transition-colors px-2.5";

  const selectCls =
    "h-[30px] w-full rounded-md text-[11px] text-white/80 outline-none " +
    "border border-white/[0.08] bg-[rgba(5,11,22,0.8)] focus:border-emerald-400/40 cursor-pointer appearance-none px-2.5";

  const labelCls = "text-[9px] text-white/35 w-[72px] shrink-0 uppercase tracking-[0.1em] font-bold";

  const bumpBtnCls =
    "flex items-center justify-center w-[26px] h-[30px] rounded-md border border-white/[0.08] " +
    "text-[12px] text-white/35 hover:text-emerald-300 hover:border-emerald-400/30 hover:bg-emerald-400/[0.06] transition-colors cursor-pointer select-none";

  const quickBtnCls = "h-[20px] px-2 rounded border text-[9px] font-bold transition-all cursor-pointer";

  /* ── shared quick-helper row ───────────────────────────────── */
  const quickHelpers = (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <span className="text-[8px] text-white/20 uppercase tracking-widest w-7 shrink-0">Price</span>
        <button type="button" className={cn(quickBtnCls, "flex-1 border-emerald-500/20 text-emerald-400/60 hover:text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-400/30")} onClick={() => applyLimit(quote.bid)}>= BID</button>
        <button type="button" className={cn(quickBtnCls, "flex-1 border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.06]")} onClick={() => applyLimit(quote.mid)}>= MID</button>
        <button type="button" className={cn(quickBtnCls, "flex-1 border-red-500/20 text-red-400/60 hover:text-red-300 hover:bg-red-500/10 hover:border-red-400/30")} onClick={() => applyLimit(quote.ask)}>= ASK</button>
        <button type="button" className={cn(quickBtnCls, "border-white/[0.08] text-white/35 hover:text-white/60 hover:bg-white/[0.06] w-[30px]")} onClick={() => bumpLimit(-1)}>−</button>
        <button type="button" className={cn(quickBtnCls, "border-white/[0.08] text-white/35 hover:text-white/60 hover:bg-white/[0.06] w-[30px]")} onClick={() => bumpLimit(+1)}>+</button>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[8px] text-white/20 uppercase tracking-widest w-7 shrink-0">Qty</span>
        <button type="button" className={cn(quickBtnCls, "flex-1 border-white/[0.08] text-white/35 hover:text-white/60 hover:bg-white/[0.06]")} onClick={() => setQtyScaled(0.25)}>¼</button>
        <button type="button" className={cn(quickBtnCls, "flex-1 border-white/[0.08] text-white/35 hover:text-white/60 hover:bg-white/[0.06]")} onClick={() => setQtyScaled(0.5)}>½</button>
        <button type="button" className={cn(quickBtnCls, "flex-1 border-white/[0.08] text-white/35 hover:text-white/60 hover:bg-white/[0.06]")} onClick={() => setQtyScaled(1)}>1×</button>
        <button type="button" className={cn(quickBtnCls, "flex-1 border-white/[0.08] text-white/35 hover:text-white/60 hover:bg-white/[0.06]")} onClick={() => setQtyScaled(2)}>2×</button>
        <button type="button" className={cn(quickBtnCls, "border-white/[0.08] text-white/35 hover:text-white/60 hover:bg-white/[0.06] w-[30px]")} onClick={() => bumpQty(-1)}>−</button>
        <button type="button" className={cn(quickBtnCls, "border-white/[0.08] text-white/35 hover:text-white/60 hover:bg-white/[0.06] w-[30px]")} onClick={() => bumpQty(+1)}>+</button>
      </div>
    </div>
  );

  /* ── symbol input with search dropdown ─────────────────────── */
  const symbolInput = (compact?: boolean) => (
    <div className={cn("relative flex items-center gap-1.5", !compact && "flex-1")}>
      {!compact && (
        <button
          type="button"
          className={cn(
            "shrink-0 h-[28px] w-[38px] rounded-sm border text-[10px] font-semibold tracking-wide transition-colors cursor-pointer flex items-center justify-center",
            ticket.asset === "stock"
              ? "border-cyan-400/20 bg-cyan-400/8 text-cyan-300 hover:bg-cyan-400/15"
              : ticket.asset === "crypto"
              ? "border-amber-400/20 bg-amber-400/8 text-amber-300 hover:bg-amber-400/15"
              : "border-orange-400/20 bg-orange-400/[0.08] text-orange-300 hover:bg-orange-400/15"
          )}
          title={ticket.asset === "stock" ? "Switch to Crypto" : ticket.asset === "crypto" ? "Switch to Futures" : "Switch to Stock"}
          onClick={() => {
            if (ticket.asset === "stock") {
              const nextSym = normalizeCryptoSymbol(ticket.symbol || "BTC-USD");
              setTicket((t) => ({ ...t, asset: "crypto", symbol: nextSym, limit: "", qty: "0.1" }));
              emitSymbolPick("crypto", nextSym);
            } else if (ticket.asset === "crypto") {
              setTicket((t) => ({ ...t, asset: "futures", symbol: "ES", limit: "", qty: "1" }));
              emitSymbolPick("futures", "ES");
            } else {
              const nextSym = normalizeStockSymbol(ticket.symbol) || "AAPL";
              setTicket((t) => ({ ...t, asset: "stock", symbol: nextSym, limit: "", qty: "10" }));
              emitSymbolPick("stock", nextSym);
            }
          }}
        >
          {ticket.asset === "stock" ? "STK" : ticket.asset === "crypto" ? "CRY" : "FUT"}
        </button>
      )}
      <input
        ref={symInputRef}
        className={cn(inputCls, "font-bold text-white uppercase tracking-wide flex-1")}
        value={symDropOpen ? symSearch : ticket.symbol}
        onChange={(e) => { setSymSearch(e.target.value); setSymDropOpen(true); }}
        onFocus={() => { setSymSearch(ticket.symbol); setSymDropOpen(true); }}
        onBlur={() => {
          // Delay so click on dropdown registers
          setTimeout(() => {
            setSymDropOpen(false);
            if (!symDropOpen) return;
            const normalized = normalizeSymbol(ticket.asset, symSearch || ticket.symbol);
            setTicket((t) => ({ ...t, symbol: normalized }));
            emitSymbolPick(ticket.asset, normalized);
          }, 200);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const q = symSearch.toUpperCase().trim();
            if (q) {
              const match = SYM_LIST.find(s => s.sym === q);
              if (match) { pickSymFromSearch(match.sym, match.asset); }
              else {
                const a = isCryptoBase(q) || q.includes("-USD") ? "crypto" as const : "stock" as const;
                pickSymFromSearch(q, a);
              }
            }
            symInputRef.current?.blur();
          }
          if (e.key === "Escape") { setSymDropOpen(false); symInputRef.current?.blur(); }
        }}
        placeholder="Search symbol..."
      />
      {ticket.symbol && !symDropOpen && (
        <button type="button" className="text-white/25 hover:text-white/60 text-[13px] transition-colors leading-none" onClick={() => { setTicket((t) => ({ ...t, symbol: "" })); setSymSearch(""); symInputRef.current?.focus(); }}>×</button>
      )}

      {/* Dropdown */}
      {symDropOpen && symSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-sm border border-emerald-400/15 overflow-hidden max-h-[240px] overflow-y-auto"
          style={{ background: "linear-gradient(180deg, rgba(5,12,20,0.98) 0%, rgba(3,8,16,0.98) 100%)", boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
          {symSuggestions.map(s => (
            <button key={s.sym} type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-emerald-400/[0.06] transition-colors border-b border-white/[0.04] last:border-0"
              onMouseDown={(e) => { e.preventDefault(); pickSymFromSearch(s.sym, s.asset); }}>
              <span className={cn("rounded-sm border px-1 py-0 text-[8px] font-bold shrink-0",
                s.asset === "crypto" ? "border-amber-400/25 bg-amber-400/[0.07] text-amber-300" : "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300/70"
              )}>{s.asset === "crypto" ? "CRY" : "STK"}</span>
              <span className="text-[11px] font-bold text-white/90">{s.sym}</span>
              <span className="text-[10px] text-white/35 truncate">{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  /* ── trader body (shared inline + popup) ───────────────────── */
  const traderBody = (
    <div className="flex flex-col">
      {/* Error strip */}
      {err && (
        <div className="px-3 py-1 text-[9px] text-rose-300 bg-rose-500/[0.06] border-b border-rose-500/10 truncate">
          {err}
        </div>
      )}

      {/* ── Mode tabs ── */}
      <div className="flex items-center h-9 border-b border-emerald-400/[0.08] select-none px-1"
        style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.04) 0%, transparent 50%)" }}>
        {(["trade", "book"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "h-full px-3 text-[10px] font-bold tracking-wide border-b-2 transition-colors uppercase",
              mode === m
                ? "border-emerald-400 text-emerald-300"
                : "border-transparent text-white/30 hover:text-white/60"
            )}
          >
            {m === "trade" ? "Order Ticket" : "Book Trader"}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 pr-2">
          <button
            type="button"
            onClick={() => setDetached(!detached)}
            className="text-white/25 hover:text-emerald-400 text-[13px] transition-colors"
            title={detached ? "Reattach trader" : "Detach to floating window"}
          >
            ⧉
          </button>
        </div>
      </div>

      {/* ── Broker selector ── */}
      <div className="px-3 py-2 border-b border-emerald-400/[0.08]" style={{ background: "rgba(4,10,18,0.4)" }}>
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-white/30 uppercase tracking-wider shrink-0">Broker</span>
          <select
            className="flex-1 h-8 rounded-sm border border-emerald-400/[0.15] bg-black/30 px-2.5 text-[11px] font-semibold text-white outline-none cursor-pointer hover:border-emerald-400/30 transition-colors"
            value={selectedBroker}
            onChange={(e) => setSelectedBroker(e.target.value)}
          >
            {BROKERS.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}{b.cash !== "—" ? ` — ${b.cash}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mode === "trade" ? (
        /* ═══════════════════════════════════════════════════════
           TRADE MODE — Full Moomoo-style order entry
           ═══════════════════════════════════════════════════════ */
        <div className="flex flex-col gap-2 px-3 py-2">

          {/* ── Symbol row ── */}
          <div className="flex items-center gap-2">
            <span className={labelCls}>Symbol</span>
            {symbolInput()}
          </div>

          {/* Company hint */}
          {ticket.asset === "futures" ? (() => {
            const meta = FUTURES_META_TRADER[sym];
            return (
              <div className="pl-[76px] text-[10px] text-white/30 -mt-1 flex items-center gap-2">
                {meta ? (
                  <>
                    <span className="text-orange-300/60">{meta.name}</span>
                    <span className="text-white/20">·</span>
                    <span>{meta.sector}</span>
                    <span className="text-white/20">·</span>
                    <span>Tick {meta.tick} · {meta.mult}x</span>
                  </>
                ) : (
                  <span>{sym} — Futures</span>
                )}
              </div>
            );
          })() : (
            <div className="pl-[76px] text-[10px] text-white/30 -mt-1 truncate">
              {sym} — {isStock ? "Equity" : "Cryptocurrency"}
            </div>
          )}

          {/* ── Quote bar ── */}
          <div className="flex items-center gap-3 rounded-md border border-white/[0.07] px-3 py-2 text-[11px] tabular-nums select-none"
            style={{ background: "rgba(5,11,22,0.7)" }}>
            <div className="flex flex-col">
              <span className="text-[8px] text-white/25 uppercase tracking-widest font-bold">Bid</span>
              <span className="text-emerald-400 font-semibold">{fmtPx(quote.bid, ticket.asset)}</span>
            </div>
            <div className="flex flex-col items-center flex-1">
              <span className="text-[8px] text-white/25 uppercase tracking-widest font-bold">Mid</span>
              <span className="text-white/70 font-bold">{fmtPx(quote.mid ?? quote.price, ticket.asset)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[8px] text-white/25 uppercase tracking-widest font-bold">Ask</span>
              <span className="text-red-400 font-semibold">{fmtPx(quote.ask, ticket.asset)}</span>
            </div>
            {spread !== undefined && (
              <div className="flex flex-col items-end border-l border-white/[0.06] pl-3">
                <span className="text-[8px] text-white/25 uppercase tracking-widest font-bold">Spr</span>
                <span className="text-white/40">{fmtPx(spread, ticket.asset)}</span>
              </div>
            )}
            {stale && <span className="text-amber-400/60 text-[8px] ml-auto font-bold">STALE</span>}
          </div>

          {/* ── Session (stock only) ── */}
          {isStock && (
            <div className="flex items-center gap-2">
              <span className={labelCls}>Session ⓘ</span>
              <select
                value={ticket.session}
                onChange={(e) => setTicket((t) => ({ ...t, session: e.target.value as Session }))}
                className={selectCls}
              >
                <option value="RTH">Regular Trading Hours</option>
                <option value="EXT">RTH + Pre/Post-Mkt</option>
                <option value="OVERNIGHT">Overnight Trading</option>
                <option value="24H">24 Hour Trading</option>
              </select>
            </div>
          )}

          {/* ── Futures contract picker ── */}
          {ticket.asset === "futures" && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Contracts</span>
              </div>
              {["Equity Index","Energy","Metals","Rates","Ag","FX"].map(sector => {
                const contracts = POPULAR_FUTURES.filter(f => f.sector === sector);
                if (!contracts.length) return null;
                return (
                  <div key={sector} className="flex items-center gap-1 flex-wrap">
                    <span className="text-[8px] text-white/20 w-10 shrink-0 uppercase tracking-wider">{sector === "Equity Index" ? "Index" : sector}</span>
                    {contracts.map(f => (
                      <button
                        key={f.sym}
                        type="button"
                        onClick={() => {
                          setTicket(t => ({ ...t, symbol: f.sym, limit: "" }));
                          emitSymbolPick("futures", f.sym);
                        }}
                        className={cn(
                          "h-[20px] px-2 rounded border text-[9px] font-bold transition-all cursor-pointer",
                          sym === f.sym
                            ? "border-orange-400/50 bg-orange-400/15 text-orange-200"
                            : "border-white/[0.08] text-white/40 hover:text-orange-200 hover:border-orange-400/30 hover:bg-orange-400/[0.06]"
                        )}
                      >
                        {f.sym}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Order Type (extended) ── */}
          <div className="flex items-center gap-2">
            <span className={labelCls}>Order Type ⓘ</span>
            <select
              value={ticket.orderType}
              onChange={(e) => {
                const v = e.target.value as OrderType;
                const wantsLimit = v === "LIMIT" || v === "STOP_LIMIT";
                const wantsStop = v === "STOP" || v === "STOP_LIMIT";
                setTicket((t) => ({
                  ...t,
                  orderType: v,
                  limit: wantsLimit ? (t.limit || seedLimitFrom(quote.mid ?? quote.price ?? quote.last)) : "",
                  stopPrice: wantsStop ? (t.stopPrice || seedLimitFrom(quote.mid ?? quote.price ?? quote.last)) : "",
                  trailAmount: v === "TRAILING_STOP" ? (t.trailAmount || "1.00") : "",
                }));
              }}
              className={selectCls}
            >
              <option value="MARKET">Market</option>
              <option value="LIMIT">Limit</option>
              <option value="STOP">Stop</option>
              <option value="STOP_LIMIT">Stop Limit</option>
              <option value="TRAILING_STOP">Trailing Stop</option>
              <option value="MOC">Market On Close</option>
            </select>
          </div>

          {/* ── Price (LIMIT / STOP_LIMIT) ── */}
          {needsLimit && (
            <div className="flex items-center gap-2">
              <span className={labelCls}>Price</span>
              <div className="flex-1 flex items-center gap-1">
                <button type="button" className={bumpBtnCls} onClick={() => bumpLimit(-1)}>−</button>
                <input
                  className={cn(inputCls, "text-center flex-1")}
                  value={ticket.limit}
                  onChange={(e) => setTicket((t) => ({ ...t, limit: e.target.value }))}
                  inputMode="decimal"
                  placeholder={fmtPx(quote.mid, ticket.asset)}
                />
                <button type="button" className={bumpBtnCls} onClick={() => bumpLimit(+1)}>+</button>
              </div>
            </div>
          )}

          {/* ── Stop Price (STOP / STOP_LIMIT) ── */}
          {needsStop && (
            <div className="flex items-center gap-2">
              <span className={labelCls}>Stop Price</span>
              <div className="flex-1 flex items-center gap-1">
                <button type="button" className={bumpBtnCls} onClick={() => bumpStop(-1)}>−</button>
                <input
                  className={cn(inputCls, "text-center flex-1")}
                  value={ticket.stopPrice}
                  onChange={(e) => setTicket((t) => ({ ...t, stopPrice: e.target.value }))}
                  inputMode="decimal"
                  placeholder="Stop trigger"
                />
                <button type="button" className={bumpBtnCls} onClick={() => bumpStop(+1)}>+</button>
              </div>
            </div>
          )}

          {/* ── Trail Amount (TRAILING_STOP) ── */}
          {needsTrail && (
            <div className="flex items-center gap-2">
              <span className={labelCls}>Trail Amt</span>
              <input
                className={cn(inputCls, "flex-1 text-center")}
                value={ticket.trailAmount}
                onChange={(e) => setTicket((t) => ({ ...t, trailAmount: e.target.value }))}
                inputMode="decimal"
                placeholder="Trail amount"
              />
            </div>
          )}

          {/* ── Quantity ── */}
          <div className="flex items-center gap-2">
            <span className={labelCls}>Quantity</span>
            <div className="flex-1 flex items-center gap-1">
              <button type="button" className={bumpBtnCls} onClick={() => bumpQty(-1)}>−</button>
              <input
                className={cn(inputCls, "text-center flex-1")}
                value={ticket.qty}
                onChange={(e) => setTicket((t) => ({ ...t, qty: e.target.value }))}
                inputMode="decimal"
                placeholder="Qty"
              />
              <button type="button" className={bumpBtnCls} onClick={() => bumpQty(+1)}>+</button>
            </div>
          </div>

          {/* ── Time-in-Force ── */}
          <div className="flex items-center gap-2">
            <span className={labelCls}>Time-in-Force ⓘ</span>
            <select
              value={ticket.tif}
              onChange={(e) => setTicket((t) => ({ ...t, tif: e.target.value as TIF }))}
              className={selectCls}
            >
              <option value="DAY">Day</option>
              <option value="GTC">GTC</option>
              <option value="IOC">IOC</option>
              <option value="GTD">GTD</option>
            </select>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* ── Take Profit / Stop Loss ── */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-[9px] text-white/40 cursor-pointer select-none uppercase tracking-widest font-bold hover:text-white/60 transition-colors">
              <input type="checkbox" checked={ticket.takeProfit} onChange={(e) => setTicket((t) => ({ ...t, takeProfit: e.target.checked }))} className="accent-emerald-400" />
              Take Profit
            </label>
            <label className="flex items-center gap-1.5 text-[9px] text-white/40 cursor-pointer select-none uppercase tracking-widest font-bold hover:text-white/60 transition-colors">
              <input type="checkbox" checked={ticket.stopLoss} onChange={(e) => setTicket((t) => ({ ...t, stopLoss: e.target.checked }))} className="accent-red-400" />
              Stop Loss
            </label>
          </div>
          {ticket.takeProfit && (
            <div className="flex items-center gap-2">
              <span className={labelCls}>TP Price</span>
              <input className={inputCls} value={ticket.tp} onChange={(e) => setTicket((t) => ({ ...t, tp: e.target.value }))} inputMode="decimal" placeholder="Take profit price" />
            </div>
          )}
          {ticket.stopLoss && (
            <div className="flex items-center gap-2">
              <span className={labelCls}>SL Price</span>
              <input className={inputCls} value={ticket.sl} onChange={(e) => setTicket((t) => ({ ...t, sl: e.target.value }))} inputMode="decimal" placeholder="Stop loss price" />
            </div>
          )}

          <div className="h-px bg-white/[0.06]" />

          {/* ── Amount / Account Stats ── */}
          <div className="rounded-md border border-white/[0.07] overflow-hidden"
            style={{ background: "rgba(5,11,22,0.7)" }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.05]">
              <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Est. Amount</span>
              <span className="text-[13px] text-white/90 font-black tabular-nums">
                {amount !== undefined
                  ? `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "$0.00"}
              </span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-white/[0.05]">
              <div className="px-3 py-1.5">
                <div className="text-[8px] text-emerald-400/40 uppercase tracking-widest font-bold">Max Buy</div>
                <div className="text-[11px] text-emerald-400/80 font-semibold tabular-nums">{accountStats.maxQtyBuy.toLocaleString()} sh</div>
              </div>
              <div className="px-3 py-1.5">
                <div className="text-[8px] text-red-400/40 uppercase tracking-widest font-bold">Max Sell</div>
                <div className="text-[11px] text-red-400/80 font-semibold tabular-nums">{accountStats.maxQtySell.toLocaleString()} sh</div>
              </div>
              <div className="px-3 py-1.5">
                <div className="text-[8px] text-white/25 uppercase tracking-widest font-bold">Cash</div>
                <div className="text-[11px] text-white/55 tabular-nums">${accountStats.settledCash.toLocaleString("en-US", {minimumFractionDigits: 2})}</div>
              </div>
              <div className="px-3 py-1.5">
                <div className="text-[8px] text-white/25 uppercase tracking-widest font-bold">Buy Power</div>
                <div className="text-[11px] text-white/55 tabular-nums">${accountStats.buyingPower.toLocaleString("en-US", {minimumFractionDigits: 2})}</div>
              </div>
            </div>
          </div>

          {/* ── Order Confirmation ── */}
          <label className="flex items-center gap-1.5 text-[9px] text-white/35 cursor-pointer select-none uppercase tracking-widest font-bold hover:text-white/55 transition-colors">
            <input type="checkbox" checked={orderConfirm} onChange={(e) => setOrderConfirm(e.target.checked)} className="accent-emerald-400" />
            Confirm Before Submit
          </label>

          {/* ── Buy / Sell / Flat ── */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => submit("BUY")}
              disabled={!canSubmit}
              className={cn(
                "flex-1 h-10 rounded-lg border text-[11px] font-black tracking-widest uppercase transition-all cursor-pointer",
                "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 hover:border-emerald-400/60 active:scale-[0.98]",
                !canSubmit && "cursor-not-allowed opacity-20"
              )}
              style={canSubmit ? { boxShadow: "0 0 14px rgba(52,211,153,0.12)" } : {}}
            >
              BUY
            </button>
            <button
              type="button"
              onClick={flatten}
              className="w-10 h-10 rounded-lg border border-white/[0.08] bg-white/[0.04] text-[9px] font-black text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-all cursor-pointer flex items-center justify-center tracking-wide"
              title="Flatten position"
            >
              FLAT
            </button>
            <button
              type="button"
              onClick={() => submit("SELL")}
              disabled={!canSubmit}
              className={cn(
                "flex-1 h-10 rounded-lg border text-[11px] font-black tracking-widest uppercase transition-all cursor-pointer",
                "border-red-500/40 bg-red-500/15 text-red-200 hover:bg-red-500/25 hover:border-red-400/60 active:scale-[0.98]",
                !canSubmit && "cursor-not-allowed opacity-20"
              )}
              style={canSubmit ? { boxShadow: "0 0 14px rgba(239,68,68,0.12)" } : {}}
            >
              SELL
            </button>
          </div>

          {/* ── Order Status ── */}
          {orderStatus && (
            <div className={cn(
              "rounded-sm border px-3 py-2 text-[11px] font-semibold",
              orderStatus.ok
                ? "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300"
                : "border-red-400/25 bg-red-400/[0.08] text-red-300"
            )}>
              {orderStatus.ok ? "✓ " : "✕ "}{orderStatus.msg}
            </div>
          )}

          {/* ── Leverage Monitor ── */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-white/30 uppercase tracking-wide font-medium">Leverage Monitor</span>
            <div className="flex items-center gap-1 flex-wrap">
              <button type="button" className={cn(quickBtnCls, "border-white/10 text-white/35 hover:text-white/70 hover:bg-white/5")} onClick={() => bumpLimit(-1)}>−$2</button>
              <button type="button" className={cn(quickBtnCls, "border-cyan-400/20 text-cyan-300/60 hover:text-cyan-200 hover:bg-cyan-400/10")} onClick={() => applyLimit(quote.mid)}>=MID</button>
              <button type="button" className={cn(quickBtnCls, "border-white/10 text-white/35 hover:text-white/70 hover:bg-white/5")} onClick={() => bumpLimit(+1)}>+$2</button>
              <div className="w-px h-3 bg-white/[0.06] mx-0.5" />
              <button type="button" className={cn(quickBtnCls, "border-white/10 text-white/35 hover:text-white/70 hover:bg-white/5")} onClick={() => setQtyScaled(2.5)}>+2.5×</button>
              <button type="button" className={cn(quickBtnCls, "border-white/10 text-white/35 hover:text-white/70 hover:bg-white/5")} onClick={() => setQtyScaled(1)}>1×</button>
              <button type="button" className={cn(quickBtnCls, "border-white/10 text-white/35 hover:text-white/70 hover:bg-white/5")} onClick={() => setQtyScaled(0.7)}>0.7×</button>
            </div>
          </div>

          {/* ── Quick helpers ── */}
          {quickHelpers}
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════
           BOOK TRADER MODE — Compact execution + position stats
           ═══════════════════════════════════════════════════════ */
        <div className="flex flex-col gap-2 px-3 py-2">

          {/* ── Symbol + Qty (compact bar) ── */}
          <div className="flex items-center gap-1.5">
            <span className="text-white/30 text-[12px]">🔍</span>
            <input
              className={cn(inputCls, "font-bold text-white uppercase tracking-wide flex-1")}
              value={ticket.symbol}
              onChange={(e) => setTicket((t) => ({ ...t, symbol: e.target.value }))}
              onBlur={() => {
                const normalized = normalizeSymbol(ticket.asset, ticket.symbol);
                setTicket((t) => ({ ...t, symbol: normalized }));
                emitSymbolPick(ticket.asset, normalized);
              }}
              placeholder="SYM"
            />
            {ticket.symbol && (
              <button type="button" className="text-white/25 hover:text-white/60 text-[13px] transition-colors leading-none" onClick={() => setTicket((t) => ({ ...t, symbol: "" }))}>×</button>
            )}
            <div className="w-px h-5 bg-white/10 mx-0.5" />
            <button type="button" className={bumpBtnCls} onClick={() => bumpQty(-1)}>−</button>
            <input
              className={cn(inputCls, "w-20 text-center")}
              value={ticket.qty}
              onChange={(e) => setTicket((t) => ({ ...t, qty: e.target.value }))}
              inputMode="decimal"
              placeholder="Qty"
            />
            <button type="button" className={bumpBtnCls} onClick={() => bumpQty(+1)}>+</button>
          </div>

          {/* Company hint */}
          <div className="text-[10px] text-white/30 truncate">
            {sym} — {isFutures ? (FUTURES_META_TRADER[sym]?.name ?? "Futures Contract") : isStock ? "Equity" : "Cryptocurrency"}
          </div>

          {/* ── Order Confirmation + Advanced toggle ── */}
          <div className="flex items-center">
            <label className="flex items-center gap-1.5 text-[10px] text-white/50 cursor-pointer select-none">
              <input type="checkbox" checked={orderConfirm} onChange={(e) => setOrderConfirm(e.target.checked)} className="accent-cyan-400" />
              Order Confirmation
            </label>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="ml-auto text-[10px] text-cyan-400/70 hover:text-cyan-400 transition-colors"
            >
              Advanced
            </button>
          </div>

          {/* ── Advanced settings panel ── */}
          {showAdvanced && (
            <div className="flex flex-col gap-2 rounded-sm border border-white/10 bg-black/20 p-2">
              {isStock && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 w-20 shrink-0">Session ⓘ</span>
                  <select value={ticket.session} onChange={(e) => setTicket((t) => ({ ...t, session: e.target.value as Session }))} className={selectCls}>
                    <option value="RTH">Regular Trading Hours</option>
                    <option value="EXT">RTH + Pre/Post-Mkt</option>
                    <option value="OVERNIGHT">Overnight Trading</option>
                    <option value="24H">24 Hour Trading</option>
                  </select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40 w-20 shrink-0">Time-in-Force ⓘ</span>
                <select value={ticket.tif} onChange={(e) => setTicket((t) => ({ ...t, tif: e.target.value as TIF }))} className={selectCls}>
                  <option value="DAY">Day</option>
                  <option value="GTC">GTC</option>
                  <option value="IOC">IOC</option>
                  <option value="GTD">GTD</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-[10px] text-white/50 cursor-pointer select-none">
                  <input type="checkbox" checked={ticket.takeProfit} onChange={(e) => setTicket((t) => ({ ...t, takeProfit: e.target.checked }))} className="accent-cyan-400" />
                  Take Profit
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-white/50 cursor-pointer select-none">
                  <input type="checkbox" checked={ticket.stopLoss} onChange={(e) => setTicket((t) => ({ ...t, stopLoss: e.target.checked }))} className="accent-cyan-400" />
                  Stop Loss
                </label>
              </div>
            </div>
          )}

          {/* ── Position stats bar ── */}
          <div className="grid grid-cols-5 gap-1 rounded-sm border border-white/10 bg-black/40 px-2 py-1.5">
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-white/35">Quantity</span>
              <span className="text-[11px] text-white/80 font-semibold">{positionStats.qty.toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-white/35">Avg Cost</span>
              <span className="text-[11px] text-white/80">{positionStats.avgCost.toFixed(3)}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-white/35">Total P/L</span>
              <span className={cn("text-[11px] font-semibold", positionStats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                +{positionStats.totalPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-white/35">Unreal P/L</span>
              <span className={cn("text-[11px]", positionStats.unrealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                +{positionStats.unrealizedPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-white/35">Today P/L</span>
              <span className={cn("text-[11px]", positionStats.todayPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                +{positionStats.todayPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* ── Quick trade buttons ── */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => submitQuick("BUY")}
              className="h-10 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-[11px] font-black tracking-widest text-emerald-200 hover:bg-emerald-500/25 hover:border-emerald-400/60 active:scale-[0.98] transition-all cursor-pointer"
              style={{ boxShadow: "0 0 12px rgba(52,211,153,0.10)" }}
            >
              BUY MKT
            </button>
            <button
              type="button"
              onClick={() => submitQuick("SELL")}
              className="h-10 rounded-lg border border-red-500/40 bg-red-500/15 text-[11px] font-black tracking-widest text-red-200 hover:bg-red-500/25 hover:border-red-400/60 active:scale-[0.98] transition-all cursor-pointer"
              style={{ boxShadow: "0 0 12px rgba(239,68,68,0.10)" }}
            >
              SELL MKT
            </button>
            <button
              type="button"
              onClick={flatten}
              className="h-8 rounded-md border border-white/[0.08] bg-white/[0.04] text-[9px] font-black tracking-widest text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              FLATTEN
            </button>
            <button
              type="button"
              className="h-8 rounded-md border border-white/[0.08] bg-white/[0.04] text-[9px] font-black tracking-widest text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              CANCEL ALL
            </button>
          </div>

          {/* ── Quick helpers ── */}
          {quickHelpers}
        </div>
      )}
    </div>
  );

  /* ── main render with detach/popup support ─────────────────── */
  return (
    <>
      {!detached ? (
        <div className={cn("w-full flex flex-col", className)}>
          {traderBody}
        </div>
      ) : (
        <div className={cn("w-full flex flex-col items-center justify-center py-8 gap-3", className)}>
          <div className="text-white/20 text-[22px]">⧉</div>
          <span className="text-white/25 text-[11px] uppercase tracking-wider font-medium">Trader Detached</span>
          <button
            type="button"
            onClick={() => setDetached(false)}
            className="text-emerald-400/70 hover:text-emerald-400 text-[11px] transition-colors"
          >
            Reattach
          </button>
        </div>
      )}

      {/* ── Floating popup window ── */}
      {detached && createPortal(
        <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: "none" }}>
          <div
            className="absolute border border-emerald-400/[0.08] rounded-sm overflow-hidden flex flex-col"
            style={{
              left: dragPos.x, top: dragPos.y, width: 320, height: "auto", maxHeight: "calc(100vh - 60px)", pointerEvents: "auto",
              background: [
                "radial-gradient(ellipse 70% 35% at 8% 0%, rgba(52,211,153,0.08) 0%, transparent 100%)",
                "radial-gradient(ellipse 40% 25% at 92% 100%, rgba(34,211,238,0.03) 0%, transparent 100%)",
                "linear-gradient(180deg, rgba(5,11,22,0.99) 0%, rgba(2,6,14,0.99) 100%)",
              ].join(", "),
              boxShadow: "0 0 0 1px rgba(52,211,153,0.06), 0 25px 60px rgba(0,0,0,0.75)",
            }}
          >
            {/* ── Drag handle / title bar ── */}
            <div
              className="flex items-center h-8 px-3 border-b border-emerald-400/[0.08] cursor-move select-none shrink-0"
              style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.06) 0%, transparent 50%)" }}
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
            >
              <span className="text-[11px] text-emerald-400/90 font-bold tracking-wider">iMYNTED TRADER</span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetached(false)}
                  className="text-white/30 hover:text-white text-[14px] transition-colors leading-none"
                >
                  ✕
                </button>
              </div>
            </div>
            {/* ── Trader content ── */}
            <div className="flex-1 min-h-0 overflow-auto">
              {traderBody}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}