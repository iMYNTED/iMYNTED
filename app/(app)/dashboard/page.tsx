"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import NewsFeed from "@/app/components/NewsFeed";
import ScannerPanel from "@/app/components/ScannerPanel";
import { MarketDepthPanel } from "@/app/components/MarketDepthPanel";
import { TapePanel } from "@/app/components/TapePanel";

// ✅ ADD THIS (adjust path/name if your component differs)
import PositionsPanel from "@/app/components/PositionsPanel";

type Workspace = "full" | "news" | "l2" | "tape" | "trader";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
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
    <section className={cn("rounded-2xl border border-white/10 bg-black/30", className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="text-[12px] font-semibold text-white/80">{title}</div>
        <div className="text-[11px] text-white/45">{right}</div>
      </div>
      <div className="min-h-0">{children}</div>
    </section>
  );
}

function isTicker(s: string) {
  return /^[A-Z]{1,7}$/.test(s);
}

export default function DashboardPage() {
  const [workspace, setWorkspace] = useState<Workspace>("full");
  const [symbol, setSymbol] = useState<string>("AAPL");

  // panel toggles
  const [newsOn, setNewsOn] = useState(true);
  const [l2On, setL2On] = useState(true);
  const [tapeOn, setTapeOn] = useState(true);

  // command bar
  const [cmd, setCmd] = useState("");
  const [hud, setHud] = useState<string>(
    "Type: ws trader | ws news | AAPL | news off | l2 on | tape off | help"
  );
  const cmdRef = useRef<HTMLInputElement | null>(null);

  const activeSymbol = useMemo(() => (symbol || "AAPL").toUpperCase(), [symbol]);

  function applyCommand(raw: string) {
    const text = raw.trim();
    if (!text) return;

    const parts = text.split(/\s+/);
    const a = parts[0]?.toLowerCase();
    const b = parts[1]?.toLowerCase();

    // ticker shortcut: "AAPL"
    if (isTicker(text.toUpperCase()) && parts.length === 1) {
      setSymbol(text.toUpperCase());
      setHud(`Symbol set: ${text.toUpperCase()}`);
      return;
    }

    // ws <name>
    if (a === "ws" && b) {
      if (b === "full" || b === "news" || b === "l2" || b === "tape" || b === "trader") {
        setWorkspace(b);
        setHud(`Workspace: ${b.toUpperCase()}`);
        return;
      }
      setHud(`Unknown workspace: ${b}`);
      return;
    }

    // toggles: news/l2/tape on/off
    if (a === "news" && b) {
      const on = b === "on";
      const off = b === "off";
      if (on || off) {
        setNewsOn(on);
        setHud(`News: ${on ? "ON" : "OFF"}`);
        return;
      }
    }

    if ((a === "l2" || a === "depth") && b) {
      const on = b === "on";
      const off = b === "off";
      if (on || off) {
        setL2On(on);
        setHud(`Level 2: ${on ? "ON" : "OFF"}`);
        return;
      }
    }

    if (a === "tape" && b) {
      const on = b === "on";
      const off = b === "off";
      if (on || off) {
        setTapeOn(on);
        setHud(`Tape: ${on ? "ON" : "OFF"}`);
        return;
      }
    }

    if (a === "help") {
      setHud("Commands: AAPL | ws full/news/l2/tape/trader | news on/off | l2 on/off | tape on/off");
      return;
    }

    setHud(`Unknown command: ${text}`);
  }

  // Keyboard shortcuts (F1..F5) + focus command bar with Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        cmdRef.current?.focus();
      }

      if (e.key === "F1") {
        e.preventDefault();
        setWorkspace("full");
      }
      if (e.key === "F2") {
        e.preventDefault();
        setWorkspace("news");
      }
      if (e.key === "F3") {
        e.preventDefault();
        setWorkspace("l2");
      }
      if (e.key === "F4") {
        e.preventDefault();
        setWorkspace("tape");
      }
      if (e.key === "F5") {
        e.preventDefault();
        setWorkspace("trader");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="h-[calc(100vh-12px)] p-3">
      {/* Top bar */}
      <div className="mb-3 flex items-center gap-2">
        <div className="text-[13px] font-semibold text-white/80">
          MySentinelAtlas • Dashboard
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1 text-[11px] text-white/35">
            <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1">F1</span>
            <span>FULL</span>
            <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1 ml-2">F2</span>
            <span>NEWS</span>
            <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1 ml-2">F3</span>
            <span>L2</span>
            <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1 ml-2">F4</span>
            <span>TAPE</span>
            <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1 ml-2">F5</span>
            <span>TRADER</span>
          </div>

          <input
            value={activeSymbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSymbol((s) => (s || "AAPL").toUpperCase());
            }}
            spellCheck={false}
            className="w-[110px] rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] font-semibold tracking-wider text-white/85 outline-none placeholder:text-white/30"
            placeholder="AAPL"
          />
        </div>
      </div>

      {/* Command bar */}
      <div className="mb-3 grid grid-cols-12 gap-3">
        <div className="col-span-12 lg:col-span-8">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-white/45">Command</div>
              <input
                ref={cmdRef}
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    applyCommand(cmd);
                    setCmd("");
                  }
                }}
                spellCheck={false}
                placeholder="Type: ws trader | ws news | AAPL | news off | l2 on | tape off | help"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/85 outline-none placeholder:text-white/30"
              />
              <button
                onClick={() => {
                  applyCommand(cmd);
                  setCmd("");
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/75 hover:bg-white/10"
              >
                Enter
              </button>
            </div>
            <div className="mt-2 text-[11px] text-white/40">{hud}</div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white/45">
            Toggles:{" "}
            <span className="text-white/70">news {newsOn ? "on" : "off"}</span> •{" "}
            <span className="text-white/70">l2 {l2On ? "on" : "off"}</span> •{" "}
            <span className="text-white/70">tape {tapeOn ? "on" : "off"}</span> •{" "}
            <span className="text-white/70">ws {workspace}</span>
            <div className="mt-1 text-white/35">Tip: Ctrl+K focuses the command bar.</div>
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="h-[calc(100%-116px)] min-h-0 overflow-hidden">
        <div className="h-full min-h-0 grid grid-cols-12 gap-3">

          {/* LEFT */}
          <div
            className={cn(
              "col-span-12 lg:col-span-4 h-full min-h-0 flex flex-col gap-3 overflow-hidden",
              workspace === "news" && "lg:col-span-12"
            )}
          >
            {/* ✅ POSITIONS TOP */}
            <Card title="Positions" className="h-[260px] min-h-0 overflow-hidden">
              <div className="h-full min-h-0 overflow-auto p-3">
                <PositionsPanel />
              </div>
            </Card>

            {/* SCANNERS */}
            <Card title="Scanners" className="flex-1 min-h-0 overflow-hidden">
              <div className="min-h-0 overflow-auto p-3">
                <ScannerPanel
                  activeSymbol={activeSymbol}
                  onPickSymbol={(s) => setSymbol(s)}
                />
              </div>
            </Card>

            {/* ✅ NEWS LAST */}
            {newsOn && (
              <Card
                title="News"
                className="h-[260px] min-h-0 overflow-hidden"
                right={<span className="text-white/35">scroll inside</span>}
              >
                <div className="h-full min-h-0 overflow-hidden p-3">
                  <NewsFeed symbol={activeSymbol} />
                </div>
              </Card>
            )}
          </div>

          {/* MIDDLE */}
          <div
            className={cn(
              "col-span-12 lg:col-span-5 h-full min-h-0 flex flex-col gap-3 overflow-hidden",
              workspace === "l2" && "lg:col-span-12",
              workspace === "tape" && "lg:col-span-12",
              workspace === "news" && "hidden lg:flex"
            )}
          >
            {l2On && (
              <Card
                title="Level 2"
                className={cn("flex-1 min-h-0 overflow-hidden")}
                right={<span className="text-white/35">{activeSymbol}</span>}
              >
                <div className="min-h-0 overflow-auto p-3">
                  <MarketDepthPanel symbol={activeSymbol} />
                </div>
              </Card>
            )}

            {tapeOn && (
              <Card
                title="Tape"
                className="h-[320px] min-h-0 overflow-hidden"
                right={<span className="text-white/35">{activeSymbol}</span>}
              >
                <div className="min-h-0 overflow-auto p-3">
                  <TapePanel symbol={activeSymbol} />
                </div>
              </Card>
            )}
          </div>

          {/* RIGHT */}
          <div
            className={cn(
              "col-span-12 lg:col-span-3 h-full min-h-0 overflow-hidden",
              workspace === "trader" && "lg:col-span-12",
              workspace === "news" && "hidden lg:block"
            )}
          >
            <Card title="Trader" className="h-full min-h-0 overflow-hidden">
              <div className="h-full min-h-0 overflow-auto p-3">
                <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                  <div className="text-[12px] font-semibold text-white/80">
                    Command Center (placeholder)
                  </div>
                  <div className="mt-2 text-[11px] text-white/50">
                    Active Symbol:{" "}
                    <span className="font-semibold text-white/80">{activeSymbol}</span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setWorkspace("full")}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/75 hover:bg-white/10"
                    >
                      ws full
                    </button>
                    <button
                      onClick={() => setWorkspace("news")}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/75 hover:bg-white/10"
                    >
                      ws news
                    </button>
                    <button
                      onClick={() => setWorkspace("l2")}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/75 hover:bg-white/10"
                    >
                      ws l2
                    </button>
                    <button
                      onClick={() => setWorkspace("tape")}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/75 hover:bg-white/10"
                    >
                      ws tape
                    </button>
                  </div>

                  <div className="mt-3 text-[10px] text-white/35">
                    Tip: Ctrl+K focuses the command bar.
                  </div>
                </div>
              </div>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
