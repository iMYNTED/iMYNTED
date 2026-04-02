// app/components/ChartPanel.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSettings } from "./SettingsContext";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";

/* --------------------------------- Types --------------------------------- */

type Candle = {
  t: number;
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
  asset?: "stock" | "crypto";
  price?: number;
  last?: number;
  mid?: number;
  bid?: number;
  ask?: number;
  ts?: string;
  provider?: string;
  warn?: string;
};

type CanonQuote = {
  symbol?: string;
  asset?: "stock" | "crypto";
  price?: number;
  last?: number;
  mid?: number;
  bid?: number;
  ask?: number;
  ts?: string;
  provider?: string;
  warn?: string;
};

type ChartType = "candle" | "line" | "area";
type Interval = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w";
type Overlay = "ema9" | "ema21" | "sma50" | "sma200" | "vwap" | "bbands";
type DrawTool = "none" | "hline" | "trendline" | "rect";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ------------------------ Canonical symbol helpers ------------------------ */

function normSym(raw: string) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.\-]/g, "");
}

function normalizeCryptoSymbol(raw: string) {
  const s = normSym(raw);
  if (!s) return "BTC-USD";
  if (s.includes("-")) return s;
  if (s.endsWith("USD")) return s.replace(/USD$/, "-USD");
  return `${s}-USD`;
}

function normalizeStockSymbol(raw: string) {
  let s = normSym(raw);
  if (!s) return "AAPL";
  s = s.replace(/-USD$/i, "");
  s = s.replace(/[0-9]+$/, "");
  if (s.includes("-")) return "AAPL";
  s = s.replace(/[^A-Z0-9.]/g, "");
  return s || "AAPL";
}

function normalizeSymbol(asset: "stock" | "crypto", raw: string) {
  return asset === "crypto" ? normalizeCryptoSymbol(raw) : normalizeStockSymbol(raw);
}

/* ----------------------------- Formatters -------------------------------- */

function decFor(asset: "stock" | "crypto", px: number) {
  if (asset === "stock") return px >= 1 ? 2 : 4;
  if (px >= 100) return 2;
  if (px >= 1) return 4;
  return 6;
}

function fmtPx(v?: number, asset: "stock" | "crypto" = "stock") {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  const vv = Number(v);
  return vv.toFixed(decFor(asset, vv));
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

/* ----------------------------- Data fetch -------------------------------- */

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

/* ----------------------------- Indicators -------------------------------- */

function calcEMA(closes: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const out: (number | null)[] = [];
  let ema: number | null = null;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      out.push(null);
    } else if (ema === null) {
      ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
      out.push(ema);
    } else {
      ema = closes[i] * k + ema * (1 - k);
      out.push(ema);
    }
  }
  return out;
}

function calcSMA(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    out.push(sum / period);
  }
  return out;
}

function calcVWAP(candles: Candle[]): (number | null)[] {
  const out: (number | null)[] = [];
  let cumVol = 0;
  let cumTP = 0;
  for (const c of candles) {
    const tp = (c.h + c.l + c.c) / 3;
    cumVol += c.v;
    cumTP += tp * c.v;
    out.push(cumVol > 0 ? cumTP / cumVol : null);
  }
  return out;
}

/* ----------------------------- Sub-components ---------------------------- */

const OVERLAY_COLORS: Record<Overlay, string> = {
  ema9: "#f59e0b",
  ema21: "#8b5cf6",
  sma50: "#3b82f6",
  sma200: "#ec4899",
  vwap: "#22d3ee",
  bbands: "#a78bfa",
};

const OVERLAY_LABELS: Record<Overlay, string> = {
  ema9: "EMA 9",
  ema21: "EMA 21",
  sma50: "SMA 50",
  sma200: "SMA 200",
  vwap: "VWAP",
  bbands: "BB 20",
};

const DRAW_TOOL_LABELS: Record<DrawTool, string> = {
  none: "Cursor",
  hline: "H-Line",
  trendline: "Trend",
  rect: "Rect",
};

const DRAW_TOOL_ICONS: Record<DrawTool, string> = {
  none: "↖",
  hline: "─",
  trendline: "╱",
  rect: "▭",
};

function calcBBands(closes: number[], period = 20, mult = 2): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const upper: (number | null)[] = [];
  const middle: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { upper.push(null); middle.push(null); lower.push(null); continue; }
    const slice = closes.slice(i - period + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - avg) ** 2, 0) / period);
    middle.push(avg);
    upper.push(avg + mult * std);
    lower.push(avg - mult * std);
  }
  return { upper, middle, lower };
}

function ChartPill({
  active,
  children,
  onClick,
  color,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  color?: string;
}) {
  const activeColor = color || "#22d3ee";
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-sm border px-2 py-0.5 text-[10px] font-medium tracking-wide transition",
        active
          ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-300"
          : "border-emerald-400/10 bg-transparent text-emerald-400/40 hover:bg-emerald-400/5 hover:text-emerald-400/60"
      )}
      style={active && color ? { borderColor: `${color}40`, color: activeColor, backgroundColor: `${color}12` } : undefined}
      type="button"
    >
      {children}
    </button>
  );
}

function applyLine(line: any, price?: number) {
  if (!line) return;
  const ok = typeof price === "number" && Number.isFinite(price);
  try {
    line.applyOptions({ price: ok ? Number(price) : 0 });
  } catch {}
}

/* =============================== MAIN ==================================== */

export default function ChartPanel({
  symbol,
  asset,
  className,
}: {
  symbol: string;
  asset: "stock" | "crypto";
  className?: string;
}) {
  const { upHex, downHex } = useSettings();
  const sym = useMemo(() => normalizeSymbol(asset, symbol), [symbol, asset]);

  const symRef = useRef(sym);
  const assetRef = useRef(asset);
  useEffect(() => {
    symRef.current = sym;
    assetRef.current = asset;
  }, [sym, asset]);

  const [interval, setInterval] = useState<Interval>("5m");
  const [limit, setLimit] = useState(120);
  const [provider, setProvider] = useState("");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [chartType, setChartType] = useState<ChartType>("candle");
  const [overlays, setOverlays] = useState<Set<Overlay>>(new Set());
  const [drawTool, setDrawTool] = useState<DrawTool>("none");
  const [showToolbar, setShowToolbar] = useState(true);
  const [detached, setDetached] = useState(false);
  const [popPos, setPopPos] = useState({ x: 80, y: 80 });
  const [popSize, setPopSize] = useState({ w: 720, h: 500 });
  const [maximized, setMaximized] = useState(false);
  const dragRef = useRef<{ ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ ox: number; oy: number; ow: number; oh: number } | null>(null);
  const candlesDataRef = useRef<Candle[]>([]);

  const [q, setQ] = useState<Quote | null>(null);
  const qRef = useRef<Quote | null>(null);
  useEffect(() => {
    qRef.current = q;
  }, [q]);

  // Keep candles accessible in chart-init effect without adding to deps
  useEffect(() => { candlesDataRef.current = candles; }, [candles]);

  const toggleOverlay = useCallback((o: Overlay) => {
    setOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(o)) next.delete(o);
      else next.add(o);
      return next;
    });
  }, []);

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
  const intervalChoices: Interval[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"];

  const hostRef = useRef<HTMLDivElement | null>(null);
  const tipWrapRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const lineSeriesRef = useRef<any>(null);
  const areaSeriesRef = useRef<any>(null);
  const volSeriesRef = useRef<any>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const overlaySeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());

  const lastPriceLineRef = useRef<any>(null);
  const bidLineRef = useRef<any>(null);
  const askLineRef = useRef<any>(null);

  /* ------------- symbol events ------------- */

  useEffect(() => {
    function onSym(ev: Event) {
      const d = (ev as CustomEvent).detail || {};
      const a = (d.asset === "crypto" ? "crypto" : "stock") as "stock" | "crypto";
      const s = String(d.symbol || "").trim();
      if (!s) return;
      if (a !== assetRef.current) return;
      symRef.current = normalizeSymbol(a, s);
    }

    window.addEventListener("imynted:symbol", onSym as EventListener);
    window.addEventListener("msa:symbol", onSym as EventListener);

    return () => {
      window.removeEventListener("imynted:symbol", onSym as EventListener);
      window.removeEventListener("msa:symbol", onSym as EventListener);
    };
  }, []);

  /* ------------- chart init ------------- */

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    try { roRef.current?.disconnect(); } catch {}
    roRef.current = null;

    try { chartRef.current?.remove(); } catch {}
    chartRef.current = null;

    candleSeriesRef.current = null;
    lineSeriesRef.current = null;
    areaSeriesRef.current = null;
    volSeriesRef.current = null;
    lastPriceLineRef.current = null;
    bidLineRef.current = null;
    askLineRef.current = null;
    overlaySeriesRef.current.clear();

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#020617" },
        textColor: "rgba(255,255,255,0.55)",
        fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', monospace",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(52,211,153,0.03)" },
        horzLines: { color: "rgba(52,211,153,0.05)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(52,211,153,0.25)", width: 1, style: 2, labelBackgroundColor: "#065f46" },
        horzLine: { color: "rgba(52,211,153,0.25)", width: 1, style: 2, labelBackgroundColor: "#065f46" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.06)",
        scaleMargins: { top: 0.05, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.06)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    /* Candle series (always created, visibility toggled) */
    const candlesSeries = chart.addSeries(CandlestickSeries, {
      upColor: upHex,
      downColor: downHex,
      wickUpColor: upHex,
      wickDownColor: downHex,
      borderVisible: false,
      lastValueVisible: true,
      priceLineVisible: false,
    });

    /* Line series */
    const lineSeries = chart.addSeries(LineSeries, {
      color: "#22d3ee",
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: false,
      visible: false,
    });

    /* Area series */
    const areaSeries = chart.addSeries(AreaSeries, {
      topColor: "rgba(34,211,238,0.25)",
      bottomColor: "rgba(34,211,238,0.02)",
      lineColor: "#22d3ee",
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: false,
      visible: false,
    });

    /* Volume */
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      lastValueVisible: false,
    });

    chart.priceScale("").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0.0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candlesSeries;
    lineSeriesRef.current = lineSeries;
    areaSeriesRef.current = areaSeries;
    volSeriesRef.current = volSeries;

    /* Price lines */
    lastPriceLineRef.current = candlesSeries.createPriceLine({
      price: 0,
      color: "#22d3ee",
      lineWidth: 2,
      lineStyle: 0,
      axisLabelVisible: true,
      title: "LAST",
    });

    bidLineRef.current = candlesSeries.createPriceLine({
      price: 0,
      color: upHex,
      lineWidth: 1,
      lineStyle: 1,
      axisLabelVisible: true,
      title: "BID",
    });

    askLineRef.current = candlesSeries.createPriceLine({
      price: 0,
      color: downHex,
      lineWidth: 1,
      lineStyle: 1,
      axisLabelVisible: true,
      title: "ASK",
    });

    /* Crosshair tooltip */
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

      const qq = qRef.current;
      const bid = qq?.bid;
      const ask = qq?.ask;
      const spr =
        bid !== undefined && ask !== undefined ? Math.max(0, ask - bid) : undefined;

      const liveSym = symRef.current;
      const liveAsset = assetRef.current;
      const candleUp = c >= o;
      const pxColor = candleUp ? upHex : downHex;

      tip.innerHTML = `
        <div class="flex items-center justify-between gap-3">
          <span class="text-[10px] font-semibold tracking-wide text-white/90">${liveSym}</span>
          <span class="text-[10px] text-white/40">${t}</span>
        </div>
        <div class="mt-1 text-[10px] tabular-nums" style="color:${pxColor}">
          <span class="text-white/40">O</span> ${fmtPx(o, liveAsset)}
          <span class="text-white/40"> H</span> ${fmtPx(h, liveAsset)}
          <span class="text-white/40"> L</span> ${fmtPx(l, liveAsset)}
          <span class="text-white/40"> C</span> ${fmtPx(c, liveAsset)}
        </div>
        <div class="mt-0.5 text-[10px] text-white/50 tabular-nums">
          <span class="text-white/30">Vol</span> ${fmtVol(v)}
          <span class="text-white/30 ml-2">Bid</span> ${fmtPx(bid, liveAsset)}
          <span class="text-white/30"> Ask</span> ${fmtPx(ask, liveAsset)}
          ${spr !== undefined ? `<span class="text-white/30"> Spr</span> ${fmtPx(spr, liveAsset)}` : ""}
        </div>
      `;

      const r = wrap.getBoundingClientRect();
      const x = param.point.x;
      const y = param.point.y;

      const tipW = 280;
      const tipH = 64;

      const left = Math.max(4, Math.min(x + 12, r.width - tipW - 4));
      const top = Math.max(4, Math.min(y - tipH - 12, r.height - tipH - 4));

      tip.style.transform = `translate(${left}px, ${top}px)`;
      tip.style.opacity = "1";
    });

    /* ResizeObserver */
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      chart.applyOptions({
        width: Math.floor(r.width),
        height: Math.floor(r.height),
      });
    });

    ro.observe(el);
    roRef.current = ro;

    const r0 = el.getBoundingClientRect();
    chart.applyOptions({
      width: Math.floor(r0.width),
      height: Math.floor(r0.height),
    });

    // Re-apply any candles already in memory (needed when switching detached state)
    const existingCandles = candlesDataRef.current;
    if (existingCandles.length) {
      const cdata = existingCandles.map((c) => ({
        time: Math.floor(c.t / 1000) as any,
        open: Number(c.o), high: Number(c.h), low: Number(c.l), close: Number(c.c),
      }));
      const ldata = existingCandles.map((c) => ({ time: Math.floor(c.t / 1000) as any, value: Number(c.c) }));
      const vdata = existingCandles.map((c) => ({
        time: Math.floor(c.t / 1000) as any, value: Number(c.v ?? 0),
        color: Number(c.c) >= Number(c.o) ? "rgba(52,211,153,0.75)" : "rgba(248,113,113,0.7)",
      }));
      try { candlesSeries.setData(cdata); } catch {}
      try { lineSeries.setData(ldata); } catch {}
      try { areaSeries.setData(ldata); } catch {}
      try { volSeries.setData(vdata); } catch {}
      try { chart.timeScale().fitContent(); } catch {}
    }

    return () => {
      try { ro.disconnect(); } catch {}
      roRef.current = null;

      try { chart.remove(); } catch {}

      chartRef.current = null;
      candleSeriesRef.current = null;
      lineSeriesRef.current = null;
      areaSeriesRef.current = null;
      volSeriesRef.current = null;
      lastPriceLineRef.current = null;
      bidLineRef.current = null;
      askLineRef.current = null;
      overlaySeriesRef.current.clear();

      if (tipRef.current) tipRef.current.style.opacity = "0";
    };
  }, [detached]); // re-init chart when detach state changes so new DOM node gets a fresh chart

  /* ------------- chart type toggle ------------- */

  useEffect(() => {
    const candle = candleSeriesRef.current;
    const line = lineSeriesRef.current;
    const area = areaSeriesRef.current;
    if (!candle || !line || !area) return;

    try {
      candle.applyOptions({ visible: chartType === "candle" });
      line.applyOptions({ visible: chartType === "line" });
      area.applyOptions({ visible: chartType === "area" });
    } catch {}
  }, [chartType]);

  /* ------------- time visibility ------------- */

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      timeScale: {
        timeVisible: interval !== "1d",
        secondsVisible: false,
      },
    });
  }, [interval]);

  /* ------------- quote events ------------- */

  useEffect(() => {
    function onQuote(ev: Event) {
      const d: CanonQuote = (ev as CustomEvent).detail || {};
      const esymRaw = String(d?.symbol || "").toUpperCase().trim();
      const easset = (d?.asset === "crypto" ? "crypto" : "stock") as "stock" | "crypto";
      if (!esymRaw) return;
      if (easset !== assetRef.current) return;

      const want = normalizeSymbol(assetRef.current, symRef.current);
      const got = normalizeSymbol(assetRef.current, esymRaw);
      if (got !== want) return;

      const bid = typeof d?.bid === "number" ? d.bid : undefined;
      const ask = typeof d?.ask === "number" ? d.ask : undefined;
      const mid = typeof d?.mid === "number" ? d.mid : undefined;
      const last = typeof d?.last === "number" ? d.last : undefined;
      const price = typeof d?.price === "number" ? d.price : undefined;

      const next: Quote = {
        symbol: want,
        asset: assetRef.current,
        bid,
        ask,
        mid,
        last,
        price,
        ts: typeof d?.ts === "string" ? d.ts : undefined,
        provider: typeof d?.provider === "string" ? d.provider : undefined,
        warn: typeof d?.warn === "string" ? d.warn : undefined,
      };

      setQ(next);

      applyLine(bidLineRef.current, bid);
      applyLine(askLineRef.current, ask);

      const livePx =
        typeof price === "number" ? price : typeof mid === "number" ? mid : last;

      if (typeof livePx === "number" && lastPriceLineRef.current) {
        try {
          lastPriceLineRef.current.applyOptions({
            price: Number(livePx),
            color: "#22d3ee",
            axisLabelVisible: true,
            title: "LAST",
          });
        } catch {}
      }
    }

    window.addEventListener("imynted:quote", onQuote as EventListener);
    window.addEventListener("imynted:quoteUpdate", onQuote as EventListener);
    window.addEventListener("msa:quote", onQuote as EventListener);

    return () => {
      window.removeEventListener("imynted:quote", onQuote as EventListener);
      window.removeEventListener("imynted:quoteUpdate", onQuote as EventListener);
      window.removeEventListener("msa:quote", onQuote as EventListener);
    };
  }, []);

  /* ------------- candle polling + overlays ------------- */

  useEffect(() => {
    if (!sym) return;

    let alive = true;

    async function pollOnce() {
      try {
        setErr("");
        setLoading(true);

        const { provider: nextProvider, candles: nextCandles } = await fetchCandles(
          sym,
          asset,
          interval,
          limit
        );
        if (!alive) return;

        setProvider(nextProvider || "");
        setCandles(nextCandles);

        /* Candle data */
        const cdata = nextCandles.map((c) => ({
          time: Math.floor(c.t / 1000) as any,
          open: Number(c.o),
          high: Number(c.h),
          low: Number(c.l),
          close: Number(c.c),
        }));
        candleSeriesRef.current?.setData(cdata);

        /* Line + Area data (same close data) */
        const lineData = nextCandles.map((c) => ({
          time: Math.floor(c.t / 1000) as any,
          value: Number(c.c),
        }));
        lineSeriesRef.current?.setData(lineData);
        areaSeriesRef.current?.setData(lineData);

        /* Volume data */
        const vdata = nextCandles.map((c) => {
          const isUp = Number(c.c) >= Number(c.o);
          return {
            time: Math.floor(c.t / 1000) as any,
            value: Number(c.v ?? 0),
            color: isUp ? "rgba(52,211,153,0.75)" : "rgba(248,113,113,0.7)",
          };
        });
        volSeriesRef.current?.setData(vdata);

        /* LAST price line */
        const last = nextCandles[nextCandles.length - 1];
        if (last && lastPriceLineRef.current) {
          const livePx =
            typeof qRef.current?.price === "number"
              ? qRef.current.price
              : typeof qRef.current?.mid === "number"
                ? qRef.current.mid
                : qRef.current?.last;

          const pxToShow = typeof livePx === "number" ? livePx : Number(last.c);

          try {
            lastPriceLineRef.current.applyOptions({
              price: Number(pxToShow),
              color: "#22d3ee",
              axisLabelVisible: true,
              title: "LAST",
            });
          } catch {}
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message || "fetch"));
        candleSeriesRef.current?.setData([]);
        lineSeriesRef.current?.setData([]);
        areaSeriesRef.current?.setData([]);
        volSeriesRef.current?.setData([]);
        if (tipRef.current) tipRef.current.style.opacity = "0";
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    pollOnce();
    const id = window.setInterval(pollOnce, 3000);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [sym, asset, interval, limit]);

  /* ------------- overlay series management ------------- */

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !candles.length) return;

    const closes = candles.map((c) => Number(c.c));
    const times = candles.map((c) => Math.floor(c.t / 1000));

    const allOverlays: Overlay[] = ["ema9", "ema21", "sma50", "sma200", "vwap", "bbands"];

    for (const key of allOverlays) {
      // Bollinger Bands = 3 sub-series
      if (key === "bbands") {
        const bbKeys = ["bbands_upper", "bbands_mid", "bbands_lower"];
        if (!overlays.has("bbands")) {
          for (const bk of bbKeys) {
            const ex = overlaySeriesRef.current.get(bk);
            if (ex) { try { chart.removeSeries(ex); } catch {} overlaySeriesRef.current.delete(bk); }
          }
          continue;
        }
        const bb = calcBBands(closes);
        const bbData = [bb.upper, bb.middle, bb.lower];
        const bbColors = ["rgba(167,139,250,0.5)", "#a78bfa", "rgba(167,139,250,0.5)"];
        const bbWidths = [1, 1, 1] as const;
        for (let bi = 0; bi < 3; bi++) {
          const bk = bbKeys[bi];
          const data = bbData[bi].map((v, i) => v !== null ? { time: times[i] as any, value: v } : null).filter(Boolean) as any[];
          const ex = overlaySeriesRef.current.get(bk);
          if (ex) { try { ex.setData(data); } catch {} }
          else {
            const s = chart.addSeries(LineSeries, { color: bbColors[bi], lineWidth: bbWidths[bi], lastValueVisible: false, priceLineVisible: false });
            s.setData(data);
            overlaySeriesRef.current.set(bk, s);
          }
        }
        continue;
      }

      const existing = overlaySeriesRef.current.get(key);

      if (!overlays.has(key)) {
        if (existing) {
          try { chart.removeSeries(existing); } catch {}
          overlaySeriesRef.current.delete(key);
        }
        continue;
      }

      let values: (number | null)[];
      switch (key) {
        case "ema9": values = calcEMA(closes, 9); break;
        case "ema21": values = calcEMA(closes, 21); break;
        case "sma50": values = calcSMA(closes, 50); break;
        case "sma200": values = calcSMA(closes, 200); break;
        case "vwap": values = calcVWAP(candles); break;
        default: values = []; break;
      }

      const data = values
        .map((v, i) => (v !== null ? { time: times[i] as any, value: v } : null))
        .filter(Boolean) as any[];

      if (existing) {
        try { existing.setData(data); } catch {}
      } else {
        const s = chart.addSeries(LineSeries, {
          color: OVERLAY_COLORS[key],
          lineWidth: 1,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        s.setData(data);
        overlaySeriesRef.current.set(key, s);
      }
    }
  }, [candles, overlays]);

  /* ------------- fit content ------------- */

  useEffect(() => {
    const ch = chartRef.current;
    if (!ch) return;
    try { ch.timeScale().fitContent(); } catch {}
  }, [sym, interval, limit]);

  /* --------------------------------- JSX ---------------------------------- */

  const showC = stats?.last || null;

  const chartBody = (
    <div className="h-full min-h-0 w-full flex flex-col">
      {/* ---- Single header row — matches L2/Tape pattern ---- */}
      <div className="shrink-0 flex items-center justify-between gap-2 border-b border-white/8 px-2 py-1">
        {/* Left: symbol + type */}
        <div className="flex items-center gap-1.5 min-w-0 shrink-0">
          <span className="text-[11px] font-semibold tracking-wide text-white/90">{sym || "—"}</span>
          <span className="text-[10px] text-white/40">{asset === "crypto" ? "CRYPTO" : "STOCK"}</span>
        </div>

        {/* Center: OHLCV + change */}
        <div className="flex items-center gap-2 text-[10px] tabular-nums text-white/50 overflow-hidden min-w-0">
          {showC && (
            <>
              <span><span className="text-white/35">O</span> {fmtPx(showC.o, asset)}</span>
              <span><span className="text-emerald-400/60">H</span> <span className="text-emerald-400/90">{fmtPx(showC.h, asset)}</span></span>
              <span><span className="text-red-400/60">L</span> <span className="text-red-400/90">{fmtPx(showC.l, asset)}</span></span>
              <span><span className="text-white/35">C</span> {fmtPx(showC.c, asset)}</span>
              <span><span className="text-white/35">V</span> {fmtVol(showC.v)}</span>
            </>
          )}
          {stats && (
            <span className={cn("font-semibold", chgClass)}>
              {stats.chg >= 0 ? "+" : ""}{fmtPx(stats.chg, asset)} ({stats.chgPct >= 0 ? "+" : ""}{stats.chgPct.toFixed(2)}%)
            </span>
          )}
        </div>

        {/* Right: live quote + controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] tabular-nums whitespace-nowrap">
            <span className="text-emerald-400/60">bid</span> <span className="text-emerald-400/90">{fmtPx(q?.bid, asset)}</span>
            <span className="text-white/20"> / </span><span className="text-red-400/60">ask</span> <span className="text-red-400/90">{fmtPx(q?.ask, asset)}</span>
            <span className="text-white/20"> • </span><span className="text-cyan-400/50">px</span> <span className="text-white/75">{fmtPx(q?.price, asset)}</span>
          </span>
          {err ? <span className="text-[10px] text-red-400">ERR</span> : null}
          {loading && <span className="text-[10px] text-white/20">…</span>}
          <button onClick={() => setShowToolbar(v => !v)} className="text-[10px] text-white/25 hover:text-white/60 transition" type="button">{showToolbar ? "▲" : "▼"}</button>
          <button onClick={() => setDetached(v => !v)} className="text-[10px] text-white/25 hover:text-emerald-400 transition" type="button">⧉</button>
        </div>
      </div>

      {/* ---- Toolbar — iMYNTED branded ---- */}
      {showToolbar && (
        <div className="shrink-0 flex flex-wrap items-center gap-1 border-b border-white/[0.06] px-2 py-1"
          style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.03) 0%, transparent 40%)" }}>
          {/* Chart type */}
          <div className="flex items-center gap-0.5">
            {(["candle", "line", "area"] as ChartType[]).map((ct) => (
              <ChartPill key={ct} active={chartType === ct} onClick={() => setChartType(ct)}>
                {ct === "candle" ? "⊞ Candle" : ct === "line" ? "⌇ Line" : "▤ Area"}
              </ChartPill>
            ))}
          </div>
          <div className="h-3 w-px bg-white/[0.08] mx-0.5" />
          {/* Timeframes */}
          <div className="flex items-center gap-0.5">
            {intervalChoices.map((k) => (
              <ChartPill key={k} active={interval === k} onClick={() => setInterval(k)}>{k}</ChartPill>
            ))}
          </div>
          <div className="h-3 w-px bg-white/[0.08] mx-0.5" />
          {/* Indicators / Overlays */}
          <div className="flex items-center gap-0.5">
            {(["ema9", "ema21", "sma50", "sma200", "vwap", "bbands"] as Overlay[]).map((o) => (
              <ChartPill key={o} active={overlays.has(o)} onClick={() => toggleOverlay(o)} color={OVERLAY_COLORS[o]}>
                {OVERLAY_LABELS[o]}
              </ChartPill>
            ))}
          </div>
          <div className="h-3 w-px bg-white/[0.08] mx-0.5" />
          {/* Drawing tools */}
          <div className="flex items-center gap-0.5">
            {(["none", "hline", "trendline", "rect"] as DrawTool[]).map((dt) => (
              <ChartPill key={dt} active={drawTool === dt} onClick={() => setDrawTool(dt)}>
                <span className="mr-0.5">{DRAW_TOOL_ICONS[dt]}</span>{DRAW_TOOL_LABELS[dt]}
              </ChartPill>
            ))}
          </div>
          <div className="h-3 w-px bg-white/[0.08] mx-0.5" />
          {/* Candle count */}
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-sm border border-white/[0.08] bg-transparent px-1.5 py-0.5 text-[10px] text-white/60 outline-none focus:border-emerald-400/30 transition-colors"
          >
            <option value={60} className="bg-[#060e18]">60</option>
            <option value={120} className="bg-[#060e18]">120</option>
            <option value={240} className="bg-[#060e18]">240</option>
            <option value={500} className="bg-[#060e18]">500</option>
          </select>
          {/* Provider badge */}
          {provider && (
            <span className="ml-auto rounded-sm border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[8px] font-bold text-white/25 uppercase tracking-wider">{provider}</span>
          )}
        </div>
      )}

      {/* ---- Chart area ---- */}
      <div className="min-h-0 flex-1">
        <div
          ref={tipWrapRef}
          className="relative h-full w-full overflow-hidden"
          onMouseLeave={() => { if (tipRef.current) tipRef.current.style.opacity = "0"; }}
        >
          <div ref={hostRef} className="absolute inset-0 z-0" />
          {/* Brand glow */}
          <div className="pointer-events-none absolute inset-0 z-10" style={{ boxShadow: "inset 0 0 48px 0 rgba(52,211,153,0.07), inset 0 0 48px 0 rgba(248,113,113,0.05)" }} />
          {/* Bottom fade */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12" style={{ background: "linear-gradient(to top, rgba(52,211,153,0.03), transparent)" }} />
          {/* Tooltip */}
          <div
            ref={tipRef}
            className="pointer-events-none absolute left-0 top-0 w-[280px] rounded-sm border border-white/10 bg-black/85 px-2.5 py-1.5 backdrop-blur-md"
            style={{ opacity: 0, transform: "translate(12px, 12px)" }}
          />
          {/* Overlay legend */}
          {overlays.size > 0 && (
            <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-2">
              {Array.from(overlays).map((o) => (
                <span key={o} className="text-[9px] font-medium tracking-wider" style={{ color: OVERLAY_COLORS[o] }}>
                  {OVERLAY_LABELS[o]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* ---- Detached popup ---- */
  const popup = detached && typeof window !== "undefined" ? createPortal(
    <div
      className="fixed z-[9999] flex flex-col overflow-hidden rounded-sm border border-emerald-400/[0.08]"
      style={maximized
        ? {
            left: 0, top: 0, width: "100vw", height: "100vh", borderRadius: 0, boxShadow: "none",
            background: "linear-gradient(180deg, rgba(5,11,22,0.99) 0%, rgba(2,6,14,0.99) 100%)",
          }
        : {
            left: popPos.x, top: popPos.y,
            width: popSize.w, height: popSize.h,
            background: [
              "radial-gradient(ellipse 70% 35% at 8% 0%, rgba(52,211,153,0.08) 0%, transparent 100%)",
              "radial-gradient(ellipse 40% 25% at 92% 100%, rgba(34,211,238,0.03) 0%, transparent 100%)",
              "linear-gradient(180deg, rgba(5,11,22,0.99) 0%, rgba(2,6,14,0.99) 100%)",
            ].join(", "),
            boxShadow: "0 0 0 1px rgba(52,211,153,0.06), 0 25px 60px rgba(0,0,0,0.75)",
          }}
      onPointerMove={(e) => {
        if (dragRef.current) {
          setPopPos({ x: e.clientX - dragRef.current.ox, y: e.clientY - dragRef.current.oy });
        }
        if (resizeRef.current) {
          setPopSize({
            w: Math.max(400, resizeRef.current.ow + (e.clientX - resizeRef.current.ox)),
            h: Math.max(300, resizeRef.current.oh + (e.clientY - resizeRef.current.oy)),
          });
        }
      }}
      onPointerUp={() => { dragRef.current = null; resizeRef.current = null; }}
    >
      {/* Drag handle / title bar */}
      <div
        className="shrink-0 flex items-center gap-2 border-b border-emerald-400/[0.08] px-3 py-1.5 select-none"
        style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.06) 0%, transparent 50%)", cursor: maximized ? "default" : "grab" }}
        onPointerDown={(e) => {
          if (maximized) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = { ox: e.clientX - popPos.x, oy: e.clientY - popPos.y };
        }}
        onPointerUp={() => { dragRef.current = null; }}
      >
        <span className="text-[11px] font-bold tracking-wider text-emerald-400/90">iMYNTED CHART</span>
        <span className="text-[10px] text-white/50 font-semibold">{sym}</span>
        <span className="text-[10px] text-white/40">{asset === "crypto" ? "CRYPTO" : "STOCK"}</span>
        <span className="flex-1" />
        {/* Maximize / restore */}
        <button
          onClick={() => setMaximized(v => !v)}
          className="text-white/30 hover:text-emerald-400 transition text-[11px] px-1.5 py-0.5"
          title={maximized ? "Restore" : "Maximize"}
          type="button"
        >
          {maximized ? "⊡" : "⊞"}
        </button>
        <button
          onClick={() => { setDetached(false); setMaximized(false); }}
          className="text-white/40 hover:text-red-400 transition text-[13px] px-1"
          type="button"
        >✕</button>
      </div>

      <div className="flex-1 min-h-0 relative">
        {chartBody}
        {/* Resize handle — bottom-right corner */}
        {!maximized && (
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50 flex items-end justify-end pr-0.5 pb-0.5"
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              resizeRef.current = { ox: e.clientX, oy: e.clientY, ow: popSize.w, oh: popSize.h };
            }}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M7 1L1 7M7 4L4 7M7 7H7" stroke="rgba(52,211,153,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className={cn("h-full min-h-0 w-full flex flex-col", className)}>
      {detached ? (
        <div className="flex h-full items-center justify-center text-[11px] text-white/20 flex-col gap-2">
          <span>Chart detached</span>
          <button
            onClick={() => setDetached(false)}
            className="rounded-sm border border-emerald-400/20 bg-emerald-400/5 px-3 py-1 text-emerald-400/60 hover:text-emerald-400 transition text-[10px]"
            type="button"
          >
            Reattach
          </button>
        </div>
      ) : chartBody}
      {popup}
    </div>
  );
}