"use client";

import { useEffect, useMemo, useState } from "react";

type Article = {
  title: string;
  description: string | null;
  url: string;
  source: string; // domain like finance.yahoo.com
  publishedAt: string | null;
  guid: string;
  tickers: string[];
};

function prettySource(domain: string) {
  const map: Record<string, string> = {
    "finance.yahoo.com": "Yahoo Finance",
    "fool.com": "Motley Fool",
    "thestreet.com": "TheStreet",
    "freep.com": "Detroit Free Press",
  };
  return map[domain] ?? domain;
}

export default function NewsFeed({ defaultTickers = "AAPL,TSLA" }: { defaultTickers?: string }) {
  const [tickers, setTickers] = useState(defaultTickers);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tickersParam = useMemo(
    () => tickers.split(",").map((t) => t.trim()).filter(Boolean).join(","),
    [tickers]
  );

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`/api/prices?tickers=${encodeURIComponent(tickersParam)}`)
      .then((r) => r.json())
      .then((data) => setArticles(data.articles ?? []))
      .catch((e) => setError(e?.message ?? "Failed to load news"))
      .finally(() => setLoading(false));
  }, [tickersParam]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Market News</h2>
        <input
          value={tickers}
          onChange={(e) => setTickers(e.target.value)}
          placeholder="Tickers (comma separated) e.g. AAPL,TSLA"
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            outline: "none",
          }}
        />
      </div>

      {loading ? <div style={{ marginTop: 12 }}>Loading…</div> : null}
      {error ? <div style={{ marginTop: 12, color: "crimson" }}>{error}</div> : null}

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {articles.map((a) => (
          <a
            key={a.guid}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              padding: 14,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ fontWeight: 800 }}>{a.title}</div>

            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
              {prettySource(a.source)}
              {a.publishedAt ? ` • ${new Date(a.publishedAt).toLocaleString()}` : ""}
              {a.tickers?.length ? ` • ${a.tickers.join(", ")}` : ""}
            </div>

            {a.description ? (
              <div style={{ marginTop: 10, fontSize: 14, opacity: 0.9 }}>
                {a.description}
              </div>
            ) : null}
          </a>
        ))}
      </div>
    </div>
  );
}
