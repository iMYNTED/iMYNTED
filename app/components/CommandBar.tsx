"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type TradeAction = "BUY" | "SELL" | "FLAT";

type Props = {
  value?: string;
  onSubmit?: (cmd: string) => void;
  placeholder?: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function IconNews(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={props.className} fill="none">
      <path
        d="M6 7h12M6 11h12M6 15h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4.5 5.5h15a2 2 0 0 1 2 2v9.5a3.5 3.5 0 0 1-3.5 3.5H7.5A3.5 3.5 0 0 1 4 17V7.5a2 2 0 0 1 .5-2Z"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.6"
      />
    </svg>
  );
}

function IconUp(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={props.className} fill="none">
      <path
        d="M12 5l6.5 6.5M12 5L5.5 11.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 5v14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

function IconDown(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={props.className} fill="none">
      <path
        d="M12 19l6.5-6.5M12 19L5.5 12.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 5v14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

function IconFlat(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={props.className} fill="none">
      <path
        d="M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function chipBase() {
  return "inline-flex items-center gap-2 h-9 rounded-xl border px-3 text-xs font-semibold select-none transition-colors";
}

function chipNeutral(active?: boolean) {
  return cn(
    chipBase(),
    "border-white/10",
    active ? "bg-white/10 text-white" : "bg-white/5 text-white/80 hover:bg-white/10"
  );
}

function chipBuy() {
  return cn(chipBase(), "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15");
}

function chipSell() {
  return cn(chipBase(), "border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15");
}

function chipFlat() {
  return cn(chipBase(), "border-white/12 bg-white/5 text-white/80 hover:bg-white/10");
}

export default function CommandBar({
  value = "",
  onSubmit,
  placeholder = 'Command… (AAPL | sym TSLA | ws full | ws news | news off)',
}: Props) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setText(value), [value]);
  const cleaned = useMemo(() => text.trim(), [text]);

  function submit() {
    if (!cleaned) return;
    onSubmit?.(cleaned);
  }

  function emitToggleNews() {
    try {
      window.dispatchEvent(new CustomEvent("imynted:togglePanel", { detail: { panel: "news" } }));
    } catch {}
  }

  function emitTradeAction(action: TradeAction) {
    try {
      window.dispatchEvent(new CustomEvent("imynted:tradeAction", { detail: { action } }));
    } catch {}
  }

  return (
    <div className="w-full">
      {/* ✅ Wrap-safe top bar: never overlaps SymbolHeader */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-400/[0.08] px-3 py-2"
        style={{
          background: "linear-gradient(135deg, #050d14 0%, #060e18 60%, #050c12 100%)",
          boxShadow: "0 0 0 1px rgba(52,211,153,0.04), inset 80px 0 120px -40px rgba(52,211,153,0.05), inset -40px 0 80px -40px rgba(34,211,238,0.03)",
        }}
      >
        {/* WORDMARK */}
        <div className="flex items-center pr-3 border-r border-white/10 shrink-0">
          <img
            src="/brand/imynted-wordmark.png"
            alt="iMYNTED"
            width={160}
            height={36}
            className="object-contain"
          />
        </div>

        {/* INPUT (min-w-0 prevents squeeze bugs) */}
        <div className="flex-1 min-w-[220px] min-w-0">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") {
                setText("");
                inputRef.current?.blur();
              }
            }}
            placeholder={placeholder}
            className={cn(
              "w-full h-10 rounded-2xl border border-white/10",
              "bg-black/35 text-[14px] text-white placeholder:text-white/35 outline-none caret-white",
              "px-4 focus:ring-2 focus:ring-white/20"
            )}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {/* RIGHT ACTIONS (wrap-safe, no overlap) */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* NEWS */}
          <button type="button" onClick={emitToggleNews} className={chipNeutral(false)} title="Toggle News panel">
            <IconNews className="h-4 w-4" />
            NEWS
          </button>

          {/* BUY / SELL / FLAT */}
          <button type="button" onClick={() => emitTradeAction("BUY")} className={chipBuy()} title="Trade action: BUY">
            <IconUp className="h-4 w-4" />
            BUY
          </button>

          <button type="button" onClick={() => emitTradeAction("SELL")} className={chipSell()} title="Trade action: SELL">
            <IconDown className="h-4 w-4" />
            SELL
          </button>

          <button type="button" onClick={() => emitTradeAction("FLAT")} className={chipFlat()} title="Trade action: FLAT">
            <IconFlat className="h-4 w-4" />
            FLAT
          </button>

          {/* SET */}
          <button
            type="button"
            onClick={submit}
            className="h-10 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-white hover:bg-white/10"
          >
            Set
          </button>
        </div>
      </div>
    </div>
  );
}