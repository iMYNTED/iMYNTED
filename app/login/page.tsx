"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const next = useMemo(() => searchParams.get("next") || "/dashboard", [searchParams]);

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
  const inCooldown = secondsLeft > 0;

  // If already logged in, don't let user sit on /login
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace(next);
    })();
  }, [router, next]);

  async function signIn() {
    setStatus(null);

    if (!email.trim()) {
      setStatus("Enter your email.");
      return;
    }

    if (inCooldown) {
      setStatus(`Wait ${secondsLeft}s then try again.`);
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // ✅ DEFAULT landing after auth
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    setLoading(false);

    if (error) {
      // Supabase rate-limit message you saw (35 sec)
      const msg = error.message || "Login failed";
      setStatus(msg);

      if (msg.toLowerCase().includes("35 seconds")) {
        setCooldownUntil(Date.now() + 35_000);
      }
      return;
    }

    setStatus("Check your email for the magic link.");
    setCooldownUntil(Date.now() + 35_000);
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md border border-zinc-800 rounded-xl p-6 bg-zinc-950">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-zinc-400 mt-1">Magic link to access My Sentinel Atlas.</p>

        <div className="mt-5 space-y-3">
          <input
            className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 outline-none"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            onClick={signIn}
            disabled={loading || inCooldown}
            className="w-full rounded-md bg-white text-black py-2 font-medium disabled:opacity-60"
          >
            {inCooldown ? `Wait ${secondsLeft}s` : loading ? "Sending..." : "Send magic link"}
          </button>

          {status && <p className="text-sm text-zinc-300">{status}</p>}
        </div>
      </div>
    </main>
  );
}



