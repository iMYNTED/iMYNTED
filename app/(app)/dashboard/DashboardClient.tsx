"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Article = {
  title: string;
  description: string | null;
  url: string | null;
  source: string;
  publishedAt: string | null;
};

type AlertItem = {
  id: string;
  severity: "High" | "Medium" | "Low";
  title: string;
  detail: string;
  created_at: string;
};

export default function DashboardClient({
  initialEmail,
  accountsConnected,
  alerts,
}: {
  initialEmail: string | null;
  accountsConnected: number;
  alerts: AlertItem[];
}) {
  const router = useRouter();
  const [email] = useState(initialEmail);
  const [news, setNews] = useState<Article[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);

  useEffect(() => {
    async function loadNews() {
      try {
        const res = await fetch("/api/prices?tickers=AAPL,TSLA");
        const json = await res.json();
        if (json.ok) setNews(json.articles);
      } catch (err) {
        console.error("Failed to load news", err);
      } finally {
        setLoadingNews(false);
      }
    }

    loadNews();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Command Center</h1>
          <p className="text-sm text-zinc-400">Logged in as {email}</p>
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          className="rounded-md bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
        >
          Sign out
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard label="Accounts Connected" value={accountsConnected.toString()} />
        <StatCard label="Open Positions" value="17" />
        <StatCard label="Active Alerts" value={alerts.length.toString()} />
      </div>

      {/* Market News */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 mb-10">
        <div className="border-b border-zinc-800 px-6 py-4">
          <h2 className="text-lg font-medium">Market News</h2>
        </div>

        <div className="divide-y divide-zinc-800">
          {loadingNews ? (
            <div className="px-6 py-6 text-sm text-zinc-400">
              Loading news…
            </div>
          ) : news.length === 0 ? (
            <div className="px-6 py-6 text-sm text-zinc-400">
              No news available.
            </div>
          ) : (
            news.slice(0, 8).map((article, i) => (
              <a
                key={i}
                href={article.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="block px-6 py-4 hover:bg-zinc-800 transition"
              >
                <p className="font-medium">{article.title}</p>
                {article.description && (
                  <p className="text-sm text-zinc-400 mt-1 line-clamp-2">
                    {article.description}
                  </p>
                )}
                <div className="text-xs text-zinc-500 mt-1">
                  {article.source}
                  {article.publishedAt
                    ? ` • ${new Date(article.publishedAt).toLocaleString()}`
                    : ""}
                </div>
              </a>
            ))
          )}
        </div>
      </div>

      {/* Alerts */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">Live Alerts</h2>
          <button
            onClick={() => router.push("/alerts")}
            className="text-sm text-zinc-400 hover:text-white"
          >
            View all
          </button>
        </div>

        <div className="divide-y divide-zinc-800">
          {alerts.length === 0 ? (
            <div className="px-6 py-8 text-sm text-zinc-400">
              No alerts yet.
            </div>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="px-6 py-4 flex justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2">
                    <SeverityDot level={alert.severity} />
                    <p className="font-medium">{alert.title}</p>
                  </div>
                  <p className="text-sm text-zinc-400">{alert.detail}</p>
                </div>

                <div className="text-sm text-zinc-500 whitespace-nowrap">
                  {new Date(alert.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
      <p className="text-sm text-zinc-400 mb-1">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SeverityDot({ level }: { level: "High" | "Medium" | "Low" }) {
  const color =
    level === "High"
      ? "bg-red-500"
      : level === "Medium"
      ? "bg-yellow-500"
      : "bg-green-500";

  return <span className={`h-2 w-2 rounded-full ${color}`} />;
}



