"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import NewsFeed from "@/app/components/NewsFeed";
import ScannerPanel from "@/app/components/ScannerPanel";
import { MarketDepthPanel } from "@/app/components/MarketDepthPanel";
import { TapePanel } from "@/app/components/TapePanel";
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
    <section
      className={cn(
        "rounded-2xl border border-white/10 bg-background min-h-0 flex flex-col overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="text-sm font-semibold">{title}</div>
        {right}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function useLocalStorageState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? (JSON.parse(s) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}

export default function DashboardPage() {
  const [ws, setWs] = useLocalStorageState<Workspace>("msa_ws", "full");
  const [symbol, setSymbol] = useLocalStorageState<string>("msa_symbol", "AAPL");

  const [panels, setPanels] = useLocalStorageState<Record<string, boolean>>("msa_panels", {
    news: true,
    scanners: true,
    l2: true,
    tape: true,
    positions: true,
  });

  const [cmd, setCmd] = useState("");
  const cmdRef = useRef<HTMLInputElement | null>(null);

  const sym = useMemo(() => (symbol || "AAPL").toUpperCase().trim(), [symbol]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
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
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setWs]);

  function setPanel(key: string, on: boolean) {
    setPanels((p) => ({ ...p, [key]: on }));
  }

  function runCommand(input: string) {
    const s = input.trim();
    if (!s) return;

    const parts = s.split(/\s+/);
    const head = parts[0].toLowerCase();
    const arg1 = parts[1]?.toLowerCase();

    if (head === "help") return;

    if (head === "ws" && arg1) {
      if (["full", "news", "l2", "tape", "trader"].includes(arg1)) {
        setWs(arg1 as Workspace);
      }
      return;
    }

    if (head === "sym" && parts[1]) {
      setSymbol(parts[1].toUpperCase());
      return;
    }

    if (/^[A-Za-z]{1,6}$/.test(parts[0])) {
      setSymbol(parts[0].toUpperCase());
      return;
    }

    if (["news", "l2", "tape", "scanners", "positions"].includes(head) && (arg1 === "on" || arg1 === "off")) {
      setPanel(head, arg1 === "on");
      return;
    }
  }

  const show = {
    news: panels.news && (ws === "full" || ws === "news" || ws === "trader"),
    scanners: panels.scanners && (ws === "full" || ws === "news" || ws === "l2" || ws === "tape" || ws === "trader"),
    l2: panels.l2 && (ws === "full" || ws === "l2" || ws === "trader"),
    tape: panels.tape && (ws === "full" || ws === "tape" || ws === "trader"),
    positions: panels.positions && (ws === "full" || ws === "trader"),
  };

  return (
    <div className="h-[calc(100vh-64px)] min-h-0 p-3">
      {/* ONE clean command bar (no duplicate lines) */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm">
          <span className="text-muted-foreground">Workspace:</span>{" "}
          <span className="font-semibold">{ws.toUpperCase()}</span>{" "}
          <span className="mx-2 text-muted-foreground">•</span>
          <span className="text-muted-foreground">Symbol:</span>{" "}
          <span className="font-semibold">{sym}</span>
        </div>

        <input
          ref={cmdRef}
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              runCommand(cmd);
              setCmd("");
            }
          }}
          placeholder="Command… (ws trader | ws news | AAPL | news off | l2 on | tape off)   •   Ctrl+K"
          className="h-10 w-[720px] max-w-full rounded-xl border border-white/10 bg-background px-3 text-sm outline-none focus:ring-2"
        />

        <div className="flex flex-wrap items-center gap-2">
          {(["news", "scanners", "l2", "tape", "positions"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setPanel(k, !panels[k])}
              className={cn(
                "rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-muted",
                panels[k] ? "bg-muted" : ""
              )}
              title="Toggle panel"
            >
              {k.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* GRID: Scanners | News | (L2 + Tape) */}
      <div className="grid h-[calc(100%-56px)] min-h-0 grid-cols-12 gap-3">
        {/* Left: Scanners + Positions */}
        <div className="col-span-12 lg:col-span-4 min-h-0 flex flex-col gap-3">
          {show.scanners && (
            <Card title="Scanners" className="min-h-0 flex-1">
              <ScannerPanel />
            </Card>
          )}

          {show.positions && (
            <Card title="Positions" className="min-h-0 flex-1">
              <PositionsPanel />
            </Card>
          )}

          {!show.scanners && !show.positions && (
            <Card title="Left Column" className="min-h-0 flex-1">
              <div className="p-4 text-sm text-muted-foreground">Turn on: scanners on / positions on</div>
            </Card>
          )}
        </div>

        {/* Middle: News (this is what your screenshot is missing) */}
        <div className="col-span-12 lg:col-span-4 min-h-0 flex flex-col gap-3">
          {show.news ? (
            <Card title={`News — ${sym}`} className="min-h-0 flex-1">
              <NewsFeed symbol={sym} />
            </Card>
          ) : (
            <Card title="News" className="min-h-0 flex-1">
              <div className="p-4 text-sm text-muted-foreground">Turn on: news on</div>
            </Card>
          )}
        </div>

        {/* Right: L2 + Tape */}
        <div className="col-span-12 lg:col-span-4 min-h-0 flex flex-col gap-3">
          {show.l2 && (
            <Card title={`Level 2 — ${sym}`} className="min-h-0 flex-1">
              <MarketDepthPanel symbol={sym} />
            </Card>
          )}

          {show.tape && (
            <Card title={`Tape — ${sym}`} className="min-h-0 flex-1">
              <TapePanel symbol={sym} />
            </Card>
          )}

          {!show.l2 && !show.tape && (
            <Card title="Right Column" className="min-h-0 flex-1">
              <div className="p-4 text-sm text-muted-foreground">Turn on: l2 on / tape on</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
