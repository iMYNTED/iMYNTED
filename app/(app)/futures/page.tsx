"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ── Types ─────────────────────────────────────────────────────── */

type Sector = "Index" | "Energy" | "Metals" | "Rates" | "Agriculture" | "FX";

interface ContractMeta {
  root: string;
  name: string;
  sector: Sector;
  tick: number;
  mult: number;
  base: number;
  exchange: string;
}

interface ContractRow {
  symbol: string;
  root: string;
  name: string;
  expiry: string;
  price: number;
  prev: number;
  chg: number;
  pct: number;
  bid: number;
  ask: number;
  bidSz: number;
  askSz: number;
  volume: number;
  oi: number;
  tick: number;
  mult: number;
  exchange: string;
}

type LivePrice = { price: number; bid: number; ask: number; chg: number; pct: number; dir: 1 | -1 };

/* ── Master contract catalog ───────────────────────────────────── */

const CONTRACTS: ContractMeta[] = [
  { root: "ES",  name: "E-mini S&P 500",          sector: "Index",       tick: 0.25,      mult: 50,       base: 5620,    exchange: "CME"   },
  { root: "NQ",  name: "E-mini NASDAQ 100",        sector: "Index",       tick: 0.25,      mult: 20,       base: 19780,   exchange: "CME"   },
  { root: "YM",  name: "E-mini Dow Jones",          sector: "Index",       tick: 1,         mult: 5,        base: 41200,   exchange: "CBOT"  },
  { root: "RTY", name: "E-mini Russell 2000",       sector: "Index",       tick: 0.1,       mult: 50,       base: 2040,    exchange: "CME"   },
  { root: "MES", name: "Micro E-mini S&P 500",      sector: "Index",       tick: 0.25,      mult: 5,        base: 5620,    exchange: "CME"   },
  { root: "MNQ", name: "Micro E-mini NASDAQ 100",   sector: "Index",       tick: 0.25,      mult: 2,        base: 19780,   exchange: "CME"   },
  { root: "VX",  name: "CBOE VIX Futures",          sector: "Index",       tick: 0.05,      mult: 1000,     base: 18.5,    exchange: "CFE"   },
  { root: "CL",  name: "Crude Oil",                 sector: "Energy",      tick: 0.01,      mult: 1000,     base: 69.8,    exchange: "NYMEX" },
  { root: "NG",  name: "Natural Gas",               sector: "Energy",      tick: 0.001,     mult: 10000,    base: 4.12,    exchange: "NYMEX" },
  { root: "HO",  name: "Heating Oil",               sector: "Energy",      tick: 0.0001,    mult: 42000,    base: 2.38,    exchange: "NYMEX" },
  { root: "RB",  name: "RBOB Gasoline",             sector: "Energy",      tick: 0.0001,    mult: 42000,    base: 2.19,    exchange: "NYMEX" },
  { root: "GC",  name: "Gold",                      sector: "Metals",      tick: 0.10,      mult: 100,      base: 3020,    exchange: "COMEX" },
  { root: "SI",  name: "Silver",                    sector: "Metals",      tick: 0.005,     mult: 5000,     base: 33.8,    exchange: "COMEX" },
  { root: "HG",  name: "Copper",                    sector: "Metals",      tick: 0.0005,    mult: 25000,    base: 4.72,    exchange: "COMEX" },
  { root: "PL",  name: "Platinum",                  sector: "Metals",      tick: 0.10,      mult: 50,       base: 1024,    exchange: "NYMEX" },
  { root: "ZB",  name: "30-Year T-Bond",            sector: "Rates",       tick: 0.03125,   mult: 1000,     base: 117.5,   exchange: "CBOT"  },
  { root: "ZN",  name: "10-Year T-Note",            sector: "Rates",       tick: 0.015625,  mult: 1000,     base: 109.2,   exchange: "CBOT"  },
  { root: "ZF",  name: "5-Year T-Note",             sector: "Rates",       tick: 0.0078125, mult: 1000,     base: 106.8,   exchange: "CBOT"  },
  { root: "ZC",  name: "Corn",                      sector: "Agriculture", tick: 0.25,      mult: 50,       base: 455,     exchange: "CBOT"  },
  { root: "ZS",  name: "Soybeans",                  sector: "Agriculture", tick: 0.25,      mult: 50,       base: 1048,    exchange: "CBOT"  },
  { root: "ZW",  name: "Wheat",                     sector: "Agriculture", tick: 0.25,      mult: 50,       base: 560,     exchange: "CBOT"  },
  { root: "ZL",  name: "Soybean Oil",               sector: "Agriculture", tick: 0.01,      mult: 600,      base: 44.1,    exchange: "CBOT"  },
  { root: "6E",  name: "Euro FX",                   sector: "FX",          tick: 0.00005,   mult: 125000,   base: 1.0815,  exchange: "CME"   },
  { root: "6J",  name: "Japanese Yen",              sector: "FX",          tick: 0.0000005, mult: 12500000, base: 0.00668, exchange: "CME"   },
  { root: "6B",  name: "British Pound",             sector: "FX",          tick: 0.0001,    mult: 62500,    base: 1.2945,  exchange: "CME"   },
  { root: "6A",  name: "Australian Dollar",         sector: "FX",          tick: 0.0001,    mult: 100000,   base: 0.6285,  exchange: "CME"   },
];

const SECTORS: { id: Sector | "All"; label: string; short: string }[] = [
  { id: "All",         label: "All Markets",  short: "ALL"  },
  { id: "Index",       label: "Index",        short: "IDX"  },
  { id: "Energy",      label: "Energy",       short: "NRG"  },
  { id: "Metals",      label: "Metals",       short: "MET"  },
  { id: "Rates",       label: "Rates",        short: "RTES" },
  { id: "Agriculture", label: "Agriculture",  short: "AG"   },
  { id: "FX",          label: "FX",           short: "FX"   },
];

/* ── Month codes ───────────────────────────────────────────────── */

const MONTH_CODES: Record<string, string> = {
  F: "JAN", G: "FEB", H: "MAR", J: "APR", K: "MAY", M: "JUN",
  N: "JUL", Q: "AUG", U: "SEP", V: "OCT", X: "NOV", Z: "DEC",
};

const FRONT_MONTHS: Record<string, string[]> = {
  ES:  ["H","M","U","Z"], NQ:  ["H","M","U","Z"], YM:  ["H","M","U","Z"],
  RTY: ["H","M","U","Z"], MES: ["H","M","U","Z"], MNQ: ["H","M","U","Z"],
  VX:  ["H","K","N","U"],
  CL:  ["H","J","K","M"], NG:  ["H","J","K","M"],
  HO:  ["H","J","K","M"], RB:  ["H","J","K","M"],
  GC:  ["H","J","M","Q"], SI:  ["H","K","N","U"],
  HG:  ["H","K","N","U"], PL:  ["H","J","N","V"],
  ZB:  ["H","M","U","Z"], ZN:  ["H","M","U","Z"], ZF:  ["H","M","U","Z"],
  ZC:  ["H","K","N","U"], ZS:  ["H","K","N","U"], ZW:  ["H","K","N","U"], ZL: ["H","K","N","U"],
  "6E": ["H","M","U","Z"], "6J": ["H","M","U","Z"], "6B": ["H","M","U","Z"], "6A": ["H","M","U","Z"],
};

function buildContracts(meta: ContractMeta): ContractRow[] {
  const codes = FRONT_MONTHS[meta.root] ?? ["H", "M", "U", "Z"];
  const yr = new Date().getFullYear() % 100;
  return codes.map((code, i) => {
    const nextYr = i >= 2 ? 1 : 0;
    const expiry = `${MONTH_CODES[code]}${String(yr + nextYr).padStart(2, "0")}`;
    const symbol = `${meta.root}${code}${String(yr + nextYr).padStart(2, "0")}`;
    const drift  = (((i * 17 + meta.root.charCodeAt(0)) % 100) - 50) * meta.tick;
    const price  = Math.round((meta.base + drift) / meta.tick) * meta.tick;
    const prev   = Math.round((price - meta.tick * ((i * 7) % 20)) / meta.tick) * meta.tick;
    const chg    = Math.round((price - prev) / meta.tick) * meta.tick;
    const pct    = Number(((chg / prev) * 100).toFixed(2));
    const spread = meta.tick * 2;
    return {
      symbol, root: meta.root, name: `${meta.name} (${expiry})`, expiry,
      price, prev, chg, pct,
      bid: Math.round((price - spread) / meta.tick) * meta.tick,
      ask: Math.round((price + spread) / meta.tick) * meta.tick,
      bidSz: 50 + ((i * 113 + meta.root.charCodeAt(0)) % 450),
      askSz: 50 + ((i * 97 + meta.root.charCodeAt(1 % meta.root.length)) % 450),
      volume: Math.round(50000 + ((i * 9337 + meta.root.charCodeAt(0) * 47) % 180000)),
      oi:     Math.round(100000 + ((i * 17231 + meta.root.charCodeAt(0) * 113) % 400000)),
      tick: meta.tick, mult: meta.mult, exchange: meta.exchange,
    };
  });
}

/* ── Price formatting ──────────────────────────────────────────── */

function fmtPx(px: number, tick: number): string {
  if (!Number.isFinite(px)) return "—";
  const dec = tick <= 0 ? 4 : Math.max(0, Math.ceil(-Math.log10(tick)));
  return px.toFixed(Math.min(dec + 1, 8));
}

function fmtVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

/* ── Sidebar summary roots ─────────────────────────────────────── */

const SIDEBAR_ROOTS: { root: string; label: string; sector: Sector }[] = [
  { root: "ES",  label: "S&P 500",      sector: "Index"       },
  { root: "NQ",  label: "NASDAQ 100",   sector: "Index"       },
  { root: "YM",  label: "Dow Jones",    sector: "Index"       },
  { root: "RTY", label: "Russell 2000", sector: "Index"       },
  { root: "VX",  label: "VIX",          sector: "Index"       },
  { root: "CL",  label: "Crude Oil",    sector: "Energy"      },
  { root: "NG",  label: "Natural Gas",  sector: "Energy"      },
  { root: "GC",  label: "Gold",         sector: "Metals"      },
  { root: "SI",  label: "Silver",       sector: "Metals"      },
  { root: "HG",  label: "Copper",       sector: "Metals"      },
  { root: "ZB",  label: "30Y T-Bond",   sector: "Rates"       },
  { root: "ZN",  label: "10Y T-Note",   sector: "Rates"       },
  { root: "ZF",  label: "5Y T-Note",    sector: "Rates"       },
  { root: "ZC",  label: "Corn",         sector: "Agriculture" },
  { root: "ZS",  label: "Soybeans",     sector: "Agriculture" },
  { root: "ZW",  label: "Wheat",        sector: "Agriculture" },
  { root: "6E",  label: "EUR/USD",      sector: "FX"          },
  { root: "6B",  label: "GBP/USD",      sector: "FX"          },
  { root: "6J",  label: "JPY/USD",      sector: "FX"          },
];

/* ── Sparkline ─────────────────────────────────────────────────── */

function Spark({ positive, seed }: { positive: boolean; seed: number }) {
  const pts = useMemo(() => {
    const arr: number[] = [];
    let v = 50;
    for (let i = 0; i < 20; i++) {
      v = Math.max(10, Math.min(90, v + (((seed * (i + 1) * 7) % 21) - 10) * 0.8));
      arr.push(v);
    }
    arr[arr.length - 1] = positive ? Math.max(arr[arr.length - 1], 55) : Math.min(arr[arr.length - 1], 45);
    return arr;
  }, [positive, seed]);

  const d =
    "M " +
    pts
      .map((y, i) => `${(i / (pts.length - 1)) * 60},${50 - (y - 50) * 0.45}`)
      .join(" L ");

  return (
    <svg
      width="60"
      height="22"
      viewBox="0 0 60 50"
      preserveAspectRatio="none"
      className="shrink-0 opacity-80"
    >
      <path
        d={d}
        fill="none"
        stroke={positive ? "rgba(52,211,153,0.75)" : "rgba(239,68,68,0.75)"}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Detail Panel ──────────────────────────────────────────────── */

interface DetailTick {
  ts: string;
  price: number;
  dir: 1 | -1;
}

function DetailPanel({ row, live }: { row: ContractRow; live: LivePrice | null }) {
  const router = useRouter();
  const [ticks, setTicks] = useState<DetailTick[]>([]);
  const tickRef = useRef(0);

  const price    = live?.price ?? row.price;
  const chg      = live?.chg   ?? row.chg;
  const pct      = live?.pct   ?? row.pct;
  const bid      = live?.bid   ?? row.bid;
  const ask      = live?.ask   ?? row.ask;
  const positive = chg >= 0;
  const notional = price * row.mult;

  // Seed tick tape when symbol changes
  useEffect(() => {
    tickRef.current = 0;
    const now = Date.now();
    const s = row.symbol.charCodeAt(0) + row.price;
    const pad = (n: number) => String(n).padStart(2, "0");
    setTicks(
      Array.from({ length: 14 }, (_, i) => {
        const delta = ((s + i * 7) % 7) - 3;
        const p = Math.round((row.price + delta * row.tick) / row.tick) * row.tick;
        const t = new Date(now - (14 - i) * 2800);
        return {
          ts: `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`,
          price: p,
          dir: (delta >= 0 ? 1 : -1) as 1 | -1,
        };
      }).reverse()
    );
  }, [row.symbol]);

  // Live tick updates
  useEffect(() => {
    const s = row.symbol.charCodeAt(0) + row.price;
    const pad = (n: number) => String(n).padStart(2, "0");
    const iv = setInterval(() => {
      const id = ++tickRef.current;
      const delta = ((id * 7 + s) % 7) - 3;
      const p = Math.round((price + delta * row.tick) / row.tick) * row.tick;
      const t = new Date();
      const ts = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
      setTicks(prev => [{ ts, price: p, dir: (delta >= 0 ? 1 : -1) as 1 | -1 }, ...prev.slice(0, 29)]);
    }, 1800);
    return () => clearInterval(iv);
  }, [row.symbol, price]);

  function openInTerminal() {
    try {
      localStorage.setItem(
        "imynted:futures:open",
        JSON.stringify({ symbol: row.symbol, root: row.root, asset: "futures" })
      );
    } catch {}
    router.push("/dashboard");
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "rgba(3,7,14,0.7)" }}>

      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[8px] font-black tracking-widest text-emerald-400/70 uppercase px-1.5 py-0.5 rounded border border-emerald-400/20 bg-emerald-400/[0.07] shrink-0">
            {row.exchange}
          </span>
          <span className="text-[9px] text-white/35 font-mono">{row.symbol}</span>
          <span className="text-[9px] text-white/20">·</span>
          <span className="text-[9px] text-white/30">{row.expiry}</span>
        </div>
        <p className="text-[10px] text-white/40 leading-tight mb-2 truncate">{row.name}</p>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className={cn("text-[24px] font-black tabular-nums leading-none", positive ? "text-emerald-300" : "text-red-400")}>
              {fmtPx(price, row.tick)}
            </p>
            <p className={cn("text-[11px] font-semibold tabular-nums mt-0.5", positive ? "text-emerald-400" : "text-red-400")}>
              {positive ? "+" : ""}{fmtPx(chg, row.tick)}&nbsp;&nbsp;{positive ? "+" : ""}{pct.toFixed(2)}%
            </p>
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            <button
              onClick={openInTerminal}
              className="flex items-center gap-1.5 rounded border border-emerald-400/25 bg-emerald-400/[0.08] px-2.5 py-1 text-[9px] font-bold text-emerald-300 hover:bg-emerald-400/[0.15] transition-colors"
            >
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 9 L5 5 L9 1M6 1h3v3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Trade
            </button>
            <button
              onClick={() => { try { navigator.clipboard.writeText(row.symbol); } catch {} }}
              className="rounded border border-white/[0.07] px-2.5 py-1 text-[9px] text-white/25 hover:text-white/55 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      {/* Bid / Ask */}
      <div className="shrink-0 grid grid-cols-2 border-b border-white/[0.06]">
        <div className="px-3 py-2 border-r border-white/[0.04]">
          <p className="text-[8px] text-white/20 uppercase tracking-widest mb-0.5">Bid</p>
          <p className="text-[13px] font-bold text-emerald-300/80 tabular-nums">{fmtPx(bid, row.tick)}</p>
          <p className="text-[8px] text-white/20">{row.bidSz} lots</p>
        </div>
        <div className="px-3 py-2">
          <p className="text-[8px] text-white/20 uppercase tracking-widest mb-0.5">Ask</p>
          <p className="text-[13px] font-bold text-red-300/80 tabular-nums">{fmtPx(ask, row.tick)}</p>
          <p className="text-[8px] text-white/20">{row.askSz} lots</p>
        </div>
      </div>

      {/* Stats 2-col grid */}
      <div className="shrink-0 grid grid-cols-2 border-b border-white/[0.06]">
        {[
          { l: "Spread",     v: fmtPx(ask - bid, row.tick),   s: `${Math.round((ask - bid) / row.tick)} tks` },
          { l: "Prev Close", v: fmtPx(row.prev, row.tick),    s: "settlement"    },
          { l: "Volume",     v: fmtVol(row.volume),            s: "today"         },
          { l: "Open Int",   v: fmtVol(row.oi),               s: "contracts"     },
          { l: "Tick",       v: String(row.tick),              s: "min move"      },
          { l: "Multiplier", v: `$${row.mult.toLocaleString()}`, s: "per point"   },
          {
            l: "Notional",
            v: notional >= 1e6 ? `$${(notional / 1e6).toFixed(2)}M` : `$${notional.toLocaleString()}`,
            s: "per contract",
          },
          { l: "Exchange",   v: row.exchange,                  s: ""              },
        ].map(s => (
          <div key={s.l} className="px-3 py-2 border-r border-b border-white/[0.03] even:border-r-0">
            <p className="text-[8px] text-white/20 uppercase tracking-widest mb-0.5">{s.l}</p>
            <p className="text-[11px] font-bold text-white/75 tabular-nums">{s.v}</p>
            {s.s && <p className="text-[8px] text-white/18">{s.s}</p>}
          </div>
        ))}
      </div>

      {/* Tick tape */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="shrink-0 grid grid-cols-3 px-3 py-1.5 border-b border-white/[0.04]">
          <span className="text-[8px] text-white/18 uppercase tracking-widest">Time</span>
          <span className="text-[8px] text-white/18 uppercase tracking-widest text-right">Price</span>
          <span className="text-[8px] text-white/18 uppercase tracking-widest text-right">Dir</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {ticks.map((t, i) => (
            <div
              key={i}
              className={cn(
                "grid grid-cols-3 px-3 py-[3px] border-b border-white/[0.02]",
                i === 0 && "bg-white/[0.02]"
              )}
            >
              <span className="text-[10px] text-white/22 tabular-nums font-mono">{t.ts}</span>
              <span className={cn("text-[10px] font-bold tabular-nums text-right", t.dir === 1 ? "text-emerald-300" : "text-red-400")}>
                {fmtPx(t.price, row.tick)}
              </span>
              <span className={cn("text-[9px] text-right", t.dir === 1 ? "text-emerald-400" : "text-red-400")}>
                {t.dir === 1 ? "▲" : "▼"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */

type SortCol = "symbol" | "price" | "chg" | "pct" | "volume" | "oi";

export default function FuturesPage() {
  const [sector, setSector] = useState<Sector | "All">("All");
  const [selected, setSelected] = useState<ContractRow | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>("symbol");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [livePrices, setLivePrices] = useState<Map<string, LivePrice>>(new Map());

  const allRows = useMemo(() => CONTRACTS.flatMap(buildContracts), []);

  // Seed live prices from static rows
  useEffect(() => {
    const m = new Map<string, LivePrice>();
    for (const r of allRows) {
      m.set(r.symbol, {
        price: r.price, bid: r.bid, ask: r.ask,
        chg: r.chg, pct: r.pct, dir: r.chg >= 0 ? 1 : -1,
      });
    }
    setLivePrices(m);
  }, [allRows]);

  // Tick random subset every 2s
  useEffect(() => {
    if (allRows.length === 0) return;
    const iv = setInterval(() => {
      setLivePrices(prev => {
        const next = new Map(prev);
        const keys = [...next.keys()];
        for (let n = 0; n < 6; n++) {
          const sym = keys[Math.floor(Math.random() * keys.length)];
          const cur = next.get(sym);
          if (!cur) continue;
          const row = allRows.find(r => r.symbol === sym);
          if (!row) continue;
          const dir: 1 | -1 = Math.random() < 0.52 ? 1 : -1;
          const tks = 1 + Math.floor(Math.random() * 3);
          const np  = Math.round((cur.price + dir * row.tick * tks) / row.tick) * row.tick;
          const nc  = Math.round((np - row.prev) / row.tick) * row.tick;
          const npt = Number(((nc / row.prev) * 100).toFixed(2));
          next.set(sym, { price: np, bid: np - row.tick * 2, ask: np + row.tick * 2, chg: nc, pct: npt, dir });
        }
        return next;
      });
    }, 2000);
    return () => clearInterval(iv);
  }, [allRows]);

  const sidebarRows = useMemo(() => {
    return SIDEBAR_ROOTS.map(s => {
      const meta = CONTRACTS.find(c => c.root === s.root)!;
      const row  = buildContracts(meta)[0];
      const live = livePrices.get(row.symbol);
      return { ...s, row, live };
    });
  }, [livePrices]);

  const tableRows = useMemo(() => {
    const base =
      sector === "All"
        ? allRows
        : allRows.filter(r => CONTRACTS.find(c => c.root === r.root)?.sector === sector);

    const merged = base.map(r => {
      const live = livePrices.get(r.symbol);
      return live
        ? { ...r, price: live.price, bid: live.bid, ask: live.ask, chg: live.chg, pct: live.pct }
        : r;
    });

    return [...merged].sort((a, b) => {
      if (sortCol === "symbol") return sortDir * a.symbol.localeCompare(b.symbol);
      return sortDir * ((a[sortCol] as number) - (b[sortCol] as number));
    });
  }, [allRows, sector, sortCol, sortDir, livePrices]);

  // Auto-select first row once
  useEffect(() => {
    if (!selected && tableRows.length > 0) setSelected(tableRows[0]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSort = useCallback((col: SortCol) => {
    setSortCol(prev => {
      if (prev === col) { setSortDir(d => (d === 1 ? -1 : 1)); return col; }
      setSortDir(1);
      return col;
    });
  }, []);

  function selectRoot(root: string) {
    const row = allRows.find(r => r.root === root);
    if (row) setSelected(row);
    setSector("All");
  }

  const selectedLive = selected ? (livePrices.get(selected.symbol) ?? null) : null;

  const TH = ({ col, label, right }: { col: SortCol; label: string; right?: boolean }) => (
    <th
      onClick={() => toggleSort(col)}
      className={cn(
        "px-3 py-2 text-[8px] font-black uppercase tracking-widest cursor-pointer select-none hover:text-white/60 transition-colors whitespace-nowrap",
        sortCol === col ? "text-emerald-400/80" : "text-white/25",
        right && "text-right"
      )}
    >
      {label}{sortCol === col ? (sortDir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div
      className="h-full flex flex-col md:flex-row overflow-hidden"
      style={{ background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)" }}
    >

      {/* ── Left sidebar ─────────────────────────────── */}
      <div className="w-full md:w-[196px] shrink-0 md:h-full flex flex-row md:flex-col border-b md:border-b-0 md:border-r border-white/[0.06] overflow-x-auto md:overflow-x-visible md:overflow-y-auto max-h-[100px] md:max-h-full">

        <div className="shrink-0 px-3 pt-3.5 pb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black tracking-[0.14em] text-emerald-400/80 uppercase">iMYNTED</span>
            <span className="text-white/[0.15] text-[9px]">|</span>
            <span className="text-[12px] font-bold text-white/80 tracking-wide">Futures</span>
          </div>
          <p className="text-[8px] text-white/20 mt-0.5">{allRows.length} contracts · sim</p>
        </div>

        <div className="shrink-0 px-2 py-2 flex flex-wrap gap-1 border-b border-white/[0.06]">
          {SECTORS.map(s => (
            <button
              key={s.id}
              onClick={() => setSector(s.id)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[8px] font-bold transition-colors border",
                sector === s.id
                  ? "bg-emerald-400/[0.10] text-emerald-300 border-emerald-400/25"
                  : "bg-transparent text-white/22 hover:text-white/50 border-transparent"
              )}
            >
              {s.short}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {sidebarRows
            .filter(s => sector === "All" || s.sector === sector)
            .map(s => {
              const livePx  = s.live?.price ?? s.row.price;
              const liveChg = s.live?.chg   ?? s.row.chg;
              const livePct = s.live?.pct   ?? s.row.pct;
              const pos     = liveChg >= 0;
              const isActive = selected?.root === s.root;
              return (
                <button
                  key={s.root}
                  onClick={() => selectRoot(s.root)}
                  className={cn(
                    "w-full px-3 py-2.5 flex items-center gap-2 border-b border-white/[0.03] transition-colors text-left",
                    isActive
                      ? "bg-emerald-400/[0.07] border-l-[2px] border-l-emerald-400/40"
                      : "hover:bg-white/[0.025] border-l-[2px] border-l-transparent"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className={cn("text-[11px] font-black tabular-nums", pos ? "text-emerald-300" : "text-red-400")}>
                        {fmtPx(livePx, s.row.tick)}
                      </span>
                      <span className={cn("text-[9px] font-semibold tabular-nums", pos ? "text-emerald-400/80" : "text-red-400/80")}>
                        {pos ? "+" : ""}{livePct.toFixed(2)}%
                      </span>
                    </div>
                    <p className="text-[8px] text-white/30 truncate">{s.label}</p>
                  </div>
                  <Spark positive={pos} seed={s.root.charCodeAt(0) * 13} />
                </button>
              );
            })}
        </div>

        <div className="shrink-0 px-3 py-1.5 border-t border-white/[0.04]">
          <p className="text-[8px] text-white/14">Sim · No live feed connected</p>
        </div>
      </div>

      {/* ── Center table ─────────────────────────────── */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">

        <div
          className="shrink-0 flex items-center gap-3 px-4 h-[38px] border-b border-white/[0.06]"
          style={{ background: "rgba(3,7,14,0.5)" }}
        >
          <span className="text-[10px] font-bold text-white/35 tracking-wide">
            {sector === "All" ? "All Futures" : sector}
          </span>
          <span className="text-[9px] text-white/18 tabular-nums">{tableRows.length} contracts</span>
          <div className="ml-auto flex items-center gap-1">
            {SECTORS.map(s => (
              <button
                key={s.id}
                onClick={() => setSector(s.id)}
                className={cn(
                  "px-2 py-1 rounded text-[9px] font-semibold border transition-colors",
                  sector === s.id
                    ? "bg-emerald-400/[0.08] text-emerald-300 border-emerald-400/20"
                    : "text-white/22 hover:text-white/50 border-transparent"
                )}
              >
                {s.short}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10" style={{ background: "rgba(3,7,14,0.97)" }}>
              <tr className="border-b border-white/[0.06]">
                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/18 w-7">#</th>
                <TH col="symbol" label="Symbol" />
                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25">Name</th>
                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25 text-right">Exch</th>
                <TH col="price"  label="Price"  right />
                <TH col="pct"    label="% Chg"  right />
                <TH col="chg"    label="Chg"    right />
                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25 text-right">Bid</th>
                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25 text-right">Ask</th>
                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25 text-right">Bid Sz</th>
                <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/25 text-right">Ask Sz</th>
                <TH col="volume" label="Volume" right />
                <TH col="oi"     label="OI"     right />
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, idx) => {
                const pos = row.chg >= 0;
                const isSelected = selected?.symbol === row.symbol;
                const dir = livePrices.get(row.symbol)?.dir;
                return (
                  <tr
                    key={row.symbol}
                    onClick={() => setSelected(row)}
                    className={cn(
                      "border-b border-white/[0.025] cursor-pointer transition-colors",
                      isSelected ? "bg-emerald-400/[0.05]" : "hover:bg-white/[0.02]"
                    )}
                  >
                    <td className="px-3 py-1.5 text-[10px] text-white/14 tabular-nums">{idx + 1}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                        )}
                        <span className="text-[11px] font-bold text-white/85 font-mono">{row.symbol}</span>
                        {dir && (
                          <span className={cn("text-[8px]", dir === 1 ? "text-emerald-400" : "text-red-400")}>
                            {dir === 1 ? "▲" : "▼"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 max-w-[180px] truncate text-[10px] text-white/35">{row.name}</td>
                    <td className="px-3 py-1.5 text-[9px] text-white/22 text-right tabular-nums">{row.exchange}</td>
                    <td className={cn("px-3 py-1.5 text-[11px] font-bold tabular-nums text-right", pos ? "text-emerald-300" : "text-red-400")}>
                      {fmtPx(row.price, row.tick)}
                    </td>
                    <td className={cn("px-3 py-1.5 text-[11px] font-semibold tabular-nums text-right", pos ? "text-emerald-400" : "text-red-400")}>
                      {pos ? "+" : ""}{row.pct.toFixed(2)}%
                    </td>
                    <td className={cn("px-3 py-1.5 text-[10px] tabular-nums text-right", pos ? "text-emerald-400/60" : "text-red-400/60")}>
                      {pos ? "+" : ""}{fmtPx(row.chg, row.tick)}
                    </td>
                    <td className="px-3 py-1.5 text-[10px] text-emerald-400/50 tabular-nums text-right">{fmtPx(row.bid, row.tick)}</td>
                    <td className="px-3 py-1.5 text-[10px] text-red-400/50   tabular-nums text-right">{fmtPx(row.ask, row.tick)}</td>
                    <td className="px-3 py-1.5 text-[10px] text-white/28 tabular-nums text-right">{row.bidSz}</td>
                    <td className="px-3 py-1.5 text-[10px] text-white/28 tabular-nums text-right">{row.askSz}</td>
                    <td className="px-3 py-1.5 text-[10px] text-white/45 tabular-nums text-right">{fmtVol(row.volume)}</td>
                    <td className="px-3 py-1.5 text-[10px] text-white/30 tabular-nums text-right">{fmtVol(row.oi)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Right detail panel — hidden on mobile ── */}
      <div className="hidden md:block w-[272px] shrink-0 h-full border-l border-white/[0.06] overflow-hidden">
        {selected ? (
          <DetailPanel key={selected.symbol} row={selected} live={selectedLive} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-[11px] text-white/20">Select a contract</p>
          </div>
        )}
      </div>
    </div>
  );
}
