"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function buildRedirectUrl(nextPath: string) {
  if (typeof window === "undefined") {
    return `http://localhost:3004/auth/callback?next=${encodeURIComponent(nextPath)}`;
  }

  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", nextPath);
  return url.toString();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const next = useMemo(() => searchParams.get("next") || "/dashboard", [searchParams]);
  const callbackError = useMemo(() => searchParams.get("error"), [searchParams]);

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
  const inCooldown = secondsLeft > 0;

  // 🔥 Handle callback errors cleanly
  useEffect(() => {
    if (!callbackError) return;

    const lower = callbackError.toLowerCase();

    if (lower.includes("code verifier") || lower.includes("no_session")) {
      setStatus(
        "Session mismatch. Open the magic link in the SAME browser you requested it from."
      );
      return;
    }

    if (lower.includes("rate limit")) {
      setStatus("Too many requests. Please wait about a minute before trying again.");
      setCooldownUntil(Date.now() + 60_000);
      return;
    }

    if (callbackError === "missing_code") {
      setStatus("Magic link was invalid or expired.");
      return;
    }

    setStatus(callbackError);
  }, [callbackError]);

  // 🔥 Auto redirect if session exists
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        router.replace(next);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router, next]);

  async function signIn() {
    setStatus(null);

    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) {
      setStatus("Enter your email.");
      return;
    }

    if (inCooldown) {
      setStatus(`Wait ${secondsLeft}s then try again.`);
      return;
    }

    setLoading(true);

    try {
      const emailRedirectTo = buildRedirectUrl(next);

      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo,
        },
      });

      if (error) {
        const msg = error.message || "Login failed";
        const lower = msg.toLowerCase();

        setStatus(msg);

        // 🔥 FIX: handle ALL rate limits
        if (
          lower.includes("rate limit") ||
          lower.includes("too many") ||
          lower.includes("seconds")
        ) {
          setCooldownUntil(Date.now() + 60_000);
        }

        return;
      }

      setStatus(
        `Magic link sent. Open it in THIS browser (${window.location.origin}).`
      );

      setCooldownUntil(Date.now() + 60_000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md border border-zinc-800 rounded-xl p-6 bg-zinc-950">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-zinc-400 mt-1">Magic link to access iMYNTED.</p>

        <div className="mt-5 space-y-3">
          <input
            className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 outline-none"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="email"
          />

          <button
            onClick={signIn}
            disabled={loading || inCooldown}
            className="w-full rounded-md bg-white text-black py-2 font-medium disabled:opacity-60"
          >
            {inCooldown
              ? `Wait ${secondsLeft}s`
              : loading
              ? "Sending..."
              : "Send magic link"}
          </button>

          {status && <p className="text-sm text-zinc-300">{status}</p>}

          <div className="pt-2 text-xs text-zinc-500">
            <p>Origin: {typeof window !== "undefined" ? window.location.origin : "http://localhost:3004"}</p>
            <p>Callback: /auth/callback</p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
          <div className="w-full max-w-md border border-zinc-800 rounded-xl p-6 bg-zinc-950">
            <div className="text-sm text-zinc-400">Loading...</div>
          </div>
        </main>
      }
    >
      <LoginInner />
    </Suspense>
  );
}