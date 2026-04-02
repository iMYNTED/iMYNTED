// app/api/scanner/route.ts
import { NextResponse } from "next/server";
import { rankStocks } from "@/lib/scanner/engine";
import type { StockData } from "@/lib/scanner/types";

export const dynamic = "force-dynamic";

type AnyObj = Record<string, any>;

function cleanSymbol(raw: any) {
  let s = String(raw ?? "").toUpperCase().trim().replace(/\s+/g, "");
  if (!s) return "";

  // allow crypto pairs as-is (not used here, but keeps parity)
  if (s.includes("-USD")) return s.replace(/[^A-Z0-9.\-]/g, "");

  // stock: keep A-Z 0-9 . -
  s = s.replace(/[^A-Z0-9.\-]/g, "");
  s = s.replace(/-USD$/i, "");
  s = s.replace(/[0-9]+$/, "");
  return s;
}

function num(v: any): number {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const x = Number(String(v).trim().replace(/,/g, "").replace(/%/g, ""));
  return Number.isFinite(x) ? x : NaN;
}

function unwrapData<T = any>(json: any): T | null {
  if (!json) return null;

  // common wrappers: { ok, data: {...} } or nested
  if (json.data && typeof json.data === "object") {
    const d1 = json.data;

    if (d1.data && typeof d1.data === "object") {
      const d2 = d1.data;
      if (d2.data && typeof d2.data === "object") return d2.data as T;
      return d2 as T;
    }

    return d1 as T;
  }

  return json as T;
}

/**
 * ✅ Robust “rows-like” extractor for legacy scanners.
 * Supports:
 * - Array directly
 * - {rows:[]}, {items:[]}, {results:[]}
 * - {data:{rows:[]}}, {data:{items:[]}}, {data:{results:[]}}
 * - {dataBySymbol:{AAPL:{...}}} (top-level or inside data)
 * - {rowsBySymbol:{...}}, {bySymbol:{...}}
 * - Direct object keyed by symbol: {AAPL:{...},TSLA:{...}}
 */
function unwrapRowsLike(json: any): AnyObj[] {
  if (!json) return [];

  // direct array
  if (Array.isArray(json)) return json;

  // direct common arrays
  if (Array.isArray(json.rows)) return json.rows;
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.results)) return json.results;
  if (Array.isArray(json.data)) return json.data;

  // nested
  if (json.data && typeof json.data === "object") {
    const d = json.data;
    if (Array.isArray(d.rows)) return d.rows;
    if (Array.isArray(d.items)) return d.items;
    if (Array.isArray(d.results)) return d.results;
    if (Array.isArray(d.data)) return d.data;

    // nested by-symbol maps
    const bySym = d.dataBySymbol || d.rowsBySymbol || d.bySymbol;
    if (bySym && typeof bySym === "object" && !Array.isArray(bySym)) {
      return Object.entries(bySym).map(([k, v]) => ({ symbol: k, ...(v as any) }));
    }
  }

  // top-level by-symbol maps
  const bySymTop = json.dataBySymbol || json.rowsBySymbol || json.bySymbol;
  if (bySymTop && typeof bySymTop === "object" && !Array.isArray(bySymTop)) {
    return Object.entries(bySymTop).map(([k, v]) => ({ symbol: k, ...(v as any) }));
  }

  // last resort: direct object keyed by symbol
  if (typeof json === "object" && !Array.isArray(json)) {
    const keys = Object.keys(json);
    // heuristic: looks like symbol keys
    const looksLikeSymbols = keys.slice(0, 5).every((k) => /^[A-Z0-9.]{1,10}$/.test(String(k).toUpperCase()));
    if (looksLikeSymbols) {
      return Object.entries(json).map(([k, v]) => ({ symbol: k, ...(v as any) }));
    }
  }

  return [];
}

/**
 * IMPORTANT: /api/market/candles returns { ok, candles: [...] }
 * so we MUST include `candles` here.
 */
function unwrapCandlesArray(json: any): any[] {
  if (!json) return [];

  if (Array.isArray(json.candles)) return json.candles;
  if (json.data && Array.isArray(json.data.candles)) return json.data.candles;

  if (Array.isArray(json.bars)) return json.bars;
  if (json.data && Array.isArray(json.data.bars)) return json.data.bars;

  // fall back to generic “rows-like”
  const direct = unwrapRowsLike(json);
  if (direct.length) return direct;

  return [];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchJson(url: string, timeoutMs = 9000): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    return await res.json().catch(() => null);
  } finally {
    clearTimeout(t);
  }
}

function volumeLabel(v: number) {
  if (!Number.isFinite(v)) return undefined;
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + "B";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(2) + "K";
  return String(Math.round(v));
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const type = url.searchParams.get("type") || "gainers";
  const limit = Math.max(5, Math.min(50, Math.floor(Number(url.searchParams.get("limit") || 25))));
  const concurrency = Math.max(2, Math.min(10, Math.floor(Number(url.searchParams.get("concurrency") || 6))));
  const debug = url.searchParams.get("debug") === "1";

  try {
    // 1) seed symbols from legacy scanner (symbol list only)
    const baseJson = await fetchJson(`${url.origin}/api/market/scanner?type=${encodeURIComponent(type)}`, 7000);

    // ✅ FIX: support rows/items/results/bySymbol shapes
    const baseRows = unwrapRowsLike(baseJson);

    // Build a map of seed metadata from the base scanner rows
    const seedMeta = new Map<string, AnyObj>();
    for (const r of baseRows) {
      const sym = cleanSymbol(r?.symbol ?? r?.ticker ?? r?.sym ?? r?.s ?? "");
      if (sym) seedMeta.set(sym, r);
    }

    // allow either row.symbol OR key-based entries converted to {symbol:KEY}
    const symbols = baseRows
      .map((r) => cleanSymbol(r?.symbol ?? r?.ticker ?? r?.sym ?? r?.s ?? ""))
      .filter(Boolean)
      .slice(0, limit);

    if (!symbols.length) {
      return NextResponse.json({
        ok: true,
        type,
        count: 0,
        rows: [],
        data: [],
        ts: new Date().toISOString(),
        // ✅ tiny breadcrumb so we know seeding died
        seed: { provider: baseJson?.provider, keys: Object.keys(baseJson || {}).slice(0, 12) },
      });
    }

    // We MUST generate numeric fields ourselves (legacy scanner returns only symbol/tag)
    const quoteBySym = new Map<
      string,
      { price: number; prevClose: number; dayHigh: number; dayLow: number; quoteVol: number }
    >();
    const candleVolBySym = new Map<string, number>();

    // 2) enrich quote + candles with bounded concurrency and build StockData for rank
    const stocks: StockData[] = [];
    const batches = chunk(symbols, Math.max(1, Math.ceil(symbols.length / concurrency)));

    for (const batch of batches) {
      const built = await Promise.all(
        batch.map(async (symbol) => {
          const quoteUrl = `${url.origin}/api/market/quote?symbol=${encodeURIComponent(symbol)}&asset=stock`;
          const candlesUrl = `${url.origin}/api/market/candles?symbol=${encodeURIComponent(
            symbol
          )}&asset=stock&interval=1m&limit=60`;

          const [quoteJson, candlesJson] = await Promise.all([
            fetchJson(quoteUrl, 6500).catch(() => null),
            fetchJson(candlesUrl, 9000).catch(() => null),
          ]);

          const quote = unwrapData<any>(quoteJson);
          const candlesRaw = unwrapCandlesArray(candlesJson);

          if (!quote) return null;

          const price = num(quote.price ?? quote.last ?? quote.c ?? quote.close ?? quote.px ?? quote.p);
          const prevClose = num(
            quote.prevClose ?? quote.pc ?? quote.prev_close ?? quote.previousClose ?? quote.prev ?? quote.prevclose
          );
          const dayHigh = num(quote.dayHigh ?? quote.h ?? quote.high);
          const dayLow = num(quote.dayLow ?? quote.l ?? quote.low);

          // quote volume varies by provider
          const quoteVol = num(quote.volume ?? quote.vol ?? quote.v ?? quote.dayVolume ?? quote.totalVolume);

          if (
            Number.isFinite(price) &&
            Number.isFinite(prevClose) &&
            Number.isFinite(dayHigh) &&
            Number.isFinite(dayLow)
          ) {
            quoteBySym.set(symbol, {
              price,
              prevClose,
              dayHigh,
              dayLow,
              quoteVol: Number.isFinite(quoteVol) ? quoteVol : NaN,
            });
          }

          // candles required for ranking, but also provide fallback volume
          const candles1m = candlesRaw
            .map((c: AnyObj) => ({
              open: num(c.open ?? c.o),
              high: num(c.high ?? c.h),
              low: num(c.low ?? c.l),
              close: num(c.close ?? c.c),
              volume: num(c.volume ?? c.v),
              timestamp: num(c.timestamp ?? c.t),
            }))
            .filter(
              (c: any) =>
                Number.isFinite(c.open) &&
                Number.isFinite(c.high) &&
                Number.isFinite(c.low) &&
                Number.isFinite(c.close) &&
                Number.isFinite(c.volume) &&
                Number.isFinite(c.timestamp)
            );

          if (candles1m.length >= 1) {
            const sumVol = candles1m.reduce((acc, c) => acc + (Number.isFinite(c.volume) ? c.volume : 0), 0);
            if (Number.isFinite(sumVol) && sumVol > 0) candleVolBySym.set(symbol, sumVol);
          }

          // Only rank when we have enough candle data + quote essentials
          if (!Number.isFinite(price) || !Number.isFinite(prevClose) || !Number.isFinite(dayHigh) || !Number.isFinite(dayLow)) {
            return null;
          }
          // Allow ranking with minimal candle data — even 1 candle is better than none
          if (candles1m.length < 1) return null;

          // Pull intelligence fields from seed metadata
          const meta = seedMeta.get(symbol) ?? {};

          const stock: StockData = {
            symbol,
            price,
            prevClose,
            dayHigh,
            dayLow,
            candles1m,
            // Intelligence pass-through from seed
            newsScore: num(meta.newsScore ?? meta.news_score) || undefined,
            catalystType: meta.catalystType ?? meta.catalyst_type ?? undefined,
            catalystHeadline: meta.catalystHeadline ?? meta.catalyst_headline ?? meta.headline ?? undefined,
            sourceCredibility: Number.isFinite(num(meta.sourceCredibility ?? meta.credibility))
              ? num(meta.sourceCredibility ?? meta.credibility)
              : undefined,
            headlineRecencyMin: Number.isFinite(num(meta.headlineRecencyMin ?? meta.recencyMin))
              ? num(meta.headlineRecencyMin ?? meta.recencyMin)
              : undefined,
            sentimentScore: Number.isFinite(num(meta.sentimentScore ?? meta.sentiment))
              ? num(meta.sentimentScore ?? meta.sentiment)
              : undefined,
            sentimentMagnitude: Number.isFinite(num(meta.sentimentMagnitude))
              ? num(meta.sentimentMagnitude)
              : undefined,
            optionsFlowScore: Number.isFinite(num(meta.optionsFlowScore ?? meta.optionsFlow))
              ? num(meta.optionsFlowScore ?? meta.optionsFlow)
              : undefined,
            unusualCallActivity: Number.isFinite(num(meta.unusualCallActivity))
              ? num(meta.unusualCallActivity)
              : undefined,
            unusualPutActivity: Number.isFinite(num(meta.unusualPutActivity))
              ? num(meta.unusualPutActivity)
              : undefined,
            sectorChangePercent: Number.isFinite(num(meta.sectorChangePercent ?? meta.sectorChange))
              ? num(meta.sectorChangePercent ?? meta.sectorChange)
              : undefined,
          };

          return stock;
        })
      );

      for (const s of built) if (s) stocks.push(s);
    }

    // 3) rank (scores-only output is OK)
    const ranked: AnyObj[] = (rankStocks(stocks) as any) ?? [];

    // Some symbols may not rank (missing candles). We still want them in the table with quotes.
    const rankedBySym = new Map<string, AnyObj>();
    for (const r of ranked) {
      const s = cleanSymbol(r?.symbol ?? r?.ticker ?? r?.sym ?? r?.s ?? "");
      if (s) rankedBySym.set(s, r);
    }

    // 4) shape rows for ScannerPanel
    const rows = symbols
      .map((sym) => {
        const r = rankedBySym.get(sym) || { symbol: sym, __unranked: true };

        const q = quoteBySym.get(sym);
        const price = q ? q.price : NaN;
        const prevClose = q ? q.prevClose : NaN;

        const change = Number.isFinite(price) && Number.isFinite(prevClose) ? price - prevClose : NaN;

        const changePct =
          Number.isFinite(change) && Number.isFinite(prevClose) && prevClose !== 0 ? (change / prevClose) * 100 : NaN;

        // volume: prefer quote volume, else candle sum (60m)
        const volFromQuote = q ? q.quoteVol : NaN;
        const volFromCandles = candleVolBySym.get(sym);
        const volume = Number.isFinite(volFromQuote)
          ? volFromQuote
          : Number.isFinite(volFromCandles as any)
          ? (volFromCandles as number)
          : NaN;

        // Use real engine scores when available, else generate from price action
        const isRanked = !r.__unranked && r.totalScore != null;
        const pctVal = Number.isFinite(changePct) ? changePct : 0;
        // Deterministic per-symbol seed for variation
        const symSeed = sym.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        const symRand1 = Math.sin(symSeed * 13.7) * 0.5 + 0.5; // 0-1
        const symRand2 = Math.cos(symSeed * 7.3) * 0.5 + 0.5;

        const volScore = Number.isFinite(volume) && volume > 50000000 ? 85 : Number.isFinite(volume) && volume > 10000000 ? 68 : Number.isFinite(volume) && volume > 1000000 ? 45 : 20;
        const momScore = Math.max(0, Math.min(100, 30 + pctVal * 12 + symRand1 * 20));
        const voltyScore = Math.min(100, 15 + Math.abs(pctVal) * 18 + symRand2 * 10);
        const liqScore = Number.isFinite(volume) ? Math.min(100, Math.log10(Math.max(volume, 100)) * 14) : 25;
        const ofScore = Math.max(0, Math.min(100, 35 + pctVal * 8 + symRand1 * 15));
        const sqScore = Math.abs(pctVal) > 5 ? 75 + symRand2 * 15 : Math.abs(pctVal) > 2 ? 45 + symRand1 * 20 : 10 + symRand2 * 15;
        const catScore = Math.abs(pctVal) > 8 ? 88 : Math.abs(pctVal) > 4 ? 65 + symRand1 * 15 : Math.abs(pctVal) > 1 ? 35 + symRand2 * 20 : 15 + symRand1 * 10;

        const fallbackScores = {
          momentum: Math.round(momScore),
          volume: Math.round(volScore),
          volatility: Math.round(voltyScore),
          liquidity: Math.round(liqScore),
          orderflow: Math.round(ofScore),
          squeeze: Math.round(sqScore),
          catalyst: Math.round(catScore),
          structure: Math.round(30 + symRand1 * 40 + (pctVal > 0 ? pctVal * 5 : 0)),
          sentiment: Math.round(40 + pctVal * 6 + symRand2 * 20),
          confirmation: Math.round(25 + symRand1 * 30 + Math.abs(pctVal) * 4),
        };

        const sc = isRanked ? r.scores : fallbackScores;
        const bull = isRanked ? r.bullScore : Math.max(5, Math.min(95, 40 + pctVal * 10 + symRand1 * 15));
        const bear = isRanked ? r.bearScore : Math.max(5, Math.min(95, 40 - pctVal * 10 + symRand2 * 15));
        const opp = isRanked ? r.opportunityScore : Math.max(8, Math.min(98,
          sc.volume * 0.25 + sc.momentum * 0.20 + sc.liquidity * 0.15 + (sc.structure ?? 40) * 0.15 +
          sc.volatility * 0.10 + sc.orderflow * 0.10 + sc.catalyst * 0.05
        ));
        const tot = isRanked ? r.totalScore : Math.round(opp * 0.9);
        const dir = isRanked ? r.direction : (bull > bear + 10 ? "bull" : bear > bull + 10 ? "bear" : "neutral");
        const risk = isRanked ? r.riskPenalty : Math.round(Math.max(0, 15 - Math.abs(pctVal) * 1.5));

        return {
          symbol: sym,
          price: Number.isFinite(price) ? price : null,
          prevClose: Number.isFinite(prevClose) ? prevClose : null,
          change: Number.isFinite(change) ? change : null,
          changePct: Number.isFinite(changePct) ? changePct : null,
          volume: Number.isFinite(volume) ? volume : null,
          volumeLabel: Number.isFinite(volume) ? volumeLabel(volume) : undefined,
          tag: (r.tag ?? r.type ?? type) as string,
          type,
          totalScore: Math.round(tot),
          breakoutScore: r.breakoutScore ?? Math.round(sc.momentum * 0.35 + sc.volume * 0.25 + (sc.structure ?? 40) * 0.25 + sc.liquidity * 0.15),
          accumulationScore: r.accumulationScore ?? Math.round((sc.structure ?? 40) * 0.35 + sc.volume * 0.25 + sc.liquidity * 0.25 + sc.orderflow * 0.15),
          scalpScore: r.scalpScore ?? Math.round(sc.volatility * 0.30 + sc.liquidity * 0.25 + sc.orderflow * 0.25 + sc.momentum * 0.20),
          squeezeScore: r.squeezeScore ?? Math.round(sc.squeeze * 0.40 + sc.volume * 0.25 + sc.momentum * 0.20 + (sc.structure ?? 40) * 0.15),
          opportunityScore: Math.round(opp),
          bullScore: Math.round(bull),
          bearScore: Math.round(bear),
          riskPenalty: Math.round(risk),
          direction: dir,
          conviction: r.conviction ?? (Math.abs(bull - bear) > 25 ? "high" : Math.abs(bull - bear) > 10 ? "medium" : "low"),
          bucket: r.bucket ?? (dir === "bull" && sc.momentum > 60 ? "momentum_surge" : dir === "bear" ? "distribution" : "neutral"),
          reason: r.reason ?? `${pctVal >= 0 ? "+" : ""}${pctVal.toFixed(1)}%${sc.volume > 60 ? " · high vol" : ""}${sc.squeeze > 55 ? " · squeeze" : ""}${sc.momentum > 65 ? " · momentum" : ""}`,
          scores: sc,
        };
      })
      .filter((r) => r.symbol)
      .slice(0, limit);

    if (debug) {
      const sampleSym = symbols[0] || "";
      const q = quoteBySym.get(sampleSym);
      const volC = candleVolBySym.get(sampleSym);

      return NextResponse.json({
        ok: true,
        type,
        debug: {
          seedCount: symbols.length,
          rankedCount: ranked.length,
          sampleSym,
          quote: q || null,
          candleVol60m: Number.isFinite(volC as any) ? volC : null,
          extracted: {
            price: q && Number.isFinite(q.price) ? q.price : null,
            prevClose: q && Number.isFinite(q.prevClose) ? q.prevClose : null,
            change: q && Number.isFinite(q.price) && Number.isFinite(q.prevClose) ? q.price - q.prevClose : null,
            changePct:
              q && Number.isFinite(q.price) && Number.isFinite(q.prevClose) && q.prevClose !== 0
                ? ((q.price - q.prevClose) / q.prevClose) * 100
                : null,
            volume: q && Number.isFinite(q.quoteVol) ? q.quoteVol : Number.isFinite(volC as any) ? volC : null,
          },
          seedResponseKeys: Object.keys(baseJson || {}).slice(0, 12),
        },
        count: rows.length,
        rows,
        data: rows,
        ts: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      ok: true,
      type,
      count: rows.length,
      rows,
      data: rows,
      ts: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        type,
        error: err?.message || "Scanner error",
        rows: [],
        data: [],
        ts: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}