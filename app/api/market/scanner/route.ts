// app/api/market/scanner/route.ts
// Real-time scanner seed — Finnhub quotes + company news for sentiment
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";

type Row = {
  symbol: string;
  float?: number;
  tag?: string;
  price?: number;
  change?: number;
  changePct?: number;
  volume?: number;
  // Intelligence pass-through for enrichment
  newsScore?: number;
  catalystType?: string;
  catalystHeadline?: string;
  sentimentScore?: number;
};

function cleanSymbol(raw: any) {
  let s = String(raw ?? "").toUpperCase().trim().replace(/\s+/g, "");
  if (!s) return "";
  if (s.includes("-USD")) return s.replace(/[^A-Z0-9.\-]/g, "");
  s = s.replace(/[^A-Z0-9.\-]/g, "");
  s = s.replace(/-USD$/i, "");
  s = s.replace(/[0-9]+$/, "");
  return s;
}

function safeInt(v: any, fallback: number) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : fallback;
}

// ── In-memory cache to respect Finnhub rate limits ──
let _quoteCache: Map<string, { c: number; d: number; dp: number; h: number; l: number; o: number; pc: number }> | null = null;
let _quoteCacheTs = 0;
let _newsCacheByType: Record<string, { rows: Row[]; ts: number }> = {};
const QUOTE_CACHE_TTL = 60_000; // 60s — one full scan per minute
const NEWS_CACHE_TTL = 120_000; // 2min for news

// ── Scan universe — 30 liquid, high-activity tickers (fits Finnhub free tier) ──
const UNIVERSE = [
  "TSLA","NVDA","AAPL","MSFT","AMZN","META","GOOGL","AMD","AVGO","NFLX",
  "PLTR","COIN","SMCI","ARM","CRWD","SOFI","MARA","RIOT","RIVN","MSTR",
  "BA","JPM","MU","INTC","SHOP","GME","AMC","HOOD","UBER","LLY",
];

// ── Fetch Finnhub quote for a single symbol ──
async function finnhubQuote(symbol: string): Promise<{
  c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; t: number;
} | null> {
  if (!FINNHUB_KEY) return null;
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const j = await res.json();
    if (!j || !Number.isFinite(j.c) || j.c === 0) return null;
    return j;
  } catch {
    return null;
  }
}

// ── Fetch Finnhub company news for a symbol (last 2 days) ──
async function finnhubCompanyNews(symbol: string): Promise<{
  headline: string; sentimentScore: number; catalystType: string; newsScore: number;
} | null> {
  if (!FINNHUB_KEY) return null;
  try {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${yesterday}&to=${today}&token=${FINNHUB_KEY}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const articles: any[] = await res.json();
    if (!Array.isArray(articles) || articles.length === 0) return null;

    // Use most recent article
    const a = articles[0];
    const headline = String(a.headline || "").slice(0, 140);
    const summary = String(a.summary || "");

    // Keyword-based sentiment
    const bullWords = /upgrade|beat|surge|rally|soar|jump|boost|raise|buy|bullish|approval|win|launch|up today|gains|higher|outperform|record/i;
    const bearWords = /downgrade|miss|plunge|drop|fall|cut|sell|bearish|reject|loss|fail|warning|down today|lower|underperform|decline/i;
    let sentimentScore = 0;
    if (bullWords.test(headline) || bullWords.test(summary)) sentimentScore = 0.6;
    if (bearWords.test(headline) || bearWords.test(summary)) sentimentScore = sentimentScore > 0 ? sentimentScore : -0.6;

    // Detect catalyst type
    let catalystType = "none";
    const text = headline + " " + summary;
    if (/earnings|EPS|revenue|quarterly|beat|miss/i.test(text)) {
      catalystType = sentimentScore >= 0 ? "earnings_beat" : "earnings_miss";
    } else if (/FDA|approval|drug|clinical|trial/i.test(text)) {
      catalystType = sentimentScore >= 0 ? "fda_approval" : "fda_rejection";
    } else if (/merger|acqui|buyout|deal/i.test(text)) {
      catalystType = "merger_announced";
    } else if (/upgrade|price target.*raise/i.test(text)) {
      catalystType = "analyst_upgrade";
    } else if (/downgrade|price target.*cut/i.test(text)) {
      catalystType = "analyst_downgrade";
    } else if (/guidance|outlook|forecast|raise/i.test(text)) {
      catalystType = sentimentScore >= 0 ? "guidance_raise" : "guidance_lower";
    } else if (/buyback|repurchase/i.test(text)) {
      catalystType = "buyback_announced";
    } else if (/insider/i.test(text)) {
      catalystType = sentimentScore >= 0 ? "insider_buy" : "insider_sell";
    } else if (/contract|award/i.test(text)) {
      catalystType = "contract_win";
    } else if (/launch|product|release|unveil/i.test(text)) {
      catalystType = "product_launch";
    }

    // Recency score
    const ageMin = a.datetime ? Math.max(0, (Date.now() / 1000 - a.datetime) / 60) : 999;
    const newsScore = ageMin <= 15 ? 5 : ageMin <= 60 ? 4 : ageMin <= 240 ? 3 : 2;

    return {
      headline,
      sentimentScore: sentimentScore || undefined as any,
      catalystType: catalystType !== "none" ? catalystType : undefined as any,
      newsScore,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "gainers").toLowerCase();
  const limit = Math.max(5, Math.min(200, safeInt(url.searchParams.get("limit"), 50)));

  if (type === "halts") {
    return NextResponse.json(
      { ok: true, provider: "mock", type, count: 0, rows: [], data: [], ts: new Date().toISOString() },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  let rows: Row[] = [];
  let provider = "mock";

  if (FINNHUB_KEY) {
    try {
      // 1) Fetch quotes — use cache if fresh, else refetch in small batches
      let quotes: Map<string, { c: number; d: number; dp: number; h: number; l: number; o: number; pc: number }>;
      const cacheAge = Date.now() - _quoteCacheTs;
      const cacheHit = _quoteCache && _quoteCache.size > 0 && cacheAge < QUOTE_CACHE_TTL;

      if (cacheHit) {
        quotes = _quoteCache!;
        // cache hit — no API calls needed
      } else {
        quotes = new Map();
        const batchSize = 10;
        for (let i = 0; i < UNIVERSE.length; i += batchSize) {
          const batch = UNIVERSE.slice(i, i + batchSize);
          const results = await Promise.allSettled(batch.map(s => finnhubQuote(s)));
          for (let j = 0; j < batch.length; j++) {
            const r = results[j];
            if (r.status === "fulfilled" && r.value) {
              quotes.set(batch[j], r.value);
            }
          }
          if (i + batchSize < UNIVERSE.length) {
            await new Promise(resolve => setTimeout(resolve, 350));
          }
        }
        // Cache the results
        if (quotes.size > 0) {
          _quoteCache = quotes;
          _quoteCacheTs = Date.now();
        }
        // fresh fetch complete
      }

      if (quotes.size > 0) {
        provider = "finnhub";

        // 2) Build rows sorted by the requested type
        let sorted: [string, typeof quotes extends Map<string, infer V> ? V : never][] = [...quotes.entries()];

        if (type === "gainers") {
          sorted = sorted.filter(([, q]) => q.dp > 0).sort((a, b) => b[1].dp - a[1].dp);
        } else if (type === "losers") {
          // Show actual losers first; if none, show weakest performers
          const realLosers = sorted.filter(([, q]) => q.dp < 0).sort((a, b) => a[1].dp - b[1].dp);
          sorted = realLosers.length > 0 ? realLosers : sorted.sort((a, b) => a[1].dp - b[1].dp);
        } else if (type === "unusual" || type === "actives") {
          // Sort by absolute % change (most volatile)
          sorted = sorted.sort((a, b) => Math.abs(b[1].dp) - Math.abs(a[1].dp));
        } else if (type === "news") {
          // Sort by absolute change — we'll enrich with news below
          sorted = sorted.sort((a, b) => Math.abs(b[1].dp) - Math.abs(a[1].dp));
        }

        // Take top movers
        const topSymbols = sorted.slice(0, Math.min(limit, 25));

        // 3) Fetch company news — use cache if fresh
        const newsCacheKey = type;
        const cachedNews = _newsCacheByType[newsCacheKey];
        const newsFromCache = cachedNews && (Date.now() - cachedNews.ts) < NEWS_CACHE_TTL;
        const newsMap = new Map<string, NonNullable<Awaited<ReturnType<typeof finnhubCompanyNews>>>>();

        if (!newsFromCache) {
          const newsLimit = Math.min(topSymbols.length, 8);
          const newsResults = await Promise.allSettled(
            topSymbols.slice(0, newsLimit).map(([sym]) => finnhubCompanyNews(sym))
          );
          for (let i = 0; i < newsLimit; i++) {
            const r = newsResults[i];
            if (r.status === "fulfilled" && r.value) {
              newsMap.set(topSymbols[i][0], r.value);
            }
          }
        }

        // 4) Build final rows
        rows = topSymbols.map(([sym, q]) => {
          const news = newsMap.get(sym);
          return {
            symbol: sym,
            tag: type,
            price: q.c,
            change: q.d,
            changePct: q.dp,
            newsScore: news?.newsScore,
            catalystType: news?.catalystType,
            catalystHeadline: news?.headline,
            sentimentScore: news?.sentimentScore,
          };
        });

        // Cache the built rows for this type
        if (rows.length > 0) {
          _newsCacheByType[newsCacheKey] = { rows: [...rows], ts: Date.now() };
        }
      }
    } catch {
      // Fall through to fallback
    }
  }

  // If quotes failed but we have a cached result for this type, use it
  if (rows.length === 0 && _newsCacheByType[type] && (Date.now() - _newsCacheByType[type].ts) < NEWS_CACHE_TTL * 3) {
    rows = _newsCacheByType[type].rows;
    provider = "finnhub-cached";
  }

  // Fallback to static universe if Finnhub unavailable
  if (rows.length === 0) {
    const fallback = UNIVERSE.slice(0, limit);
    rows = fallback.map(symbol => ({ symbol, tag: type }));
    provider = "mock";
  }

  // Clean, de-dupe, limit
  const outRows: Row[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const sym = cleanSymbol(r.symbol);
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    outRows.push({ ...r, symbol: sym });
    if (outRows.length >= limit) break;
  }

  return NextResponse.json(
    {
      ok: true,
      provider,
      type,
      count: outRows.length,
      rows: outRows,
      data: outRows,
      ts: new Date().toISOString(),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
