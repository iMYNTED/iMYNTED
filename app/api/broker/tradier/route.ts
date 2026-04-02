// app/api/broker/tradier/route.ts
import { NextResponse } from "next/server";

const BASE = "https://api.tradier.com";

function resolveCredentials(req: Request) {
  const token = process.env.TRADIER_ACCESS_TOKEN || req.headers.get("X-Tradier-Token") || "";
  const accountId = process.env.TRADIER_ACCOUNT_ID || req.headers.get("X-Tradier-Account") || "";
  return { token, accountId };
}

function tradierHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" };
}

async function tradierFetch(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, { headers: tradierHeaders(token), cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tradier ${res.status}: ${text}`);
  }
  return res.json();
}

export async function GET(req: Request) {
  const { token, accountId } = resolveCredentials(req);
  if (!token) return NextResponse.json({ ok: false, error: "Tradier token not configured" }, { status: 500 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    if (action === "profile") {
      const data = await tradierFetch("/v1/user/profile", token);
      const raw = data?.profile?.account;
      const accounts = Array.isArray(raw) ? raw : raw ? [raw] : [];
      return NextResponse.json({ ok: true, data: { accounts: accounts.map((a: any) => ({ accountNumber: a.account_number, type: a.type, status: a.status })) } });
    }

    if (!accountId) return NextResponse.json({ ok: false, error: "Account ID required" }, { status: 400 });

    if (action === "account") {
      const data = await tradierFetch(`/v1/accounts/${accountId}/balances`, token);
      const b = data?.balances || {};
      return NextResponse.json({
        ok: true,
        data: {
          cash: Number(b.total_cash ?? b.cash?.cash_available ?? 0),
          buyingPower: Number(b.margin?.stock_buying_power ?? b.cash?.cash_available ?? b.total_cash ?? 0),
          equity: Number(b.total_equity ?? 0),
        },
      });
    }

    if (action === "positions") {
      const data = await tradierFetch(`/v1/accounts/${accountId}/positions`, token);
      const raw = data?.positions?.position;
      if (!raw) return NextResponse.json({ ok: true, data: [] });
      const list = Array.isArray(raw) ? raw : [raw];
      const positions = list.map((p: any) => ({
        symbol: p.symbol,
        qty: Math.abs(Number(p.quantity ?? 0)),
        avgPrice: Number(p.quantity ?? 0) !== 0 ? Number(p.cost_basis ?? 0) / Math.abs(Number(p.quantity)) : 0,
        lastPrice: Number(p.last_price ?? 0),
        marketValue: Number(p.market_value ?? 0),
        unrealizedPnl: Number(p.gain_loss ?? 0),
        unrealizedPnlPct: Number(p.gain_loss_percent ?? 0),
        broker: "TRADIER",
      }));
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const data = await tradierFetch(`/v1/accounts/${accountId}/orders`, token);
      const raw = data?.orders?.order;
      if (!raw) return NextResponse.json({ ok: true, data: [] });
      const list = Array.isArray(raw) ? raw : [raw];
      const orders = list.map((o: any) => ({
        id: String(o.id ?? ""),
        symbol: o.symbol,
        side: String(o.side ?? "").toLowerCase().startsWith("buy") ? "buy" : "sell",
        type: String(o.type ?? "market").toLowerCase(),
        timeInForce: String(o.duration ?? "day").toLowerCase(),
        qty: Number(o.quantity ?? 0),
        filledQty: Number(o.exec_quantity ?? 0),
        limitPrice: o.price ? Number(o.price) : null,
        stopPrice: o.stop_price ? Number(o.stop_price) : null,
        filledAvgPrice: o.avg_fill_price ? Number(o.avg_fill_price) : null,
        status: String(o.status ?? "").toLowerCase(),
        createdAt: o.create_date ?? null,
        broker: "TRADIER",
      }));
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Tradier request failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { token, accountId } = resolveCredentials(req);
  if (!token || !accountId) return NextResponse.json({ ok: false, error: "Tradier credentials not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { symbol, qty, side, type, timeInForce, limitPrice, stopPrice } = body;
    if (!symbol || !qty || !side) return NextResponse.json({ ok: false, error: "Missing symbol, qty, or side" }, { status: 400 });

    const params = new URLSearchParams();
    params.set("class", "equity");
    params.set("symbol", String(symbol).toUpperCase());
    params.set("quantity", String(qty));
    params.set("side", String(side).toLowerCase());
    params.set("type", String(type || "market").toLowerCase());
    params.set("duration", String(timeInForce || "day").toLowerCase());
    if (limitPrice && (type === "limit" || type === "stop_limit")) params.set("price", String(limitPrice));
    if (stopPrice && (type === "stop" || type === "stop_limit")) params.set("stop", String(stopPrice));

    const res = await fetch(`${BASE}/v1/accounts/${accountId}/orders`, {
      method: "POST", headers: tradierHeaders(token), body: params.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ ok: false, error: data?.errors?.error?.[0] || `Tradier ${res.status}`, data }, { status: res.status });

    return NextResponse.json({ ok: true, data: { id: String(data?.order?.id || ""), symbol: String(symbol).toUpperCase(), side: String(side).toLowerCase(), type: String(type || "market").toLowerCase(), qty: String(qty), status: data?.order?.status || "pending", createdAt: new Date().toISOString() } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Order submission failed" }, { status: 500 });
  }
}
