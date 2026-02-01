"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTerminal, type Workspace } from "@/app/components/terminal/TerminalStore";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const WS: Workspace[] = ["full", "news", "l2", "tape", "trader"];

export default function CommandCenterBar() {
  const t = useTerminal();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const label = useMemo(
    () => `Workspace: ${t.workspace.toUpperCase()}  ·  Symbol: ${t.symbol}`,
    [t.workspace, t.symbol]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F1") t.setWorkspace("full");
      if (e.key === "F2") t.setWorkspace("news");
      if (e.key === "F3") t.setWorkspace("l2");
      if (e.key === "F4") t.setWorkspace("tape");
      if (e.key === "F5") t.setWorkspace("trader");

      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [t]);

  return (
    <div className="flex items-center gap-3 w-full">
      {/* Left label */}
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {label}
      </div>

      {/* Command input */}
      <div className="flex-1">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type: TSLA ↵  |  ws news ↵  |  news off ↵  |  l2 on ↵"
          className="h-9 w-full rounded-xl border bg-background px-3 text-sm outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              t.runCommand(text);
              setText("");
            }
          }}
        />
      </div>

      {/* Workspace buttons */}
      <div className="flex items-center gap-2">
        {WS.map((w) => (
          <button
            key={w}
            onClick={() => t.setWorkspace(w)}
            className={cn(
              "h-8 px-3 rounded-xl border text-xs transition",
              t.workspace === w
                ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                : "hover:bg-muted"
            )}
          >
            {w.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
