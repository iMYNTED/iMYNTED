import { NextResponse } from "next/server";

type NewsItem = {
  id?: string;
  title: string;
  source?: string;
  published?: string;
  summary?: string;
  url?: string;
};

type SingleNewsResponse = {
  mode: "single";
  provider: "rapidapi" | "mock";
  symbol: string;
  items: NewsItem[];
  ts: string;
  error?: string;
};

type BulkNewsResponse = {
  mode: "bulk";
  provider: "rapidapi" | "mock";
  symbols: string[];
  counts: Record<string, number>;
  itemsBySymbol: Record<string, NewsItem[]>;
  ts: string;
  error?: string;
};

function mock(symbol: string): NewsItem[] {
  const t = new Date().toISOString();
  return [
    {
      id: `${symbol}-1`,
      title: `${symbol}: Nuclear startups are back in vogue with small reactors, and big challenges`,
      source: "Yahoo Finance",
      published: t,
      summary:
        "Small modular reactor startups are betting that mass manufacturing will help them bring costs down.",
      url: "#",
    },
    {
      id: `${symbol}-2`,
      title: `5 Companies Racing to Dethrone Tesla—And the One Already Winning`,
      source: "247wallst.com",
      published: t,
      summary:
        "Markets are watching delivery execution and demand trends across EV and energy.",
      url: "#",
    },
    {
      id: `${symbol}-3`,
      title: `This Money Expert Is Sending Warning Signs About the Economy—and How To Protect Yourself`,
      source: "Yahoo Finance",
      published: t,
      summary: "Several experts weigh in on macro signals, rates, and positioning.",
      url: "#",
    },
  ];
}

function normalize(raw: any): NewsItem[] {
  const arr =
    raw?.items ??
    raw?.news ??
    raw?.data ??
    raw?.results ??
    raw?.articles ??
    [];

  if (!Array.isArray(arr)) return [];

  return arr
    .map((x: any) => {
      const title = x?.title ?? x?.headline ?? x?.name;
      if (typeof title !== "string" || !title.trim()) return null;

      const url = x?.url ?? x?.link ?? x?.canonical_url ?? x?.news_url;
      const source = x?.source ?? x?.publisher ?? x?.provider ?? x?.origin;
      const published =
        x?.published ?? x?.pubDate ?? x?.published_at ?? x?.date ?? x?.time;
      const summary =
        x?.summary ?? x?.description ?? x?.content ?? x?.snippet ?? "";

      return {
        id: x?.id ?? x?.uuid ?? (typeof url === "string" ? url : undefined),
        title: title.trim(),
        url: typeof url === "string" ? url : undefined,
        source: typeof source === "string" ? source : undefined,
        published: typeof published === "string" ? published : undefined,
        summary: typeof summary === "string" ? summary : undefined,
      } as NewsItem;
    })
    .filter(Boolean) as NewsItem[];
}

function normSym(x: string) {
  return (x || "").toUpperCase().replace(/[^A-Z.\-]/g, "").trim();
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
  const raw = await res.json();
  return normalize(raw);
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  // ✅ BULK mode: /api/market/news?symbols=AAPL,TSLA,SOUN
  const symbolsParam = url.searchParams.get("symbols");
  if (symbolsParam) {
    const symbols = symbolsParam
      .split(",")
      .map((s) => normSym(s))
      .filter(Boolean)
      .slice(0, 30); // ✅ hard cap to protect you

    const rapidKey = process.env.RAPIDAPI_KEY;

    // no key → mock counts so UI never breaks
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
      return NextResponse.json(out);
    }

    try {
      // ✅ fetch in parallel, but keep it capped
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
      return NextResponse.json(out);
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
      return NextResponse.json(out);
    }
  }

  // ✅ SINGLE mode (unchanged): /api/market/news?symbol=AAPL
  const symbol = normSym(url.searchParams.get("symbol") || "AAPL") || "AAPL";
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
    return NextResponse.json(out);
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
    return NextResponse.json(out);
  } catch (e: any) {
    const out: SingleNewsResponse = {
      mode: "single",
      provider: "mock",
      symbol,
      items: mock(symbol),
      ts: new Date().toISOString(),
      error: e?.message ?? "Fetch failed (serving mock)",
    };
    return NextResponse.json(out);
  }
}
