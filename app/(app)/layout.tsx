// app/(app)/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import ToastProvider from "@/app/components/ToastProvider";
import { SettingsProvider } from "@/app/components/SettingsContext";
import TraderPanel from "@/app/components/TraderPanelV2";
import StockDetailPanel from "@/app/components/StockDetailPanel";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type AssetType = "stock" | "crypto" | "futures";

function GlobalTraderOverlay() {
  const [open, setOpen] = useState(false);
  const [sym, setSym] = useState("AAPL");
  const [asset, setAsset] = useState<AssetType>("stock");
  const pathname = usePathname() || "";
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  useEffect(() => {
    // On dashboard, the dashboard handles its own trader overlay
    if (isDashboard) return;

    function onTrade(ev: Event) {
      const d = (ev as CustomEvent).detail || {};
      const s = String(d.symbol || d.sym || "").toUpperCase().trim();
      if (!s) return;
      const a: AssetType = d.asset === "crypto" ? "crypto" : d.asset === "futures" ? "futures" : "stock";
      setSym(s);
      setAsset(a);
      setOpen(true);
    }

    window.addEventListener("imynted:tradeAction", onTrade as EventListener);
    window.addEventListener("imynted:trade", onTrade as EventListener);
    return () => {
      window.removeEventListener("imynted:tradeAction", onTrade as EventListener);
      window.removeEventListener("imynted:trade", onTrade as EventListener);
    };
  }, [isDashboard]);

  // Don't render on dashboard — it has its own
  if (isDashboard || !open) return null;

  return (<>
    {/* Backdrop — desktop only */}
    <div className="fixed inset-0 z-[10001] hidden md:block bg-black/40 backdrop-blur-[2px]"
      onClick={() => setOpen(false)} />

    {/* Mobile: fullscreen */}
    <div className="fixed inset-0 z-[10002] md:hidden flex flex-col"
      style={{ background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)" }}>
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-emerald-400/[0.08]"
        style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.06) 0%, transparent 40%)" }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.12em] text-emerald-400/80 uppercase">iMYNTED</span>
          <span className="text-white/15">|</span>
          <span className="text-[14px] font-bold text-white">TRADER</span>
          <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/[0.07] px-1.5 py-0.5 text-[10px] font-bold text-white">{sym}</span>
        </div>
        <button type="button" onClick={() => setOpen(false)}
          className="rounded-sm border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold text-white/70 hover:bg-white/10 transition-colors">
          ✕ CLOSE
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-2">
        <TraderPanel symbol={sym} asset={asset} />
      </div>
    </div>

    {/* Desktop: floating popup */}
    <div className="fixed z-[10002] hidden md:flex flex-col rounded-sm border border-emerald-400/15 overflow-hidden"
      style={{
        top: "60px", left: "50%", transform: "translateX(-50%)",
        width: "480px", maxHeight: "calc(100vh - 80px)",
        background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)",
        boxShadow: "0 0 0 1px rgba(52,211,153,0.08), 0 25px 60px rgba(0,0,0,0.7), 0 0 40px rgba(52,211,153,0.04)",
      }}>
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-emerald-400/[0.08]"
        style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.06) 0%, transparent 40%)" }}>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold tracking-[0.12em] text-emerald-400/70 uppercase">iMYNTED</span>
          <span className="text-white/15">|</span>
          <span className="text-[13px] font-bold text-white">TRADER</span>
          <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/[0.07] px-1.5 py-0.5 text-[10px] font-bold text-white">{sym}</span>
        </div>
        <button type="button" onClick={() => setOpen(false)}
          className="rounded-sm border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-white/60 hover:bg-white/10 transition-colors">
          ✕
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <TraderPanel symbol={sym} asset={asset} />
      </div>
    </div>
  </>);
}

function GlobalDetailOverlay() {
  const [sym, setSym] = useState<string | null>(null);
  const [asset, setAsset] = useState<"stock" | "crypto">("stock");
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname() || "";
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isScanner = pathname === "/scanner" || pathname.startsWith("/scanner/");

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  useEffect(() => {
    // Dashboard and scanner manage their own StockDetailPanel; skip on mobile entirely
    if (isDashboard || isScanner || isMobile) return;

    function onDetail(ev: Event) {
      const d = (ev as CustomEvent).detail || {};
      const s = String(d.symbol || d.sym || "").toUpperCase().trim();
      if (!s) return;
      const a = d.asset === "crypto" ? "crypto" as const : "stock" as const;
      setSym(s);
      setAsset(a);
    }

    window.addEventListener("imynted:openDetail", onDetail as EventListener);
    return () => window.removeEventListener("imynted:openDetail", onDetail as EventListener);
  }, [isDashboard, isScanner, isMobile]);

  if (isDashboard || isScanner || isMobile || !sym) return null;

  return <StockDetailPanel symbol={sym} asset={asset} onClose={() => setSym(null)} />;
}

function LegalFooter() {
  return (
    <footer className="shrink-0 border-t border-emerald-400/[0.06] px-4 md:px-6 py-6 mt-8"
      style={{ background: "linear-gradient(180deg, rgba(4,10,18,0.95) 0%, rgba(2,6,12,0.98) 100%)" }}>
      <div className="max-w-4xl mx-auto space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.14em] text-emerald-400/60 uppercase">iMYNTED</span>
          <span className="text-white/10">|</span>
          <span className="text-[10px] text-white/25">Market Analytics Platform</span>
        </div>
        <p className="text-[10px] leading-relaxed text-white/30">
          &copy; 2026 iMYNTED Inc. All rights reserved. iMYNTED&trade; and iMYNTED Terminal&trade; are trademarks of iMYNTED Inc.
        </p>
        <p className="text-[10px] leading-relaxed text-white/25">
          iMYNTED provides market analytics and informational content for educational purposes only. We are not registered investment advisors, broker-dealers, or fiduciaries. Trading involves substantial risk, including the potential loss of capital. Past performance does not guarantee future results.
        </p>
        <p className="text-[10px] leading-relaxed text-white/25">
          Use of this platform constitutes acceptance of our{" "}
          <a href="/terms" className="text-emerald-400/50 hover:text-emerald-400/80 transition-colors">Terms of Service</a>
          {" "}and{" "}
          <a href="/risk-disclosure" className="text-emerald-400/50 hover:text-emerald-400/80 transition-colors">Risk Disclosure</a>.
        </p>
        <div className="flex items-center gap-3 pt-1">
          <a href="/terms" className="text-[9px] text-white/20 hover:text-white/40 transition-colors">Terms of Service</a>
          <a href="/risk-disclosure" className="text-[9px] text-white/20 hover:text-white/40 transition-colors">Risk Disclosure</a>
          <a href="/privacy" className="text-[9px] text-white/20 hover:text-white/40 transition-colors">Privacy Policy</a>
        </div>
      </div>
    </footer>
  );
}

const TOP_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/scanner",   label: "Scanner"   },
  { href: "/options",   label: "Options"   },
  { href: "/futures",   label: "Futures"   },
  { href: "/accounts",  label: "Accounts"  },
  { href: "/settings",  label: "Settings"  },
] as const;

function pageLabel(pathname: string) {
  const match = [...TOP_NAV].find(n => pathname === n.href || pathname.startsWith(n.href + "/"));
  if (match) return match.label;
  const seg = pathname.split("/").filter(Boolean).pop() || "";
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  return (
    <SettingsProvider>
    <ToastProvider>
    <div
      className={cn(
        // ✅ terminal must be a fixed viewport (prevents panels collapsing/short)
        "h-screen overflow-hidden text-white",
        // hard lock terminal dark — no theme token drift
        "bg-black"
      )}
    >
      {/* ✅ CLEANER shell background texture (reduced glow vs previous) */}
      <div
        className={cn(
          "h-full",
          // one subtle vignette + one very faint top glow (much cleaner than before)
          ""
        )}
      >
        {/* outer frame */}
        <div className="h-full flex overflow-hidden">
          {/* Sidebar column — Sidebar handles its own mobile/desktop rendering */}
          <Sidebar />

          {/* Main column */}
          <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
            {/* Top nav bar: HIDE on /dashboard, SHOW everywhere else */}
            {!isDashboard ? (
              <div className="shrink-0 border-b border-emerald-400/[0.08] bg-black/60 backdrop-blur-sm"
                style={{ background: "linear-gradient(90deg, rgba(4,10,18,0.98) 0%, rgba(2,6,12,0.99) 100%)" }}>
                <div className="flex items-center gap-0 h-11 px-3">
                  {/* Spacer for mobile hamburger */}
                  <div className="w-9 shrink-0 md:hidden" />

                  {/* Page title — mobile */}
                  <span className="md:hidden text-[12px] font-bold text-white/80 tracking-wide mr-3">
                    {pageLabel(pathname)}
                  </span>

                  {/* Nav links — scrollable row on mobile */}
                  <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0">
                    {TOP_NAV.map(n => {
                      const active = pathname === n.href || pathname.startsWith(n.href + "/");
                      return (
                        <a
                          key={n.href}
                          href={n.href}
                          className={cn(
                            "shrink-0 px-3 py-1.5 rounded-sm text-[11px] font-semibold tracking-wide transition-colors whitespace-nowrap",
                            active
                              ? "bg-emerald-400/[0.12] text-emerald-400 border border-emerald-400/20"
                              : "text-white/35 hover:text-white/70 hover:bg-white/[0.05]"
                          )}
                        >
                          {n.label}
                        </a>
                      );
                    })}
                  </div>

                  {/* Live dot */}
                  <div className="shrink-0 ml-2 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                      style={{ boxShadow: "0 0 5px rgba(52,211,153,0.7)" }} />
                    <span className="hidden md:inline text-[10px] text-emerald-400/60 font-semibold tracking-wider uppercase">Live</span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Content viewport */}
            <main className="flex-1 min-h-0 min-w-0 overflow-hidden">
              {isDashboard ? (
                <div className="h-full min-h-0 min-w-0 overflow-hidden">{children}</div>
              ) : (
                <div className="h-full min-h-0 min-w-0 overflow-y-auto">
                  {children}
                  <LegalFooter />
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
    <GlobalTraderOverlay />
    <GlobalDetailOverlay />
    </ToastProvider>
    </SettingsProvider>
  );
}
