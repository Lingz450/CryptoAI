import { exchangeAggregator } from '@/lib/exchanges';
import { redis } from '@/lib/redis';
import type { DerivativesData } from '@/lib/exchanges/types';

const CACHE_TTL = 300; // 5 minutes
const STALE_MARKER = ':stale';

export interface DerivativesSparklines {
  oi: number[];
  funding: number[];
  cvd: number[];
  lsr: number[];
}

export class DerivativesService {
  private cachePrefix = 'derivatives';

  private getCacheKey(symbol: string, exchange?: string) {
    return `${this.cachePrefix}:${exchange || 'binance'}:${symbol}`;
  }

  private getHistoryKey(symbol: string) {
    return `derivatives:history:${symbol}`;
  }

  async get(symbol: string, exchange?: string): Promise<DerivativesData> {
    const cacheKey = this.getCacheKey(symbol, exchange);
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as DerivativesData;
      }
    }

    const data = await exchangeAggregator.getDerivativesData(symbol, exchange as any);
    if (redis) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
    }
    return data;
  }

  /**
   * Get sparkline data for derivatives metrics
   */
  async getSparklines(symbol: string): Promise<DerivativesSparklines | null> {
    if (!redis) return null;

    const historyKey = this.getHistoryKey(symbol);
    const history = await redis.lrange(historyKey, 0, 19); // Last 20 points

    if (history.length === 0) {
      return null;
    }

    const points = history.map(h => JSON.parse(h));
    
    return {
      oi: points.map(p => p.oi).reverse(),
      funding: points.map(p => p.funding).reverse(),
      cvd: points.map(p => p.cvd).reverse(),
      lsr: points.map(p => p.lsr).reverse(),
    };
  }

  /**
   * Mark derivatives data as stale for a symbol
   * This will force a refresh on next request
   */
  async markStale(symbol: string, exchange?: string): Promise<void> {
    if (!redis) return;

    const cacheKey = this.getCacheKey(symbol, exchange);
    await redis.del(cacheKey);
    
    // Set a stale marker with short TTL
    await redis.setex(`${cacheKey}${STALE_MARKER}`, 60, '1');
  }

  /**
   * Check if data is marked as stale
   */
  async isStale(symbol: string, exchange?: string): Promise<boolean> {
    if (!redis) return false;

    const cacheKey = this.getCacheKey(symbol, exchange);
    const staleMarker = await redis.get(`${cacheKey}${STALE_MARKER}`);
    return staleMarker === '1';
  }

  /**
   * Force refresh derivatives data for a symbol
   */
  async refresh(symbol: string, exchange?: string): Promise<DerivativesData> {
    await this.markStale(symbol, exchange);
    return this.get(symbol, exchange);
  }

  /**
   * Get data with sparklines in one call
   */
  async getWithSparklines(symbol: string, exchange?: string): Promise<{
    data: DerivativesData;
    sparklines: DerivativesSparklines | null;
  }> {
    const [data, sparklines] = await Promise.all([
      this.get(symbol, exchange),
      this.getSparklines(symbol),
    ]);

    return { data, sparklines };
  }
}

export const derivativesService = new DerivativesService();
