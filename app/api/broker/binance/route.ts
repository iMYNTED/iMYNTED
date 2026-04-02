// app/api/broker/binance/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

const BASE = "https://api.binance.us/api/v3";

function resolveCredentials(req: Request) {
  const key = process.env.BINANCE_API_KEY || req.headers.get("X-Binance-Key") || "";
  const secret = process.env.BINANCE_API_SECRET || req.headers.get("X-Binance-Secret") || "";
  return { key, secret };
}

function sign(queryString: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(queryString).digest("hex");
}

async function binanceFetch(path: string, key: string, secret: string, extraParams = "") {
  const timestamp = Date.now();
  const qs = `${extraParams ? extraParams + "&" : ""}timestamp=${timestamp}&recvWindow=10000`;
  const signature = sign(qs, secret);
  const url = `${BASE}${path}?${qs}&signature=${signature}`;
  const res = await fetch(url, { headers: { "X-MBX-APIKEY": key }, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Binance ${res.status}: ${text}`);
  }
  return res.json();
}

export async function GET(req: Request) {
  const { key, secret } = resolveCredentials(req);
  if (!key || !secret) return NextResponse.json({ ok: false, error: "Binance API keys not configured" }, { status: 500 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    if (action === "account") {
      const data = await binanceFetch("/account", key, secret);
      const balances = data?.balances || [];
      const usd = balances.find((b: any) => ["USD", "USDT", "BUSD", "USDC"].includes(b.asset));
      const cash = Number(usd?.free ?? 0);
      return NextResponse.json({ ok: true, data: { cash, buyingPower: cash, equity: cash, tradingEnabled: !!data?.canTrade } });
    }

    if (action === "positions") {
      const data = await binanceFetch("/account", key, secret);
      const positions = (data?.balances || [])
        .filter((b: any) => Number(b.free) + Number(b.locked) > 0 && !["USD", "USDT", "BUSD", "USDC"].includes(b.asset))
        .map((b: any) => ({
          symbol: `${b.asset}-USD`,
          qty: Number(b.free) + Number(b.locked),
          avgPrice: 0, lastPrice: 0, marketValue: 0, unrealizedPnl: 0, unrealizedPnlPct: 0, broker: "BINANCE",
        }));
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const sym = url.searchParams.get("symbol") || "";
      if (!sym) return NextResponse.json({ ok: true, data: [] });
      const pair = sym.toUpperCase().replace("-USD", "").replace("-", "") + "USDT";
      const data = await binanceFetch("/allOrders", key, secret, `symbol=${pair}&limit=50`);
      const orders = (data || []).map((o: any) => ({
        id: String(o.orderId ?? ""),
        symbol: `${String(o.symbol ?? "").replace("USDT", "")}-USD`,
        side: String(o.side ?? "").toLowerCase(),
        type: String(o.type ?? "MARKET").toLowerCase() === "limit" ? "limit" : "market",
        timeInForce: String(o.timeInForce ?? "GTC").toLowerCase(),
        qty: Number(o.origQty ?? 0),
        filledQty: Number(o.executedQty ?? 0),
        limitPrice: o.price && Number(o.price) > 0 ? Number(o.price) : null,
        filledAvgPrice: Number(o.executedQty) > 0 && o.cummulativeQuoteQty ? Number(o.cummulativeQuoteQty) / Number(o.executedQty) : null,
        status: String(o.status ?? "").toLowerCase(),
        createdAt: o.time ? new Date(o.time).toISOString() : null,
        broker: "BINANCE",
      }));
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Binance request failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { key, secret } = resolveCredentials(req);
  if (!key || !secret) return NextResponse.json({ ok: false, error: "Binance API keys not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { symbol, qty, side, type, timeInForce, limitPrice, stopPrice } = body;
    if (!symbol || !qty || !side) return NextResponse.json({ ok: false, error: "Missing symbol, qty, or side" }, { status: 400 });

    const pair = String(symbol).toUpperCase().replace("-USD", "").replace("-", "") + "USDT";
    const orderType = String(type || "market").toUpperCase() === "LIMIT" ? "LIMIT" : "MARKET";

    const params = new URLSearchParams();
    params.set("symbol", pair);
    params.set("side", String(side).toUpperCase());
    params.set("type", orderType);
    params.set("quantity", String(qty));
    if (orderType !== "MARKET") params.set("timeInForce", String(timeInForce || "GTC").toUpperCase());
    if (limitPrice && orderType === "LIMIT") params.set("price", String(limitPrice));
    if (stopPrice) params.set("stopPrice", String(stopPrice));

    const timestamp = Date.now();
    params.set("timestamp", String(timestamp));
    params.set("recvWindow", "10000");
    params.set("signature", sign(params.toString(), secret));

    const res = await fetch(`${BASE}/order?${params.toString()}`, { method: "POST", headers: { "X-MBX-APIKEY": key } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ ok: false, error: data?.msg || `Binance ${res.status}`, data }, { status: res.status });

    return NextResponse.json({ ok: true, data: { id: String(data.orderId ?? ""), symbol: `${String(data.symbol ?? "").replace("USDT", "")}-USD`, side: String(side).toLowerCase(), type: String(type || "market").toLowerCase(), qty: String(data.origQty ?? qty), status: String(data.status ?? "submitted").toLowerCase(), createdAt: data.transactTime ? new Date(data.transactTime).toISOString() : new Date().toISOString() } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Order submission failed" }, { status: 500 });
  }
}
