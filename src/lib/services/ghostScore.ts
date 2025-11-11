// GhostScore calculation service
import type { Candle } from '../exchanges/types';
import {
  calculateEMA,
  calculateRSI,
  calculateATR,
  detectTrend,
  findSupportResistance,
  checkRSICondition,
} from '../indicators';
import { derivativesService } from './derivativesService';

export interface GhostScoreBreakdown {
  totalScore: number;
  trend: {
    score: number;
    direction: 'UPTREND' | 'DOWNTREND' | 'NEUTRAL';
    weight: number;
    sparkline: number[];
  };
  momentum: {
    score: number;
    rsi: number;
    rsiCondition: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
    weight: number;
    sparkline: number[];
  };
  volatility: {
    score: number;
    atr: number;
    atrPercent: number;
    weight: number;
    sparkline: number[];
  };
  structure: {
    score: number;
    nearSupport: boolean;
    nearResistance: boolean;
    weight: number;
    sparkline: number[];
  };
  volume: {
    score: number;
    volumeRatio: number;
    weight: number;
    sparkline: number[];
  };
  derivatives: {
    score: number;
    openInterest: number;
    fundingRate: number;
    longShortRatio: number;
    liquidationImbalance: number;
    weight: number;
    sparkline: number[];
  };
}

/**
 * Calculate the GhostScore - comprehensive strength indicator (0-100)
 * 
 * Components:
 * - Trend (30%): EMA alignment, direction strength
 * - Momentum (20%): RSI, rate of change
 * - Volatility (15%): ATR analysis, breakout potential
 * - Structure (15%): Support/resistance, price levels
 * - Volume (10%): Volume trends, institutional flow
 * - Derivatives (10%): Funding, OI, flow skew
 */
export async function calculateGhostScore(symbol: string, candles: Candle[]): Promise<GhostScoreBreakdown> {
  if (candles.length < 200) {
    throw new Error('Insufficient data for GhostScore calculation (need at least 200 candles)');
  }

  const prices = candles.map(c => c.close);
  const currentPrice = prices[prices.length - 1];

  // 1. TREND ANALYSIS (30% weight)
  const trendScore = calculateTrendScore(prices);

  // 2. MOMENTUM ANALYSIS (25% weight)
  const momentumScore = calculateMomentumScore(prices);

  // 3. VOLATILITY ANALYSIS (15% weight)
  const volatilityScore = calculateVolatilityScore(candles, currentPrice);

  // 4. STRUCTURE ANALYSIS (20% weight)
  const structureScore = calculateStructureScore(candles, currentPrice);

  // 5. VOLUME ANALYSIS (10% weight)
  const volumeScore = calculateVolumeScore(candles);

  // 6. DERIVATIVES ANALYSIS (10% weight)
  const derivativesScore = await calculateDerivativesScore(symbol, candles);

  // Calculate weighted total
  const totalScore = Math.round(
    trendScore.score * 0.30 +
    momentumScore.score * 0.20 +
    volatilityScore.score * 0.15 +
    structureScore.score * 0.15 +
    volumeScore.score * 0.10 +
    derivativesScore.score * 0.10
  );

  return {
    totalScore: Math.min(100, Math.max(0, totalScore)),
    trend: { ...trendScore, weight: 30 },
    momentum: { ...momentumScore, weight: 20 },
    volatility: { ...volatilityScore, weight: 15 },
    structure: { ...structureScore, weight: 15 },
    volume: { ...volumeScore, weight: 10 },
    derivatives: { ...derivativesScore, weight: 10 },
  };
}

/**
 * Calculate trend component (0-100)
 */
function calculateTrendScore(prices: number[]): {
  score: number;
  direction: 'UPTREND' | 'DOWNTREND' | 'NEUTRAL';
  sparkline: number[];
} {
  const direction = detectTrend(prices, 50, 200);
  const ema50 = calculateEMA(prices, 50);
  const ema200 = calculateEMA(prices, 200);

  if (ema50.length === 0 || ema200.length === 0) {
    return { score: 50, direction: 'NEUTRAL' };
  }

  const lastEma50 = ema50[ema50.length - 1];
  const lastEma200 = ema200[ema200.length - 1];
  const currentPrice = prices[prices.length - 1];

  let score = 50; // Neutral baseline

  if (direction === 'UPTREND') {
    // Strong uptrend: price above both EMAs, EMAs aligned
    const emaGap = ((lastEma50 - lastEma200) / lastEma200) * 100;
    const priceAboveEma50 = ((currentPrice - lastEma50) / lastEma50) * 100;

    score = 50 + Math.min(40, emaGap * 5) + Math.min(10, priceAboveEma50 * 2);
  } else if (direction === 'DOWNTREND') {
    // Strong downtrend: price below both EMAs
    const emaGap = ((lastEma200 - lastEma50) / lastEma200) * 100;
    const priceBelowEma50 = ((lastEma50 - currentPrice) / lastEma50) * 100;

    score = 50 - Math.min(40, emaGap * 5) - Math.min(10, priceBelowEma50 * 2);
  }

  const sparkline = normalizeSparkline(prices.slice(-20));

  return { score: Math.min(100, Math.max(0, score)), direction, sparkline };
}

/**
 * Calculate momentum component (0-100)
 */
function calculateMomentumScore(prices: number[]): {
  score: number;
  rsi: number;
  rsiCondition: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  sparkline: number[];
} {
  const rsiValues = calculateRSI(prices, 14);

  if (rsiValues.length === 0) {
    return { score: 50, rsi: 50, rsiCondition: 'NEUTRAL' };
  }

  const rsi = rsiValues[rsiValues.length - 1];
  const rsiCondition = checkRSICondition(rsi);

  // RSI 50 = neutral (score 50)
  // RSI 70+ = strong bullish momentum (score 80-100)
  // RSI 30- = oversold, potential reversal (score 60-70 for contrarian play)
  let score = rsi;

  if (rsiCondition === 'OVERSOLD') {
    // Oversold can be opportunity for reversal
    score = 50 + (30 - rsi); // 30 RSI = 70 score, 20 RSI = 80 score
  } else if (rsiCondition === 'OVERBOUGHT') {
    // Overbought but with momentum
    score = Math.min(100, rsi + 10);
  }

  // Check momentum direction (rising or falling RSI)
  if (rsiValues.length >= 3) {
    const rsiSlope =
      (rsiValues[rsiValues.length - 1] - rsiValues[rsiValues.length - 3]) / 2;
    score += rsiSlope;
  }

  const sparkline = normalizeSparkline(rsiValues.slice(-20));

  return {
    score: Math.min(100, Math.max(0, score)),
    rsi: Math.round(rsi * 100) / 100,
    rsiCondition,
    sparkline,
  };
}

/**
 * Calculate volatility component (0-100)
 */
function calculateVolatilityScore(candles: Candle[], currentPrice: number): {
  score: number;
  atr: number;
  atrPercent: number;
  sparkline: number[];
} {
  const atrValues = calculateATR(candles, 14);

  if (atrValues.length === 0) {
    return { score: 50, atr: 0, atrPercent: 0 };
  }

  const atr = atrValues[atrValues.length - 1];
  const atrPercent = (atr / currentPrice) * 100;

  // Optimal ATR: 2-4% (good volatility for trading)
  // Too low (<1%): score 40 (consolidation, boring)
  // Optimal (2-4%): score 70-80 (good for breakouts)
  // Too high (>6%): score 50-60 (risky, choppy)

  let score = 50;

  if (atrPercent < 1) {
    score = 40 + atrPercent * 10; // Low vol
  } else if (atrPercent >= 1 && atrPercent <= 4) {
    score = 60 + (atrPercent - 1) * 6.67; // Optimal range
  } else if (atrPercent > 4 && atrPercent <= 8) {
    score = 80 - (atrPercent - 4) * 5; // Elevated but manageable
  } else {
    score = Math.max(30, 60 - atrPercent * 2); // Too volatile
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    atr: Math.round(atr * 100) / 100,
    atrPercent: Math.round(atrPercent * 100) / 100,
    sparkline: normalizeSparkline(atrValues.slice(-20)),
  };
}

/**
 * Calculate structure component (0-100)
 */
function calculateStructureScore(candles: Candle[], currentPrice: number): {
  score: number;
  nearSupport: boolean;
  nearResistance: boolean;
  sparkline: number[];
} {
  const { support, resistance } = findSupportResistance(candles, 100, 0.02);

  let score = 50;
  let nearSupport = false;
  let nearResistance = false;

  // Check proximity to support
  if (support.length > 0) {
    const closestSupport = support[0];
    const distanceToSupport = ((currentPrice - closestSupport) / closestSupport) * 100;

    if (distanceToSupport < 2 && distanceToSupport > -1) {
      nearSupport = true;
      score += 15; // Near support is bullish
    }
  }

  // Check proximity to resistance
  if (resistance.length > 0) {
    const closestResistance = resistance[0];
    const distanceToResistance =
      ((closestResistance - currentPrice) / currentPrice) * 100;

    if (distanceToResistance < 2 && distanceToResistance > -1) {
      nearResistance = true;
      score -= 10; // Near resistance is bearish
    } else if (distanceToResistance > 5) {
      score += 10; // Room to run
    }
  }

  // Price position in recent range
  const recent20 = candles.slice(-20);
  const high20 = Math.max(...recent20.map(c => c.high));
  const low20 = Math.min(...recent20.map(c => c.low));
  const rangePosition = ((currentPrice - low20) / (high20 - low20)) * 100;

  if (rangePosition > 70) {
    score += 10; // Upper range = strength
  } else if (rangePosition < 30) {
    score += 5; // Lower range = potential bounce
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    nearSupport,
    nearResistance,
    sparkline: normalizeSparkline(candles.slice(-20).map(c => c.close)),
  };
}

/**
 * Calculate volume component (0-100)
 */
function calculateVolumeScore(candles: Candle[]): {
  score: number;
  volumeRatio: number;
  sparkline: number[];
} {
  if (candles.length < 20) {
    return { score: 50, volumeRatio: 1 };
  }

  const recent = candles.slice(-5);
  const baseline = candles.slice(-25, -5);

  const avgRecentVolume =
    recent.reduce((sum, c) => sum + c.volume, 0) / recent.length;
  const avgBaselineVolume =
    baseline.reduce((sum, c) => sum + c.volume, 0) / baseline.length;

  const volumeRatio = avgRecentVolume / avgBaselineVolume;

  // Volume ratio interpretation:
  // < 0.5: Very low (score 30-40, weak interest)
  // 0.5-1.0: Below average (score 40-50)
  // 1.0-1.5: Normal (score 50-60)
  // 1.5-3.0: Elevated (score 60-80, good participation)
  // > 3.0: Surge (score 80-100, strong interest)

  let score = 50;

  if (volumeRatio < 0.5) {
    score = 30 + volumeRatio * 20;
  } else if (volumeRatio < 1.0) {
    score = 40 + (volumeRatio - 0.5) * 20;
  } else if (volumeRatio < 1.5) {
    score = 50 + (volumeRatio - 1.0) * 20;
  } else if (volumeRatio < 3.0) {
    score = 60 + ((volumeRatio - 1.5) / 1.5) * 20;
  } else {
    score = Math.min(100, 80 + (volumeRatio - 3.0) * 5);
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    sparkline: normalizeSparkline(candles.slice(-20).map(c => c.volume)),
  };
}

async function calculateDerivativesScore(
  symbol: string,
  candles: Candle[]
): Promise<{
  score: number;
  openInterest: number;
  fundingRate: number;
  longShortRatio: number;
  liquidationImbalance: number;
  sparkline: number[];
}> {
  try {
    const data = await derivativesService.get(symbol);
    let score = 50;

    const fundingAdjustment = Math.max(-10, Math.min(10, data.fundingRate * 1000));
    score -= fundingAdjustment;

    if (data.longShortRatio < 0.95) {
      score += 10;
    } else if (data.longShortRatio > 1.1) {
      score -= 10;
    }

    const normalizedOI = Math.min(15, Math.log10(data.openInterest + 1) * 5);
    score += normalizedOI;
    score -= Math.max(-10, Math.min(10, data.liquidationImbalance * 20));

    const pseudoHistory = candles.slice(-5).map(c => c.volume * data.longShortRatio);
    const sparkline = normalizeSparkline(pseudoHistory);

    return {
      score: Math.min(100, Math.max(0, score)),
      openInterest: data.openInterest,
      fundingRate: data.fundingRate,
      longShortRatio: data.longShortRatio,
      liquidationImbalance: data.liquidationImbalance,
      sparkline,
    };
  } catch (error) {
    return {
      score: 50,
      openInterest: 0,
      fundingRate: 0,
      longShortRatio: 1,
      liquidationImbalance: 0,
      sparkline: normalizeSparkline([0, 0, 0, 0]),
    };
  }
}

function normalizeSparkline(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min === 0) {
    return values.map(() => 50);
  }
  return values.map((value) => ((value - min) / (max - min)) * 100);
}

/**
 * Get human-readable interpretation of GhostScore
 */
export function interpretGhostScore(score: number): {
  label: string;
  description: string;
  emoji: string;
} {
  if (score >= 80) {
    return {
      label: 'Very Strong',
      description: 'Excellent setup with multiple confirming factors. High confidence.',
      emoji: '🔥',
    };
  } else if (score >= 65) {
    return {
      label: 'Strong',
      description: 'Good setup with favorable conditions. Worth watching closely.',
      emoji: '💪',
    };
  } else if (score >= 50) {
    return {
      label: 'Neutral',
      description: 'Mixed signals. Wait for clearer direction or confirmation.',
      emoji: '⚖️',
    };
  } else if (score >= 35) {
    return {
      label: 'Weak',
      description: 'Unfavorable conditions. Proceed with caution or wait.',
      emoji: '⚠️',
    };
  } else {
    return {
      label: 'Very Weak',
      description: 'Poor setup with conflicting signals. Avoid or wait for reversal.',
      emoji: '❌',
    };
  }
}

/**
 * Generate evidence bullets for GhostScore analysis
 */
export function generateEvidence(breakdown: GhostScoreBreakdown): string[] {
  const evidence: string[] = [];

  // Trend evidence
  if (breakdown.trend.direction === 'UPTREND') {
    evidence.push(`Strong uptrend confirmed with price above EMA50 and EMA200`);
  } else if (breakdown.trend.direction === 'DOWNTREND') {
    evidence.push(`Downtrend in place with price below moving averages`);
  } else {
    evidence.push(`Sideways price action - waiting for directional clarity`);
  }

  // Momentum evidence
  if (breakdown.momentum.rsiCondition === 'OVERSOLD') {
    evidence.push(`RSI at ${breakdown.momentum.rsi.toFixed(1)} shows oversold conditions - potential bounce`);
  } else if (breakdown.momentum.rsiCondition === 'OVERBOUGHT') {
    evidence.push(`RSI at ${breakdown.momentum.rsi.toFixed(1)} indicates overbought - watch for cooling`);
  } else if (breakdown.momentum.rsi > 55 && breakdown.trend.direction === 'UPTREND') {
    evidence.push(`Healthy momentum with RSI ${breakdown.momentum.rsi.toFixed(1)} supporting the uptrend`);
  }

  // Volatility evidence
  if (breakdown.volatility.atrPercent > 5) {
    evidence.push(`High volatility (ATR ${breakdown.volatility.atrPercent.toFixed(1)}%) - expect large moves`);
  } else if (breakdown.volatility.atrPercent < 2) {
    evidence.push(`Low volatility environment - breakout potential building`);
  }

  // Structure evidence
  if (breakdown.structure.nearSupport) {
    evidence.push(`Price testing key support level - watch for bounce or breakdown`);
  }
  if (breakdown.structure.nearResistance) {
    evidence.push(`Approaching resistance - breakout or rejection imminent`);
  }

  // Volume evidence
  if (breakdown.volume.volumeRatio > 2) {
    evidence.push(`Exceptional volume surge (${breakdown.volume.volumeRatio.toFixed(1)}x avg) - strong participation`);
  } else if (breakdown.volume.volumeRatio < 0.5) {
    evidence.push(`Weak volume - lack of conviction in current move`);
  }

  // Derivatives evidence
  if (Math.abs(breakdown.derivatives.fundingRate) > 0.01) {
    const direction = breakdown.derivatives.fundingRate > 0 ? 'negative' : 'positive';
    evidence.push(`Funding rate ${direction} (${(breakdown.derivatives.fundingRate * 100).toFixed(3)}%) - potential squeeze setup`);
  }

  if (breakdown.derivatives.longShortRatio > 1.2) {
    evidence.push(`Long/Short ratio heavily skewed to longs (${breakdown.derivatives.longShortRatio.toFixed(2)}) - crowded trade risk`);
  } else if (breakdown.derivatives.longShortRatio < 0.8) {
    evidence.push(`Shorts dominating (L/S ${breakdown.derivatives.longShortRatio.toFixed(2)}) - potential short squeeze`);
  }

  // Divergence detection
  if (breakdown.trend.direction === 'UPTREND' && breakdown.derivatives.fundingRate > 0.015) {
    evidence.push(`⚠️ Bullish price action but extreme positive funding - reversal risk increasing`);
  }
  if (breakdown.trend.direction === 'DOWNTREND' && breakdown.derivatives.fundingRate < -0.01) {
    evidence.push(`📈 Price falling but negative funding - potential capitulation bottom forming`);
  }

  return evidence;
}

