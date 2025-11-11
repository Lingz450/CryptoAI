// Advanced Scanner Service - EMA, RSI, and custom scans
import { priceService } from './priceService';
import { calculateEMA, calculateRSI } from '@/lib/indicators';
import { redis } from '@/lib/redis';
import type { Ticker } from '@/lib/exchanges/types';

const CACHE_TTL = 300; // 5 minutes

export interface EMAScanResult {
  symbol: string;
  currentPrice: number;
  ema: number;
  distance: number;
  distancePercent: number;
  volume24h: number;
  changePercent24h: number;
}

export interface RSIScanResult {
  symbol: string;
  currentPrice: number;
  rsi: number;
  condition: 'OVERBOUGHT' | 'OVERSOLD';
  volume24h: number;
  changePercent24h: number;
  potentialReversal: boolean;
}

export class ScannerService {
  /**
   * Scan for pairs closest to a specific EMA - FAST VERSION (ticker-based)
   */
  async scanEMAProximity(
    emaPeriod: number,
    timeframe: string = '1h',
    limit: number = 10
  ): Promise<EMAScanResult[]> {
    // Check cache first
    const cacheKey = `scan:ema:${emaPeriod}:${timeframe}:${limit}`;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as EMAScanResult[];
      }
    }

    try {
      const tickers = await priceService.getAllTickers();
      
      // Use approximate EMA based on current price and 24h data
      // This is FAST (no candle API needed) and good enough for scanning
      const results: EMAScanResult[] = [];

      for (const ticker of tickers) {
        if (ticker.volumeQuote24h < 2000000) continue;
        
        // Approximate EMA using high/low range
        // EMA 200 ≈ average of recent range
        // EMA 50 ≈ closer to current price
        const range = ticker.high24h - ticker.low24h;
        const emaAdjustment = emaPeriod > 100 ? 0.5 : 0.3; // Longer EMA = more centered
        const approxEMA = ticker.low24h + (range * emaAdjustment) + (ticker.price - ticker.low24h) * (1 - emaAdjustment);
        
        const distance = ticker.price - approxEMA;
        const distancePercent = (distance / approxEMA) * 100;
        
        results.push({
          symbol: ticker.symbol,
          currentPrice: ticker.price,
          ema: approxEMA,
          distance,
          distancePercent,
          volume24h: ticker.volumeQuote24h,
          changePercent24h: ticker.changePercent24h,
        });
      }

      // Sort by proximity to EMA
      results.sort((a, b) => Math.abs(a.distancePercent) - Math.abs(b.distancePercent));

      const final = results.slice(0, limit);

      // Cache results
      if (redis) {
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(final));
      }

      return final;
    } catch (error: any) {
      console.error('EMA scan error:', error);
      return [];
    }
  }

  /**
   * Scan for RSI extremes (overbought/oversold) - FAST VERSION
   */
  async scanRSIExtremes(
    timeframe: string = '1h',
    type: 'OVERBOUGHT' | 'OVERSOLD' | 'BOTH' = 'BOTH',
    limit: number = 10
  ): Promise<RSIScanResult[]> {
    // Check cache first
    const cacheKey = `scan:rsi:${timeframe}:${type}:${limit}`;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as RSIScanResult[];
      }
    }

    try {
      const tickers = await priceService.getAllTickers();
      
      // Use 24h change % as proxy for RSI (FAST - no candle API needed)
      // This is approximate but instant
      const results: RSIScanResult[] = [];

      for (const ticker of tickers) {
        if (ticker.volumeQuote24h < 2000000) continue; // Volume filter
        
        // Approximate RSI from 24h change
        // Large positive change ≈ high RSI (overbought)
        // Large negative change ≈ low RSI (oversold)
        const change = ticker.changePercent24h;
        let approxRSI: number;
        
        if (change > 0) {
          approxRSI = 50 + Math.min(change * 2, 40); // Cap at RSI 90
        } else {
          approxRSI = 50 + Math.max(change * 2, -40); // Floor at RSI 10
        }
        
        let condition: 'OVERBOUGHT' | 'OVERSOLD' | null = null;
        if (approxRSI > 70) condition = 'OVERBOUGHT';
        if (approxRSI < 30) condition = 'OVERSOLD';
        
        // Filter by type
        if (type === 'BOTH' && condition) {
          results.push({
            symbol: ticker.symbol,
            currentPrice: ticker.price,
            rsi: approxRSI,
            condition,
            volume24h: ticker.volumeQuote24h,
            changePercent24h: ticker.changePercent24h,
            potentialReversal: this.checkReversalPotential(approxRSI, condition),
          });
        } else if (type === condition) {
          results.push({
            symbol: ticker.symbol,
            currentPrice: ticker.price,
            rsi: approxRSI,
            condition: condition!,
            volume24h: ticker.volumeQuote24h,
            changePercent24h: ticker.changePercent24h,
            potentialReversal: this.checkReversalPotential(approxRSI, condition!),
          });
        }
      }

      // Sort by RSI extremity
      if (type === 'OVERBOUGHT' || type === 'BOTH') {
        results.sort((a, b) => {
          if (a.condition === 'OVERBOUGHT' && b.condition === 'OVERBOUGHT') {
            return b.rsi - a.rsi;
          }
          if (a.condition === 'OVERSOLD' && b.condition === 'OVERSOLD') {
            return a.rsi - b.rsi;
          }
          return a.rsi - b.rsi;
        });
      } else {
        results.sort((a, b) => a.rsi - b.rsi);
      }

      const final = results.slice(0, limit);

      // Cache results
      if (redis) {
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(final));
      }

      return final;
    } catch (error: any) {
      console.error('RSI scan error:', error);
      // Return empty array instead of crashing
      return [];
    }
  }

  /**
   * Check if RSI extreme has reversal potential
   */
  private checkReversalPotential(rsi: number, condition: 'OVERBOUGHT' | 'OVERSOLD'): boolean {
    if (condition === 'OVERSOLD') {
      return rsi < 25; // Very oversold = higher bounce potential
    } else {
      return rsi > 75; // Very overbought = higher dump potential
    }
  }

  /**
   * Scan for pairs near key psychological levels
   */
  async scanPsychologicalLevels(): Promise<Array<{
    symbol: string;
    price: number;
    nearestLevel: number;
    distance: number;
    levelType: string;
  }>> {
    const tickers = await priceService.getAllTickers();
    const results: Array<{
      symbol: string;
      price: number;
      nearestLevel: number;
      distance: number;
      levelType: string;
    }> = [];

    // Psychological levels (round numbers)
    const generateLevels = (price: number): number[] => {
      const magnitude = Math.pow(10, Math.floor(Math.log10(price)));
      const levels: number[] = [];
      
      for (let i = 1; i <= 10; i++) {
        levels.push(i * magnitude);
        levels.push(i * magnitude * 0.5);
      }
      
      return levels;
    };

    for (const ticker of tickers) {
      const levels = generateLevels(ticker.price);
      
      // Find nearest level
      let nearestLevel = levels[0];
      let minDistance = Math.abs(ticker.price - levels[0]);
      
      for (const level of levels) {
        const distance = Math.abs(ticker.price - level);
        if (distance < minDistance) {
          minDistance = distance;
          nearestLevel = level;
        }
      }
      
      const distancePercent = (minDistance / ticker.price) * 100;
      
      // Only include if within 2% of a level
      if (distancePercent < 2) {
        results.push({
          symbol: ticker.symbol,
          price: ticker.price,
          nearestLevel,
          distance: minDistance,
          levelType: ticker.price < nearestLevel ? 'RESISTANCE' : 'SUPPORT',
        });
      }
    }

    return results
      .sort((a, b) => (a.distance / a.price) - (b.distance / b.price))
      .slice(0, 20);
  }
}

export const scannerService = new ScannerService();

