// Technical indicators library
import type { Candle } from '../exchanges/types';

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(data: number[], period: number): number[] {
  if (data.length < period) return [];
  
  const result: number[] = [];
  
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  
  return result;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(data: number[], period: number): number[] {
  if (data.length < period) return [];
  
  const multiplier = 2 / (period + 1);
  const result: number[] = [];
  
  // Start with SMA for first value
  const smaSum = data.slice(0, period).reduce((a, b) => a + b, 0);
  let ema = smaSum / period;
  result.push(ema);
  
  // Calculate EMA for rest
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
    result.push(ema);
  }
  
  return result;
}

/**
 * Calculate Relative Strength Index (RSI)
 */
export function calculateRSI(data: number[], period: number = 14): number[] {
  if (data.length < period + 1) return [];
  
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  // Calculate gains and losses
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }
  
  // Calculate initial average gain/loss
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  // Calculate RSI
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    
    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push(rsi);
    }
  }
  
  return result;
}

/**
 * Calculate Average True Range (ATR)
 */
export function calculateATR(candles: Candle[], period: number = 14): number[] {
  if (candles.length < period + 1) return [];
  
  const trueRanges: number[] = [];
  
  // Calculate True Range for each candle
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push(tr);
  }
  
  // Calculate ATR using EMA of True Range
  return calculateEMA(trueRanges, period);
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(
  data: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const sma = calculateSMA(data, period);
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < sma.length; i++) {
    const slice = data.slice(i, i + period);
    const mean = sma[i];
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const std = Math.sqrt(variance);
    
    upper.push(mean + stdDev * std);
    lower.push(mean - stdDev * std);
  }
  
  return { upper, middle: sma, lower };
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  // Align arrays (fast EMA is longer)
  const offset = fastEMA.length - slowEMA.length;
  const macd = slowEMA.map((slow, i) => fastEMA[i + offset] - slow);
  
  const signal = calculateEMA(macd, signalPeriod);
  
  // Align MACD and signal
  const signalOffset = macd.length - signal.length;
  const histogram = signal.map((sig, i) => macd[i + signalOffset] - sig);
  
  return { macd, signal, histogram };
}

/**
 * Detect Support and Resistance levels
 */
export function findSupportResistance(
  candles: Candle[],
  lookback: number = 50,
  threshold: number = 0.02 // 2% threshold
): { support: number[]; resistance: number[] } {
  if (candles.length < lookback) return { support: [], resistance: [] };
  
  const recentCandles = candles.slice(-lookback);
  const prices = recentCandles.flatMap(c => [c.high, c.low]);
  const currentPrice = candles[candles.length - 1].close;
  
  // Group nearby prices
  const levels: number[] = [];
  const sorted = [...prices].sort((a, b) => a - b);
  
  for (let i = 0; i < sorted.length; i++) {
    const price = sorted[i];
    const nearby = sorted.filter(p => Math.abs(p - price) / price < threshold);
    
    if (nearby.length >= 3 && !levels.some(l => Math.abs(l - price) / price < threshold)) {
      levels.push(price);
    }
  }
  
  // Separate into support and resistance
  const support = levels.filter(l => l < currentPrice).sort((a, b) => b - a);
  const resistance = levels.filter(l => l > currentPrice).sort((a, b) => a - b);
  
  return {
    support: support.slice(0, 3), // Top 3 support levels
    resistance: resistance.slice(0, 3), // Top 3 resistance levels
  };
}

/**
 * Detect trend using EMA crossover
 */
export function detectTrend(
  data: number[],
  fastPeriod: number = 50,
  slowPeriod: number = 200
): 'UPTREND' | 'DOWNTREND' | 'NEUTRAL' {
  if (data.length < slowPeriod) return 'NEUTRAL';
  
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  if (fastEMA.length === 0 || slowEMA.length === 0) return 'NEUTRAL';
  
  const lastFast = fastEMA[fastEMA.length - 1];
  const lastSlow = slowEMA[slowEMA.length - 1];
  
  if (lastFast > lastSlow * 1.02) return 'UPTREND';
  if (lastFast < lastSlow * 0.98) return 'DOWNTREND';
  return 'NEUTRAL';
}

/**
 * Detect EMA crossover
 */
export function detectEMACrossover(
  data: number[],
  fastPeriod: number = 50,
  slowPeriod: number = 200
): 'GOLDEN_CROSS' | 'DEATH_CROSS' | 'NONE' {
  if (data.length < slowPeriod + 1) return 'NONE';
  
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  if (fastEMA.length < 2 || slowEMA.length < 2) return 'NONE';
  
  const currentFast = fastEMA[fastEMA.length - 1];
  const prevFast = fastEMA[fastEMA.length - 2];
  const currentSlow = slowEMA[slowEMA.length - 1];
  const prevSlow = slowEMA[slowEMA.length - 2];
  
  // Golden Cross: fast crosses above slow
  if (prevFast <= prevSlow && currentFast > currentSlow) {
    return 'GOLDEN_CROSS';
  }
  
  // Death Cross: fast crosses below slow
  if (prevFast >= prevSlow && currentFast < currentSlow) {
    return 'DEATH_CROSS';
  }
  
  return 'NONE';
}

/**
 * Calculate volume profile
 */
export function calculateVolumeProfile(
  candles: Candle[],
  bins: number = 20
): { priceLevel: number; volume: number }[] {
  if (candles.length === 0) return [];
  
  const prices = candles.map(c => c.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const binSize = (maxPrice - minPrice) / bins;
  
  const profile: { priceLevel: number; volume: number }[] = [];
  
  for (let i = 0; i < bins; i++) {
    const priceLevel = minPrice + binSize * (i + 0.5);
    const volumeInBin = candles
      .filter(c => c.close >= minPrice + binSize * i && c.close < minPrice + binSize * (i + 1))
      .reduce((sum, c) => sum + c.volume, 0);
    
    profile.push({ priceLevel, volume: volumeInBin });
  }
  
  return profile.sort((a, b) => b.volume - a.volume);
}

export interface IndicatorSnapshot {
  rsi?: number;
  atr?: number;
  atrPercent?: number;
}

/**
 * Convenience helper to grab the latest RSI/ATR readings for a candle set
 */
export function calculateIndicators(candles: Candle[]): IndicatorSnapshot {
  if (candles.length === 0) return {};

  const closes = candles.map(c => c.close);
  const rsiSeries = calculateRSI(closes);
  const atrSeries = calculateATR(candles);

  const rsi = rsiSeries.length > 0 ? rsiSeries[rsiSeries.length - 1] : undefined;
  const atr = atrSeries.length > 0 ? atrSeries[atrSeries.length - 1] : undefined;
  const lastClose = closes[closes.length - 1];

  return {
    rsi,
    atr,
    atrPercent: atr && lastClose ? (atr / lastClose) * 100 : undefined,
  };
}

/**
 * Check if RSI is oversold/overbought
 */
export function checkRSICondition(rsi: number): 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL' {
  if (rsi <= 30) return 'OVERSOLD';
  if (rsi >= 70) return 'OVERBOUGHT';
  return 'NEUTRAL';
}

/**
 * Calculate momentum score (0-100)
 */
export function calculateMomentum(candles: Candle[], period: number = 14): number {
  if (candles.length < period) return 50;
  
  const recent = candles.slice(-period);
  const prices = recent.map(c => c.close);
  const rsi = calculateRSI(prices, Math.floor(period / 2));
  
  if (rsi.length === 0) return 50;
  
  const lastRSI = rsi[rsi.length - 1];
  const trend = detectTrend(prices, Math.floor(period / 3), period);
  
  let score = lastRSI;
  
  // Adjust based on trend
  if (trend === 'UPTREND') score = Math.min(100, score + 10);
  if (trend === 'DOWNTREND') score = Math.max(0, score - 10);
  
  return Math.round(score);
}

/**
 * Calculate Directional Movement Index (DMI) and Average Directional Index (ADX)
 */
export function calculateADX(
  candles: Candle[],
  period: number = 14
): { adx: number[]; plusDI: number[]; minusDI: number[] } {
  if (candles.length < period + 1) {
    return { adx: [], plusDI: [], minusDI: [] };
  }

  const trueRanges: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  // Calculate True Range, +DM, -DM
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevHigh = candles[i - 1].high;
    const prevLow = candles[i - 1].low;
    const prevClose = candles[i - 1].close;

    // True Range
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);

    // Directional Movement
    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    let plusDMVal = 0;
    let minusDMVal = 0;

    if (upMove > downMove && upMove > 0) {
      plusDMVal = upMove;
    }
    if (downMove > upMove && downMove > 0) {
      minusDMVal = downMove;
    }

    plusDM.push(plusDMVal);
    minusDM.push(minusDMVal);
  }

  // Smooth the values using EMA
  const smoothTR = calculateEMA(trueRanges, period);
  const smoothPlusDM = calculateEMA(plusDM, period);
  const smoothMinusDM = calculateEMA(minusDM, period);

  // Calculate Directional Indicators
  const plusDI: number[] = [];
  const minusDI: number[] = [];

  for (let i = 0; i < smoothTR.length; i++) {
    plusDI.push((smoothPlusDM[i] / smoothTR[i]) * 100);
    minusDI.push((smoothMinusDM[i] / smoothTR[i]) * 100);
  }

  // Calculate DX (Directional Index)
  const dx: number[] = [];
  for (let i = 0; i < plusDI.length; i++) {
    const diDiff = Math.abs(plusDI[i] - minusDI[i]);
    const diSum = plusDI[i] + minusDI[i];
    dx.push(diSum === 0 ? 0 : (diDiff / diSum) * 100);
  }

  // Calculate ADX (smoothed DX)
  const adx = calculateEMA(dx, period);

  return { adx, plusDI, minusDI };
}

/**
 * Calculate historical volatility (standard deviation of returns)
 */
export function calculateHistoricalVolatility(
  candles: Candle[],
  period: number = 20
): number[] {
  if (candles.length < period + 1) return [];

  const returns: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const ret = Math.log(candles[i].close / candles[i - 1].close);
    returns.push(ret);
  }

  const volatility: number[] = [];
  for (let i = period - 1; i < returns.length; i++) {
    const slice = returns.slice(i - period + 1, i + 1);
    const mean = slice.reduce((sum, val) => sum + val, 0) / period;
    const variance =
      slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    // Annualize volatility (assuming daily data, multiply by sqrt(365))
    volatility.push(stdDev * Math.sqrt(365) * 100);
  }

  return volatility;
}

