// app/api/market/status/route.ts
// Market status via Finnhub — detects pre/regular/post/overnight/closed
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";

// Cache for 30 seconds
let cached: { data: any; ts: number } | null = null;
const CACHE_TTL = 30_000;

export async function GET() {
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ ok: true, ...cached.data, cached: true });
  }

  if (!FINNHUB_KEY) {
    return NextResponse.json({ ok: false, error: "Finnhub key not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${FINNHUB_KEY}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`Finnhub ${res.status}`);
    const j = await res.json();

    // Map Finnhub session to our session types
    let session: "pre" | "regular" | "post" | "overnight" | "closed" = "closed";
    if (j.isOpen) {
      session = "regular";
    } else if (j.session === "pre-market") {
      session = "pre";
    } else if (j.session === "post-market") {
      session = "post";
    } else {
      // Determine if overnight or closed based on time
      const now = new Date();
      const hour = now.getUTCHours() - 4; // EST offset (approximate)
      if (hour >= 20 || hour < 4) session = "overnight";
      else session = "closed";
    }

    const data = {
      exchange: j.exchange || "US",
      isOpen: j.isOpen || false,
      session,
      holiday: j.holiday || null,
      timezone: j.timezone || "America/New_York",
      timestamp: j.t || Math.floor(Date.now() / 1000),
    };

    cached = { data, ts: Date.now() };
    return NextResponse.json({ ok: true, ...data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Market status failed" }, { status: 500 });
  }
}
