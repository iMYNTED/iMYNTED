import { NextResponse } from "next/server";

type Quote = {
  symbol: string;

  price: number;

  // ✅ add these
  bid?: number;
  ask?: number;

  chg: number;
  chgPct: number;

  dayHigh?: number;
  dayLow?: number;
  open?: number;
  prevClose?: number;
  volume?: number;

  ts: string;
  provider: "rapidapi" | "mock";
};

function normSym(x: string) {
  return (x || "").toUpperCase().replace(/[^A-Z.\-]/g, "").trim();
}

function n(v: any): number | undefined {
  const num = Number(v);
  return Number.isFinite(num) ? num : undefined;
}

function tickForPrice(px: number) {
  // crude but works well visually
  if (!Number.isFinite(px) || px <= 0) return 0.01;
  if (px >= 1) return 0.01;
  return 0.0001;
}

function ensureBidAsk(price: number, bid?: number, ask?: number) {
  const t = tickForPrice(price);

  // If only one side exists, derive the other
  if (bid !== undefined && ask === undefined) ask = bid + t;
  if (ask !== undefined && bid === undefined) bid = Math.max(0, ask - t);

  // If neither exists, synthesize
  if (bid === undefined && ask === undefined) {
    bid = Math.max(0, price - t);
    ask = price + t;
  }

  // If inverted, fix
  if (bid !== undefined && ask !== undefined && ask < bid) {
    const mid = (bid + ask) / 2;
    bid = Math.max(0, mid - t / 2);
    ask = mid + t / 2;
  }

  // round nicely
  const round = (v: number) => {
    const dec = price >= 1 ? 2 : 4;
    return Number(v.toFixed(dec));
  };

  return {
    bid: bid !== undefined ? round(bid) : undefined,
    ask: ask !== undefined ? round(ask) : undefined,
  };
}

function mockQuote(symbol: string): Quote {
  // deterministic-ish mock that still "moves"
  const base = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const drift = Math.sin(Date.now() / 5000) * 0.8 + Math.cos(Date.now() / 7000) * 0.4;

  const price = Math.max(1, (base % 200) + 50 + drift);
  const prevClose = price - Math.sin(Date.now() / 9000) * 1.2;
  const chg = price - prevClose;
  const chgPct = prevClose ? (chg / prevClose) * 100 : 0;

  const px = Number(price.toFixed(2));
  const { bid, ask } = ensureBidAsk(px);

  return {
    symbol,
    price: px,
    bid,
    ask,
    chg: Number(chg.toFixed(2)),
    chgPct: Number(chgPct.toFixed(2)),
    dayHigh: Number((px + 1.25).toFixed(2)),
    dayLow: Number((px - 1.35).toFixed(2)),
    open: Number((px - 0.4).toFixed(2)),
    prevClose: Number(prevClose.toFixed(2)),
    volume: Math.floor(20_000_000 + ((base * 97) % 90_000_000)),
    ts: new Date().toISOString(),
    provider: "mock",
  };
}

async function fetchFromRapid(symbol: string, rapidKey: string): Promise<Quote | null> {
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
  const raw = await res.json();

  const q =
    raw?.quote ??
    raw?.data ??
    raw?.result ??
    raw?.results ??
    raw?.body ??
    raw;

  // price
  const price =
    n(q?.regularMarketPrice) ??
    n(q?.price) ??
    n(q?.last) ??
    n(q?.lastPrice);

  const prevClose =
    n(q?.regularMarketPreviousClose) ??
    n(q?.previousClose) ??
    n(q?.prevClose);

  const chg =
    n(q?.regularMarketChange) ??
    n(q?.change) ??
    (price !== undefined && prevClose !== undefined ? price - prevClose : undefined);

  const chgPct =
    n(q?.regularMarketChangePercent) ??
    n(q?.changePercent) ??
    (chg !== undefined && prevClose ? (chg / prevClose) * 100 : undefined);

  const dayHigh = n(q?.regularMarketDayHigh) ?? n(q?.dayHigh) ?? n(q?.high);
  const dayLow = n(q?.regularMarketDayLow) ?? n(q?.dayLow) ?? n(q?.low);
  const open = n(q?.regularMarketOpen) ?? n(q?.open);
  const volume = n(q?.regularMarketVolume) ?? n(q?.volume);

  // ✅ bid/ask (Yahoo variants + common names)
  const bidRaw =
    n(q?.regularMarketBid) ??
    n(q?.bid) ??
    n(q?.b) ??
    n(q?.bestBid);

  const askRaw =
    n(q?.regularMarketAsk) ??
    n(q?.ask) ??
    n(q?.a) ??
    n(q?.bestAsk);

  if (price === undefined || chg === undefined || chgPct === undefined) return null;

  const px = Number(price.toFixed(price >= 1 ? 2 : 4));
  const ba = ensureBidAsk(px, bidRaw, askRaw);

  return {
    symbol,
    price: px,
    bid: ba.bid,
    ask: ba.ask,
    chg: Number(chg.toFixed(2)),
    chgPct: Number(chgPct.toFixed(2)),
    dayHigh: dayHigh !== undefined ? Number(dayHigh.toFixed(2)) : undefined,
    dayLow: dayLow !== undefined ? Number(dayLow.toFixed(2)) : undefined,
    open: open !== undefined ? Number(open.toFixed(2)) : undefined,
    prevClose: prevClose !== undefined ? Number(prevClose.toFixed(2)) : undefined,
    volume: volume !== undefined ? Math.floor(volume) : undefined,
    ts: new Date().toISOString(),
    provider: "rapidapi",
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = normSym(url.searchParams.get("symbol") || "AAPL") || "AAPL";

  const rapidKey = process.env.RAPIDAPI_KEY;

  if (!rapidKey) {
    return NextResponse.json({ ok: true, data: mockQuote(symbol) });
  }

  try {
    const q = await fetchFromRapid(symbol, rapidKey);
    if (q) return NextResponse.json({ ok: true, data: q });

    return NextResponse.json({ ok: true, data: mockQuote(symbol), warn: "rapidapi_parse_failed" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: true, data: mockQuote(symbol), warn: e?.message || "quote_fetch_failed" },
      { status: 200 }
    );
  }
}
