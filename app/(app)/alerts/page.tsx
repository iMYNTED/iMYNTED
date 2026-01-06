"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Alert = {
  id: string;
  severity: "High" | "Medium" | "Low";
  title: string;
  detail: string;
  created_at: string;
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<"All" | "High" | "Medium" | "Low">("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAlerts = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setAlerts(data);
      }

      setLoading(false);
    };

    loadAlerts();
  }, []);

  const visibleAlerts =
    filter === "All"
      ? alerts
      : alerts.filter((a) => a.severity === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Alerts</h1>

        <div className="flex gap-2">
          {["All", "High", "Medium", "Low"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-3 py-1 rounded text-sm ${
                filter === f
                  ? "bg-white text-black"
                  : "bg-zinc-800 text-zinc-300 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-zinc-400">Loading alerts…</p>}

      {!loading && visibleAlerts.length === 0 && (
        <p className="text-zinc-400">No alerts found.</p>
      )}

      <div className="space-y-3">
        {visibleAlerts.map((alert) => (
          <div
            key={alert.id}
            className="rounded border border-zinc-800 bg-zinc-900 p-4"
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-semibold ${
                  alert.severity === "High"
                    ? "text-red-400"
                    : alert.severity === "Medium"
                    ? "text-yellow-400"
                    : "text-green-400"
                }`}
              >
                {alert.severity}
              </span>
              <span className="text-xs text-zinc-500">
                {new Date(alert.created_at).toLocaleString()}
              </span>
            </div>

            <h3 className="mt-1 font-medium">{alert.title}</h3>
            <p className="text-sm text-zinc-400">{alert.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

