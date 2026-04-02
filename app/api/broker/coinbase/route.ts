// app/api/broker/coinbase/route.ts
// Coinbase Advanced Trade API integration
import { NextResponse } from "next/server";
import crypto from "crypto";

const BASE = "https://api.coinbase.com";

function resolveCredentials(req: Request) {
  const key = process.env.COINBASE_API_KEY || req.headers.get("X-Coinbase-Key") || "";
  const secret = process.env.COINBASE_API_SECRET || req.headers.get("X-Coinbase-Secret") || "";
  return { key, secret };
}

function sign(timestamp: string, method: string, path: string, body: string, secret: string) {
  const message = timestamp + method.toUpperCase() + path + body;
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

async function coinbaseFetch(path: string, key: string, secret: string, method = "GET", body = "") {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = sign(timestamp, method, path, body, secret);
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "CB-ACCESS-KEY": key, "CB-ACCESS-SIGN": signature, "CB-ACCESS-TIMESTAMP": timestamp, "Content-Type": "application/json" },
    body: method === "GET" ? undefined : body || undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Coinbase ${res.status}: ${text}`);
  }
  return res.json();
}

// GET /api/broker/coinbase?action=account|positions|orders
export async function GET(req: Request) {
  const { key, secret } = resolveCredentials(req);
  if (!key || !secret) {
    return NextResponse.json({ ok: false, error: "Coinbase API keys not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    if (action === "account") {
      const data = await coinbaseFetch("/api/v3/brokerage/accounts", key, secret);
      const accounts = data?.accounts || [];
      let totalBalance = 0;
      let totalHold = 0;
      for (const a of accounts) {
        totalBalance += Number(a.available_balance?.value || 0);
        totalHold += Number(a.hold?.value || 0);
      }
      const usdAcct = accounts.find((a: any) => a.currency === "USD") || {};
      return NextResponse.json({
        ok: true,
        data: {
          id: usdAcct.uuid || accounts[0]?.uuid || "",
          status: "active",
          currency: "USD",
          cash: Number(usdAcct.available_balance?.value || 0),
          buyingPower: Number(usdAcct.available_balance?.value || 0),
          portfolioValue: totalBalance + totalHold,
          equity: totalBalance + totalHold,
          lastEquity: totalBalance + totalHold,
          longMarketValue: totalHold,
          shortMarketValue: 0,
          daytradeCount: 0,
          tradingBlocked: false,
          accountBlocked: false,
          patternDayTrader: false,
        },
      });
    }

    if (action === "positions") {
      const data = await coinbaseFetch("/api/v3/brokerage/accounts", key, secret);
      const accounts = data?.accounts || [];
      const positions = accounts
        .filter((a: any) => a.currency !== "USD" && Number(a.available_balance?.value || 0) > 0)
        .map((a: any) => {
          const qty = Number(a.available_balance?.value || 0) + Number(a.hold?.value || 0);
          return {
            symbol: `${a.currency}-USD`,
            asset: "crypto",
            side: "long",
            qty,
            avgPrice: 0, // Coinbase doesn't provide avg cost via this endpoint
            lastPrice: 0,
            marketValue: 0,
            costBasis: 0,
            unrealizedPnl: 0,
            unrealizedPnlPct: 0,
            changeToday: 0,
            broker: "COINBASE",
          };
        });
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const status = url.searchParams.get("status") || "";
      const qs = status ? `?order_status=${status.toUpperCase()}` : "";
      const data = await coinbaseFetch(`/api/v3/brokerage/orders/historical/batch${qs}`, key, secret);
      const orders = (data?.orders || []).map((o: any) => {
        const cfg = o.order_configuration || {};
        const limitGtc = cfg.limit_limit_gtc || {};
        const limitGtd = cfg.limit_limit_gtd || {};
        const marketIoc = cfg.market_market_ioc || {};
        const stopLimit = cfg.stop_limit_stop_limit_gtc || cfg.stop_limit_stop_limit_gtd || {};
        return {
          id: o.order_id || "",
          symbol: o.product_id || "",
          side: String(o.side || "").toLowerCase(),
          type: cfg.market_market_ioc ? "market"
              : cfg.limit_limit_gtc || cfg.limit_limit_gtd ? "limit"
              : cfg.stop_limit_stop_limit_gtc || cfg.stop_limit_stop_limit_gtd ? "stop_limit"
              : "market",
          timeInForce: cfg.limit_limit_gtd || cfg.stop_limit_stop_limit_gtd ? "gtd" : "gtc",
          qty: Number(marketIoc.quote_size || marketIoc.base_size || limitGtc.base_size || limitGtd.base_size || stopLimit.base_size || 0),
          filledQty: Number(o.filled_size || 0),
          limitPrice: Number(limitGtc.limit_price || limitGtd.limit_price || stopLimit.limit_price || 0) || null,
          stopPrice: Number(stopLimit.stop_price || 0) || null,
          filledAvgPrice: Number(o.average_filled_price || 0) || null,
          status: String(o.status || "").toLowerCase(),
          createdAt: o.created_time || null,
          filledAt: o.status === "FILLED" ? (o.last_fill_time || null) : null,
          broker: "COINBASE",
        };
      });
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Coinbase request failed" }, { status: 500 });
  }
}

// POST /api/broker/coinbase — submit order
export async function POST(req: Request) {
  const { key, secret } = resolveCredentials(req);
  if (!key || !secret) {
    return NextResponse.json({ ok: false, error: "Coinbase API keys not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { symbol, qty, side, type, limitPrice, stopPrice } = body;

    if (!symbol || !qty || !side) {
      return NextResponse.json({ ok: false, error: "Missing symbol, qty, or side" }, { status: 400 });
    }

    const productId = String(symbol).toUpperCase().includes("-") ? String(symbol).toUpperCase() : `${String(symbol).toUpperCase()}-USD`;

    let orderConfiguration: Record<string, any> = {};
    const orderType = String(type || "market").toLowerCase();

    if (orderType === "market") {
      orderConfiguration = {
        market_market_ioc: {
          base_size: String(qty),
        },
      };
    } else if (orderType === "limit") {
      orderConfiguration = {
        limit_limit_gtc: {
          base_size: String(qty),
          limit_price: String(limitPrice),
        },
      };
    } else if (orderType === "stop_limit") {
      orderConfiguration = {
        stop_limit_stop_limit_gtc: {
          base_size: String(qty),
          limit_price: String(limitPrice),
          stop_price: String(stopPrice),
        },
      };
    }

    const order = {
      client_order_id: crypto.randomUUID(),
      product_id: productId,
      side: String(side).toUpperCase(),
      order_configuration: orderConfiguration,
    };

    const path = "/api/v3/brokerage/orders";
    const data = await coinbaseFetch(path, key, secret, "POST", JSON.stringify(order));

    if (!data?.success) {
      return NextResponse.json(
        { ok: false, error: data?.error_response?.message || data?.failure_reason || "Order failed", data },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: data.order_id || data.success_response?.order_id || "",
        symbol: productId,
        side: String(side).toLowerCase(),
        type: orderType,
        qty: String(qty),
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Order submission failed" }, { status: 500 });
  }
}
