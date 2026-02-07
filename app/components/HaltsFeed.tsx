"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type HaltItem = {
  id?: string | number;
  symbol?: string;
  sym?: string;
  ticker?: string;

  status?: string; // "Halted" | "Resumed" | "Paused"
  reason?: string;
  venue?: string;

  published?: string; // rss pubDate
  title?: string;
  url?: string;

  ts?: string;
  asOf?: string;
  time?: string;
};

type ApiAllResp = {
  mode?: "all" | "single" | "bulk";
  provider?: string;
  ts?: string;
  items?: HaltItem[];
  error?: string;
};

function normSym(it: HaltItem): string {
  const raw = it.symbol ?? it.sym ?? it.ticker ?? "";
  if (typeof raw !== "string") return "";
  return raw.toUpperCase().trim();
}

function hhmm(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function pickTime(it: HaltItem): string {
  const t = it.published || it.ts || it.asOf || it.time || "";
  if (!t) return "";
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) return hhmm(d.toISOString());
  return t; // fallback raw
}

function timeMs(it: HaltItem): number {
  const t = it.published || it.ts || it.asOf || it.time || "";
  if (!t) return 0;
  const ms = new Date(t).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function isActiveHalt(status?: string) {
  const s = (status || "").toLowerCase();
  if (!s) return false;
  if (s.includes("resum")) return false;
  return s.includes("halt") || s.includes("pause");
}

function splitReason(reason?: string): { code?: string; text?: string } {
  const r = (reason || "").trim();
  if (!r) return {};
  const parts = r
    .split("—")
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length >= 2) return { code: parts[0], text: parts.slice(1).join(" — ") };
  const parts2 = r
    .split(" - ")
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts2.length >= 2 && /^[A-Z0-9]{1,6}$/.test(parts2[0])) {
    return { code: parts2[0], text: parts2.slice(1).join(" - ") };
  }
  if (/^[A-Z0-9]{1,6}$/.test(r)) return { code: r };
  return { text: r };
}

function StatusPill({ status }: { status?: string }) {
  const s = (status || "").toLowerCase();
  const label = (status || "").trim() || "—";
  const cls =
    s.includes("halt") || s.includes("pause")
      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
      : s.includes("resum")
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : "border-white/10 bg-white/5 text-white/75";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold",
        cls
      )}
    >
      {label}
    </span>
  );
}

function CodePill({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <span className="inline-flex items-center rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">
      {code}
    </span>
  );
}

function NewPill() {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
      NEW
    </span>
  );
}

function beep() {
  try {
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as any;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.03;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close?.();
    }, 90);
  } catch {}
}

type WindowKey = "6h" | "24h" | "all";

export default function HaltsFeed({
  onPickSymbol,
  pollMs = 60_000,
  providerLabel,
  className,
}: {
  onPickSymbol?: (sym: string) => void;
  pollMs?: number;
  providerLabel?: string;
  className?: string;
}) {
  const [provider, setProvider] = useState<string>(providerLabel || "nasdaq_rss");
  const [asOf, setAsOf] = useState<string>("");
  const [items, setItems] = useState<HaltItem[]>([]);
  const [err, setErr] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // NEW detection
  const seenRef = useRef<Set<string>>(new Set());
  const [freshMap, setFreshMap] = useState<Record<string, number>>({}); // key -> expiresAt ms

  // user toggles
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem("msa_halts_sound") === "1";
    } catch {
      return false;
    }
  });

  const [activeOnly, setActiveOnly] = useState<boolean>(() => {
    try {
      return localStorage.getItem("msa_halts_active_only") === "1";
    } catch {
      return false;
    }
  });

  const [windowKey, setWindowKey] = useState<WindowKey>(() => {
    try {
      const v = (localStorage.getItem("msa_halts_window") || "") as WindowKey;
      return v === "6h" || v === "24h" || v === "all" ? v : "24h";
    } catch {
      return "24h";
    }
  });

  const timerRef = useRef<any>(null);

  function makeKey(it: HaltItem, idx: number) {
    const sym = normSym(it);
    const status = (it.status || "").toString();
    const t = it.published || it.time || it.asOf || "";
    const u = String(it.url || it.id || "");
    return u ? `${sym}|${status}|${u}` : `${sym}|${status}|${t}|${idx}`;
  }

  function pruneFresh(now: number) {
    setFreshMap((m) => {
      const next: Record<string, number> = {};
      for (const k of Object.keys(m)) if (m[k] > now) next[k] = m[k];
      return next;
    });
  }

  useEffect(() => {
    try {
      localStorage.setItem("msa_halts_sound", soundOn ? "1" : "0");
      localStorage.setItem("msa_halts_active_only", activeOnly ? "1" : "0");
      localStorage.setItem("msa_halts_window", windowKey);
    } catch {}
  }, [soundOn, activeOnly, windowKey]);

  async function load() {
    try {
      setLoading(true);
      setErr("");

      const res = await fetch(`/api/market/halts?mode=all`, { cache: "no-store" });
      const j = (await res.json()) as ApiAllResp;

      setProvider(j.provider || providerLabel || "nasdaq_rss");
      setAsOf(j.ts || "");
      if (j?.error) setErr(j.error);

      const rows = Array.isArray(j.items) ? j.items : [];

      // De-dupe
      const seen = new Set<string>();
      const deduped: HaltItem[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const s = normSym(r);
        if (!s) continue;

        const st = (r.status || "").toString();
        const t = r.published || r.time || r.asOf || "";
        const u = r.url || r.id || "";
        const k = `${s}|${st}|${t}|${u}`;
        if (seen.has(k)) continue;
        seen.add(k);
        deduped.push(r);
      }

      // NEW detection (after first cycle)
      const now = Date.now();
      const nextFresh: Record<string, number> = {};
      let newActiveCount = 0;

      for (let i = 0; i < deduped.length; i++) {
        const it = deduped[i];
        const key = makeKey(it, i);

        if (seenRef.current.size > 0 && !seenRef.current.has(key)) {
          nextFresh[key] = now + 5000; // flash 5s
          if (isActiveHalt(it.status)) newActiveCount++;
        }
      }

      // update seen (cap)
      for (let i = 0; i < deduped.length; i++) seenRef.current.add(makeKey(deduped[i], i));
      if (seenRef.current.size > 5000) {
        const rebuilt = new Set<string>();
        for (let i = 0; i < deduped.length; i++) rebuilt.add(makeKey(deduped[i], i));
        seenRef.current = rebuilt as any;
      }

      // merge fresh + prune
      setFreshMap((m) => {
        const merged = { ...m, ...nextFresh };
        const cleaned: Record<string, number> = {};
        for (const k of Object.keys(merged)) if (merged[k] > now) cleaned[k] = merged[k];
        return cleaned;
      });
      pruneFresh(now);

      if (soundOn && newActiveCount > 0) beep();

      setItems(deduped);
    } catch (e: any) {
      setErr(e?.message || "Failed to load halts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!alive) return;
      await load();
      if (!alive) return;

      timerRef.current = window.setInterval(() => load(), Math.max(2000, pollMs));
    })();

    return () => {
      alive = false;
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs, providerLabel, soundOn]);

  useEffect(() => {
    const id = window.setInterval(() => pruneFresh(Date.now()), 750);
    return () => window.clearInterval(id);
  }, []);

  const headerTime = useMemo(() => {
    const t = hhmm(asOf);
    return t ? `• ${t}` : "";
  }, [asOf]);

  const windowMs = useMemo(() => {
    if (windowKey === "6h") return 6 * 60 * 60 * 1000;
    if (windowKey === "24h") return 24 * 60 * 60 * 1000;
    return 0; // all
  }, [windowKey]);

  const view = useMemo(() => {
    const now = Date.now();
    const cutoff = windowMs ? now - windowMs : 0;

    const filtered = items.filter((it) => {
      if (activeOnly && !isActiveHalt(it.status)) return false;
      if (cutoff) {
        const ms = timeMs(it);
        if (!ms) return false;
        if (ms < cutoff) return false;
      }
      return true;
    });

    // sort newest first
    filtered.sort((a, b) => timeMs(b) - timeMs(a));
    return filtered;
  }, [items, activeOnly, windowMs]);

  const counts = useMemo(() => {
    let active = 0;
    for (const it of view) if (isActiveHalt(it.status)) active++;
    return { total: view.length, active };
  }, [view]);

  return (
    <section
      className={cn(
        "h-full min-h-0 rounded-2xl border border-white/10 bg-black/30 flex flex-col overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="text-xs text-white/70">
          Provider: <span className="text-white/85">{provider}</span>{" "}
          <span className="text-white/40">{headerTime}</span>
          <span className="ml-2 text-white/35">
            • {counts.active} active • {counts.total} shown
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* window */}
          <div className="flex items-center rounded-lg border border-white/10 bg-black/20 p-0.5">
            {(["6h", "24h", "all"] as WindowKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setWindowKey(k)}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-semibold",
                  windowKey === k ? "bg-white/80 text-black" : "text-white/70 hover:bg-white/5"
                )}
                title="History window"
              >
                {k.toUpperCase()}
              </button>
            ))}
          </div>

          {/* active only */}
          <button
            type="button"
            onClick={() => setActiveOnly((v) => !v)}
            className={cn(
              "rounded-lg border px-2 py-1 text-xs hover:bg-white/5",
              activeOnly ? "border-rose-500/30 text-rose-200" : "border-white/10 text-white/60"
            )}
            title={activeOnly ? "Showing active only" : "Showing all (halts + resumes)"}
          >
            {activeOnly ? "ACTIVE" : "ALL"}
          </button>

          {/* sound */}
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            className={cn(
              "rounded-lg border px-2 py-1 text-xs hover:bg-white/5",
              soundOn ? "border-emerald-500/30 text-emerald-200" : "border-white/10 text-white/60"
            )}
            title={soundOn ? "Sound: ON" : "Sound: OFF"}
          >
            {soundOn ? "🔊" : "🔈"}
          </button>

          {loading ? <span className="text-[11px] text-white/40">Loading…</span> : null}

          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70 hover:bg-white/5"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {err ? <div className="shrink-0 px-3 py-2 text-xs text-rose-300">{err}</div> : null}

      {/* Table header */}
      <div className="shrink-0">
        <div className="grid grid-cols-12 gap-2 bg-black/40 px-3 py-2 text-[11px] font-semibold text-white/50">
          <div className="col-span-2">SYM</div>
          <div className="col-span-3">STATUS</div>
          <div className="col-span-5">REASON</div>
          <div className="col-span-2 text-right">TIME</div>
        </div>
      </div>

      {/* Scroll area */}
      <div className="flex-1 min-h-0 overflow-auto">
        {view.length === 0 && !err ? (
          <div className="px-3 py-6 text-center text-xs text-white/40">No halts in this window</div>
        ) : (
          <div className="divide-y divide-white/5">
            {view.map((it, idx) => {
              const sym = normSym(it);
              if (!sym) return null;

              const { code, text } = splitReason(it.reason);
              const time = pickTime(it) || "—";

              const k = makeKey(it, idx);
              const isFresh = (freshMap[k] || 0) > Date.now();
              const rowFlash = isFresh ? "bg-amber-500/10 ring-1 ring-inset ring-amber-500/20" : "";

              return (
                <div
                  key={String(it.id ?? it.url ?? `${sym}-${idx}`)}
                  className={cn("grid grid-cols-12 gap-2 px-3 py-2 hover:bg-white/5", rowFlash)}
                >
                  {/* SYM */}
                  <div className="col-span-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onPickSymbol?.(sym)}
                      className="rounded-md bg-white/5 px-2 py-1 text-[12px] font-semibold text-white/90 hover:bg-white/10"
                      title="Click to set symbol"
                    >
                      {sym}
                    </button>
                    {isFresh ? <NewPill /> : null}
                  </div>

                  {/* STATUS */}
                  <div className="col-span-3 flex items-center gap-2">
                    <StatusPill status={it.status} />
                    {it.venue ? (
                      <span className="text-[11px] text-white/40 truncate" title={it.venue}>
                        {it.venue}
                      </span>
                    ) : null}
                  </div>

                  {/* REASON */}
                  <div className="col-span-5 flex items-center gap-2 min-w-0">
                    <CodePill code={code} />
                    <div
                      className="min-w-0 truncate text-[12px] text-white/70"
                      title={text || it.reason || ""}
                    >
                      {text || it.reason || "—"}
                    </div>

                    {it.url ? (
                      <a
                        href={String(it.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto shrink-0 text-[11px] text-white/45 hover:text-white/80"
                        title="Open on Nasdaq Trader"
                      >
                        ↗
                      </a>
                    ) : null}
                  </div>

                  {/* TIME */}
                  <div className="col-span-2 text-right text-[12px] text-white/60 tabular-nums">
                    {time}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
