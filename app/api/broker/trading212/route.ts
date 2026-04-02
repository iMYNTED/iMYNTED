// app/api/broker/trading212/route.ts
import { NextResponse } from "next/server";

const BASE = "https://live.trading212.com/api/v0";

async function t212Fetch(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: token },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Trading212 ${res.status}: ${text}`);
  }
  return res.json();
}

export async function GET(req: Request) {
  const token = process.env.TRADING212_TOKEN || req.headers.get("X-Trading212-Token") || "";
  if (!token) return NextResponse.json({ ok: false, error: "Trading212 token not configured" }, { status: 500 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    if (action === "account") {
      const data = await t212Fetch("/equity/account/cash", token);
      return NextResponse.json({
        ok: true,
        data: {
          cash: Number(data?.free ?? 0),
          buyingPower: Number(data?.free ?? 0),
          equity: Number(data?.total ?? 0),
        },
      });
    }

    if (action === "positions") {
      const data = await t212Fetch("/equity/portfolio", token);
      const positions = (Array.isArray(data) ? data : []).map((p: any) => ({
        symbol: String(p.ticker ?? "").replace("_US_EQ", "").replace("_EQ", ""),
        qty: Number(p.quantity ?? 0),
        avgPrice: Number(p.averagePrice ?? 0),
        lastPrice: Number(p.currentPrice ?? 0),
        marketValue: Number(p.quantity ?? 0) * Number(p.currentPrice ?? 0),
        unrealizedPnl: Number(p.ppl ?? 0),
        unrealizedPnlPct: Number(p.averagePrice ?? 0) > 0
          ? ((Number(p.currentPrice ?? 0) - Number(p.averagePrice ?? 0)) / Number(p.averagePrice)) * 100
          : 0,
        broker: "TRADING212",
      }));
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const data = await t212Fetch("/equity/orders", token);
      const items: any[] = data?.items ?? (Array.isArray(data) ? data : []);
      const statusMap: Record<string, string> = {
        PENDING: "new", LOCAL: "new", UNCONFIRMED: "new", CONFIRMED: "new", NEW: "new",
        CANCELLING: "cancelled", CANCELLED: "cancelled", REJECTED: "canceled",
        FILLED: "filled", PARTIALLY_FILLED: "partially_filled",
      };
      const orders = items.map((o: any) => ({
        id: String(o.id ?? ""),
        symbol: String(o.ticker ?? "").replace("_US_EQ", "").replace("_EQ", ""),
        side: String(o.type ?? "").toUpperCase().includes("SELL") ? "sell" : "buy",
        type: String(o.type ?? "").toLowerCase().includes("limit") ? "limit" : "market",
        timeInForce: "day",
        qty: Number(o.quantity ?? o.filledQuantity ?? 0),
        filledQty: Number(o.filledQuantity ?? 0),
        limitPrice: o.limitPrice ? Number(o.limitPrice) : null,
        filledAvgPrice: o.fillPrice ? Number(o.fillPrice) : null,
        status: statusMap[String(o.status ?? "").toUpperCase()] ?? String(o.status ?? "").toLowerCase(),
        createdAt: o.dateCreated ?? null,
        broker: "TRADING212",
      }));
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Trading212 request failed" }, { status: 500 });
  }
}
