// app/api/broker/kraken/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

const BASE = "https://api.kraken.com";

async function krakenPrivate(path: string, key: string, secret: string, params: Record<string, string> = {}) {
  const nonce = Date.now().toString();
  const data = new URLSearchParams({ nonce, ...params }).toString();
  const secretBuffer = Buffer.from(secret, "base64");
  const hash = crypto.createHash("sha256").update(nonce + data).digest();
  const signature = crypto.createHmac("sha512", secretBuffer)
    .update(Buffer.concat([Buffer.from(path), hash]))
    .digest("base64");
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "API-Key": key, "API-Sign": signature, "Content-Type": "application/x-www-form-urlencoded" },
    body: data, cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kraken ${res.status}`);
  const json = await res.json();
  if (json.error?.length) throw new Error(json.error[0]);
  return json.result;
}

export async function GET(req: Request) {
  const key = process.env.KRAKEN_API_KEY || req.headers.get("X-Kraken-Key") || "";
  const secret = process.env.KRAKEN_SECRET_KEY || req.headers.get("X-Kraken-Secret") || "";
  if (!key || !secret) return NextResponse.json({ ok: false, error: "Kraken API keys not configured" }, { status: 500 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    if (action === "account") {
      const [balance, tradeBalance] = await Promise.all([
        krakenPrivate("/0/private/Balance", key, secret),
        krakenPrivate("/0/private/TradeBalance", key, secret),
      ]);
      const cash = Number(balance?.ZUSD ?? balance?.USD ?? 0);
      const equity = Number(tradeBalance?.e ?? 0);
      return NextResponse.json({ ok: true, data: { cash, buyingPower: cash, equity: equity || cash } });
    }

    if (action === "positions") {
      const balance = await krakenPrivate("/0/private/Balance", key, secret);
      const positions = Object.entries(balance || {})
        .filter(([asset, amt]) => Number(amt) > 0 && !["ZUSD", "USD", "ZEUR", "EUR", "USDT"].includes(asset))
        .map(([asset, amt]) => ({
          symbol: asset.replace(/^[XZ]/, ""), qty: Number(amt),
          avgPrice: 0, lastPrice: 0, marketValue: 0, unrealizedPnl: 0, unrealizedPnlPct: 0, broker: "KRAKEN",
        }));
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const data = await krakenPrivate("/0/private/OpenOrders", key, secret);
      const orders = Object.entries(data?.open || {}).map(([id, o]: [string, any]) => ({
        id, symbol: o.descr?.pair || "",
        side: o.descr?.type, type: o.descr?.ordertype, timeInForce: "day",
        qty: Number(o.vol), filledQty: Number(o.vol_exec ?? 0),
        limitPrice: o.descr?.price ? Number(o.descr.price) : null,
        filledAvgPrice: Number(o.price || 0) || null,
        status: "new", createdAt: new Date(o.opentm * 1000).toISOString(), broker: "KRAKEN",
      }));
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Kraken request failed" }, { status: 500 });
  }
}
