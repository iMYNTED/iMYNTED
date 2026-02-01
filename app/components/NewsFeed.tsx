"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type AssetType = "stock" | "crypto";

type NewsItem = {
  id: string;
  ts: string;
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

function mapNews(raw: any): NewsItem[] {
  const items: any[] = Array.isArray(raw) ? raw : raw?.items ?? raw?.data ?? raw?.news ?? [];
  return (items || [])
    .map((x: any, i: number) => {
      const ts = x.ts || x.published_at || x.publishedAt || x.time || x.created_at || x.datetime || "";
      const headline = x.headline || x.title || x.text || x.summary || "";
      const source = x.source || x.publisher || x.site || x.provider || "";
      const symbol = x.symbol || x.ticker || x.sym || x.symbols?.[0] || "";
      const url = x.url || x.link || x.article_url || x.news_url || x.original_url || "";
      const id = String(x.id || x.news_id || x.guid || `${symbol}-${ts}-${i}`);
      const summary = x.summary || x.description || x.body || "";
      return { id, ts, headline, source, symbol, url, summary };
    })
    .filter((x: NewsItem) => x.headline);
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

type Props = {
  symbol?: string;
  asset?: AssetType;
  className?: string;
};

export default function NewsFeed({ symbol, asset = "stock", className }: Props) {
  const sym = useMemo(() => (symbol || "").toUpperCase().trim(), [symbol]);

  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const [q, setQ] = useState("");
  const [onlySymbol, setOnlySymbol] = useState(Boolean(sym));
  const [showNewOnly, setShowNewOnly] = useState(false);

  const [seenIds, setSeenIds] = useState<Record<string, number>>({});
  const listRef = useRef<HTMLDivElement | null>(null);

  const [notice, setNotice] = useState<string>("");

  const lastFetchAtRef = useRef<number>(0);

  const forceCrypto = useMemo(() => asset === "crypto" || looksLikeCrypto(sym), [asset, sym]);

  const symForCompare = useMemo(() => {
    if (!sym) return "";
    return forceCrypto ? cryptoBase(sym) : sym;
  }, [sym, forceCrypto]);

  const symForApi = useMemo(() => {
    if (!sym) return "";
    return forceCrypto ? cryptoBase(sym) : sym;
  }, [sym, forceCrypto]);

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

  async function fetchNews(opts?: { userInitiated?: boolean }) {
    const now = Date.now();
    const since = now - (lastFetchAtRef.current || 0);

    if (since < minIntervalMs) {
      if (opts?.userInitiated) {
        const wait = Math.ceil((minIntervalMs - since) / 1000);
        setNotice(`Cooling down… try again in ~${wait}s.`);
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
      const url = symForApi ? `${base}?symbol=${encodeURIComponent(symForApi)}` : base;

      const res = await fetch(url, { cache: "no-store", signal: ac.signal });
      const raw = await res.json().catch(() => ({}));

      if (raw?.warning) {
        const ra = raw?.retryAfterSec ? ` Retry in ~${raw.retryAfterSec}s.` : "";
        setNotice(String(raw.warning) + ra);
      }

      if (!res.ok || raw?.ok === false) {
        throw new Error(raw?.error || `News API ${res.status}`);
      }

      const mapped = mapNews(raw);
      mapped.sort((a, b) => (new Date(b.ts).getTime() || 0) - (new Date(a.ts).getTime() || 0));

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
        const itemSym = (x.symbol || "").toUpperCase().trim();

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

  const newCount = useMemo(() => filtered.reduce((n, x) => n + (!seenIds[x.id] ? 1 : 0), 0), [filtered, seenIds]);

  function openItem(x: NewsItem) {
    setSeenIds((prev) => ({ ...prev, [x.id]: Date.now() }));
    if (x.url) window.open(x.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={cn("h-full min-h-0 flex flex-col", className)}>
      {/* ✅ FIX: remove bg-background (white) */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-white">News</div>

            {symForCompare && (
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white">
                {forceCrypto ? `${symForCompare} (CRYPTO)` : symForCompare}
              </span>
            )}

            {newCount > 0 && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-white">
                {newCount} NEW
              </span>
            )}

            <span className="ml-1 text-[11px] text-white/60">Refresh {Math.round(refreshMs / 1000)}s</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10"
              onClick={() => fetchNews({ userInitiated: true })}
              disabled={loading}
              title="Refresh"
            >
              {loading ? "..." : "↻"}
            </button>
            <button
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10"
              onClick={() => {
                const now = Date.now();
                const next = { ...seenIds };
                for (const x of filtered) next[x.id] = now;
                setSeenIds(next);
              }}
              title="Mark all as read"
            >
              Read
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
          {/* ✅ FIX: dark filter input */}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter headlines…"
            autoComplete="off"
            spellCheck={false}
            className={cn(
              "h-8 w-[260px] rounded-md border border-white/10 px-2 text-sm outline-none",
              "bg-black/35 text-white caret-white placeholder:text-white/40",
              "focus:ring-2 focus:ring-white/20"
            )}
          />

          <label className="flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={onlySymbol}
              onChange={(e) => setOnlySymbol(e.target.checked)}
              className="accent-white"
            />
            Only {symForCompare ? symForCompare : "symbol"}
          </label>

          <label className="flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={showNewOnly}
              onChange={(e) => setShowNewOnly(e.target.checked)}
              className="accent-white"
            />
            NEW only
          </label>

          {notice ? <span className="text-xs text-yellow-300">{notice}</span> : null}
          {err ? <span className="text-xs text-red-500">{err}</span> : null}
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 && !loading ? (
          <div className="p-4 text-sm text-white/60">No news found.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {filtered.map((x) => {
              const isNew = !seenIds[x.id];
              return (
                <button key={x.id} onClick={() => openItem(x)} className="w-full text-left hover:bg-white/5">
                  <div className="px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {isNew && (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white">
                              NEW
                            </span>
                          )}
                          {x.symbol ? (
                            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white">
                              {String(x.symbol).toUpperCase()}
                            </span>
                          ) : null}
                          {x.source ? <span className="text-[11px] text-white/60">{x.source}</span> : null}
                        </div>

                        <div className={cn("mt-1 text-sm leading-snug text-white/90", isNew && "font-semibold")}>
                          {x.headline}
                        </div>

                        {x.summary ? <div className="mt-1 line-clamp-2 text-xs text-white/60">{x.summary}</div> : null}
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[11px] text-white/60">{hhmm(x.ts)}</div>
                        <div className="text-[11px] text-white/60">{timeAgo(x.ts)}</div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
