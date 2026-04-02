"use client";

import { useEffect, useRef, useState } from "react";

type Severity = "High" | "Medium" | "Low";
type AlertStatus = "active" | "triggered" | "dismissed";
type FilterTab = "All" | "Active" | "Triggered" | "High" | "Medium" | "Low";

type Alert = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  created_at: string;
  status: AlertStatus;
  symbol: string;
  condition: string;
  target: string;
};

type NewAlert = {
  symbol: string;
  condition: string;
  target: string;
  severity: Severity;
  note: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const SEVERITY_CONFIG: Record<Severity, { dot: string; badge: string; border: string; bg: string; label: string }> = {
  High:   { dot: "bg-red-400",     badge: "text-red-400",    border: "border-red-400/20",    bg: "bg-red-400/[0.06]",     label: "HIGH" },
  Medium: { dot: "bg-amber-400",   badge: "text-amber-400",  border: "border-amber-400/20",  bg: "bg-amber-400/[0.06]",   label: "MED"  },
  Low:    { dot: "bg-emerald-400", badge: "text-emerald-400",border: "border-emerald-400/20",bg: "bg-emerald-400/[0.06]", label: "LOW"  },
};

const CONDITIONS = ["Price ≥", "Price ≤", "% Change ≥", "% Change ≤", "Volume ≥", "Scanner Signal"];

const POPULAR_SYMBOLS = [
  "AAPL","MSFT","NVDA","TSLA","GOOGL","AMZN","META","NFLX","AMD","INTC",
  "JPM","BAC","GS","MS","WFC","C","V","MA","PYPL","SQ",
  "SPY","QQQ","IWM","DIA","VTI","ARKK","XLF","XLK","XLE","XLV",
  "BTC","ETH","SOL","XRP","DOGE","ADA","AVAX","BNB","MATIC","LINK",
  "AMGN","GILD","PFE","JNJ","MRNA","BNTX","ABBV","LLY","UNH","CVS",
  "UBER","LYFT","SNAP","PINS","TWTR","RBLX","HOOD","COIN","PLTR","SOFI",
];

const BLANK: NewAlert = { symbol: "", condition: "Price ≥", target: "", severity: "Medium", note: "" };
const STORAGE_KEY = "imynted_alerts_v1";

function loadFromStorage(): Alert[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}
function saveToStorage(alerts: Alert[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts)); } catch {}
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<FilterTab>("All");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NewAlert>(BLANK);
  const [symbolSuggestions, setSymbolSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const symbolInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setAlerts(loadFromStorage()); }, []);

  function updateAlerts(next: Alert[]) {
    setAlerts(next);
    saveToStorage(next);
  }

  // Symbol autocomplete
  function onSymbolChange(val: string) {
    const v = val.toUpperCase();
    setForm(f => ({ ...f, symbol: v }));
    if (v.length >= 1) {
      const matches = POPULAR_SYMBOLS.filter(s => s.startsWith(v)).slice(0, 8);
      setSymbolSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }

  function pickSymbol(sym: string) {
    setForm(f => ({ ...f, symbol: sym }));
    setShowSuggestions(false);
    symbolInputRef.current?.focus();
  }

  function createAlert() {
    if (!form.symbol.trim() || !form.target.trim()) return;
    const sym = form.symbol.toUpperCase().trim();
    const alert: Alert = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      severity: form.severity,
      title: `${sym} — ${form.condition} ${form.target}`,
      detail: form.note.trim() || `${form.condition} ${form.target}`,
      created_at: new Date().toISOString(),
      status: "active",
      symbol: sym,
      condition: form.condition,
      target: form.target,
    };
    updateAlerts([alert, ...alerts]);
    setCreating(false);
    setForm(BLANK);
  }

  function dismissAlert(id: string) {
    updateAlerts(alerts.map(a => a.id === id ? { ...a, status: "dismissed" } : a));
  }

  function deleteAlert(id: string) {
    updateAlerts(alerts.filter(a => a.id !== id));
    setDeleteId(null);
  }

  const visible = alerts.filter(a => {
    if (filter === "All") return true;
    if (filter === "Active") return a.status === "active";
    if (filter === "Triggered") return a.status === "triggered";
    return a.severity === filter;
  });

  const counts = {
    active: alerts.filter(a => a.status === "active").length,
    triggered: alerts.filter(a => a.status === "triggered").length,
  };

  return (
    <div className="min-h-screen px-6 py-6 overflow-y-auto"
      style={{ background: "linear-gradient(135deg, #050d14 0%, #060e18 55%, #050c12 100%)" }}>

      {/* Glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 55% 35% at 5% 0%, rgba(52,211,153,0.07) 0%, transparent 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 30% 20% at 95% 100%, rgba(34,211,238,0.04) 0%, transparent 100%)" }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold tracking-[0.14em] text-emerald-400/80 uppercase">iMYNTED</span>
            <span className="text-white/20">|</span>
            <h1 className="text-[18px] font-bold text-white tracking-wide">ALERTS</h1>
            {counts.active > 0 && (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 tabular-nums">
                {counts.active} active
              </span>
            )}
            {counts.triggered > 0 && (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 tabular-nums">
                {counts.triggered} triggered
              </span>
            )}
          </div>
          <button
            onClick={() => { setCreating(true); setForm(BLANK); setShowSuggestions(false); }}
            className="flex items-center gap-2 rounded border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-400/[0.18] transition-colors"
          >
            <span className="text-[14px] leading-none">＋</span>
            Create Alert
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-white/[0.06]">
          {(["All","Active","Triggered","High","Medium","Low"] as FilterTab[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition border-b-2 -mb-px",
                filter === f
                  ? f === "High" ? "border-red-400 text-red-400"
                    : f === "Medium" ? "border-amber-400 text-amber-400"
                    : f === "Low" ? "border-emerald-400 text-emerald-400"
                    : "border-emerald-400 text-emerald-400"
                  : "border-transparent text-white/35 hover:text-white/60"
              )}
            >{f}</button>
          ))}
        </div>

        {/* Alert list */}
        {visible.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="text-[40px] opacity-10">🔔</div>
            <p className="text-[13px] text-white/30">No alerts found</p>
            <button onClick={() => { setCreating(true); setForm(BLANK); }}
              className="mt-1 text-[11px] text-emerald-400/60 hover:text-emerald-400 transition-colors">
              + Create your first alert
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(alert => {
              const sev = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.Medium;
              const dismissed = alert.status === "dismissed";
              return (
                <div key={alert.id}
                  className={cn(
                    "group rounded border px-4 py-3 transition-colors",
                    dismissed ? "opacity-40 border-white/[0.05] bg-white/[0.01]" : cn(sev.border, sev.bg)
                  )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-[3px] shrink-0">
                        <div className={cn("w-2 h-2 rounded-full", sev.dot, alert.status === "active" && "animate-pulse")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className={cn("text-[9px] font-black uppercase tracking-widest", sev.badge)}>{sev.label}</span>
                          <span className="text-[11px] font-bold text-white/80">{alert.symbol}</span>
                          {alert.status === "triggered" && (
                            <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-300">TRIGGERED</span>
                          )}
                          {dismissed && (
                            <span className="rounded border border-white/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white/30">DISMISSED</span>
                          )}
                        </div>
                        <p className="text-[12px] font-semibold text-white/85 leading-snug">{alert.title}</p>
                        {alert.detail && alert.detail !== alert.title && (
                          <p className="text-[10px] text-white/40 mt-0.5">{alert.detail}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[9px] text-white/25 tabular-nums">{fmtTime(alert.created_at)}</span>
                      {!dismissed && (
                        <button onClick={() => dismissAlert(alert.id)}
                          className="opacity-0 group-hover:opacity-100 text-[9px] text-white/30 hover:text-white/60 transition-all uppercase tracking-wide">
                          dismiss
                        </button>
                      )}
                      <button onClick={() => setDeleteId(alert.id)}
                        className="opacity-0 group-hover:opacity-100 text-[11px] text-white/20 hover:text-red-400 transition-all leading-none">
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create Alert Modal ── */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(2,6,12,0.85)" }}
          onClick={e => { if (e.target === e.currentTarget) { setCreating(false); setShowSuggestions(false); } }}>
          <div className="w-full max-w-md rounded-lg border border-emerald-400/15 overflow-visible"
            style={{ background: "linear-gradient(135deg, #050d14 0%, #060e18 100%)", boxShadow: "0 32px 80px rgba(0,0,0,0.85)" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]"
              style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.07) 0%, transparent 60%)", borderRadius: "0.5rem 0.5rem 0 0" }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-[0.12em] text-emerald-400/80 uppercase">iMYNTED</span>
                <span className="text-white/20 text-[10px]">|</span>
                <span className="text-[13px] font-bold text-white">Create Alert</span>
              </div>
              <button onClick={() => { setCreating(false); setShowSuggestions(false); }}
                className="text-white/30 hover:text-white/80 text-[18px] transition leading-none">×</button>
            </div>

            <div className="px-5 py-5 space-y-4">
              {/* Symbol with autocomplete */}
              <div className="relative">
                <label className="block text-[9px] text-emerald-400/60 uppercase tracking-widest mb-1.5">Symbol</label>
                <input
                  ref={symbolInputRef}
                  type="text"
                  placeholder="e.g. AAPL, TSLA, BTC"
                  value={form.symbol}
                  onChange={e => onSymbolChange(e.target.value)}
                  onFocus={() => form.symbol.length >= 1 && setShowSuggestions(symbolSuggestions.length > 0)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  className="w-full rounded border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-400/40 transition-colors"
                />
                {showSuggestions && symbolSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded border border-white/10 overflow-hidden shadow-2xl"
                    style={{ background: "rgba(4,10,18,0.98)" }}>
                    {symbolSuggestions.map(sym => (
                      <button key={sym} type="button"
                        onMouseDown={() => pickSymbol(sym)}
                        className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-white/70 hover:bg-emerald-400/[0.08] hover:text-emerald-300 transition-colors text-left">
                        <span className="font-semibold">{sym}</span>
                        <span className="text-[9px] text-white/25">
                          {["BTC","ETH","SOL","XRP","DOGE","ADA","AVAX","BNB","MATIC","LINK"].includes(sym) ? "CRYPTO" : "STOCK"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Condition + Target */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] text-emerald-400/60 uppercase tracking-widest mb-1.5">Condition</label>
                  <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                    className="w-full rounded border border-white/10 bg-[#060e18] px-3 py-2 text-[12px] text-white focus:outline-none focus:border-emerald-400/40 transition-colors">
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] text-emerald-400/60 uppercase tracking-widest mb-1.5">Target Value</label>
                  <input type="text" placeholder="e.g. 150.00" value={form.target}
                    onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                    className="w-full rounded border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-400/40 transition-colors" />
                </div>
              </div>

              {/* Severity */}
              <div>
                <label className="block text-[9px] text-emerald-400/60 uppercase tracking-widest mb-1.5">Severity</label>
                <div className="flex gap-2">
                  {(["High","Medium","Low"] as Severity[]).map(s => {
                    const cfg = SEVERITY_CONFIG[s];
                    return (
                      <button key={s} type="button" onClick={() => setForm(f => ({ ...f, severity: s }))}
                        className={cn(
                          "flex-1 py-1.5 rounded border text-[11px] font-semibold transition-colors",
                          form.severity === s ? cn(cfg.border, cfg.bg, cfg.badge) : "border-white/10 bg-transparent text-white/35 hover:text-white/60"
                        )}>{s}</button>
                    );
                  })}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-[9px] text-emerald-400/60 uppercase tracking-widest mb-1.5">Note (optional)</label>
                <input type="text" placeholder="Add a note…" value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full rounded border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-400/40 transition-colors" />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setCreating(false); setShowSuggestions(false); }}
                  className="flex-1 py-2 rounded border border-white/10 text-[12px] text-white/50 hover:text-white/70 transition-colors">
                  Cancel
                </button>
                <button onClick={createAlert}
                  disabled={!form.symbol.trim() || !form.target.trim()}
                  className="flex-1 py-2 rounded border border-emerald-400/30 bg-emerald-400/12 text-[12px] font-semibold text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Create Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(2,6,12,0.85)" }}
          onClick={e => { if (e.target === e.currentTarget) setDeleteId(null); }}>
          <div className="rounded-lg border border-red-400/20 bg-[#060e18] px-6 py-5 max-w-xs w-full text-center shadow-2xl">
            <p className="text-[13px] font-semibold text-white mb-1">Delete alert?</p>
            <p className="text-[11px] text-white/40 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-1.5 rounded border border-white/10 text-[12px] text-white/50 hover:text-white/70 transition-colors">Cancel</button>
              <button onClick={() => deleteAlert(deleteId)}
                className="flex-1 py-1.5 rounded border border-red-400/30 bg-red-400/10 text-[12px] font-semibold text-red-300 hover:bg-red-400/[0.18] transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
