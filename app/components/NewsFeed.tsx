"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

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
      const ts =
        x.ts ||
        x.published_at ||
        x.publishedAt ||
        x.time ||
        x.created_at ||
        x.datetime ||
        "";
      const headline = x.headline || x.title || x.text || x.summary || "";
      const source = x.source || x.publisher || x.site || x.provider || "";
      const symbol = x.symbol || x.ticker || x.sym || x.symbols?.[0] || "";
      const url = x.url || x.link || x.article_url || x.news_url || "";
      const id = String(x.id || x.news_id || x.guid || `${symbol}-${ts}-${i}`);
      const summary = x.summary || x.description || x.body || "";
      return { id, ts, headline, source, symbol, url, summary };
    })
    .filter((x: NewsItem) => x.headline);
}

type Props = {
  symbol?: string;
  className?: string;
};

export default function NewsFeed({ symbol, className }: Props) {
  const sym = useMemo(() => (symbol || "").toUpperCase().trim(), [symbol]);

  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  // filter bar
  const [q, setQ] = useState("");
  const [onlySymbol, setOnlySymbol] = useState(Boolean(sym));
  const [showNewOnly, setShowNewOnly] = useState(false);

  // ✅ FIX: start empty; load from localStorage AFTER mount
  const [seenIds, setSeenIds] = useState<Record<string, number>>({});

  const listRef = useRef<HTMLDivElement | null>(null);

  // per-symbol key
  const STORAGE_KEY = sym ? `msa_news_seen_${sym}` : "msa_news_seen_all";

  // ✅ FIX: read localStorage only on client
  useEffect(() => {
    try {
      const loaded = safeJsonParse<Record<string, number>>(localStorage.getItem(STORAGE_KEY), {});
      setSeenIds(loaded || {});
    } catch {
      setSeenIds({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [STORAGE_KEY]);

  // persist seen ids
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seenIds));
    } catch {}
  }, [STORAGE_KEY, seenIds]);

  async function fetchNews() {
    setLoading(true);
    setErr("");
    try {
      const url = sym ? `/api/market/news?symbol=${encodeURIComponent(sym)}` : `/api/market/news`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`News API ${res.status}`);
      const raw = await res.json();
      const mapped = mapNews(raw);

      mapped.sort(
        (a, b) => (new Date(b.ts).getTime() || 0) - (new Date(a.ts).getTime() || 0)
      );

      setItems(mapped);
    } catch (e: any) {
      setErr(e?.message || "Failed to load news");
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
    }, 12_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((x) => {
      if (onlySymbol && sym && x.symbol && x.symbol.toUpperCase() !== sym) return false;

      if (needle) {
        const blob = `${x.symbol || ""} ${x.headline || ""} ${x.source || ""} ${x.summary || ""}`.toLowerCase();
        if (!blob.includes(needle)) return false;
      }

      const isNew = !seenIds[x.id];
      if (showNewOnly && !isNew) return false;

      return true;
    });
  }, [items, q, onlySymbol, sym, showNewOnly, seenIds]);

  const newCount = useMemo(
    () => filtered.reduce((n, x) => n + (!seenIds[x.id] ? 1 : 0), 0),
    [filtered, seenIds]
  );

  function openItem(x: NewsItem) {
    setSeenIds((prev) => ({ ...prev, [x.id]: Date.now() }));
    if (x.url) window.open(x.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={cn("h-full min-h-0 flex flex-col", className)}>
      {/* Sticky header + filter bar */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">News</div>
            {sym && (
              <span className="rounded-md border border-white/10 px-2 py-0.5 text-[11px] font-medium">
                {sym}
              </span>
            )}
            {newCount > 0 && (
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-semibold">
                {newCount} NEW
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-muted"
              onClick={fetchNews}
              disabled={loading}
              title="Refresh"
            >
              {loading ? "..." : "↻"}
            </button>
            <button
              className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-muted"
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
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter headlines…"
            className="h-8 w-[260px] rounded-md border border-white/10 bg-background px-2 text-sm outline-none focus:ring-2"
          />

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={onlySymbol}
              onChange={(e) => setOnlySymbol(e.target.checked)}
            />
            Only {sym ? sym : "symbol"}
          </label>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showNewOnly}
              onChange={(e) => setShowNewOnly(e.target.checked)}
            />
            NEW only
          </label>

          {err ? <span className="text-xs text-red-500">{err}</span> : null}
        </div>
      </div>

      {/* Scroll inside card */}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 && !loading ? (
          <div className="p-4 text-sm text-muted-foreground">No news found.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {filtered.map((x) => {
              const isNew = !seenIds[x.id];
              return (
                <button
                  key={x.id}
                  onClick={() => openItem(x)}
                  className="w-full text-left hover:bg-muted/50"
                >
                  <div className="px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {isNew && (
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold">
                              NEW
                            </span>
                          )}
                          {x.symbol ? (
                            <span className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-medium">
                              {String(x.symbol).toUpperCase()}
                            </span>
                          ) : null}
                          {x.source ? (
                            <span className="text-[11px] text-muted-foreground">{x.source}</span>
                          ) : null}
                        </div>

                        <div className={cn("mt-1 text-sm leading-snug", isNew && "font-semibold")}>
                          {x.headline}
                        </div>

                        {x.summary ? (
                          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {x.summary}
                          </div>
                        ) : null}
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[11px] text-muted-foreground">{hhmm(x.ts)}</div>
                        <div className="text-[11px] text-muted-foreground">{timeAgo(x.ts)}</div>
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
