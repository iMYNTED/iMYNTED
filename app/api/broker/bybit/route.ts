// app/api/broker/bybit/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

const BASE = "https://api.bybit.com";

async function bybitFetch(path: string, key: string, secret: string, params: Record<string, string> = {}) {
  const timestamp = Date.now().toString();
  const recvWindow = "5000";
  const queryString = new URLSearchParams(params).toString();
  const signStr = `${timestamp}${key}${recvWindow}${queryString}`;
  const signature = crypto.createHmac("sha256", secret).update(signStr).digest("hex");
  const url = `${BASE}${path}${queryString ? "?" + queryString : ""}`;
  const res = await fetch(url, {
    headers: {
      "X-BAPI-API-KEY": key, "X-BAPI-SIGN": signature,
      "X-BAPI-TIMESTAMP": timestamp, "X-BAPI-RECV-WINDOW": recvWindow,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bybit ${res.status}`);
  const json = await res.json();
  if (json.retCode !== 0) throw new Error(json.retMsg || `Bybit error ${json.retCode}`);
  return json.result;
}

export async function GET(req: Request) {
  const key = process.env.BYBIT_API_KEY || req.headers.get("X-Bybit-Key") || "";
  const secret = process.env.BYBIT_SECRET_KEY || req.headers.get("X-Bybit-Secret") || "";
  if (!key || !secret) return NextResponse.json({ ok: false, error: "Bybit API keys not configured" }, { status: 500 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    if (action === "account") {
      const data = await bybitFetch("/v5/account/wallet-balance", key, secret, { accountType: "UNIFIED" });
      const list = data?.list?.[0];
      const totalEquity = Number(list?.totalEquity ?? 0);
      const totalAvail = Number(list?.totalAvailableBalance ?? 0);
      return NextResponse.json({ ok: true, data: { cash: totalAvail, buyingPower: totalAvail, equity: totalEquity } });
    }

    if (action === "positions") {
      const data = await bybitFetch("/v5/account/wallet-balance", key, secret, { accountType: "UNIFIED" });
      const coins = data?.list?.[0]?.coin || [];
      const positions = coins
        .filter((c: any) => Number(c.walletBalance) > 0 && c.coin !== "USDT")
        .map((c: any) => ({
          symbol: c.coin, qty: Number(c.walletBalance),
          avgPrice: Number(c.avgPrice ?? 0),
          lastPrice: Number(c.walletBalance) > 0 ? Number(c.usdValue ?? 0) / Number(c.walletBalance) : 0,
          marketValue: Number(c.usdValue ?? 0),
          unrealizedPnl: Number(c.unrealisedPnl ?? 0), unrealizedPnlPct: 0, broker: "BYBIT",
        }));
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const data = await bybitFetch("/v5/order/realtime", key, secret, { category: "spot", limit: "50" });
      const orders = (data?.list || []).map((o: any) => ({
        id: o.orderId, symbol: o.symbol,
        side: o.side.toLowerCase(), type: o.orderType.toLowerCase(), timeInForce: o.timeInForce,
        qty: Number(o.qty), filledQty: Number(o.cumExecQty ?? 0),
        limitPrice: o.price ? Number(o.price) : null,
        filledAvgPrice: o.avgPrice ? Number(o.avgPrice) : null,
        status: o.orderStatus === "Filled" ? "filled" : o.orderStatus === "PartiallyFilled" ? "partially_filled" : o.orderStatus === "Cancelled" ? "canceled" : "new",
        createdAt: new Date(Number(o.createdTime)).toISOString(), broker: "BYBIT",
      }));
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Bybit request failed" }, { status: 500 });
  }
}
