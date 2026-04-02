// lib/scanner/signals/confirmation.ts
import type { StockData } from "../types"

export function confirmationScore(d: StockData): number {
  const changePercent = d.prevClose ? ((d.price - d.prevClose) / d.prevClose) * 100 : 0
  const isBullMove = changePercent > 0.5
  const isBearMove = changePercent < -0.5

  // Volume confirmation: is today's volume confirming the move?
  const volumeConfirmation = (() => {
    if (d.candles1m.length < 5) return 30
    const recentVols = d.candles1m.slice(-10).map(c => c.volume)
    const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length
    const latestVol = d.candles1m[d.candles1m.length - 1]?.volume ?? 0
    if (avgVol === 0) return 0
    const ratio = latestVol / avgVol
    if ((isBullMove || isBearMove) && ratio > 1.5) return Math.min(ratio * 30, 100)
    if ((isBullMove || isBearMove) && ratio < 0.5) return 10 // move on weak volume
    return 40
  })()

  // Spread confirmation: tight spread = confirmed liquidity
  const spreadConfirmation = (() => {
    if (!d.level2 || d.price === 0) return 40
    const spreadPct = (d.level2.spread / d.price) * 100
    if (spreadPct < 0.02) return 100
    if (spreadPct < 0.05) return 80
    if (spreadPct < 0.10) return 60
    if (spreadPct < 0.25) return 40
    return 15
  })()

  // Flow confirmation: are buys > sells in an up move?
  const flowConfirmation = (() => {
    if (!d.trades || d.trades.length < 5) return 40
    const recent = d.trades.slice(-50)
    const buyVol = recent.filter(t => t.side === "buy").reduce((s, t) => s + t.size, 0)
    const sellVol = recent.filter(t => t.side === "sell").reduce((s, t) => s + t.size, 0)
    const total = buyVol + sellVol
    if (total === 0) return 0
    const buyRatio = buyVol / total
    if (isBullMove && buyRatio > 0.6) return Math.min(buyRatio * 120, 100)
    if (isBearMove && buyRatio < 0.4) return Math.min((1 - buyRatio) * 120, 100)
    // Flow opposes direction → unconfirmed
    if (isBullMove && buyRatio < 0.35) return 10
    if (isBearMove && buyRatio > 0.65) return 10
    return 40
  })()

  // Price continuation: are recent candles following through?
  const continuationScore = (() => {
    if (d.candles1m.length < 5) return 30
    const last5 = d.candles1m.slice(-5)
    let consecutive = 0
    for (const c of last5) {
      if (isBullMove && c.close > c.open) consecutive++
      else if (isBearMove && c.close < c.open) consecutive++
    }
    return Math.min(consecutive * 20, 100)
  })()

  // Depth confirmation: order book supports direction
  const depthConfirmation = (() => {
    if (!d.level2) return 40
    const { bidSize, askSize } = d.level2
    const total = bidSize + askSize
    if (total === 0) return 0
    const bidRatio = bidSize / total
    if (isBullMove && bidRatio > 0.6) return Math.min(bidRatio * 120, 100)
    if (isBearMove && bidRatio < 0.4) return Math.min((1 - bidRatio) * 120, 100)
    return 40
  })()

  // Sector confirmation
  const sectorConfirmation = (() => {
    if (d.sectorChangePercent == null) return 40
    if (isBullMove && d.sectorChangePercent > 0.5) return 80
    if (isBearMove && d.sectorChangePercent < -0.5) return 80
    // Ticker outperforming sector → extra conviction
    if (isBullMove && d.sectorChangePercent < -0.5) return 60
    return 40
  })()

  const raw = (
    volumeConfirmation * 0.25 +
    spreadConfirmation * 0.15 +
    flowConfirmation * 0.25 +
    continuationScore * 0.15 +
    depthConfirmation * 0.10 +
    sectorConfirmation * 0.10
  )
  return Math.max(0, Math.min(100, raw))
}
