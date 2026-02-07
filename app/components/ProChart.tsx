"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";

type Candle = {
  t: number; // ms
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
};

type ApiResp = {
  candles?: Candle[];
};

export default function ProChart({ symbol }: { symbol: string }) {
  const sym = useMemo(() => (symbol || "AAPL").toUpperCase().trim(), [symbol]);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<any> | null>(null);
  const volRef = useRef<ISeriesApi<any> | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    // cleanup (hot reload safe)
    if (roRef.current) {
      try {
        roRef.current.disconnect();
      } catch {}
      roRef.current = null;
    }
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch {}
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
    }

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
      timeScale: { borderColor: "rgba(255,255,255,0.10)", timeVisible: true },
      handleScroll: true,
      handleScale: true,
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      borderVisible: false,
    });

    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });

    chart.priceScale("").applyOptions({ scaleMargins: { top: 0.82, bottom: 0.0 } });

    chartRef.current = chart;
    candleRef.current = candles as any;
    volRef.current = vol as any;

    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      chart.applyOptions({ width: Math.floor(r.width), height: Math.floor(r.height) });
    });
    ro.observe(el);
    roRef.current = ro;

    // initial size
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
      candleRef.current = null;
      volRef.current = null;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch(`/api/market/candles?symbol=${encodeURIComponent(sym)}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as ApiResp;
        if (!alive) return;

        const arr = Array.isArray(json?.candles) ? json.candles : [];
        const cdata = arr.map((c) => ({
          time: Math.floor(c.t / 1000) as any,
          open: Number(c.o),
          high: Number(c.h),
          low: Number(c.l),
          close: Number(c.c),
        }));
        candleRef.current?.setData(cdata);

        const vdata = arr.map((c) => {
          const up = Number(c.c) >= Number(c.o);
          return {
            time: Math.floor(c.t / 1000) as any,
            value: Number(c.v ?? 0),
            color: up ? "rgba(16,185,129,0.45)" : "rgba(239,68,68,0.45)",
          };
        });
        volRef.current?.setData(vdata);

        chartRef.current?.timeScale().fitContent();
      } catch {
        candleRef.current?.setData([]);
        volRef.current?.setData([]);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [sym]);

  return <div ref={hostRef} className="w-full h-full" />;
}
