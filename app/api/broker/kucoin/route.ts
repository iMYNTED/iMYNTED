// app/api/broker/kucoin/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

const BASE = "https://api.kucoin.com";

async function kucoinFetch(path: string, key: string, secret: string, passphrase: string) {
  const timestamp = Date.now().toString();
  const preHash = `${timestamp}GET${path}`;
  const signature = crypto.createHmac("sha256", secret).update(preHash).digest("base64");
  const passphraseEnc = crypto.createHmac("sha256", secret).update(passphrase).digest("base64");
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "KC-API-KEY": key, "KC-API-SIGN": signature,
      "KC-API-TIMESTAMP": timestamp, "KC-API-PASSPHRASE": passphraseEnc,
      "KC-API-KEY-VERSION": "2", "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KuCoin ${res.status}`);
  const json = await res.json();
  if (json.code !== "200000") throw new Error(json.msg || `KuCoin error ${json.code}`);
  return json.data;
}

export async function GET(req: Request) {
  const key = process.env.KUCOIN_API_KEY || req.headers.get("X-KuCoin-Key") || "";
  const secret = process.env.KUCOIN_SECRET_KEY || req.headers.get("X-KuCoin-Secret") || "";
  const passphrase = process.env.KUCOIN_PASSPHRASE || req.headers.get("X-KuCoin-Passphrase") || "";
  if (!key || !secret || !passphrase) return NextResponse.json({ ok: false, error: "KuCoin API keys not configured" }, { status: 500 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    if (action === "account") {
      const data = await kucoinFetch("/api/v1/accounts?type=trade", key, secret, passphrase);
      const usdt = (data || []).find((a: any) => a.currency === "USDT");
      const cash = Number(usdt?.available ?? 0);
      return NextResponse.json({ ok: true, data: { cash, buyingPower: cash, equity: cash } });
    }

    if (action === "positions") {
      const data = await kucoinFetch("/api/v1/accounts?type=trade", key, secret, passphrase);
      const positions = (data || [])
        .filter((a: any) => Number(a.balance) > 0 && a.currency !== "USDT")
        .map((a: any) => ({
          symbol: a.currency, qty: Number(a.balance),
          avgPrice: 0, lastPrice: 0, marketValue: 0, unrealizedPnl: 0, unrealizedPnlPct: 0, broker: "KUCOIN",
        }));
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const data = await kucoinFetch("/api/v1/orders?status=active", key, secret, passphrase);
      const orders = (data?.items || []).map((o: any) => ({
        id: o.id, symbol: o.symbol,
        side: o.side, type: o.type, timeInForce: o.timeInForce,
        qty: Number(o.size), filledQty: Number(o.dealSize ?? 0),
        limitPrice: o.price ? Number(o.price) : null,
        filledAvgPrice: o.dealFunds && o.dealSize ? Number(o.dealFunds) / Number(o.dealSize) : null,
        status: o.isActive ? "new" : "filled",
        createdAt: new Date(o.createdAt).toISOString(), broker: "KUCOIN",
      }));
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "KuCoin request failed" }, { status: 500 });
  }
}
