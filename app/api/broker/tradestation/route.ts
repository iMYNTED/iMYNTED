// app/api/broker/tradestation/route.ts
import { NextResponse } from "next/server";

const BASE = "https://api.tradestation.com";

async function tsFetch(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TradeStation ${res.status}: ${text}`);
  }
  return res.json();
}

export async function GET(req: Request) {
  const token = process.env.TRADESTATION_ACCESS_TOKEN || req.headers.get("X-TradeStation-Token") || "";
  if (!token) return NextResponse.json({ ok: false, error: "TradeStation token not configured" }, { status: 500 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    if (action === "account") {
      const data = await tsFetch("/v3/brokerage/accounts", token);
      const accounts: any[] = data?.Accounts || data?.accounts || [];
      if (!accounts.length) return NextResponse.json({ ok: false, error: "No accounts found" }, { status: 404 });
      const acc = accounts[0];
      const balData = await tsFetch(`/v3/brokerage/accounts/${acc.AccountID}/balances`, token);
      const b = balData?.Balances?.[0] || balData?.balances?.[0] || {};
      return NextResponse.json({
        ok: true,
        data: {
          cash: Number(b.CashBalance ?? b.cashBalance ?? 0),
          buyingPower: Number(b.BuyingPower ?? b.buyingPower ?? 0),
          equity: Number(b.Equity ?? b.equity ?? 0),
        },
      });
    }

    if (action === "positions") {
      const accData = await tsFetch("/v3/brokerage/accounts", token);
      const accounts: any[] = accData?.Accounts || accData?.accounts || [];
      if (!accounts.length) return NextResponse.json({ ok: true, data: [] });
      const accountId = accounts[0].AccountID;
      const data = await tsFetch(`/v3/brokerage/accounts/${accountId}/positions`, token);
      const positions = (data?.Positions || data?.positions || []).map((p: any) => ({
        symbol: p.Symbol ?? p.symbol ?? "",
        qty: Math.abs(Number(p.Quantity ?? p.quantity ?? 0)),
        avgPrice: Number(p.AveragePrice ?? p.averagePrice ?? 0),
        lastPrice: Number(p.Last ?? p.last ?? 0),
        marketValue: Number(p.MarketValue ?? p.marketValue ?? 0),
        unrealizedPnl: Number(p.UnrealizedProfitLoss ?? p.unrealizedProfitLoss ?? 0),
        unrealizedPnlPct: 0,
        broker: "TRADESTATION",
      }));
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const accData = await tsFetch("/v3/brokerage/accounts", token);
      const accounts: any[] = accData?.Accounts || accData?.accounts || [];
      if (!accounts.length) return NextResponse.json({ ok: true, data: [] });
      const accountId = accounts[0].AccountID;
      const data = await tsFetch(`/v3/brokerage/accounts/${accountId}/orders`, token);
      const orders = (data?.Orders || data?.orders || []).map((o: any) => ({
        id: String(o.OrderID ?? o.orderId ?? ""),
        symbol: o.Legs?.[0]?.Symbol ?? o.symbol ?? "",
        side: String(o.BuySell ?? o.side ?? "").toLowerCase() === "sell" ? "sell" : "buy",
        type: String(o.OrderType ?? o.orderType ?? "Market").toLowerCase(),
        timeInForce: String(o.Duration ?? o.timeInForce ?? "DAY").toLowerCase(),
        qty: Number(o.Quantity ?? o.quantity ?? 0),
        filledQty: Number(o.FilledQuantity ?? o.filledQuantity ?? 0),
        limitPrice: o.LimitPrice ? Number(o.LimitPrice) : null,
        filledAvgPrice: o.FilledPrice ? Number(o.FilledPrice) : null,
        status: String(o.Status ?? o.status ?? "").toLowerCase(),
        createdAt: o.OpenedDateTime ?? o.createdAt ?? null,
        broker: "TRADESTATION",
      }));
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "TradeStation request failed" }, { status: 500 });
  }
}
