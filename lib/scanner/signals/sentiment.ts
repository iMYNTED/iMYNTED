// lib/scanner/signals/sentiment.ts
import type { StockData } from "../types"

export function sentimentScore(d: StockData): number {
  const catalystAlignmentScore = (() => {
    if (!d.catalystType || d.catalystType === "none") return 0
    const bullish = [
      "earnings_beat", "guidance_raise", "fda_approval", "merger_announced",
      "buyback_announced", "insider_buy", "analyst_upgrade", "contract_win", "product_launch",
    ]
    const bearish = [
      "earnings_miss", "guidance_lower", "fda_rejection", "insider_sell", "analyst_downgrade",
    ]
    const changePercent = d.prevClose ? ((d.price - d.prevClose) / d.prevClose) * 100 : 0
    if (bullish.includes(d.catalystType) && changePercent > 0) return Math.min(changePercent * 4, 100)
    if (bearish.includes(d.catalystType) && changePercent < 0) return Math.min(Math.abs(changePercent) * 4, 100)
    // Catalyst opposes price → mismatch penalty
    if (bullish.includes(d.catalystType) && changePercent < -1) return 10
    if (bearish.includes(d.catalystType) && changePercent > 1) return 10
    return 30
  })()

  const credibilityScore = d.sourceCredibility != null
    ? d.sourceCredibility
    : (d.newsScore != null ? Math.min(d.newsScore * 20, 100) : 0)

  const recencyScore = (() => {
    if (d.headlineRecencyMin == null) return 0
    if (d.headlineRecencyMin <= 5) return 100
    if (d.headlineRecencyMin <= 15) return 80
    if (d.headlineRecencyMin <= 60) return 50
    if (d.headlineRecencyMin <= 240) return 25
    return 10
  })()

  const explicitSentimentScore = d.sentimentScore != null
    ? (d.sentimentScore + 1) * 50 // map -1..+1 to 0..100
    : 50

  const magnitudeScore = d.sentimentMagnitude != null
    ? d.sentimentMagnitude * 100
    : 30

  const raw = (
    catalystAlignmentScore * 0.30 +
    credibilityScore * 0.20 +
    recencyScore * 0.20 +
    explicitSentimentScore * 0.15 +
    magnitudeScore * 0.15
  )
  return Math.max(0, Math.min(100, raw))
}
