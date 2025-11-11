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

/**
 * Calculate Stochastic Oscillator
 * %K = (Current Close - Lowest Low) / (Highest High - Lowest Low) * 100
 * %D = 3-period SMA of %K
 */
export function calculateStochastic(
  candles: Candle[],
  kPeriod: number = 14,
  dPeriod: number = 3
): { k: number[]; d: number[] } {
  if (candles.length < kPeriod) return { k: [], d: [] };

  const k: number[] = [];

  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const highestHigh = Math.max(...slice.map(c => c.high));
    const lowestLow = Math.min(...slice.map(c => c.low));
    const currentClose = candles[i].close;

    const kValue =
      highestHigh - lowestLow === 0
        ? 50
        : ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

    k.push(kValue);
  }

  const d = calculateSMA(k, dPeriod);

  return { k, d };
}

/**
 * Calculate Commodity Channel Index (CCI)
 */
export function calculateCCI(
  candles: Candle[],
  period: number = 20
): number[] {
  if (candles.length < period) return [];

  const cci: number[] = [];
  const constant = 0.015; // Standard CCI constant

  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    
    // Calculate Typical Price
    const typicalPrices = slice.map(c => (c.high + c.low + c.close) / 3);
    const currentTP = typicalPrices[typicalPrices.length - 1];
    
    // Calculate SMA of Typical Price
    const smaTP = typicalPrices.reduce((sum, tp) => sum + tp, 0) / period;
    
    // Calculate Mean Deviation
    const meanDeviation =
      typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period;
    
    // Calculate CCI
    const cciValue =
      meanDeviation === 0 ? 0 : (currentTP - smaTP) / (constant * meanDeviation);
    
    cci.push(cciValue);
  }

  return cci;
}

/**
 * Calculate Williams %R
 * Similar to Stochastic but inverted and on a scale of -100 to 0
 */
export function calculateWilliamsR(
  candles: Candle[],
  period: number = 14
): number[] {
  if (candles.length < period) return [];

  const williamsR: number[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const highestHigh = Math.max(...slice.map(c => c.high));
    const lowestLow = Math.min(...slice.map(c => c.low));
    const currentClose = candles[i].close;

    const wr =
      highestHigh - lowestLow === 0
        ? -50
        : ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;

    williamsR.push(wr);
  }

  return williamsR;
}

/**
 * Calculate Parabolic SAR (Stop and Reverse)
 */
export function calculateParabolicSAR(
  candles: Candle[],
  acceleration: number = 0.02,
  maxAcceleration: number = 0.2
): number[] {
  if (candles.length < 2) return [];

  const sar: number[] = [];
  let isUptrend = candles[1].close > candles[0].close;
  let af = acceleration;
  let ep = isUptrend ? candles[0].high : candles[0].low;
  let currentSAR = candles[0].low;

  sar.push(currentSAR);

  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];

    // Calculate new SAR
    currentSAR = currentSAR + af * (ep - currentSAR);

    // Check for trend reversal
    if (isUptrend) {
      if (candle.low < currentSAR) {
        // Reverse to downtrend
        isUptrend = false;
        currentSAR = ep;
        ep = candle.low;
        af = acceleration;
      } else {
        // Update EP and AF
        if (candle.high > ep) {
          ep = candle.high;
          af = Math.min(af + acceleration, maxAcceleration);
        }
      }
    } else {
      if (candle.high > currentSAR) {
        // Reverse to uptrend
        isUptrend = true;
        currentSAR = ep;
        ep = candle.high;
        af = acceleration;
      } else {
        // Update EP and AF
        if (candle.low < ep) {
          ep = candle.low;
          af = Math.min(af + acceleration, maxAcceleration);
        }
      }
    }

    sar.push(currentSAR);
  }

  return sar;
}

/**
 * Calculate On-Balance Volume (OBV)
 */
export function calculateOBV(candles: Candle[]): number[] {
  if (candles.length < 2) return [];

  const obv: number[] = [];
  let currentOBV = 0;

  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) {
      currentOBV += candles[i].volume;
    } else if (candles[i].close < candles[i - 1].close) {
      currentOBV -= candles[i].volume;
    }
    // If close is unchanged, OBV stays the same

    obv.push(currentOBV);
  }

  return obv;
}

/**
 * Calculate Money Flow Index (MFI)
 * Similar to RSI but volume-weighted
 */
export function calculateMFI(
  candles: Candle[],
  period: number = 14
): number[] {
  if (candles.length < period + 1) return [];

  const mfi: number[] = [];

  for (let i = period; i < candles.length; i++) {
    const slice = candles.slice(i - period, i + 1);
    
    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let j = 1; j < slice.length; j++) {
      const typicalPrice = (slice[j].high + slice[j].low + slice[j].close) / 3;
      const prevTypicalPrice = (slice[j - 1].high + slice[j - 1].low + slice[j - 1].close) / 3;
      const rawMoneyFlow = typicalPrice * slice[j].volume;

      if (typicalPrice > prevTypicalPrice) {
        positiveFlow += rawMoneyFlow;
      } else if (typicalPrice < prevTypicalPrice) {
        negativeFlow += rawMoneyFlow;
      }
    }

    if (negativeFlow === 0) {
      mfi.push(100);
    } else {
      const moneyRatio = positiveFlow / negativeFlow;
      const mfiValue = 100 - 100 / (1 + moneyRatio);
      mfi.push(mfiValue);
    }
  }

  return mfi;
}

/**
 * Calculate Ichimoku Cloud
 */
export function calculateIchimoku(
  candles: Candle[],
  tenkanPeriod: number = 9,
  kijunPeriod: number = 26,
  senkouBPeriod: number = 52
): {
  tenkanSen: number[];
  kijunSen: number[];
  senkouSpanA: number[];
  senkouSpanB: number[];
  chikouSpan: number[];
} {
  if (candles.length < senkouBPeriod) {
    return {
      tenkanSen: [],
      kijunSen: [],
      senkouSpanA: [],
      senkouSpanB: [],
      chikouSpan: [],
    };
  }

  const calculateMidpoint = (slice: Candle[]): number => {
    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    return (high + low) / 2;
  };

  const tenkanSen: number[] = [];
  const kijunSen: number[] = [];
  const senkouSpanA: number[] = [];
  const senkouSpanB: number[] = [];
  const chikouSpan: number[] = [];

  for (let i = senkouBPeriod - 1; i < candles.length; i++) {
    // Tenkan-sen (Conversion Line)
    const tenkanSlice = candles.slice(Math.max(0, i - tenkanPeriod + 1), i + 1);
    tenkanSen.push(calculateMidpoint(tenkanSlice));

    // Kijun-sen (Base Line)
    const kijunSlice = candles.slice(Math.max(0, i - kijunPeriod + 1), i + 1);
    kijunSen.push(calculateMidpoint(kijunSlice));

    // Senkou Span A (Leading Span A)
    const spanA = (tenkanSen[tenkanSen.length - 1] + kijunSen[kijunSen.length - 1]) / 2;
    senkouSpanA.push(spanA);

    // Senkou Span B (Leading Span B)
    const senkouSlice = candles.slice(Math.max(0, i - senkouBPeriod + 1), i + 1);
    senkouSpanB.push(calculateMidpoint(senkouSlice));

    // Chikou Span (Lagging Span) - current close shifted back
    chikouSpan.push(candles[i].close);
  }

  return { tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan };
}

/**
 * Calculate Awesome Oscillator (AO)
 */
export function calculateAwesomeOscillator(
  candles: Candle[],
  shortPeriod: number = 5,
  longPeriod: number = 34
): number[] {
  if (candles.length < longPeriod) return [];

  const midpoints = candles.map(c => (c.high + c.low) / 2);
  const shortSMA = calculateSMA(midpoints, shortPeriod);
  const longSMA = calculateSMA(midpoints, longPeriod);

  const offset = shortSMA.length - longSMA.length;
  const ao = longSMA.map((long, i) => shortSMA[i + offset] - long);

  return ao;
}

/**
 * Calculate Rate of Change (ROC)
 */
export function calculateROC(
  data: number[],
  period: number = 12
): number[] {
  if (data.length < period + 1) return [];

  const roc: number[] = [];

  for (let i = period; i < data.length; i++) {
    const current = data[i];
    const past = data[i - period];
    const rocValue = past === 0 ? 0 : ((current - past) / past) * 100;
    roc.push(rocValue);
  }

  return roc;
}

/**
 * Calculate Fibonacci Retracement Levels
 */
export function calculateFibonacciLevels(
  candles: Candle[],
  lookback: number = 100
): {
  high: number;
  low: number;
  levels: { level: number; price: number; label: string }[];
} {
  if (candles.length < lookback) {
    lookback = candles.length;
  }

  const recent = candles.slice(-lookback);
  const high = Math.max(...recent.map(c => c.high));
  const low = Math.min(...recent.map(c => c.low));
  const diff = high - low;

  const fibLevels = [
    { ratio: 0, label: '0.0 (Low)' },
    { ratio: 0.236, label: '23.6%' },
    { ratio: 0.382, label: '38.2%' },
    { ratio: 0.5, label: '50.0%' },
    { ratio: 0.618, label: '61.8%' },
    { ratio: 0.786, label: '78.6%' },
    { ratio: 1, label: '100.0 (High)' },
  ];

  const levels = fibLevels.map(fib => ({
    level: fib.ratio,
    price: low + diff * fib.ratio,
    label: fib.label,
  }));

  return { high, low, levels };
}

/**
 * Calculate Pivot Points (Standard)
 */
export function calculatePivotPoints(candles: Candle[]): {
  pivot: number;
  resistance1: number;
  resistance2: number;
  resistance3: number;
  support1: number;
  support2: number;
  support3: number;
} {
  if (candles.length === 0) {
    return {
      pivot: 0,
      resistance1: 0,
      resistance2: 0,
      resistance3: 0,
      support1: 0,
      support2: 0,
      support3: 0,
    };
  }

  const lastCandle = candles[candles.length - 1];
  const high = lastCandle.high;
  const low = lastCandle.low;
  const close = lastCandle.close;

  const pivot = (high + low + close) / 3;
  const resistance1 = 2 * pivot - low;
  const support1 = 2 * pivot - high;
  const resistance2 = pivot + (high - low);
  const support2 = pivot - (high - low);
  const resistance3 = high + 2 * (pivot - low);
  const support3 = low - 2 * (high - pivot);

  return {
    pivot,
    resistance1,
    resistance2,
    resistance3,
    support1,
    support2,
    support3,
  };
}

/**
 * Calculate Donchian Channels
 */
export function calculateDonchianChannels(
  candles: Candle[],
  period: number = 20
): { upper: number[]; middle: number[]; lower: number[] } {
  if (candles.length < period) return { upper: [], middle: [], lower: [] };

  const upper: number[] = [];
  const lower: number[] = [];
  const middle: number[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    const mid = (high + low) / 2;

    upper.push(high);
    lower.push(low);
    middle.push(mid);
  }

  return { upper, middle, lower };
}

/**
 * Calculate Keltner Channels
 */
export function calculateKeltnerChannels(
  candles: Candle[],
  emaPeriod: number = 20,
  atrPeriod: number = 10,
  atrMultiplier: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  if (candles.length < Math.max(emaPeriod, atrPeriod)) {
    return { upper: [], middle: [], lower: [] };
  }

  const closes = candles.map(c => c.close);
  const middle = calculateEMA(closes, emaPeriod);
  const atr = calculateATR(candles, atrPeriod);

  const upper: number[] = [];
  const lower: number[] = [];

  const offset = middle.length - atr.length;

  for (let i = 0; i < atr.length; i++) {
    const emaValue = middle[i + offset];
    const atrValue = atr[i];
    upper.push(emaValue + atrMultiplier * atrValue);
    lower.push(emaValue - atrMultiplier * atrValue);
  }

  return { upper, middle, lower };
}

/**
 * Calculate Average Directional Movement Index Rating (ADXR)
 */
export function calculateADXR(
  candles: Candle[],
  period: number = 14
): number[] {
  const { adx } = calculateADX(candles, period);

  if (adx.length < period) return [];

  const adxr: number[] = [];

  for (let i = period - 1; i < adx.length; i++) {
    const current = adx[i];
    const past = adx[i - period + 1];
    adxr.push((current + past) / 2);
  }

  return adxr;
}

/**
 * Calculate True Strength Index (TSI)
 */
export function calculateTSI(
  data: number[],
  longPeriod: number = 25,
  shortPeriod: number = 13
): number[] {
  if (data.length < longPeriod + shortPeriod) return [];

  // Calculate price changes
  const priceChanges: number[] = [];
  for (let i = 1; i < data.length; i++) {
    priceChanges.push(data[i] - data[i - 1]);
  }

  // Double smoothed price changes
  const firstSmooth = calculateEMA(priceChanges, longPeriod);
  const doubleSmooth = calculateEMA(firstSmooth, shortPeriod);

  // Double smoothed absolute price changes
  const absPriceChanges = priceChanges.map(v => Math.abs(v));
  const firstSmoothAbs = calculateEMA(absPriceChanges, longPeriod);
  const doubleSmoothAbs = calculateEMA(firstSmoothAbs, shortPeriod);

  // Calculate TSI
  const tsi: number[] = [];
  for (let i = 0; i < doubleSmooth.length; i++) {
    if (doubleSmoothAbs[i] === 0) {
      tsi.push(0);
    } else {
      tsi.push((doubleSmooth[i] / doubleSmoothAbs[i]) * 100);
    }
  }

  return tsi;
}

/**
 * Calculate Chaikin Money Flow (CMF)
 */
export function calculateCMF(
  candles: Candle[],
  period: number = 20
): number[] {
  if (candles.length < period) return [];

  const cmf: number[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    
    let mfvSum = 0;
    let volumeSum = 0;

    for (const candle of slice) {
      const mfm =
        candle.high - candle.low === 0
          ? 0
          : ((candle.close - candle.low - (candle.high - candle.close)) /
              (candle.high - candle.low));
      const mfv = mfm * candle.volume;
      mfvSum += mfv;
      volumeSum += candle.volume;
    }

    cmf.push(volumeSum === 0 ? 0 : mfvSum / volumeSum);
  }

  return cmf;
}

/**
 * Calculate Vortex Indicator (VI)
 */
export function calculateVortex(
  candles: Candle[],
  period: number = 14
): { viPlus: number[]; viMinus: number[] } {
  if (candles.length < period + 1) return { viPlus: [], viMinus: [] };

  const viPlus: number[] = [];
  const viMinus: number[] = [];

  for (let i = period; i < candles.length; i++) {
    let vmPlus = 0;
    let vmMinus = 0;
    let trSum = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const current = candles[j];
      const prev = candles[j - 1];

      // Vortex Movement
      vmPlus += Math.abs(current.high - prev.low);
      vmMinus += Math.abs(current.low - prev.high);

      // True Range
      const tr = Math.max(
        current.high - current.low,
        Math.abs(current.high - prev.close),
        Math.abs(current.low - prev.close)
      );
      trSum += tr;
    }

    viPlus.push(trSum === 0 ? 0 : vmPlus / trSum);
    viMinus.push(trSum === 0 ? 0 : vmMinus / trSum);
  }

  return { viPlus, viMinus };
}

/**
 * Calculate Elder Ray Index
 */
export function calculateElderRay(
  candles: Candle[],
  emaPeriod: number = 13
): { bullPower: number[]; bearPower: number[] } {
  if (candles.length < emaPeriod) return { bullPower: [], bearPower: [] };

  const closes = candles.map(c => c.close);
  const ema = calculateEMA(closes, emaPeriod);

  const bullPower: number[] = [];
  const bearPower: number[] = [];

  const offset = candles.length - ema.length;

  for (let i = 0; i < ema.length; i++) {
    const candle = candles[i + offset];
    bullPower.push(candle.high - ema[i]);
    bearPower.push(candle.low - ema[i]);
  }

  return { bullPower, bearPower };
}

/**
 * Calculate Aroon Indicator
 */
export function calculateAroon(
  candles: Candle[],
  period: number = 25
): { aroonUp: number[]; aroonDown: number[]; aroonOscillator: number[] } {
  if (candles.length < period) {
    return { aroonUp: [], aroonDown: [], aroonOscillator: [] };
  }

  const aroonUp: number[] = [];
  const aroonDown: number[] = [];
  const aroonOscillator: number[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);

    // Find periods since highest high and lowest low
    let highestIdx = 0;
    let lowestIdx = 0;
    let highest = slice[0].high;
    let lowest = slice[0].low;

    for (let j = 1; j < slice.length; j++) {
      if (slice[j].high >= highest) {
        highest = slice[j].high;
        highestIdx = j;
      }
      if (slice[j].low <= lowest) {
        lowest = slice[j].low;
        lowestIdx = j;
      }
    }

    const periodsSinceHigh = period - 1 - highestIdx;
    const periodsSinceLow = period - 1 - lowestIdx;

    const up = ((period - periodsSinceHigh) / period) * 100;
    const down = ((period - periodsSinceLow) / period) * 100;

    aroonUp.push(up);
    aroonDown.push(down);
    aroonOscillator.push(up - down);
  }

  return { aroonUp, aroonDown, aroonOscillator };
}

/**
 * Calculate Know Sure Thing (KST)
 */
export function calculateKST(
  data: number[]
): { kst: number[]; signal: number[] } {
  if (data.length < 200) return { kst: [], signal: [] };

  // Calculate ROC for different periods
  const roc1 = calculateROC(data, 10);
  const roc2 = calculateROC(data, 15);
  const roc3 = calculateROC(data, 20);
  const roc4 = calculateROC(data, 30);

  // Smooth each ROC
  const sma1 = calculateSMA(roc1, 10);
  const sma2 = calculateSMA(roc2, 10);
  const sma3 = calculateSMA(roc3, 10);
  const sma4 = calculateSMA(roc4, 15);

  // Find minimum length
  const minLength = Math.min(sma1.length, sma2.length, sma3.length, sma4.length);

  // Calculate KST
  const kst: number[] = [];
  for (let i = 0; i < minLength; i++) {
    const idx1 = sma1.length - minLength + i;
    const idx2 = sma2.length - minLength + i;
    const idx3 = sma3.length - minLength + i;
    const idx4 = sma4.length - minLength + i;

    const kstValue =
      sma1[idx1] * 1 + sma2[idx2] * 2 + sma3[idx3] * 3 + sma4[idx4] * 4;
    kst.push(kstValue);
  }

  // Signal line (9-period SMA of KST)
  const signal = calculateSMA(kst, 9);

  return { kst, signal };
}

/**
 * Calculate Ultimate Oscillator
 */
export function calculateUltimateOscillator(
  candles: Candle[],
  period1: number = 7,
  period2: number = 14,
  period3: number = 28
): number[] {
  if (candles.length < period3 + 1) return [];

  const uo: number[] = [];

  for (let i = period3; i < candles.length; i++) {
    const calcBP = (idx: number): number => {
      const close = candles[idx].close;
      const prevClose = candles[idx - 1].close;
      const low = candles[idx].low;
      return close - Math.min(low, prevClose);
    };

    const calcTR = (idx: number): number => {
      const high = candles[idx].high;
      const low = candles[idx].low;
      const prevClose = candles[idx - 1].close;
      return Math.max(high, prevClose) - Math.min(low, prevClose);
    };

    // Calculate buying pressure and true range sums for each period
    let bp1 = 0, tr1 = 0;
    let bp2 = 0, tr2 = 0;
    let bp3 = 0, tr3 = 0;

    for (let j = 0; j < period3; j++) {
      const idx = i - j;
      const bp = calcBP(idx);
      const tr = calcTR(idx);

      if (j < period1) {
        bp1 += bp;
        tr1 += tr;
      }
      if (j < period2) {
        bp2 += bp;
        tr2 += tr;
      }
      bp3 += bp;
      tr3 += tr;
    }

    const avg1 = tr1 === 0 ? 0 : bp1 / tr1;
    const avg2 = tr2 === 0 ? 0 : bp2 / tr2;
    const avg3 = tr3 === 0 ? 0 : bp3 / tr3;

    const uoValue = ((4 * avg1 + 2 * avg2 + avg3) / 7) * 100;
    uo.push(uoValue);
  }

  return uo;
}

/**
 * Calculate Supertrend Indicator
 */
export function calculateSupertrend(
  candles: Candle[],
  period: number = 10,
  multiplier: number = 3
): { supertrend: number[]; direction: ('UP' | 'DOWN')[] } {
  if (candles.length < period) return { supertrend: [], direction: [] };

  const atr = calculateATR(candles, period);
  const supertrend: number[] = [];
  const direction: ('UP' | 'DOWN')[] = [];

  let currentTrend: 'UP' | 'DOWN' = 'UP';

  const offset = candles.length - atr.length;

  for (let i = 0; i < atr.length; i++) {
    const candle = candles[i + offset];
    const hl2 = (candle.high + candle.low) / 2;
    const atrValue = atr[i];

    const upperBand = hl2 + multiplier * atrValue;
    const lowerBand = hl2 - multiplier * atrValue;

    if (i === 0) {
      supertrend.push(lowerBand);
      direction.push('UP');
      continue;
    }

    const prevSupertrend = supertrend[i - 1];
    const prevDirection = direction[i - 1];

    let newSupertrend: number;
    let newDirection: 'UP' | 'DOWN';

    if (prevDirection === 'UP') {
      if (candle.close <= prevSupertrend) {
        newSupertrend = upperBand;
        newDirection = 'DOWN';
      } else {
        newSupertrend = Math.max(lowerBand, prevSupertrend);
        newDirection = 'UP';
      }
    } else {
      if (candle.close >= prevSupertrend) {
        newSupertrend = lowerBand;
        newDirection = 'UP';
      } else {
        newSupertrend = Math.min(upperBand, prevSupertrend);
        newDirection = 'DOWN';
      }
    }

    supertrend.push(newSupertrend);
    direction.push(newDirection);
  }

  return { supertrend, direction };
}

