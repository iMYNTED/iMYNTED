"use client";

import React, { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "imynted_settings_v1";

interface PersistedSettings {
  dataKeys: Record<string, Record<string, string>>;
  savedProviders: string[];
  connectedBrokers: string[];
  notif: Record<string, boolean>;
  display: Record<string, string | boolean>;
  profile: { name: string; email: string; timezone: string };
}

function loadSettings(): Partial<PersistedSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveSettings(s: PersistedSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type Section = "data" | "brokers" | "notifications" | "display" | "account" | "api";

const SECTIONS: { id: Section; label: string; icon: string; desc: string }[] = [
  { id: "data",          label: "Data Providers",   icon: "⚡", desc: "Market data feeds & real-time sources"  },
  { id: "brokers",       label: "Broker Accounts",  icon: "🏦", desc: "Connect trading accounts"               },
  { id: "notifications", label: "Notifications",    icon: "🔔", desc: "Alerts, sounds & push settings"         },
  { id: "display",       label: "Display",          icon: "🖥",  desc: "Theme, layout & terminal preferences"   },
  { id: "api",           label: "API Keys",         icon: "🔑", desc: "iMYNTED API & webhook credentials"      },
  { id: "account",       label: "Account",          icon: "👤", desc: "Profile, plan & billing"                },
];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={cn(
        "relative w-9 h-5 rounded-full transition-colors shrink-0",
        value ? "bg-emerald-400/80" : "bg-white/[0.12]"
      )}>
      <span className={cn(
        "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm",
        value ? "translate-x-[18px]" : "translate-x-0.5"
      )} />
    </button>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-white/[0.07] overflow-hidden" style={{ background: "rgba(6,14,24,0.65)" }}>
      <div className="px-5 py-3 border-b border-white/[0.06]"
        style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.05) 0%, transparent 60%)" }}>
        <p className="text-[9px] font-bold tracking-[0.12em] text-emerald-400/70 uppercase">{title}</p>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

function SettingRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className="text-[12px] text-white/80 font-medium">{label}</p>
        {sub && <p className="text-[10px] text-white/35 mt-0.5">{sub}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-400/40 transition-colors" />
  );
}

function StatusBadge({ status }: { status: "connected" | "disconnected" | "error" }) {
  const cfg = {
    connected:    { cls: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10", label: "CONNECTED"    },
    disconnected: { cls: "text-white/35    border-white/10       bg-white/[0.04]",   label: "NOT CONNECTED" },
    error:        { cls: "text-red-300     border-red-400/30     bg-red-400/10",      label: "ERROR"         },
  }[status];
  return <span className={cn("rounded border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide", cfg.cls)}>{cfg.label}</span>;
}

type BrokerEntry = { id: string; name: string; short: string; badgeColor: string; method: "OAuth" | "API Key"; logo: React.ReactNode; iconUrl?: string };

function BrokerLogoCircle({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden" style={{ background: bg }}>
      {children}
    </div>
  );
}

// Simple SVG logos for each broker
const LOGOS: Record<string, React.ReactNode> = {
  robinhood: <BrokerLogoCircle bg="#1a2e1a"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3C9 3 7 5.5 7 8c0 2 1 3.5 2.5 4.5L9 21h6l-.5-8.5C16 11.5 17 10 17 8c0-2.5-2-5-5-5z" fill="#22c55e"/><path d="M10 8c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z" fill="#166534"/></svg></BrokerLogoCircle>,
  etrade: <BrokerLogoCircle bg="#1e1030"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><text x="12" y="16" textAnchor="middle" fontSize="13" fontWeight="900" fill="#a855f7" fontFamily="monospace">E*</text></svg></BrokerLogoCircle>,
  webull: <BrokerLogoCircle bg="#0a1e2e"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 18L10 6l3 8 3-8 4 12" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></BrokerLogoCircle>,
  moomoo: <BrokerLogoCircle bg="#1e1200"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="10" r="4" fill="#f97316"/><path d="M8 14c-3 1-4 4-4 4h16s-1-3-4-4" fill="#f97316"/><circle cx="10" cy="9" r="1" fill="#1e1200"/><circle cx="14" cy="9" r="1" fill="#1e1200"/></svg></BrokerLogoCircle>,
  fidelity: <BrokerLogoCircle bg="#0a1f12"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 4L6 8v4l6 4 6-4V8z" fill="#22c55e" opacity=".8"/><path d="M12 12v6" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/></svg></BrokerLogoCircle>,
  schwab: <BrokerLogoCircle bg="#06142a"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="900" fill="#60a5fa" fontFamily="monospace">SCH</text></svg></BrokerLogoCircle>,
  ibkr: <BrokerLogoCircle bg="#1f0a0a"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M8 4h3v16H8zM13 4h3v7l-4 4V4z" fill="#f87171"/><path d="M13 11l5 9h-3l-2-4" fill="#ef4444"/></svg></BrokerLogoCircle>,
  tastytrade: <BrokerLogoCircle bg="#0f1e14"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="900" fill="#4ade80" fontFamily="monospace">tt</text></svg></BrokerLogoCircle>,
  tradestation: <BrokerLogoCircle bg="#06122a"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="900" fill="#38bdf8" fontFamily="monospace">TS</text></svg></BrokerLogoCircle>,
  alpaca: <BrokerLogoCircle bg="#1c1200"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="10" rx="4" ry="5" fill="#fbbf24"/><path d="M9 14c0 0-2 1-2 4h10c0-3-2-4-2-4" fill="#f59e0b"/><path d="M10 7c0 0 0-3 2-3s2 3 2 3" stroke="#d97706" strokeWidth="1.5" fill="none"/></svg></BrokerLogoCircle>,
  public: <BrokerLogoCircle bg="#0a1428"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="6" stroke="#3b82f6" strokeWidth="2"/><circle cx="12" cy="12" r="2" fill="#3b82f6"/></svg></BrokerLogoCircle>,
  firstrade: <BrokerLogoCircle bg="#0a1628"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5l-1.5 7h3z" fill="#60a5fa"/><path d="M8 12h8M6 17h12" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/></svg></BrokerLogoCircle>,
  tradier: <BrokerLogoCircle bg="#1f0e00"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 18L12 5l7 13" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M8.5 13h7" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round"/></svg></BrokerLogoCircle>,
  coinbase: <BrokerLogoCircle bg="#06102a"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7" stroke="#2563eb" strokeWidth="2"/><path d="M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" fill="#3b82f6"/></svg></BrokerLogoCircle>,
  binance: <BrokerLogoCircle bg="#1a1400"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 4l2 2-2 2-2-2zM7 9l2 2-2 2-2-2zM17 9l2 2-2 2-2-2zM12 14l2 2-2 2-2-2z" fill="#f59e0b"/><path d="M10 11l2 2 2-2" stroke="#f59e0b" strokeWidth="1.5" fill="none"/></svg></BrokerLogoCircle>,
  kraken: <BrokerLogoCircle bg="#120a28"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M8 4v16M8 12l8-8M8 12l8 8" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/></svg></BrokerLogoCircle>,
  gemini: <BrokerLogoCircle bg="#100a28"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M8 6h8M8 12h8M8 18h8" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round"/><path d="M8 6v12M16 6v12" stroke="#8b5cf6" strokeWidth="2"/></svg></BrokerLogoCircle>,
  kucoin: <BrokerLogoCircle bg="#001a18"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M7 7l5 5-5 5M12 12h5" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></BrokerLogoCircle>,
  bybit: <BrokerLogoCircle bg="#1a1000"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="3" height="12" rx="1" fill="#f59e0b"/><rect x="10.5" y="9" width="3" height="9" rx="1" fill="#fbbf24"/><rect x="15" y="12" width="3" height="6" rx="1" fill="#fde68a"/></svg></BrokerLogoCircle>,
  okx: <BrokerLogoCircle bg="#0a0a0a"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="5" y="5" width="5" height="5" rx="1" fill="#e5e7eb"/><rect x="14" y="5" width="5" height="5" rx="1" fill="#e5e7eb"/><rect x="5" y="14" width="5" height="5" rx="1" fill="#e5e7eb"/><rect x="14" y="14" width="5" height="5" rx="1" fill="#e5e7eb"/></svg></BrokerLogoCircle>,
  cryptocom: <BrokerLogoCircle bg="#06082a"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 4l8 4v8l-8 4-8-4V8z" stroke="#3b82f6" strokeWidth="1.5" fill="rgba(37,99,235,0.2)"/><text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="900" fill="#60a5fa" fontFamily="monospace">CRO</text></svg></BrokerLogoCircle>,
  etoro: <BrokerLogoCircle bg="#001a14"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="6" fill="#059669" opacity=".3"/><text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="900" fill="#34d399" fontFamily="serif" fontStyle="italic">e</text></svg></BrokerLogoCircle>,
  saxo: <BrokerLogoCircle bg="#060e1e"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="900" fill="#2563eb" fontFamily="monospace">S</text></svg></BrokerLogoCircle>,
  ig: <BrokerLogoCircle bg="#1a0800"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="900" fill="#f97316" fontFamily="monospace">IG</text></svg></BrokerLogoCircle>,
  trading212: <BrokerLogoCircle bg="#06102a"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><text x="12" y="14" textAnchor="middle" fontSize="7" fontWeight="900" fill="#60a5fa" fontFamily="monospace">T212</text></svg></BrokerLogoCircle>,
  degiro: <BrokerLogoCircle bg="#080e20"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="900" fill="#4f80e1" fontFamily="monospace">DEGIRO</text></svg></BrokerLogoCircle>,
};

const STOCK_BROKERS: BrokerEntry[] = [
  { id: "robinhood",    name: "Robinhood",           short: "RH",      badgeColor: "text-amber-300   border-amber-400/30   bg-amber-400/10",   method: "OAuth",   logo: LOGOS.robinhood,    iconUrl: "https://cdn.brandfetch.io/robinhood.com/w/512/h/512/icon" },
  { id: "etrade",       name: "E*Trade",             short: "ETRADE",  badgeColor: "text-purple-300  border-purple-400/30  bg-purple-400/10",  method: "OAuth",   logo: LOGOS.etrade,       iconUrl: "https://cdn.brandfetch.io/etrade.com/w/512/h/512/icon" },
  { id: "webull",       name: "Webull",              short: "WEBULL",  badgeColor: "text-cyan-300    border-cyan-400/30    bg-cyan-400/10",    method: "OAuth",   logo: LOGOS.webull,       iconUrl: "https://cdn.brandfetch.io/webull.com/w/512/h/512/icon" },
  { id: "moomoo",       name: "Moomoo",              short: "MOOMOO",  badgeColor: "text-orange-300  border-orange-400/30  bg-orange-400/10",  method: "OAuth",   logo: LOGOS.moomoo,       iconUrl: "https://cdn.brandfetch.io/moomoo.com/w/512/h/512/icon" },
  { id: "fidelity",     name: "Fidelity",            short: "FIDELITY",badgeColor: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10", method: "OAuth",   logo: LOGOS.fidelity,     iconUrl: "https://cdn.brandfetch.io/fidelity.com/w/512/h/512/icon" },
  { id: "schwab",       name: "Charles Schwab",      short: "SCHWAB",  badgeColor: "text-blue-300    border-blue-400/30    bg-blue-400/10",    method: "OAuth",   logo: LOGOS.schwab,       iconUrl: "https://cdn.brandfetch.io/schwab.com/w/512/h/512/icon" },
  { id: "ibkr",         name: "Interactive Brokers", short: "IBKR",    badgeColor: "text-red-300     border-red-400/30     bg-red-400/10",     method: "API Key", logo: LOGOS.ibkr,         iconUrl: "https://cdn.brandfetch.io/interactivebrokers.com/w/512/h/512/icon" },
  { id: "tastytrade",   name: "Tastytrade",          short: "TASTY",   badgeColor: "text-green-300   border-green-400/30   bg-green-400/10",   method: "OAuth",   logo: LOGOS.tastytrade,   iconUrl: "https://cdn.brandfetch.io/tastytrade.com/w/512/h/512/icon" },
  { id: "tradestation", name: "TradeStation",        short: "TS",      badgeColor: "text-sky-300     border-sky-400/30     bg-sky-400/10",     method: "API Key", logo: LOGOS.tradestation, iconUrl: "https://cdn.brandfetch.io/tradestation.com/w/512/h/512/icon" },
  { id: "alpaca",       name: "Alpaca",              short: "ALPACA",  badgeColor: "text-yellow-300  border-yellow-400/30  bg-yellow-400/10",  method: "API Key", logo: LOGOS.alpaca,       iconUrl: "https://cdn.brandfetch.io/alpaca.markets/w/512/h/512/icon" },
  { id: "public",       name: "Public",              short: "PUBLIC",  badgeColor: "text-blue-300    border-blue-400/30    bg-blue-400/10",    method: "OAuth",   logo: LOGOS.public,       iconUrl: "https://cdn.brandfetch.io/public.com/w/512/h/512/icon" },
  { id: "firstrade",    name: "Firstrade",           short: "FIRST",   badgeColor: "text-sky-300     border-sky-400/30     bg-sky-400/10",     method: "OAuth",   logo: LOGOS.firstrade,    iconUrl: "https://cdn.brandfetch.io/firstrade.com/w/512/h/512/icon" },
  { id: "tradier",      name: "Tradier",             short: "TRADIER", badgeColor: "text-orange-300  border-orange-400/30  bg-orange-400/10",  method: "API Key", logo: LOGOS.tradier,      iconUrl: "https://cdn.brandfetch.io/tradier.com/w/512/h/512/icon" },
];

const CRYPTO_BROKERS: BrokerEntry[] = [
  { id: "coinbase",   name: "Coinbase",    short: "CB",    badgeColor: "text-blue-300   border-blue-400/30   bg-blue-400/10",   method: "OAuth",   logo: LOGOS.coinbase,   iconUrl: "https://cdn.brandfetch.io/coinbase.com/w/512/h/512/icon" },
  { id: "binance",    name: "Binance",     short: "BIN",   badgeColor: "text-yellow-300 border-yellow-400/30 bg-yellow-400/10", method: "API Key", logo: LOGOS.binance,    iconUrl: "https://cdn.brandfetch.io/binance.com/w/512/h/512/icon" },
  { id: "kraken",     name: "Kraken",      short: "KRK",   badgeColor: "text-violet-300 border-violet-400/30 bg-violet-400/10", method: "API Key", logo: LOGOS.kraken,     iconUrl: "https://cdn.brandfetch.io/kraken.com/w/512/h/512/icon" },
  { id: "gemini",     name: "Gemini",      short: "GEM",   badgeColor: "text-purple-300 border-purple-400/30 bg-purple-400/10", method: "API Key", logo: LOGOS.gemini,     iconUrl: "https://cdn.brandfetch.io/gemini.com/w/512/h/512/icon" },
  { id: "kucoin",     name: "KuCoin",      short: "KC",    badgeColor: "text-teal-300   border-teal-400/30   bg-teal-400/10",   method: "API Key", logo: LOGOS.kucoin,     iconUrl: "https://cdn.brandfetch.io/kucoin.com/w/512/h/512/icon" },
  { id: "bybit",      name: "Bybit",       short: "BYBIT", badgeColor: "text-amber-300  border-amber-400/30  bg-amber-400/10",  method: "API Key", logo: LOGOS.bybit,      iconUrl: "https://cdn.brandfetch.io/bybit.com/w/512/h/512/icon" },
  { id: "okx",        name: "OKX",         short: "OKX",   badgeColor: "text-white/50   border-white/20      bg-white/[0.06]",  method: "API Key", logo: LOGOS.okx,        iconUrl: "https://cdn.brandfetch.io/okx.com/w/512/h/512/icon" },
  { id: "cryptocom",  name: "Crypto.com",  short: "CRO",   badgeColor: "text-blue-300   border-blue-400/30   bg-blue-400/10",   method: "API Key", logo: LOGOS.cryptocom,  iconUrl: "https://cdn.brandfetch.io/crypto.com/w/512/h/512/icon" },
];

const INTL_BROKERS: BrokerEntry[] = [
  { id: "etoro",      name: "eToro",       short: "ETORO",  badgeColor: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10", method: "OAuth",   logo: LOGOS.etoro,      iconUrl: "https://cdn.brandfetch.io/etoro.com/w/512/h/512/icon" },
  { id: "saxo",       name: "Saxo",        short: "SAXO",   badgeColor: "text-blue-300    border-blue-400/30    bg-blue-400/10",    method: "API Key", logo: LOGOS.saxo,       iconUrl: "https://cdn.brandfetch.io/home.saxo/w/512/h/512/icon" },
  { id: "ig",         name: "IG",          short: "IG",     badgeColor: "text-orange-300  border-orange-400/30  bg-orange-400/10",  method: "API Key", logo: LOGOS.ig,         iconUrl: "https://cdn.brandfetch.io/ig.com/w/512/h/512/icon" },
  { id: "trading212", name: "Trading212",  short: "T212",   badgeColor: "text-sky-300     border-sky-400/30     bg-sky-400/10",     method: "OAuth",   logo: LOGOS.trading212, iconUrl: "https://cdn.brandfetch.io/trading212.com/w/512/h/512/icon" },
  { id: "degiro",     name: "DEGIRO",      short: "DEGIRO", badgeColor: "text-indigo-300  border-indigo-400/30  bg-indigo-400/10",  method: "API Key", logo: LOGOS.degiro,     iconUrl: "https://cdn.brandfetch.io/degiro.eu/w/512/h/512/icon" },
];

function BrokerIconImg({ b }: { b: BrokerEntry }) {
  const [ok, setOk] = React.useState(true);
  if (b.iconUrl && ok) {
    return (
      <img src={b.iconUrl} alt={b.short} width={40} height={40}
        className="w-10 h-10 rounded-xl object-contain bg-white/[0.06] border border-white/10 shrink-0"
        onError={() => setOk(false)} />
    );
  }
  return <>{b.logo}</>;
}

function BrokerCard({ b, connected, onToggle }: { b: BrokerEntry; connected: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-xl border border-white/[0.07] p-3.5 flex flex-col gap-3 hover:border-emerald-400/20 transition-all"
      style={{ background: "rgba(5,11,20,0.85)" }}>
      <div className="flex items-center gap-3">
        <BrokerIconImg b={b} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={cn("rounded border px-1.5 py-0.5 text-[7px] font-black tracking-wide leading-none shrink-0", b.badgeColor)}>{b.short}</span>
            <p className="text-[12px] font-bold text-white/90 leading-tight truncate">{b.name}</p>
          </div>
          <p className="text-[9px] text-white/30 uppercase tracking-widest font-semibold">{b.method}</p>
        </div>
      </div>
      <button onClick={onToggle}
        className={cn(
          "w-full py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all",
          connected
            ? "border-red-400/25 bg-red-400/[0.07] text-red-300 hover:bg-red-400/12"
            : "border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300 hover:bg-emerald-400/12 hover:border-emerald-400/50"
        )}>
        {connected ? "Disconnect" : "Connect"}
      </button>
    </div>
  );
}

const DATA_PROVIDERS = [
  { id: "alpaca",     name: "Alpaca Markets",     type: "Stock/Crypto",  fields: ["API Key", "Secret Key"] },
  { id: "polygon",    name: "Polygon.io",         type: "Stock Data",    fields: ["API Key"]               },
  { id: "tradier",    name: "Tradier",            type: "Stock/Options", fields: ["API Key"]               },
  { id: "finnhub",    name: "Finnhub",            type: "Stock Data",    fields: ["API Key"]               },
  { id: "coinbase_data", name: "Coinbase Advanced", type: "Crypto",      fields: ["API Key", "Secret Key"] },
  { id: "binance_data",  name: "Binance",         type: "Crypto",        fields: ["API Key", "Secret Key"] },
];

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("data");
  const [hydrated, setHydrated] = useState(false);

  const NOTIF_DEFAULTS = {
    alertTriggered: true, scannerHit: true, priceAlert: true,
    sound: true, desktop: false, email: false,
    volumeSpike: false, haltAlert: true,
  };
  const DISPLAY_DEFAULTS = {
    compactMode: false, animations: true, showSpreads: true,
    colorBlinds: false, defaultAsset: "stock", chartStyle: "candle",
    refreshRate: "2500", timeFormat: "12h",
  };
  const PROFILE_DEFAULTS = { name: "", email: "", timezone: "America/New_York" };

  // Data provider keys
  const [dataKeys, setDataKeys] = useState<Record<string, Record<string, string>>>({});
  const [savedProviders, setSavedProviders] = useState<Set<string>>(new Set());

  // Broker connections
  const [connectedBrokers, setConnectedBrokers] = useState<Set<string>>(new Set());

  // Notifications
  const [notif, setNotif] = useState(NOTIF_DEFAULTS);

  // Display
  const [display, setDisplay] = useState(DISPLAY_DEFAULTS);

  // Account
  const [profile, setProfile] = useState(PROFILE_DEFAULTS);

  // ── Load from localStorage on mount ──
  useEffect(() => {
    const saved = loadSettings();
    if (saved.dataKeys) setDataKeys(saved.dataKeys);
    if (saved.savedProviders) setSavedProviders(new Set(saved.savedProviders));
    if (saved.connectedBrokers) setConnectedBrokers(new Set(saved.connectedBrokers));
    if (saved.notif) setNotif(prev => ({ ...prev, ...saved.notif }));
    if (saved.display) setDisplay(prev => ({ ...prev, ...saved.display }));
    if (saved.profile) setProfile(prev => ({ ...prev, ...saved.profile }));
    setHydrated(true);
  }, []);

  // ── Persist to localStorage on any change ──
  const persist = useCallback(() => {
    if (!hydrated) return;
    saveSettings({
      dataKeys,
      savedProviders: Array.from(savedProviders),
      connectedBrokers: Array.from(connectedBrokers),
      notif,
      display,
      profile,
    });
  }, [hydrated, dataKeys, savedProviders, connectedBrokers, notif, display, profile]);

  useEffect(() => { persist(); }, [persist]);

  function setDataKey(providerId: string, field: string, val: string) {
    setDataKeys(prev => ({ ...prev, [providerId]: { ...(prev[providerId] ?? {}), [field]: val } }));
  }

  function saveProvider(id: string) {
    setSavedProviders(prev => new Set([...prev, id]));
  }

  function toggleBroker(id: string) {
    setConnectedBrokers(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto"
      style={{ background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)" }}>

      {/* Glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 55% 35% at 5% 0%, rgba(52,211,153,0.06) 0%, transparent 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 30% 20% at 95% 100%, rgba(34,211,238,0.03) 0%, transparent 100%)" }} />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row h-full min-h-0">

        {/* ── Sidebar nav ── */}
        <div className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-white/[0.06] flex md:flex-col py-2 md:py-5 overflow-x-auto md:overflow-x-visible"
          style={{ background: "rgba(3,8,14,0.6)" }}>
          <div className="px-4 mb-5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold tracking-[0.14em] text-emerald-400/70 uppercase">iMYNTED</span>
              <span className="text-white/20">|</span>
              <span className="text-[13px] font-bold text-white">Settings</span>
            </div>
          </div>

          <nav className="flex-1 px-2 space-y-0.5 flex md:flex-col flex-row md:flex-wrap gap-1 md:gap-0 overflow-x-auto md:overflow-visible">
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={cn(
                  "md:w-full flex items-center gap-2 md:gap-3 px-3 py-2 md:py-2.5 rounded transition-colors text-left shrink-0",
                  section === s.id
                    ? "bg-emerald-400/[0.09] text-white"
                    : "text-white/45 hover:text-white/70 hover:bg-white/[0.03]"
                )}>
                <span className="text-[14px] shrink-0">{s.icon}</span>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold leading-tight">{s.label}</div>
                  <div className="text-[9px] text-white/30 truncate leading-tight mt-0.5">{s.desc}</div>
                </div>
                {section === s.id && <span className="ml-auto w-1 h-1 rounded-full bg-emerald-400 shrink-0" />}
              </button>
            ))}
          </nav>

          <div className="hidden md:block px-4 pt-3 border-t border-white/[0.06]">
            <p className="text-[9px] text-white/20">iMYNTED Terminal v0.1</p>
            <p className="text-[9px] text-white/15">SIM Mode · No live data</p>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0 overflow-y-auto px-3 py-3 md:px-6 md:py-6">

          {/* ── DATA PROVIDERS ── */}
          {section === "data" && (
            <div className="max-w-2xl space-y-4">
              <div className="mb-2">
                <h2 className="text-[16px] font-bold text-white">Data Providers</h2>
                <p className="text-[11px] text-white/40 mt-0.5">Connect real market data sources to replace SIM feed. Keys are stored locally in your browser.</p>
              </div>

              {DATA_PROVIDERS.map(p => {
                const keys = dataKeys[p.id] ?? {};
                const isSaved = savedProviders.has(p.id);
                const isFilled = p.fields.every(f => keys[f]?.trim());
                return (
                  <SectionCard key={p.id} title={p.name}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] text-white/35 border border-white/10 bg-white/[0.04] rounded px-2 py-0.5">{p.type}</span>
                      <StatusBadge status={isSaved && isFilled ? "connected" : "disconnected"} />
                    </div>
                    <div className="space-y-2">
                      {p.fields.map(field => (
                        <div key={field}>
                          <label className="block text-[9px] text-emerald-400/60 uppercase tracking-widest mb-1">{field}</label>
                          <Input
                            type="password"
                            value={keys[field] ?? ""}
                            onChange={v => setDataKey(p.id, field, v)}
                            placeholder={`Enter ${field}…`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => saveProvider(p.id)} disabled={!isFilled}
                        className="px-4 py-1.5 rounded border border-emerald-400/25 bg-emerald-400/10 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-400/18 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        {isSaved && isFilled ? "Update" : "Connect"}
                      </button>
                      {isSaved && (
                        <button onClick={() => setSavedProviders(prev => { const n = new Set(prev); n.delete(p.id); return n; })}
                          className="px-4 py-1.5 rounded border border-red-400/20 bg-red-400/[0.07] text-[11px] font-semibold text-red-300 hover:bg-red-400/12 transition-colors">
                          Disconnect
                        </button>
                      )}
                    </div>
                  </SectionCard>
                );
              })}
            </div>
          )}

          {/* ── BROKER ACCOUNTS ── */}
          {section === "brokers" && (() => {
            const totalConn = connectedBrokers.size;
            const stockConn = STOCK_BROKERS.filter(b => connectedBrokers.has(b.id)).length;
            const cryptoConn = CRYPTO_BROKERS.filter(b => connectedBrokers.has(b.id)).length;
            const intlConn = INTL_BROKERS.filter(b => connectedBrokers.has(b.id)).length;

            return (
              <div className="space-y-6">
                {/* Stats header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-5">
                    {[
                      { label: "TOTAL", val: totalConn },
                      { label: "STOCK", val: stockConn },
                      { label: "CRYPTO", val: cryptoConn },
                      { label: "INT'L", val: intlConn },
                    ].map(({ label, val }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-white/40 tracking-[0.1em] uppercase">{label}</span>
                        <span className="text-[11px] font-black text-white/70 tabular-nums">{val}</span>
                      </div>
                    ))}
                  </div>
                  <span className="text-[8px] text-white/20 tracking-[0.14em] font-bold uppercase">All Brokers · All Accounts · One App</span>
                </div>

                {/* Stock Brokers */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[9px] font-bold tracking-[0.14em] text-emerald-400/70 uppercase">Stock Brokers</span>
                    <span className="text-[9px] text-white/25">{stockConn}/{STOCK_BROKERS.length}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {STOCK_BROKERS.map(b => <BrokerCard key={b.id} b={b} connected={connectedBrokers.has(b.id)} onToggle={() => toggleBroker(b.id)} />)}
                  </div>
                </div>

                {/* Crypto Exchanges */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[9px] font-bold tracking-[0.14em] text-emerald-400/70 uppercase">Crypto Exchanges</span>
                    <span className="text-[9px] text-white/25">{cryptoConn}/{CRYPTO_BROKERS.length}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {CRYPTO_BROKERS.map(b => <BrokerCard key={b.id} b={b} connected={connectedBrokers.has(b.id)} onToggle={() => toggleBroker(b.id)} />)}
                  </div>
                </div>

                {/* International */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[9px] font-bold tracking-[0.14em] text-emerald-400/70 uppercase">International</span>
                    <span className="text-[9px] text-white/25">{intlConn}/{INTL_BROKERS.length}</span>
                    <span className="rounded border border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300 text-[7px] font-bold tracking-widest uppercase px-1.5 py-0.5">Coming Soon</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 opacity-60 pointer-events-none">
                    {INTL_BROKERS.map(b => <BrokerCard key={b.id} b={b} connected={connectedBrokers.has(b.id)} onToggle={() => toggleBroker(b.id)} />)}
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-white/[0.05]">
                  <p className="text-[9px] font-bold tracking-[0.12em] text-emerald-400/40 uppercase">iMYNTED — The Control Layer Above All Brokers</p>
                  <p className="text-[9px] text-white/20 mt-1">Phase 1: View Only · Phase 2: Alerts · Phase 3: Execution · Phase 4: Automation</p>
                </div>
              </div>
            );
          })()}

          {/* ── NOTIFICATIONS ── */}
          {section === "notifications" && (
            <div className="max-w-xl space-y-4">
              <div className="mb-2">
                <h2 className="text-[16px] font-bold text-white">Notifications</h2>
                <p className="text-[11px] text-white/40 mt-0.5">Control what triggers alerts and how you're notified.</p>
              </div>

              <SectionCard title="Alert Triggers">
                {([
                  { key: "alertTriggered", label: "Alert condition triggered",    sub: "Notify when a saved alert fires"             },
                  { key: "scannerHit",     label: "Scanner signal hit",           sub: "New signal matches scanner criteria"          },
                  { key: "priceAlert",     label: "Price target reached",         sub: "Symbol hits your price level"                 },
                  { key: "volumeSpike",    label: "Volume spike detected",        sub: "Unusual volume vs 30-period average"          },
                  { key: "haltAlert",      label: "Trading halt / resume",        sub: "LULD or regulatory halt on watched symbols"   },
                ] as const).map(({ key, label, sub }) => (
                  <SettingRow key={key} label={label} sub={sub}>
                    <Toggle value={notif[key]} onChange={v => setNotif(n => ({ ...n, [key]: v }))} />
                  </SettingRow>
                ))}
              </SectionCard>

              <SectionCard title="Delivery">
                {([
                  { key: "sound",   label: "Sound alerts",    sub: "Play audio when alerts fire"         },
                  { key: "desktop", label: "Desktop push",    sub: "Browser notification popup"          },
                  { key: "email",   label: "Email digest",    sub: "Daily summary of triggered alerts"   },
                ] as const).map(({ key, label, sub }) => (
                  <SettingRow key={key} label={label} sub={sub}>
                    <Toggle value={notif[key]} onChange={v => setNotif(n => ({ ...n, [key]: v }))} />
                  </SettingRow>
                ))}
              </SectionCard>
            </div>
          )}

          {/* ── DISPLAY ── */}
          {section === "display" && (
            <div className="max-w-xl space-y-4">
              <div className="mb-2">
                <h2 className="text-[16px] font-bold text-white">Display</h2>
                <p className="text-[11px] text-white/40 mt-0.5">Customize the terminal look and feel.</p>
              </div>

              <SectionCard title="Layout">
                {([
                  { key: "compactMode",  label: "Compact mode",        sub: "Reduce row height in tables and panels"  },
                  { key: "animations",   label: "Animations",          sub: "Price flash, panel transitions"           },
                  { key: "showSpreads",  label: "Show bid/ask spread", sub: "Display spread in header bar"            },
                  { key: "colorBlinds",  label: "Deuteranopia mode",   sub: "Replace red/green with blue/orange"      },
                ] as const).map(({ key, label, sub }) => (
                  <SettingRow key={key} label={label} sub={sub}>
                    <Toggle value={display[key] as boolean} onChange={v => setDisplay(d => ({ ...d, [key]: v }))} />
                  </SettingRow>
                ))}
              </SectionCard>

              <SectionCard title="Preferences">
                <SettingRow label="Default asset type" sub="Which asset class opens by default">
                  <select value={display.defaultAsset} onChange={e => setDisplay(d => ({ ...d, defaultAsset: e.target.value }))}
                    className="rounded border border-white/10 bg-[#060e18] px-3 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-400/40 transition-colors">
                    <option value="stock">Stock</option>
                    <option value="crypto">Crypto</option>
                  </select>
                </SettingRow>
                <SettingRow label="Default chart style" sub="Candle, line or area chart">
                  <select value={display.chartStyle} onChange={e => setDisplay(d => ({ ...d, chartStyle: e.target.value }))}
                    className="rounded border border-white/10 bg-[#060e18] px-3 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-400/40 transition-colors">
                    <option value="candle">Candle</option>
                    <option value="line">Line</option>
                    <option value="area">Area</option>
                  </select>
                </SettingRow>
                <SettingRow label="Data refresh rate" sub="How often panels poll for new data">
                  <select value={display.refreshRate} onChange={e => setDisplay(d => ({ ...d, refreshRate: e.target.value }))}
                    className="rounded border border-white/10 bg-[#060e18] px-3 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-400/40 transition-colors">
                    <option value="1000">1 second</option>
                    <option value="2500">2.5 seconds</option>
                    <option value="5000">5 seconds</option>
                    <option value="10000">10 seconds</option>
                  </select>
                </SettingRow>
                <SettingRow label="Time format" sub="12-hour or 24-hour clock">
                  <select value={display.timeFormat} onChange={e => setDisplay(d => ({ ...d, timeFormat: e.target.value }))}
                    className="rounded border border-white/10 bg-[#060e18] px-3 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-400/40 transition-colors">
                    <option value="12h">12h (AM/PM)</option>
                    <option value="24h">24h</option>
                  </select>
                </SettingRow>
              </SectionCard>
            </div>
          )}

          {/* ── API KEYS ── */}
          {section === "api" && (
            <div className="max-w-xl space-y-4">
              <div className="mb-2">
                <h2 className="text-[16px] font-bold text-white">API Keys</h2>
                <p className="text-[11px] text-white/40 mt-0.5">iMYNTED API credentials for webhooks, automations and third-party integrations.</p>
              </div>

              <SectionCard title="iMYNTED API">
                <SettingRow label="API Key" sub="Read-only access to your terminal data">
                  <div className="flex items-center gap-2">
                    <code className="rounded border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] text-white/50 font-mono truncate max-w-[200px] block">im_live_••••••••••••••••</code>
                    <button className="text-[10px] text-white/35 hover:text-white/60 transition-colors border border-white/10 rounded px-2 py-1">Copy</button>
                  </div>
                </SettingRow>
                <SettingRow label="Webhook URL" sub="Receive alert events via POST">
                  <Input value="" onChange={() => {}} placeholder="https://your-server.com/webhook" />
                </SettingRow>
                <SettingRow label="Webhook Secret" sub="Verify webhook payloads">
                  <Input type="password" value="" onChange={() => {}} placeholder="whsec_…" />
                </SettingRow>
              </SectionCard>

              <SectionCard title="Regenerate">
                <p className="text-[11px] text-white/40 mb-3">Regenerating your API key will invalidate the current one immediately. All active integrations will need to be updated.</p>
                <button className="px-4 py-2 rounded border border-red-400/20 bg-red-400/[0.07] text-[11px] font-semibold text-red-300 hover:bg-red-400/12 transition-colors">
                  Regenerate API Key
                </button>
              </SectionCard>
            </div>
          )}

          {/* ── ACCOUNT ── */}
          {section === "account" && (
            <div className="max-w-xl space-y-4">
              <div className="mb-2">
                <h2 className="text-[16px] font-bold text-white">Account</h2>
                <p className="text-[11px] text-white/40 mt-0.5">Your profile, plan details and session management.</p>
              </div>

              <SectionCard title="Profile">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] text-emerald-400/60 uppercase tracking-widest mb-1.5">Display Name</label>
                    <Input value={profile.name} onChange={v => setProfile(p => ({ ...p, name: v }))} placeholder="Your name" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-emerald-400/60 uppercase tracking-widest mb-1.5">Email</label>
                    <Input type="email" value={profile.email} onChange={v => setProfile(p => ({ ...p, email: v }))} placeholder="you@example.com" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-emerald-400/60 uppercase tracking-widest mb-1.5">Timezone</label>
                    <select value={profile.timezone} onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))}
                      className="w-full rounded border border-white/10 bg-[#060e18] px-3 py-2 text-[12px] text-white focus:outline-none focus:border-emerald-400/40 transition-colors">
                      {["America/New_York","America/Chicago","America/Los_Angeles","America/Denver","Europe/London","Europe/Paris","Asia/Tokyo","Asia/Hong_Kong"].map(tz => (
                        <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
                      ))}
                    </select>
                  </div>
                  <button className="px-4 py-2 rounded border border-emerald-400/25 bg-emerald-400/10 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-400/18 transition-colors">
                    Save Profile
                  </button>
                </div>
              </SectionCard>

              <SectionCard title="Plan">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[13px] font-bold text-white">iMYNTED Free</p>
                    <p className="text-[10px] text-white/35 mt-0.5">SIM data · 5 alerts · 1 watchlist</p>
                  </div>
                  <span className="rounded border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[9px] font-bold text-emerald-300 uppercase tracking-wide">ACTIVE</span>
                </div>
                <button className="w-full py-2 rounded border border-cyan-400/25 bg-cyan-400/[0.07] text-[11px] font-semibold text-cyan-300 hover:bg-cyan-400/12 transition-colors">
                  Upgrade to iMYNTED Pro →
                </button>
              </SectionCard>

              <SectionCard title="Session">
                <SettingRow label="Data mode" sub="Switch between real and simulated data">
                  <span className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-300 uppercase">SIM</span>
                </SettingRow>
                <div className="pt-2">
                  <button className="px-4 py-2 rounded border border-red-400/20 bg-red-400/[0.07] text-[11px] font-semibold text-red-300 hover:bg-red-400/12 transition-colors">
                    Sign Out
                  </button>
                </div>
              </SectionCard>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
