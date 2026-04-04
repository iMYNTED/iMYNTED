"use client";

import React, { useMemo, useState } from "react";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ── Types ── */
type AccTab = "positions" | "orders" | "history" | "stats" | "connect" | "command";
type OrderStatus = "queued" | "filled" | "failed" | "cancelled" | "working";

interface Position {
  symbol: string; name: string; side: "Buy" | "Sell"; qty: number;
  avgPrice: number; lastPrice: number; mktValue: number; pnl: number; pnlPct: number;
  broker: string;
}

interface Order {
  id: number; symbol: string; name: string; side: "Buy" | "Sell";
  status: OrderStatus; orderPrice: number; orderQty: number; filledQty: number;
  filledPrice: number; orderType: string; tif: string; session: string;
  orderTime: string; market: string; currency: string;
}

/* ── iMYNTED pill style ── */
function pillStyle(name: string): React.CSSProperties {
  const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const variant = h % 8;
  const styles: Array<{ bg: string; border: string }> = [
    { bg: "linear-gradient(135deg, rgba(52,211,153,0.55) 0%, rgba(6,78,59,0.70) 100%)", border: "rgba(52,211,153,0.40)" },
    { bg: "linear-gradient(135deg, rgba(34,211,238,0.55) 0%, rgba(8,60,90,0.70) 100%)", border: "rgba(34,211,238,0.35)" },
    { bg: "linear-gradient(135deg, rgba(99,102,241,0.55) 0%, rgba(30,27,75,0.70) 100%)", border: "rgba(99,102,241,0.35)" },
    { bg: "linear-gradient(135deg, rgba(168,85,247,0.50) 0%, rgba(59,7,100,0.65) 100%)", border: "rgba(168,85,247,0.30)" },
    { bg: "linear-gradient(135deg, rgba(251,146,60,0.50) 0%, rgba(80,40,10,0.65) 100%)", border: "rgba(251,146,60,0.30)" },
    { bg: "linear-gradient(135deg, rgba(248,113,113,0.50) 0%, rgba(80,20,20,0.65) 100%)", border: "rgba(248,113,113,0.30)" },
    { bg: "linear-gradient(135deg, rgba(56,189,248,0.55) 0%, rgba(12,50,80,0.70) 100%)", border: "rgba(56,189,248,0.35)" },
    { bg: "linear-gradient(135deg, rgba(245,158,11,0.50) 0%, rgba(80,50,5,0.65) 100%)", border: "rgba(245,158,11,0.30)" },
  ];
  return { background: styles[variant].bg, borderColor: styles[variant].border };
}

/* ── Mock Data ── */
const POSITIONS: Position[] = [
  { symbol: "AAPL", name: "Apple Inc.", side: "Buy", qty: 120, avgPrice: 182.40, lastPrice: 248.80, mktValue: 29856, pnl: 7968, pnlPct: 36.41, broker: "RH" },
  { symbol: "TSLA", name: "Tesla Inc.", side: "Buy", qty: 40, avgPrice: 238.10, lastPrice: 361.83, mktValue: 14473, pnl: 4949, pnlPct: 51.95, broker: "WEBULL" },
  { symbol: "NVDA", name: "NVIDIA Corp.", side: "Buy", qty: 25, avgPrice: 901.50, lastPrice: 167.52, mktValue: 4188, pnl: -18352, pnlPct: -81.41, broker: "ETRADE" },
  { symbol: "AMZN", name: "Amazon.com", side: "Buy", qty: 30, avgPrice: 185.00, lastPrice: 199.34, mktValue: 5980, pnl: 430, pnlPct: 7.75, broker: "FIDELITY" },
  { symbol: "MSFT", name: "Microsoft Corp.", side: "Buy", qty: 15, avgPrice: 380.10, lastPrice: 356.77, mktValue: 5352, pnl: -350, pnlPct: -6.14, broker: "SCHWAB" },
  { symbol: "BTC-USD", name: "Bitcoin", side: "Buy", qty: 0.5, avgPrice: 62000, lastPrice: 66426, mktValue: 33213, pnl: 2213, pnlPct: 7.14, broker: "COINBASE" },
];

const ORDERS: Order[] = [
  { id: 37, symbol: "RDGT", name: "Ridge...", side: "Buy", status: "queued", orderPrice: 1.37, orderQty: 39, filledQty: 0, filledPrice: 0, orderType: "Limit", tif: "Day", session: "24 Hour Trading", orderTime: "Mar 28 09:30:28 ET", market: "US", currency: "USD" },
  { id: 36, symbol: "RBNE", name: "Robin Energy", side: "Buy", status: "filled", orderPrice: 2.80, orderQty: 924, filledQty: 924, filledPrice: 2.80, orderType: "Limit", tif: "Day", session: "RTH + Extended", orderTime: "Mar 27 06:57:43 ET", market: "US", currency: "USD" },
  { id: 35, symbol: "TURB", name: "Turbo Energy", side: "Buy", status: "filled", orderPrice: 1.75, orderQty: 1055, filledQty: 1055, filledPrice: 1.75, orderType: "Limit", tif: "Day", session: "RTH + Extended", orderTime: "Mar 26 08:51:39 ET", market: "US", currency: "USD" },
  { id: 34, symbol: "TURB", name: "Turbo Energy", side: "Buy", status: "failed", orderPrice: 1.75, orderQty: 1058, filledQty: 0, filledPrice: 0, orderType: "Limit", tif: "Day", session: "RTH + Extended", orderTime: "Mar 26 08:51:27 ET", market: "US", currency: "USD" },
  { id: 33, symbol: "ITOC", name: "iTonic", side: "Sell", status: "filled", orderPrice: 0.399, orderQty: 2500, filledQty: 2500, filledPrice: 0.399, orderType: "Limit", tif: "Day", session: "RTH + Extended", orderTime: "Mar 26 08:31:58 ET", market: "US", currency: "USD" },
  { id: 32, symbol: "TOP", name: "Top Financial", side: "Sell", status: "filled", orderPrice: 0.7955, orderQty: 2000, filledQty: 2000, filledPrice: 0.7955, orderType: "Limit", tif: "Day", session: "RTH + Extended", orderTime: "Mar 26 08:31:33 ET", market: "US", currency: "USD" },
  { id: 31, symbol: "BATL", name: "Battalion Oil", side: "Buy", status: "filled", orderPrice: 6.50, orderQty: 954, filledQty: 954, filledPrice: 6.50, orderType: "Limit", tif: "Day", session: "RTH + Extended", orderTime: "Mar 26 08:15:45 ET", market: "US", currency: "USD" },
  { id: 30, symbol: "BATL", name: "Battalion Oil", side: "Buy", status: "cancelled", orderPrice: 6.28, orderQty: 294, filledQty: 0, filledPrice: 0, orderType: "Limit", tif: "Day", session: "RTH + Extended", orderTime: "Mar 26 08:04:17 ET", market: "US", currency: "USD" },
];

const STATUS_CFG: Record<OrderStatus, { label: string; dot: string; text: string }> = {
  queued:    { label: "Queued",    dot: "bg-amber-500",   text: "text-amber-400" },
  working:   { label: "Working",   dot: "bg-cyan-500",    text: "text-cyan-400" },
  filled:    { label: "Filled",    dot: "bg-emerald-500", text: "text-emerald-400" },
  failed:    { label: "Failed",    dot: "bg-red-500",     text: "text-red-400" },
  cancelled: { label: "Cancelled", dot: "bg-white/30",    text: "text-white/40" },
};

const ACTIONS = [
  { icon: "💰", label: "Deposit", color: "emerald", action: "coming-soon" as const },
  { icon: "💸", label: "Withdraw", color: "cyan", action: "coming-soon" as const },
  { icon: "💱", label: "Currency\nExchange", color: "purple", action: "forex" as const },
  { icon: "📥", label: "Transfer\nStock In", color: "amber", action: "transfer" as const },
  { icon: "📄", label: "Tax\nDocuments", color: "rose", action: "tax" as const },
  { icon: "🏷️", label: "IPO", color: "sky", action: "ipo" as const },
  { icon: "📊", label: "Statement", color: "indigo", action: "coming-soon" as const },
  { icon: "iM", label: "Refer\na Friend", color: "emerald", action: "refer" as const, isLogo: true },
];

function fmtMoney(v: number) {
  return v >= 0 ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `-$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ── Component ── */
export default function AccountsPage() {
  const [tab, setTab] = useState<AccTab>("positions");
  const [orderFilter, setOrderFilter] = useState<"all" | OrderStatus>("all");
  const [marketFilter, setMarketFilter] = useState("All Markets");
  const [currency, setCurrency] = useState("USD");

  // Generic broker credentials (localStorage)
  const [brokerCreds, setBrokerCreds] = useState<Record<string, Record<string, string>>>({});
  const [connectingBroker, setConnectingBroker] = useState<string | null>(null);
  const [credInputs, setCredInputs] = useState<Record<string, string>>({});
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg] = useState("");

  const BROKER_IDS = ["alpaca", "tradier", "tastytrade", "trading212", "schwab", "ibkr", "tradestation", "etrade", "webull", "binance", "kraken", "bybit", "okx", "kucoin", "gemini", "cryptocom", "coinbase"] as const;

  const BROKER_CONNECT: Record<string, {
    apiBase: string; hint: string;
    fields: Array<{ key: string; label: string; placeholder: string; secret?: boolean }>;
    toHeaders: (c: Record<string, string>) => Record<string, string>;
    preStep?: string;
  }> = {
    alpaca: {
      apiBase: "/api/broker/alpaca", hint: "Get API keys from alpaca.markets → Account → API Keys. Paper trading keys work too.",
      fields: [
        { key: "key", label: "API Key ID", placeholder: "PKXXXXXXXXXXXXXXXX" },
        { key: "secret", label: "Secret Key", placeholder: "••••••••••••••••••••••••", secret: true },
      ],
      toHeaders: c => ({ "X-Alpaca-Key": c.key, "X-Alpaca-Secret": c.secret }),
    },
    tradier: {
      apiBase: "/api/broker/tradier", hint: "Get your access token from tradier.com → Account → API Access. Sandbox tokens work too.",
      fields: [{ key: "token", label: "Access Token", placeholder: "Your Tradier access token", secret: true }],
      toHeaders: c => ({ "X-Tradier-Token": c.token, "X-Tradier-Account": c.accountId || "" }),
      preStep: "profile",
    },
    binance: {
      apiBase: "/api/broker/binance", hint: "Create API keys at binance.us → Profile → API Management. Enable Read permissions.",
      fields: [
        { key: "key", label: "API Key", placeholder: "Your Binance API key" },
        { key: "secret", label: "Secret Key", placeholder: "Your Binance secret key", secret: true },
      ],
      toHeaders: c => ({ "X-Binance-Key": c.key, "X-Binance-Secret": c.secret }),
    },
    kraken: {
      apiBase: "/api/broker/kraken", hint: "Create API keys at kraken.com → Security → API. Enable Query Funds & Query Orders permissions.",
      fields: [
        { key: "key", label: "API Key", placeholder: "Your Kraken API key" },
        { key: "secret", label: "Private Key", placeholder: "Your Kraken private key (base64)", secret: true },
      ],
      toHeaders: c => ({ "X-Kraken-Key": c.key, "X-Kraken-Secret": c.secret }),
    },
    bybit: {
      apiBase: "/api/broker/bybit", hint: "Create API keys at bybit.com → Account → API Management. Enable Read-Only permissions.",
      fields: [
        { key: "key", label: "API Key", placeholder: "Your Bybit API key" },
        { key: "secret", label: "API Secret", placeholder: "Your Bybit API secret", secret: true },
      ],
      toHeaders: c => ({ "X-Bybit-Key": c.key, "X-Bybit-Secret": c.secret }),
    },
    okx: {
      apiBase: "/api/broker/okx", hint: "Create API keys at okx.com → Profile → API. Set a passphrase during creation.",
      fields: [
        { key: "key", label: "API Key", placeholder: "Your OKX API key" },
        { key: "secret", label: "Secret Key", placeholder: "Your OKX secret key", secret: true },
        { key: "passphrase", label: "Passphrase", placeholder: "Your API passphrase", secret: true },
      ],
      toHeaders: c => ({ "X-OKX-Key": c.key, "X-OKX-Secret": c.secret, "X-OKX-Passphrase": c.passphrase }),
    },
    kucoin: {
      apiBase: "/api/broker/kucoin", hint: "Create API keys at kucoin.com → Profile → API Management. Set a passphrase during creation.",
      fields: [
        { key: "key", label: "API Key", placeholder: "Your KuCoin API key" },
        { key: "secret", label: "API Secret", placeholder: "Your KuCoin API secret", secret: true },
        { key: "passphrase", label: "Passphrase", placeholder: "Your API passphrase", secret: true },
      ],
      toHeaders: c => ({ "X-KuCoin-Key": c.key, "X-KuCoin-Secret": c.secret, "X-KuCoin-Passphrase": c.passphrase }),
    },
    gemini: {
      apiBase: "/api/broker/gemini", hint: "Create API keys at gemini.com → Settings → API. Enable Fund Management & Trading permissions.",
      fields: [
        { key: "key", label: "API Key", placeholder: "Your Gemini API key" },
        { key: "secret", label: "API Secret", placeholder: "Your Gemini API secret", secret: true },
      ],
      toHeaders: c => ({ "X-Gemini-Key": c.key, "X-Gemini-Secret": c.secret }),
    },
    tastytrade: {
      apiBase: "/api/broker/tastytrade", hint: "Enter your tastytrade login credentials. These are only stored locally and used to authenticate API requests.",
      fields: [
        { key: "login", label: "Username / Email", placeholder: "Your tastytrade login" },
        { key: "password", label: "Password", placeholder: "Your tastytrade password", secret: true },
      ],
      toHeaders: c => ({ "X-Tastytrade-Login": c.login, "X-Tastytrade-Password": c.password }),
    },
    trading212: {
      apiBase: "/api/broker/trading212", hint: "Get your API key from Trading212 → Settings → API (Beta). Live account required.",
      fields: [
        { key: "token", label: "API Key", placeholder: "Your Trading212 API key", secret: true },
      ],
      toHeaders: c => ({ "X-Trading212-Token": c.token }),
    },
    cryptocom: {
      apiBase: "/api/broker/cryptocom", hint: "Create API keys at crypto.com/exchange → API Management. Enable Read permissions.",
      fields: [
        { key: "key", label: "API Key", placeholder: "Your Crypto.com API key" },
        { key: "secret", label: "Secret Key", placeholder: "Your Crypto.com secret key", secret: true },
      ],
      toHeaders: c => ({ "X-CryptoCom-Key": c.key, "X-CryptoCom-Secret": c.secret }),
    },
    coinbase: {
      apiBase: "/api/broker/coinbase", hint: "Create API keys at coinbase.com/settings/api → New API Key. Enable 'view' and 'trade' permissions.",
      fields: [
        { key: "key", label: "API Key", placeholder: "Your Coinbase API key" },
        { key: "secret", label: "API Secret", placeholder: "Your Coinbase API secret", secret: true },
      ],
      toHeaders: c => ({ "X-Coinbase-Key": c.key, "X-Coinbase-Secret": c.secret }),
    },
    schwab: {
      apiBase: "/api/broker/schwab", hint: "Register at developer.schwab.com, complete the OAuth flow to get an access token, then find your encrypted account hash via GET /accounts.",
      fields: [
        { key: "token", label: "Access Token", placeholder: "Your Schwab OAuth access token", secret: true },
        { key: "accountHash", label: "Account Hash", placeholder: "Encrypted account hash (from /accounts API)" },
      ],
      toHeaders: c => ({ "X-Schwab-Token": c.token, "X-Schwab-Account": c.accountHash }),
    },
    ibkr: {
      apiBase: "/api/broker/ibkr", hint: "Download IBKR Client Portal Gateway from interactivebrokers.com. Run it locally, log in at https://localhost:5000, then enter your account ID.",
      fields: [
        { key: "accountId", label: "Account ID", placeholder: "U1234567" },
        { key: "gatewayUrl", label: "Gateway URL (optional)", placeholder: "https://localhost:5000/v1/api" },
      ],
      toHeaders: c => ({ "X-IBKR-Account": c.accountId, "X-IBKR-Gateway": c.gatewayUrl || "https://localhost:5000/v1/api" }),
    },
    tradestation: {
      apiBase: "/api/broker/tradestation", hint: "Register at developer.tradestation.com, complete OAuth to get an access token.",
      fields: [
        { key: "token", label: "Access Token", placeholder: "Your TradeStation OAuth access token", secret: true },
      ],
      toHeaders: c => ({ "X-TradeStation-Token": c.token }),
    },
    etrade: {
      apiBase: "/api/broker/etrade", hint: "Register at developer.etrade.com. After OAuth you'll have 4 tokens: Consumer Key, Consumer Secret, Access Token, Access Token Secret.",
      fields: [
        { key: "consumerKey", label: "Consumer Key", placeholder: "Your E*Trade consumer key" },
        { key: "consumerSecret", label: "Consumer Secret", placeholder: "Your E*Trade consumer secret", secret: true },
        { key: "token", label: "Access Token", placeholder: "Your OAuth access token", secret: true },
        { key: "tokenSecret", label: "Token Secret", placeholder: "Your OAuth access token secret", secret: true },
      ],
      toHeaders: c => ({ "X-ETrade-ConsumerKey": c.consumerKey, "X-ETrade-ConsumerSecret": c.consumerSecret, "X-ETrade-Token": c.token, "X-ETrade-TokenSecret": c.tokenSecret }),
    },
    webull: {
      apiBase: "/api/broker/webull", hint: "Get your access token and account ID from Webull. Device ID can be any unique string (e.g. your-device-001).",
      fields: [
        { key: "token", label: "Access Token", placeholder: "Your Webull access token", secret: true },
        { key: "accountId", label: "Account ID", placeholder: "Your Webull account ID" },
        { key: "deviceId", label: "Device ID (optional)", placeholder: "imynted-web" },
      ],
      toHeaders: c => ({ "X-Webull-Token": c.token, "X-Webull-Account": c.accountId, "X-Webull-Device": c.deviceId || "imynted-web" }),
    },
  };

  React.useEffect(() => {
    const loaded: Record<string, Record<string, string>> = {};
    for (const id of BROKER_IDS) {
      const stored = localStorage.getItem(`creds_${id}`);
      if (stored) { try { loaded[id] = JSON.parse(stored); } catch {} }
    }
    // migrate old alpaca keys
    const oldKey = localStorage.getItem("alpaca_key");
    const oldSecret = localStorage.getItem("alpaca_secret");
    if (oldKey && oldSecret && !loaded.alpaca) {
      loaded.alpaca = { key: oldKey, secret: oldSecret };
      localStorage.setItem("creds_alpaca", JSON.stringify(loaded.alpaca));
    }
    setBrokerCreds(loaded);
  }, []);

  async function testAndSave(brokerId: string) {
    const config = BROKER_CONNECT[brokerId];
    if (!config) return;
    setTestStatus("testing");
    let inputs = { ...credInputs };
    let hdrs = config.toHeaders(inputs);
    // Tradier: fetch profile first to get account ID
    if (config.preStep === "profile") {
      try {
        const profRes = await fetch(`${config.apiBase}?action=profile`, { headers: hdrs });
        const profJ = await profRes.json();
        if (!profJ?.ok || !profJ.data?.accounts?.length) {
          setTestStatus("fail");
          setTestMsg(profJ?.error || "Could not fetch account profile");
          return;
        }
        inputs = { ...inputs, accountId: profJ.data.accounts[0].accountNumber };
        hdrs = config.toHeaders(inputs);
      } catch (e: any) {
        setTestStatus("fail");
        setTestMsg(e?.message || "Network error");
        return;
      }
    }
    try {
      const res = await fetch(`${config.apiBase}?action=account`, { headers: hdrs });
      const j = await res.json();
      if (j?.ok) {
        localStorage.setItem(`creds_${brokerId}`, JSON.stringify(inputs));
        setBrokerCreds(prev => ({ ...prev, [brokerId]: inputs }));
        setTestStatus("ok");
        setTestMsg("Connected successfully");
        setTimeout(() => setConnectingBroker(null), 1200);
      } else {
        setTestStatus("fail");
        setTestMsg(j?.error || "Connection failed");
      }
    } catch (e: any) {
      setTestStatus("fail");
      setTestMsg(e?.message || "Network error");
    }
  }

  function disconnect(brokerId: string) {
    localStorage.removeItem(`creds_${brokerId}`);
    setBrokerCreds(prev => { const n = { ...prev }; delete n[brokerId]; return n; });
  }

  // All broker live data (aggregated)
  const [brokerPositions, setBrokerPositions] = useState<Position[]>([]);
  const [brokerOrders, setBrokerOrders] = useState<Order[]>([]);
  const [brokerAccount, setBrokerAccount] = useState<{ cash: number; buyingPower: number; equity: number } | null>(null);

  React.useEffect(() => {
    const connected = Object.keys(brokerCreds).filter(id => BROKER_CONNECT[id]);
    if (!connected.length) { setBrokerPositions([]); setBrokerOrders([]); setBrokerAccount(null); return; }

    function toStatus(s: string): OrderStatus {
      if (s === "filled") return "filled";
      if (["canceled", "cancelled", "expired", "rejected"].includes(s)) return "cancelled";
      if (s === "partially_filled") return "working";
      if (["new", "accepted", "open", "pending"].includes(s)) return "queued";
      return "failed";
    }

    async function load() {
      const allPos: Position[] = [];
      const allOrd: Order[] = [];
      let totalCash = 0, totalBP = 0, totalEquity = 0, anyAccount = false;

      await Promise.allSettled(connected.map(async (brokerId) => {
        const config = BROKER_CONNECT[brokerId];
        const hdrs = config.toHeaders(brokerCreds[brokerId]);
        const base = config.apiBase;
        const label = brokerId.toUpperCase();

        const [posRes, ordRes, accRes] = await Promise.allSettled([
          fetch(`${base}?action=positions`, { headers: hdrs }).then(r => r.ok ? r.json() : null),
          fetch(`${base}?action=orders`, { headers: hdrs }).then(r => r.ok ? r.json() : null),
          fetch(`${base}?action=account`, { headers: hdrs }).then(r => r.ok ? r.json() : null),
        ]);

        const posJ = posRes.status === "fulfilled" ? posRes.value : null;
        const ordJ = ordRes.status === "fulfilled" ? ordRes.value : null;
        const accJ = accRes.status === "fulfilled" ? accRes.value : null;

        if (posJ?.ok && Array.isArray(posJ.data)) {
          allPos.push(...posJ.data.map((p: any) => ({
            symbol: p.symbol, name: p.symbol, side: "Buy" as const,
            qty: p.qty, avgPrice: p.avgPrice, lastPrice: p.lastPrice ?? 0,
            mktValue: p.marketValue || p.qty * (p.lastPrice || 0),
            pnl: p.unrealizedPnl || 0, pnlPct: p.unrealizedPnlPct || 0,
            broker: p.broker || label,
          })));
        }
        if (ordJ?.ok && Array.isArray(ordJ.data)) {
          allOrd.push(...ordJ.data.map((o: any, i: number) => ({
            id: Date.now() + i, symbol: o.symbol, name: `${o.symbol} (${label})`,
            side: o.side === "sell" ? "Sell" as const : "Buy" as const,
            status: toStatus(o.status),
            orderPrice: o.limitPrice || o.filledAvgPrice || 0,
            orderQty: o.qty, filledQty: o.filledQty || 0,
            filledPrice: o.filledAvgPrice || 0,
            orderType: o.type === "market" ? "Market" : o.type === "limit" ? "Limit" : o.type || "Market",
            tif: (o.timeInForce || "").toLowerCase() === "gtc" ? "GTC" : "Day",
            session: "Extended", orderTime: o.createdAt ? new Date(o.createdAt).toLocaleString() : "",
            market: "US", currency: "USD",
          })));
        }
        if (accJ?.ok && accJ.data) {
          anyAccount = true;
          totalCash += Number(accJ.data.cash || 0);
          totalBP += Number(accJ.data.buyingPower || 0);
          totalEquity += Number(accJ.data.equity || 0);
        }
      }));

      setBrokerPositions(allPos);
      setBrokerOrders(allOrd);
      setBrokerAccount(anyAccount ? { cash: totalCash, buyingPower: totalBP, equity: totalEquity } : null);
    }
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [brokerCreds]);

  const allPositions = useMemo(() => [...POSITIONS, ...brokerPositions], [brokerPositions]);
  const allOrders = useMemo(() => [...ORDERS, ...brokerOrders], [brokerOrders]);

  const totalValue = allPositions.reduce((s, p) => s + p.mktValue, 0);
  const totalPnl = allPositions.reduce((s, p) => s + p.pnl, 0);
  const totalPnlPct = totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;
  const workingOrders = allOrders.filter(o => o.status === "queued" || o.status === "working").length;

  const filteredOrders = useMemo(() => {
    if (orderFilter === "all") return allOrders;
    return allOrders.filter(o => o.status === orderFilter);
  }, [orderFilter, allOrders]);

  function openDetail(sym: string) {
    try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: sym, asset: sym.includes("-USD") ? "crypto" : "stock" } })); } catch {}
  }
  function fireTrade(action: "BUY" | "SELL", sym: string) {
    try { window.dispatchEvent(new CustomEvent("imynted:tradeAction", { detail: { action, asset: sym.includes("-USD") ? "crypto" : "stock", symbol: sym } })); } catch {}
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto"
      style={{ background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)" }}>

      <div className="pointer-events-none fixed inset-0 z-0">
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 55% 35% at 5% 0%, rgba(52,211,153,0.07) 0%, transparent 100%)" }} />
      </div>

      <div className="relative z-10 px-3 md:px-5 py-4 space-y-4">

        {/* Header */}
        <div className="rounded-sm border border-emerald-400/[0.08] px-3 md:px-4 py-3"
          style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.05) 0%, rgba(4,10,18,0.95) 40%)" }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-[0.14em] text-emerald-400/80 uppercase">iMYNTED</span>
              <span className="text-white/15">|</span>
              <h1 className="text-[16px] md:text-[18px] font-bold text-white tracking-wide">Cash Account</h1>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {brokerAccount && (
                <>
                  <div className="text-right">
                    <div className="text-[9px] text-white/35">Cash</div>
                    <div className="text-[13px] font-bold text-white/80 tabular-nums">{fmtMoney(brokerAccount.cash)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-white/35">Buying Power</div>
                    <div className="text-[13px] font-bold text-cyan-300/80 tabular-nums">{fmtMoney(brokerAccount.buyingPower)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-white/35">Equity</div>
                    <div className="text-[14px] font-bold text-emerald-300 tabular-nums">{fmtMoney(brokerAccount.equity)}</div>
                  </div>
                </>
              )}
              {!brokerAccount && (
                <>
                  <div className="text-right">
                    <div className="text-[9px] text-white/35">Total Assets · {currency}</div>
                    <div className="text-[18px] font-bold text-white tabular-nums">{fmtMoney(totalValue)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-white/35">Total P/L</div>
                    <div className={cn("text-[14px] font-bold tabular-nums", totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {fmtMoney(totalPnl)}
                    </div>
                    <div className={cn("text-[10px] tabular-nums", totalPnl >= 0 ? "text-emerald-400/70" : "text-red-400/70")}>
                      {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto scrollbar-hide pb-1">
          {ACTIONS.map(a => (
            <button key={a.label} className="flex flex-col items-center gap-1 shrink-0 group relative" type="button"
              onClick={() => {
                if (a.action === "forex") window.location.href = "/scanner";
                else if (a.action === "ipo") window.location.href = "/ipos";
                else if (a.action === "tax") alert("Tax documents are available through your connected broker accounts. Go to Settings → Brokers to manage connections.");
                else if (a.action === "transfer") alert("Transfer Stock In — initiate a stock transfer through your connected broker. Go to Connect Brokers tab to manage broker connections.");
                else if (a.action === "refer") alert("Refer a friend — coming soon! Share iMYNTED with fellow traders.");
                else alert("Coming soon — this feature is under development.");
              }}>
              <span className={cn("w-10 h-10 md:w-12 md:h-12 rounded-sm border flex items-center justify-center transition-colors",
                (a as any).isLogo
                  ? "border-emerald-400/30 bg-emerald-400/[0.08] group-hover:bg-emerald-400/[0.15]"
                  : "border-emerald-400/15 bg-emerald-400/[0.04] group-hover:bg-emerald-400/[0.08]"
              )}>
                {(a as any).isLogo
                  ? <span className="text-[11px] md:text-[13px] font-black tracking-[0.1em] text-emerald-400">iM</span>
                  : <span className="text-[18px] md:text-[22px]">{a.icon}</span>
                }
              </span>
              <span className="text-[8px] md:text-[9px] text-white/40 text-center whitespace-pre-line leading-tight">{a.label}</span>
              {a.action === "coming-soon" && (
                <span className="absolute -top-1 -right-1 rounded-sm bg-amber-500/20 border border-amber-500/30 px-1 py-px text-[6px] font-bold text-amber-400/80 uppercase">Soon</span>
              )}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-emerald-400/[0.08]">
          {(["positions", "orders", "history", "stats", "command", "connect"] as AccTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 text-[11px] md:text-[12px] font-semibold transition-colors border-b-2 -mb-px capitalize",
                tab === t ? "border-emerald-400 text-white" : "border-transparent text-white/40 hover:text-white/70"
              )}>
              {t === "orders" ? `Orders(${workingOrders})` : t === "stats" ? "Today's Stats" : t === "connect" ? "Connect Brokers" : t === "command" ? "Command Center" : t}
            </button>
          ))}
        </div>

        {/* POSITIONS TAB */}
        {tab === "positions" && (
          <div className="rounded-sm border border-emerald-400/[0.08] overflow-x-auto"
            style={{ background: "rgba(6,14,24,0.6)" }}>
            <div className="min-w-[600px]">
              <div className="grid grid-cols-[1fr_60px_80px_80px_80px_90px] gap-2 px-3 py-2 border-b border-emerald-400/[0.08] text-[9px] text-white/35 uppercase tracking-wider font-semibold"
                style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.03) 0%, transparent 50%)" }}>
                <span>Symbol</span><span className="text-right">Qty</span><span className="text-right">Avg Price</span>
                <span className="text-right">Last</span><span className="text-right">Mkt Value</span><span className="text-right">P/L</span>
              </div>
              {allPositions.map(p => (
                <div key={p.symbol} className="border-b border-white/[0.03] hover:bg-emerald-400/[0.03] transition-colors group">
                  <div className="grid grid-cols-[1fr_60px_80px_80px_80px_90px] gap-2 px-3 py-2 items-center cursor-pointer"
                    onClick={() => openDetail(p.symbol)}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center h-[28px] min-w-[40px] px-2 rounded-sm text-[10px] font-bold text-white/90 shrink-0 border" style={pillStyle(p.symbol)}>
                        {p.symbol}
                      </span>
                      <span className="text-[9px] text-white/30 truncate">{p.name}</span>
                    </div>
                    <span className="text-[10px] text-white/60 text-right tabular-nums">{p.qty < 1 ? p.qty.toFixed(4) : p.qty}</span>
                    <span className="text-[10px] text-white/50 text-right tabular-nums">${p.avgPrice.toFixed(2)}</span>
                    <span className="text-[10px] text-white/70 text-right tabular-nums font-semibold">${p.lastPrice.toFixed(2)}</span>
                    <span className="text-[10px] text-white/60 text-right tabular-nums">{fmtMoney(p.mktValue)}</span>
                    <div className="text-right">
                      <span className={cn("text-[10px] tabular-nums font-semibold", p.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {fmtMoney(p.pnl)}
                      </span>
                      <span className={cn("text-[9px] tabular-nums ml-1", p.pnl >= 0 ? "text-emerald-400/60" : "text-red-400/60")}>
                        {p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 pb-2">
                    <button type="button" onClick={() => fireTrade("BUY", p.symbol)}
                      className="h-6 w-16 rounded-sm border border-emerald-400/25 bg-emerald-400/[0.08] text-[9px] font-bold text-emerald-300 hover:bg-emerald-400/15 transition-colors">BUY</button>
                    <button type="button" onClick={() => fireTrade("SELL", p.symbol)}
                      className="h-6 w-16 rounded-sm border border-red-400/25 bg-red-400/[0.08] text-[9px] font-bold text-red-300 hover:bg-red-400/15 transition-colors">SELL</button>
                    <span className="text-[8px] text-white/25 ml-1">{p.broker}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ORDERS TAB */}
        {tab === "orders" && (
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <select value={marketFilter} onChange={e => setMarketFilter(e.target.value)}
                className="rounded-sm border border-emerald-400/[0.1] bg-black/30 px-2 py-1.5 text-[10px] text-white/60 outline-none">
                <option>All Markets</option><option>US</option><option>HK</option><option>A-Shares</option>
              </select>
              <div className="flex items-center gap-0 rounded-sm border border-emerald-400/[0.12] overflow-hidden">
                {(["all", "filled", "queued", "working", "cancelled"] as const).map(s => (
                  <button key={s} onClick={() => setOrderFilter(s as any)}
                    className={cn("px-2 py-1 text-[9px] font-bold capitalize transition-colors",
                      orderFilter === s ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.02] text-white/40"
                    )}>{s === "all" ? `All ${allOrders.length}` : `${s} ${allOrders.filter(o => o.status === s).length}`}</button>
                ))}
              </div>
            </div>

            {/* Orders table */}
            <div className="rounded-sm border border-emerald-400/[0.08] overflow-x-auto"
              style={{ background: "rgba(6,14,24,0.6)" }}>
              <div className="min-w-[800px]">
                <div className="grid grid-cols-[60px_50px_60px_1fr_80px_70px_60px_80px_70px_60px_80px] gap-1 px-3 py-2 border-b border-emerald-400/[0.08] text-[8px] text-white/35 uppercase tracking-wider font-semibold"
                  style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.03) 0%, transparent 50%)" }}>
                  <span>Status</span><span>Side</span><span>Symbol</span><span>Name</span>
                  <span className="text-right">Filled@Avg</span><span className="text-right">Order Px</span>
                  <span className="text-right">Qty</span><span>Order Time</span><span>Type</span><span>TIF</span><span>Session</span>
                </div>
                {filteredOrders.map(o => {
                  const sc = STATUS_CFG[o.status];
                  return (
                    <div key={o.id} className="grid grid-cols-[60px_50px_60px_1fr_80px_70px_60px_80px_70px_60px_80px] gap-1 px-3 py-2 border-b border-white/[0.03] hover:bg-emerald-400/[0.02] transition-colors items-center cursor-pointer"
                      onClick={() => openDetail(o.symbol)}>
                      <div className="flex items-center gap-1">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", sc.dot)} />
                        <span className={cn("text-[9px] font-semibold", sc.text)}>{sc.label}</span>
                      </div>
                      <span className={cn("text-[9px] font-bold", o.side === "Buy" ? "text-emerald-400" : "text-red-400")}>{o.side}</span>
                      <span className="inline-flex items-center justify-center h-[22px] min-w-[32px] px-1 rounded-sm text-[8px] font-bold text-white/90 border" style={pillStyle(o.symbol)}>
                        {o.symbol}
                      </span>
                      <span className="text-[9px] text-white/40 truncate">{o.name}</span>
                      <span className="text-[9px] text-white/50 text-right tabular-nums">{o.filledQty > 0 ? `${o.filledQty}@${o.filledPrice.toFixed(2)}` : "0@0.00"}</span>
                      <span className="text-[9px] text-white/50 text-right tabular-nums">{o.orderPrice.toFixed(2)}</span>
                      <span className="text-[9px] text-white/50 text-right tabular-nums">{o.orderQty}</span>
                      <span className="text-[8px] text-white/30 truncate">{o.orderTime}</span>
                      <span className="text-[9px] text-white/40">{o.orderType}</span>
                      <span className="text-[9px] text-white/30">{o.tif}</span>
                      <span className="text-[8px] text-white/25 truncate">{o.session}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40">All Orders</span>
              <span className="rounded-sm border border-emerald-400/15 bg-emerald-400/[0.04] px-2 py-0.5 text-[9px] text-emerald-300/70">
                Qty <span className="font-bold">{allOrders.length}</span>
              </span>
            </div>
            <div className="rounded-sm border border-emerald-400/[0.08] overflow-x-auto"
              style={{ background: "rgba(6,14,24,0.6)" }}>
              <div className="min-w-[700px]">
                <div className="grid grid-cols-[50px_60px_1fr_70px_60px_80px_70px_80px] gap-1 px-3 py-2 border-b border-emerald-400/[0.08] text-[8px] text-white/35 uppercase tracking-wider font-semibold">
                  <span>Side</span><span>Symbol</span><span>Name</span><span className="text-right">Price</span>
                  <span className="text-right">Qty</span><span className="text-right">Amount</span><span>Status</span><span>Time</span>
                </div>
                {allOrders.map(o => {
                  const sc = STATUS_CFG[o.status];
                  const amount = o.filledQty * o.filledPrice;
                  return (
                    <div key={o.id} className="grid grid-cols-[50px_60px_1fr_70px_60px_80px_70px_80px] gap-1 px-3 py-2 border-b border-white/[0.03] hover:bg-emerald-400/[0.02] transition-colors items-center">
                      <span className={cn("text-[9px] font-bold", o.side === "Buy" ? "text-emerald-400" : "text-red-400")}>{o.side}</span>
                      <span className="text-[9px] font-bold text-white/80">{o.symbol}</span>
                      <span className="text-[9px] text-white/40 truncate">{o.name}</span>
                      <span className="text-[9px] text-white/50 text-right tabular-nums">{o.orderPrice.toFixed(2)}</span>
                      <span className="text-[9px] text-white/50 text-right tabular-nums">{o.orderQty.toLocaleString()}</span>
                      <span className="text-[9px] text-white/50 text-right tabular-nums">{amount > 0 ? `$${amount.toFixed(2)}` : "—"}</span>
                      <div className="flex items-center gap-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full", sc.dot)} />
                        <span className={cn("text-[8px] font-semibold", sc.text)}>{sc.label}</span>
                      </div>
                      <span className="text-[8px] text-white/25 truncate">{o.orderTime}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TODAY'S STATS TAB */}
        {tab === "stats" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <select className="rounded-sm border border-emerald-400/[0.1] bg-black/30 px-2 py-1.5 text-[10px] text-white/60 outline-none">
                <option>US</option>
              </select>
              <select value={currency} onChange={e => setCurrency(e.target.value)}
                className="rounded-sm border border-emerald-400/[0.1] bg-black/30 px-2 py-1.5 text-[10px] text-white/60 outline-none">
                <option>USD</option><option>HKD</option><option>CNH</option><option>SGD</option><option>JPY</option>
              </select>
            </div>
            <div className="rounded-sm border border-emerald-400/[0.08] px-4 py-3"
              style={{ background: "rgba(6,14,24,0.6)" }}>
              <div className="flex items-center gap-8 text-[11px]">
                <div>
                  <span className="text-white/35">Date</span>
                  <span className="ml-2 text-white/70 font-semibold">Mar 28, 2026</span>
                </div>
                <div>
                  <span className="text-white/35">Filled Orders</span>
                  <span className="ml-2 text-white/70 font-semibold tabular-nums">{allOrders.filter(o => o.status === "filled").length}</span>
                </div>
                <div>
                  <span className="text-white/35">Total Turnover</span>
                  <span className="ml-2 text-white/70 font-semibold tabular-nums">
                    {fmtMoney(allOrders.filter(o => o.status === "filled").reduce((s, o) => s + o.filledQty * o.filledPrice, 0))}
                  </span>
                </div>
                <div>
                  <span className="text-white/35">Total P/L</span>
                  <span className={cn("ml-2 font-semibold tabular-nums", totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {fmtMoney(totalPnl)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONNECT BROKERS TAB */}
        {tab === "connect" && (() => {
          const STOCK_BROKERS = [
            { id: "robinhood", name: "Robinhood", short: "RH", method: "OAUTH", color: "amber", icon: "https://cdn.brandfetch.io/robinhood.com/w/512/h/512/icon" },
            { id: "etrade", name: "E*Trade", short: "ETRADE", method: "OAUTH", color: "purple", icon: "https://cdn.brandfetch.io/etrade.com/w/512/h/512/icon" },
            { id: "webull", name: "Webull", short: "WEBULL", method: "OAUTH", color: "cyan", icon: "https://cdn.brandfetch.io/webull.com/w/512/h/512/icon" },
            { id: "moomoo", name: "Moomoo", short: "MOOMOO", method: "OAUTH", color: "purple", icon: "https://cdn.brandfetch.io/moomoo.com/w/512/h/512/icon" },
            { id: "fidelity", name: "Fidelity", short: "FIDELITY", method: "OAUTH", color: "emerald", icon: "https://cdn.brandfetch.io/fidelity.com/w/512/h/512/icon" },
            { id: "schwab", name: "Charles Schwab", short: "SCHWAB", method: "OAUTH", color: "cyan", icon: "https://cdn.brandfetch.io/schwab.com/w/512/h/512/icon" },
            { id: "ibkr", name: "Interactive Brokers", short: "IBKR", method: "API KEY", color: "red", icon: "https://cdn.brandfetch.io/interactivebrokers.com/w/512/h/512/icon" },
            { id: "tastytrade", name: "Tastytrade", short: "TASTY", method: "OAUTH", color: "amber", icon: "https://cdn.brandfetch.io/tastytrade.com/w/512/h/512/icon" },
            { id: "tradestation", name: "TradeStation", short: "TS", method: "API KEY", color: "sky", icon: "https://cdn.brandfetch.io/tradestation.com/w/512/h/512/icon" },
            { id: "alpaca", name: "Alpaca", short: "ALPACA", method: "API KEY", color: "amber", icon: "https://cdn.brandfetch.io/alpaca.markets/w/512/h/512/icon" },
            { id: "public", name: "Public", short: "PUBLIC", method: "OAUTH", color: "emerald", icon: "https://cdn.brandfetch.io/public.com/w/512/h/512/icon" },
            { id: "firstrade", name: "Firstrade", short: "FIRST", method: "OAUTH", color: "emerald", icon: "https://cdn.brandfetch.io/firstrade.com/w/512/h/512/icon" },
            { id: "tradier", name: "Tradier", short: "TRADIER", method: "API KEY", color: "orange", icon: "https://cdn.brandfetch.io/tradier.com/w/512/h/512/icon" },
          ];
          const CRYPTO_BROKERS = [
            { id: "coinbase", name: "Coinbase", short: "CB", method: "OAUTH", color: "sky", icon: "https://cdn.brandfetch.io/coinbase.com/w/512/h/512/icon" },
            { id: "binance", name: "Binance", short: "BIN", method: "API KEY", color: "amber", icon: "https://cdn.brandfetch.io/binance.com/w/512/h/512/icon" },
            { id: "kraken", name: "Kraken", short: "KRK", method: "API KEY", color: "purple", icon: "https://cdn.brandfetch.io/kraken.com/w/512/h/512/icon" },
            { id: "gemini", name: "Gemini", short: "GEM", method: "API KEY", color: "cyan", icon: "https://cdn.brandfetch.io/gemini.com/w/512/h/512/icon" },
            { id: "kucoin", name: "KuCoin", short: "KC", method: "API KEY", color: "emerald", icon: "https://cdn.brandfetch.io/kucoin.com/w/512/h/512/icon" },
            { id: "bybit", name: "Bybit", short: "BYBIT", method: "API KEY", color: "amber", icon: "https://cdn.brandfetch.io/bybit.com/w/512/h/512/icon" },
            { id: "okx", name: "OKX", short: "OKX", method: "API KEY", color: "white", icon: "https://cdn.brandfetch.io/okx.com/w/512/h/512/icon" },
            { id: "cryptocom", name: "Crypto.com", short: "CRO", method: "API KEY", color: "sky", icon: "https://cdn.brandfetch.io/crypto.com/w/512/h/512/icon" },
          ];
          const INTL_BROKERS = [
            { id: "etoro", name: "eToro", short: "ETORO", method: "OAUTH", color: "emerald", icon: "https://cdn.brandfetch.io/etoro.com/w/512/h/512/icon" },
            { id: "saxo", name: "Saxo", short: "SAXO", method: "API KEY", color: "sky", icon: "https://cdn.brandfetch.io/home.saxo/w/512/h/512/icon" },
            { id: "ig", name: "IG", short: "IG", method: "API KEY", color: "red", icon: "https://cdn.brandfetch.io/ig.com/w/512/h/512/icon" },
            { id: "trading212", name: "Trading212", short: "T212", method: "OAUTH", color: "cyan", icon: "https://cdn.brandfetch.io/trading212.com/w/512/h/512/icon" },
            { id: "degiro", name: "DEGIRO", short: "DEGIRO", method: "API KEY", color: "sky", icon: "https://cdn.brandfetch.io/degiro.eu/w/512/h/512/icon" },
          ];
          const colorMap: Record<string, string> = {
            amber: "border-amber-400/30 bg-amber-400/[0.06]", purple: "border-purple-400/30 bg-purple-400/[0.06]",
            cyan: "border-cyan-400/30 bg-cyan-400/[0.06]", emerald: "border-emerald-400/30 bg-emerald-400/[0.06]",
            red: "border-red-400/30 bg-red-400/[0.06]", sky: "border-sky-400/30 bg-sky-400/[0.06]",
            orange: "border-orange-400/30 bg-orange-400/[0.06]", white: "border-white/20 bg-white/[0.06]",
          };
          const textMap: Record<string, string> = {
            amber: "text-amber-400", purple: "text-purple-400", cyan: "text-cyan-400", emerald: "text-emerald-400",
            red: "text-red-400", sky: "text-sky-400", orange: "text-orange-400", white: "text-white/70",
          };
          function BrokerIcon({ b }: { b: { short: string; color: string; icon?: string } }) {
            const [ok, setOk] = React.useState(true);
            if (b.icon && ok) {
              return (
                <img src={b.icon} alt={b.short} width={40} height={40}
                  className="w-10 h-10 rounded-full object-contain bg-white/[0.06] border border-white/10"
                  onError={() => setOk(false)} />
              );
            }
            return (
              <span className={cn("inline-flex items-center justify-center w-10 h-10 rounded-full text-[14px] font-bold border", colorMap[b.color] ?? "border-white/20 bg-white/[0.06]", textMap[b.color] ?? "text-white/60")}>
                {b.short[0]}
              </span>
            );
          }
          const STOCK_IDS = ["alpaca", "tradier", "tastytrade", "trading212", "schwab", "ibkr", "tradestation", "etrade", "webull"];
          const CRYPTO_IDS = ["coinbase", "binance", "kraken", "bybit", "okx", "kucoin", "gemini", "cryptocom"];
          const totalConnected = Object.keys(brokerCreds).length;
          const stockConnected = STOCK_IDS.filter(id => brokerCreds[id]).length;
          const cryptoConnected = CRYPTO_IDS.filter(id => brokerCreds[id]).length;

          function BrokerCard({ b }: { b: { id: string; name: string; short: string; method: string; color: string; icon?: string } }) {
            const config = BROKER_CONNECT[b.id];
            const connected = !!(config && brokerCreds[b.id]);
            return (
              <div className={cn(
                "rounded-sm border p-3 transition-colors",
                connected ? "border-emerald-400/30 bg-emerald-400/[0.04]" : "border-emerald-400/[0.08] hover:border-emerald-400/20"
              )} style={{ background: connected ? "rgba(6,20,14,0.7)" : "rgba(6,14,24,0.6)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <BrokerIcon b={b} />
                  <div className="flex-1 min-w-0">
                    <span className={cn("rounded-sm border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider", colorMap[b.color] ?? "")}>{b.short}</span>
                    <div className="text-[11px] font-semibold text-white/85 mt-0.5 truncate">{b.name}</div>
                    <div className="text-[8px] text-white/30">{b.method}</div>
                  </div>
                  {connected && <span className="text-[8px] font-bold text-emerald-400 shrink-0">✓ LIVE</span>}
                </div>
                {connected ? (
                  <button onClick={() => disconnect(b.id)}
                    className="w-full h-7 rounded-sm border border-red-400/20 bg-red-400/[0.04] text-[10px] font-bold text-red-400/70 hover:bg-red-400/[0.08] transition-colors uppercase tracking-wider">
                    Disconnect
                  </button>
                ) : b.id === "robinhood" ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 px-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" style={{ boxShadow: "0 0 4px rgba(251,191,36,0.7)" }} />
                      <span className="text-[8px] font-bold text-amber-400/90 uppercase tracking-wider">Coming Soon — Official API in Beta</span>
                    </div>
                    <a
                      href="https://robinhood.com/us/en/about/robinhood-api/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 w-full h-7 rounded-sm border border-amber-400/30 bg-amber-400/[0.06] text-[10px] font-bold text-amber-400/80 hover:bg-amber-400/[0.12] transition-colors uppercase tracking-wider"
                    >
                      Join API Waitlist ↗
                    </a>
                  </div>
                ) : config ? (
                  <button onClick={() => { setCredInputs({}); setTestStatus("idle"); setTestMsg(""); setConnectingBroker(b.id); }}
                    className="w-full h-7 rounded-sm border border-emerald-400/20 bg-emerald-400/[0.04] text-[10px] font-bold text-emerald-400/80 hover:bg-emerald-400/[0.08] transition-colors uppercase tracking-wider">
                    Connect
                  </button>
                ) : (
                  <button disabled
                    className="w-full h-7 rounded-sm border border-white/10 bg-white/[0.02] text-[10px] font-bold text-white/25 uppercase tracking-wider cursor-not-allowed">
                    Coming Soon
                  </button>
                )}
              </div>
            );
          }

          const allBrokers = [...STOCK_BROKERS, ...CRYPTO_BROKERS, ...INTL_BROKERS];
          const modalConfig = connectingBroker ? BROKER_CONNECT[connectingBroker] : null;
          const modalBroker = connectingBroker ? allBrokers.find(b => b.id === connectingBroker) : null;

          return (
            <>
              {/* Generic connect modal */}
              {connectingBroker && modalConfig && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
                  <div className="w-full max-w-[420px] rounded border border-emerald-400/20 p-6 space-y-4"
                    style={{ background: "rgba(5,13,20,0.98)", boxShadow: "0 0 0 1px rgba(52,211,153,0.08), 0 24px 60px rgba(0,0,0,0.8)" }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold tracking-[0.12em] text-emerald-400/70 uppercase">Connect Broker</p>
                        <h2 className="text-[16px] font-bold text-white mt-0.5">{modalBroker?.name || connectingBroker}</h2>
                      </div>
                      <button onClick={() => setConnectingBroker(null)} className="text-white/30 hover:text-white/70 text-[22px] leading-none">×</button>
                    </div>
                    <p className="text-[10px] text-white/40 leading-relaxed">{modalConfig.hint}</p>
                    <div className="space-y-3">
                      {modalConfig.fields.map(f => (
                        <div key={f.key}>
                          <label className="block text-[9px] text-white/40 uppercase tracking-wider mb-1">{f.label}</label>
                          <input value={credInputs[f.key] || ""} onChange={e => setCredInputs(prev => ({ ...prev, [f.key]: e.target.value }))}
                            type={f.secret ? "password" : "text"} placeholder={f.placeholder}
                            className="w-full h-9 rounded-sm border border-white/10 bg-black/40 px-3 text-[12px] text-white/90 font-mono outline-none focus:border-emerald-400/30 placeholder:text-white/15" />
                        </div>
                      ))}
                    </div>
                    {testStatus === "ok" && (
                      <div className="flex items-center gap-2 rounded-sm border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2">
                        <span className="text-emerald-400 text-[13px]">✓</span>
                        <span className="text-[10px] text-emerald-300">{testMsg}</span>
                      </div>
                    )}
                    {testStatus === "fail" && (
                      <div className="flex items-center gap-2 rounded-sm border border-red-400/20 bg-red-400/[0.06] px-3 py-2">
                        <span className="text-red-400 text-[13px]">✗</span>
                        <span className="text-[10px] text-red-300">{testMsg}</span>
                      </div>
                    )}
                    <button
                      onClick={() => testAndSave(connectingBroker)}
                      disabled={testStatus === "testing" || modalConfig.fields.some(f => !credInputs[f.key]?.trim())}
                      className="w-full h-10 rounded-sm border border-emerald-400/25 bg-emerald-400/[0.08] text-[11px] font-bold text-emerald-300 hover:bg-emerald-400/[0.14] transition-colors uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed">
                      {testStatus === "testing" ? "Testing…" : "Test & Save"}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-white/50">TOTAL <span className={cn("font-bold", totalConnected > 0 ? "text-emerald-400" : "text-white/60")}>{totalConnected}</span></span>
                  <span className="text-white/50">STOCK <span className="font-bold">{stockConnected}</span></span>
                  <span className="text-white/50">CRYPTO <span className="font-bold">{cryptoConnected}</span></span>
                  <span className="text-white/50">INT&apos;L <span className="font-bold">0</span></span>
                </div>

                <div>
                  <h3 className="text-[11px] font-bold text-emerald-400/80 uppercase tracking-wider mb-2">Stock Brokers <span className="text-white/30">{stockConnected}/{STOCK_BROKERS.length}</span></h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {STOCK_BROKERS.map(b => <BrokerCard key={b.id} b={b} />)}
                  </div>
                </div>

                <div>
                  <h3 className="text-[11px] font-bold text-cyan-400/80 uppercase tracking-wider mb-2">Crypto Exchanges <span className="text-white/30">{cryptoConnected}/{CRYPTO_BROKERS.length}</span></h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {CRYPTO_BROKERS.map(b => <BrokerCard key={b.id} b={b} />)}
                  </div>
                </div>

                <div>
                  <h3 className="text-[11px] font-bold text-amber-400/80 uppercase tracking-wider mb-2">International <span className="text-white/30">0/{INTL_BROKERS.length}</span> <span className="rounded-sm border border-white/15 bg-white/[0.04] px-1.5 py-0.5 text-[7px] text-white/40 ml-1">COMING SOON</span></h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {INTL_BROKERS.map(b => <BrokerCard key={b.id} b={b} />)}
                  </div>
                </div>

                <p className="text-[9px] text-emerald-400/50">iMYNTED — THE CONTROL LAYER ABOVE ALL BROKERS</p>
                <p className="text-[8px] text-white/20">Phase 1: View Only · Phase 2: Alerts · Phase 3: Execution · Phase 4: Automation</p>
              </div>
            </>
          );
        })()}

        {/* COMMAND CENTER TAB */}
        {tab === "command" && (
          <div className="rounded-sm border border-emerald-400/[0.08] p-4 text-center"
            style={{ background: "rgba(6,14,24,0.6)" }}>
            <p className="text-[10px] text-emerald-400/70 font-bold tracking-[0.1em] uppercase mb-2">Command Center</p>
            <p className="text-[11px] text-white/50 mb-4">Full portfolio command center with real-time positions, orders, and risk analytics.</p>
            <button type="button" onClick={() => window.location.href = "/command-center"}
              className="rounded-sm border border-emerald-400/25 bg-emerald-400/[0.08] px-4 py-2 text-[11px] font-bold text-emerald-300 hover:bg-emerald-400/15 transition-colors">
              Open Command Center
            </button>
          </div>
        )}

        {/* Bottom ticker */}
        <div className="flex items-center gap-4 text-[10px] tabular-nums rounded-sm border border-emerald-400/[0.06] px-3 py-2 overflow-x-auto scrollbar-hide"
          style={{ background: "rgba(4,10,18,0.6)" }}>
          <span className="text-white/40 shrink-0">Dow Jones <span className="text-red-400 font-semibold">45,166.64 -1.73%</span></span>
          <span className="text-white/40 shrink-0">NASDAQ <span className="text-red-400 font-semibold">20,948.36 -2.15%</span></span>
          <span className="text-white/40 shrink-0">S&P 500 <span className="text-red-400 font-semibold">6,368.85 -1.67%</span></span>
        </div>
      </div>
    </div>
  );
}
