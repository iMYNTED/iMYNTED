// app/components/NewsFeed.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AssetType = "stock" | "crypto";

type NewsItem = {
  id: string;
  ts: string; // ISO string preferred (may be empty)
  symbol?: string;
  headline: string;
  source?: string;
  url?: string;
  summary?: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function safeJsonParse<T>(s: string | null, fallback: T): T {
  try {
    if (!s) return fallback;
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function hhmm(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return "now";
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

function looksLikeCrypto(sym: string) {
  const s = (sym || "").toUpperCase().trim();
  if (!s) return false;
  if (s.includes("-USD")) return true;
  return ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "BNB", "MATIC"].includes(s);
}

function cryptoBase(sym: string) {
  const s = (sym || "").toUpperCase().trim();
  if (!s) return "";
  return s.replace("-USD", "").split("-")[0];
}

function normSym(raw: string) {
  return String(raw || "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.\-]/g, "");
}

function ms(iso: string) {
  const d = new Date(iso);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Try to coerce timestamps into a parseable ISO string.
 * - accepts ISO, unix seconds, unix ms, or common provider strings
 */
function normalizeTs(raw: any): string {
  if (!raw) return "";
  if (typeof raw === "number") {
    const t = raw < 2_000_000_000 ? raw * 1000 : raw;
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  }
  const s = String(raw).trim();
  if (!s) return "";

  if (/^\d{10,13}$/.test(s)) {
    const num = Number(s);
    const t = s.length === 10 ? num * 1000 : num;
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();

  return "";
}

function stableKeyParts(x: { symbol?: string; headline?: string; source?: string; url?: string; ts?: string }) {
  const sym = normSym(x.symbol || "");
  const headline = String(x.headline || "").trim().toLowerCase();
  const source = String(x.source || "").trim().toLowerCase();
  const url = String(x.url || "").trim().toLowerCase();
  const ts = String(x.ts || "").trim();
  return { sym, headline, source, url, ts };
}

/**
 * Simple stable hash (fast, deterministic) so IDs don't change across refresh/reorder.
 * We do NOT rely on array index.
 */
function hash32(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function buildStableId(x: { symbol?: string; headline: string; source?: string; url?: string; ts?: string }) {
  const { sym, headline, source, url, ts } = stableKeyParts(x);
  const key = `${sym}|${url || ""}|${headline}|${source}|${ts || ""}`;
  return hash32(key);
}

/**
 * Accepts:
 * - array
 * - { items: [...] }
 * - { data: [...] }
 * - { news: [...] }
 * - { itemsBySymbol: { AAPL:[...], TSLA:[...] } }  (bulk)
 */
function mapNews(raw: any): NewsItem[] {
  const flattened: any[] = [];

  const ibs = raw?.itemsBySymbol;
  if (ibs && typeof ibs === "object") {
    for (const k of Object.keys(ibs)) {
      const arr = (ibs as any)[k];
      if (!Array.isArray(arr)) continue;
      for (const x of arr) flattened.push({ ...x, symbol: x?.symbol ?? k });
    }
  } else {
    const items: any[] = Array.isArray(raw) ? raw : raw?.items ?? raw?.data ?? raw?.news ?? [];
    if (Array.isArray(items)) flattened.push(...items);
  }

  const mapped = flattened
    .map((x: any) => {
      const tsRaw =
        x.ts ??
        x.published ??
        x.published_at ??
        x.publishedAt ??
        x.time ??
        x.created_at ??
        x.datetime ??
        x.date ??
        x.timestamp ??
        "";

      const ts = normalizeTs(tsRaw);

      const headline = String(x.headline || x.title || x.text || x.summary || "").trim();
      const source = String(x.source || x.publisher || x.site || x.provider || "").trim();
      const symbol = String(x.symbol || x.ticker || x.sym || x.symbols?.[0] || "").trim();
      const url = String(x.url || x.link || x.article_url || x.news_url || x.original_url || "").trim();
      const summary = String(x.summary || x.description || x.body || "").trim();

      if (!headline) return null;

      const id = buildStableId({ symbol, headline, source, url, ts });

      return { id, ts: ts || "", headline, source, symbol, url, summary } as NewsItem;
    })
    .filter(Boolean) as NewsItem[];

  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of mapped) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }

  return out;
}

type Props = {
  symbol?: string;
  asset?: AssetType;
  className?: string;
};

// ultra-compact, consistent "terminal pill"
function pillBase() {
  return "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none";
}

function chipBtn(active: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none transition",
    active ? "border-white/10 bg-white/80 text-black" : "border-white/10 bg-black/30 text-white/75 hover:bg-white/10"
  );
}

export default function NewsFeed({ symbol, asset = "stock", className }: Props) {
  const sym = useMemo(() => (symbol || "").toUpperCase().trim(), [symbol]);

  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [detached, setDetached] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 160, y: 100 });
  const dragRef = useRef<{ ox: number; oy: number } | null>(null);
  function onDragStart(e: React.PointerEvent) { e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { ox: e.clientX - dragPos.x, oy: e.clientY - dragPos.y }; }
  function onDragMove(e: React.PointerEvent) { if (!dragRef.current) return; setDragPos({ x: e.clientX - dragRef.current.ox, y: e.clientY - dragRef.current.oy }); }
  function onDragEnd() { dragRef.current = null; }

  function fireTradeAction(action: "BUY" | "SELL", tradeSym: string) {
    const a: AssetType = tradeSym.includes("-USD") ? "crypto" : asset;
    try {
      window.dispatchEvent(new CustomEvent("imynted:tradeAction", { detail: { action, asset: a, symbol: tradeSym } }));
      window.dispatchEvent(new CustomEvent("imynted:trade", { detail: { action, asset: a, symbol: tradeSym } }));
    } catch {}
  }

  const [q, setQ] = useState("");
  const [onlySymbol, setOnlySymbol] = useState(false);
  const [showNewOnly, setShowNewOnly] = useState(false);

  const [seenIds, setSeenIds] = useState<Record<string, number>>({});
  const listRef = useRef<HTMLDivElement | null>(null);

  const [notice, setNotice] = useState<string>("");

  const lastFetchAtRef = useRef<number>(0);
  const didInitOnlyRef = useRef(false);

  const forceCrypto = useMemo(() => asset === "crypto" || looksLikeCrypto(sym), [asset, sym]);

  const symForCompare = useMemo(() => {
    if (!sym) return "";
    return forceCrypto ? cryptoBase(sym) : sym;
  }, [sym, forceCrypto]);

  // IMPORTANT: for /api/market/news we still use a symbol string; for crypto we use base (BTC, ETH)
  const symForApi = useMemo(() => {
    if (!sym) return "";
    return forceCrypto ? cryptoBase(sym) : sym;
  }, [sym, forceCrypto]);

  // ✅ Only auto-enable once when a symbol first appears (do NOT fight the user afterwards).
  useEffect(() => {
    if (didInitOnlyRef.current) return;
    if (symForCompare) {
      setOnlySymbol(true);
      didInitOnlyRef.current = true;
    }
  }, [symForCompare]);

  const STORAGE_KEY = symForCompare
    ? `msa_news_seen_${forceCrypto ? "crypto" : "stock"}_${symForCompare}`
    : `msa_news_seen_${forceCrypto ? "crypto" : "stock"}_all`;

  useEffect(() => {
    try {
      const loaded = safeJsonParse<Record<string, number>>(localStorage.getItem(STORAGE_KEY), {});
      setSeenIds(loaded || {});
    } catch {
      setSeenIds({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [STORAGE_KEY]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seenIds));
    } catch {}
  }, [STORAGE_KEY, seenIds]);

  const refreshMs = useMemo(() => (forceCrypto ? 60_000 : 12_000), [forceCrypto]);
  const minIntervalMs = useMemo(() => (forceCrypto ? 20_000 : 5_000), [forceCrypto]);

  const abortRef = useRef<AbortController | null>(null);

  const defaultSymbols = useMemo(() => {
    return forceCrypto
      ? ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE"]
      : ["SPY", "AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "META", "GOOG", "AMD", "PLTR"];
  }, [forceCrypto]);

  async function fetchNews(opts?: { userInitiated?: boolean }) {
    const now = Date.now();
    const since = now - (lastFetchAtRef.current || 0);

    if (since < minIntervalMs) {
      if (opts?.userInitiated) {
        const wait = Math.ceil((minIntervalMs - since) / 1000);
        setNotice(`Cooling down… ~${wait}s`);
      }
      return;
    }

    setLoading(true);
    setErr("");
    setNotice("");

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const base = forceCrypto ? "/api/crypto/news" : "/api/market/news";

      // If no focused symbol, use BULK request so "All news" isn’t secretly AAPL.
      let url = base;
      if (symForApi) {
        url = `${base}?symbol=${encodeURIComponent(symForApi)}`;
      } else if (!forceCrypto) {
        url = `${base}?symbols=${encodeURIComponent(defaultSymbols.join(","))}`;
      } else {
        url = `${base}?symbol=${encodeURIComponent(defaultSymbols[0] || "BTC")}`;
      }

      const res = await fetch(url, { cache: "no-store", signal: ac.signal });
      const raw = await res.json().catch(() => ({}));

      if (raw?.warning) {
        const ra = raw?.retryAfterSec ? ` • ~${raw.retryAfterSec}s` : "";
        setNotice(String(raw.warning) + ra);
      }

      if (!res.ok || raw?.ok === false) {
        throw new Error(raw?.error || `News API ${res.status}`);
      }

      const mapped = mapNews(raw);

      // Sort by time desc; items without parseable ts sink but still show.
      mapped.sort((a, b) => (ms(b.ts) || 0) - (ms(a.ts) || 0));

      setItems(mapped);
      lastFetchAtRef.current = Date.now();
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setErr(e?.message || "Failed to load news");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    fetchNews();

    const t = setInterval(() => {
      if (!alive) return;
      fetchNews();
    }, refreshMs);

    return () => {
      alive = false;
      clearInterval(t);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symForApi, refreshMs, forceCrypto, minIntervalMs]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return items.filter((x) => {
      if (onlySymbol && symForCompare) {
        const itemSym = normSym(x.symbol || "");
        if (itemSym) {
          const itemCompare = forceCrypto ? cryptoBase(itemSym) : itemSym;
          if (itemCompare !== symForCompare) return false;
        } else {
          if (forceCrypto) return false;
        }
      }

      if (needle) {
        const blob = `${x.symbol || ""} ${x.headline || ""} ${x.source || ""} ${x.summary || ""}`.toLowerCase();
        if (!blob.includes(needle)) return false;
      }

      const isNew = !seenIds[x.id];
      if (showNewOnly && !isNew) return false;

      return true;
    });
  }, [items, q, onlySymbol, symForCompare, showNewOnly, seenIds, forceCrypto]);

  const newCount = useMemo(
    () => filtered.reduce((n0, x) => n0 + (!seenIds[x.id] ? 1 : 0), 0),
    [filtered, seenIds]
  );

  // --------------------------- SPIKE DETECTION ---------------------------
  // Make spikes feel like "ticker heat", not a warning banner:
  // - detect per-symbol bursts within 10m window
  // - surface ONLY on the symbol chip line (subtle)
  const spikeWindowMs = 10 * 60 * 1000;
  const spikeThreshold = 3;

  const spikeById = useMemo(() => {
    const now = Date.now();

    const group: Record<string, NewsItem[]> = {};
    for (const it of items) {
      const s0 = normSym(it.symbol || "");
      const key = s0 ? (forceCrypto ? cryptoBase(s0) : s0) : "";
      if (!key) continue;
      (group[key] ||= []).push(it);
    }

    const out: Record<string, { count: number }> = {};

    for (const key of Object.keys(group)) {
      const arr = group[key].slice().sort((a, b) => (ms(b.ts) || 0) - (ms(a.ts) || 0));
      const times = arr.map((x) => ms(x.ts)).filter((t) => t > 0);

      for (let i = 0; i < arr.length; i++) {
        const t0 = ms(arr[i].ts);
        if (!t0) continue;

        // keep it within last 45m
        if (now - t0 > 45 * 60 * 1000) continue;

        const lo = t0 - spikeWindowMs;
        const hi = t0 + 45_000;

        let c = 0;
        for (const tt of times) {
          if (tt >= lo && tt <= hi) c++;
        }

        if (c >= spikeThreshold) out[arr[i].id] = { count: c };
      }
    }

    return out;
  }, [items, forceCrypto]);

  function openItem(x: NewsItem) {
    setSeenIds((prev) => ({ ...prev, [x.id]: Date.now() }));
    if (x.url && x.url !== "#") window.open(x.url, "_blank", "noopener,noreferrer");
  }

  function markVisibleRead() {
    const now = Date.now();
    setSeenIds((prev) => {
      const next = { ...prev };
      for (const x of filtered) next[x.id] = now;
      return next;
    });
  }

  // ✅ APL-friendly: B to open selected? not needed here; keep mouse-first.
  // Keep keyboard focus clean: the list is scrollable and click-to-open.

  // Visual mode: force "tape-like", no big blocks
  const newsBody = (
    <div className={cn("h-full min-h-0 flex flex-col", className)}>
      {/* Header / controls — tight + quiet */}
      <div className="shrink-0 border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex items-center gap-2">
            <div className="text-[12px] font-semibold text-white/90">News</div>

            {symForCompare ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/85">
                {forceCrypto ? `${symForCompare} · CRYPTO` : symForCompare}
              </span>
            ) : (
              <span className="text-[10px] text-white/45">All</span>
            )}

            {newCount > 0 ? (
              <span className={cn(pillBase(), "border-sky-500/25 bg-sky-500/10 text-sky-200")}>{newCount} NEW</span>
            ) : null}

            {notice ? <span className="text-[10px] text-yellow-200/70">{notice}</span> : null}
            {err ? <span className="text-[10px] text-rose-200/80">{err}</span> : null}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              className={chipBtn(false)}
              onClick={() => fetchNews({ userInitiated: true })}
              disabled={loading}
              title="Refresh"
              type="button"
            >
              {loading ? "…" : "↻"}
              <span className="text-white/40 font-medium">{Math.round(refreshMs / 1000)}s</span>
            </button>

            <button className={chipBtn(false)} onClick={markVisibleRead} title="Mark visible as read" type="button">
              Read
            </button>

            <button
              onClick={() => setDetached((v) => !v)}
              title={detached ? "Dock" : "Detach"}
              className="flex items-center justify-center rounded border border-white/10 bg-white/5 px-1.5 py-1 text-[11px] text-white/50 hover:bg-white/10 hover:text-white/80 transition"
              type="button"
            >
              ⧉
            </button>
          </div>
        </div>

        <div className="px-3 pb-2 flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter…"
            autoComplete="off"
            spellCheck={false}
            className={cn(
              "h-8 w-[220px] rounded-xl border border-white/10 px-3 text-[12px] outline-none",
              "bg-black/30 text-white/85 caret-white placeholder:text-white/35",
              "focus:ring-2 focus:ring-white/10"
            )}
          />

          <button
            type="button"
            onClick={() => setOnlySymbol((v) => !v)}
            className={chipBtn(onlySymbol)}
            title="Toggle symbol filter"
          >
            Only {symForCompare ? symForCompare : "SYM"}
          </button>

          <button
            type="button"
            onClick={() => setShowNewOnly((v) => !v)}
            className={chipBtn(showNewOnly)}
            title="Toggle NEW-only"
          >
            NEW
          </button>
        </div>
      </div>

      {/* List — tape-like rows */}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 && !loading ? (
          <div className="p-4 text-[12px] text-white/55">No news.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((x) => {
              const isNew = !seenIds[x.id];
              const spike = spikeById[x.id];
              const spikeCount = spike?.count ?? 0;
              const showSpike = spikeCount >= spikeThreshold;

              const symTag = x.symbol ? normSym(x.symbol) : "";
              const displayTs = x.ts && ms(x.ts) > 0 ? x.ts : "";

              return (
                <div
                  key={x.id}
                  role="button" tabIndex={0}
                  onClick={() => openItem(x)}
                  className={cn(
                    "w-full text-left cursor-pointer",
                    "hover:bg-white/[0.045] focus:outline-none focus:bg-white/[0.06]"
                  )}
                >
                  <div className={cn("px-3", "py-2")}>
                    <div className="flex items-start gap-3">
                      {/* left */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {isNew ? (
                            <span className={cn(pillBase(), "border-white/10 bg-white/5 text-white")}>NEW</span>
                          ) : null}

                          {symTag ? (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                              {symTag}
                            </span>
                          ) : null}

                          {showSpike ? (
                            <span
                              className={cn(pillBase(), "border-amber-500/25 bg-amber-500/10 text-amber-200")}
                              title={`Spike: ${spikeCount} items in ~10m`}
                            >
                              ⚡ {spikeCount}
                            </span>
                          ) : null}

                          {x.source ? <span className="text-[10px] text-white/45 truncate">{x.source}</span> : null}
                        </div>

                        <div className={cn("mt-1 text-[13px] leading-snug", isNew ? "text-white/95 font-semibold" : "text-white/85")}>
                          {x.headline}
                        </div>

                        {x.summary ? (
                          <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-white/45">{x.summary}</div>
                        ) : null}

                        {/* Trade buttons — shown when article has a symbol */}
                        {symTag ? (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <button type="button"
                              className="h-5 rounded-sm border border-emerald-400/25 bg-emerald-400/[0.08] px-2.5 text-[8px] font-bold text-emerald-300 hover:bg-emerald-400/15 transition-colors"
                              onClick={(e) => { e.stopPropagation(); fireTradeAction("BUY", symTag); }}>BUY {symTag}</button>
                            <button type="button"
                              className="h-5 rounded-sm border border-red-400/25 bg-red-400/[0.08] px-2.5 text-[8px] font-bold text-red-300 hover:bg-red-400/15 transition-colors"
                              onClick={(e) => { e.stopPropagation(); fireTradeAction("SELL", symTag); }}>SELL {symTag}</button>
                          </div>
                        ) : null}
                      </div>

                      {/* right time */}
                      <div className="shrink-0 text-right tabular-nums min-w-[56px]">
                        <div className="text-[11px] text-white/60">{displayTs ? hhmm(displayTs) : "—"}</div>
                        <div className="text-[11px] text-white/45">{displayTs ? timeAgo(displayTs) : ""}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const portal = detached && typeof window !== "undefined"
    ? createPortal(
        <div
          style={{
            position: "fixed",
            left: dragPos.x,
            top: dragPos.y,
            width: 600,
            height: 560,
            zIndex: 9999,
            borderRadius: 10,
            overflow: "hidden",
            border: "1px solid rgba(52,211,153,0.08)",
            boxShadow: "0 0 0 1px rgba(52,211,153,0.05), 0 24px 60px rgba(0,0,0,0.75)",
            background: "linear-gradient(135deg, #050d14 0%, #060e18 60%, #050c12 100%)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 10, background: "radial-gradient(ellipse 70% 35% at 8% 0%, rgba(52,211,153,0.08) 0%, transparent 100%)" }} />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 10, background: "radial-gradient(ellipse 40% 30% at 92% 100%, rgba(34,211,238,0.05) 0%, transparent 100%)" }} />
          <div
            style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.07) 0%, transparent 60%)", borderBottom: "1px solid rgba(52,211,153,0.08)", padding: "6px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "grab", userSelect: "none", flexShrink: 0 }}
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
          >
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(52,211,153,0.9)" }}>iMYNTED NEWS</span>
            <button onClick={() => setDetached(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>×</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            {newsBody}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {!detached && newsBody}
      {portal}
    </>
  );
}