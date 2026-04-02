// app/api/broker/gemini/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

const BASE = "https://api.gemini.com";

async function geminiFetch(path: string, key: string, secret: string, extra: Record<string, any> = {}) {
  const nonce = Date.now().toString();
  const fullPayload = { request: path, nonce, ...extra };
  const b64 = Buffer.from(JSON.stringify(fullPayload)).toString("base64");
  const signature = crypto.createHmac("sha384", secret).update(b64).digest("hex");
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "X-GEMINI-APIKEY": key, "X-GEMINI-PAYLOAD": b64, "X-GEMINI-SIGNATURE": signature, "Content-Length": "0" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${text}`);
  }
  return res.json();
}

export async function GET(req: Request) {
  const key = process.env.GEMINI_API_KEY || req.headers.get("X-Gemini-Key") || "";
  const secret = process.env.GEMINI_SECRET_KEY || req.headers.get("X-Gemini-Secret") || "";
  if (!key || !secret) return NextResponse.json({ ok: false, error: "Gemini API keys not configured" }, { status: 500 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    if (action === "account") {
      const data = await geminiFetch("/v1/balances", key, secret);
      const usd = (data || []).find((b: any) => b.currency === "USD");
      const cash = Number(usd?.available ?? 0);
      return NextResponse.json({ ok: true, data: { cash, buyingPower: cash, equity: cash } });
    }

    if (action === "positions") {
      const data = await geminiFetch("/v1/balances", key, secret);
      const positions = (data || [])
        .filter((b: any) => Number(b.amount) > 0 && b.currency !== "USD")
        .map((b: any) => ({
          symbol: b.currency, qty: Number(b.amount),
          avgPrice: 0, lastPrice: 0, marketValue: 0, unrealizedPnl: 0, unrealizedPnlPct: 0, broker: "GEMINI",
        }));
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const data = await geminiFetch("/v1/orders", key, secret);
      const orders = (data || []).map((o: any) => ({
        id: String(o.order_id), symbol: o.symbol.toUpperCase(),
        side: o.side, type: o.type, timeInForce: "day",
        qty: Number(o.original_amount), filledQty: Number(o.executed_amount ?? 0),
        limitPrice: o.price ? Number(o.price) : null,
        filledAvgPrice: o.avg_execution_price ? Number(o.avg_execution_price) : null,
        status: o.is_live ? "new" : o.is_cancelled ? "canceled" : "filled",
        createdAt: new Date(o.timestampms).toISOString(), broker: "GEMINI",
      }));
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Gemini request failed" }, { status: 500 });
  }
}
