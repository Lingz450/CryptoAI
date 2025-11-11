// Screener service for finding opportunities
import { priceService } from './priceService';
import { calculateGhostScore } from './ghostScore';
import {
  calculateEMA,
  calculateRSI,
  calculateATR,
  detectEMACrossover,
  checkRSICondition,
} from '../indicators';
import type { Ticker } from '../exchanges/types';

export interface ScreenerResult {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  score?: number;
  reason: string;
  timestamp: number;
}

export class ScreenerService {
  /**
   * ATR Breakout Scanner
   * Finds coins with ATR spikes (unusual volatility)
   */
  async scanATRBreakouts(
    limit = 100,
    multiplier = 1.5,
    exchange?: any
  ): Promise<ScreenerResult[]> {
    const tickers = await priceService.getAllTickers(exchange);
    const results: ScreenerResult[] = [];

    // Filter high volume coins
    const candidates = tickers
      .filter(t => t.volumeQuote24h > 1000000)
      .sort((a, b) => b.volumeQuote24h - a.volumeQuote24h)
      .slice(0, limit);

    await Promise.allSettled(
      candidates.map(async ticker => {
        try {
          const candles = await priceService.getCandles(ticker.symbol, '1h', 50, exchange);
          if (candles.length < 20) return;

          const atrValues = calculateATR(candles, 14);
          if (atrValues.length < 2) return;

          const currentATR = atrValues[atrValues.length - 1];
          const avgATR = atrValues.slice(-14).reduce((a, b) => a + b, 0) / 14;
          const atrRatio = currentATR / avgATR;

          if (atrRatio >= multiplier) {
            const atrPercent = (currentATR / ticker.price) * 100;
            results.push({
              symbol: ticker.symbol,
              price: ticker.price,
              change24h: ticker.changePercent24h,
              volume24h: ticker.volumeQuote24h,
              score: Math.round(atrRatio * 100),
              reason: `ATR spike: ${atrRatio.toFixed(2)}x avg (${atrPercent.toFixed(2)}% volatility)`,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          // Skip errors
        }
      })
    );

    return results.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * EMA Crossover Scanner
   * Finds Golden Cross and Death Cross setups
   */
  async scanEMACrossover(
    limit = 100,
    fastPeriod = 50,
    slowPeriod = 200,
    exchange?: any
  ): Promise<ScreenerResult[]> {
    const tickers = await priceService.getAllTickers(exchange);
    const results: ScreenerResult[] = [];

    const candidates = tickers
      .filter(t => t.volumeQuote24h > 1000000)
      .sort((a, b) => b.volumeQuote24h - a.volumeQuote24h)
      .slice(0, limit);

    await Promise.allSettled(
      candidates.map(async ticker => {
        try {
          const candles = await priceService.getCandles(ticker.symbol, '1h', 250, exchange);
          if (candles.length < slowPeriod + 5) return;

          const prices = candles.map(c => c.close);
          const crossover = detectEMACrossover(prices, fastPeriod, slowPeriod);

          if (crossover !== 'NONE') {
            const emaFast = calculateEMA(prices, fastPeriod);
            const emaSlow = calculateEMA(prices, slowPeriod);
            const lastFast = emaFast[emaFast.length - 1];
            const lastSlow = emaSlow[emaSlow.length - 1];
            const gap = Math.abs(((lastFast - lastSlow) / lastSlow) * 100);

            results.push({
              symbol: ticker.symbol,
              price: ticker.price,
              change24h: ticker.changePercent24h,
              volume24h: ticker.volumeQuote24h,
              score: crossover === 'GOLDEN_CROSS' ? 80 : 20,
              reason: `${crossover === 'GOLDEN_CROSS' ? '🟢 Golden Cross' : '🔴 Death Cross'}: EMA${fastPeriod} ${gap.toFixed(2)}% ${crossover === 'GOLDEN_CROSS' ? 'above' : 'below'} EMA${slowPeriod}`,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          // Skip errors
        }
      })
    );

    return results.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * RSI Extremes Scanner
   * Finds oversold/overbought coins
   */
  async scanRSIExtremes(
    limit = 100,
    oversoldThreshold = 30,
    overboughtThreshold = 70,
    exchange?: any
  ): Promise<{ oversold: ScreenerResult[]; overbought: ScreenerResult[] }> {
    const tickers = await priceService.getAllTickers(exchange);
    const oversold: ScreenerResult[] = [];
    const overbought: ScreenerResult[] = [];

    const candidates = tickers
      .filter(t => t.volumeQuote24h > 1000000)
      .sort((a, b) => b.volumeQuote24h - a.volumeQuote24h)
      .slice(0, limit);

    await Promise.allSettled(
      candidates.map(async ticker => {
        try {
          const candles = await priceService.getCandles(ticker.symbol, '1h', 50, exchange);
          if (candles.length < 20) return;

          const prices = candles.map(c => c.close);
          const rsiValues = calculateRSI(prices, 14);
          if (rsiValues.length === 0) return;

          const rsi = rsiValues[rsiValues.length - 1];

          if (rsi <= oversoldThreshold) {
            oversold.push({
              symbol: ticker.symbol,
              price: ticker.price,
              change24h: ticker.changePercent24h,
              volume24h: ticker.volumeQuote24h,
              score: Math.round((oversoldThreshold - rsi) * 3),
              reason: `RSI ${rsi.toFixed(1)} — Oversold, potential bounce`,
              timestamp: Date.now(),
            });
          } else if (rsi >= overboughtThreshold) {
            overbought.push({
              symbol: ticker.symbol,
              price: ticker.price,
              change24h: ticker.changePercent24h,
              volume24h: ticker.volumeQuote24h,
              score: Math.round((rsi - overboughtThreshold) * 3),
              reason: `RSI ${rsi.toFixed(1)} — Overbought, momentum strong`,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          // Skip errors
        }
      })
    );

    return {
      oversold: oversold.sort((a, b) => (b.score || 0) - (a.score || 0)),
      overbought: overbought.sort((a, b) => (b.score || 0) - (a.score || 0)),
    };
  }

  /**
   * Volume Surge Scanner
   * Finds coins with unusual volume spikes
   */
  async scanVolumeSurge(
    limit = 100,
    multiplier = 2.0,
    exchange?: any
  ): Promise<ScreenerResult[]> {
    const tickers = await priceService.getAllTickers(exchange);
    const results: ScreenerResult[] = [];

    const candidates = tickers
      .filter(t => t.volumeQuote24h > 500000)
      .sort((a, b) => b.volumeQuote24h - a.volumeQuote24h)
      .slice(0, limit);

    await Promise.allSettled(
      candidates.map(async ticker => {
        try {
          const candles = await priceService.getCandles(ticker.symbol, '1h', 30, exchange);
          if (candles.length < 25) return;

          const recentVolume = candles.slice(-5).reduce((sum, c) => sum + c.volume, 0) / 5;
          const baselineVolume = candles.slice(-25, -5).reduce((sum, c) => sum + c.volume, 0) / 20;
          const volumeRatio = recentVolume / baselineVolume;

          if (volumeRatio >= multiplier) {
            results.push({
              symbol: ticker.symbol,
              price: ticker.price,
              change24h: ticker.changePercent24h,
              volume24h: ticker.volumeQuote24h,
              score: Math.round(volumeRatio * 100),
              reason: `Volume surge: ${volumeRatio.toFixed(2)}x average`,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          // Skip errors
        }
      })
    );

    return results.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * High GhostScore Scanner
   * Finds coins with best overall strength
   */
  async scanHighGhostScore(
    limit = 50,
    minScore = 65,
    exchange?: any
  ): Promise<ScreenerResult[]> {
    const tickers = await priceService.getAllTickers(exchange);
    const results: ScreenerResult[] = [];

    const candidates = tickers
      .filter(t => t.volumeQuote24h > 2000000)
      .sort((a, b) => b.volumeQuote24h - a.volumeQuote24h)
      .slice(0, limit);

    await Promise.allSettled(
      candidates.map(async ticker => {
        try {
          const candles = await priceService.getCandles(ticker.symbol, '1h', 250, exchange);
          if (candles.length < 200) return;

          const ghostScore = await calculateGhostScore(ticker.symbol, candles);

          if (ghostScore.totalScore >= minScore) {
            results.push({
              symbol: ticker.symbol,
              price: ticker.price,
              change24h: ticker.changePercent24h,
              volume24h: ticker.volumeQuote24h,
              score: ghostScore.totalScore,
              reason: `GhostScore ${ghostScore.totalScore}/100 — ${ghostScore.trend.direction}, RSI ${ghostScore.momentum.rsi.toFixed(1)}`,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          // Skip errors
        }
      })
    );

    return results.sort((a, b) => (b.score || 0) - (a.score || 0));
  }
}

// Export singleton
export const screenerService = new ScreenerService();

