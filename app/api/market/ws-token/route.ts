// app/api/market/ws-token/route.ts
// Returns Finnhub WebSocket URL with token for client-side connection
// The client connects directly to Finnhub WS for real-time trades
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.FINNHUB_API_KEY || "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Finnhub key not configured" }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    wsUrl: `wss://ws.finnhub.io?token=${token}`,
  });
}
