import { NextResponse } from "next/server";

type Row = {
  symbol: string;
  price: number | null;
  chg: number | null;
  chgPct: number | null;
  ts: string;
};

function n(v: any): number | null {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

export async function GET(request: Request) {
  const key = process.env.RAPIDAPI_KEY;

  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Missing RAPIDAPI_KEY in .env.local" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const tickersRaw = searchParams.get("tickers") ?? "AAPL,TSLA,NVDA";

  const symbols = tickersRaw
    .split(/[,\s]+/g)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50);

  if (symbols.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No tickers provided" },
      { status: 400 }
    );
  }

  const symbolsPath = encodeURI(symbols.join(","));
  const upstream = `https://yahoo-finance15.p.rapidapi.com/api/yahoo/qu/quote/${symbolsPath}`;

  try {
    const res = await fetch(upstream, {
      headers: {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": "yahoo-finance15.p.rapidapi.com",
      },
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          ok: false,
          error: "Upstream returned non-JSON response",
          upstream,
          status: res.status,
          contentType,
          details: text.slice(0, 1200),
        },
        { status: 502 }
      );
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Upstream JSON parse failed",
          upstream,
          status: res.status,
          details: text.slice(0, 1200),
        },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Upstream error (${res.status})`,
          upstream,
          details: json,
        },
        { status: 502 }
      );
    }

    const body: any[] = Array.isArray(json?.body) ? json.body : [];
    const now = new Date().toISOString();

    const normalized: Row[] = body.map((q) => {
      const sym = String(q?.symbol || "").toUpperCase().trim();

      const price =
        n(q?.regularMarketPrice) ?? n(q?.price) ?? n(q?.last) ?? n(q?.lastPrice);

      const chg =
        n(q?.regularMarketChange) ?? n(q?.change) ?? n(q?.netChange) ?? n(q?.chg);

      const chgPct =
        n(q?.regularMarketChangePercent) ??
        n(q?.changePercent) ??
        n(q?.pctChange) ??
        n(q?.chgPct);

      return { symbol: sym, price, chg, chgPct, ts: now };
    });

    // keep order same as requested
    const map = new Map(normalized.map((r) => [r.symbol, r]));
    const ordered: Row[] = symbols.map(
      (s) => map.get(s) || { symbol: s, price: null, chg: null, chgPct: null, ts: now }
    );

    return NextResponse.json({ ok: true, data: ordered }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Fetch failed",
        upstream,
        details: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}
