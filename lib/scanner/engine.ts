// lib/scanner/engine.ts
import type { StockData, SignalScores, ScannerResult, Direction, ConvictionLevel, ScannerBucket } from "./types"
import { volumeScore } from "./signals/volume"
import { momentumScore } from "./signals/momentum"
import { structureScore } from "./signals/structure"
import { volatilityScore } from "./signals/volatility"
import { liquidityScore } from "./signals/liquidity"
import { orderflowScore } from "./signals/orderflow"
import { squeezeScore as squeezeSignalScore } from "./signals/squeeze"
import { catalystScore, catalystDirection } from "./signals/catalyst"
import { sentimentScore } from "./signals/sentiment"
import { confirmationScore } from "./signals/confirmation"

/* ─── Signal Computation ─── */

function computeSignals(d: StockData): SignalScores {
  return {
    volume: volumeScore(d),
    momentum: momentumScore(d),
    structure: structureScore(d),
    volatility: volatilityScore(d),
    liquidity: liquidityScore(d),
    orderflow: orderflowScore(d),
    squeeze: squeezeSignalScore(d),
    catalyst: catalystScore(d),
    sentiment: sentimentScore(d),
    confirmation: confirmationScore(d),
  }
}

/* ─── Risk Penalty ─── */

function computeRiskPenalty(d: StockData, scores: SignalScores): number {
  let penalty = 0

  // Wide spread penalty
  if (d.level2 && d.price > 0) {
    const spreadPct = (d.level2.spread / d.price) * 100
    if (spreadPct > 0.25) penalty += Math.min((spreadPct - 0.25) * 40, 15)
  }

  // Low liquidity penalty
  if (scores.liquidity < 25) penalty += (25 - scores.liquidity) * 0.4

  // Low volume penalty
  if (scores.volume < 15) penalty += 8

  // Contradicting signals: catalyst says bull but price is dumping (or vice versa)
  const dir = catalystDirection(d)
  const changePercent = d.prevClose ? ((d.price - d.prevClose) / d.prevClose) * 100 : 0
  if (dir === "bull" && changePercent < -3) penalty += 10
  if (dir === "bear" && changePercent > 3) penalty += 10

  // Unconfirmed volatility (high vol score + low confirmation = dangerous)
  if (scores.volatility > 70 && scores.confirmation < 30) penalty += 8

  return Math.min(penalty, 50)
}

/* ─── Directional Scores ─── */

function computeDirectionalScores(d: StockData, scores: SignalScores): { bullScore: number; bearScore: number } {
  const changePercent = d.prevClose ? ((d.price - d.prevClose) / d.prevClose) * 100 : 0
  const dir = catalystDirection(d)

  let bull = 0
  let bear = 0

  // Price action contribution
  if (changePercent > 0) bull += Math.min(changePercent * 8, 30)
  else bear += Math.min(Math.abs(changePercent) * 8, 30)

  // Catalyst direction
  if (dir === "bull") bull += scores.catalyst * 0.4
  else if (dir === "bear") bear += scores.catalyst * 0.4

  // Options flow
  if (d.unusualCallActivity != null && d.unusualCallActivity > 50) bull += d.unusualCallActivity * 0.2
  if (d.unusualPutActivity != null && d.unusualPutActivity > 50) bear += d.unusualPutActivity * 0.2

  // Confirmation supports direction
  if (changePercent > 0) bull += scores.confirmation * 0.2
  else bear += scores.confirmation * 0.2

  // Momentum
  if (changePercent > 0) bull += scores.momentum * 0.15
  else bear += scores.momentum * 0.15

  return {
    bullScore: Math.max(0, Math.min(100, bull)),
    bearScore: Math.max(0, Math.min(100, bear)),
  }
}

/* ─── Direction + Conviction ─── */

function assignDirection(bullScore: number, bearScore: number): Direction {
  const diff = bullScore - bearScore
  if (diff > 10) return "bull"
  if (diff < -10) return "bear"
  return "neutral"
}

function assignConviction(opportunityScore: number, riskPenalty: number, confirmation: number): ConvictionLevel {
  const adjusted = opportunityScore - riskPenalty * 0.5 + confirmation * 0.1
  if (adjusted > 60) return "high"
  if (adjusted > 35) return "medium"
  return "low"
}

/* ─── Bucket Assignment ─── */

function assignBucket(scores: SignalScores, direction: Direction, riskPenalty: number): ScannerBucket {
  if (riskPenalty >= 25) return "high_risk"
  if (scores.catalyst > 60 && scores.sentiment > 50) return "catalyst_driven"
  if (scores.squeeze > 65) return "squeeze_candidate"
  if (scores.momentum > 70 && scores.volume > 60 && direction === "bull") return "momentum_surge"
  if (scores.structure > 65 && scores.momentum > 55 && direction === "bull") return "breakout"
  if (scores.structure > 60 && scores.volume > 50 && direction === "bull") return "accumulation"
  if (scores.structure > 60 && scores.volume > 50 && direction === "bear") return "distribution"
  if (scores.volatility > 60 && scores.structure > 50) return "mean_reversion"
  return "neutral"
}

/* ─── Reason Builder ─── */

function buildReason(scores: SignalScores, direction: Direction, bucket: ScannerBucket, d: StockData): string {
  const parts: string[] = []
  const changePercent = d.prevClose ? ((d.price - d.prevClose) / d.prevClose) * 100 : 0
  const sign = changePercent >= 0 ? "+" : ""

  parts.push(`${sign}${changePercent.toFixed(1)}%`)

  if (scores.catalyst > 50 && d.catalystType && d.catalystType !== "none") {
    const label = d.catalystType.replace(/_/g, " ")
    parts.push(label)
  }
  if (scores.volume > 65) parts.push("high vol")
  if (scores.squeeze > 60) parts.push("squeeze")
  if (scores.momentum > 70) parts.push("momentum")
  if (scores.confirmation > 65) parts.push("confirmed")
  if (scores.confirmation < 25) parts.push("unconfirmed")
  if (bucket === "high_risk") parts.push("\u26A0 risk")

  return parts.join(" \u00B7 ")
}

/* ─── Master Scoring ─── */

export function computeScannerResult(d: StockData): ScannerResult {
  const scores = computeSignals(d)

  const riskPenalty = computeRiskPenalty(d, scores)
  const { bullScore, bearScore } = computeDirectionalScores(d, scores)
  const direction = assignDirection(bullScore, bearScore)
  const bucket = assignBucket(scores, direction, riskPenalty)

  // Opportunity score: catalyst-first weighting
  const opportunityScore = Math.max(0, Math.min(100,
    scores.catalyst * 0.25 +
    scores.sentiment * 0.20 +
    scores.confirmation * 0.20 +
    scores.liquidity * 0.15 +
    scores.momentum * 0.10 +
    scores.structure * 0.10 -
    riskPenalty
  ))

  const conviction = assignConviction(opportunityScore, riskPenalty, scores.confirmation)
  const reason = buildReason(scores, direction, bucket, d)

  // Legacy composite scores (backward compat)
  const totalScore = Math.round(
    scores.volume * 0.10 +
    scores.momentum * 0.12 +
    scores.structure * 0.10 +
    scores.volatility * 0.08 +
    scores.liquidity * 0.10 +
    scores.orderflow * 0.10 +
    scores.squeeze * 0.05 +
    scores.catalyst * 0.15 +
    scores.sentiment * 0.10 +
    scores.confirmation * 0.10
  )

  const breakoutScore = Math.round(scores.momentum * 0.35 + scores.volume * 0.25 + scores.structure * 0.25 + scores.liquidity * 0.15)
  const accumulationScore = Math.round(scores.structure * 0.35 + scores.volume * 0.25 + scores.liquidity * 0.25 + scores.orderflow * 0.15)
  const scalpScore = Math.round(scores.volatility * 0.30 + scores.liquidity * 0.25 + scores.orderflow * 0.25 + scores.momentum * 0.20)
  const compositeSqueezeScore = Math.round(scores.squeeze * 0.40 + scores.volume * 0.25 + scores.momentum * 0.20 + scores.structure * 0.15)

  return {
    symbol: d.symbol,
    totalScore,
    scores,
    breakoutScore,
    accumulationScore,
    scalpScore,
    squeezeScore: compositeSqueezeScore,
    opportunityScore,
    bullScore,
    bearScore,
    riskPenalty,
    direction,
    conviction,
    bucket,
    reason,
  }
}

/* ─── Ranking ─── */

export function rankStocks(stocks: StockData[]): ScannerResult[] {
  return stocks
    .map(computeScannerResult)
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
}