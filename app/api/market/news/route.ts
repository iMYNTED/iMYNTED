import { NextResponse } from "next/server";

type NewsItem = {
  id?: string;
  title: string;
  source?: string;
  published?: string;
  summary?: string;
  url?: string;
};

type NewsResponse = {
  provider: "rapidapi" | "mock";
  symbol: string;
  items: NewsItem[];
  ts: string;
  error?: string;
};

function mock(symbol: string): NewsItem[] {
  const t = new Date().toLocaleString();
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
      summary:
        "Several experts weigh in on macro signals, rates, and positioning.",
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "AAPL").toUpperCase();

  const rapidKey = process.env.RAPIDAPI_KEY;

  // no key → always return mock so UI never breaks
  if (!rapidKey) {
    const out: NewsResponse = {
      provider: "mock",
      symbol,
      items: mock(symbol),
      ts: new Date().toISOString(),
      error: "Missing RAPIDAPI_KEY (serving mock)",
    };
    return NextResponse.json(out);
  }

  const upstream = new URL(
    "https://yahoo-finance15.p.rapidapi.com/api/v1/markets/news"
  );
  upstream.searchParams.set("ticker", symbol);
  upstream.searchParams.set("type", "ALL");

  try {
    const res = await fetch(upstream.toString(), {
      headers: {
        "X-RapidAPI-Key": rapidKey,
        "X-RapidAPI-Host": "yahoo-finance15.p.rapidapi.com",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const out: NewsResponse = {
        provider: "mock",
        symbol,
        items: mock(symbol),
        ts: new Date().toISOString(),
        error: `Upstream HTTP ${res.status} (serving mock)`,
      };
      return NextResponse.json(out);
    }

    const raw = await res.json();
    const items = normalize(raw);

    const out: NewsResponse = {
      provider: "rapidapi",
      symbol,
      items: items.length ? items : mock(symbol),
      ts: new Date().toISOString(),
    };

    return NextResponse.json(out);
  } catch (e: any) {
    const out: NewsResponse = {
      provider: "mock",
      symbol,
      items: mock(symbol),
      ts: new Date().toISOString(),
      error: e?.message ?? "Fetch failed (serving mock)",
    };
    return NextResponse.json(out);
  }
}
