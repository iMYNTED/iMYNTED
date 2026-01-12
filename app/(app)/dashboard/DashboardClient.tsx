"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NewsFeed from "@/app/components/NewsFeed";
import { MarketDepthPanel } from "@/app/components/MarketDepthPanel";
import { TapePanel } from "@/app/components/TapePanel";
import ScannerPanel from "@/app/components/ScannerPanel";

/* ----------------------------- UI Primitives ----------------------------- */

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-white/80">{title}</div>
        {right ? <div className="text-xs text-white/50">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1.5 text-[12px] font-semibold",
        active
          ? "bg-foreground text-background"
          : "bg-white/5 text-white/70 hover:bg-white/10 ring-1 ring-white/10",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ----------------------------- Types ----------------------------- */

type Workspace = "full" | "news" | "l2" | "tape" | "trader";

/* ----------------------------- Main ----------------------------- */

export default function DashboardClient() {
  const [workspace, setWorkspace] = useState<Workspace>("full");
  const [symbol, setSymbol] = useState<string>("AAPL");

  // watchlist (simple local)
  const [watch, setWatch] = useState<string[]>(["TSLA", "SPY"]);
  const [input, setInput] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);

  const topHint = useMemo(() => {
    return "Type: ws trader | ws news | AAPL | news off | l2 on | tape off | help";
  }, []);

  // Hotkeys (F1-F5) like you wanted
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F1") {
        e.preventDefault();
        setWorkspace("full");
      } else if (e.key === "F2") {
        e.preventDefault();
        setWorkspace("news");
      } else if (e.key === "F3") {
        e.preventDefault();
        setWorkspace("l2");
      } else if (e.key === "F4") {
        e.preventDefault();
        setWorkspace("tape");
      } else if (e.key === "F5") {
        e.preventDefault();
        setWorkspace("trader");
      } else if (e.key === "/" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function runCommand(raw: string) {
    const cmd = raw.trim();
    if (!cmd) return;

    const lower = cmd.toLowerCase();

    // Workspaces
    if (lower === "ws full") return setWorkspace("full");
    if (lower === "ws news") return setWorkspace("news");
    if (lower === "ws l2") return setWorkspace("l2");
    if (lower === "ws tape") return setWorkspace("tape");
    if (lower === "ws trader") return setWorkspace("trader");

    // Add watchlist: +TSLA
    if (cmd.startsWith("+")) {
      const s = cmd.slice(1).toUpperCase();
      if (s) setWatch((prev) => Array.from(new Set([s, ...prev])));
      return;
    }

    // Remove: -TSLA
    if (cmd.startsWith("-")) {
      const s = cmd.slice(1).toUpperCase();
      setWatch((prev) => prev.filter((x) => x !== s));
      return;
    }

    // If it looks like a ticker, set active symbol
    if (/^[A-Za-z.\-]{1,10}$/.test(cmd)) {
      setSymbol(cmd.toUpperCase());
      return;
    }

    // help
    if (lower === "help") {
      alert(
        [
          "Commands:",
          "  ws full | ws news | ws l2 | ws tape | ws trader",
          "  AAPL (sets symbol)",
          "  +TSLA (add to watchlist)",
          "  -TSLA (remove from watchlist)",
          "",
          "Hotkeys:",
          "  F1 Full | F2 News | F3 L2 | F4 Tape | F5 Trader",
          "  Ctrl+/ focus command bar",
        ].join("\n")
      );
      return;
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Bar */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-3">
          <Chip onClick={() => inputRef.current?.focus()}>COMMAND CENTER</Chip>

          <div className="ml-2 flex items-center gap-2 text-xs text-white/60">
            <span className="rounded-md bg-white/5 px-2 py-1 ring-1 ring-white/10">
              SYMBOL
            </span>
            <span className="rounded-md bg-white/5 px-2 py-1 ring-1 ring-white/10 font-semibold text-white/80">
              {symbol}
            </span>
            <span className="rounded-md bg-white/5 px-2 py-1 ring-1 ring-white/10">
              WS
            </span>
            <span className="rounded-md bg-white/5 px-2 py-1 ring-1 ring-white/10 font-semibold text-white/80">
              {workspace.toUpperCase()}
            </span>
          </div>

          <div className="ml-auto hidden lg:block text-xs text-white/40">
            {topHint}
          </div>
        </div>

        {/* Command Input */}
        <div className="mx-auto max-w-[1600px] px-4 pb-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                runCommand(input);
                setInput("");
              }
            }}
            placeholder="Type a command… (ws trader | AAPL | +TSLA | -TSLA | help)"
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/90 placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/10"
          />
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/40">
            <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
              F1 Full
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
              F2 News
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
              F3 L2
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
              F4 Tape
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
              F5 Trader
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
              Ctrl+/ focus
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="grid gap-4 lg:grid-cols-[420px_1fr_360px]">
          {/* LEFT COLUMN */}
          <div className="space-y-4">
            <Card
              title="Watchlist"
              right={<span className="text-white/40">Click + set symbol</span>}
            >
              <div className="space-y-2">
                {watch.map((w, idx) => (
                  <div
                    key={w}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-3 py-3"
                  >
                    <button
                      className="text-left"
                      onClick={() => setSymbol(w)}
                      type="button"
                    >
                      <div className="text-sm font-semibold text-white/90">
                        {w}
                      </div>
                      <div className="text-[11px] text-white/40">
                        Click • +/− cycle • {idx + 1}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWatch((prev) => prev.filter((x) => x !== w))}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 hover:bg-white/10"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="text-[11px] text-white/40">
                  Selected: <span className="text-white/70">{symbol}</span>
                </div>
              </div>
            </Card>

            <Card title="Scanners (Terminal)">
              <ScannerPanel
                activeSymbol={symbol}
                onPickSymbol={(sym: string) => setSymbol(sym)}
                refreshSeconds={9}
              />
            </Card>

            <Card title="Alerts (Recent)">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white/60">
                No alerts yet.
              </div>
            </Card>
          </div>

          {/* MIDDLE COLUMN */}
          <div className="space-y-4">
            {(workspace === "full" || workspace === "news" || workspace === "trader") && (
              <Card title="Market News" right={<span className="text-white/40">Yahoo / RSS / mock</span>}>
                <NewsFeed symbol={symbol} />
              </Card>
            )}

            {workspace === "trader" && (
              <Card title="Trader Notes">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                  Add your execution panel / positions here next.
                </div>
              </Card>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">
            {(workspace === "full" || workspace === "l2") && (
              <Card title="Market Depth (L2)">
                <MarketDepthPanel symbol={symbol} />
              </Card>
            )}

            {(workspace === "full" || workspace === "tape") && (
              <Card title="Time & Sales (Tape)">
                <TapePanel symbol={symbol} />
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
