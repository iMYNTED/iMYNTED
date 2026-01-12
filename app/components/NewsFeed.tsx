"use client";

import React, { useEffect, useMemo, useState } from "react";

type NewsItem = {
  id?: string;
  title: string;
  source?: string;
  published?: string;
  summary?: string;
  url?: string;
};

type NewsResponse = {
  provider?: string;
  symbol?: string;
  items?: NewsItem[];
  ts?: string;
  error?: string;
};

export default function NewsFeed({ symbol }: { symbol: string }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sym = useMemo(() => (symbol || "AAPL").toUpperCase(), [symbol]);

  async function fetchNow() {
    setLoading(true);
    setErr(null);

    try {
      // ✅ ONLY endpoint (confirmed working in your browser)
      const url = `/api/market/news?symbol=${encodeURIComponent(sym)}`;
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) {
        setErr(`${url} → HTTP ${res.status}`);
        return; // keep last good list
      }

      const json = (await res.json()) as NewsResponse;
      const list = Array.isArray(json.items) ? json.items : [];

      if (list.length) setItems(list);
      else if (!items.length) setErr("No news returned");
    } catch (e: any) {
      if (!items.length) setErr(e?.message ?? "Failed to load news");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNow();
    const t = setInterval(fetchNow, 12_000); // refresh every 12s
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym]);

  return (
    <div className="space-y-2">
      {/* Compact header */}
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold text-white/80">
          Live News Feed • {sym}
        </div>
        <div className="text-[11px] text-white/45">
          {loading ? "Updating…" : ""}
        </div>
      </div>

      {/* Compact scroll container */}
      <div className="rounded-2xl border border-white/10 bg-black/30">
        {err && (
          <div className="border-b border-white/10 bg-white/5 px-3 py-2 text-[11px] text-red-300">
            News error: {err}
          </div>
        )}

        <div className="max-h-[360px] overflow-auto p-2">
          {items.length === 0 ? (
            <div className="px-2 py-3 text-[12px] text-white/45">
              No news yet.
            </div>
          ) : (
            <div className="space-y-2">
              {items.slice(0, 18).map((n, idx) => (
                <a
                  key={n.id ?? `${idx}-${n.title}`}
                  href={n.url ?? "#"}
                  target={n.url && n.url !== "#" ? "_blank" : undefined}
                  rel={n.url && n.url !== "#" ? "noreferrer" : undefined}
                  className={[
                    "block rounded-xl border border-white/10 bg-black/40 p-3",
                    "hover:bg-white/5 transition-colors",
                  ].join(" ")}
                >
                  <div className="text-[12px] font-semibold text-white/85 line-clamp-2">
                    {n.title}
                  </div>

                  <div className="mt-1 text-[10px] text-white/45">
                    {(n.source ?? "Source").toString()}
                    {n.published ? ` • ${n.published}` : ""}
                  </div>

                  {n.summary ? (
                    <div className="mt-2 text-[11px] text-white/55 line-clamp-2">
                      {n.summary}
                    </div>
                  ) : null}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-3 py-2 text-[10px] text-white/35">
          Scroll for more • Click to open article
        </div>
      </div>
    </div>
  );
}
