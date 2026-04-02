// lib/scanner/signals/volume.ts

import { StockData } from "../types"

/**
 * Normalize value to 0–100 range
 */
function clampScore(value: number, max: number): number {
  if (value <= 0) return 0
  if (value >= max) return 100
  return Math.round((value / max) * 100)
}

/**
 * Calculate average volume over last N candles
 */
function averageVolume(candles: { volume: number }[], count: number): number {
  if (!candles || candles.length < count) return 0

  const slice = candles.slice(-count)
  const total = slice.reduce((sum, c) => sum + c.volume, 0)
  return total / count
}

/**
 * Volume Acceleration
 * Detects rapid increase in participation
 */
function volumeAcceleration(data: StockData): number {
  const candles = data.candles1m
  if (!candles || candles.length < 10) return 0

  const last5 = averageVolume(candles, 5)
  const prev5 = averageVolume(candles.slice(0, -5), 5)

  if (prev5 === 0) return 0

  const acceleration = (last5 - prev5) / prev5
  return clampScore(acceleration, 2) // 2x acceleration = max score
}

/**
 * Relative Volume (current vs 30-period baseline)
 */
function relativeVolume(data: StockData): number {
  const candles = data.candles1m
  if (!candles || candles.length < 30) return 0

  const current = averageVolume(candles, 5)
  const baseline = averageVolume(candles, 30)

  if (baseline === 0) return 0

  const ratio = current / baseline
  return clampScore(ratio - 1, 3) // 3x above baseline = max
}

/**
 * Volume Spike Detection
 * Measures single candle abnormality
 */
function spikeScore(data: StockData): number {
  const candles = data.candles1m
  if (!candles || candles.length < 20) return 0

  const last = candles[candles.length - 1]
  const baseline = averageVolume(candles.slice(0, -1), 20)

  if (baseline === 0) return 0

  const spike = last.volume / baseline
  return clampScore(spike - 1, 5) // 5x spike = max
}

/**
 * Master Volume Score (0–100)
 */
export function volumeScore(data: StockData): number {
  const accel = volumeAcceleration(data)
  const rel = relativeVolume(data)
  const spike = spikeScore(data)

  // Weighted blend
  const total =
    0.4 * accel +
    0.4 * rel +
    0.2 * spike

  return Math.round(total)
}