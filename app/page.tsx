"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const NAV_OPTIONS = [
  { href: "/dashboard", label: "Dashboard",  desc: "Full terminal — chart, scanner, tape, L2", icon: "▦" },
  { href: "/scanner",   label: "Scanner",    desc: "Real-time movers, volume, halts",           icon: "⬡" },
  { href: "/options",   label: "Options",    desc: "Options chain and flow",                     icon: "◈" },
  { href: "/futures",   label: "Futures",    desc: "Futures contracts and spreads",              icon: "◎" },
  { href: "/accounts",  label: "Accounts",   desc: "Connected brokers and positions",            icon: "◫" },
  { href: "/settings",  label: "Settings",   desc: "Preferences and configuration",              icon: "◷" },
];

export default function HomePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
    });
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-black">

      {/* Logo + brand */}
      <div className="flex flex-col items-center gap-3 mb-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/imynted-mark-transparent.png"
          alt="iMYNTED"
          width={150}
          height={150}
          style={{
            display: "block",
            filter: "drop-shadow(0 0 32px rgba(52,211,153,0.6)) drop-shadow(0 0 10px rgba(52,211,153,0.35))",
          }}
        />
        <p className="text-[13px] text-zinc-400 text-center max-w-xs leading-snug">
          The control layer above all brokers, all assets, and all markets.
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            style={{ boxShadow: "0 0 6px rgba(52,211,153,0.8)" }} />
          <span className="text-[10px] font-bold text-emerald-400/70 tracking-widest uppercase">Beta — Invite Only</span>
        </div>
      </div>

      {/* Nav tiles */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-8">
        {NAV_OPTIONS.map((n) => (
          <button
            key={n.href}
            type="button"
            onClick={() => authed ? router.push(n.href) : router.push("/login")}
            className="relative flex flex-col items-start gap-1.5 rounded-lg px-4 py-3 text-left transition-all group overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(52,211,153,0.07) 0%, rgba(0,0,0,0) 100%)",
              border: "1px solid rgba(52,211,153,0.18)",
              boxShadow: "inset 0 1px 0 rgba(52,211,153,0.08)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.border = "1px solid rgba(52,211,153,0.45)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 18px rgba(52,211,153,0.15), inset 0 1px 0 rgba(52,211,153,0.15)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.border = "1px solid rgba(52,211,153,0.18)";
              (e.currentTarget as HTMLElement).style.boxShadow = "inset 0 1px 0 rgba(52,211,153,0.08)";
            }}
          >
            <span className="text-emerald-400 text-lg leading-none font-mono"
              style={{ textShadow: "0 0 8px rgba(52,211,153,0.6)" }}>{n.icon}</span>
            <span className="text-[13px] font-bold text-white/90 group-hover:text-emerald-300 transition-colors">{n.label}</span>
            <span className="text-[10px] text-zinc-500 leading-snug">{n.desc}</span>
          </button>
        ))}
      </div>

      {/* Auth CTA */}
      {authed === false && (
        <a
          href="/login"
          className="rounded-lg text-emerald-400 text-sm font-bold px-10 py-3 tracking-wide transition-all"
          style={{
            background: "linear-gradient(135deg, rgba(52,211,153,0.07) 0%, rgba(0,0,0,0) 100%)",
            border: "1px solid rgba(52,211,153,0.45)",
            boxShadow: "0 0 18px rgba(52,211,153,0.2), inset 0 1px 0 rgba(52,211,153,0.1)",
            textShadow: "0 0 10px rgba(52,211,153,0.5)",
          }}
        >
          Sign In to Access
        </a>
      )}
      {authed === true && (
        <a
          href="/dashboard"
          className="rounded-lg text-emerald-400 text-sm font-semibold px-8 py-3 tracking-wide transition-all"
          style={{
            border: "1px solid rgba(52,211,153,0.35)",
            boxShadow: "0 0 14px rgba(52,211,153,0.1)",
          }}
        >
          Open Terminal →
        </a>
      )}

      {/* Disclaimer */}
      <p className="mt-10 text-[10px] text-zinc-700 text-center max-w-sm leading-relaxed">
        iMYNTED is for informational purposes only. Not investment advice. Trading involves significant risk of loss.
      </p>
    </main>
  );
}
