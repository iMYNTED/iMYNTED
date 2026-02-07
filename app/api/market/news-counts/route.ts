import { NextResponse } from "next/server";

type NewsItem = {
  id?: string;
  title?: string;
  source?: string;
  published?: string;
  ts?: string;
  summary?: string;
  url?: string;
};

type BulkNewsResponse = {
  mode?: "bulk" | "single";
  provider?: "rapidapi" | "mock";
  symbols?: string[];
  counts?: Record<string, number>;
  itemsBySymbol?: Record<string, NewsItem[]>;
  ts?: string;
  error?: string;
};

type CountsResp = {
  ok: boolean;
  provider: string;
  asset: "stock" | "crypto";
  symbols: string[];
  counts: Record<string, number>;
  ts: string;
  error?: string;
};

function normSym(x: string) {
  return (x || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").trim();
}

/**
 * Build an origin like:
 *   http://localhost:3004
 * using headers from the incoming request (works in dev + prod).
 */
function getRequestOrigin(req: Request) {
  const h = req.headers;

  const proto =
    h.get("x-forwarded-proto") ||
    (h.get("host")?.includes("localhost") ? "http" : "https");

  const host =
    h.get("x-forwarded-host") ||
    h.get("host") ||
    "localhost:3004";

  return `${proto}://${host}`;
}

async function fetchCountsViaNewsRoute(req: Request, symbols: string[]): Promise<{
  provider: string;
  counts: Record<string, number>;
  error?: string;
}> {
  const origin = getRequestOrigin(req);

  const url = new URL(`${origin}/api/market/news`);
  url.searchParams.set("symbols", symbols.join(","));

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) {
      return { provider: "news-route", counts: {}, error: `HTTP ${res.status}` };
    }

    const j = (await res.json()) as BulkNewsResponse;

    const counts: Record<string, number> = {};
    for (const s of symbols) {
      const v = Number(j?.counts?.[s] ?? 0);
      counts[s] = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
    }

    return { provider: j?.provider || "news-route", counts, error: j?.error };
  } catch (e: any) {
    return {
      provider: "news-route",
      counts: {},
      error: e?.message || "fetch failed",
    };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const asset = (url.searchParams.get("asset") || "stock").toLowerCase() as
    | "stock"
    | "crypto";

  const symbolsParam = url.searchParams.get("symbols");
  const symbolsArray = url.searchParams.getAll("symbols[]");

  const symbolsRaw = (symbolsParam ? symbolsParam.split(",") : []).concat(symbolsArray);

  const symbols = symbolsRaw
    .map((s) => normSym(s))
    .filter(Boolean)
    .slice(0, 30);

  if (!symbols.length) {
    const out: CountsResp = {
      ok: true,
      provider: "news-route",
      asset: asset === "crypto" ? "crypto" : "stock",
      symbols: [],
      counts: {},
      ts: new Date().toISOString(),
      error: "No symbols provided",
    };
    return NextResponse.json(out);
  }

  const { provider, counts, error } = await fetchCountsViaNewsRoute(req, symbols);

  const safeCounts: Record<string, number> = {};
  for (const s of symbols) {
    const v = Number(counts?.[s] ?? 0);
    safeCounts[s] = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  }

  const out: CountsResp = {
    ok: true,
    provider,
    asset: asset === "crypto" ? "crypto" : "stock",
    symbols,
    counts: safeCounts,
    ts: new Date().toISOString(),
    ...(error ? { error } : {}),
  };

  return NextResponse.json(out);
}
