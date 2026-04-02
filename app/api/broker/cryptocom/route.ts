// app/api/broker/cryptocom/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

const BASE = "https://api.crypto.com/exchange/v1";

function buildSig(method: string, id: number, apiKey: string, params: Record<string, any>, nonce: number, secret: string) {
  const paramStr = Object.keys(params).sort().map(k => `${k}${params[k]}`).join("");
  const payload = `${method}${id}${apiKey}${paramStr}${nonce}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function ccdFetch(method: string, key: string, secret: string, params: Record<string, any> = {}) {
  const id = 1;
  const nonce = Date.now();
  const sig = buildSig(method, id, key, params, nonce, secret);
  const endpoint = method.startsWith("private/") ? method.slice("private/".length) : method;
  const res = await fetch(`${BASE}/private/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, method, api_key: key, params, nonce, sig }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Crypto.com ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || `Crypto.com error ${json.code}`);
  return json.result;
}

export async function GET(req: Request) {
  const key = process.env.CRYPTOCOM_API_KEY || req.headers.get("X-CryptoCom-Key") || "";
  const secret = process.env.CRYPTOCOM_SECRET_KEY || req.headers.get("X-CryptoCom-Secret") || "";
  if (!key || !secret) return NextResponse.json({ ok: false, error: "Crypto.com API keys not configured" }, { status: 500 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    if (action === "account") {
      const data = await ccdFetch("private/get-account-summary", key, secret);
      const accounts: any[] = data?.accounts || [];
      const usd = accounts.find(a => ["USD", "USDC", "USDT"].includes(a.currency));
      const cash = Number(usd?.available ?? 0);
      const equity = accounts.reduce((s, a) => s + Number(a.balance ?? 0), 0);
      return NextResponse.json({ ok: true, data: { cash, buyingPower: cash, equity } });
    }

    if (action === "positions") {
      const data = await ccdFetch("private/get-account-summary", key, secret);
      const positions = (data?.accounts || [])
        .filter((a: any) => Number(a.balance) > 0 && !["USD", "USDC", "USDT"].includes(a.currency))
        .map((a: any) => ({
          symbol: a.currency,
          qty: Number(a.balance ?? 0),
          avgPrice: 0, lastPrice: 0, marketValue: 0, unrealizedPnl: 0, unrealizedPnlPct: 0, broker: "CRYPTOCOM",
        }));
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const data = await ccdFetch("private/get-open-orders", key, secret);
      const orders = (data?.order_list || []).map((o: any) => ({
        id: String(o.order_id ?? ""),
        symbol: o.instrument_name ?? "",
        side: o.side?.toLowerCase() === "sell" ? "sell" : "buy",
        type: o.type?.toLowerCase() === "limit" ? "limit" : "market",
        timeInForce: "day",
        qty: Number(o.quantity ?? 0),
        filledQty: Number(o.cumulative_quantity ?? 0),
        limitPrice: o.price ? Number(o.price) : null,
        filledAvgPrice: o.avg_price ? Number(o.avg_price) : null,
        status: o.status?.toLowerCase() === "active" ? "new" : o.status?.toLowerCase() === "filled" ? "filled" : o.status?.toLowerCase() === "cancelled" ? "canceled" : "new",
        createdAt: o.create_time ? new Date(o.create_time).toISOString() : null,
        broker: "CRYPTOCOM",
      }));
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Crypto.com request failed" }, { status: 500 });
  }
}
