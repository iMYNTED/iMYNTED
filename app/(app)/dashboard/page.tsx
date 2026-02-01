"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import NewsFeed from "@/app/components/NewsFeed";
import ScannerPanel from "@/app/components/ScannerPanel";
import HaltsFeed from "@/app/components/HaltsFeed";
import { MarketDepthPanel } from "@/app/components/MarketDepthPanel";
import TapePanel from "@/app/components/TapePanel";
import PositionsPanel from "@/app/components/PositionsPanel";
import CryptoMoversPanel from "@/app/components/CryptoMoversPanel";

type Workspace = "full" | "news" | "l2" | "tape" | "trader";
type AssetType = "stock" | "crypto";

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
      <div className="min-h-0 flex-1">{children}</div>
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
    if (!isCryptoBase(s)) return "BTC-USD";
    return s.includes("-") ? s : `${s}-USD`;
  }

  // stock
  if (s.includes("-")) return "AAPL"; // don't convert BTC-USD into BTC stock
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

  // ✅ SAFE MIGRATION from legacy single symbol key, if present
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

  /** ----------------------------- Hotkeys ----------------------------- */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;

      if (e.key === "F1") {
        e.preventDefault();
        setWs("full");
      }
      if (e.key === "F2") {
        e.preventDefault();
        setWs("news");
      }
      if (e.key === "F3") {
        e.preventDefault();
        setWs("l2");
      }
      if (e.key === "F4") {
        e.preventDefault();
        setWs("tape");
      }
      if (e.key === "F5") {
        e.preventDefault();
        setWs("trader");
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        cmdRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey as any);
  }, [setWs]);

  function setPanel(key: string, on: boolean) {
    setPanels((p) => ({ ...p, [key]: on }));
  }

  function setActiveSymbol(next: string) {
    const raw = (next || "").toUpperCase().trim();
    if (!raw) return;

    if (asset === "crypto") setCryptoSymbol(normalizeSymbol("crypto", raw));
    else setStockSymbol(normalizeSymbol("stock", raw));
  }

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
      if (parts[1]) setCryptoSymbol(normalizeSymbol("crypto", parts[1]));
      else setCryptoSymbol("BTC-USD");
      return;
    }

    if (head === "stock") {
      setAsset("stock");
      if (parts[1]) setStockSymbol(normalizeSymbol("stock", parts[1]));
      else setStockSymbol("AAPL");
      return;
    }

    if (
      ["news", "scanners", "halts", "l2", "tape", "positions"].includes(head) &&
      (arg1 === "on" || arg1 === "off")
    ) {
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
    if (guess === "crypto") {
      setAsset("crypto");
      setCryptoSymbol(normalizeSymbol("crypto", parts[0]));
      return;
    }
    if (guess === "stock") {
      setAsset("stock");
      setStockSymbol(normalizeSymbol("stock", parts[0]));
      return;
    }
  }

  const show = {
    news: panels.news && (ws === "full" || ws === "news" || ws === "trader"),
    scanners:
      panels.scanners &&
      asset === "stock" &&
      (ws === "full" || ws === "news" || ws === "l2" || ws === "tape" || ws === "trader"),
    halts: panels.halts && asset === "stock" && (ws === "full" || ws === "news" || ws === "trader"),
    l2: panels.l2 && (ws === "full" || ws === "l2" || ws === "trader"),
    tape: panels.tape && (ws === "full" || ws === "tape" || ws === "trader"),
    positions: panels.positions && (ws === "full" || ws === "trader"),
  };

  if (!ready) return <div className="h-[calc(100vh-64px)] min-h-0 p-3" />;

  return (
    <div className="h-[calc(100vh-64px)] min-h-0 p-3 flex flex-col gap-3">
      {/* COMMAND BAR */}
      <div className="shrink-0 flex flex-col gap-2 relative z-50 pointer-events-auto">
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
              className={cn(
                "h-9 rounded-xl border border-white/10 px-3 text-xs hover:bg-muted",
                asset === "stock" ? "bg-muted" : ""
              )}
            >
              STOCK
            </button>
            <button
              onClick={() => setAsset("crypto")}
              className={cn(
                "h-9 rounded-xl border border-white/10 px-3 text-xs hover:bg-muted",
                asset === "crypto" ? "bg-muted" : ""
              )}
            >
              CRYPTO
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={cmdRef}
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onMouseDown={() => cmdRef.current?.focus()}
            onFocus={() => cmdRef.current?.focus()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitCommandOrSymbol(cmd);
                setCmd("");
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setCmd("");
                cmdRef.current?.blur();
              }
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder='Type: TSLA / BTC / BTC-USD • or: "ws l2", "news off"'
            className={cn(
              "h-10 flex-1 min-w-[320px] rounded-2xl border border-white/10",
              "bg-black/35 text-white caret-white placeholder:text-white/40",
              "px-4 text-sm outline-none focus:ring-2 focus:ring-white/20"
            )}
          />

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
      </div>

      {/* GRID */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-3">
        <div className="col-span-12 lg:col-span-4 min-h-0 flex flex-col gap-3">
          {show.scanners && (
            <Card title="Scanners" className="flex-[3] min-h-0">
              <ScannerPanel selectedSymbol={sym} onSelectSymbol={setActiveSymbol} refreshMs={12000} />
            </Card>
          )}

          {show.halts && (
            <Card title="Halts" className="flex-[2] min-h-0">
              <HaltsFeed selectedSymbol={sym} onPickSymbol={setActiveSymbol} refreshMs={60000} />
            </Card>
          )}

          {show.positions && (
            <Card title="Positions" className="flex-[3] min-h-0">
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
            </Card>
          )}

          {asset === "crypto" && (ws === "full" || ws === "trader") && (
            <Card
              title="Crypto Movers"
              className="flex-[2] min-h-0"
              right={<div className="text-[11px] text-muted-foreground">Top movers (24h)</div>}
            >
              <CryptoMoversPanel refreshMs={60_000} onPickSymbol={(s) => setCryptoSymbol(normalizeSymbol("crypto", s))} />
            </Card>
          )}
        </div>

        <div className="col-span-12 lg:col-span-4 min-h-0 flex flex-col gap-3">
          {show.news && (
            <Card title={`News — ${sym}`} className="flex-1 min-h-0">
              <NewsFeed symbol={sym} asset={asset} />
            </Card>
          )}
        </div>

        <div className="col-span-12 lg:col-span-4 min-h-0 flex flex-col gap-3">
          {show.l2 && (
            <Card title={`${asset === "crypto" ? "Order Book" : "Level 2"} — ${sym}`} className="flex-[3] min-h-0">
              <MarketDepthPanel symbol={sym} asset={asset} />
            </Card>
          )}

          {show.tape && (
            <Card title={`Tape — ${sym}`} className="flex-[2] min-h-0">
              <TapePanel symbol={sym} asset={asset} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
