// lib/scanner/signals/liquidity.ts

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
 * Spread Tightness Score
 * Tighter spread = more tradable
 */
function spreadScore(data: StockData): number {
  const l2 = data.level2
  if (!l2 || data.price === 0) return 0

  const spreadPercent = l2.spread / data.price

  // 0.05% spread = max score
  return clampScore(0.0005 - spreadPercent, 0.0005)
}

/**
 * Bid vs Ask Imbalance
 * Strong bid support increases score
 */
function imbalanceScore(data: StockData): number {
  const l2 = data.level2
  if (!l2) return 0

  const total = l2.bidSize + l2.askSize
  if (total === 0) return 0

  const imbalance = l2.bidSize / total

  // 70%+ bid dominance = strong
  return clampScore(imbalance - 0.5, 0.5)
}

/**
 * Liquidity Vacuum Detection
 * If ask size is very small relative to bid
 */
function liquidityVacuumScore(data: StockData): number {
  const l2 = data.level2
  if (!l2) return 0

  if (l2.askSize === 0) return 100

  const ratio = l2.bidSize / l2.askSize

  // 3x bid over ask = max
  return clampScore(ratio - 1, 3)
}

/**
 * Master Liquidity Score
 */
export function liquidityScore(data: StockData): number {
  if (!data.level2) return 50 // neutral if no L2

  const spread = spreadScore(data)
  const imbalance = imbalanceScore(data)
  const vacuum = liquidityVacuumScore(data)

  const total =
    0.4 * spread +
    0.35 * imbalance +
    0.25 * vacuum

  return Math.round(total)
}