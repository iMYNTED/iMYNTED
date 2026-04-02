// lib/scanner/signals/volatility.ts

import { StockData } from "../types"

/**
 * Clamp helper (0–100)
 */
function clampScore(value: number, max: number): number {
  if (value <= 0) return 0
  if (value >= max) return 100
  return Math.round((value / max) * 100)
}

/**
 * Average range helper
 */
function averageRange(
  candles: { high: number; low: number }[],
  count: number
): number {
  if (!candles || candles.length < count) return 0

  const slice = candles.slice(-count)
  const total = slice.reduce((sum, c) => sum + (c.high - c.low), 0)
  return total / count
}

/**
 * Volatility Expansion
 * Short-term range vs long-term range
 */
function volatilityExpansionScore(data: StockData): number {
  const candles = data.candles1m
  if (!candles || candles.length < 30) return 0

  const shortRange = averageRange(candles, 5)
  const longRange = averageRange(candles, 30)

  if (longRange === 0) return 0

  const ratio = shortRange / longRange

  // Expansion when short > long
  return clampScore(ratio - 1, 2) // 2x expansion = max
}

/**
 * Abnormal Candle Detection
 */
function abnormalCandleScore(data: StockData): number {
  const candles = data.candles1m
  if (!candles || candles.length < 15) return 0

  const last = candles[candles.length - 1]
  const baseline = averageRange(candles.slice(0, -1), 15)

  if (baseline === 0) return 0

  const range = last.high - last.low
  const spike = range / baseline

  return clampScore(spike - 1, 4) // 4x abnormal range = max
}

/**
 * Dead Ticker Penalty
 * Penalizes extremely low movement stocks
 */
function deadTickerPenalty(data: StockData): number {
  const candles = data.candles1m
  if (!candles || candles.length < 10) return 100

  const shortRange = averageRange(candles, 5)

  if (data.price === 0) return 100

  const normalized = shortRange / data.price

  // If less than 0.1% movement over 5 mins → penalize heavily
  if (normalized < 0.001) return 0

  return 100
}

/**
 * Master Volatility Score
 */
export function volatilityScore(data: StockData): number {
  const expansion = volatilityExpansionScore(data)
  const abnormal = abnormalCandleScore(data)
  const alive = deadTickerPenalty(data)

  const total =
    0.5 * expansion +
    0.3 * abnormal +
    0.2 * alive

  return Math.round(total)
}