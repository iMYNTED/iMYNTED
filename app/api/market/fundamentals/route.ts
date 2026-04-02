// app/api/market/fundamentals/route.ts
// Consolidated company fundamentals via Finnhub free tier
// Provides: metrics, insider transactions, analyst recommendations, earnings
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";

// Cache: 30 min for fundamentals (doesn't change fast)
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 1_800_000;

async function finnhubFetch(path: string) {
  const res = await fetch(`https://finnhub.io/api/v1${path}${path.includes("?") ? "&" : "?"}token=${FINNHUB_KEY}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "").toUpperCase().trim();
  const section = url.searchParams.get("section") || "all"; // all, metrics, insider, recommendations, earnings

  if (!symbol) return NextResponse.json({ ok: false, error: "Missing symbol" }, { status: 400 });
  if (!FINNHUB_KEY) return NextResponse.json({ ok: false, error: "Finnhub key not configured" }, { status: 500 });

  const cacheKey = `${symbol}:${section}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ ok: true, data: cached.data, cached: true });
  }

  try {
    const data: Record<string, any> = {};

    if (section === "all" || section === "metrics") {
      const j = await finnhubFetch(`/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`);
      if (j?.metric) {
        const m = j.metric;
        data.metrics = {
          // Valuation
          pe: m.peTTM ?? m.peAnnual,
          peForward: m.peExclExtraAnnual,
          pb: m.pbAnnual ?? m.pbQuarterly,
          ps: m.psAnnual ?? m.psTTM,
          evEbitda: m["enterpriseValue/ebitdaTTM"],
          // Profitability
          epsAnnual: m.epsAnnual,
          epsTTM: m.epsTTM,
          epsGrowth5Y: m.epsGrowth5Y,
          revenueGrowth5Y: m.revenueGrowth5Y,
          roeTTM: m.roeTTM,
          roaTTM: m.roaTTM,
          roicTTM: m.roicTTM,
          grossMarginTTM: m.grossMarginTTM,
          operatingMarginTTM: m.operatingMarginTTM,
          netMarginTTM: m.netProfitMarginTTM,
          // Dividend
          dividendYieldTTM: m.currentDividendYieldTTM,
          dividendPerShare: m.dividendPerShareAnnual,
          dividendGrowth5Y: m.dividendGrowthRate5Y,
          payoutRatio: m.payoutRatioTTM,
          // Trading
          beta: m.beta,
          week52High: m["52WeekHigh"],
          week52Low: m["52WeekLow"],
          week52HighDate: m["52WeekHighDate"],
          week52LowDate: m["52WeekLowDate"],
          avgVolume10D: m["10DayAverageTradingVolume"],
          avgVolume3M: m["3MonthAverageTradingVolume"],
          // Balance sheet
          currentRatio: m.currentRatioQuarterly ?? m.currentRatioAnnual,
          debtEquity: m.totalDebt_totalEquityQuarterly ?? m.totalDebt_totalEquityAnnual,
          bookValuePerShare: m.bookValuePerShareQuarterly ?? m.bookValuePerShareAnnual,
          cashPerShare: m.cashPerSharePerShareQuarterly ?? m.cashPerSharePerShareAnnual,
          revenuePerShare: m.revenuePerShareTTM ?? m.revenuePerShareAnnual,
          // Returns
          return1W: m["5DayPriceReturnDaily"],
          return1M: m["13WeekPriceReturnDaily"],
          return6M: m["26WeekPriceReturnDaily"],
          return1Y: m["52WeekPriceReturnDaily"],
          returnYTD: m.yearToDatePriceReturnDaily,
        };
      }
    }

    if (section === "all" || section === "insider") {
      const j = await finnhubFetch(`/stock/insider-transactions?symbol=${encodeURIComponent(symbol)}`);
      if (j?.data && Array.isArray(j.data)) {
        data.insiderTransactions = j.data.slice(0, 30).map((t: any) => ({
          name: t.name || "",
          share: t.share || 0,
          change: t.change || 0,
          transactionDate: t.transactionDate || "",
          transactionCode: t.transactionCode || "",
          transactionPrice: t.transactionPrice || 0,
          filingDate: t.filingDate || "",
          isDerivative: t.isDerivative || false,
        }));
      }
    }

    if (section === "all" || section === "recommendations") {
      const j = await finnhubFetch(`/stock/recommendation?symbol=${encodeURIComponent(symbol)}`);
      if (Array.isArray(j)) {
        data.recommendations = j.slice(0, 12).map((r: any) => ({
          period: r.period || "",
          strongBuy: r.strongBuy || 0,
          buy: r.buy || 0,
          hold: r.hold || 0,
          sell: r.sell || 0,
          strongSell: r.strongSell || 0,
        }));
      }
    }

    if (section === "all" || section === "earnings") {
      const j = await finnhubFetch(`/stock/earnings?symbol=${encodeURIComponent(symbol)}`);
      if (Array.isArray(j)) {
        data.earnings = j.slice(0, 8).map((e: any) => ({
          period: e.period || "",
          actual: e.actual,
          estimate: e.estimate,
          surprise: e.surprise,
          surprisePercent: e.surprisePercent,
          quarter: e.quarter,
          year: e.year,
        }));
      }
    }

    if (section === "all" || section === "financials") {
      const j = await finnhubFetch(`/stock/financials-reported?symbol=${encodeURIComponent(symbol)}`);
      if (j?.data && Array.isArray(j.data) && j.data.length > 0) {
        // Extract key line items from the most recent filing
        function extractItems(items: any[]): Record<string, { label: string; value: number }> {
          const map: Record<string, { label: string; value: number }> = {};
          for (const item of items || []) {
            if (item.concept && item.value != null && item.unit === "usd") {
              map[item.concept] = { label: item.label || item.concept, value: item.value };
            }
          }
          return map;
        }

        // Get up to 4 most recent filings for trend
        const filings = j.data.slice(0, 4).map((f: any) => {
          const ic = extractItems(f.report?.ic);
          const bs = extractItems(f.report?.bs);
          const cf = extractItems(f.report?.cf);
          return {
            period: f.endDate?.split(" ")[0] || "",
            form: f.form || "",
            year: f.year,
            quarter: f.quarter,
            // Income statement
            revenue: ic["us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax"]?.value
              ?? ic["us-gaap_Revenues"]?.value ?? ic["us-gaap_SalesRevenueNet"]?.value,
            costOfRevenue: ic["us-gaap_CostOfGoodsAndServicesSold"]?.value ?? ic["us-gaap_CostOfRevenue"]?.value,
            grossProfit: ic["us-gaap_GrossProfit"]?.value,
            operatingIncome: ic["us-gaap_OperatingIncomeLoss"]?.value,
            netIncome: ic["us-gaap_NetIncomeLoss"]?.value,
            rd: ic["us-gaap_ResearchAndDevelopmentExpense"]?.value,
            sga: ic["us-gaap_SellingGeneralAndAdministrativeExpense"]?.value,
            eps: ic["us-gaap_EarningsPerShareDiluted"]?.value ?? ic["us-gaap_EarningsPerShareBasic"]?.value,
            // Balance sheet
            totalAssets: bs["us-gaap_Assets"]?.value,
            totalLiabilities: bs["us-gaap_Liabilities"]?.value,
            totalEquity: bs["us-gaap_StockholdersEquity"]?.value,
            cash: bs["us-gaap_CashAndCashEquivalentsAtCarryingValue"]?.value,
            totalDebt: bs["us-gaap_LongTermDebt"]?.value ?? bs["us-gaap_LongTermDebtNoncurrent"]?.value,
            // Cash flow
            operatingCashFlow: cf["us-gaap_NetCashProvidedByUsedInOperatingActivities"]?.value,
            capex: cf["us-gaap_PaymentsToAcquirePropertyPlantAndEquipment"]?.value,
            freeCashFlow: (() => {
              const ocf = cf["us-gaap_NetCashProvidedByUsedInOperatingActivities"]?.value;
              const cx = cf["us-gaap_PaymentsToAcquirePropertyPlantAndEquipment"]?.value;
              return ocf != null && cx != null ? ocf - cx : undefined;
            })(),
          };
        });

        data.financials = filings;
      }
    }

    cache.set(cacheKey, { data, ts: Date.now() });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Fundamentals fetch failed" }, { status: 500 });
  }
}
