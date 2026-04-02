// lib/scanner/signals/catalyst.ts
import type { StockData, CatalystType, Direction } from "../types"

const CATALYST_WEIGHTS: Record<CatalystType, number> = {
  earnings_beat: 85,
  earnings_miss: 85,
  guidance_raise: 90,
  guidance_lower: 90,
  fda_approval: 95,
  fda_rejection: 95,
  merger_announced: 80,
  buyback_announced: 60,
  insider_buy: 70,
  insider_sell: 55,
  sec_filing: 40,
  analyst_upgrade: 65,
  analyst_downgrade: 65,
  contract_win: 70,
  product_launch: 60,
  macro_event: 50,
  none: 0,
}

const BULLISH_CATALYSTS: CatalystType[] = [
  "earnings_beat", "guidance_raise", "fda_approval", "merger_announced",
  "buyback_announced", "insider_buy", "analyst_upgrade", "contract_win", "product_launch",
]

const BEARISH_CATALYSTS: CatalystType[] = [
  "earnings_miss", "guidance_lower", "fda_rejection", "insider_sell", "analyst_downgrade",
]

export function catalystDirection(d: StockData): Direction {
  if (!d.catalystType || d.catalystType === "none") return "neutral"
  if (BULLISH_CATALYSTS.includes(d.catalystType)) return "bull"
  if (BEARISH_CATALYSTS.includes(d.catalystType)) return "bear"
  return "neutral"
}

export function catalystScore(d: StockData): number {
  const catalystImportance = CATALYST_WEIGHTS[d.catalystType ?? "none"] ?? 0

  const credibilityFactor = d.sourceCredibility != null
    ? d.sourceCredibility / 100
    : (d.newsScore != null ? Math.min(d.newsScore / 5, 1) : 0.5)

  const recencyFactor = (() => {
    if (d.headlineRecencyMin == null) return 0.5
    if (d.headlineRecencyMin <= 5) return 1.0
    if (d.headlineRecencyMin <= 15) return 0.85
    if (d.headlineRecencyMin <= 60) return 0.6
    if (d.headlineRecencyMin <= 240) return 0.3
    return 0.1
  })()

  const newsBoost = d.newsScore != null ? Math.min(d.newsScore * 8, 40) : 0

  const gap = d.prevClose ? Math.abs((d.price - d.prevClose) / d.prevClose) : 0
  const gapScore = Math.min(gap * 500, 50)

  const vol = d.candles1m.reduce((s, c) => s + c.volume, 0)
  const avgVol = d.candles1m.length > 0 ? vol / d.candles1m.length : 0
  const last = d.candles1m[d.candles1m.length - 1]?.volume ?? 0
  const gapVolumeConfirm = avgVol > 0 && last > avgVol * 2 ? 20 : 0

  const optionsFlowFactor = d.optionsFlowScore != null
    ? d.optionsFlowScore * 0.3
    : 0

  const raw = (
    catalystImportance * credibilityFactor * recencyFactor * 0.01 * 50 +
    newsBoost +
    gapScore +
    gapVolumeConfirm +
    optionsFlowFactor
  )
  return Math.max(0, Math.min(100, raw))
}