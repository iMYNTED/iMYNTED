// app/api/broker/ibkr/route.ts
// Interactive Brokers Client Portal API — requires IBKR Gateway running locally
// Gateway handles auth via its own browser login flow (no API key needed)
import { NextResponse } from "next/server";

// Allow self-signed certs from IBKR's local gateway
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function resolveCredentials(req: Request) {
  const accountId = process.env.IBKR_ACCOUNT_ID || req.headers.get("X-IBKR-Account") || "";
  const gatewayUrl = process.env.IBKR_BASE_URL || req.headers.get("X-IBKR-Gateway") || "https://localhost:5000/v1/api";
  return { accountId, gatewayUrl };
}

async function ibkrFetch(path: string, gatewayUrl: string) {
  const res = await fetch(`${gatewayUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`IBKR ${res.status}: ${text}`);
  }
  return res.json();
}

export async function GET(req: Request) {
  const { accountId, gatewayUrl } = resolveCredentials(req);
  if (!accountId) {
    return NextResponse.json({ ok: false, error: "IBKR account ID not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    if (action === "account") {
      const data = await ibkrFetch(`/portfolio/${accountId}/summary`, gatewayUrl);
      return NextResponse.json({
        ok: true,
        data: {
          cash: Number(data?.totalcashvalue?.amount ?? 0),
          buyingPower: Number(data?.buyingpower?.amount ?? 0),
          equity: Number(data?.netliquidation?.amount ?? 0),
        },
      });
    }

    if (action === "positions") {
      const data = await ibkrFetch(`/portfolio/${accountId}/positions/0`, gatewayUrl);
      const positions = (data || []).map((p: any) => ({
        symbol: p.ticker || p.contractDesc || p.symbol || "",
        qty: Math.abs(Number(p.position ?? 0)),
        avgPrice: Number(p.avgCost ?? 0),
        lastPrice: Number(p.mktPrice ?? 0),
        marketValue: Number(p.mktValue ?? 0),
        unrealizedPnl: Number(p.unrealizedPnl ?? 0),
        unrealizedPnlPct: Number(p.avgCost) ? ((Number(p.mktPrice) - Number(p.avgCost)) / Number(p.avgCost)) * 100 : 0,
        broker: "IBKR",
      }));
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const data = await ibkrFetch("/iserver/account/orders", gatewayUrl);
      const orders = (data?.orders || []).map((o: any) => ({
        id: String(o.orderId || o.order_ref || ""),
        symbol: o.ticker || o.symbol || "",
        side: String(o.side || "").toLowerCase() === "buy" ? "buy" : "sell",
        type: String(o.orderType || "MKT").toLowerCase() === "mkt" ? "market" : String(o.orderType || "").toLowerCase() === "lmt" ? "limit" : "market",
        timeInForce: String(o.tif || "DAY").toLowerCase(),
        qty: Number(o.totalSize || o.remainingQuantity || 0),
        filledQty: Number(o.filledQuantity ?? 0),
        limitPrice: o.price ? Number(o.price) : null,
        filledAvgPrice: o.avgPrice ? Number(o.avgPrice) : null,
        status: String(o.status || "").toLowerCase(),
        createdAt: o.lastExecutionTime_r ? new Date(o.lastExecutionTime_r).toISOString() : null,
        broker: "IBKR",
      }));
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "IBKR request failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { accountId, gatewayUrl } = resolveCredentials(req);
  if (!accountId) {
    return NextResponse.json({ ok: false, error: "IBKR account ID not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { symbol, qty, side, type, timeInForce, limitPrice, stopPrice, conid } = body;
    if (!symbol || !qty || !side) {
      return NextResponse.json({ ok: false, error: "Missing symbol, qty, or side" }, { status: 400 });
    }

    let contractId = conid;
    if (!contractId) {
      const search = await ibkrFetch(`/iserver/secdef/search?symbol=${encodeURIComponent(String(symbol).toUpperCase())}&secType=STK`, gatewayUrl);
      contractId = search?.[0]?.conid;
      if (!contractId) return NextResponse.json({ ok: false, error: `Could not resolve conid for ${symbol}` }, { status: 400 });
    }

    const t = String(type || "market").toLowerCase();
    const orderType = t === "limit" ? "LMT" : t === "stop_limit" ? "STP LMT" : t === "stop" ? "STP" : "MKT";
    const order: Record<string, any> = { conid: Number(contractId), orderType, side: String(side).toUpperCase(), quantity: Number(qty), tif: String(timeInForce || "DAY").toUpperCase() };
    if (limitPrice && (orderType === "LMT" || orderType === "STP LMT")) order.price = Number(limitPrice);
    if (stopPrice && (orderType === "STP" || orderType === "STP LMT")) order.auxPrice = Number(stopPrice);

    const res = await fetch(`${gatewayUrl}/iserver/account/${accountId}/orders`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orders: [order] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ ok: false, error: data?.error || `IBKR ${res.status}`, data }, { status: res.status });

    const result = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, data: { id: result?.order_id || "", symbol: String(symbol).toUpperCase(), side: String(side).toLowerCase(), type: String(type || "market").toLowerCase(), qty: String(qty), status: result?.order_status || "submitted", createdAt: new Date().toISOString() } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Order submission failed" }, { status: 500 });
  }
}
