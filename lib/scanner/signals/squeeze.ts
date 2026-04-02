// lib/scanner/signals/squeeze.ts

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
 * Low Float Score
 * Lower float = higher squeeze potential
 */
function floatScore(data: StockData): number {
  if (!data.float || data.float <= 0) return 0

  // 5M float = max score
  return clampScore(5_000_000 / data.float, 1)
}

/**
 * Short Interest Score
 */
function shortInterestScore(data: StockData): number {
  if (!data.shortInterestPercent) return 0

  // 40% short interest = max
  return clampScore(data.shortInterestPercent / 100, 0.4)
}

/**
 * Rapid Upside Move
 */
function upsideMomentumScore(data: StockData): number {
  if (!data.prevClose || data.prevClose === 0) return 0

  const change =
    (data.price - data.prevClose) / data.prevClose

  // 15% move = max
  return clampScore(change, 0.15)
}

/**
 * Volume Expansion (basic)
 */
function volumeExpansionScore(data: StockData): number {
  const candles = data.candles1m
  if (!candles || candles.length < 30) return 0

  const recentVol = candles
    .slice(-5)
    .reduce((sum, c) => sum + c.volume, 0)

  const baselineVol =
    candles
      .slice(-30, -5)
      .reduce((sum, c) => sum + c.volume, 0) / 25

  if (baselineVol === 0) return 0

  const ratio = recentVol / (baselineVol * 5)

  // 3x volume expansion = max
  return clampScore(ratio - 1, 3)
}

/**
 * Master Squeeze Score
 */
export function squeezeScore(data: StockData): number {
  const floatS = floatScore(data)
  const shortS = shortInterestScore(data)
  const momentum = upsideMomentumScore(data)
  const volume = volumeExpansionScore(data)

  const total =
    0.3 * floatS +
    0.3 * shortS +
    0.25 * momentum +
    0.15 * volume

  return Math.round(total)
}