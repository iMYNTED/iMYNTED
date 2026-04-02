// app/api/broker/alpaca/route.ts
import { NextResponse } from "next/server";

const BASE = process.env.ALPACA_BASE_URL || "https://paper-api.alpaca.markets";

function resolveCredentials(req: Request) {
  const key = process.env.ALPACA_API_KEY || req.headers.get("X-Alpaca-Key") || "";
  const secret = process.env.ALPACA_SECRET_KEY || req.headers.get("X-Alpaca-Secret") || "";
  return { key, secret };
}

function alpacaHeaders(key: string, secret: string) {
  return {
    "APCA-API-KEY-ID": key,
    "APCA-API-SECRET-KEY": secret,
    "Content-Type": "application/json",
  };
}

async function alpacaFetch(path: string, key: string, secret: string) {
  const res = await fetch(`${BASE}${path}`, { headers: alpacaHeaders(key, secret), cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Alpaca ${res.status}: ${text}`);
  }
  return res.json();
}

// GET /api/broker/alpaca?action=account|positions|orders|submit
export async function GET(req: Request) {
  const { key, secret } = resolveCredentials(req);
  if (!key || !secret) {
    return NextResponse.json({ ok: false, error: "Alpaca API keys not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    if (action === "account") {
      const data = await alpacaFetch("/v2/account", key, secret);
      return NextResponse.json({
        ok: true,
        data: {
          id: data.id,
          status: data.status,
          currency: data.currency,
          cash: Number(data.cash),
          buyingPower: Number(data.buying_power),
          portfolioValue: Number(data.portfolio_value),
          equity: Number(data.equity),
          lastEquity: Number(data.last_equity),
          longMarketValue: Number(data.long_market_value),
          shortMarketValue: Number(data.short_market_value),
          daytradeCount: Number(data.daytrade_count),
          tradingBlocked: data.trading_blocked,
          accountBlocked: data.account_blocked,
          patternDayTrader: data.pattern_day_trader,
        },
      });
    }

    if (action === "positions") {
      const data = await alpacaFetch("/v2/positions", key, secret);
      const positions = (data || []).map((p: any) => ({
        symbol: p.symbol,
        asset: p.asset_class === "crypto" ? "crypto" : "stock",
        side: p.side,
        qty: Number(p.qty),
        avgPrice: Number(p.avg_entry_price),
        lastPrice: Number(p.current_price),
        marketValue: Number(p.market_value),
        costBasis: Number(p.cost_basis),
        unrealizedPnl: Number(p.unrealized_pl),
        unrealizedPnlPct: Number(p.unrealized_plpc) * 100,
        changeToday: Number(p.change_today) * 100,
        broker: "ALPACA",
      }));
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const status = url.searchParams.get("status") || "all";
      const limit = url.searchParams.get("limit") || "50";
      const data = await alpacaFetch(`/v2/orders?status=${status}&limit=${limit}&direction=desc`, key, secret);
      const orders = (data || []).map((o: any) => ({
        id: o.id,
        symbol: o.symbol,
        side: o.side,
        type: o.type,
        timeInForce: o.time_in_force,
        qty: Number(o.qty || o.notional || 0),
        filledQty: Number(o.filled_qty || 0),
        limitPrice: o.limit_price ? Number(o.limit_price) : null,
        stopPrice: o.stop_price ? Number(o.stop_price) : null,
        filledAvgPrice: o.filled_avg_price ? Number(o.filled_avg_price) : null,
        status: o.status,
        createdAt: o.created_at,
        filledAt: o.filled_at,
        broker: "ALPACA",
      }));
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Alpaca request failed" }, { status: 500 });
  }
}

// POST /api/broker/alpaca — submit order
export async function POST(req: Request) {
  const { key, secret } = resolveCredentials(req);
  if (!key || !secret) {
    return NextResponse.json({ ok: false, error: "Alpaca API keys not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { symbol, qty, side, type, timeInForce, limitPrice, stopPrice } = body;

    if (!symbol || !qty || !side) {
      return NextResponse.json({ ok: false, error: "Missing symbol, qty, or side" }, { status: 400 });
    }

    const order: Record<string, any> = {
      symbol: String(symbol).toUpperCase(),
      qty: String(qty),
      side: String(side).toLowerCase(),
      type: String(type || "market").toLowerCase(),
      time_in_force: String(timeInForce || "day").toLowerCase(),
    };

    if (limitPrice && (order.type === "limit" || order.type === "stop_limit")) {
      order.limit_price = String(limitPrice);
    }
    if (stopPrice && (order.type === "stop" || order.type === "stop_limit")) {
      order.stop_price = String(stopPrice);
    }

    // Enable extended hours for day + limit orders
    if (order.time_in_force === "day" && (order.type === "limit" || order.type === "market")) {
      order.extended_hours = true;
    }

    const res = await fetch(`${BASE}/v2/orders`, {
      method: "POST",
      headers: alpacaHeaders(key, secret),
      body: JSON.stringify(order),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: data?.message || `Alpaca ${res.status}`, data }, { status: res.status });
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: data.id,
        symbol: data.symbol,
        side: data.side,
        type: data.type,
        qty: data.qty,
        status: data.status,
        createdAt: data.created_at,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Order submission failed" }, { status: 500 });
  }
}
