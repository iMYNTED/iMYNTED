// app/api/broker/schwab/route.ts
import { NextResponse } from "next/server";

const BASE = "https://api.schwabapi.com/trader/v1";

function resolveCredentials(req: Request) {
  const token = process.env.SCHWAB_ACCESS_TOKEN || req.headers.get("X-Schwab-Token") || "";
  const accountHash = process.env.SCHWAB_ACCOUNT_HASH || req.headers.get("X-Schwab-Account") || "";
  return { token, accountHash };
}

async function schwabFetch(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Schwab ${res.status}: ${text}`);
  }
  return res.json();
}

export async function GET(req: Request) {
  const { token, accountHash } = resolveCredentials(req);
  if (!token || !accountHash) {
    return NextResponse.json({ ok: false, error: "Schwab credentials not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    if (action === "account") {
      const data = await schwabFetch(`/accounts/${accountHash}?fields=positions`, token);
      const acct = data?.securitiesAccount || data;
      const bal = acct?.currentBalances || acct?.initialBalances || {};
      return NextResponse.json({
        ok: true,
        data: {
          cash: Number(bal.cashBalance || bal.totalCash || 0),
          buyingPower: Number(bal.buyingPower || bal.dayTradingBuyingPower || 0),
          equity: Number(bal.equity || bal.liquidationValue || 0),
        },
      });
    }

    if (action === "positions") {
      const data = await schwabFetch(`/accounts/${accountHash}?fields=positions`, token);
      const acct = data?.securitiesAccount || data;
      const positions = (acct?.positions || []).map((p: any) => {
        const inst = p.instrument || {};
        const qty = Number(p.longQuantity || 0) - Number(p.shortQuantity || 0);
        return {
          symbol: inst.symbol || "",
          qty: Math.abs(qty),
          avgPrice: Number(p.averagePrice || 0),
          lastPrice: Number(p.marketValue || 0) / Math.abs(qty || 1),
          marketValue: Number(p.marketValue || 0),
          unrealizedPnl: Number(p.longOpenProfitLoss || p.shortOpenProfitLoss || 0),
          unrealizedPnlPct: Number(p.averagePrice)
            ? ((Number(p.marketValue || 0) / Math.abs(qty || 1) - Number(p.averagePrice)) / Number(p.averagePrice)) * 100
            : 0,
          broker: "SCHWAB",
        };
      });
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const data = await schwabFetch(`/accounts/${accountHash}/orders`, token);
      const orders = (Array.isArray(data) ? data : []).map((o: any) => {
        const leg = o.orderLegCollection?.[0] || {};
        const inst = leg.instrument || {};
        return {
          id: String(o.orderId || ""),
          symbol: inst.symbol || "",
          side: String(leg.instruction || "").toLowerCase().includes("buy") ? "buy" : "sell",
          type: String(o.orderType || "MARKET").toLowerCase(),
          timeInForce: String(o.duration || "DAY").toLowerCase(),
          qty: Number(o.quantity || leg.quantity || 0),
          filledQty: Number(o.filledQuantity || 0),
          limitPrice: o.price ? Number(o.price) : null,
          filledAvgPrice: o.filledQuantity > 0 && o.orderActivityCollection?.[0]?.executionLegs?.[0]?.price
            ? Number(o.orderActivityCollection[0].executionLegs[0].price) : null,
          status: String(o.status || "").toLowerCase(),
          createdAt: o.enteredTime || null,
          broker: "SCHWAB",
        };
      });
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Schwab request failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { token, accountHash } = resolveCredentials(req);
  if (!token || !accountHash) {
    return NextResponse.json({ ok: false, error: "Schwab credentials not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { symbol, qty, side, type, timeInForce, limitPrice, stopPrice } = body;
    if (!symbol || !qty || !side) {
      return NextResponse.json({ ok: false, error: "Missing symbol, qty, or side" }, { status: 400 });
    }

    const orderType = String(type || "market").toUpperCase() === "LIMIT" ? "LIMIT"
      : String(type || "market").toUpperCase() === "STOP" ? "STOP"
      : String(type || "market").toUpperCase() === "STOP_LIMIT" ? "STOP_LIMIT"
      : "MARKET";

    const order: Record<string, any> = {
      orderType, session: "NORMAL",
      duration: String(timeInForce || "DAY").toUpperCase(),
      orderStrategyType: "SINGLE",
      orderLegCollection: [{ instruction: String(side).toUpperCase() === "BUY" ? "BUY" : "SELL", quantity: Number(qty), instrument: { symbol: String(symbol).toUpperCase(), assetType: "EQUITY" } }],
    };
    if (limitPrice && (orderType === "LIMIT" || orderType === "STOP_LIMIT")) order.price = Number(limitPrice);
    if (stopPrice && (orderType === "STOP" || orderType === "STOP_LIMIT")) order.stopPrice = Number(stopPrice);

    const res = await fetch(`${BASE}/accounts/${accountHash}/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(order),
    });

    if (res.status === 201) {
      const orderId = (res.headers.get("Location") || "").split("/").pop() || "";
      return NextResponse.json({ ok: true, data: { id: orderId, symbol: String(symbol).toUpperCase(), side: String(side).toLowerCase(), type: String(type || "market").toLowerCase(), qty: String(qty), status: "pending", createdAt: new Date().toISOString() } });
    }
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: false, error: data?.message || `Schwab ${res.status}`, data }, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Order submission failed" }, { status: 500 });
  }
}
