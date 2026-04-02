// app/api/broker/tastytrade/route.ts
import { NextResponse } from "next/server";

const BASE = "https://api.tastytrade.com";

async function getSessionToken(login: string, password: string) {
  const res = await fetch(`${BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password, "remember-me": false }),
    cache: "no-store",
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error?.message || `Tastytrade login ${res.status}`);
  }
  const j = await res.json();
  const token = j?.data?.["session-token"];
  if (!token) throw new Error("No session token returned");
  return token as string;
}

async function tastyFetch(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: token, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tastytrade ${res.status}: ${text}`);
  }
  return res.json();
}

async function getAccountNumber(token: string) {
  const data = await tastyFetch("/customers/me/accounts", token);
  const accounts = data?.data?.items || [];
  if (!accounts.length) throw new Error("No accounts found");
  return accounts[0]?.account?.["account-number"] as string;
}

export async function GET(req: Request) {
  const login = process.env.TASTYTRADE_LOGIN || req.headers.get("X-Tastytrade-Login") || "";
  const password = process.env.TASTYTRADE_PASSWORD || req.headers.get("X-Tastytrade-Password") || "";
  if (!login || !password) return NextResponse.json({ ok: false, error: "Tastytrade credentials not configured" }, { status: 500 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    const token = await getSessionToken(login, password);

    if (action === "account") {
      const accountNumber = await getAccountNumber(token);
      const balData = await tastyFetch(`/accounts/${accountNumber}/balances`, token);
      const b = balData?.data;
      return NextResponse.json({
        ok: true,
        data: {
          cash: Number(b?.["cash-balance"] ?? 0),
          buyingPower: Number(b?.["derivative-buying-power"] ?? b?.["option-buying-power"] ?? b?.["cash-balance"] ?? 0),
          equity: Number(b?.["net-liquidating-value"] ?? 0),
        },
      });
    }

    if (action === "positions") {
      const accountNumber = await getAccountNumber(token);
      const posData = await tastyFetch(`/accounts/${accountNumber}/positions`, token);
      const positions = (posData?.data?.items || []).map((p: any) => ({
        symbol: p.symbol,
        qty: Number(p.quantity ?? 0),
        avgPrice: Number(p["average-open-price"] ?? 0),
        lastPrice: Number(p["close-price"] ?? 0),
        marketValue: Number(p.quantity ?? 0) * Number(p["close-price"] ?? 0),
        unrealizedPnl: (Number(p["close-price"] ?? 0) - Number(p["average-open-price"] ?? 0)) * Number(p.quantity ?? 0),
        unrealizedPnlPct: 0,
        broker: "TASTYTRADE",
      }));
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const accountNumber = await getAccountNumber(token);
      const ordData = await tastyFetch(`/accounts/${accountNumber}/orders/live`, token);
      const orders = (ordData?.data?.items || []).map((o: any) => ({
        id: String(o.id ?? ""),
        symbol: o["underlying-symbol"] || o.legs?.[0]?.symbol || "",
        side: o.legs?.[0]?.action?.toLowerCase().includes("sell") ? "sell" : "buy",
        type: o["order-type"]?.toLowerCase() || "limit",
        timeInForce: o["time-in-force"]?.toLowerCase() || "day",
        qty: Number(o.size ?? 0),
        filledQty: Number(o["filled-quantity"] ?? 0),
        limitPrice: o.price ? Number(o.price) : null,
        filledAvgPrice: o["avg-fill-price"] ? Number(o["avg-fill-price"]) : null,
        status: String(o.status ?? "").toLowerCase(),
        createdAt: o["received-at"] ?? null,
        broker: "TASTYTRADE",
      }));
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Tastytrade request failed" }, { status: 500 });
  }
}
