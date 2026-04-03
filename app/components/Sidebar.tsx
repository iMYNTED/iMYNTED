"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* ── icons ──────────────────────── */
const IconDashboard = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
    <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
    <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
    <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
  </svg>
);

const IconAlerts = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6 13a2 2 0 0 0 4 0" />
    <path d="M13 7a5 5 0 0 0-10 0c0 3-1.5 5-1.5 5h13S13 10 13 7Z" />
  </svg>
);

const IconAccounts = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="5" r="3" />
    <path d="M2.5 14a5.5 5.5 0 0 1 11 0" />
  </svg>
);

const IconCommand = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1.5" y="4.5" width="13" height="7" rx="1.5" />
    <path d="M4.5 7.5h2M4.5 9.5h4M10.5 7.5h1M10.5 9.5h1" strokeLinecap="round" />
  </svg>
);

const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="2" />
    <path d="M13.5 8a5.5 5.5 0 0 0-.1-.8l1.4-1.1-1-1.8-1.7.5a5.3 5.3 0 0 0-1.4-.8L10.4 2H8.6l-.3 1.9a5.3 5.3 0 0 0-1.4.8l-1.7-.5-1 1.8 1.4 1.1a5.8 5.8 0 0 0 0 1.7l-1.4 1.1 1 1.8 1.7-.5a5.3 5.3 0 0 0 1.4.8L8.6 14h1.8l.3-1.9a5.3 5.3 0 0 0 1.4-.8l1.7.5 1-1.8-1.4-1.1a5.8 5.8 0 0 0 .1-.9Z" />
  </svg>
);

const IconFutures = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 11 L5 8 L8 9.5 L14 4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 4h3v3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 14h12" strokeLinecap="round" opacity="0.4" />
  </svg>
);

const IconOptions = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 8h12" strokeLinecap="round" />
    <path d="M4 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    <path d="M12 4l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
  </svg>
);

const IconETF = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1.5" y="5.5" width="4" height="7" rx="0.5" />
    <rect x="6.5" y="3.5" width="4" height="9" rx="0.5" />
    <rect x="11.5" y="7.5" width="3" height="5" rx="0.5" />
    <path d="M2 2.5h13" strokeLinecap="round" opacity="0.35" />
  </svg>
);

const IconSectors = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 8 L8 1.5 A6.5 6.5 0 0 1 14.5 8 Z" strokeLinejoin="round" />
    <path d="M8 8 L14.5 8 A6.5 6.5 0 0 1 4.5 13.9 Z" strokeLinejoin="round" opacity="0.7" />
    <path d="M8 8 L4.5 13.9 A6.5 6.5 0 0 1 1.5 8 Z" strokeLinejoin="round" opacity="0.45" />
    <path d="M8 8 L1.5 8 A6.5 6.5 0 0 1 8 1.5 Z" strokeLinejoin="round" opacity="0.25" />
  </svg>
);

const IconScanner = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 3h12M2 6.5h8M2 10h10M2 13.5h6" strokeLinecap="round" opacity="0.8" />
    <circle cx="13" cy="11" r="2.5" />
    <path d="M14.8 12.8L16 14" strokeLinecap="round" />
  </svg>
);

const IconEarnings = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
    <path d="M2 5.5h12" opacity="0.5" />
    <path d="M5 1.5v2M11 1.5v2" strokeLinecap="round" />
    <path d="M5 8h2M9 8h2M5 10.5h2" strokeLinecap="round" opacity="0.6" />
  </svg>
);

const IconThemes = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6" opacity="0.3" />
    <path d="M5 10 L7 6 L9 8 L11 4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="11" cy="4" r="1.5" fill="currentColor" opacity="0.6" />
    <circle cx="5" cy="10" r="1" fill="currentColor" opacity="0.4" />
  </svg>
);

const IconEconCal = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 4h12M2 8h8M2 12h5" strokeLinecap="round" opacity="0.6" />
    <path d="M12 9v5M10 12h4" strokeLinecap="round" />
    <circle cx="14" cy="3" r="1.5" fill="currentColor" opacity="0.5" />
  </svg>
);

const IconPatterns = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 12 L4 8 L6 10 L8 4 L10 7 L12 3 L14 6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 14h12" strokeLinecap="round" opacity="0.3" />
    <circle cx="8" cy="4" r="1" fill="currentColor" opacity="0.5" />
  </svg>
);

const IconInstitutions = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 1.5L2 5.5V6.5h12V5.5L8 1.5Z" strokeLinejoin="round" />
    <path d="M3.5 6.5v5M6 6.5v5M10 6.5v5M12.5 6.5v5" strokeLinecap="round" />
    <path d="M2 11.5h12v2H2z" strokeLinejoin="round" />
  </svg>
);

const IconIPO = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 12V6M8 12V4M12 12V8" strokeLinecap="round" />
    <path d="M2 14h12" strokeLinecap="round" opacity="0.4" />
    <circle cx="12" cy="4" r="1.5" fill="currentColor" opacity="0.6" />
  </svg>
);

const NAV = [
  { href: "/dashboard", icon: IconDashboard, hotkey: "D", label: "Dashboard" },
  { href: "/scanner",   icon: IconScanner,   hotkey: "R", label: "Scanner"   },
  { href: "/accounts",  icon: IconAccounts,  hotkey: "C", label: "Accounts"  },
  { href: "/settings",  icon: IconSettings,  hotkey: "S", label: "Settings"  },
] as const;

const MARKETS = [
  { href: "/futures", icon: IconFutures, hotkey: "F", label: "Futures" },
  { href: "/options", icon: IconOptions, hotkey: "O", label: "Options" },
  { href: "/etfs",    icon: IconETF,     hotkey: "E", label: "ETFs"    },
];

const RESEARCH = [
  { href: "/sectors",      icon: IconSectors,      hotkey: "K", label: "Sectors"      },
  { href: "/earnings",     icon: IconEarnings,     hotkey: "N", label: "Earnings"     },
  { href: "/ipos",         icon: IconIPO,          hotkey: "I", label: "IPOs"         },
  { href: "/institutions", icon: IconInstitutions, hotkey: "T", label: "Institutions" },
  { href: "/patterns",     icon: IconPatterns,     hotkey: "P", label: "Patterns"     },
  { href: "/themes",       icon: IconThemes,       hotkey: "H", label: "Themes"       },
];

const TOOLS = [
  { href: "/economic-calendar", icon: IconEconCal, hotkey: "G", label: "Economy" },
  { href: "/alerts",            icon: IconAlerts,  hotkey: "A", label: "Alerts"  },
];

function isTypingTarget(el: EventTarget | null) {
  if (!el || !(el as HTMLElement).tagName) return false;
  const t = (el as HTMLElement).tagName.toLowerCase();
  return t === "input" || t === "textarea" || t === "select" || !!(el as HTMLElement).isContentEditable;
}

function SidebarSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ symbol: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const term = q.trim();
    if (!term || term.length < 1) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(term)}`);
        const j = await res.json();
        if (j?.ok && Array.isArray(j.results)) { setResults(j.results); setOpen(j.results.length > 0); }
      } catch { setResults([]); }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [q]);

  function pick(sym: string) {
    const isCrypto = sym.includes("-USD") || ["BTC","ETH","SOL","XRP","DOGE"].includes(sym);
    try { window.dispatchEvent(new CustomEvent("imynted:openDetail", { detail: { symbol: sym, asset: isCrypto ? "crypto" : "stock" } })); } catch {}
    setQ(""); setOpen(false);
  }

  return (
    <div className="relative w-[116px] mt-1 mb-1">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && q.trim()) { pick(q.trim().toUpperCase()); }
          if (e.key === "Escape") { setQ(""); setOpen(false); }
        }}
        placeholder="Symbol..."
        spellCheck={false}
        autoComplete="off"
        className="w-full h-7 rounded-sm border border-white/10 bg-white/[0.04] px-2 text-[10px] text-white/80 placeholder:text-white/25 outline-none focus:border-emerald-400/30 transition-colors"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-0.5 z-50 rounded-sm border border-white/15 bg-[rgba(4,10,18,0.98)] shadow-xl max-h-[200px] overflow-auto">
          {results.map((r, i) => (
            <button key={`${r.symbol}-${i}`} type="button"
              className="w-full flex flex-col px-2 py-1.5 hover:bg-white/[0.06] transition-colors text-left"
              onMouseDown={(e) => { e.preventDefault(); pick(r.symbol); }}>
              <span className="text-[10px] font-bold text-emerald-300">{r.symbol}</span>
              <span className="text-[9px] text-white/40 truncate">{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname() || "";
  const [logoOk, setLogoOk] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [marketsOpen, setMarketsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  // Close mobile nav on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Auto-open groups if current path belongs to them
  useEffect(() => {
    if (RESEARCH.some(r => pathname === r.href || pathname.startsWith(r.href + "/"))) {
      setResearchOpen(true);
    }
    if (MARKETS.some(r => pathname === r.href || pathname.startsWith(r.href + "/"))) {
      setMarketsOpen(true);
    }
    if (TOOLS.some(r => pathname === r.href || pathname.startsWith(r.href + "/"))) {
      setToolsOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const match = [...NAV, ...MARKETS, ...RESEARCH, ...TOOLS].find((n) => n.hotkey === e.key.toUpperCase());
      if (match) {
        e.preventDefault();
        window.location.href = match.href;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navContent = (
    <>
      {/* logo */}
      <Link href="/" className="flex items-center justify-center w-full shrink-0">
        {logoOk ? (
          <img
            src="/brand/imynted-mark-512.png"
            alt="iMYNTED"
            style={{ width: 140, height: 140 }}
            className="object-contain max-md:w-[100px] max-md:h-[100px]"
            onError={() => setLogoOk(false)}
          />
        ) : (
          <span className="text-[16px] font-bold text-emerald-400 py-4">iM</span>
        )}
      </Link>

      {/* nav */}
      <nav className="flex-1 flex flex-col items-center gap-1 pt-2">
        {NAV.map((item, idx) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const isScanner = item.href === "/scanner";
          const marketsActive = MARKETS.some(r => pathname === r.href || pathname.startsWith(r.href + "/"));
          const researchActive = RESEARCH.some(r => pathname === r.href || pathname.startsWith(r.href + "/"));

          return (
            <React.Fragment key={item.href}>
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={[
                  "relative flex items-center justify-center w-[116px] h-10 rounded-sm transition-colors gap-2",
                  active
                    ? "text-emerald-400 bg-emerald-400/[0.09]"
                    : "text-white/35 hover:text-white/65 hover:bg-white/[0.04]",
                ].join(" ")}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-emerald-400" />
                )}
                <item.icon />
                <span className="text-[11px] font-medium tracking-wide">{item.label}</span>
              </Link>
              {/* Symbol search bar — right after Dashboard */}
              {idx === 0 && <SidebarSearch />}
              {/* Markets + Research expandable groups — after Scanner */}
              {isScanner && (
                <>
                  {/* Markets group */}
                  <div className="w-[116px]">
                    <button
                      type="button"
                      onClick={() => setMarketsOpen(o => !o)}
                      className={[
                        "relative flex items-center w-full h-10 rounded-sm transition-colors gap-2 px-0 justify-center",
                        marketsActive
                          ? "text-emerald-400 bg-emerald-400/[0.09]"
                          : "text-white/35 hover:text-white/65 hover:bg-white/[0.04]",
                      ].join(" ")}
                    >
                      {marketsActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-emerald-400" />
                      )}
                      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 12 L5 7 L8 9 L11 5 L14 8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2 14h12" strokeLinecap="round" opacity="0.3" />
                        <path d="M11 2v3h3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                      </svg>
                      <span className="text-[11px] font-medium tracking-wide">Markets</span>
                      <svg
                        width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
                        style={{ transform: marketsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                      >
                        <path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {marketsOpen && (
                      <div className="flex flex-col gap-0.5 mt-0.5 pl-2">
                        {MARKETS.map(m => {
                          const mActive = pathname === m.href || pathname.startsWith(m.href + "/");
                          return (
                            <Link
                              key={m.href}
                              href={m.href}
                              onClick={() => setMobileOpen(false)}
                              className={[
                                "relative flex items-center w-full h-8 rounded-sm transition-colors gap-2 px-2",
                                mActive
                                  ? "text-emerald-400 bg-emerald-400/[0.09]"
                                  : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]",
                              ].join(" ")}
                            >
                              {mActive && (
                                <span className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-emerald-400" />
                              )}
                              <m.icon />
                              <span className="text-[10px] font-medium tracking-wide">{m.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
              {/* Research expandable group — after Scanner block */}
              {isScanner && (
                <div className="w-[116px]">
                  <button
                    type="button"
                    onClick={() => setResearchOpen(o => !o)}
                    className={[
                      "relative flex items-center w-full h-10 rounded-sm transition-colors gap-2 px-0 justify-center",
                      researchActive
                        ? "text-emerald-400 bg-emerald-400/[0.09]"
                        : "text-white/35 hover:text-white/65 hover:bg-white/[0.04]",
                    ].join(" ")}
                  >
                    {researchActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-emerald-400" />
                    )}
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="7" cy="7" r="4.5" />
                      <path d="M10.5 10.5L14 14" strokeLinecap="round" />
                      <path d="M5 7h4M7 5v4" strokeLinecap="round" opacity="0.6" />
                    </svg>
                    <span className="text-[11px] font-medium tracking-wide">Research</span>
                    <svg
                      width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
                      style={{ transform: researchOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                    >
                      <path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {researchOpen && (
                    <div className="flex flex-col gap-0.5 mt-0.5 pl-2">
                      {RESEARCH.map(r => {
                        const rActive = pathname === r.href || pathname.startsWith(r.href + "/");
                        return (
                          <Link
                            key={r.href}
                            href={r.href}
                            onClick={() => setMobileOpen(false)}
                            className={[
                              "relative flex items-center w-full h-8 rounded-sm transition-colors gap-2 px-2",
                              rActive
                                ? "text-emerald-400 bg-emerald-400/[0.09]"
                                : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]",
                            ].join(" ")}
                          >
                            {rActive && (
                              <span className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-emerald-400" />
                            )}
                            <r.icon />
                            <span className="text-[10px] font-medium tracking-wide">{r.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {/* Tools expandable group — after Research block */}
              {isScanner && (() => {
                const toolsActive = TOOLS.some(t => pathname === t.href || pathname.startsWith(t.href + "/"));
                return (
                  <div className="w-[116px]">
                    <button
                      type="button"
                      onClick={() => setToolsOpen(o => !o)}
                      className={[
                        "relative flex items-center w-full h-10 rounded-sm transition-colors gap-2 px-0 justify-center",
                        toolsActive
                          ? "text-emerald-400 bg-emerald-400/[0.09]"
                          : "text-white/35 hover:text-white/65 hover:bg-white/[0.04]",
                      ].join(" ")}
                    >
                      {toolsActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-emerald-400" />
                      )}
                      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9.5 2.5a4 4 0 0 1 0 5.66l-1.5 1.5-4.5 4.5a1 1 0 0 1-1.41-1.41l4.5-4.5 1.5-1.5A4 4 0 0 1 9.5 2.5Z" />
                        <path d="M3 13l1.5-1.5" strokeLinecap="round" opacity="0.5" />
                      </svg>
                      <span className="text-[11px] font-medium tracking-wide">Tools</span>
                      <svg
                        width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
                        style={{ transform: toolsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                      >
                        <path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {toolsOpen && (
                      <div className="flex flex-col gap-0.5 mt-0.5 pl-2">
                        {TOOLS.map(t => {
                          const tActive = pathname === t.href || pathname.startsWith(t.href + "/");
                          return (
                            <Link
                              key={t.href}
                              href={t.href}
                              onClick={() => setMobileOpen(false)}
                              className={[
                                "relative flex items-center w-full h-8 rounded-sm transition-colors gap-2 px-2",
                                tActive
                                  ? "text-emerald-400 bg-emerald-400/[0.09]"
                                  : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]",
                              ].join(" ")}
                            >
                              {tActive && (
                                <span className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-emerald-400" />
                              )}
                              <t.icon />
                              <span className="text-[10px] font-medium tracking-wide">{t.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </React.Fragment>
          );
        })}
      </nav>

      {/* status dot */}
      <div className="pb-3 flex items-center justify-center">
        <span className="block h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px rgba(52,211,153,0.7)" }} />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button — fixed top-left, only visible on small screens */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-2 left-2 z-[60] rounded-sm border border-emerald-400/20 bg-black/80 backdrop-blur-md p-2 text-emerald-400 hover:bg-emerald-400/10 transition-colors"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[58] bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile slide-out sidebar */}
      <aside
        className={[
          "md:hidden fixed top-0 left-0 bottom-0 z-[59] w-[160px] flex flex-col items-center border-r border-emerald-400/[0.07] transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        style={{ background: "#000000" }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute top-2 right-2 text-white/40 hover:text-white/80 text-[18px] transition-colors z-10"
        >×</button>
        {navContent}
      </aside>

      {/* Desktop sidebar — always visible on md+ */}
      <aside
        className="hidden md:flex w-[140px] h-full flex-col items-center border-r border-emerald-400/[0.07]"
        style={{ background: "#000000" }}
      >
        {navContent}
      </aside>
    </>
  );
}
