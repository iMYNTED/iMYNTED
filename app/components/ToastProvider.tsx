// app/components/ToastProvider.tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/* ── Types ──────────────────────────────────────────────────────── */

type ToastKind = "success" | "error" | "info" | "warn" | "order";

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
  ts: number;
}

interface ToastAPI {
  push: (kind: ToastKind, title: string, body?: string) => void;
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ── Context ────────────────────────────────────────────────────── */

const Ctx = createContext<ToastAPI>({ push: () => {} });

export function useToast() {
  return useContext(Ctx);
}

/* ── Constants ──────────────────────────────────────────────────── */

const MAX_VISIBLE = 5;
const TOAST_TTL = 4000;

const KINDS: Record<ToastKind, { accent: string; icon: string; bg: string; border: string }> = {
  success: {
    accent: "text-emerald-300",
    icon: "✓",
    bg: "bg-emerald-500/8",
    border: "border-emerald-500/20",
  },
  error: {
    accent: "text-rose-300",
    icon: "✕",
    bg: "bg-rose-500/8",
    border: "border-rose-500/20",
  },
  warn: {
    accent: "text-amber-300",
    icon: "⚠",
    bg: "bg-amber-500/8",
    border: "border-amber-500/20",
  },
  info: {
    accent: "text-cyan-300",
    icon: "ℹ",
    bg: "bg-cyan-500/8",
    border: "border-cyan-500/20",
  },
  order: {
    accent: "text-cyan-300",
    icon: "⚡",
    bg: "bg-cyan-500/8",
    border: "border-cyan-400/25",
  },
};

/* ── Provider ───────────────────────────────────────────────────── */

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, kind, title, body, ts: Date.now() }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Auto-expire
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => now - t.ts < TOAST_TTL));
    }, 500);
    return () => window.clearInterval(timer);
  }, [toasts.length]);

  // Listen to order ticket submissions
  useEffect(() => {
    function onOrder(e: Event) {
      const d = (e as CustomEvent).detail || {};
      const side = String(d.side || "").toUpperCase();
      const sym = String(d.symbol || "").toUpperCase();
      const qty = d.qty ?? "";
      const ot = String(d.orderType || "MKT");
      const lim = d.limit ? ` @ ${d.limit}` : "";

      if (!sym) return;
      push("order", `${side} ${qty} ${sym}`, `${ot}${lim} · Paper`);
    }

    window.addEventListener("imynted:orderTicketSubmit", onOrder as EventListener);
    return () => window.removeEventListener("imynted:orderTicketSubmit", onOrder as EventListener);
  }, [push]);

  // Listen to generic toast events from anywhere
  useEffect(() => {
    function onToast(e: Event) {
      const d = (e as CustomEvent).detail || {};
      const kind = (d.kind || "info") as ToastKind;
      const title = String(d.title || d.message || "");
      if (!title) return;
      push(kind, title, d.body);
    }

    window.addEventListener("imynted:toast", onToast as EventListener);
    return () => window.removeEventListener("imynted:toast", onToast as EventListener);
  }, [push]);

  return (
    <Ctx.Provider value={{ push }}>
      {children}

      {/* Toast stack — bottom-right */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-none">
          {toasts.map((t) => {
            const k = KINDS[t.kind] || KINDS.info;
            return (
              <div
                key={t.id}
                className={cn(
                  "pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-200",
                  "w-[320px] rounded-lg border px-3 py-2.5",
                  "bg-[rgba(4,10,18,0.95)] backdrop-blur-sm shadow-lg shadow-black/40",
                  k.border
                )}
              >
                <div className="flex items-start gap-2">
                  <span className={cn("text-[13px] leading-none mt-0.5 shrink-0", k.accent)}>
                    {k.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-[11px] font-semibold truncate", k.accent)}>
                      {t.title}
                    </div>
                    {t.body && (
                      <div className="text-[10px] text-white/45 mt-0.5 truncate">{t.body}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    className="shrink-0 text-white/20 hover:text-white/50 text-[10px] cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Ctx.Provider>
  );
}
