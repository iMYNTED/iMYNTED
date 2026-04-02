"use client";

import { useEffect, useState } from "react";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtMoney(v: number, sign = false) {
  const s = sign && v > 0 ? "+" : v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${s}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${s}$${(abs / 1_000).toFixed(2)}K`;
  return `${s}$${abs.toFixed(2)}`;
}
function fmtPct(v: number, sign = false) {
  return `${sign && v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtPx(v: number) {
  return v >= 100 ? v.toFixed(2) : v.toFixed(4);
}

/* ── Simulated positions (matches PositionsPanel data) ── */
type Pos = {
  symbol: string; asset: "stock" | "crypto";
  qty: number; avg: number; last: number;
  broker: string; sector: string;
};

const COMPANY_NAMES: Record<string, string> = {
  AAPL: "Apple Inc.", NVDA: "NVIDIA Corp.", TSLA: "Tesla Inc.", MSFT: "Microsoft Corp.",
  JPM: "JPMorgan Chase", SPY: "SPDR S&P 500 ETF", BTC: "Bitcoin", ETH: "Ethereum",
  AMZN: "Amazon.com", META: "Meta Platforms",
};

const BASE_POSITIONS: Pos[] = [
  { symbol: "AAPL",    asset: "stock",  qty: 150,   avg: 178.40, last: 204.91, broker: "RH",       sector: "Technology"    },
  { symbol: "NVDA",    asset: "stock",  qty: 40,    avg: 610.20, last: 875.40, broker: "ETRADE",    sector: "Technology"    },
  { symbol: "TSLA",    asset: "stock",  qty: 75,    avg: 195.60, last: 224.97, broker: "RH",        sector: "Consumer"      },
  { symbol: "MSFT",    asset: "stock",  qty: 60,    avg: 380.10, last: 415.32, broker: "FIDELITY",  sector: "Technology"    },
  { symbol: "JPM",     asset: "stock",  qty: 80,    avg: 195.00, last: 212.44, broker: "IBKR",      sector: "Finance"       },
  { symbol: "SPY",     asset: "stock",  qty: 100,   avg: 510.00, last: 535.80, broker: "FIDELITY",  sector: "ETF"           },
  { symbol: "BTC",     asset: "crypto", qty: 0.85,  avg: 62000,  last: 67420,  broker: "COINBASE",  sector: "Crypto"        },
  { symbol: "ETH",     asset: "crypto", qty: 4.2,   avg: 3100,   last: 3540,   broker: "COINBASE",  sector: "Crypto"        },
  { symbol: "AMZN",    asset: "stock",  qty: 25,    avg: 185.00, last: 196.50, broker: "ETRADE",    sector: "Consumer"      },
  { symbol: "META",    asset: "stock",  qty: 30,    avg: 490.00, last: 527.80, broker: "WEBULL",    sector: "Technology"    },
];

type Order = {
  id: string; symbol: string; side: "BUY" | "SELL";
  qty: number; price: number; status: "filled" | "partial" | "cancelled" | "pending";
  time: string; broker: string;
};

const SIM_ORDERS: Order[] = [
  { id: "1", symbol: "AAPL",  side: "BUY",  qty: 50,   price: 204.91, status: "filled",    time: "07:12 AM", broker: "RH"       },
  { id: "2", symbol: "NVDA",  side: "BUY",  qty: 10,   price: 875.40, status: "filled",    time: "07:08 AM", broker: "ETRADE"    },
  { id: "3", symbol: "TSLA",  side: "SELL", qty: 25,   price: 224.50, status: "filled",    time: "06:55 AM", broker: "RH"       },
  { id: "4", symbol: "BTC",   side: "BUY",  qty: 0.1,  price: 67420,  status: "partial",   time: "06:40 AM", broker: "COINBASE"  },
  { id: "5", symbol: "SPY",   side: "BUY",  qty: 20,   price: 535.80, status: "pending",   time: "07:18 AM", broker: "FIDELITY"  },
  { id: "6", symbol: "META",  side: "SELL", qty: 10,   price: 527.80, status: "cancelled", time: "06:30 AM", broker: "WEBULL"    },
  { id: "7", symbol: "AMZN",  side: "BUY",  qty: 5,    price: 196.50, status: "filled",    time: "06:15 AM", broker: "ETRADE"    },
  { id: "8", symbol: "ETH",   side: "BUY",  qty: 1.0,  price: 3540,   status: "filled",    time: "05:58 AM", broker: "COINBASE"  },
];

type TabType = "positions" | "orders" | "risk";

const BROKER_CFG: Record<string, { bg: string; text: string; border: string }> = {
  RH:       { bg: "bg-amber-400/15",   text: "text-amber-300",   border: "border-amber-400/30"   },
  ETRADE:   { bg: "bg-purple-400/15",  text: "text-purple-300",  border: "border-purple-400/30"  },
  FIDELITY: { bg: "bg-emerald-400/15", text: "text-emerald-300", border: "border-emerald-400/30" },
  IBKR:     { bg: "bg-sky-400/15",     text: "text-sky-300",     border: "border-sky-400/30"     },
  WEBULL:   { bg: "bg-cyan-400/15",    text: "text-cyan-300",    border: "border-cyan-400/30"    },
  COINBASE: { bg: "bg-orange-400/15",  text: "text-orange-300",  border: "border-orange-400/30"  },
  BINANCE:  { bg: "bg-yellow-400/15",  text: "text-yellow-300",  border: "border-yellow-400/30"  },
  ALPACA:   { bg: "bg-amber-400/15",   text: "text-amber-300",   border: "border-amber-400/30"   },
};

const ORDER_STATUS_CFG = {
  filled:    { label: "FILLED",    cls: "text-emerald-400 border-emerald-400/25 bg-emerald-400/10" },
  partial:   { label: "PARTIAL",   cls: "text-amber-400  border-amber-400/25  bg-amber-400/10"  },
  cancelled: { label: "CANCELLED", cls: "text-white/30   border-white/10      bg-white/[0.03]"  },
  pending:   { label: "PENDING",   cls: "text-cyan-400   border-cyan-400/25   bg-cyan-400/10"   },
};

export default function CommandCenterPage() {
  const [tab, setTab] = useState<TabType>("positions");
  const [positions, setPositions] = useState<Pos[]>([]);
  const [tick, setTick] = useState(0);
  const [clockStr, setClockStr] = useState("");

  const [alpacaOrders, setAlpacaOrders] = useState<Order[]>([]);
  const [alpacaAccount, setAlpacaAccount] = useState<{ cash: number; buyingPower: number } | null>(null);

  useEffect(() => {
    async function load() {
      // Fetch Alpaca positions
      try {
        const res = await fetch("/api/broker/alpaca?action=positions", { cache: "no-store" });
        const j = await res.json();
        if (j?.ok && Array.isArray(j.data) && j.data.length > 0) {
          const alpacaPos: Pos[] = j.data.map((p: any) => ({
            symbol: p.symbol, asset: p.asset === "crypto" ? "crypto" as const : "stock" as const,
            qty: p.qty, avg: p.avgPrice, last: p.lastPrice,
            broker: "ALPACA", sector: p.asset === "crypto" ? "Crypto" : "Technology",
          }));
          setPositions([...BASE_POSITIONS, ...alpacaPos]);
        } else {
          setPositions(BASE_POSITIONS);
        }
      } catch {
        setPositions(BASE_POSITIONS);
      }

      // Fetch Alpaca orders
      try {
        const res = await fetch("/api/broker/alpaca?action=orders", { cache: "no-store" });
        const j = await res.json();
        if (j?.ok && Array.isArray(j.data)) {
          setAlpacaOrders(j.data.map((o: any, i: number) => ({
            id: `alp-${i}`, symbol: o.symbol,
            side: (o.side === "sell" ? "SELL" : "BUY") as "BUY" | "SELL",
            qty: o.qty, price: o.filledAvgPrice || o.limitPrice || 0,
            status: (o.status === "filled" ? "filled" : o.status === "partially_filled" ? "partial" : o.status === "canceled" || o.status === "cancelled" ? "cancelled" : "pending") as Order["status"],
            time: o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " " + new Date(o.createdAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "",
            broker: "ALPACA",
          })));
        }
      } catch {}

      // Fetch Alpaca account
      try {
        const res = await fetch("/api/broker/alpaca?action=account", { cache: "no-store" });
        const j = await res.json();
        if (j?.ok) setAlpacaAccount({ cash: j.data.cash, buyingPower: j.data.buyingPower });
      } catch {}

      setClockStr(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }

    load();
    const t = setInterval(() => {
      load();
      setTick(n => n + 1);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const enriched = positions.map(p => {
    const mv = p.qty * p.last;
    const cb = p.qty * p.avg;
    const pnl = mv - cb;
    const pnlPct = cb > 0 ? (pnl / cb) * 100 : 0;
    return { ...p, mv, cb, pnl, pnlPct };
  });

  const allOrders = [...SIM_ORDERS, ...alpacaOrders];

  const totalMv   = enriched.reduce((s, r) => s + r.mv, 0);
  const totalCb   = enriched.reduce((s, r) => s + r.cb, 0);
  const totalPnl  = totalMv - totalCb;
  const totalPct  = totalCb > 0 ? (totalPnl / totalCb) * 100 : 0;
  const dayPnl    = totalMv * 0.0042; // sim day P&L
  const buyingPow = alpacaAccount?.buyingPower ?? 24_850.00;

  // Sector breakdown
  const sectorMap = new Map<string, number>();
  enriched.forEach(r => {
    sectorMap.set(r.sector, (sectorMap.get(r.sector) ?? 0) + r.mv);
  });
  const sectors = Array.from(sectorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, mv]) => ({ name, mv, pct: totalMv > 0 ? (mv / totalMv) * 100 : 0 }));

  const sectorColors: Record<string, string> = {
    Technology: "bg-cyan-400",
    Finance:    "bg-emerald-400",
    Consumer:   "bg-amber-400",
    ETF:        "bg-purple-400",
    Crypto:     "bg-orange-400",
  };

  function openDetail(sym: string, asset: "stock" | "crypto") {
    try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: sym, asset } })); } catch {}
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto"
      style={{ background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)" }}>

      {/* Glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 55% 35% at 5% 0%, rgba(52,211,153,0.07) 0%, transparent 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 30% 20% at 95% 100%, rgba(34,211,238,0.04) 0%, transparent 100%)" }} />
      </div>

      <div className="relative z-10 px-3 md:px-5 py-4 md:py-5 space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <span className="text-[10px] font-bold tracking-[0.14em] text-emerald-400/80 uppercase shrink-0">iMYNTED</span>
            <span className="text-white/20 hidden md:inline">|</span>
            <h1 className="text-[14px] md:text-[18px] font-bold text-white tracking-wide">COMMAND CENTER</h1>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2 py-0.5 text-[9px] font-bold text-emerald-400/70 uppercase tracking-wider shrink-0">SIM</span>
          </div>
          <div className="flex items-center gap-2 md:gap-3 text-[10px]">
            <span className="text-white/30 hidden md:inline">Last update</span>
            <span className="text-emerald-400/70 tabular-nums">{clockStr}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Portfolio Value",   value: fmtMoney(totalMv),           sub: `${enriched.length} positions`,                    cls: "text-white/90"    },
            { label: "Unrealized P&L",    value: fmtMoney(totalPnl, true),     sub: fmtPct(totalPct, true),                             cls: totalPnl >= 0 ? "text-emerald-400" : "text-red-400" },
            { label: "Day P&L",           value: fmtMoney(dayPnl, true),       sub: fmtPct((dayPnl / totalMv) * 100, true),             cls: dayPnl >= 0 ? "text-emerald-400" : "text-red-400"   },
            { label: "Buying Power",      value: fmtMoney(buyingPow),          sub: "Cash available",                                   cls: "text-cyan-400"    },
          ].map(({ label, value, sub, cls }) => (
            <div key={label} className="rounded border border-white/[0.07] px-4 py-3"
              style={{ background: "rgba(6,14,24,0.7)" }}>
              <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">{label}</p>
              <p className={cn("text-[20px] font-bold tabular-nums leading-tight", cls)}>{value}</p>
              <p className="text-[10px] text-white/35 mt-0.5 tabular-nums">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Market strip ── */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { sym: "SPY",  name: "S&P 500",    px: 535.80,  chg: +0.42 },
            { sym: "QQQ",  name: "Nasdaq 100", px: 449.20,  chg: +0.61 },
            { sym: "IWM",  name: "Russell 2K", px: 208.40,  chg: -0.18 },
            { sym: "DIA",  name: "Dow Jones",  px: 398.70,  chg: +0.29 },
            { sym: "VIX",  name: "Volatility", px: 14.82,   chg: -3.20 },
            { sym: "BTC",  name: "Bitcoin",    px: 67420,   chg: +1.84 },
          ].map(m => (
            <div key={m.sym} className="rounded border border-white/[0.06] px-3 py-2 flex items-center justify-between"
              style={{ background: "rgba(6,14,24,0.5)" }}>
              <div>
                <div className="text-[10px] font-bold text-white/80">{m.sym}</div>
                <div className="text-[8px] text-white/30">{m.name}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] tabular-nums text-white/70 font-semibold">
                  {m.px >= 1000 ? m.px.toLocaleString(undefined, { maximumFractionDigits: 0 }) : m.px.toFixed(2)}
                </div>
                <div className={cn("text-[10px] tabular-nums font-bold", m.chg >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {m.chg >= 0 ? "+" : ""}{m.chg.toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-0 border-b border-white/[0.06]">
          {(["positions", "orders", "risk"] as TabType[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 text-[11px] font-semibold uppercase tracking-wide transition border-b-2 -mb-px",
                tab === t ? "border-emerald-400 text-emerald-400" : "border-transparent text-white/35 hover:text-white/60"
              )}>
              {t === "positions" ? `Positions (${enriched.length})` : t === "orders" ? `Orders (${allOrders.length})` : "Risk"}
            </button>
          ))}
        </div>

        {/* ── POSITIONS TAB ── */}
        {tab === "positions" && (
          <div className="rounded border border-white/[0.06] overflow-x-auto"
            style={{ background: "rgba(6,14,24,0.6)" }}>
            {/* Table header */}
            <div className="grid px-4 py-2 border-b border-white/[0.06] bg-black/20 text-[9px] text-white/35 uppercase tracking-wider font-semibold"
              style={{ gridTemplateColumns: "var(--pos-cols)" }}>
              <span>Symbol</span>
              <span className="text-right">Qty</span>
              <span className="text-right hidden md:block">Avg Cost</span>
              <span className="text-right">Last Px</span>
              <span className="text-right hidden md:block">Mkt Value</span>
              <span className="text-right">Unr. P&L</span>
              <span className="text-right hidden md:block">P&L %</span>
              <span className="text-right hidden md:block">Day P&L</span>
              <span className="text-right hidden md:block">Realized</span>
              <span className="text-right hidden md:block">Broker</span>
            </div>

            {enriched.map((r) => {
              const dayPnlRow = r.mv * 0.004 * (Math.random() > 0.3 ? 1 : -1);
              const realizedRow = r.pnl * 0.15;
              const bc = BROKER_CFG[r.broker] ?? { bg: "bg-white/10", text: "text-white/40", border: "border-white/15" };
              function fireTrade(action: "BUY" | "SELL" | "FLAT") {
                try {
                  window.dispatchEvent(new CustomEvent("imynted:tradeAction", { detail: { action, asset: r.asset, symbol: r.symbol } }));
                } catch {}
              }
              return (
                <div key={r.symbol}
                  className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors group">
                  <div className="grid px-4 py-2 items-center cursor-pointer"
                    style={{ gridTemplateColumns: "var(--pos-cols)" }}
                    onClick={() => openDetail(r.symbol, r.asset)}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", r.asset === "crypto" ? "bg-orange-400/70" : "bg-emerald-400/70")} />
                      <div className="min-w-0">
                        <div className="text-[12px] font-bold text-white group-hover:text-emerald-300 transition-colors">{r.symbol}</div>
                        <div className="text-[9px] text-white/30 truncate leading-tight">{COMPANY_NAMES[r.symbol] ?? ""}</div>
                      </div>
                    </div>
                    <span className="text-[11px] tabular-nums text-white/60 text-right">{r.qty < 1 ? r.qty.toFixed(4) : r.qty.toLocaleString()}</span>
                    <span className="text-[11px] tabular-nums text-white/55 text-right hidden md:block">${fmtPx(r.avg)}</span>
                    <span className="text-[11px] tabular-nums text-white/80 font-semibold text-right">${fmtPx(r.last)}</span>
                    <span className="text-[11px] tabular-nums text-white/70 text-right hidden md:block">{fmtMoney(r.mv)}</span>
                    <span className={cn("text-[11px] tabular-nums font-semibold text-right", r.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {fmtMoney(r.pnl, true)}
                    </span>
                    <span className={cn("text-[11px] tabular-nums font-semibold text-right hidden md:block", r.pnlPct >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {fmtPct(r.pnlPct, true)}
                    </span>
                    <span className={cn("text-[11px] tabular-nums font-semibold text-right hidden md:block", dayPnlRow >= 0 ? "text-emerald-400/80" : "text-red-400/80")}>
                      {fmtMoney(dayPnlRow, true)}
                    </span>
                    <span className={cn("text-[11px] tabular-nums text-right hidden md:block", realizedRow >= 0 ? "text-emerald-400/60" : "text-red-400/60")}>
                      {fmtMoney(realizedRow, true)}
                    </span>
                    <span className="text-right hidden md:block">
                      <span className={cn("rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-wide", bc.bg, bc.text, bc.border)}>{r.broker}</span>
                    </span>
                  </div>
                  {/* BUY / SELL / FLAT pills */}
                  <div className="flex items-center gap-1.5 px-4 pb-2">
                    <button type="button" onClick={() => fireTrade("BUY")}
                      className="h-6 flex-1 max-w-[80px] rounded-sm border border-emerald-400/25 bg-emerald-400/[0.08] text-[9px] font-bold text-emerald-300 hover:bg-emerald-400/15 transition-colors">BUY</button>
                    <button type="button" onClick={() => fireTrade("SELL")}
                      className="h-6 flex-1 max-w-[80px] rounded-sm border border-red-400/25 bg-red-400/[0.08] text-[9px] font-bold text-red-300 hover:bg-red-400/15 transition-colors">SELL</button>
                    <button type="button" onClick={() => fireTrade("FLAT")}
                      className="h-6 rounded-sm border border-white/10 bg-white/[0.04] px-2 text-[9px] font-bold text-white/50 hover:bg-white/[0.08] transition-colors">FLAT</button>
                    <span className="text-[8px] text-white/25 ml-auto">{r.broker}</span>
                  </div>
                </div>
              );
            })}

            {/* Totals row */}
            <div className="grid px-4 py-2.5 bg-white/[0.02] border-t border-white/[0.08] text-[11px] font-semibold items-center"
              style={{ gridTemplateColumns: "var(--pos-cols)" }}>
              <span className="text-white/50 text-[9px] uppercase tracking-widest">TOTAL</span>
              <span />
              <span className="hidden md:block" />
              <span />
              <span className="text-right text-white/80 tabular-nums hidden md:block">{fmtMoney(totalMv)}</span>
              <span className={cn("text-right tabular-nums", totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>{fmtMoney(totalPnl, true)}</span>
              <span className={cn("text-right tabular-nums hidden md:block", totalPct >= 0 ? "text-emerald-400" : "text-red-400")}>{fmtPct(totalPct, true)}</span>
              <span className="text-right text-emerald-400/70 tabular-nums hidden md:block">{fmtMoney(dayPnl, true)}</span>
              <span className="hidden md:block" /><span className="hidden md:block" />
            </div>
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {tab === "orders" && (<>
          <div className="rounded border border-white/[0.06] overflow-x-auto"
            style={{ background: "rgba(6,14,24,0.6)" }}>
            <div className="grid px-4 py-2 border-b border-white/[0.06] bg-black/20 text-[9px] text-white/35 uppercase tracking-wider font-semibold"
              style={{ gridTemplateColumns: "var(--orders-cols)" }}>
              <span>Symbol</span>
              <span>Side</span>
              <span className="text-right">Qty</span>
              <span className="text-right hidden md:block">Price</span>
              <span className="text-right hidden md:block">Total Value</span>
              <span className="text-center">Status</span>
              <span className="hidden md:block">Time</span>
              <span className="hidden md:block">Type</span>
              <span className="text-right hidden md:block">Broker</span>
            </div>

            {allOrders.map(o => {
              const sc = ORDER_STATUS_CFG[o.status];
              const totalVal = o.qty * o.price;
              return (
                <div key={o.id} className="grid px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center"
                  style={{ gridTemplateColumns: "var(--orders-cols)" }}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", o.symbol === "BTC" || o.symbol === "ETH" ? "bg-orange-400/70" : "bg-emerald-400/70")} />
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-white/85">{o.symbol}</div>
                      <div className="text-[9px] text-white/30 truncate leading-tight">{COMPANY_NAMES[o.symbol] ?? ""}</div>
                    </div>
                  </div>
                  <span className={cn("rounded-sm border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide w-fit",
                    o.side === "BUY"
                      ? "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300"
                      : "border-red-400/25 bg-red-400/[0.08] text-red-300"
                  )}>
                    {o.side === "BUY" ? "▲ BUY" : "▼ SELL"}
                  </span>
                  <span className="text-[11px] tabular-nums text-white/60 text-right">{o.qty < 1 ? o.qty.toFixed(4) : o.qty}</span>
                  <span className="text-[11px] tabular-nums text-white/75 font-semibold text-right hidden md:block">${fmtPx(o.price)}</span>
                  <span className="text-[11px] tabular-nums text-white/55 text-right hidden md:block">{fmtMoney(totalVal)}</span>
                  <span className="text-center">
                    <span className={cn("rounded border px-2.5 py-0.5 text-[8px] font-bold uppercase tracking-wide", sc.cls)}>{sc.label}</span>
                  </span>
                  <span className="text-[10px] text-white/35 tabular-nums hidden md:block">{o.time}</span>
                  <span className="text-[10px] text-white/30 hidden md:block">Market</span>
                  <span className="text-right hidden md:block">
                    {(() => { const bc = BROKER_CFG[o.broker] ?? { bg: "bg-white/10", text: "text-white/40", border: "border-white/15" };
                      return <span className={cn("rounded border px-1.5 py-0.5 text-[8px] font-bold", bc.bg, bc.text, bc.border)}>{o.broker}</span>;
                    })()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── Order stats row ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {/* Order Summary */}
            <div className="rounded border border-white/[0.06] p-3" style={{ background: "rgba(6,14,24,0.6)" }}>
              <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-2">Order Summary</p>
              {(() => {
                const filled = allOrders.filter(o => o.status === "filled").length;
                const partial = allOrders.filter(o => o.status === "partial").length;
                const pending = allOrders.filter(o => o.status === "pending").length;
                const cancelled = allOrders.filter(o => o.status === "cancelled").length;
                const buys = allOrders.filter(o => o.side === "BUY").length;
                const sells = allOrders.filter(o => o.side === "SELL").length;
                return (
                  <div className="space-y-1.5">
                    {[
                      { label: "Total Orders", value: String(allOrders.length), cls: "text-white/70" },
                      { label: "Filled", value: String(filled), cls: "text-emerald-400" },
                      { label: "Partial", value: String(partial), cls: "text-amber-400" },
                      { label: "Pending", value: String(pending), cls: "text-cyan-400" },
                      { label: "Cancelled", value: String(cancelled), cls: "text-white/30" },
                      { label: "Buy / Sell", value: `${buys} / ${sells}`, cls: "text-white/60" },
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="flex items-center justify-between py-[2px] border-b border-white/[0.04]">
                        <span className="text-[10px] text-white/40">{label}</span>
                        <span className={cn("text-[11px] tabular-nums font-semibold", cls)}>{value}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Execution Stats */}
            <div className="rounded border border-white/[0.06] p-3" style={{ background: "rgba(6,14,24,0.6)" }}>
              <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-2">Execution Stats</p>
              {(() => {
                const filledOrders = allOrders.filter(o => o.status === "filled");
                const totalFilled = filledOrders.reduce((s, o) => s + o.qty * o.price, 0);
                const avgFill = filledOrders.length > 0 ? totalFilled / filledOrders.length : 0;
                const fillRate = allOrders.length > 0 ? (filledOrders.length / allOrders.length) * 100 : 0;
                return (
                  <div className="space-y-1.5">
                    {[
                      { label: "Fill Rate", value: `${fillRate.toFixed(0)}%`, cls: "text-emerald-400" },
                      { label: "Total Filled Value", value: fmtMoney(totalFilled), cls: "text-white/70" },
                      { label: "Avg Order Value", value: fmtMoney(avgFill), cls: "text-white/60" },
                      { label: "Avg Slippage", value: "0.02%", cls: "text-cyan-400/70" },
                      { label: "Avg Fill Time", value: "<1s", cls: "text-white/50" },
                      { label: "Rejection Rate", value: "0%", cls: "text-emerald-400/70" },
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="flex items-center justify-between py-[2px] border-b border-white/[0.04]">
                        <span className="text-[10px] text-white/40">{label}</span>
                        <span className={cn("text-[11px] tabular-nums font-semibold", cls)}>{value}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Order Flow Timeline */}
            <div className="rounded border border-white/[0.06] p-3" style={{ background: "rgba(6,14,24,0.6)" }}>
              <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-2">Order Flow</p>
              <div className="space-y-1.5">
                {allOrders.slice(0, 6).map(o => (
                  <div key={o.id} className="flex items-center gap-2 py-[2px]">
                    <span className="text-[9px] text-white/30 tabular-nums w-14 shrink-0">{o.time}</span>
                    <span className="text-[10px] font-bold text-white/70 w-10 shrink-0">{o.symbol}</span>
                    <span className={cn("rounded-sm border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide",
                      o.side === "BUY" ? "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300" : "border-red-400/25 bg-red-400/[0.08] text-red-300"
                    )}>{o.side === "BUY" ? "▲ B" : "▼ S"}</span>
                    <span className="text-[9px] tabular-nums text-white/40 ml-auto">{fmtMoney(o.qty * o.price)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Buy/Sell Distribution */}
            <div className="rounded border border-white/[0.06] p-3" style={{ background: "rgba(6,14,24,0.6)" }}>
              <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-2">Buy / Sell Distribution</p>
              {(() => {
                const buyVal = allOrders.filter(o => o.side === "BUY").reduce((s, o) => s + o.qty * o.price, 0);
                const sellVal = allOrders.filter(o => o.side === "SELL").reduce((s, o) => s + o.qty * o.price, 0);
                const total = buyVal + sellVal || 1;
                const buyPct = (buyVal / total) * 100;
                return (
                  <div className="space-y-3">
                    {/* Distribution bar */}
                    <div>
                      <div className="flex h-3 rounded-full overflow-hidden mb-1.5">
                        <div className="bg-emerald-400/60 h-full transition-all" style={{ width: `${buyPct}%` }} />
                        <div className="bg-red-400/60 h-full transition-all flex-1" />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] font-bold text-emerald-400">Buy {buyPct.toFixed(0)}%</span>
                        <span className="text-[10px] font-bold text-red-400">Sell {(100 - buyPct).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="space-y-1.5 pt-1 border-t border-white/[0.04]">
                      <div className="flex items-center justify-between py-[2px]">
                        <span className="text-[10px] text-white/40">Buy Volume</span>
                        <span className="text-[11px] tabular-nums font-semibold text-emerald-400">{fmtMoney(buyVal)}</span>
                      </div>
                      <div className="flex items-center justify-between py-[2px]">
                        <span className="text-[10px] text-white/40">Sell Volume</span>
                        <span className="text-[11px] tabular-nums font-semibold text-red-400">{fmtMoney(sellVal)}</span>
                      </div>
                      <div className="flex items-center justify-between py-[2px]">
                        <span className="text-[10px] text-white/40">Net Flow</span>
                        <span className={cn("text-[11px] tabular-nums font-semibold", buyVal >= sellVal ? "text-emerald-400" : "text-red-400")}>
                          {buyVal >= sellVal ? "+" : ""}{fmtMoney(buyVal - sellVal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-[2px]">
                        <span className="text-[10px] text-white/40">Avg Buy Price</span>
                        <span className="text-[11px] tabular-nums text-white/60">
                          {fmtMoney(allOrders.filter(o => o.side === "BUY").length > 0
                            ? buyVal / allOrders.filter(o => o.side === "BUY").reduce((s, o) => s + o.qty, 0)
                            : 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </>)}

        {/* ── RISK TAB ── */}
        {tab === "risk" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Sector allocation */}
            <div className="rounded border border-white/[0.06] p-4"
              style={{ background: "rgba(6,14,24,0.6)" }}>
              <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-3">Sector Allocation</p>
              <div className="space-y-2.5">
                {sectors.map(s => (
                  <div key={s.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-white/70">{s.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] tabular-nums text-white/50">{fmtMoney(s.mv)}</span>
                        <span className="text-[10px] tabular-nums text-white/70 font-semibold w-10 text-right">{s.pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", sectorColors[s.name] ?? "bg-white/40")}
                        style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Exposure metrics */}
            <div className="rounded border border-white/[0.06] p-4"
              style={{ background: "rgba(6,14,24,0.6)" }}>
              <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-3">Exposure Metrics</p>
              <div className="space-y-2">
                {[
                  { label: "Gross Exposure",    value: fmtMoney(totalMv),                           cls: "text-white/80"    },
                  { label: "Net Exposure",       value: fmtMoney(totalMv * 0.87),                    cls: "text-white/80"    },
                  { label: "Long Exposure",      value: fmtMoney(totalMv),                           cls: "text-emerald-400" },
                  { label: "Short Exposure",     value: "$0.00",                                     cls: "text-red-400/60"  },
                  { label: "Long / Short",       value: "100% / 0%",                                 cls: "text-cyan-400"    },
                  { label: "Stock Exposure",     value: fmtPct(sectors.filter(s => s.name !== "Crypto").reduce((a, s) => a + s.pct, 0)), cls: "text-white/70" },
                  { label: "Crypto Exposure",    value: fmtPct(sectors.find(s => s.name === "Crypto")?.pct ?? 0), cls: "text-orange-400" },
                  { label: "Leverage",           value: "1.0×",                                      cls: "text-white/60"    },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex items-center justify-between py-[3px] border-b border-white/[0.04]">
                    <span className="text-[10px] text-white/40">{label}</span>
                    <span className={cn("text-[11px] tabular-nums font-semibold", cls)}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Long/Short bar */}
            <div className="md:col-span-2 rounded border border-white/[0.06] px-4 py-3"
              style={{ background: "rgba(6,14,24,0.6)" }}>
              <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-2">Long / Short Balance</p>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-emerald-400 w-16">Long 100%</span>
                <div className="flex-1 h-3 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-400/60 h-full transition-all" style={{ width: "100%" }} />
                </div>
                <span className="text-[11px] font-bold text-red-400/50 w-16 text-right">Short 0%</span>
              </div>
              <p className="mt-2 text-[9px] text-white/25">Connect broker accounts to see live hedging ratio · short positions · options delta</p>
            </div>

            {/* ── Risk: Row 2 ── */}
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Correlation Matrix */}
              <div className="rounded border border-white/[0.06] p-4" style={{ background: "rgba(6,14,24,0.6)" }}>
                <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-3">Correlation Matrix</p>
                {(() => {
                  const syms = enriched.slice(0, 5).map(r => r.symbol);
                  return (
                    <div className="space-y-0">
                      <div className="grid gap-0" style={{ gridTemplateColumns: `40px repeat(${syms.length}, 1fr)` }}>
                        <span />
                        {syms.map(s => <span key={s} className="text-[8px] text-white/40 text-center font-semibold">{s}</span>)}
                      </div>
                      {syms.map((row, ri) => (
                        <div key={row} className="grid gap-0" style={{ gridTemplateColumns: `40px repeat(${syms.length}, 1fr)` }}>
                          <span className="text-[8px] text-white/40 font-semibold flex items-center">{row}</span>
                          {syms.map((col, ci) => {
                            const v = ri === ci ? 1.0 : [0.72, 0.45, -0.12, 0.31, 0.88, 0.65, -0.08, 0.54, 0.22, 0.77][(ri * syms.length + ci) % 10];
                            const bg = v >= 0.5 ? `rgba(52,211,153,${(v * 0.5).toFixed(2)})` : v >= 0 ? `rgba(52,211,153,${(v * 0.25).toFixed(2)})` : `rgba(248,113,113,${(Math.abs(v) * 0.4).toFixed(2)})`;
                            return (
                              <div key={col} className="flex items-center justify-center py-1.5" style={{ background: bg }}>
                                <span className="text-[9px] tabular-nums text-white/70 font-semibold">{v.toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Risk Scores */}
              <div className="rounded border border-white/[0.06] p-4" style={{ background: "rgba(6,14,24,0.6)" }}>
                <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-3">Risk Scores</p>
                <div className="space-y-3">
                  {[
                    { label: "Portfolio Beta",       value: 1.14, max: 2,   color: "bg-cyan-400"    },
                    { label: "Volatility (30d)",     value: 18.5, max: 50,  color: "bg-amber-400"   },
                    { label: "Value at Risk (95%)",  value: 2.8,  max: 10,  color: "bg-red-400"     },
                    { label: "Sortino Ratio",        value: 1.82, max: 3,   color: "bg-emerald-400" },
                    { label: "Information Ratio",    value: 0.64, max: 2,   color: "bg-purple-400"  },
                    { label: "Tracking Error",       value: 3.2,  max: 10,  color: "bg-sky-400"     },
                  ].map(r => (
                    <div key={r.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-white/50">{r.label}</span>
                        <span className="text-[11px] tabular-nums text-white/80 font-semibold">{r.value}{r.label.includes("%") ? "%" : r.label.includes("Ratio") || r.label.includes("Beta") ? "×" : "%"}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", r.color)} style={{ width: `${Math.min((r.value / r.max) * 100, 100)}%`, opacity: 0.6 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Drawdown History */}
              <div className="rounded border border-white/[0.06] p-4" style={{ background: "rgba(6,14,24,0.6)" }}>
                <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-3">Drawdown History</p>
                <div className="space-y-2">
                  {[
                    { date: "Mar 15", depth: -3.8, recovery: "2d", status: "recovered" },
                    { date: "Mar 08", depth: -1.2, recovery: "<1d", status: "recovered" },
                    { date: "Feb 28", depth: -5.6, recovery: "4d", status: "recovered" },
                    { date: "Feb 14", depth: -2.1, recovery: "1d", status: "recovered" },
                    { date: "Jan 30", depth: -7.2, recovery: "6d", status: "recovered" },
                    { date: "Jan 15", depth: -0.8, recovery: "<1d", status: "recovered" },
                  ].map((d, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/[0.04]">
                      <span className="text-[9px] text-white/35 w-12 shrink-0 tabular-nums">{d.date}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full bg-red-400/50 transition-all" style={{ width: `${Math.abs(d.depth) * 10}%` }} />
                      </div>
                      <span className="text-[10px] tabular-nums text-red-400 font-semibold w-10 text-right">{d.depth}%</span>
                      <span className="text-[9px] text-white/30 w-8 text-right">{d.recovery}</span>
                      <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/[0.06] px-1.5 py-0.5 text-[7px] font-bold text-emerald-400/70 uppercase">OK</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-2 border-t border-white/[0.04]">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/35">Max Drawdown</span>
                    <span className="text-[11px] tabular-nums font-bold text-red-400">-7.2%</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] text-white/35">Avg Recovery</span>
                    <span className="text-[11px] tabular-nums font-semibold text-white/60">2.3 days</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MID ROW: always visible ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

          {/* Today's Activity */}
          <div className="rounded border border-white/[0.06] p-3" style={{ background: "rgba(6,14,24,0.6)" }}>
            <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-2">Today&apos;s Activity</p>
            <div className="space-y-1.5">
              {[
                { label: "Orders Placed", value: "8", cls: "text-white/70" },
                { label: "Orders Filled", value: "5", cls: "text-emerald-400" },
                { label: "Total Bought", value: fmtMoney(enriched.filter(r => r.pnl >= 0).reduce((s, r) => s + r.mv, 0) * 0.15), cls: "text-emerald-400/80" },
                { label: "Total Sold", value: fmtMoney(enriched.reduce((s, r) => s + r.mv, 0) * 0.04), cls: "text-red-400/80" },
                { label: "Commissions", value: "$0.00", cls: "text-white/40" },
                { label: "Fees", value: "$2.14", cls: "text-white/40" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="flex items-center justify-between py-[2px] border-b border-white/[0.04]">
                  <span className="text-[10px] text-white/40">{label}</span>
                  <span className={cn("text-[11px] tabular-nums font-semibold", cls)}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Account Health */}
          <div className="rounded border border-white/[0.06] p-3" style={{ background: "rgba(6,14,24,0.6)" }}>
            <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-2">Account Health</p>
            <div className="space-y-1.5">
              {[
                { label: "Margin Used", value: "0%", cls: "text-emerald-400" },
                { label: "Margin Available", value: fmtMoney(buyingPow), cls: "text-white/70" },
                { label: "Cash Balance", value: fmtMoney(buyingPow + totalMv * 0.05), cls: "text-white/70" },
                { label: "Settled Cash", value: fmtMoney(buyingPow * 0.92), cls: "text-white/60" },
                { label: "Unsettled", value: fmtMoney(buyingPow * 0.08), cls: "text-amber-400/70" },
                { label: "PDT Status", value: "OK", cls: "text-emerald-400" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="flex items-center justify-between py-[2px] border-b border-white/[0.04]">
                  <span className="text-[10px] text-white/40">{label}</span>
                  <span className={cn("text-[11px] tabular-nums font-semibold", cls)}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Concentration Risk */}
          <div className="rounded border border-white/[0.06] p-3" style={{ background: "rgba(6,14,24,0.6)" }}>
            <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-2">Concentration</p>
            <div className="space-y-2">
              {enriched.slice(0, 5).map(r => {
                const pct = totalMv > 0 ? (r.mv / totalMv) * 100 : 0;
                return (
                  <div key={r.symbol}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", r.asset === "crypto" ? "bg-orange-400/70" : "bg-emerald-400/70")} />
                        <span className="text-[10px] font-semibold text-white/75">{r.symbol}</span>
                      </div>
                      <span className={cn("text-[10px] tabular-nums font-bold", pct > 20 ? "text-amber-400" : "text-white/55")}>{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className={cn("h-full rounded-full", pct > 20 ? "bg-amber-400/50" : "bg-cyan-400/35")} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {(() => {
                const top3 = enriched.slice(0, 3).reduce((s, r) => s + (totalMv > 0 ? (r.mv / totalMv) * 100 : 0), 0);
                return top3 > 50 ? (
                  <p className="text-[9px] text-amber-400/60 pt-1 border-t border-white/[0.04]">Top 3 = {top3.toFixed(1)}% — high concentration</p>
                ) : null;
              })()}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="rounded border border-white/[0.06] p-3" style={{ background: "rgba(6,14,24,0.6)" }}>
            <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-2">Performance</p>
            <div className="space-y-1.5">
              {[
                { label: "Total Return", value: fmtPct(totalPct, true), cls: totalPct >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: "Day Return", value: fmtPct((dayPnl / totalMv) * 100, true), cls: dayPnl >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: "Best Performer", value: (() => { const b = [...enriched].sort((a, c) => c.pnlPct - a.pnlPct)[0]; return b ? `${b.symbol} ${fmtPct(b.pnlPct, true)}` : "—"; })(), cls: "text-emerald-400" },
                { label: "Worst Performer", value: (() => { const w = [...enriched].sort((a, c) => a.pnlPct - c.pnlPct)[0]; return w ? `${w.symbol} ${fmtPct(w.pnlPct, true)}` : "—"; })(), cls: enriched.length > 0 && [...enriched].sort((a, c) => a.pnlPct - c.pnlPct)[0].pnl < 0 ? "text-red-400" : "text-emerald-400/70" },
                { label: "Sharpe (sim)", value: "1.42", cls: "text-white/60" },
                { label: "Max Drawdown", value: "-3.8%", cls: "text-red-400/60" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="flex items-center justify-between py-[2px] border-b border-white/[0.04]">
                  <span className="text-[10px] text-white/40">{label}</span>
                  <span className={cn("text-[11px] tabular-nums font-semibold", cls)}>{value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── BOTTOM ROW: always visible ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">

          {/* P&L Contribution */}
          <div className="rounded border border-white/[0.06] p-4" style={{ background: "rgba(6,14,24,0.6)" }}>
            <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-3">P&L Contribution</p>
            <div className="space-y-2">
              {[...enriched]
                .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
                .map(r => {
                  const maxPnl = Math.max(...enriched.map(e => Math.abs(e.pnl)), 1);
                  const barW = (Math.abs(r.pnl) / maxPnl) * 100;
                  return (
                    <div key={r.symbol}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-white/80">{r.symbol}</span>
                          <span className="text-[9px] text-white/30">{COMPANY_NAMES[r.symbol] ?? ""}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] tabular-nums text-white/40">{fmtMoney(r.mv)}</span>
                          <span className={cn("text-[10px] tabular-nums font-semibold", r.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                            {fmtMoney(r.pnl, true)}
                          </span>
                          <span className={cn("text-[9px] tabular-nums w-14 text-right", r.pnlPct >= 0 ? "text-emerald-400/70" : "text-red-400/70")}>
                            {fmtPct(r.pnlPct, true)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", r.pnl >= 0 ? "bg-emerald-400/60" : "bg-red-400/60")}
                          style={{ width: `${barW}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Market Pulse + Broker */}
          <div className="space-y-4">
            {/* Market Pulse */}
            <div className="rounded border border-white/[0.06] p-4" style={{ background: "rgba(6,14,24,0.6)" }}>
              <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-3">Market Pulse</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { sym: "SPY",  name: "S&P 500",    px: 535.80,  chg: +0.42 },
                  { sym: "QQQ",  name: "Nasdaq 100", px: 449.20,  chg: +0.61 },
                  { sym: "IWM",  name: "Russell 2K", px: 208.40,  chg: -0.18 },
                  { sym: "DIA",  name: "Dow Jones",  px: 398.70,  chg: +0.29 },
                  { sym: "VIX",  name: "Volatility", px: 14.82,   chg: -3.20 },
                  { sym: "BTC",  name: "Bitcoin",    px: 67420,   chg: +1.84 },
                ].map(m => (
                  <div key={m.sym} className="rounded border border-white/[0.06] px-3 py-2"
                    style={{ background: "rgba(6,14,24,0.5)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-white/80">{m.sym}</span>
                      <span className={cn("text-[10px] tabular-nums font-bold", m.chg >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {m.chg >= 0 ? "+" : ""}{m.chg.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[8px] text-white/30">{m.name}</span>
                      <span className="text-[10px] tabular-nums text-white/55">
                        {m.px >= 1000 ? m.px.toLocaleString(undefined, { maximumFractionDigits: 0 }) : m.px.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Portfolio vs Market */}
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-2">Portfolio vs SPY</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Portfolio",  val: totalPct, cls: "bg-emerald-400/60" },
                    { label: "SPY",        val: 0.42,     cls: "bg-cyan-400/40"    },
                  ].map(r => (
                    <div key={r.label}>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[9px] text-white/40">{r.label}</span>
                        <span className={cn("text-[10px] tabular-nums font-semibold", r.val >= 0 ? "text-emerald-400" : "text-red-400")}>{fmtPct(r.val, true)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className={cn("h-full rounded-full", r.cls)} style={{ width: `${Math.min(Math.abs(r.val) * 5, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Broker Allocation */}
            <div className="rounded border border-white/[0.06] p-4" style={{ background: "rgba(6,14,24,0.6)" }}>
              <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-3">Broker Allocation</p>
              {(() => {
                const brokerMap = new Map<string, number>();
                enriched.forEach(r => brokerMap.set(r.broker, (brokerMap.get(r.broker) ?? 0) + r.mv));
                const brokers = Array.from(brokerMap.entries()).sort((a, b) => b[1] - a[1]);
                const brokerColors: Record<string, string> = {
                  RH: "bg-amber-400", ETRADE: "bg-purple-400", FIDELITY: "bg-emerald-400",
                  IBKR: "bg-sky-400", WEBULL: "bg-cyan-400", COINBASE: "bg-orange-400",
                };
                return (
                  <>
                    <div className="flex h-3 rounded-full overflow-hidden mb-3 gap-px">
                      {brokers.map(([name, mv]) => (
                        <div key={name} className={cn("h-full transition-all", brokerColors[name] ?? "bg-white/30")}
                          style={{ width: `${(mv / totalMv) * 100}%` }} title={name} />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {brokers.map(([name, mv]) => (
                        <div key={name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-sm shrink-0", brokerColors[name] ?? "bg-white/30")} />
                            <span className="text-[10px] text-white/65">{name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] tabular-nums text-white/50">{fmtMoney(mv)}</span>
                            <span className="text-[10px] tabular-nums text-white/35 w-10 text-right">{((mv / totalMv) * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

        </div>

        {/* ── PORTFOLIO ANALYTICS ROW ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Win/Loss Stats */}
          <div className="rounded border border-white/[0.06] p-4" style={{ background: "rgba(6,14,24,0.6)" }}>
            <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-3">Win / Loss Stats</p>
            {(() => {
              const winners = enriched.filter(r => r.pnl >= 0);
              const losers  = enriched.filter(r => r.pnl < 0);
              const winRate = enriched.length > 0 ? (winners.length / enriched.length) * 100 : 0;
              const avgWin  = winners.length > 0 ? winners.reduce((s, r) => s + r.pnlPct, 0) / winners.length : 0;
              const avgLoss = losers.length > 0  ? losers.reduce((s, r) => s + r.pnlPct, 0) / losers.length : 0;
              const bestPos  = [...enriched].sort((a, b) => b.pnlPct - a.pnlPct)[0];
              const worstPos = [...enriched].sort((a, b) => a.pnlPct - b.pnlPct)[0];
              return (
                <div className="space-y-2">
                  {[
                    { label: "Win Rate",       value: `${winRate.toFixed(0)}%`,              cls: "text-emerald-400"  },
                    { label: "Winners",        value: `${winners.length}`,                  cls: "text-emerald-400"  },
                    { label: "Losers",         value: `${losers.length}`,                   cls: losers.length > 0 ? "text-red-400" : "text-white/60" },
                    { label: "Avg Win",        value: fmtPct(avgWin, true),                 cls: "text-emerald-400/80" },
                    { label: "Avg Loss",       value: avgLoss !== 0 ? fmtPct(avgLoss, true) : "—", cls: losers.length > 0 ? "text-red-400/80" : "text-white/40" },
                    { label: "Best Position",  value: bestPos ? `${bestPos.symbol} ${fmtPct(bestPos.pnlPct, true)}` : "—", cls: "text-emerald-400" },
                    { label: "Worst Position", value: worstPos ? `${worstPos.symbol} ${fmtPct(worstPos.pnlPct, true)}` : "—", cls: worstPos && worstPos.pnl < 0 ? "text-red-400" : "text-emerald-400/70" },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className="flex items-center justify-between py-[3px] border-b border-white/[0.04]">
                      <span className="text-[10px] text-white/40">{label}</span>
                      <span className={cn("text-[11px] tabular-nums font-semibold", cls)}>{value}</span>
                    </div>
                  ))}
                  {/* Win rate bar */}
                  <div className="pt-1">
                    <div className="flex h-2.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-400/50 h-full transition-all" style={{ width: `${winRate}%` }} />
                      <div className="bg-red-400/50 h-full transition-all" style={{ width: `${100 - winRate}%` }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[8px] text-emerald-400/60">{winners.length}W</span>
                      <span className="text-[8px] text-red-400/60">{losers.length}L</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Position Sizing */}
          <div className="rounded border border-white/[0.06] p-4" style={{ background: "rgba(6,14,24,0.6)" }}>
            <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-3">Position Sizing</p>
            <div className="space-y-2.5">
              {[...enriched]
                .sort((a, b) => b.mv - a.mv)
                .map(r => {
                  const pct = totalMv > 0 ? (r.mv / totalMv) * 100 : 0;
                  const oversize = pct > 20;
                  return (
                    <div key={r.symbol}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", r.asset === "crypto" ? "bg-orange-400/70" : "bg-emerald-400/70")} />
                          <span className="text-[10px] font-semibold text-white/75">{r.symbol}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] tabular-nums text-white/40">{fmtMoney(r.mv)}</span>
                          <span className={cn("text-[10px] tabular-nums font-bold w-12 text-right", oversize ? "text-amber-400" : "text-white/60")}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", oversize ? "bg-amber-400/60" : r.asset === "crypto" ? "bg-orange-400/50" : "bg-cyan-400/40")}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
            {/* Concentration warning */}
            {(() => {
              const top3Pct = [...enriched].sort((a, b) => b.mv - a.mv).slice(0, 3).reduce((s, r) => s + (totalMv > 0 ? (r.mv / totalMv) * 100 : 0), 0);
              return top3Pct > 50 ? (
                <div className="mt-3 pt-2 border-t border-amber-400/10">
                  <p className="text-[9px] text-amber-400/70">Top 3 positions = {top3Pct.toFixed(1)}% of portfolio — consider rebalancing</p>
                </div>
              ) : null;
            })()}
          </div>

          {/* Quick Actions */}
          <div className="rounded border border-white/[0.06] p-4" style={{ background: "rgba(6,14,24,0.6)" }}>
            <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-3">Quick Actions</p>
            <div className="space-y-2">
              {[
                { label: "Flatten All",    desc: "Close all open positions",             icon: "⊘", cls: "border-red-400/25 text-red-400 hover:bg-red-400/10" },
                { label: "Hedge Portfolio", desc: "Buy protective puts on SPY",           icon: "⛊", cls: "border-amber-400/25 text-amber-400 hover:bg-amber-400/10" },
                { label: "Rebalance",       desc: "Auto-size to equal weight",            icon: "⟳", cls: "border-cyan-400/25 text-cyan-400 hover:bg-cyan-400/10" },
                { label: "Export CSV",      desc: "Download positions & P&L report",      icon: "↓", cls: "border-white/15 text-white/60 hover:bg-white/[0.05]" },
                { label: "Scanner Briefing",desc: "Run all 7 signals on portfolio",       icon: "⚡", cls: "border-emerald-400/25 text-emerald-400 hover:bg-emerald-400/10" },
              ].map(a => (
                <button key={a.label}
                  className={cn("w-full rounded border px-3 py-2.5 text-left transition-colors flex items-center gap-3", a.cls)}>
                  <span className="text-[16px] shrink-0 w-6 text-center">{a.icon}</span>
                  <div>
                    <div className="text-[11px] font-semibold">{a.label}</div>
                    <div className="text-[9px] text-white/30">{a.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
