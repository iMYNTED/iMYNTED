import { NextResponse } from "next/server";

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

type SingleHaltsResponse = {
  mode: "single";
  provider: "nasdaq_rss" | "mock";
  symbol: string;
  items: HaltItem[];
  ts: string;
  error?: string;
};

type BulkHaltsResponse = {
  mode: "bulk";
  provider: "nasdaq_rss" | "mock";
  symbols: string[];
  counts: Record<string, number>;
  itemsBySymbol: Record<string, HaltItem[]>;
  ts: string;
  error?: string;
};

type AllHaltsResponse = {
  mode: "all";
  provider: "nasdaq_rss" | "mock";
  items: HaltItem[];
  ts: string;
  error?: string;
};

const FEED_URL = "https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts";

let CACHE: { ts: number; items: HaltItem[]; error?: string } | null = null;
const CACHE_MS = 60_000;

function normSym(x: string) {
  return (x || "").toUpperCase().replace(/[^A-Z.\-]/g, "").trim();
}

function decodeEntities(s: string) {
  return (s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripCdata(s: string) {
  return (s || "").replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function pickTag(xml: string, tag: string) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return "";
  return decodeEntities(stripCdata(m[1] || "").trim());
}

function guessSymbol(title: string, description: string) {
  let m = title.match(/Security\s+([A-Z.\-]{1,10})/i);
  if (m?.[1]) return normSym(m[1]);

  m = description.match(/\bSymbol\s*[:\-]\s*([A-Z.\-]{1,10})\b/i);
  if (m?.[1]) return normSym(m[1]);

  m = title.match(/\b([A-Z.\-]{1,10})\b/);
  if (m?.[1]) return normSym(m[1]);

  return "";
}

function guessStatus(title: string, description: string) {
  const t = `${title} ${description}`.toLowerCase();
  if (t.includes("resum")) return "Resumed";
  if (t.includes("pause")) return "Paused";
  if (t.includes("halt")) return "Halted";
  return undefined;
}

function guessReason(description: string) {
  const m =
    description.match(/Reason\s*[:\-]\s*([^<\n\r]+)/i) ||
    description.match(/Halt\s*Reason\s*[:\-]\s*([^<\n\r]+)/i);
  return m?.[1]?.trim();
}

function guessVenue(description: string) {
  const m =
    description.match(/Market\s*[:\-]\s*([^<\n\r]+)/i) ||
    description.match(/Exchange\s*[:\-]\s*([^<\n\r]+)/i) ||
    description.match(/Venue\s*[:\-]\s*([^<\n\r]+)/i);
  return m?.[1]?.trim();
}

function parseRss(xml: string): HaltItem[] {
  const items: HaltItem[] = [];
  const re = /<item\b[\s\S]*?<\/item>/gi;
  const blocks = xml.match(re) || [];

  for (const block of blocks) {
    const title = pickTag(block, "title");
    const description = pickTag(block, "description");
    const link = pickTag(block, "link");
    const pubDate = pickTag(block, "pubDate");

    const symbol = guessSymbol(title, description);
    if (!symbol) continue;

    items.push({
      id: link || `${symbol}-${pubDate || title}`,
      symbol,
      status: guessStatus(title, description),
      reason: guessReason(description),
      venue: guessVenue(description),
      published: pubDate || undefined,
      title: title || undefined,
      url: link || undefined,
    });
  }

  return items;
}

async function getCachedOrFetch(): Promise<{
  items: HaltItem[];
  error?: string;
  provider: "nasdaq_rss" | "mock";
}> {
  const now = Date.now();

  if (CACHE && now - CACHE.ts < CACHE_MS) {
    return {
      items: CACHE.items,
      error: CACHE.error,
      provider: CACHE.error ? "mock" : "nasdaq_rss",
    };
  }

  try {
    const res = await fetch(FEED_URL, {
      cache: "no-store",
      headers: { "User-Agent": "iMynted/1.0 (+local dev)" },
    });

    if (!res.ok) {
      const error = `Upstream HTTP ${res.status}`;
      CACHE = { ts: now, items: [], error };
      return { items: [], error, provider: "mock" };
    }

    const xml = await res.text();
    const items = parseRss(xml);
    CACHE = { ts: now, items, error: undefined };
    return { items, provider: "nasdaq_rss" };
  } catch (e: any) {
    const error = e?.message ?? "Fetch failed";
    CACHE = { ts: now, items: [], error };
    return { items: [], error, provider: "mock" };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") || "").toLowerCase();

  const { items: allItems, error, provider } = await getCachedOrFetch();

  // ✅ ALL mode: /api/market/halts?mode=all
  if (mode === "all") {
    const out: AllHaltsResponse = {
      mode: "all",
      provider,
      items: allItems,
      ts: new Date().toISOString(),
      ...(error ? { error } : {}),
    };
    return NextResponse.json(out);
  }

  // ✅ BULK mode: /api/market/halts?symbols=AAPL,TSLA
  const symbolsParam = url.searchParams.get("symbols");
  if (symbolsParam) {
    const symbols = symbolsParam
      .split(",")
      .map((s) => normSym(s))
      .filter(Boolean)
      .slice(0, 30);

    const itemsBySymbol: Record<string, HaltItem[]> = {};
    const counts: Record<string, number> = {};

    for (const s of symbols) {
      const its = allItems.filter((x) => x.symbol === s);
      itemsBySymbol[s] = its;
      counts[s] = its.length;
    }

    const out: BulkHaltsResponse = {
      mode: "bulk",
      provider,
      symbols,
      counts,
      itemsBySymbol,
      ts: new Date().toISOString(),
      ...(error ? { error } : {}),
    };
    return NextResponse.json(out);
  }

  // ✅ SINGLE mode: /api/market/halts?symbol=AAPL
  const symbol = normSym(url.searchParams.get("symbol") || "AAPL") || "AAPL";
  const its = allItems.filter((x) => x.symbol === symbol);

  const out: SingleHaltsResponse = {
    mode: "single",
    provider,
    symbol,
    items: its,
    ts: new Date().toISOString(),
    ...(error ? { error } : {}),
  };
  return NextResponse.json(out);
}
