"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

const FEATURES = [
  {
    icon: "⬡",
    label: "Real-Time Scanner",
    desc: "Top gainers, losers, unusual volume, halts — all live.",
  },
  {
    icon: "◈",
    label: "Chart",
    desc: "Candles, EMA/SMA/VWAP overlays, multiple intervals.",
  },
  {
    icon: "▦",
    label: "Level 2 / Order Book",
    desc: "Bid/ask ladder with depth bars and spread tracking.",
  },
  {
    icon: "◎",
    label: "Tape",
    desc: "Live trade prints colored by side, size, and speed.",
  },
  {
    icon: "◫",
    label: "Positions",
    desc: "Multi-broker P/L, BUY/SELL/FLAT per position.",
  },
  {
    icon: "◷",
    label: "News Feed",
    desc: "Symbol-specific headlines, source, and timestamp.",
  },
];

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col md:flex-row">
      {/* ── LEFT SIDEBAR ── */}
      <aside className="w-full md:w-[340px] md:min-h-screen md:border-r border-white/[0.07] flex flex-col px-8 py-10 md:py-14 gap-10 shrink-0">
        {/* Logo */}
        <div className="flex flex-col gap-3">
          <Image
            src="/brand/imynted-lockup-transparent.png"
            alt="iMYNTED"
            width={180}
            height={48}
            priority
            className="object-contain object-left"
          />
          <p className="text-[13px] text-zinc-400 leading-snug max-w-[260px]">
            The control layer above all brokers, all assets, and all markets.
          </p>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
          <span className="text-xs font-semibold text-emerald-400 tracking-widest uppercase">
            Beta — Invite Only
          </span>
        </div>

        {/* Feature list */}
        <nav className="flex flex-col gap-1">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="flex items-start gap-3 px-3 py-2.5 rounded-sm hover:bg-white/[0.04] transition-colors group"
            >
              <span className="text-emerald-400 text-base leading-none mt-0.5 shrink-0 font-mono">
                {f.icon}
              </span>
              <div>
                <div className="text-[13px] font-semibold text-white/90 group-hover:text-white transition-colors">
                  {f.label}
                </div>
                <div className="text-[11px] text-zinc-500 leading-snug">{f.desc}</div>
              </div>
            </div>
          ))}
        </nav>

        {/* CTA */}
        <div className="mt-auto flex flex-col gap-3">
          <a
            href="/login"
            className="w-full rounded-sm bg-emerald-400 text-black text-sm font-bold py-3 text-center tracking-wide hover:bg-emerald-300 transition-colors"
          >
            Sign In
          </a>
          <p className="text-[11px] text-zinc-600 text-center leading-snug">
            Access requires an invite code.
          </p>
        </div>
      </aside>

      {/* ── RIGHT — FEATURE PREVIEW ── */}
      <main className="flex-1 hidden md:flex flex-col justify-center px-12 py-14 gap-8">
        {/* Headline */}
        <div className="space-y-2 max-w-xl">
          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            Professional market intelligence,{" "}
            <span className="text-emerald-400">one terminal.</span>
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            iMYNTED combines the execution speed of Moomoo with the density of a Bloomberg
            terminal. Stocks, crypto, options — monitored and traded from a single command center.
          </p>
        </div>

        {/* Mini panel grid */}
        <div className="grid grid-cols-3 gap-3 max-w-2xl">
          {[
            { label: "Scanners", color: "emerald" },
            { label: "Chart", color: "cyan" },
            { label: "Level 2", color: "emerald" },
            { label: "Tape", color: "red" },
            { label: "Positions", color: "amber" },
            { label: "News", color: "zinc" },
          ].map((p) => (
            <div
              key={p.label}
              className="rounded-sm border border-white/[0.07] bg-white/[0.03] px-4 py-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  {p.label}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    p.color === "emerald"
                      ? "bg-emerald-400"
                      : p.color === "cyan"
                      ? "bg-cyan-400"
                      : p.color === "red"
                      ? "bg-red-400"
                      : p.color === "amber"
                      ? "bg-amber-400"
                      : "bg-zinc-600"
                  }`}
                />
              </div>
              {/* Skeleton rows */}
              <div className="flex flex-col gap-1.5">
                {[70, 50, 85, 40].map((w, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full bg-white/[0.06]"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom disclaimer */}
        <p className="text-[11px] text-zinc-700 max-w-xl leading-relaxed">
          iMYNTED is a financial data platform for informational purposes only. Not investment
          advice. Trading involves significant risk of loss.
        </p>
      </main>
    </div>
  );
}
