// app/api/broker/okx/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

const BASE = "https://www.okx.com";

async function okxFetch(path: string, key: string, secret: string, passphrase: string) {
  const timestamp = new Date().toISOString();
  const preHash = `${timestamp}GET${path}`;
  const signature = crypto.createHmac("sha256", secret).update(preHash).digest("base64");
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "OK-ACCESS-KEY": key, "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp, "OK-ACCESS-PASSPHRASE": passphrase,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OKX ${res.status}`);
  const json = await res.json();
  if (json.code !== "0") throw new Error(json.msg || `OKX error ${json.code}`);
  return json.data;
}

export async function GET(req: Request) {
  const key = process.env.OKX_API_KEY || req.headers.get("X-OKX-Key") || "";
  const secret = process.env.OKX_SECRET_KEY || req.headers.get("X-OKX-Secret") || "";
  const passphrase = process.env.OKX_PASSPHRASE || req.headers.get("X-OKX-Passphrase") || "";
  if (!key || !secret || !passphrase) return NextResponse.json({ ok: false, error: "OKX API keys not configured" }, { status: 500 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    if (action === "account") {
      const data = await okxFetch("/api/v5/account/balance", key, secret, passphrase);
      const totalEq = Number(data?.[0]?.totalEq ?? 0);
      const usdtDet = (data?.[0]?.details || []).find((d: any) => d.ccy === "USDT");
      const cash = Number(usdtDet?.availBal ?? 0);
      return NextResponse.json({ ok: true, data: { cash, buyingPower: cash, equity: totalEq } });
    }

    if (action === "positions") {
      const data = await okxFetch("/api/v5/account/balance", key, secret, passphrase);
      const details = data?.[0]?.details || [];
      const positions = details
        .filter((d: any) => Number(d.bal) > 0 && d.ccy !== "USDT")
        .map((d: any) => ({
          symbol: d.ccy, qty: Number(d.bal),
          avgPrice: 0,
          lastPrice: Number(d.bal) > 0 ? Number(d.usdValue ?? 0) / Number(d.bal) : 0,
          marketValue: Number(d.usdValue ?? 0), unrealizedPnl: 0, unrealizedPnlPct: 0, broker: "OKX",
        }));
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const data = await okxFetch("/api/v5/trade/orders-pending?instType=SPOT", key, secret, passphrase);
      const orders = (data || []).map((o: any) => ({
        id: o.ordId, symbol: o.instId,
        side: o.side, type: o.ordType, timeInForce: "day",
        qty: Number(o.sz), filledQty: Number(o.fillSz ?? 0),
        limitPrice: o.px ? Number(o.px) : null,
        filledAvgPrice: o.avgPx ? Number(o.avgPx) : null,
        status: o.state === "filled" ? "filled" : o.state === "partially_filled" ? "partially_filled" : o.state === "canceled" ? "canceled" : "new",
        createdAt: new Date(Number(o.cTime)).toISOString(), broker: "OKX",
      }));
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "OKX request failed" }, { status: 500 });
  }
}
