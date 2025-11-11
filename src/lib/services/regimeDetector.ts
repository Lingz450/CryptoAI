// Market Regime Detector
// Detects whether the market is in Trend, Mean-Revert, or Chop mode
import type { Candle } from '@/lib/exchanges/types';
import {
  calculateADX,
  calculateHistoricalVolatility,
  calculateATR,
  detectTrend,
} from '@/lib/indicators';
import { redis } from '@/lib/redis';

export type MarketRegime = 'TREND' | 'MEAN_REVERT' | 'CHOP';

export interface RegimeAnalysis {
  regime: MarketRegime;
  confidence: number; // 0-100
  adx: number;
  volatility: number;
  trendStrength: number;
  description: string;
  timestamp: number;
}

export interface RegimeContext {
  btcRegime: MarketRegime;
  usdtDominance: number;
  correlationToBtc: number;
}

const CACHE_TTL = 300; // 5 minutes

export class RegimeDetectorService {
  private cachePrefix = 'regime';

  private getCacheKey(symbol: string): string {
    return `${this.cachePrefix}:${symbol}`;
  }

  /**
   * Detect market regime based on ADX and volatility
   * 
   * Regimes:
   * - TREND: ADX > 25, strong directional movement
   * - MEAN_REVERT: ADX < 20, low volatility, oscillating
   * - CHOP: ADX 20-25, high volatility, no clear direction
   */
  detectRegime(candles: Candle[]): RegimeAnalysis {
    if (candles.length < 50) {
      throw new Error('Need at least 50 candles for regime detection');
    }

    // Calculate ADX (trend strength indicator)
    const adxData = calculateADX(candles, 14);
    const adx = adxData.adx.length > 0 ? adxData.adx[adxData.adx.length - 1] : 0;
    const plusDI = adxData.plusDI.length > 0 ? adxData.plusDI[adxData.plusDI.length - 1] : 0;
    const minusDI = adxData.minusDI.length > 0 ? adxData.minusDI[adxData.minusDI.length - 1] : 0;

    // Calculate volatility
    const volatilityData = calculateHistoricalVolatility(candles, 20);
    const volatility =
      volatilityData.length > 0 ? volatilityData[volatilityData.length - 1] : 0;

    // Calculate ATR percentage
    const atrData = calculateATR(candles, 14);
    const atr = atrData.length > 0 ? atrData[atrData.length - 1] : 0;
    const currentPrice = candles[candles.length - 1].close;
    const atrPercent = (atr / currentPrice) * 100;

    // Detect trend direction
    const prices = candles.map(c => c.close);
    const trendDirection = detectTrend(prices, 20, 50);

    // Calculate trend strength (based on DI difference)
    const diDiff = Math.abs(plusDI - minusDI);
    const trendStrength = Math.min(100, diDiff * 2);

    // Regime detection logic
    let regime: MarketRegime;
    let confidence: number;
    let description: string;

    if (adx > 25 && trendStrength > 40) {
      // Strong trend
      regime = 'TREND';
      confidence = Math.min(100, adx + trendStrength / 2);
      description = `Strong ${trendDirection.toLowerCase()} with ADX ${adx.toFixed(1)}. Best for breakout/momentum strategies.`;
    } else if (adx < 20 && atrPercent < 3) {
      // Mean reversion conditions
      regime = 'MEAN_REVERT';
      confidence = Math.min(100, (25 - adx) * 4);
      description = `Low volatility consolidation. Best for range-bound, mean-reversion strategies.`;
    } else {
      // Choppy/uncertain
      regime = 'CHOP';
      confidence = Math.min(100, volatility);
      description = `Choppy market with ADX ${adx.toFixed(1)}. Exercise caution, tighten stops.`;
    }

    return {
      regime,
      confidence: Math.round(confidence),
      adx: Math.round(adx * 10) / 10,
      volatility: Math.round(volatility * 10) / 10,
      trendStrength: Math.round(trendStrength),
      description,
      timestamp: Date.now(),
    };
  }

  /**
   * Get regime with caching
   */
  async getRegime(symbol: string, candles: Candle[]): Promise<RegimeAnalysis> {
    const cacheKey = this.getCacheKey(symbol);

    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as RegimeAnalysis;
      }
    }

    const regime = this.detectRegime(candles);

    if (redis) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(regime));
    }

    return regime;
  }

  /**
   * Get regime context (BTC regime + correlation matrix)
   * Used to gate alerts and inform portfolio risk
   */
  async getRegimeContext(
    btcCandles: Candle[],
    symbolCandles: Candle[]
  ): Promise<RegimeContext> {
    const btcRegimeAnalysis = this.detectRegime(btcCandles);
    
    // Calculate correlation to BTC
    const correlation = this.calculateCorrelation(
      btcCandles.slice(-30).map(c => c.close),
      symbolCandles.slice(-30).map(c => c.close)
    );

    // Mock USDT dominance (in real impl, fetch from data source)
    const usdtDominance = 0.065; // 6.5%

    return {
      btcRegime: btcRegimeAnalysis.regime,
      usdtDominance,
      correlationToBtc: correlation,
    };
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;

    return numerator / denominator;
  }

  /**
   * Check if an alert should fire based on regime
   * Only trigger breakouts in TREND regime, etc.
   */
  shouldTriggerAlert(alertType: string, regime: MarketRegime): boolean {
    const rules: Record<string, MarketRegime[]> = {
      BREAKOUT: ['TREND'],
      MOMENTUM: ['TREND'],
      MEAN_REVERSION: ['MEAN_REVERT'],
      SUPPORT_BOUNCE: ['MEAN_REVERT', 'CHOP'],
      RESISTANCE_BREAK: ['TREND'],
    };

    const allowedRegimes = rules[alertType] || ['TREND', 'MEAN_REVERT', 'CHOP'];
    return allowedRegimes.includes(regime);
  }

  /**
   * Get regime-adjusted position size multiplier
   */
  getPositionSizeMultiplier(regime: MarketRegime, confidence: number): number {
    const baseMultipliers = {
      TREND: 1.0,
      MEAN_REVERT: 0.8,
      CHOP: 0.5,
    };

    const base = baseMultipliers[regime];
    const confidenceAdjustment = confidence / 100;

    return base * confidenceAdjustment;
  }
}

export const regimeDetector = new RegimeDetectorService();

