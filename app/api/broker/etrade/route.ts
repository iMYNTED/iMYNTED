// app/api/broker/etrade/route.ts
// E*Trade uses OAuth 1.0a — requires consumer key/secret + access token/secret
import { NextResponse } from "next/server";
import crypto from "crypto";

const BASE = "https://api.etrade.com";

function resolveCredentials(req: Request) {
  const consumerKey = process.env.ETRADE_CONSUMER_KEY || req.headers.get("X-ETrade-ConsumerKey") || "";
  const consumerSecret = process.env.ETRADE_CONSUMER_SECRET || req.headers.get("X-ETrade-ConsumerSecret") || "";
  const accessToken = process.env.ETRADE_ACCESS_TOKEN || req.headers.get("X-ETrade-Token") || "";
  const accessSecret = process.env.ETRADE_ACCESS_SECRET || req.headers.get("X-ETrade-TokenSecret") || "";
  return { consumerKey, consumerSecret, accessToken, accessSecret };
}

function buildOAuthHeader(method: string, url: string, consumerKey: string, consumerSecret: string, accessToken: string, accessSecret: string) {
  const params: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };
  const sortedParams = Object.keys(params).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");
  const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessSecret)}`;
  params.oauth_signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
  return "OAuth " + Object.keys(params)
    .filter(k => k.startsWith("oauth_"))
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
    .join(", ");
}

async function etradeFetch(path: string, creds: ReturnType<typeof resolveCredentials>) {
  const fullUrl = `${BASE}${path}`;
  const auth = buildOAuthHeader("GET", fullUrl, creds.consumerKey, creds.consumerSecret, creds.accessToken, creds.accessSecret);
  const res = await fetch(fullUrl, {
    headers: { Authorization: auth, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`E*Trade ${res.status}: ${text}`);
  }
  return res.json();
}

export async function GET(req: Request) {
  const creds = resolveCredentials(req);
  if (!creds.consumerKey || !creds.accessToken) {
    return NextResponse.json({ ok: false, error: "E*Trade credentials not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "account";

  try {
    if (action === "account") {
      const data = await etradeFetch("/v1/accounts/list.json", creds);
      const accounts = data?.AccountListResponse?.Accounts?.Account || [];
      const acc = Array.isArray(accounts) ? accounts[0] : accounts;
      if (!acc) return NextResponse.json({ ok: false, error: "No accounts found" }, { status: 404 });
      const balData = await etradeFetch(`/v1/accounts/${acc.accountIdKey}/balance.json?instType=BROKERAGE&realTimeNAV=true`, creds);
      const b = balData?.BalanceResponse;
      return NextResponse.json({
        ok: true,
        data: {
          cash: Number(b?.Computed?.cashAvailableForInvestment ?? b?.cashAvailableForWithdrawal ?? 0),
          buyingPower: Number(b?.Computed?.marginBuyingPower ?? b?.Computed?.cashBuyingPower ?? 0),
          equity: Number(b?.Computed?.RealTimeValues?.totalAccountValue ?? b?.accountBalance ?? 0),
        },
      });
    }

    if (action === "positions") {
      const accData = await etradeFetch("/v1/accounts/list.json", creds);
      const accounts = accData?.AccountListResponse?.Accounts?.Account || [];
      const acc = Array.isArray(accounts) ? accounts[0] : accounts;
      if (!acc) return NextResponse.json({ ok: true, data: [] });
      const data = await etradeFetch(`/v1/accounts/${acc.accountIdKey}/portfolio.json`, creds);
      const holdings = data?.PortfolioResponse?.AccountPortfolio?.[0]?.Position || [];
      const list = Array.isArray(holdings) ? holdings : [holdings];
      const positions = list.filter(Boolean).map((p: any) => ({
        symbol: p.symbolDescription ?? p.Product?.symbol ?? "",
        qty: Number(p.quantity ?? 0),
        avgPrice: Number(p.costPerShare ?? 0),
        lastPrice: Number(p.Quick?.lastTrade ?? p.pricePaid ?? 0),
        marketValue: Number(p.marketValue ?? 0),
        unrealizedPnl: Number(p.totalGain ?? 0),
        unrealizedPnlPct: Number(p.totalGainPct ?? 0),
        broker: "ETRADE",
      }));
      return NextResponse.json({ ok: true, data: positions });
    }

    if (action === "orders") {
      const accData = await etradeFetch("/v1/accounts/list.json", creds);
      const accounts = accData?.AccountListResponse?.Accounts?.Account || [];
      const acc = Array.isArray(accounts) ? accounts[0] : accounts;
      if (!acc) return NextResponse.json({ ok: true, data: [] });
      const data = await etradeFetch(`/v1/accounts/${acc.accountIdKey}/orders.json`, creds);
      const ordersRaw = data?.OrdersResponse?.Order || [];
      const list = Array.isArray(ordersRaw) ? ordersRaw : [ordersRaw];
      const orders = list.filter(Boolean).map((o: any) => {
        const detail = o.OrderDetail?.[0] || {};
        const instr = detail.Instrument?.[0] || {};
        return {
          id: String(o.orderId ?? ""),
          symbol: instr.Product?.symbol ?? "",
          side: String(instr.orderAction ?? "").toLowerCase().includes("sell") ? "sell" : "buy",
          type: String(detail.orderType ?? "MARKET").toLowerCase(),
          timeInForce: String(detail.orderTerm ?? "GOOD_FOR_DAY").toLowerCase(),
          qty: Number(instr.orderedQuantity ?? 0),
          filledQty: Number(instr.filledQuantity ?? 0),
          limitPrice: detail.limitPrice ? Number(detail.limitPrice) : null,
          filledAvgPrice: detail.averageExecutionPrice ? Number(detail.averageExecutionPrice) : null,
          status: String(o.OrderDetail?.[0]?.status ?? "").toLowerCase(),
          createdAt: o.placedTime ? new Date(o.placedTime).toISOString() : null,
          broker: "ETRADE",
        };
      });
      return NextResponse.json({ ok: true, data: orders });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "E*Trade request failed" }, { status: 500 });
  }
}
