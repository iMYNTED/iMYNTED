"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
} from "lightweight-charts";

type Candle = {
  t: number; // ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

type ApiResp = {
  ok?: boolean;
  provider?: string;
  symbol?: string;
  asset?: string;
  interval?: string;
  candles?: Candle[];
};

type Quote = {
  symbol: string;
  price?: number;
  bid?: number;
  ask?: number;
  ts?: string;
  provider?: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function n(v: any): number | undefined {
  const x = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(x) ? x : undefined;
}

function fmtPx(v?: number) {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  return v >= 1 ? v.toFixed(2) : v.toFixed(4);
}

function fmtVol(v?: number) {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
  return Math.round(v).toLocaleString();
}

function fmtTimeFromUnixSeconds(t: number) {
  const d = new Date(t * 1000);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchCandles(symbol: string, asset: string, interval: string, limit: number) {
  const url = `/api/market/candles?symbol=${encodeURIComponent(symbol)}&asset=${encodeURIComponent(
    asset
  )}&interval=${encodeURIComponent(interval)}&limit=${encodeURIComponent(String(limit))}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as ApiResp;
  const arr = Array.isArray(json?.candles) ? json.candles : [];
  return { provider: json?.provider || "", candles: arr };
}

// ✅ only call your real route + guard against HTML
async function fetchQuote(symbol: string): Promise<Quote | null> {
  const s = (symbol || "").toUpperCase().trim();
  if (!s) return null;

  const url = `/api/market/quote?symbol=${encodeURIComponent(s)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;

  const json: any = await res.json();
  const data = json?.data ?? json ?? {};

  return {
    symbol: String(data.symbol ?? s).toUpperCase(),
    price: n(data.price ?? data.last ?? data.px ?? data.c),
    bid: n(data.bid ?? data.b),
    ask: n(data.ask ?? data.a),
    ts: typeof (data.ts ?? json?.ts) === "string" ? String(data.ts ?? json.ts) : undefined,
    provider:
      typeof (json?.provider ?? data?.provider) === "string"
        ? String(json.provider ?? data.provider)
        : undefined,
  };
}

function Pill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border px-2.5 py-1 text-[11px] transition",
        active
          ? "border-white/20 bg-white/10 text-white"
          : "border-white/10 bg-black/20 text-white/70 hover:bg-white/5 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

export default function ChartPanel({
  symbol,
  asset,
  className,
}: {
  symbol: string;
  asset: "stock" | "crypto";
  className?: string;
}) {
  const sym = useMemo(() => (symbol || "").toUpperCase().trim(), [symbol]);

  const [interval, setInterval] = useState<"1m" | "5m" | "15m" | "1h" | "1d">("5m");
  const [limit, setLimit] = useState(120);
  const [provider, setProvider] = useState("");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [q, setQ] = useState<Quote | null>(null);

  const stats = useMemo(() => {
    if (!candles.length) return null;
    const last = candles[candles.length - 1];
    const prev = candles.length > 1 ? candles[candles.length - 2] : null;
    const chg = prev ? last.c - prev.c : 0;
    const chgPct = prev && prev.c !== 0 ? (chg / prev.c) * 100 : 0;
    return { last, prev, chg, chgPct };
  }, [candles]);

  const up = stats ? stats.chg >= 0 : true;
  const chgClass = up ? "text-emerald-400" : "text-red-400";
  const intervalChoices: Array<typeof interval> = ["1m", "5m", "15m", "1h", "1d"];

  // ---- Chart refs
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const volSeriesRef = useRef<any>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  // Price lines
  const lastPriceLineRef = useRef<any>(null);
  const bidLineRef = useRef<any>(null);
  const askLineRef = useRef<any>(null);

  // Tooltip refs
  const tipWrapRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  // Create chart ONCE
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    try {
      roRef.current?.disconnect();
    } catch {}
    roRef.current = null;

    try {
      chartRef.current?.remove();
    } catch {}
    chartRef.current = null;
    candleSeriesRef.current = null;
    volSeriesRef.current = null;

    lastPriceLineRef.current = null;
    bidLineRef.current = null;
    askLineRef.current = null;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#020617" },
        textColor: "#e5e7eb",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.10)" },
      timeScale: {
        borderColor: "rgba(255,255,255,0.10)",
        timeVisible: interval !== "1d",
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const candlesSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      borderVisible: false,
      lastValueVisible: true,
      priceLineVisible: true,
    });

    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      lastValueVisible: false,
    });

    chart.priceScale("").applyOptions({ scaleMargins: { top: 0.82, bottom: 0.0 } });

    chartRef.current = chart;
    candleSeriesRef.current = candlesSeries;
    volSeriesRef.current = volSeries;

    // LAST line
    lastPriceLineRef.current = candlesSeries.createPriceLine({
      price: 0,
      color: "rgba(229,231,235,0.35)",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "LAST",
    });

    // ✅ BID/ASK bands (subtle)
    bidLineRef.current = candlesSeries.createPriceLine({
      price: 0,
      color: "rgba(96,165,250,0.30)", // blue-ish
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "BID",
    });

    askLineRef.current = candlesSeries.createPriceLine({
      price: 0,
      color: "rgba(244,114,182,0.30)", // pink-ish
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "ASK",
    });

    // Crosshair tooltip
    chart.subscribeCrosshairMove((param: any) => {
      const tip = tipRef.current;
      const wrap = tipWrapRef.current;
      if (!tip || !wrap) return;

      if (!param || !param.time || !param.point) {
        tip.style.opacity = "0";
        return;
      }

      const s = candleSeriesRef.current;
      const price = param.seriesData?.get?.(s);
      if (!price) {
        tip.style.opacity = "0";
        return;
      }

      const o = price.open;
      const h = price.high;
      const l = price.low;
      const c = price.close;

      const vs = volSeriesRef.current;
      const vrow = param.seriesData?.get?.(vs);
      const v = vrow?.value ?? undefined;

      const t = typeof param.time === "number" ? fmtTimeFromUnixSeconds(param.time) : "";

      const bid = q?.bid;
      const ask = q?.ask;
      const spr = bid !== undefined && ask !== undefined ? Math.max(0, ask - bid) : undefined;

      tip.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="text-[11px] text-white/90 font-semibold">${sym}</div>
          <div class="text-[11px] text-white/70 tabular-nums">
            <span class="text-white/40">bid</span> ${fmtPx(bid)}
            <span class="text-white/40"> / ask</span> ${fmtPx(ask)}
            <span class="text-white/40"> / spr</span> ${fmtPx(spr)}
          </div>
        </div>
        <div class="mt-1 text-[11px] text-white/70 tabular-nums">
          <span class="text-white/50">O</span> ${fmtPx(o)}
          <span class="text-white/50"> H</span> ${fmtPx(h)}
          <span class="text-white/50"> L</span> ${fmtPx(l)}
          <span class="text-white/50"> C</span> ${fmtPx(c)}
          <span class="text-white/50"> V</span> ${fmtVol(v)}
        </div>
        <div class="mt-1 text-[10px] text-white/40">${t}</div>
      `;

      const r = wrap.getBoundingClientRect();
      const x = param.point.x;
      const y = param.point.y;

      const tipW = 320;
      const tipH = 72;

      const left = Math.max(8, Math.min(x + 12, r.width - tipW - 8));
      const top = Math.max(8, Math.min(y - tipH - 12, r.height - tipH - 8));

      tip.style.transform = `translate(${left}px, ${top}px)`;
      tip.style.opacity = "1";
    });

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      chart.applyOptions({ width: Math.floor(r.width), height: Math.floor(r.height) });
    });
    ro.observe(el);
    roRef.current = ro;

    const r0 = el.getBoundingClientRect();
    chart.applyOptions({ width: Math.floor(r0.width), height: Math.floor(r0.height) });

    return () => {
      try {
        ro.disconnect();
      } catch {}
      roRef.current = null;

      try {
        chart.remove();
      } catch {}
      chartRef.current = null;
      candleSeriesRef.current = null;
      volSeriesRef.current = null;

      lastPriceLineRef.current = null;
      bidLineRef.current = null;
      askLineRef.current = null;

      if (tipRef.current) tipRef.current.style.opacity = "0";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep time scale correct when interval changes
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      timeScale: { timeVisible: interval !== "1d", secondsVisible: false },
    });
  }, [interval]);

  // Quote polling + update BID/ASK bands
  useEffect(() => {
    let alive = true;
    let t: any;

    async function pollQuote() {
      try {
        const next = await fetchQuote(sym);
        if (!alive) return;
        if (next) {
          setQ(next);

          // ✅ update bid/ask price lines
          if (next.bid !== undefined && bidLineRef.current) {
            try {
              bidLineRef.current.applyOptions({
                price: Number(next.bid),
                axisLabelVisible: true,
                title: "BID",
              });
            } catch {}
          }
          if (next.ask !== undefined && askLineRef.current) {
            try {
              askLineRef.current.applyOptions({
                price: Number(next.ask),
                axisLabelVisible: true,
                title: "ASK",
              });
            } catch {}
          }
        }
      } catch {
        // ignore
      } finally {
        if (!alive) return;
        t = setTimeout(pollQuote, 1200);
      }
    }

    if (sym) pollQuote();
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [sym]);

  // Candle polling + update LAST line
  useEffect(() => {
    let alive = true;
    let t: any;

    async function poll() {
      try {
        setErr("");
        setLoading(true);

        const { provider, candles } = await fetchCandles(sym, asset, interval, limit);
        if (!alive) return;

        setProvider(provider || "");
        setCandles(candles);

        const cdata = candles.map((c) => ({
          time: Math.floor(c.t / 1000) as any,
          open: Number(c.o),
          high: Number(c.h),
          low: Number(c.l),
          close: Number(c.c),
        }));
        candleSeriesRef.current?.setData(cdata);

        const vdata = candles.map((c) => {
          const isUp = Number(c.c) >= Number(c.o);
          return {
            time: Math.floor(c.t / 1000) as any,
            value: Number(c.v ?? 0),
            color: isUp ? "rgba(16,185,129,0.45)" : "rgba(239,68,68,0.45)",
          };
        });
        volSeriesRef.current?.setData(vdata);

        const last = candles[candles.length - 1];
        if (last && lastPriceLineRef.current) {
          const isUp = Number(last.c) >= Number(last.o);
          const color = isUp ? "rgba(16,185,129,0.55)" : "rgba(239,68,68,0.55)";
          try {
            lastPriceLineRef.current.applyOptions({
              price: Number(last.c),
              color,
              axisLabelVisible: true,
              title: "LAST",
            });
          } catch {}
        }

        chartRef.current?.timeScale().fitContent();
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message || "fetch"));
        candleSeriesRef.current?.setData([]);
        volSeriesRef.current?.setData([]);
        if (tipRef.current) tipRef.current.style.opacity = "0";
      } finally {
        if (!alive) return;
        setLoading(false);
        t = setTimeout(poll, 3000);
      }
    }

    if (sym) poll();
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [sym, asset, interval, limit]);

  const showC = stats?.last || null;

  return (
    <div className={cn("h-full min-h-0 w-full flex flex-col", className)}>
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-white/10">
        <div className="text-sm font-semibold">{sym || "—"}</div>

        <div className="ml-2 text-xs text-white/60 tabular-nums">
          {showC ? (
            <>
              O {fmtPx(showC.o)} • H {fmtPx(showC.h)} • L {fmtPx(showC.l)} • C{" "}
              <span className="text-white/85">{fmtPx(showC.c)}</span> • V {fmtVol(showC.v)}
            </>
          ) : (
            "—"
          )}
        </div>

        {stats ? (
          <div className={cn("ml-2 text-xs font-semibold tabular-nums", chgClass)}>
            {stats.chg >= 0 ? "+" : ""}
            {fmtPx(stats.chg)} ({stats.chgPct >= 0 ? "+" : ""}
            {stats.chgPct.toFixed(2)}%)
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1">
            {intervalChoices.map((k) => (
              <Pill key={k} active={interval === k} onClick={() => setInterval(k)}>
                {k}
              </Pill>
            ))}
          </div>

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-white/75"
          >
            <option value={60}>60</option>
            <option value={120}>120</option>
            <option value={240}>240</option>
          </select>

          <div className="text-[11px] text-white/40">
            {loading ? "Loading…" : provider ? provider : "—"}
            {err ? <span className="text-red-300"> • {err}</span> : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 p-2">
        <div
          ref={tipWrapRef}
          className="relative h-full w-full rounded-2xl border border-white/10 bg-black/20 overflow-hidden"
          onMouseLeave={() => {
            if (tipRef.current) tipRef.current.style.opacity = "0";
          }}
        >
          <div ref={hostRef} className="absolute inset-0" />
          <div
            ref={tipRef}
            className="pointer-events-none absolute left-0 top-0 w-[320px] rounded-xl border border-white/10 bg-black/70 px-3 py-2 backdrop-blur-md shadow-lg"
            style={{ opacity: 0, transform: "translate(12px, 12px)" }}
          />
        </div>
      </div>
    </div>
  );
}
