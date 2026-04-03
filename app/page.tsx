"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

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
        <Image
          src="/brand/imynted-mark-512.png"
          alt="iMYNTED"
          width={96}
          height={96}
          priority
          className="object-contain"
          style={{ filter: "drop-shadow(0 0 24px rgba(52,211,153,0.35))" }}
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-xl mb-8">
        {NAV_OPTIONS.map((n) => (
          <button
            key={n.href}
            type="button"
            onClick={() => authed ? router.push(n.href) : router.push("/login")}
            className="flex flex-col items-start gap-1.5 rounded-sm border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left hover:border-emerald-400/30 hover:bg-emerald-400/[0.05] transition-all group"
          >
            <span className="text-emerald-400 text-lg leading-none font-mono">{n.icon}</span>
            <span className="text-[13px] font-bold text-white/90 group-hover:text-white transition-colors">{n.label}</span>
            <span className="text-[10px] text-zinc-500 leading-snug">{n.desc}</span>
          </button>
        ))}
      </div>

      {/* Auth CTA */}
      {authed === false && (
        <a
          href="/login"
          className="rounded-sm bg-emerald-400 text-black text-sm font-bold px-8 py-3 hover:bg-emerald-300 transition-colors tracking-wide"
        >
          Sign In to Access
        </a>
      )}
      {authed === true && (
        <a
          href="/dashboard"
          className="rounded-sm border border-emerald-400/30 text-emerald-400 text-sm font-semibold px-8 py-3 hover:bg-emerald-400/10 transition-colors tracking-wide"
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
