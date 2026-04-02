// lib/scanner/signals/momentum.ts

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
 * Intraday % change from previous close
 */
function percentChangeScore(data: StockData): number {
  if (!data.prevClose || data.prevClose === 0) return 0

  const change = (data.price - data.prevClose) / data.prevClose
  return clampScore(change, 0.10) // 10% move = max
}

/**
 * Range Expansion Velocity
 * Measures speed of price expansion over last 5 candles
 */
function rangeVelocityScore(data: StockData): number {
  const candles = data.candles1m
  if (!candles || candles.length < 6) return 0

  const last5 = candles.slice(-5)

  const high = Math.max(...last5.map(c => c.high))
  const low = Math.min(...last5.map(c => c.low))

  const range = high - low

  if (data.price === 0) return 0

  const normalized = range / data.price
  return clampScore(normalized, 0.02) // 2% expansion over 5m = max
}

/**
 * Relative Strength vs SPY
 */
function relativeStrengthScore(data: StockData): number {
  if (data.spyChangePercent === undefined) return 0
  if (!data.prevClose || data.prevClose === 0) return 0

  const stockChange =
    (data.price - data.prevClose) / data.prevClose

  const rs = stockChange - data.spyChangePercent

  return clampScore(rs, 0.05) // 5% outperformance = max
}

/**
 * Breakout Pressure
 * Detects proximity to day high
 */
function breakoutPressureScore(data: StockData): number {
  if (!data.dayHigh || data.dayHigh === 0) return 0

  const distance = (data.dayHigh - data.price) / data.dayHigh

  // Closer to high = higher score
  return clampScore(0.02 - distance, 0.02) // within 2% = max
}

/**
 * Master Momentum Score
 */
export function momentumScore(data: StockData): number {
  const pct = percentChangeScore(data)
  const velocity = rangeVelocityScore(data)
  const rs = relativeStrengthScore(data)
  const breakout = breakoutPressureScore(data)

  const total =
    0.35 * pct +
    0.25 * velocity +
    0.25 * rs +
    0.15 * breakout

  return Math.round(total)
}