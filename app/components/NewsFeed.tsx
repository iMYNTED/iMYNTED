"use client";

import React, { useEffect, useMemo, useState } from "react";

type NewsItem = {
  title: string;
  source?: string;
  url?: string;
  ts?: string;
};

type AnyNewsResponse =
  | { items?: NewsItem[]; news?: NewsItem[]; symbol?: string; provider?: string }
  | NewsItem[];

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function hhmm(ts?: string) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function NewsFeed({ symbol }: { symbol: string }) {
  const sym = useMemo(() => (symbol || "AAPL").toUpperCase().trim(), [symbol]);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    let alive = true;
    let t: any;

    async function poll() {
      try {
        setStatus("");

        // ✅ IMPORTANT: correct endpoint
        const res = await fetch(`/api/market/news?symbol=${encodeURIComponent(sym)}`, {
          cache: "no-store",
        });

        if (!alive) return;

        if (!res.ok) {
          setStatus(`HTTP ${res.status}`);
          setItems([]);
          return;
        }

        const json = (await res.json()) as AnyNewsResponse;

        let next: NewsItem[] = [];
        if (Array.isArray(json)) {
          next = json;
        } else if (Array.isArray(json.items)) {
          next = json.items;
        } else if (Array.isArray((json as any).news)) {
          next = (json as any).news;
        }

        setItems(next.slice(0, 50));
      } catch {
        if (!alive) return;
        setStatus("Fetch error");
        setItems([]);
      } finally {
        if (!alive) return;
        t = setTimeout(poll, 2500);
      }
    }

    poll();
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [sym]);

  return (
    <div className="h-full min-h-0 w-full">
      <div className="mb-2 flex items-center">
        <div className="text-[11px] text-white/45">News • {sym}</div>
        <div className="ml-auto text-[11px] text-white/35">
          {status ? <span className="text-red-300">{status}</span> : "live"}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20">
        {items.length === 0 ? (
          <div className="p-4 text-[12px] text-white/45">No news yet.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {items.map((n, idx) => (
              <a
                key={`${n.title}-${idx}`}
                href={n.url || "#"}
                target={n.url ? "_blank" : "_self"}
                rel="noreferrer"
                className={cn(
                  "block px-3 py-2 hover:bg-white/5",
                  !n.url && "cursor-default"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="text-[11px] tabular-nums text-white/40 w-[62px]">
                    {hhmm(n.ts)}
                  </div>
                  <div className="text-[12px] text-white/80 line-clamp-2">{n.title}</div>
                </div>
                <div className="mt-1 text-[10px] text-white/35">
                  {n.source ? n.source : "source"} {n.url ? "• open" : ""}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
