// lib/scanner/signals/structure.ts

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
 * Average True Range approximation
 */
function averageRange(candles: { high: number; low: number }[], count: number): number {
  if (!candles || candles.length < count) return 0

  const slice = candles.slice(-count)
  const total = slice.reduce((sum, c) => sum + (c.high - c.low), 0)
  return total / count
}

/**
 * Compression Score
 * Short-term range vs longer-term range
 */
function compressionScore(data: StockData): number {
  const candles = data.candles1m
  if (!candles || candles.length < 30) return 0

  const shortRange = averageRange(candles, 5)
  const longRange = averageRange(candles, 30)

  if (longRange === 0) return 0

  const ratio = shortRange / longRange

  // Lower ratio = more compression
  return clampScore(0.5 - ratio, 0.5)
}

/**
 * Trend Quality Score
 * Measures higher-high / higher-low consistency
 */
function trendQualityScore(data: StockData): number {
  const candles = data.candles1m
  if (!candles || candles.length < 10) return 0

  const last10 = candles.slice(-10)

  let higherHighs = 0
  let higherLows = 0

  for (let i = 1; i < last10.length; i++) {
    if (last10[i].high > last10[i - 1].high) higherHighs++
    if (last10[i].low > last10[i - 1].low) higherLows++
  }

  const consistency = (higherHighs + higherLows) / 18 // max possible = 18
  return clampScore(consistency, 1)
}

/**
 * Base Breakout Structure
 * Detect tight range then push above
 */
function expansionFromBaseScore(data: StockData): number {
  const candles = data.candles1m
  if (!candles || candles.length < 20) return 0

  const base = candles.slice(-20, -5)
  const breakoutZone = candles.slice(-5)

  const baseHigh = Math.max(...base.map(c => c.high))
  const breakoutHigh = Math.max(...breakoutZone.map(c => c.high))

  const expansion = breakoutHigh - baseHigh

  if (data.price === 0) return 0

  const normalized = expansion / data.price
  return clampScore(normalized, 0.02) // 2% expansion from base = max
}

/**
 * Master Structure Score
 */
export function structureScore(data: StockData): number {
  const compression = compressionScore(data)
  const trend = trendQualityScore(data)
  const expansion = expansionFromBaseScore(data)

  const total =
    0.4 * compression +
    0.35 * trend +
    0.25 * expansion

  return Math.round(total)
}