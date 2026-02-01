"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export type Workspace = "full" | "news" | "l2" | "tape" | "trader";

type TerminalState = {
  symbol: string;
  setSymbol: (s: string) => void;

  workspace: Workspace;
  setWorkspace: (w: Workspace) => void;

  panels: {
    news: boolean;
    scanners: boolean;
    l2: boolean;
    tape: boolean;
    positions: boolean;
  };
  setPanel: (key: keyof TerminalState["panels"], on: boolean) => void;

  runCommand: (raw: string) => void;
};

const Ctx = createContext<TerminalState | null>(null);

function normalizeSymbol(x: string) {
  return (x || "")
    .toUpperCase()
    .replace(/[^A-Z.\-]/g, "")
    .trim()
    .slice(0, 12);
}

export function TerminalProvider({
  children,
  initialSymbol = "TSLA",
}: {
  children: React.ReactNode;
  initialSymbol?: string;
}) {
  const [symbol, setSymbolState] = useState(normalizeSymbol(initialSymbol) || "TSLA");
  const [workspace, setWorkspace] = useState<Workspace>("full");
  const [panels, setPanels] = useState({
    news: true,
    scanners: true,
    l2: true,
    tape: true,
    positions: true,
  });

  const setSymbol = (s: string) => setSymbolState(normalizeSymbol(s) || symbol);

  const setPanel: TerminalState["setPanel"] = (key, on) => {
    setPanels((p) => ({ ...p, [key]: !!on }));
  };

  const runCommand: TerminalState["runCommand"] = (raw) => {
    const cmd = (raw || "").trim();
    if (!cmd) return;

    const lower = cmd.toLowerCase();

    // Workspace commands
    if (lower.startsWith("ws ")) {
      const w = lower.replace("ws", "").trim();
      if (w === "full" || w === "news" || w === "l2" || w === "tape" || w === "trader") {
        setWorkspace(w);
      }
      return;
    }

    // Panel toggles: "news off", "l2 on", "tape off", "positions on", "scanners off"
    const m = lower.match(/^(news|l2|tape|positions|scanners)\s+(on|off)$/);
    if (m) {
      const key = m[1] as keyof TerminalState["panels"];
      const on = m[2] === "on";
      setPanel(key, on);
      return;
    }

    // If user types a ticker, treat as symbol
    const maybe = normalizeSymbol(cmd);
    if (maybe.length >= 1) setSymbol(maybe);
  };

  const value = useMemo<TerminalState>(
    () => ({ symbol, setSymbol, workspace, setWorkspace, panels, setPanel, runCommand }),
    [symbol, workspace, panels]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTerminal() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTerminal must be used inside <TerminalProvider>");
  return v;
}
