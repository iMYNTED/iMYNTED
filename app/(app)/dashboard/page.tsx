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

function useLocalStorageState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const loadedRef = useRef(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(key);
      if (s !== null) setValue(JSON.parse(s) as T);
    } catch {}
    loadedRef.current = true;
  }, [key]);

  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
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

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

    // workspace switching
    if (head === "ws" && arg1) {
      if (["full", "news", "l2", "tape", "trader"].includes(arg1)) setWs(arg1 as Workspace);
      return;
    }

    // symbol set
    if (head === "sym" && parts[1]) {
      setSymbol(parts[1].toUpperCase());
      return;
    }

    // if user typed a symbol only
    if (/^[A-Za-z]{1,6}$/.test(parts[0])) {
      setSymbol(parts[0].toUpperCase());
      return;
    }

    // panel toggles
    if (["news", "l2", "tape", "scanners", "positions"].includes(head) && (arg1 === "on" || arg1 === "off")) {
      setPanel(head, arg1 === "on");
      return;
    }
  }

  const show = {
    news: panels.news && (ws === "full" || ws === "news" || ws === "trader"),
    scanners:
      panels.scanners &&
      (ws === "full" || ws === "news" || ws === "l2" || ws === "tape" || ws === "trader"),
    l2: panels.l2 && (ws === "full" || ws === "l2" || ws === "trader"),
    tape: panels.tape && (ws === "full" || ws === "tape" || ws === "trader"),
    positions: panels.positions && (ws === "full" || ws === "trader"),
  };

  return (
    <div className="h-[calc(100vh-64px)] min-h-0 p-3">
      {/* ✅ Command bar FIXED (always clickable, always on top) */}
      <div className="mb-3 flex flex-wrap items-center gap-2 relative z-50">
        <div className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm">
          <span className="text-muted-foreground">Workspace:</span>{" "}
          <span className="font-semibold" suppressHydrationWarning>
            {mounted ? ws.toUpperCase() : "FULL"}
          </span>
          <span className="mx-2 text-muted-foreground">•</span>
          <span className="text-muted-foreground">Symbol:</span>{" "}
          <span className="font-semibold" suppressHydrationWarning>
            {mounted ? sym : "AAPL"}
          </span>
        </div>

        <input
          ref={cmdRef}
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onClick={() => cmdRef.current?.focus()}
          onFocus={() => {
            // force the caret visible
            try {
              cmdRef.current?.setSelectionRange(cmd.length, cmd.length);
            } catch {}
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runCommand(cmd);
              setCmd("");
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setCmd("");
              cmdRef.current?.blur();
            }
          }}
          placeholder="Type symbol (SOUN) or command (ws trader | news off | l2 on). Press Enter."
          className="h-10 w-[720px] max-w-full rounded-xl border border-white/10 bg-background px-3 text-sm outline-none focus:ring-2 pointer-events-auto"
          style={{ position: "relative", zIndex: 9999 }}
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

      {/* GRID */}
      <div className="grid h-[calc(100%-56px)] min-h-0 grid-cols-12 gap-3">
        <div className="col-span-12 lg:col-span-4 min-h-0 flex flex-col gap-3">
          {show.scanners && (
            <Card title="Scanners" className="min-h-0 flex-1">
              <ScannerPanel selectedSymbol={sym} onSelectSymbol={(s) => setSymbol(s)} />
            </Card>
          )}
          {show.positions && (
            <Card title="Positions" className="min-h-0 flex-1">
              <PositionsPanel />
            </Card>
          )}
        </div>

        <div className="col-span-12 lg:col-span-4 min-h-0 flex flex-col gap-3">
          {show.news && (
            <Card title={`News — ${sym}`} className="min-h-0 flex-1">
              <NewsFeed symbol={sym} />
            </Card>
          )}
        </div>

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
        </div>
      </div>
    </div>
  );
}
