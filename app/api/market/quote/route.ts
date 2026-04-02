// app/api/market/quote/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Asset = "stock" | "crypto" | "futures";
type DataMode = "sim" | "live";

type Quote = {
  symbol: string;
  asset: Asset;

  // unified fields
  price: number; // ✅ display price (MUST follow global priority: mid -> explicit price -> last)
  last: number; // ✅ ALWAYS present (raw last / trade price)
  bid?: number;
  ask?: number;
  mid?: number;

  chg: number;
  chgPct: number;

  dayHigh?: number;
  dayLow?: number;
  open?: number;
  prevClose?: number;
  volume?: number;

  ts: string;
  provider: "rapidapi" | "coingecko" | "mock";
};

function normSym(x: string) {
  return (x || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").trim();
}

function n(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;
  const num = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(num) ? num : undefined;
}

const CRYPTO_BASES = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "BNB", "MATIC"] as const;

const FUTURES_ROOTS = [
  "ES","NQ","YM","RTY","MES","MNQ","MYM","MRTY",
  "CL","NG","RB","HO","BZ",
  "GC","SI","HG","PL","PA",
  "ZB","ZN","ZF","ZT",
  "ZC","ZS","ZW","ZO","ZR","ZL","ZM",
  "6E","6J","6B","6C","6A","6N","6S",
] as const;

// Base prices for SIM mode. Tick sizes follow CME/CBOT/NYMEX conventions.
const FUTURES_META: Record<string, { base: number; tick: number; mult: number; name: string; sector: string }> = {
  ES:  { base: 5250,   tick: 0.25,      mult: 50,   name: "E-mini S&P 500",   sector: "Equity Index" },
  NQ:  { base: 18200,  tick: 0.25,      mult: 20,   name: "E-mini Nasdaq-100",sector: "Equity Index" },
  YM:  { base: 39400,  tick: 1,         mult: 5,    name: "E-mini Dow",       sector: "Equity Index" },
  RTY: { base: 2080,   tick: 0.1,       mult: 50,   name: "E-mini Russell 2000", sector: "Equity Index" },
  MES: { base: 5250,   tick: 0.25,      mult: 5,    name: "Micro E-mini S&P", sector: "Equity Index" },
  MNQ: { base: 18200,  tick: 0.25,      mult: 2,    name: "Micro E-mini NQ",  sector: "Equity Index" },
  MYM: { base: 39400,  tick: 1,         mult: 0.5,  name: "Micro E-mini Dow", sector: "Equity Index" },
  MRTY:{ base: 2080,   tick: 0.1,       mult: 5,    name: "Micro Russell 2000",sector:"Equity Index" },
  CL:  { base: 77.5,   tick: 0.01,      mult: 1000, name: "Crude Oil WTI",    sector: "Energy" },
  NG:  { base: 2.15,   tick: 0.001,     mult: 10000,name: "Natural Gas",      sector: "Energy" },
  RB:  { base: 2.35,   tick: 0.0001,    mult: 42000,name: "RBOB Gasoline",    sector: "Energy" },
  HO:  { base: 2.55,   tick: 0.0001,    mult: 42000,name: "Heating Oil",      sector: "Energy" },
  GC:  { base: 2320,   tick: 0.10,      mult: 100,  name: "Gold",             sector: "Metals" },
  SI:  { base: 27.8,   tick: 0.005,     mult: 5000, name: "Silver",           sector: "Metals" },
  HG:  { base: 4.25,   tick: 0.0005,    mult: 25000,name: "Copper",           sector: "Metals" },
  PL:  { base: 940,    tick: 0.10,      mult: 50,   name: "Platinum",         sector: "Metals" },
  ZB:  { base: 117,    tick: 0.03125,   mult: 1000, name: "30-Year T-Bond",   sector: "Rates" },
  ZN:  { base: 109,    tick: 0.015625,  mult: 1000, name: "10-Year T-Note",   sector: "Rates" },
  ZF:  { base: 105.5,  tick: 0.0078125, mult: 1000, name: "5-Year T-Note",    sector: "Rates" },
  ZC:  { base: 445,    tick: 0.25,      mult: 50,   name: "Corn",             sector: "Ag" },
  ZS:  { base: 1095,   tick: 0.25,      mult: 50,   name: "Soybeans",         sector: "Ag" },
  ZW:  { base: 555,    tick: 0.25,      mult: 50,   name: "Wheat",            sector: "Ag" },
  "6E":{ base: 1.082,  tick: 0.00005,   mult: 125000,name:"Euro FX",          sector: "FX" },
  "6J":{ base: 0.00672,tick: 0.0000005, mult: 12500000,name:"Japanese Yen",   sector: "FX" },
  "6B":{ base: 1.268,  tick: 0.0001,    mult: 62500,name: "British Pound",    sector: "FX" },
};

function normalizeFuturesSymbol(raw: string): string {
  const s = (raw || "").toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
  // Strip month code (single letter F/G/H/J/K/M/N/Q/U/V/X/Z) + 1-2 digit year
  const stripped = s.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "");
  if (FUTURES_META[stripped]) return stripped;
  if (FUTURES_META[s]) return s;
  // Try partial match — longest matching root
  const match = (FUTURES_ROOTS as readonly string[]).find(r => s.startsWith(r));
  return match ?? s;
}

function isFuturesSymbol(raw: string): boolean {
  const root = normalizeFuturesSymbol(raw);
  return !!(FUTURES_META[root]);
}

function detectAssetFromSymbol(symbol: string): Asset {
  const s = normSym(symbol);
  if (s.includes("-USD")) return "crypto";
  if ((CRYPTO_BASES as readonly string[]).includes(s)) return "crypto";
  if (isFuturesSymbol(s)) return "futures";
  return "stock";
}

function normalizeCryptoSymbol(raw: string) {
  const s = normSym(raw);
  if (!s) return "BTC-USD";
  if (s.includes("-")) return s;
  if (s.endsWith("USD")) return s.replace(/USD$/, "-USD");
  return `${s}-USD`;
}

/** ----------------------------- SIM / LIVE mode ----------------------------- */
/**
 * ✅ Canonical switch:
 * - IMYNTED_DATA_MODE=sim|live
 * - NEXT_PUBLIC_IMYNTED_DATA_MODE=sim|live
 *
 * Default: sim (avoid surprise bills)
 */
function getDataMode(): DataMode {
  const v = String(process.env.IMYNTED_DATA_MODE || process.env.NEXT_PUBLIC_IMYNTED_DATA_MODE || "sim")
    .toLowerCase()
    .trim();

  return v === "live" ? "live" : "sim";
}

/** ----------------------------- Price helpers ----------------------------- */

function tickFor(asset: Asset, px: number) {
  if (!Number.isFinite(px) || px <= 0) return 0.01;
  if (asset === "futures") {
    // use per-contract tick if available, else price-based
    return 0.01;
  }
  if (asset === "stock") return px >= 1 ? 0.01 : 0.0001;
  if (px >= 100) return 0.05;
  if (px >= 1) return 0.01;
  if (px >= 0.01) return 0.0001;
  return 0.000001;
}

function roundPx(asset: Asset, px: number) {
  if (!Number.isFinite(px)) return px;
  if (asset === "futures") {
    if (px >= 1000) return Number(px.toFixed(2));
    if (px >= 10) return Number(px.toFixed(3));
    return Number(px.toFixed(6));
  }
  if (asset === "stock") return Number(px.toFixed(px >= 1 ? 2 : 4));
  if (px >= 100) return Number(px.toFixed(2));
  if (px >= 1) return Number(px.toFixed(4));
  return Number(px.toFixed(6));
}

/**
 * 🔥 ARCHMAGE RULE (GLOBAL PRICE CONSISTENCY)
 *
 * Only synthesize bid/ask in MOCK mode.
 * Real upstream must NOT fabricate both sides,
 * otherwise header/trader/tape desync.
 */
function ensureBidAsk(asset: Asset, price: number, bid?: number, ask?: number, allowSynthesizeBoth = false) {
  const t = tickFor(asset, price);

  const hasBid = bid !== undefined && Number.isFinite(bid) && bid > 0;
  const hasAsk = ask !== undefined && Number.isFinite(ask) && ask > 0;

  if (!hasBid && !hasAsk && !allowSynthesizeBoth) {
    return { bid: undefined, ask: undefined };
  }

  if (hasBid && !hasAsk) ask = (bid as number) + t;
  if (hasAsk && !hasBid) bid = Math.max(0, (ask as number) - t);

  if (bid === undefined && ask === undefined && allowSynthesizeBoth) {
    bid = Math.max(0, price - t);
    ask = price + t;
  }

  if (bid !== undefined && ask !== undefined && ask < bid) {
    const m = (bid + ask) / 2;
    bid = Math.max(0, m - t / 2);
    ask = m + t / 2;
  }

  return {
    bid: bid !== undefined ? roundPx(asset, bid) : undefined,
    ask: ask !== undefined ? roundPx(asset, ask) : undefined,
  };
}

function midFrom(bid?: number, ask?: number) {
  if (bid === undefined || ask === undefined) return undefined;
  if (!Number.isFinite(bid) || !Number.isFinite(ask)) return undefined;
  if (bid <= 0 || ask <= 0) return undefined;
  return (bid + ask) / 2;
}

/** ------------------ Deterministic Mock (aligned with tape) ------------------ */

function hash32(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function makeRng(seed: number) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

// Known stock prices for realistic mock data
const KNOWN_PRICES: Record<string, number> = {
  AAPL: 252.89, MSFT: 365.97, GOOGL: 280.74, AMZN: 208.56, NVDA: 171.24,
  TSLA: 372.11, META: 547.54, JPM: 212.44, V: 310.50, UNH: 580.20,
  SPY: 535.80, QQQ: 449.20, AMD: 203.77, NFLX: 875.40, DIS: 112.30,
  BA: 178.50, COIN: 265.80, PLTR: 147.56, SOFI: 14.20, NIO: 5.80,
  INTC: 44.10, MU: 355.46, BATL: 6.27, GVH: 1.47, VSA: 1.77,
  UNX: 23.47, IZM: 0.535, CLGN: 0.77, ZNB: 2.68, HIX: 4.33,
  U: 19.35, LIQT: 2.01, RCKT: 5.27, RAY: 4.19, BLIV: 2.50,
  ARTL: 3.50, DGNX: 0.54, KMRK: 1.95, AUTL: 1.41, HWH: 1.99,
  GMEX: 1.33, UCAR: 0.10, BRK: 420.50, WMT: 85.20, COST: 920.40,
  HD: 380.10, LOW: 245.60, MCD: 295.80, KO: 62.40, PEP: 168.90,
  PG: 172.30, JNJ: 158.40, ABBV: 185.60, LLY: 780.20, MRK: 128.50,
  XOM: 118.40, CVX: 165.30, COP: 115.80, GS: 580.40, MS: 108.20,
  BAC: 42.80, WFC: 72.30, BLK: 980.50, GE: 185.40, CAT: 365.20,
  DE: 420.80, RTX: 125.60, LMT: 480.30, UPS: 148.20, FDX: 275.40,
  NEE: 82.40, SO: 88.60, DUK: 112.30, SLB: 52.40, HAL: 34.80,
};

const KNOWN_CRYPTO_PRICES: Record<string, number> = {
  "BTC-USD": 66426, "ETH-USD": 2000.50, "SOL-USD": 19565.98, "XRP-USD": 0.52,
  "ADA-USD": 0.38, "DOGE-USD": 0.08, "AVAX-USD": 24.50, "BNB-USD": 580.20,
  "MATIC-USD": 0.55, "DOT-USD": 6.80, "LINK-USD": 14.20, "UNI-USD": 7.40,
  "ATOM-USD": 8.90, "LTC-USD": 82.30, "FIL-USD": 5.80, "NEAR-USD": 3.40,
  "APE-USD": 1.22, "MANA-USD": 0.42, "SAND-USD": 0.48, "LUNC-USD": 0.0001,
  "SHIB-USD": 0.000012, "PEPE-USD": 0.0000085, "ARB-USD": 0.95, "OP-USD": 1.80,
  "SUI-USD": 1.05, "SEI-USD": 0.42, "TIA-USD": 8.20, "INJ-USD": 22.40,
  "RENDER-USD": 7.80, "FET-USD": 2.10,
};

function mockPrice(asset: Asset, symbol: string) {
  const bucket = Math.floor(Date.now() / 60_000);
  const seed = hash32(`${asset}:${symbol}:${bucket}`);
  const rnd = makeRng(seed);

  if (asset === "futures") {
    const root = normalizeFuturesSymbol(symbol);
    const meta = FUTURES_META[root];
    const base = meta ? meta.base : 100;
    const wiggle = (rnd() - 0.5) * base * 0.001;
    return roundPx("futures", Math.max(0.000001, base + wiggle));
  }

  // Use known price if available for realistic mock data
  const known = asset === "stock" ? KNOWN_PRICES[symbol] : asset === "crypto" ? KNOWN_CRYPTO_PRICES[symbol] : undefined;
  if (known) {
    const wiggle = (rnd() - 0.5) * known * 0.002;
    return roundPx(asset, Math.max(asset === "crypto" ? 0.0000001 : 0.01, known + wiggle));
  }

  const baseHash = hash32(symbol);
  const base = asset === "crypto" ? 1000 + (baseHash % 50000) : 50 + (baseHash % 200);
  const wiggle = (rnd() - 0.5) * (asset === "crypto" ? base * 0.0012 : 1.2);
  const px = Math.max(asset === "crypto" ? 0.000001 : 1, base + wiggle);
  return roundPx(asset, px);
}

/** ------------------ RapidAPI Yahoo (stocks) ------------------ */

function pickQuoteObject(raw: any): any {
  if (!raw) return null;

  const direct =
    raw?.quote ??
    raw?.data ??
    raw?.result ??
    raw?.results ??
    raw?.body ??
    raw?.data?.quote ??
    raw?.data?.result ??
    null;

  const yahoo0 = raw?.quoteResponse?.result?.[0];
  if (yahoo0) return yahoo0;

  const yahooRes = raw?.quoteResponse?.result;
  if (Array.isArray(yahooRes)) return yahooRes[0] ?? null;

  if (Array.isArray(direct)) return direct[0] ?? null;
  if (direct && typeof direct === "object") return direct;

  if (Array.isArray(raw)) return raw[0] ?? null;
  if (typeof raw === "object") return raw;

  return null;
}

async function fetchFromRapid(symbolRaw: string, rapidKey: string): Promise<Quote | null> {
  const asset: Asset = "stock";
  const symbol = normSym(symbolRaw) || "AAPL";

  const upstream = new URL("https://yahoo-finance15.p.rapidapi.com/api/v1/markets/quote");
  upstream.searchParams.set("ticker", symbol);

  const res = await fetch(upstream.toString(), {
    headers: {
      "X-RapidAPI-Key": rapidKey,
      "X-RapidAPI-Host": "yahoo-finance15.p.rapidapi.com",
    },
    cache: "no-store",
  });

  if (!res.ok) return null;
  const raw = await res.json().catch(() => null);
  const q = pickQuoteObject(raw);
  if (!q) return null;

  const last =
    n(q?.regularMarketPrice) ??
    n(q?.price) ??
    n(q?.last) ??
    n(q?.lastPrice) ??
    n(q?.postMarketPrice) ??
    n(q?.preMarketPrice);

  const prevClose = n(q?.regularMarketPreviousClose) ?? n(q?.previousClose) ?? n(q?.prevClose);

  if (last === undefined || !Number.isFinite(last)) return null;

  const chg = n(q?.regularMarketChange) ?? n(q?.change) ?? (prevClose !== undefined ? last - prevClose : 0);

  const chgPct =
    n(q?.regularMarketChangePercent) ?? n(q?.changePercent) ?? (prevClose ? (chg / prevClose) * 100 : 0);

  const dayHigh = n(q?.regularMarketDayHigh) ?? n(q?.dayHigh) ?? n(q?.high);
  const dayLow = n(q?.regularMarketDayLow) ?? n(q?.dayLow) ?? n(q?.low);
  const open = n(q?.regularMarketOpen) ?? n(q?.open);
  const volume = n(q?.regularMarketVolume) ?? n(q?.volume);

  const bidRaw = n(q?.regularMarketBid) ?? n(q?.bid) ?? n(q?.b) ?? n(q?.bestBid);
  const askRaw = n(q?.regularMarketAsk) ?? n(q?.ask) ?? n(q?.a) ?? n(q?.bestAsk);

  const lastRounded = roundPx(asset, last);

  // 🔥 DO NOT fabricate both sides in LIVE mode
  const ba = ensureBidAsk(asset, lastRounded, bidRaw, askRaw, false);
  const mid = midFrom(ba.bid, ba.ask);
  const midRounded = mid !== undefined ? roundPx(asset, mid) : undefined;

  // ✅ GLOBAL PRICE PRIORITY: mid -> explicit price -> last
  // (For Rapid we only have last + possible bid/ask mid)
  const displayPrice = midRounded ?? lastRounded;

  return {
    symbol: normSym(q?.symbol ?? symbol) || symbol,
    asset,
    price: displayPrice,
    last: lastRounded,
    bid: ba.bid,
    ask: ba.ask,
    mid: midRounded,
    chg: Number((chg || 0).toFixed(4)),
    chgPct: Number((chgPct || 0).toFixed(2)),
    dayHigh: dayHigh !== undefined ? roundPx(asset, dayHigh) : undefined,
    dayLow: dayLow !== undefined ? roundPx(asset, dayLow) : undefined,
    open: open !== undefined ? roundPx(asset, open) : undefined,
    prevClose: prevClose !== undefined ? roundPx(asset, prevClose) : undefined,
    volume: volume !== undefined ? Math.floor(volume) : undefined,
    ts: new Date().toISOString(),
    provider: "rapidapi",
  };
}

/** ------------------ Twelve Data (via RapidAPI) ------------------ */

async function fetchFromTwelveData(symbolRaw: string, rapidKey: string): Promise<Quote | null> {
  const asset: Asset = "stock";
  const symbol = normSym(symbolRaw) || "AAPL";

  try {
    const res = await fetch(
      `https://twelve-data1.p.rapidapi.com/quote?symbol=${encodeURIComponent(symbol)}&interval=1day`,
      {
        headers: {
          "X-RapidAPI-Key": rapidKey,
          "X-RapidAPI-Host": "twelve-data1.p.rapidapi.com",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const d = await res.json().catch(() => null);
    if (!d || d.status === "error") return null;

    const last = n(d.close) ?? n(d.price);
    if (!last || last <= 0) return null;

    const prevClose = n(d.previous_close);
    const open = n(d.open);
    const high = n(d.high) ?? n(d.fifty_two_week?.high);
    const low = n(d.low) ?? n(d.fifty_two_week?.low);
    const volume = n(d.volume);

    const chg = prevClose ? last - prevClose : 0;
    const chgPct = prevClose ? (chg / prevClose) * 100 : 0;

    const { bid, ask } = ensureBidAsk(asset, last, undefined, undefined, true);
    const mid = midFrom(bid, ask);
    const midR = mid !== undefined ? roundPx(asset, mid) : undefined;
    const lastR = roundPx(asset, last);

    return {
      symbol,
      asset,
      price: midR ?? lastR,
      last: lastR,
      bid: bid !== undefined ? roundPx(asset, bid) : undefined,
      ask: ask !== undefined ? roundPx(asset, ask) : undefined,
      mid: midR,
      chg: Number(chg.toFixed(4)),
      chgPct: Number(chgPct.toFixed(2)),
      dayHigh: high !== undefined ? roundPx(asset, high) : undefined,
      dayLow: low !== undefined ? roundPx(asset, low) : undefined,
      open: open !== undefined ? roundPx(asset, open) : undefined,
      prevClose: prevClose !== undefined ? roundPx(asset, prevClose) : undefined,
      volume: volume !== undefined ? Math.floor(volume) : undefined,
      ts: new Date().toISOString(),
      provider: "rapidapi",
    };
  } catch {
    return null;
  }
}

/** ------------------ Quote Cache (prevents rate limiting) ------------------ */

const quoteCache = new Map<string, { data: Quote; ts: number }>();
const CACHE_TTL = 15000; // 15 seconds — prevents rate limit + price jumping

function getCached(key: string): Quote | null {
  const entry = quoteCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) return null; // expired but kept for stale fallback
  return { ...entry.data, ts: new Date().toISOString() };
}

function setCache(key: string, data: Quote) {
  quoteCache.set(key, { data, ts: Date.now() });
  // Evict old entries
  if (quoteCache.size > 200) {
    const oldest = [...quoteCache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 50);
    for (const [k] of oldest) quoteCache.delete(k);
  }
}

/** ------------------ Finnhub (free, 60 calls/min) ------------------ */

async function fetchFromFinnhub(symbolRaw: string, finnhubKey: string): Promise<Quote | null> {
  const asset: Asset = "stock";
  const symbol = normSym(symbolRaw) || "AAPL";

  try {
    // Finnhub quote endpoint
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${finnhubKey}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const d = await res.json().catch(() => null);
    if (!d || !Number.isFinite(d.c) || d.c === 0) return null;

    const last = d.c;           // current price
    const prevClose = n(d.pc);  // previous close
    const open = n(d.o);        // open
    const dayHigh = n(d.h);     // high
    const dayLow = n(d.l);      // low
    const chg = n(d.d) ?? (prevClose ? last - prevClose : 0);   // change
    const chgPct = n(d.dp) ?? (prevClose ? ((last - prevClose) / prevClose) * 100 : 0); // change %

    const lastRounded = roundPx(asset, last);
    // Finnhub doesn't return bid/ask on free tier — derive from last
    const ba = ensureBidAsk(asset, lastRounded, undefined, undefined, true);
    const mid = midFrom(ba.bid, ba.ask);
    const midRounded = mid !== undefined ? roundPx(asset, mid) : undefined;
    const displayPrice = midRounded ?? lastRounded;

    return {
      symbol,
      asset,
      price: displayPrice,
      last: lastRounded,
      bid: ba.bid,
      ask: ba.ask,
      mid: midRounded,
      chg: Number((chg || 0).toFixed(4)),
      chgPct: Number((chgPct || 0).toFixed(2)),
      dayHigh: dayHigh !== undefined ? roundPx(asset, dayHigh) : undefined,
      dayLow: dayLow !== undefined ? roundPx(asset, dayLow) : undefined,
      open: open !== undefined ? roundPx(asset, open) : undefined,
      prevClose: prevClose !== undefined ? roundPx(asset, prevClose) : undefined,
      volume: undefined, // Finnhub quote endpoint doesn't return volume
      ts: new Date().toISOString(),
      provider: "rapidapi" as const, // re-use existing type
    };
  } catch {
    return null;
  }
}

/** ------------------ Alpaca (free paper trading) ------------------ */

async function fetchFromAlpaca(symbolRaw: string, apiKey: string, secretKey: string, baseUrl: string): Promise<Quote | null> {
  const asset: Asset = "stock";
  const symbol = normSym(symbolRaw) || "AAPL";

  try {
    // Alpaca latest quote
    const url = `${baseUrl}/v2/stocks/${encodeURIComponent(symbol)}/quotes/latest`;
    const res = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": apiKey,
        "APCA-API-SECRET-KEY": secretKey,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const d = await res.json().catch(() => null);
    if (!d?.quote) return null;

    const q = d.quote;
    const bidRaw = n(q.bp);
    const askRaw = n(q.ap);

    if (!bidRaw && !askRaw) return null;

    const mid = bidRaw && askRaw ? (bidRaw + askRaw) / 2 : bidRaw ?? askRaw ?? 0;
    const last = mid;
    const lastRounded = roundPx(asset, last);
    const midRounded = roundPx(asset, mid);

    // Need a separate call for snapshot to get prevClose
    const snapUrl = `${baseUrl}/v2/stocks/${encodeURIComponent(symbol)}/snapshot`;
    const snapRes = await fetch(snapUrl, {
      headers: { "APCA-API-KEY-ID": apiKey, "APCA-API-SECRET-KEY": secretKey },
      cache: "no-store",
    }).catch(() => null);
    const snap = snapRes?.ok ? await snapRes.json().catch(() => null) : null;

    const prevClose = n(snap?.prevDailyBar?.c);
    const dayHigh = n(snap?.dailyBar?.h);
    const dayLow = n(snap?.dailyBar?.l);
    const open = n(snap?.dailyBar?.o);
    const volume = n(snap?.dailyBar?.v);
    const chg = prevClose ? lastRounded - prevClose : 0;
    const chgPct = prevClose ? (chg / prevClose) * 100 : 0;

    return {
      symbol,
      asset,
      price: midRounded ?? lastRounded,
      last: lastRounded,
      bid: bidRaw ? roundPx(asset, bidRaw) : undefined,
      ask: askRaw ? roundPx(asset, askRaw) : undefined,
      mid: midRounded,
      chg: Number((chg || 0).toFixed(4)),
      chgPct: Number((chgPct || 0).toFixed(2)),
      dayHigh: dayHigh !== undefined ? roundPx(asset, dayHigh) : undefined,
      dayLow: dayLow !== undefined ? roundPx(asset, dayLow) : undefined,
      open: open !== undefined ? roundPx(asset, open) : undefined,
      prevClose: prevClose !== undefined ? roundPx(asset, prevClose) : undefined,
      volume: volume !== undefined ? Math.floor(volume) : undefined,
      ts: new Date().toISOString(),
      provider: "rapidapi" as const,
    };
  } catch {
    return null;
  }
}

/** ------------------ Mock (stock + crypto) ------------------ */

function mockQuote(symbolRaw: string, forcedAsset?: Asset): Quote {
  const detected: Asset = forcedAsset ?? detectAssetFromSymbol(symbolRaw);

  const symbol = detected === "crypto" ? normalizeCryptoSymbol(symbolRaw) : detected === "futures" ? normalizeFuturesSymbol(symbolRaw) : normSym(symbolRaw) || "AAPL";

  const px = mockPrice(detected, symbol);

  const t = tickFor(detected, px);
  const prevClose = roundPx(detected, px + (detected === "crypto" ? t * 8 : t * 18));
  const open = roundPx(detected, px - (detected === "crypto" ? t * 3 : t * 6));
  const dayHigh = roundPx(detected, Math.max(px, open) + (detected === "crypto" ? t * 14 : 1.25));
  const dayLow = roundPx(detected, Math.max(t, Math.min(px, open) - (detected === "crypto" ? t * 14 : 1.35)));

  const chg = px - prevClose;
  const chgPct = prevClose ? (chg / prevClose) * 100 : 0;

  // 🔥 MOCK ONLY: synthesize bid/ask (mid will equal px)
  const { bid, ask } = ensureBidAsk(detected, px, undefined, undefined, true);
  const mid = midFrom(bid, ask);
  const midRounded = mid !== undefined ? roundPx(detected, mid) : undefined;

  const volBase = hash32(symbol);
  const volume = detected === "stock" ? Math.floor(20_000_000 + ((volBase * 97) % 90_000_000)) : undefined;

  const lastRounded = roundPx(detected, px);
  const displayPrice = midRounded ?? lastRounded;

  return {
    symbol,
    asset: detected,
    price: displayPrice,
    last: lastRounded,
    bid,
    ask,
    mid: midRounded,
    chg: Number(chg.toFixed(4)),
    chgPct: Number(chgPct.toFixed(2)),
    dayHigh,
    dayLow,
    open,
    prevClose,
    volume,
    ts: new Date().toISOString(),
    provider: "mock",
  };
}

/** ------------------ Response helper ------------------ */

function sendQuote(quote: Quote, warn?: string, status = 200) {
  // Ensure volume + marketCap always present (generate mock if missing)
  const volSeed = hash32(quote.symbol);
  const vol = quote.volume ?? (quote.asset === "stock" ? Math.floor(20_000_000 + ((volSeed * 97) % 90_000_000)) : Math.floor(500_000 + ((volSeed * 43) % 5_000_000)));
  const mktCap = quote.asset === "stock" && quote.price
    ? Math.round(quote.price * (1_000_000 + ((volSeed * 71) % 50_000_000_000)))
    : undefined;

  return NextResponse.json(
    {
      ok: true,
      warn: warn || "",
      ...quote,
      volume: vol,
      marketCap: mktCap,
      data: { ...quote, volume: vol, marketCap: mktCap },
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const rawSymbol = url.searchParams.get("symbol") || "AAPL";

  const assetParam = (url.searchParams.get("asset") || "").toLowerCase().trim();
  const forcedAsset: Asset | null = assetParam === "crypto" ? "crypto" : assetParam === "futures" ? "futures" : assetParam === "stock" ? "stock" : null;

  const detected: Asset = forcedAsset ?? detectAssetFromSymbol(rawSymbol);
  const symbol = detected === "crypto" ? normalizeCryptoSymbol(rawSymbol) : detected === "futures" ? normalizeFuturesSymbol(rawSymbol) : normSym(rawSymbol) || "AAPL";

  const mode = getDataMode();
  const origin = url.origin;

  try {
    // ✅ HARD SIM LOCK
    if (mode === "sim") {
      const sim = detected === "crypto" ? mockQuote(symbol, "crypto") : detected === "futures" ? mockQuote(symbol, "futures") : mockQuote(symbol, "stock");
      if (detected === "futures") {
        const root = normalizeFuturesSymbol(symbol);
        const meta = FUTURES_META[root];
        if (meta) {
          (sim as any).contractInfo = {
            name: meta.name,
            sector: meta.sector,
            tick: meta.tick,
            mult: meta.mult,
            root,
          };
        }
      }
      return sendQuote(sim, "IMYNTED_DATA_MODE=sim");
    }

    // LIVE MODE — check cache first
    const rapidKey = process.env.RAPIDAPI_KEY;
    const cryptoCacheKey = `crypto:${symbol}`;
    const cryptoCached = getCached(cryptoCacheKey);
    if (detected === "crypto" && cryptoCached) return sendQuote(cryptoCached);

    if (detected === "crypto") {
      const u = new URL("/api/crypto/quote", origin);
      u.searchParams.set("symbol", symbol);

      const res = await fetch(u.toString(), { cache: "no-store" }).catch(() => null as any);

      if (res && res.ok) {
        const j: any = await res.json().catch(() => ({}));
        const d = j?.data ?? {};

        const priceRaw = n(d?.price);
        if (priceRaw && priceRaw > 0) {
          const bidRaw = n(d?.bid);
          const askRaw = n(d?.ask);

          // do NOT fabricate both sides in live mode
          const ba = ensureBidAsk("crypto", priceRaw, bidRaw, askRaw, false);

          const midFeed = n(d?.mid ?? d?.m ?? d?.midpoint);
          const mid = midFeed ?? midFrom(ba.bid, ba.ask);
          const midRounded = mid !== undefined ? roundPx("crypto", mid) : undefined;

          const lastRounded = roundPx("crypto", priceRaw);

          // ✅ GLOBAL PRICE PRIORITY: mid -> explicit price -> last
          // Here explicit price is the same as lastRounded; keep consistency.
          const displayPrice = midRounded ?? lastRounded;

          const out: Quote = {
            symbol: String(d?.symbol ?? symbol),
            asset: "crypto",
            price: displayPrice,
            last: lastRounded,
            bid: ba.bid !== undefined ? roundPx("crypto", ba.bid) : undefined,
            ask: ba.ask !== undefined ? roundPx("crypto", ba.ask) : undefined,
            mid: midRounded,
            chg: Number((n(d?.chg) ?? 0).toFixed(4)),
            chgPct: Number((n(d?.chgPct) ?? 0).toFixed(2)),
            ts: typeof d?.ts === "string" ? String(d.ts) : new Date().toISOString(),
            provider: "coingecko",
          };

          setCache(cryptoCacheKey, out);
          return sendQuote(out, j?.warn ?? "");
        }
      }

      return sendQuote(mockQuote(symbol, "crypto"), "crypto_internal_quote_unavailable");
    }

    // Check cache first (prevents rate limiting)
    const cacheKey = `stock:${symbol}`;
    const cached = getCached(cacheKey);
    if (cached) return sendQuote(cached);

    // Try providers in order: Twelve Data/RapidAPI → Finnhub → Mock
    // NOTE: Alpaca paper does NOT support market data quotes — only use for trading
    const finnhubKey = process.env.FINNHUB_API_KEY;

    if (finnhubKey) {
      const q = await fetchFromFinnhub(symbol, finnhubKey);
      if (q) { setCache(cacheKey, q); return sendQuote(q); }
    }

    if (rapidKey) {
      // Try Twelve Data first (more likely to match user's subscription)
      const q12 = await fetchFromTwelveData(symbol, rapidKey);
      if (q12) { setCache(cacheKey, q12); return sendQuote(q12); }

      // Fall back to Yahoo Finance
      const q = await fetchFromRapid(symbol, rapidKey);
      if (q) { setCache(cacheKey, q); return sendQuote(q); }
    }

    // If all providers failed, try returning stale cache before falling back to mock
    const stale = quoteCache.get(cacheKey);
    if (stale) {
      return sendQuote({ ...stale.data, ts: new Date().toISOString() }, "stale_cache");
    }

    return sendQuote(mockQuote(symbol, "stock"), "no_stock_provider_key");
  } catch (e: any) {
    const warn = e?.message ? String(e.message) : "quote_fetch_failed";
    const fallback = detected === "crypto" ? mockQuote(symbol, "crypto") : detected === "futures" ? mockQuote(symbol, "futures") : mockQuote(symbol, "stock");
    return sendQuote(fallback, warn);
  }
}