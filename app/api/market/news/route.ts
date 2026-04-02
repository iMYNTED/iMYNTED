// app/api/market/news/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type NewsItem = {
  id?: string;
  title: string;
  source?: string;

  // keep your existing field
  published?: string;

  // alias field that UI expects
  ts?: string;

  summary?: string;
  url?: string;
};

type SingleNewsResponse = {
  mode: "single";
  provider: "rapidapi" | "mock";
  symbol: string;
  items: NewsItem[];
  ts: string;
  warn?: string;
  error?: string;
};

type BulkNewsResponse = {
  mode: "bulk";
  provider: "rapidapi" | "mock";
  symbols: string[];
  counts: Record<string, number>;
  itemsBySymbol: Record<string, NewsItem[]>;
  ts: string;
  warn?: string;
  error?: string;
};

/** ----------------------------- MODE SWITCH ----------------------------- */
/**
 * Align with /api/market/quote:
 * - DATA_MODE=sim  => NEVER call RapidAPI
 * - DATA_MODE=real => try RapidAPI, fall back to mock
 *
 * (Still accepts IMYNTED_DATA_MODE / NEXT_PUBLIC_IMYNTED_DATA_MODE for compat)
 */
function dataMode(): "sim" | "real" {
  const v = String(
    process.env.DATA_MODE ||
      process.env.IMYNTED_DATA_MODE ||
      process.env.NEXT_PUBLIC_IMYNTED_DATA_MODE ||
      "sim"
  )
    .toLowerCase()
    .trim();

  return v === "real" || v === "live" ? "real" : "sim";
}

function toIso(maybe: any): string | undefined {
  if (!maybe) return undefined;

  if (typeof maybe === "number") {
    const ms = maybe < 1e12 ? maybe * 1000 : maybe;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  if (typeof maybe === "string") {
    const s = maybe.trim();
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  return undefined;
}

function normSym(x: string) {
  return (x || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").trim();
}

/** ----------------------------- Deterministic SIM News ----------------------------- */
/**
 * Stable headlines per-symbol per 30 min bucket (so UI doesn't thrash).
 */
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

const MOCK_SOURCES = ["iMYNTED Wire", "Terminal Pulse", "Market Desk", "Earnings Monitor", "Macro Brief"] as const;

function mock(symbolRaw: string): NewsItem[] {
  const symbol = normSym(symbolRaw) || "AAPL";
  const bucket = Math.floor(Date.now() / (30 * 60_000)); // 30m
  const seed = hash32(`${symbol}:${bucket}`);
  const rnd = makeRng(seed);

  const now = Date.now();
  const baseTs = (i: number) => new Date(now - i * (6 + Math.round(rnd() * 9)) * 60_000).toISOString();

  const source = () => MOCK_SOURCES[Math.floor(rnd() * MOCK_SOURCES.length)] || "iMYNTED Wire";

  const templates = [
    `${symbol}: Options flow spikes as traders position into next catalyst`,
    `${symbol}: Pre-market tape shows heavier prints near key levels`,
    `${symbol}: Analysts debate valuation as momentum cools`,
    `${symbol}: Unusual volume flagged across multiple venues`,
    `${symbol}: Market participants watch macro headline risk`,
    `${symbol}: Short-term technical levels tighten into compression`,
  ];

  const pickTitle = (i: number) => templates[(Math.floor(rnd() * templates.length) + i) % templates.length];

  return Array.from({ length: 6 }).map((_, i) => {
    const t = baseTs(i);
    return {
      id: `${symbol}-${seed}-${i}`,
      title: pickTitle(i),
      source: source(),
      published: t,
      ts: t,
      summary: "SIM feed: headline generated for UI/UX validation. Set DATA_MODE=real when ready.",
      url: "#",
    };
  });
}

/** ----------------------------- RapidAPI normalize ----------------------------- */

function normalize(raw: any): NewsItem[] {
  const arr = raw?.items ?? raw?.news ?? raw?.data ?? raw?.results ?? raw?.articles ?? [];
  if (!Array.isArray(arr)) return [];

  return arr
    .map((x: any) => {
      const title = x?.title ?? x?.headline ?? x?.name;
      if (typeof title !== "string" || !title.trim()) return null;

      const url = x?.url ?? x?.link ?? x?.canonical_url ?? x?.news_url;
      const source = x?.source ?? x?.publisher ?? x?.provider ?? x?.origin;

      const publishedRaw =
        x?.published ?? x?.pubDate ?? x?.published_at ?? x?.publishedAt ?? x?.date ?? x?.time ?? x?.timestamp ?? x?.ts;

      const publishedIso = toIso(publishedRaw) ?? new Date().toISOString();
      const summary = x?.summary ?? x?.description ?? x?.content ?? x?.snippet ?? "";

      return {
        id: x?.id ?? x?.uuid ?? (typeof url === "string" ? url : undefined),
        title: title.trim(),
        url: typeof url === "string" ? url : undefined,
        source: typeof source === "string" ? source : undefined,
        published: publishedIso,
        ts: publishedIso,
        summary: typeof summary === "string" ? summary : undefined,
      } as NewsItem;
    })
    .filter(Boolean) as NewsItem[];
}

async function fetchOneFromRapid(symbol: string, rapidKey: string): Promise<NewsItem[]> {
  const upstream = new URL("https://yahoo-finance15.p.rapidapi.com/api/v1/markets/news");
  upstream.searchParams.set("ticker", symbol);
  upstream.searchParams.set("type", "ALL");

  const res = await fetch(upstream.toString(), {
    headers: {
      "X-RapidAPI-Key": rapidKey,
      "X-RapidAPI-Host": "yahoo-finance15.p.rapidapi.com",
    },
    cache: "no-store",
  });

  if (!res.ok) return [];
  const raw = await res.json().catch(() => ({}));
  return normalize(raw);
}

/** ----------------------------- Handler ----------------------------- */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = dataMode();

  // ✅ BULK mode: /api/market/news?symbols=AAPL,TSLA,SOUN
  const symbolsParam = url.searchParams.get("symbols");
  if (symbolsParam) {
    const symbols = symbolsParam
      .split(",")
      .map((s) => normSym(s))
      .filter(Boolean)
      .slice(0, 30);

    // ✅ 100% SIM: never hit RapidAPI in sim mode
    if (mode === "sim") {
      const itemsBySymbol: Record<string, NewsItem[]> = {};
      const counts: Record<string, number> = {};
      for (const s of symbols) {
        const items = mock(s);
        itemsBySymbol[s] = items;
        counts[s] = items.length;
      }

      const out: BulkNewsResponse = {
        mode: "bulk",
        provider: "mock",
        symbols,
        counts,
        itemsBySymbol,
        ts: new Date().toISOString(),
        warn: "DATA_MODE=sim (no external news calls)",
      };
      return NextResponse.json(out, { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    const rapidKey = process.env.RAPIDAPI_KEY;
    if (!rapidKey) {
      const itemsBySymbol: Record<string, NewsItem[]> = {};
      const counts: Record<string, number> = {};
      for (const s of symbols) {
        const items = mock(s);
        itemsBySymbol[s] = items;
        counts[s] = items.length;
      }

      const out: BulkNewsResponse = {
        mode: "bulk",
        provider: "mock",
        symbols,
        counts,
        itemsBySymbol,
        ts: new Date().toISOString(),
        error: "Missing RAPIDAPI_KEY (serving mock)",
      };
      return NextResponse.json(out, { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    try {
      const results = await Promise.all(
        symbols.map(async (s) => {
          try {
            const items = await fetchOneFromRapid(s, rapidKey);
            return [s, items.length ? items : mock(s)] as const;
          } catch {
            return [s, mock(s)] as const;
          }
        })
      );

      const itemsBySymbol: Record<string, NewsItem[]> = {};
      const counts: Record<string, number> = {};
      for (const [s, items] of results) {
        itemsBySymbol[s] = items;
        counts[s] = items.length;
      }

      const out: BulkNewsResponse = {
        mode: "bulk",
        provider: "rapidapi",
        symbols,
        counts,
        itemsBySymbol,
        ts: new Date().toISOString(),
      };
      return NextResponse.json(out, { status: 200, headers: { "Cache-Control": "no-store" } });
    } catch (e: any) {
      const itemsBySymbol: Record<string, NewsItem[]> = {};
      const counts: Record<string, number> = {};
      for (const s of symbols) {
        const items = mock(s);
        itemsBySymbol[s] = items;
        counts[s] = items.length;
      }

      const out: BulkNewsResponse = {
        mode: "bulk",
        provider: "mock",
        symbols,
        counts,
        itemsBySymbol,
        ts: new Date().toISOString(),
        error: e?.message ?? "Bulk fetch failed (serving mock)",
      };
      return NextResponse.json(out, { status: 200, headers: { "Cache-Control": "no-store" } });
    }
  }

  // ✅ SINGLE mode: /api/market/news?symbol=AAPL
  const symbol = normSym(url.searchParams.get("symbol") || "AAPL") || "AAPL";

  // ✅ 100% SIM: never hit RapidAPI in sim mode
  if (mode === "sim") {
    const out: SingleNewsResponse = {
      mode: "single",
      provider: "mock",
      symbol,
      items: mock(symbol),
      ts: new Date().toISOString(),
      warn: "DATA_MODE=sim (no external news calls)",
    };
    return NextResponse.json(out, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const rapidKey = process.env.RAPIDAPI_KEY;

  if (!rapidKey) {
    const out: SingleNewsResponse = {
      mode: "single",
      provider: "mock",
      symbol,
      items: mock(symbol),
      ts: new Date().toISOString(),
      error: "Missing RAPIDAPI_KEY (serving mock)",
    };
    return NextResponse.json(out, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const items = await fetchOneFromRapid(symbol, rapidKey);

    const out: SingleNewsResponse = {
      mode: "single",
      provider: "rapidapi",
      symbol,
      items: items.length ? items : mock(symbol),
      ts: new Date().toISOString(),
    };

    return NextResponse.json(out, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    const out: SingleNewsResponse = {
      mode: "single",
      provider: "mock",
      symbol,
      items: mock(symbol),
      ts: new Date().toISOString(),
      error: e?.message ?? "Fetch failed (serving mock)",
    };

    return NextResponse.json(out, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}