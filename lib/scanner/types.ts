// lib/scanner/types.ts

export interface Candle {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

export interface Level2Snapshot {
  bidSize: number
  askSize: number
  spread: number
}

export interface TradePrint {
  price: number
  size: number
  timestamp: number
  side: "buy" | "sell"
}

export type CatalystType =
  | "earnings_beat"
  | "earnings_miss"
  | "guidance_raise"
  | "guidance_lower"
  | "fda_approval"
  | "fda_rejection"
  | "merger_announced"
  | "buyback_announced"
  | "insider_buy"
  | "insider_sell"
  | "sec_filing"
  | "analyst_upgrade"
  | "analyst_downgrade"
  | "contract_win"
  | "product_launch"
  | "macro_event"
  | "none"

export type ScannerBucket =
  | "breakout"
  | "momentum_surge"
  | "squeeze_candidate"
  | "catalyst_driven"
  | "accumulation"
  | "distribution"
  | "mean_reversion"
  | "high_risk"
  | "neutral"

export type ConvictionLevel = "high" | "medium" | "low"
export type Direction = "bull" | "bear" | "neutral"

export interface StockData {
  symbol: string

  price: number
  prevClose: number
  dayHigh: number
  dayLow: number

  candles1m: Candle[]
  candles5m?: Candle[]

  level2?: Level2Snapshot
  trades?: TradePrint[]

  float?: number
  shortInterestPercent?: number

  newsScore?: number
  spyChangePercent?: number

  // Intelligence fields
  catalystType?: CatalystType
  catalystHeadline?: string
  sourceCredibility?: number      // 0-100
  headlineRecencyMin?: number     // minutes since headline
  sentimentScore?: number         // -1 to +1
  sentimentMagnitude?: number     // 0-1

  optionsFlowScore?: number       // 0-100
  unusualCallActivity?: number    // 0-100
  unusualPutActivity?: number     // 0-100

  sectorChangePercent?: number
  cryptoCorrelation?: number      // -1 to +1
  futuresLeadSignal?: number      // -1 to +1

  gapFillRisk?: number            // 0-1
  followThroughProbability?: number // 0-1
}

export interface SignalScores {
  volume: number
  momentum: number
  structure: number
  volatility: number
  liquidity: number
  orderflow: number
  squeeze: number
  catalyst: number
  sentiment: number
  confirmation: number
}

export interface ScannerResult {
  symbol: string

  totalScore: number
  scores: SignalScores

  breakoutScore: number
  accumulationScore: number
  scalpScore: number
  squeezeScore: number

  // Intelligence fields
  opportunityScore: number
  bullScore: number
  bearScore: number
  riskPenalty: number
  direction: Direction
  conviction: ConvictionLevel
  bucket: ScannerBucket
  reason: string
}