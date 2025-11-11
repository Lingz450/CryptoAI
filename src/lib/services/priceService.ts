// Price data service with caching
import {
  exchangeAggregator,
  type Ticker,
  type ExchangeName,
  type Candle,
} from '../exchanges';
import { redis } from '../redis';

const CACHE_TTL = 30; // 30 seconds for price data
const TICKER_CACHE_PREFIX = 'ticker:';
const ALL_TICKERS_CACHE_KEY = 'tickers:all';

export class PriceService {
  /**
   * Get ticker with caching
   */
  async getTicker(symbol: string, exchange?: ExchangeName, useCache = true): Promise<Ticker> {
    const cacheKey = `${TICKER_CACHE_PREFIX}${exchange || 'aggregated'}:${symbol}`;

    if (useCache && redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const ticker = exchange
      ? await exchangeAggregator.getTicker(symbol, exchange)
      : await exchangeAggregator.getAggregatedTicker(symbol);

    if (redis) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(ticker));
    }

    return ticker;
  }

  /**
   * Get multiple tickers at once
   */
  async getMultipleTickers(
    symbols: string[],
    exchange?: ExchangeName
  ): Promise<Map<string, Ticker>> {
    const tickers = new Map<string, Ticker>();

    // Try to get from cache first
    if (redis) {
      const client = redis;
      const cacheKeys = symbols.map(
        s => `${TICKER_CACHE_PREFIX}${exchange || 'aggregated'}:${s}`
      );
      const cached = await Promise.all(cacheKeys.map(key => client.get(key)));

      cached.forEach((data, index) => {
        if (data) {
          tickers.set(symbols[index], JSON.parse(data));
        }
      });
    }

    // Fetch missing symbols
    const missing = symbols.filter(s => !tickers.has(s));

    if (missing.length > 0) {
      const freshTickers = await exchangeAggregator.getMultipleTickers(missing, exchange);

      for (const [symbol, ticker] of freshTickers.entries()) {
        tickers.set(symbol, ticker);

        // Cache it
        if (redis) {
          const client = redis;
          const cacheKey = `${TICKER_CACHE_PREFIX}${exchange || 'aggregated'}:${symbol}`;
          await client.setex(cacheKey, CACHE_TTL, JSON.stringify(ticker));
        }
      }
    }

    return tickers;
  }

  /**
   * Get all tickers with caching
   */
  async getAllTickers(exchange?: ExchangeName, useCache = true): Promise<Ticker[]> {
    const cacheKey = `${ALL_TICKERS_CACHE_KEY}:${exchange || 'default'}`;

    if (useCache && redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const tickers = await exchangeAggregator.getAllTickers(exchange);

    if (redis) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(tickers));
    }

    return tickers;
  }

  /**
   * Get top movers (gainers and losers)
   */
  async getTopMovers(
    limit = 10,
    exchange?: ExchangeName
  ): Promise<{ gainers: Ticker[]; losers: Ticker[] }> {
    const cacheKey = `topmovers:${exchange || 'aggregated'}:${limit}`;

    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const movers = await exchangeAggregator.getTopMovers(limit, exchange);

    if (redis) {
      await redis.setex(cacheKey, 60, JSON.stringify(movers)); // Cache for 1 min
    }

    return movers;
  }

  /**
   * Get candle data with caching
   */
  async getCandles(
    symbol: string,
    interval: string = '1h',
    limit: number = 100,
    exchange?: ExchangeName
  ): Promise<Candle[]> {
    const cacheKey = `candles:${exchange || 'default'}:${symbol}:${interval}:${limit}`;

    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as Candle[];
      }
    }

    const candles = await exchangeAggregator.getCandles(symbol, interval, limit, exchange);

    if (redis) {
      await redis.setex(cacheKey, 300, JSON.stringify(candles)); // Cache for 5 min
    }

    return candles;
  }

  /**
   * Get order book
   */
  async getOrderBook(symbol: string, limit = 20, exchange?: ExchangeName) {
    return exchangeAggregator.getOrderBook(symbol, exchange, limit);
  }

  /**
   * Clear cache for a symbol
   */
  async clearCache(symbol?: string) {
    if (!redis) return;

    if (symbol) {
      const pattern = `${TICKER_CACHE_PREFIX}*:${symbol}`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      // Clear all price caches
      const keys = await redis.keys(`${TICKER_CACHE_PREFIX}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  }

  /**
   * Subscribe to price updates (for WebSocket streaming)
   */
  async subscribeToPriceUpdates(symbols: string[], callback: (ticker: Ticker) => void) {
    // This would integrate with exchange WebSocket APIs
    // For now, polling implementation
    const intervalId = setInterval(async () => {
      for (const symbol of symbols) {
        try {
          const ticker = await this.getTicker(symbol, undefined, false);
          callback(ticker);
        } catch (error) {
          console.error(`Failed to fetch ${symbol}:`, error);
        }
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);
  }
}

// Export singleton
export const priceService = new PriceService();

