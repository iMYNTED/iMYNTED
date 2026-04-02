// app/api/market/profile/route.ts
// Company profile via Finnhub
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";

// In-memory cache (2 hour TTL — profile data doesn't change often)
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 7_200_000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "").toUpperCase().trim();

  if (!symbol) {
    return NextResponse.json({ ok: false, error: "Missing symbol" }, { status: 400 });
  }

  // Check cache
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ ok: true, data: cached.data, cached: true });
  }

  if (!FINNHUB_KEY) {
    return NextResponse.json({ ok: false, error: "Finnhub API key not configured" }, { status: 500 });
  }

  try {
    // Fetch profile + peers + filings in parallel
    const [profileRes, peersRes, filingsRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`, { cache: "no-store" }),
      fetch(`https://finnhub.io/api/v1/stock/peers?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`, { cache: "no-store" }),
      fetch(`https://finnhub.io/api/v1/stock/filings?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`, { cache: "no-store" }),
    ]);

    const profile = profileRes.ok ? await profileRes.json().catch(() => ({})) : {};
    const peers = peersRes.ok ? await peersRes.json().catch(() => []) : [];
    const filingsRaw = filingsRes.ok ? await filingsRes.json().catch(() => []) : [];

    const data = {
      symbol: profile.ticker || symbol,
      name: profile.name || "",
      country: profile.country || "",
      currency: profile.currency || "USD",
      exchange: profile.exchange || "",
      industry: profile.finnhubIndustry || "",
      ipo: profile.ipo || "",
      logo: profile.logo || "",
      marketCap: profile.marketCapitalization || 0,
      phone: profile.phone || "",
      sharesOutstanding: profile.shareOutstanding || 0,
      website: profile.weburl || "",
      peers: Array.isArray(peers) ? peers.filter((p: string) => p !== symbol).slice(0, 10) : [],
      filings: Array.isArray(filingsRaw)
        ? filingsRaw.slice(0, 20).map((f: any) => ({
            form: f.form || "",
            filedDate: f.filedDate?.split(" ")[0] || "",
            acceptedDate: f.acceptedDate || "",
            reportUrl: f.reportUrl || "",
            filingUrl: f.filingUrl || "",
          }))
        : [],
    };

    // Cache the result
    cache.set(symbol, { data, ts: Date.now() });

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Profile fetch failed" }, { status: 500 });
  }
}
