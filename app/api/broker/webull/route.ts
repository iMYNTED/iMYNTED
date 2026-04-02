// app/api/broker/webull/route.ts
// Webull API integration (unofficial REST endpoints)
import { NextResponse } from "next/server";

const BASE = "https://tradeapi.webullbroker.com/api";

function resolveCredentials(req: Request) {
  const token = process.env.WEBULL_ACCESS_TOKEN || req.headers.get("X-Webull-Token") || "";
  const accountId = process.env.WEBULL_ACCOUNT_ID || req.headers.get("X-Webull-Account") || "";
  const deviceId = process.env.WEBULL_DEVICE_ID || req.headers.get("X-Webull-Device") || "imynted-web";
  return { token, accountId, deviceId };
}

async function webullFetch(path: string, token: string, deviceId: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", "Access-Token": token, did: deviceId, os: "web", hl: "en" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Webull ${res.status}: ${text}`);
  }
  return res.json();
}

export async function GET(req: Request) {
  const { token, accountId, deviceId } = resolveCredentials(req);
  if (!token || !accountId) {
    return NextResponse.json({ ok: false, error: "Webull credentials not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    if (action === "account") {
      const data = await webullFetch("/trading/v1/webull/account/getSecAccountList/v4", token, deviceId);
      const acct = Array.isArray(data) ? data.find((a: any) => String(a.secAccountId) === accountId) || data[0] : data;
      return NextResponse.json({
        ok: true,
        data: {
          cash: Number(acct?.totalCashValue ?? 0),
          buyingPower: Number(acct?.dayBuyingPower ?? acct?.overnightBuyingPower ?? 0),
          equity: Number(acct?.netLiquidation ?? 0),
        },
      });
    }

    if (action === "positions") {
      const data = await webullFetch(`/trading/v1/webull/order/list/v2?secAccountId=${accountId}&startIndex=0&pageSize=100`, token, deviceId);
      const positions = (data?.positions || data || []).map((p: any) => ({
        symbol: p.ticker?.symbol || p.symbol || "",
        qty: Math.abs(Number(p.position || p.quantity || 0)),
        avgPrice: Number(p.costPrice || p.avgCost || 0),
        lastPrice: Number(p.lastPrice || p.ticker?.close || 0),
        marketValue: Number(p.marketValue || 0),
        unrealizedPnl: Number(p.unrealizedProfitLoss || 0),
        unrealizedPnlPct: Number(p.unrealizedProfitLossRate || 0) * 100,
        broker: "WEBULL",
      }));
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const status = url.searchParams.get("status") || "all";
      const statusMap: Record<string, string> = { all: "All", filled: "Filled", pending: "Working" };
      const data = await webullFetch(
        `/trading/v1/webull/order/list?secAccountId=${accountId}&startIndex=0&pageSize=50&status=${statusMap[status] || "All"}`,
        token, deviceId,
      );
      const orders = (data?.orders || data || []).map((o: any) => ({
        id: String(o.orderId || ""),
        symbol: o.ticker?.symbol || o.symbol || "",
        side: String(o.action || "").toLowerCase() === "buy" ? "buy" : "sell",
        type: String(o.orderType || "MKT").toLowerCase() === "mkt" ? "market" : String(o.orderType || "").toLowerCase() === "lmt" ? "limit" : "market",
        timeInForce: String(o.timeInForce || "DAY").toLowerCase(),
        qty: Number(o.totalQuantity || o.quantity || 0),
        filledQty: Number(o.filledQuantity || 0),
        limitPrice: o.lmtPrice ? Number(o.lmtPrice) : null,
        filledAvgPrice: o.avgFilledPrice ? Number(o.avgFilledPrice) : null,
        status: String(o.status || o.statusStr || "").toLowerCase(),
        createdAt: o.createTime0 || o.createTime || null,
        broker: "WEBULL",
      }));
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Webull request failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { token, accountId, deviceId } = resolveCredentials(req);
  if (!token || !accountId) {
    return NextResponse.json({ ok: false, error: "Webull credentials not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { symbol, qty, side, type, timeInForce, limitPrice, stopPrice, tickerId } = body;
    if (!symbol || !qty || !side) {
      return NextResponse.json({ ok: false, error: "Missing symbol, qty, or side" }, { status: 400 });
    }

    let tid = tickerId;
    if (!tid) {
      const search = await webullFetch(`/search/pc/tickers?keyword=${encodeURIComponent(String(symbol).toUpperCase())}&pageIndex=1&pageSize=1`, token, deviceId);
      tid = search?.data?.[0]?.tickerId;
      if (!tid) return NextResponse.json({ ok: false, error: `Could not resolve tickerId for ${symbol}` }, { status: 400 });
    }

    const t = String(type || "market").toLowerCase();
    const orderType = t === "limit" ? "LMT" : t === "stop" ? "STP" : t === "stop_limit" ? "STP LMT" : "MKT";
    const order: Record<string, any> = {
      action: String(side).toUpperCase(), comboType: "NORMAL", orderType,
      outsideRegularTradingHour: true, quantity: Number(qty),
      secAccountId: accountId, serialId: String(Date.now()),
      tickerId: Number(tid), timeInForce: String(timeInForce || "DAY").toUpperCase(),
    };
    if (limitPrice && (orderType === "LMT" || orderType === "STP LMT")) order.lmtPrice = Number(limitPrice);
    if (stopPrice && (orderType === "STP" || orderType === "STP LMT")) order.auxPrice = Number(stopPrice);

    const res = await fetch(`${BASE}/trading/v1/webull/order/place?secAccountId=${accountId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": token, did: deviceId, os: "web", hl: "en" },
      body: JSON.stringify(order),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ ok: false, error: data?.msg || `Webull ${res.status}`, data }, { status: res.status });

    return NextResponse.json({ ok: true, data: { id: String(data?.orderId || ""), symbol: String(symbol).toUpperCase(), side: String(side).toLowerCase(), type: t, qty: String(qty), status: "submitted", createdAt: new Date().toISOString() } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Order submission failed" }, { status: 500 });
  }
}
