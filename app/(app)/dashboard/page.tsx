"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import NewsFeed from "@/app/components/NewsFeed";
import ScannerPanel from "@/app/components/ScannerPanel";
import HaltsFeed from "@/app/components/HaltsFeed";
import { MarketDepthPanel } from "@/app/components/MarketDepthPanel";
import TapePanel from "@/app/components/TapePanel";
import PositionsPanel from "@/app/components/PositionsPanel";
import CryptoMoversPanel from "@/app/components/CryptoMoversPanel";
import SymbolHeader from "@/app/components/SymbolHeader";
import ChartPanel from "../../components/ChartPanel";
import TraderPanel from "@/app/components/TraderPanelV2";
import StockDetailPanel from "@/app/components/StockDetailPanel";

type Workspace = "full" | "news" | "l2" | "tape" | "trader";
type AssetType = "stock" | "crypto";
type MobilePanel = "chart" | "l2" | "tape" | "scan" | "positions" | "news";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function useLocalStorageState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(key);
      if (s !== null) setValue(JSON.parse(s) as T);
    } catch {}
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value, ready]);

  return [value, setValue, ready] as const;
}

function Card({
  title,
  children,
  right,
  className,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "h-full min-h-0 rounded-2xl border border-white/10 bg-background flex flex-col overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="text-sm font-semibold">{title}</div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      {/* ✅ IMPORTANT: the card body must hide overflow; children will scroll */}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

/** ----------------------------- Symbol logic ----------------------------- */
function isCryptoBase(raw: string) {
  const s = (raw || "").toUpperCase().trim();
  if (!s) return false;
  if (s.includes("-USD")) return true;
  return ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "BNB", "MATIC"].includes(s);
}

function normalizeSymbol(asset: AssetType, raw: string) {
  const s = (raw || "").toUpperCase().trim();
  if (!s) return asset === "crypto" ? "BTC-USD" : "AAPL";

  if (asset === "crypto") {
    // Trust the asset type — append -USD if needed, don't reject unknown symbols
    if (s.includes("-")) return s;
    if (s.endsWith("USD")) return s.replace(/USD$/, "-USD");
    return `${s}-USD`;
  }

  // stock
  if (s.includes("-")) return "AAPL";
  return s.replace("-USD", "");
}

function detectAssetFromInput(raw: string): AssetType | null {
  const s = (raw || "").toUpperCase().trim();
  if (!s) return null;
  if (s.includes("-USD")) return "crypto";
  if (isCryptoBase(s)) return "crypto";
  if (/^[A-Z.\-]{1,15}$/.test(s)) return "stock";
  return null;
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

/* ── Drag handle for resizing panels ── */
function DragHandle({ onDrag }: { onDrag: (deltaY: number) => void }) {
  const dragging = useRef(false);
  const lastY = useRef(0);

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragging.current) return;
      const y = "touches" in e ? e.touches[0].clientY : e.clientY;
      const delta = y - lastY.current;
      lastY.current = y;
      onDrag(delta);
    }
    function onUp() { dragging.current = false; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [onDrag]);

  return (
    <div
      className="shrink-0 h-2 flex items-center justify-center cursor-row-resize group hover:bg-emerald-400/10 rounded-sm transition-colors"
      onMouseDown={(e) => { dragging.current = true; lastY.current = e.clientY; e.preventDefault(); }}
      onTouchStart={(e) => { dragging.current = true; lastY.current = e.touches[0].clientY; }}
    >
      <div className="w-8 h-[2px] rounded-full bg-white/10 group-hover:bg-emerald-400/40 transition-colors" />
    </div>
  );
}

function isTypingTarget(el: EventTarget | null) {
  if (!el || !(el as HTMLElement).tagName) return false;
  const t = (el as HTMLElement).tagName.toLowerCase();
  if (t === "input" || t === "textarea" || t === "select") return true;
  const he = el as HTMLElement;
  return Boolean(he.isContentEditable);
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [ws, setWs, wsReady] = useLocalStorageState<Workspace>("msa_ws", "full");
  const [asset, setAsset, assetReady] = useLocalStorageState<AssetType>("msa_asset", "stock");

  const [stockSymbol, setStockSymbol, stockReady] = useLocalStorageState<string>("msa_stock_symbol", "AAPL");
  const [cryptoSymbol, setCryptoSymbol, cryptoReady] = useLocalStorageState<string>("msa_crypto_symbol", "BTC-USD");

  const [panels, setPanels, panelsReady] = useLocalStorageState<Record<string, boolean>>("msa_panels", {
    news: true,
    scanners: true,
    halts: true,
    l2: true,
    tape: true,
    positions: true,
  });

  const [cmd, setCmd] = useState("");
  const cmdRef = useRef<HTMLInputElement | null>(null);
  const [searchResults, setSearchResults] = useState<{ symbol: string; name: string; type: string }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimer = useRef<any>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("chart");
  const [traderOpen, setTraderOpen] = useState(false);
  const [traderSym, setTraderSym] = useState("AAPL");
  const [traderAsset, setTraderAsset] = useState<AssetType>("stock");
  const [detailSym, setDetailSym] = useState<string | null>(null);
  const [detailAsset, setDetailAsset] = useState<"stock" | "crypto">("stock");
  const [topPct, setTopPct] = useState(35); // % of left column for top panel
  const [posPct, setPosPct] = useState(60); // % of bottom-left for positions vs crypto movers
  const [midPct, setMidPct] = useState(50); // % of middle column for chart vs news
  const [rightPct, setRightPct] = useState(55); // % of right column for L2 vs tape
  const leftColRef = useRef<HTMLDivElement | null>(null);
  const midColRef = useRef<HTMLDivElement | null>(null);
  const rightColRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const legacyRaw = localStorage.getItem("msa_symbol");
      if (!legacyRaw) return;

      const legacy = JSON.parse(legacyRaw) as string;
      const v = (legacy || "").toUpperCase().trim();
      if (!v) return;

      const curStock = (localStorage.getItem("msa_stock_symbol") || "").trim();
      const curCrypto = (localStorage.getItem("msa_crypto_symbol") || "").trim();

      if ((!curCrypto || curCrypto === "null") && (v.includes("-USD") || isCryptoBase(v))) {
        setCryptoSymbol(normalizeSymbol("crypto", v));
      }
      if ((!curStock || curStock === "null") && !v.includes("-") && !isCryptoBase(v)) {
        setStockSymbol(normalizeSymbol("stock", v));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = mounted && wsReady && panelsReady && assetReady && stockReady && cryptoReady;

  const sym = useMemo(() => {
    return asset === "crypto" ? normalizeSymbol("crypto", cryptoSymbol) : normalizeSymbol("stock", stockSymbol);
  }, [asset, cryptoSymbol, stockSymbol]);

  const stockSym = useMemo(() => normalizeSymbol("stock", stockSymbol), [stockSymbol]);
  const cryptoSym = useMemo(() => normalizeSymbol("crypto", cryptoSymbol), [cryptoSymbol]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;

      if (e.key === "F1") { e.preventDefault(); setWs("full"); }
      if (e.key === "F2") { e.preventDefault(); setWs("news"); }
      if (e.key === "F3") { e.preventDefault(); setWs("l2"); }
      if (e.key === "F4") { e.preventDefault(); setWs("tape"); }
      if (e.key === "F5") { e.preventDefault(); setWs("trader"); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        cmdRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey as any);
  }, [setWs]);

  // Listen for trade + detail events on dashboard
  useEffect(() => {
    function onTrade(ev: Event) {
      const d = (ev as CustomEvent).detail || {};
      const s = String(d.symbol || d.sym || "").toUpperCase().trim();
      if (!s) return;
      const a: AssetType = d.asset === "crypto" ? "crypto" : "stock";
      setTraderSym(s);
      setTraderAsset(a);
      setTraderOpen(true);
    }
    function onDetail(ev: Event) {
      const d = (ev as CustomEvent).detail || {};
      const s = String(d.symbol || d.sym || "").toUpperCase().trim();
      if (!s) return;
      setDetailSym(s);
      setDetailAsset(d.asset === "crypto" ? "crypto" : "stock");
    }
    window.addEventListener("imynted:tradeAction", onTrade as EventListener);
    window.addEventListener("imynted:trade", onTrade as EventListener);
    window.addEventListener("imynted:openDetail", onDetail as EventListener);
    return () => {
      window.removeEventListener("imynted:tradeAction", onTrade as EventListener);
      window.removeEventListener("imynted:trade", onTrade as EventListener);
      window.removeEventListener("imynted:openDetail", onDetail as EventListener);
    };
  }, []);

  function setPanel(key: string, on: boolean) {
    setPanels((p) => ({ ...p, [key]: on }));
  }

  function setActiveSymbol(next: string) {
    const raw = (next || "").toUpperCase().trim();
    if (!raw) return;

    if (asset === "crypto") setCryptoSymbol(normalizeSymbol("crypto", raw));
    else setStockSymbol(normalizeSymbol("stock", raw));
  }

  // Debounced symbol search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = cmd.trim();
    if (!q || q.length < 1 || q.includes(" ")) { setSearchResults([]); setSearchOpen(false); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`);
        const j = await res.json();
        if (j?.ok && Array.isArray(j.results)) {
          setSearchResults(j.results);
          setSearchOpen(j.results.length > 0);
        }
      } catch { setSearchResults([]); }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [cmd]);

  function submitCommandOrSymbol(input: string) {
    const s = (input || "").trim();
    if (!s) return;

    const parts = s.split(/\s+/);
    const head = parts[0].toLowerCase();
    const arg1 = parts[1]?.toLowerCase();

    if (head === "ws" && arg1) {
      if (["full", "news", "l2", "tape", "trader"].includes(arg1)) setWs(arg1 as Workspace);
      return;
    }

    if (head === "asset" && (arg1 === "stock" || arg1 === "crypto")) {
      setAsset(arg1 as AssetType);
      return;
    }

    if (head === "crypto") {
      setAsset("crypto");
      setCryptoSymbol(parts[1] ? normalizeSymbol("crypto", parts[1]) : "BTC-USD");
      return;
    }

    if (head === "stock") {
      setAsset("stock");
      setStockSymbol(parts[1] ? normalizeSymbol("stock", parts[1]) : "AAPL");
      return;
    }

    if (["news", "scanners", "halts", "l2", "tape", "positions"].includes(head) && (arg1 === "on" || arg1 === "off")) {
      setPanel(head, arg1 === "on");
      return;
    }

    if ((head === "sym" || head === "symbol") && parts[1]) {
      const guess = detectAssetFromInput(parts[1]);
      if (guess === "crypto") {
        setAsset("crypto");
        setCryptoSymbol(normalizeSymbol("crypto", parts[1]));
      } else {
        setAsset("stock");
        setStockSymbol(normalizeSymbol("stock", parts[1]));
      }
      return;
    }

    const guess = detectAssetFromInput(parts[0]);
    if (guess === "crypto") { setAsset("crypto"); setCryptoSymbol(normalizeSymbol("crypto", parts[0])); return; }
    if (guess === "stock") { setAsset("stock"); setStockSymbol(normalizeSymbol("stock", parts[0])); return; }
  }

  const show = {
    news: panels.news && (ws === "full" || ws === "news" || ws === "trader"),
    scanners: panels.scanners && asset === "stock" && (ws === "full" || ws === "news" || ws === "l2" || ws === "tape" || ws === "trader"),
    halts: panels.halts && asset === "stock" && (ws === "full" || ws === "news" || ws === "trader"),
    l2: panels.l2 && (ws === "full" || ws === "l2" || ws === "trader"),
    tape: panels.tape && (ws === "full" || ws === "tape" || ws === "trader"),
    positions: panels.positions && (ws === "full" || ws === "trader"),
  };

  if (!ready) return <div className="h-[calc(100vh-64px)] min-h-0 p-3" />;

  return (
    <div className="h-[calc(100vh-64px)] min-h-0 p-3 flex flex-col gap-3">
      {/* ── MOBILE HEADER ── */}
      <div className="md:hidden shrink-0 rounded-lg border border-emerald-400/[0.08] px-3 py-2"
        style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.06) 0%, rgba(4,10,18,0.96) 40%)" }}>
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-bold tracking-[0.1em] text-emerald-400/90 shrink-0">iMYNTED</span>
            <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/[0.07] px-1.5 py-0.5 text-[11px] font-bold text-white shrink-0">{sym}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setAsset("stock")}
              className={cn("rounded-sm border px-2 py-0.5 text-[9px] font-bold transition-colors",
                asset === "stock" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.03] text-white/35"
              )}>STK</button>
            <button type="button" onClick={() => setAsset("crypto")}
              className={cn("rounded-sm border px-2 py-0.5 text-[9px] font-bold transition-colors",
                asset === "crypto" ? "border-amber-400/25 bg-amber-400/10 text-amber-300" : "border-white/10 bg-white/[0.03] text-white/35"
              )}>CRY</button>
          </div>
        </div>
        <input
          value={cmd} onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); submitCommandOrSymbol(cmd); setCmd(""); }
            if (e.key === "Escape") { e.preventDefault(); setCmd(""); }
          }}
          autoComplete="off" spellCheck={false}
          placeholder="Type symbol: TSLA, BTC, NVDA..."
          className="mt-1.5 h-8 w-full rounded-sm border border-white/10 bg-black/30 px-3 text-[12px] text-white outline-none placeholder:text-white/30 focus:border-emerald-400/30"
        />
      </div>

      {/* ── DESKTOP COMMAND BAR ── */}
      <div className="shrink-0 hidden md:flex flex-col gap-2 relative z-50 pointer-events-auto">
        {/* ... unchanged command bar ... */}
        {/* (kept identical to your version to avoid breaking anything) */}
        {/* --- START --- */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-background px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">iMynted</span>
            <span className="text-white/20">•</span>
            <Pill label="WS" value={ws.toUpperCase()} />
            <Pill label="MODE" value={asset.toUpperCase()} />
            <Pill label="STK" value={stockSym} />
            <Pill label="CRY" value={cryptoSym} />
            <Pill label="ACTIVE" value={sym} />
            <span className="ml-2 text-[11px] text-muted-foreground">Ctrl/⌘K focus • Enter submit</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAsset("stock")}
              className={cn("h-9 rounded-xl border border-white/10 px-3 text-xs hover:bg-muted", asset === "stock" ? "bg-muted" : "")}
            >
              STOCK
            </button>
            <button
              onClick={() => setAsset("crypto")}
              className={cn("h-9 rounded-xl border border-white/10 px-3 text-xs hover:bg-muted", asset === "crypto" ? "bg-muted" : "")}
            >
              CRYPTO
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[320px]">
            <input
              ref={cmdRef}
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onMouseDown={() => cmdRef.current?.focus()}
              onFocus={() => setSearchOpen(searchResults.length > 0)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitCommandOrSymbol(cmd);
                  setCmd("");
                  setSearchOpen(false);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setCmd("");
                  setSearchOpen(false);
                  cmdRef.current?.blur();
                }
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder='Type: TSLA / BTC / BTC-USD • or: "ws l2", "news off"'
              className={cn(
                "h-10 w-full rounded-2xl border border-white/10",
                "bg-black/35 text-white caret-white placeholder:text-white/40",
                "px-4 text-sm outline-none focus:ring-2 focus:ring-white/20"
              )}
            />
            {/* Search suggestions dropdown */}
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-white/15 bg-[rgba(4,10,18,0.98)] shadow-xl max-h-[300px] overflow-auto">
                {searchResults.map((r) => (
                  <button
                    key={r.symbol}
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/[0.06] transition-colors text-left"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      submitCommandOrSymbol(r.symbol);
                      setCmd("");
                      setSearchOpen(false);
                    }}
                  >
                    <span className="text-[12px] font-bold text-emerald-300 w-[60px] shrink-0">{r.symbol}</span>
                    <span className="text-[11px] text-white/60 truncate flex-1">{r.name}</span>
                    <span className="text-[9px] text-white/25 shrink-0">{r.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: "AAPL", v: "AAPL" },
              { label: "TSLA", v: "TSLA" },
              { label: "SPY", v: "SPY" },
              { label: "BTC", v: "BTC" },
              { label: "ETH", v: "ETH" },
            ].map((x) => (
              <button
                key={x.label}
                onClick={() => submitCommandOrSymbol(x.v)}
                className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs hover:bg-white/10"
              >
                {x.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["news", "halts", "scanners", "l2", "tape", "positions"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setPanel(k, !panels[k])}
                className={cn(
                  "h-10 rounded-2xl border border-white/10 px-3 text-xs hover:bg-muted",
                  panels[k] ? "bg-muted" : "bg-white/5"
                )}
              >
                {k.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {/* --- END --- */}
      </div>

      {/* SYMBOL HEADER — desktop only */}
      <div className="shrink-0 hidden md:block">
        <SymbolHeader symbol={sym} intervalMs={2500} />
      </div>

      {/* ── MOBILE: single-panel view with bottom tabs ── */}
      <div className="flex-1 min-h-0 flex flex-col md:hidden overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto">
          {mobilePanel === "chart" && (
            <div className="h-full min-h-0 p-1">
              <Card title={`Chart — ${sym}`} className="h-full min-h-[400px]">
                <ChartPanel symbol={sym} asset={asset} className="h-full min-h-0" />
              </Card>
            </div>
          )}
          {mobilePanel === "l2" && (
            <div className="h-full min-h-0 p-1">
              <Card title={`${asset === "crypto" ? "Order Book" : "Level 2"} — ${sym}`} className="h-full min-h-[500px]">
                <MarketDepthPanel symbol={sym} asset={asset} />
              </Card>
            </div>
          )}
          {mobilePanel === "tape" && (
            <div className="h-full min-h-0 p-1">
              <Card title={`Tape — ${sym}`} className="h-full min-h-[500px]">
                <TapePanel symbol={sym} asset={asset} />
              </Card>
            </div>
          )}
          {mobilePanel === "scan" && (
            <div className="h-full min-h-0 p-1">
              <Card title="Scanners" className="h-full min-h-[400px]">
                <ScannerPanel symbol={stockSym} onPickSymbol={setActiveSymbol} className="h-full min-h-0" />
              </Card>
            </div>
          )}
          {mobilePanel === "positions" && (
            <div className="h-full min-h-0 p-1">
              <Card title="Positions" className="h-full min-h-[400px]">
                <div className="h-full min-h-0 overflow-auto">
                  <PositionsPanel refreshMs={2500} onPick={(a: AssetType, s: string) => {
                    if (a === "crypto") { setAsset("crypto"); setCryptoSymbol(normalizeSymbol("crypto", s)); }
                    else { setAsset("stock"); setStockSymbol(normalizeSymbol("stock", s)); }
                  }} />
                </div>
              </Card>
            </div>
          )}
          {mobilePanel === "news" && (
            <div className="h-full min-h-0 p-1">
              <Card title={`News — ${sym}`} className="h-full min-h-[500px]">
                <NewsFeed symbol={sym} asset={asset} />
              </Card>
            </div>
          )}
        </div>

        {/* Mobile bottom tab bar */}
        <div className="shrink-0 border-t border-emerald-400/[0.12] flex items-center justify-around"
          style={{ background: "linear-gradient(180deg, rgba(4,10,18,0.98) 0%, rgba(2,6,12,0.99) 100%)", paddingBottom: "env(safe-area-inset-bottom, 4px)" }}>
          {([
            { id: "scan" as MobilePanel, label: "Scan" },
            { id: "chart" as MobilePanel, label: "Chart" },
            { id: "l2" as MobilePanel, label: "L2" },
            { id: "tape" as MobilePanel, label: "Tape" },
            { id: "positions" as MobilePanel, label: "Pos" },
            { id: "news" as MobilePanel, label: "News" },
          ]).map(tab => (
            <button key={tab.id} type="button" onClick={() => setMobilePanel(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2.5 min-w-0 flex-1 transition-colors relative",
                mobilePanel === tab.id ? "text-emerald-400" : "text-white/35"
              )}>
              {mobilePanel === tab.id && <div className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-emerald-400 rounded-full" />}
              <span className="text-[10px] font-bold uppercase tracking-wider leading-none">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── DESKTOP: original grid layout ── */}
      <div className="flex-1 min-h-0 hidden md:grid grid-cols-12 gap-3">
        {/* LEFT COLUMN — resizable */}
        <div ref={leftColRef} className="col-span-12 lg:col-span-4 min-h-0 flex flex-col overflow-hidden pr-1">
          {/* Top section — only render when scanners or halts are visible */}
          {(show.scanners || show.halts) && (
            <>
              <div className="min-h-[120px] overflow-hidden" style={{ flex: `${topPct} 1 0%` }}>
                {show.scanners ? (
                  <Card title="Scanners" className="h-full min-h-0">
                    <ScannerPanel symbol={sym} onPickSymbol={setActiveSymbol} className="h-full min-h-0" />
                  </Card>
                ) : show.halts ? (
                  <Card title="Halts" className="h-full min-h-0">
                    <div className="h-full min-h-0">
                      <HaltsFeed onPickSymbol={setActiveSymbol} pollMs={60_000} />
                    </div>
                  </Card>
                ) : null}
              </div>

              {/* Drag handle */}
              <DragHandle onDrag={(dy) => {
                const el = leftColRef.current;
                if (!el) return;
                const h = el.getBoundingClientRect().height;
                if (h <= 0) return;
                setTopPct((prev) => Math.max(15, Math.min(85, prev + (dy / h) * 100)));
              }} />
            </>
          )}

          {/* Bottom section — Positions + Crypto Movers (resizable) */}
          <div className="min-h-[120px] overflow-hidden flex flex-col" style={{ flex: (show.scanners || show.halts) ? `${100 - topPct} 1 0%` : "1 1 0%" }}>
            {show.positions && (
              <div className="min-h-[80px] overflow-hidden" style={{ flex: asset === "crypto" && (ws === "full" || ws === "trader") ? `${posPct} 1 0%` : "1 1 0%" }}>
                <Card title="Positions" className="h-full min-h-0">
                  <div className="h-full min-h-0 overflow-auto">
                    <PositionsPanel
                      refreshMs={2500}
                      onPick={(a, s) => {
                        if (a === "crypto") {
                          setAsset("crypto");
                          setCryptoSymbol(normalizeSymbol("crypto", s));
                        } else {
                          setAsset("stock");
                          setStockSymbol(normalizeSymbol("stock", s));
                        }
                      }}
                    />
                  </div>
                </Card>
              </div>
            )}

            {asset === "crypto" && (ws === "full" || ws === "trader") && (
              <>
                <DragHandle onDrag={(dy) => {
                  const el = leftColRef.current;
                  if (!el) return;
                  const h = el.getBoundingClientRect().height * ((100 - topPct) / 100);
                  if (h <= 0) return;
                  setPosPct((prev) => Math.max(20, Math.min(80, prev + (dy / h) * 100)));
                }} />
                <div className="min-h-[80px] overflow-hidden" style={{ flex: `${100 - posPct} 1 0%` }}>
                  <Card
                    title="Crypto Movers"
                    className="h-full min-h-0"
                    right={<div className="text-[11px] text-muted-foreground">Top movers (24h)</div>}
                  >
                    <CryptoMoversPanel refreshMs={60_000} onPickSymbol={(s) => setCryptoSymbol(normalizeSymbol("crypto", s))} />
                  </Card>
                </div>
              </>
            )}
          </div>
        </div>

        {/* MIDDLE — resizable chart / news */}
        <div ref={midColRef} className="col-span-12 lg:col-span-4 min-h-0 flex flex-col overflow-hidden">
          <div className="min-h-[120px] overflow-hidden" style={{ flex: `${midPct} 1 0%` }}>
            <Card title={`Chart — ${sym}`} className="h-full min-h-0">
              <ChartPanel symbol={sym} asset={asset} className="h-full min-h-0" />
            </Card>
          </div>

          {show.news && (<>
            <DragHandle onDrag={(dy) => {
              const el = midColRef.current;
              if (!el) return;
              const h = el.getBoundingClientRect().height;
              if (h <= 0) return;
              setMidPct((prev) => Math.max(15, Math.min(85, prev + (dy / h) * 100)));
            }} />
            <div className="min-h-[120px] overflow-hidden" style={{ flex: `${100 - midPct} 1 0%` }}>
              <Card title={`News — ${sym}`} className="h-full min-h-0">
                <NewsFeed symbol={sym} asset={asset} />
              </Card>
            </div>
          </>)}
        </div>

        {/* RIGHT — resizable L2 / tape */}
        <div ref={rightColRef} className="col-span-12 lg:col-span-4 min-h-0 flex flex-col overflow-hidden">
          {show.l2 && (
            <div className="min-h-[120px] overflow-hidden" style={{ flex: `${rightPct} 1 0%` }}>
              <Card title={`${asset === "crypto" ? "Order Book" : "Level 2"} — ${sym}`} className="h-full min-h-0">
                <MarketDepthPanel symbol={sym} asset={asset} />
              </Card>
            </div>
          )}

          {show.l2 && show.tape && (
            <DragHandle onDrag={(dy) => {
              const el = rightColRef.current;
              if (!el) return;
              const h = el.getBoundingClientRect().height;
              if (h <= 0) return;
              setRightPct((prev) => Math.max(15, Math.min(85, prev + (dy / h) * 100)));
            }} />
          )}

          {show.tape && (
            <div className="min-h-[120px] overflow-hidden" style={{ flex: `${100 - rightPct} 1 0%` }}>
              <Card title={`Tape — ${sym}`} className="h-full min-h-0">
                <TapePanel symbol={sym} asset={asset} />
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ── Trader overlay ── */}
      {traderOpen && (<>
        <div className="fixed inset-0 z-[10001] hidden md:block bg-black/40 backdrop-blur-[2px]"
          onClick={() => setTraderOpen(false)} />
        {/* Mobile: fullscreen */}
        <div className="fixed inset-0 z-[10002] md:hidden flex flex-col"
          style={{ background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)" }}>
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-emerald-400/[0.08]"
            style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.06) 0%, transparent 40%)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-[0.12em] text-emerald-400/80 uppercase">iMYNTED</span>
              <span className="text-white/15">|</span>
              <span className="text-[14px] font-bold text-white">TRADER</span>
              <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/[0.07] px-1.5 py-0.5 text-[10px] font-bold text-white">{traderSym}</span>
            </div>
            <button type="button" onClick={() => setTraderOpen(false)}
              className="rounded-sm border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold text-white/70">✕ CLOSE</button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-2">
            <TraderPanel symbol={traderSym} asset={traderAsset} />
          </div>
        </div>
        {/* Desktop: floating popup */}
        <div className="fixed z-[10002] hidden md:flex flex-col rounded-sm border border-emerald-400/15 overflow-hidden"
          style={{ top: "60px", left: "50%", transform: "translateX(-50%)", width: "480px", maxHeight: "calc(100vh - 80px)",
            background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)",
            boxShadow: "0 0 0 1px rgba(52,211,153,0.08), 0 25px 60px rgba(0,0,0,0.7)" }}>
          <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-emerald-400/[0.08]"
            style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.06) 0%, transparent 40%)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold tracking-[0.12em] text-emerald-400/70 uppercase">iMYNTED</span>
              <span className="text-white/15">|</span>
              <span className="text-[13px] font-bold text-white">TRADER</span>
              <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/[0.07] px-1.5 py-0.5 text-[10px] font-bold text-white">{traderSym}</span>
            </div>
            <button type="button" onClick={() => setTraderOpen(false)}
              className="rounded-sm border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-white/60">✕</button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <TraderPanel symbol={traderSym} asset={traderAsset} />
          </div>
        </div>
      </>)}

      {/* ── Detail overlay ── */}
      {detailSym && (
        <StockDetailPanel symbol={detailSym} asset={detailAsset} onClose={() => setDetailSym(null)} />
      )}
    </div>
  );
}
