import { NextResponse } from "next/server";

/**
 * FREE fallback: RSS feeds (no key, no rate limit costs)
 * We use a few well-known crypto RSS sources.
 * If CryptoPanic token exists, we try it first (cached).
 * If CryptoPanic 429s or missing token, we fallback to RSS.
 */

type Item = {
  id: string;
  ts: string;
  symbol?: string;
  headline: string;
  source?: string;
  url?: string;
  summary?: string;
};

function baseFromSymbol(sym: string) {
  const raw = (sym || "").toUpperCase().trim();
  const base = raw.includes("-") ? raw.split("-")[0] : raw;
  return base || "BTC";
}

function stripCdata(s: string) {
  return s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function cleanText(s: any): string {
  const str = String(s ?? "");
  return str
    .replace(/&#8217;/g, "’")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8230;/g, "…")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();
}

/* ------------------- Lightweight RSS parsing (no deps) ------------------- */
function firstTag(xml: string, tag: string) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? stripCdata(m[1].trim()) : "";
}

function allItems(xml: string) {
  const re = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

function tryParseDate(s: string) {
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString();
  return "";
}

/* ------------------------ Cache + in-flight dedupe ----------------------- */
type CacheEntry = { expiresAt: number; data: Item[] };
const TTL_MS = 60_000; // 60s
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Item[]>>();

function keyFor(base: string) {
  return `crypto_news:${base}`;
}

/* ----------------------------- CryptoPanic ------------------------------ */
function pickUrl(x: any): string {
  const direct =
    x?.url ||
    x?.link ||
    x?.original_url ||
    x?.source?.url ||
    x?.source?.link ||
    "";

  if (direct) return String(direct);

  const nested =
    x?.urls?.[0]?.url ||
    x?.urls?.[0]?.link ||
    x?.urls?.url ||
    x?.urls?.link ||
    x?.links?.[0] ||
    "";

  return nested ? String(nested) : "";
}

function getRetryAfterSeconds(r: Response) {
  const h = r.headers.get("retry-after");
  if (!h) return 0;
  const n = Number(h);
  if (Number.isFinite(n) && n > 0) return n;

  const t = Date.parse(h);
  if (!Number.isNaN(t)) {
    const secs = Math.ceil((t - Date.now()) / 1000);
    return secs > 0 ? secs : 0;
  }
  return 0;
}

async function fetchCryptoPanic(base: string, token: string): Promise<Item[]> {
  const endpoint = new URL("https://cryptopanic.com/api/developer/v2/posts/");
  endpoint.searchParams.set("auth_token", token);
  endpoint.searchParams.set("public", "true");
  endpoint.searchParams.set("currencies", base);

  const r = await fetch(endpoint.toString(), {
    cache: "force-cache",
    next: { revalidate: Math.ceil(TTL_MS / 1000) },
  });

  if (r.status === 429) {
    const retryAfter = getRetryAfterSeconds(r);
    const msg =
      retryAfter > 0
        ? `CryptoPanic 429 (rate limit). Retry after ~${retryAfter}s.`
        : "CryptoPanic 429 (rate limit).";
    const err: any = new Error(msg);
    err.status = 429;
    err.retryAfter = retryAfter;
    throw err;
  }

  if (!r.ok) throw new Error(`CryptoPanic ${r.status}`);

  const j = await r.json();
  const rows: any[] = Array.isArray(j?.results)
    ? j.results
    : Array.isArray(j?.data)
    ? j.data
    : Array.isArray(j)
    ? j
    : [];

  const items = rows
    .map((x: any, i: number) => {
      const ts =
        x?.published_at || x?.publishedAt || x?.created_at || x?.createdAt || "";
      const headline = cleanText(x?.title || x?.headline || "");
      const source = cleanText(
        x?.source?.title || x?.source?.name || x?.domain || "CryptoPanic"
      );
      const url = pickUrl(x);
      const summary = cleanText(x?.description || x?.snippet || x?.summary || "");
      const id = String(x?.id ?? `${base}-${ts}-${i}`);
      return {
        id,
        ts: ts || new Date().toISOString(),
        symbol: base,
        headline,
        source,
        url,
        summary,
      } as Item;
    })
    .filter((x) => x.headline);

  return items;
}

/* ------------------------------- RSS Fallback ---------------------------- */
const RSS_FEEDS: Array<{ name: string; url: string }> = [
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/.rss/full/" },
];

function keywordMatch(base: string, text: string) {
  const b = base.toUpperCase();
  const t = text.toUpperCase();
  if (b === "BTC") return t.includes("BITCOIN") || t.includes("BTC");
  if (b === "ETH") return t.includes("ETHEREUM") || t.includes("ETH");
  return t.includes(b);
}

async function fetchRss(base: string): Promise<Item[]> {
  const out: Item[] = [];

  // fetch sequential to be gentle
  for (const f of RSS_FEEDS) {
    try {
      const r = await fetch(f.url, {
        cache: "force-cache",
        next: { revalidate: 120 },
      });
      if (!r.ok) continue;
      const xml = await r.text();

      const items = allItems(xml)
        .map((chunk, i) => {
          const title = cleanText(firstTag(chunk, "title"));
          const link = cleanText(firstTag(chunk, "link"));
          const pub = firstTag(chunk, "pubDate") || firstTag(chunk, "updated");
          const desc = cleanText(firstTag(chunk, "description"));
          const ts = tryParseDate(pub) || new Date().toISOString();

          const blob = `${title} ${desc}`;
          if (base && !keywordMatch(base, blob)) return null;

          const id = `${f.name}-${ts}-${i}-${link || title}`.slice(0, 180);

          return {
            id,
            ts,
            symbol: base,
            headline: title,
            source: f.name,
            url: link,
            summary: desc,
          } as Item;
        })
        .filter(Boolean) as Item[];

      out.push(...items);
    } catch {
      // ignore feed failure
    }
  }

  // Sort newest first, cap
  out.sort((a, b) => (Date.parse(b.ts) || 0) - (Date.parse(a.ts) || 0));
  return out.slice(0, 80);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") || "BTC-USD";
  const base = baseFromSymbol(symbol);
  const key = keyFor(base);

  // Serve cached
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json({ ok: true, data: hit.data, cached: true });
  }

  // Deduplicate
  const existing = inflight.get(key);
  if (existing) {
    const data = await existing;
    return NextResponse.json({ ok: true, data, cached: true, deduped: true });
  }

  const p = (async () => {
    const token = process.env.CRYPTOPANIC_TOKEN;

    // Prefer CryptoPanic if token exists, else RSS
    if (token) {
      try {
        const data = await fetchCryptoPanic(base, token);
        cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
        return data;
      } catch (e: any) {
        // 429 or other issues => fall back to RSS
        const data = await fetchRss(base);
        cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
        return data;
      }
    }

    const data = await fetchRss(base);
    cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
    return data;
  })();

  inflight.set(key, p);

  try {
    const data = await p;
    return NextResponse.json({
      ok: true,
      data,
      provider: process.env.CRYPTOPANIC_TOKEN ? "cryptopanic_or_rss" : "rss",
    });
  } finally {
    inflight.delete(key);
  }
}
