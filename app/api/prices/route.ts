import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const key = process.env.RAPIDAPI_KEY;

  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Missing RAPIDAPI_KEY in .env.local" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const tickers = searchParams.get("tickers") ?? "AAPL,TSLA";

  // ✅ RapidAPI values for Yahoo Finance 15
  const RAPID_HOST = "yahoo-finance15.p.rapidapi.com";
  const BASE_URL = "https://yahoo-finance15.p.rapidapi.com/api/v1/markets/news";

  // ✅ Bulletproof URL builder (prevents malformed URLs / double ?)
  const upstream = new URL(BASE_URL);
  upstream.searchParams.set("ticker", tickers);

  const url = upstream.toString();
  console.log("UPSTREAM URL:", url);

  try {
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": RAPID_HOST,
      },
      cache: "no-store",
    });

    const text = await response.text();

    // If RapidAPI returns a non-JSON error body, show it clearly
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, status: response.status, error: "Non-JSON response", raw: text },
        { status: 502 }
      );
    }

    // ✅ If upstream is error, pass it through so we can see message
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, status: response.status, upstream: json },
        { status: 502 }
      );
    }

    // ✅ Normalize (works with Steady-style OR other feeds)
    const items = json.body ?? json.items ?? json.data ?? [];

    const articles = (items ?? []).map((item: any) => ({
      title: item.title ?? item.headline ?? null,
      description: item.description ?? item.summary ?? null,
      url: item.link ?? item.url ?? null,
      source:
        item.source ??
        item.sourceName ??
        item.publisher ??
        item.provider ??
        ((item.link ?? item.url)
          ? new URL(item.link ?? item.url).hostname.replace(/^www\./, "")
          : "Unknown"),
      publishedAt: (item.pubDate ?? item.published_at ?? item.publishedAt)
        ? new Date(item.pubDate ?? item.published_at ?? item.publishedAt).toISOString()
        : null,
      guid: item.guid ?? item.id ?? (item.link ?? item.url) ?? null,
      tickers: tickers.split(",").map((t) => t.trim()).filter(Boolean),
    }));

    // newest first
    articles.sort((a: any, b: any) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

    return NextResponse.json({
      ok: true,
      count: articles.length,
      articles,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "RapidAPI request failed" },
      { status: 500 }
    );
  }
}




