"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function buildRedirectUrl(nextPath: string) {
  if (typeof window === "undefined") {
    return `https://www.imynted.com/auth/callback?next=${encodeURIComponent(nextPath)}`;
  }

  const { hostname } = window.location;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

  const base = isLocal ? window.location.origin : "https://www.imynted.com";
  const url = new URL("/auth/callback", base);
  url.searchParams.set("next", nextPath);
  return url.toString();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const next = useMemo(() => searchParams.get("next") || "/", [searchParams]);
  const callbackError = useMemo(() => searchParams.get("error"), [searchParams]);

  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [tosAccepted, setTosAccepted] = useState(false);
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

    if (!inviteCode.trim()) {
      setStatus("Enter your invite code.");
      return;
    }

    if (!tosAccepted) {
      setStatus("You must agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }

    if (inCooldown) {
      setStatus(`Wait ${secondsLeft}s then try again.`);
      return;
    }

    setLoading(true);

    try {
      // Validate invite code first
      const check = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteCode }),
      });
      if (!check.ok) {
        const { error } = await check.json();
        setStatus(error || "Invalid invite code.");
        return;
      }

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
            placeholder="Invite code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
          />
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

          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={tosAccepted}
              onChange={(e) => setTosAccepted(e.target.checked)}
              className="mt-0.5 shrink-0 accent-emerald-400"
            />
            <span className="text-xs text-zinc-400 leading-snug">
              I have read and agree to the{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline text-zinc-300 hover:text-white">Terms of Service</a>
              {" "}and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline text-zinc-300 hover:text-white">Privacy Policy</a>
              . I understand that iMYNTED is a financial data platform for informational purposes only and is{" "}
              <span className="font-semibold text-zinc-200">not investment advice</span>.
              Trading involves significant risk of loss.
            </span>
          </label>

          <button
            onClick={signIn}
            disabled={loading || inCooldown || !tosAccepted}
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