// lib/scanner/signals/orderflow.ts

import { StockData, TradePrint } from "../types"

/**
 * Clamp helper (0–100)
 */
function clampScore(value: number, max: number): number {
  if (value <= 0) return 0
  if (value >= max) return 100
  return Math.round((value / max) * 100)
}

/**
 * Calculate aggressive buy vs sell imbalance
 */
function aggressionScore(trades: TradePrint[]): number {
  if (!trades || trades.length < 20) return 0

  const recent = trades.slice(-50)

  let buyVolume = 0
  let sellVolume = 0

  for (const t of recent) {
    if (t.side === "buy") buyVolume += t.size
    if (t.side === "sell") sellVolume += t.size
  }

  const total = buyVolume + sellVolume
  if (total === 0) return 0

  const imbalance = buyVolume / total

  // 70%+ buy dominance strong
  return clampScore(imbalance - 0.5, 0.5)
}

/**
 * Large Lot Detection
 * Detect unusually large prints
 */
function largeLotScore(trades: TradePrint[]): number {
  if (!trades || trades.length < 20) return 0

  const recent = trades.slice(-50)

  const sizes = recent.map(t => t.size)
  const avg =
    sizes.reduce((a, b) => a + b, 0) / sizes.length

  if (avg === 0) return 0

  const maxPrint = Math.max(...sizes)
  const ratio = maxPrint / avg

  // 5x average size print = max
  return clampScore(ratio - 1, 5)
}

/**
 * Sustained Buying Pressure
 */
function sustainedPressureScore(trades: TradePrint[]): number {
  if (!trades || trades.length < 30) return 0

  const recent = trades.slice(-30)

  let buyStreak = 0
  let maxStreak = 0

  for (const t of recent) {
    if (t.side === "buy") {
      buyStreak++
      maxStreak = Math.max(maxStreak, buyStreak)
    } else {
      buyStreak = 0
    }
  }

  // 10+ consecutive buy prints = max
  return clampScore(maxStreak, 10)
}

/**
 * Master Orderflow Score
 */
export function orderflowScore(data: StockData): number {
  if (!data.trades || data.trades.length === 0)
    return 50 // neutral if no tape

  const aggression = aggressionScore(data.trades)
  const largeLots = largeLotScore(data.trades)
  const pressure = sustainedPressureScore(data.trades)

  const total =
    0.4 * aggression +
    0.35 * largeLots +
    0.25 * pressure

  return Math.round(total)
}