// Unified exchange interface
import { env } from '@/env';
import { binanceClient } from './binance';
import { bybitClient } from './bybit';
import { okxClient } from './okx';
import type { ExchangeName, Ticker, OrderBook, Candle } from './types';

export * from './types';
export { binanceClient, bybitClient, okxClient };

/**
 * Unified exchange client that routes to the appropriate exchange
 */
export class ExchangeAggregator {
  private defaultExchange: ExchangeName;

  constructor(defaultExchange: ExchangeName = 'binance') {
    this.defaultExchange = defaultExchange;
  }

  /**
   * Get the appropriate client for an exchange
   */
  private getClient(exchange: ExchangeName) {
    switch (exchange) {
      case 'binance':
        return binanceClient;
      case 'bybit':
        return bybitClient;
      case 'okx':
        return okxClient;
      default:
        return binanceClient;
    }
  }

  /**
   * Get ticker from specified exchange
   */
  async getTicker(symbol: string, exchange?: ExchangeName): Promise<Ticker> {
    const client = this.getClient(exchange || this.defaultExchange);
    return client.getTicker(symbol);
  }

  /**
   * Get tickers from all exchanges and average them
   */
  async getAggregatedTicker(symbol: string): Promise<Ticker & { sources: number }> {
    const results = await Promise.allSettled([
      binanceClient.getTicker(symbol),
      bybitClient.getTicker(symbol),
      okxClient.getTicker(symbol),
    ]);

    const tickers = results
      .filter((r): r is PromiseFulfilledResult<Ticker> => r.status === 'fulfilled')
      .map(r => r.value);

    if (tickers.length === 0) {
      throw new Error(`No data available for ${symbol}`);
    }

    // Calculate weighted average based on volume
    const totalVolume = tickers.reduce((sum, t) => sum + t.volumeQuote24h, 0);
    
    const aggregated: Ticker & { sources: number } = {
      symbol: symbol.toUpperCase(),
      price: tickers.reduce((sum, t) => sum + (t.price * t.volumeQuote24h / totalVolume), 0),
      change24h: tickers.reduce((sum, t) => sum + (t.change24h * t.volumeQuote24h / totalVolume), 0),
      changePercent24h: tickers.reduce((sum, t) => sum + (t.changePercent24h * t.volumeQuote24h / totalVolume), 0),
      high24h: Math.max(...tickers.map(t => t.high24h)),
      low24h: Math.min(...tickers.map(t => t.low24h)),
      volume24h: tickers.reduce((sum, t) => sum + t.volume24h, 0),
      volumeQuote24h: totalVolume,
      timestamp: Date.now(),
      exchange: 'binance', // Default
      sources: tickers.length,
    };

    return aggregated;
  }

  /**
   * Get all tickers from an exchange
   */
  async getAllTickers(exchange?: ExchangeName): Promise<Ticker[]> {
    const client = this.getClient(exchange || this.defaultExchange);
    return client.getAllTickers();
  }

  /**
   * Get order book
   */
  async getOrderBook(symbol: string, exchange?: ExchangeName, limit = 20): Promise<OrderBook> {
    const client = this.getClient(exchange || this.defaultExchange);
    return client.getOrderBook(symbol, limit);
  }

  /**
   * Get candles
   */
  async getCandles(
    symbol: string,
    interval: string = '1h',
    limit: number = 100,
    exchange?: ExchangeName
  ): Promise<Candle[]> {
    const client = this.getClient(exchange || this.defaultExchange);
    return client.getCandles(symbol, interval, limit);
  }

  /**
   * Get top movers across all exchanges (deduplicated)
   */
  async getTopMoversAggregated(limit = 10): Promise<{ gainers: Ticker[]; losers: Ticker[] }> {
    const results = await Promise.allSettled([
      binanceClient.getTopMovers(limit * 2),
      bybitClient.getTopMovers(limit * 2),
      okxClient.getTopMovers(limit * 2),
    ]);

    const allMovers = results
      .filter((r): r is PromiseFulfilledResult<{ gainers: Ticker[]; losers: Ticker[] }> => 
        r.status === 'fulfilled'
      )
      .map(r => r.value);

    // Combine and deduplicate by symbol
    const allGainers = allMovers.flatMap(m => m.gainers);
    const allLosers = allMovers.flatMap(m => m.losers);

    const uniqueGainers = this.deduplicateBySymbol(allGainers);
    const uniqueLosers = this.deduplicateBySymbol(allLosers);

    return {
      gainers: uniqueGainers
        .sort((a, b) => b.changePercent24h - a.changePercent24h)
        .slice(0, limit),
      losers: uniqueLosers
        .sort((a, b) => a.changePercent24h - b.changePercent24h)
        .slice(0, limit),
    };
  }

  /**
   * Deduplicate tickers by symbol (keep highest volume)
   */
  private deduplicateBySymbol(tickers: Ticker[]): Ticker[] {
    const map = new Map<string, Ticker>();
    
    for (const ticker of tickers) {
      const baseSymbol = this.normalizeSymbol(ticker.symbol);
      const existing = map.get(baseSymbol);
      
      if (!existing || ticker.volumeQuote24h > existing.volumeQuote24h) {
        map.set(baseSymbol, ticker);
      }
    }
    
    return Array.from(map.values());
  }

  /**
   * Normalize symbols from different exchanges to a common format
   */
  private normalizeSymbol(symbol: string): string {
    return symbol
      .replace('USDT', '')
      .replace('-USDT', '')
      .replace('PERP', '')
      .toUpperCase();
  }

  /**
   * Get price from any exchange
   */
  async getPrice(symbol: string, exchange?: ExchangeName): Promise<number> {
    const client = this.getClient(exchange || this.defaultExchange);
    return client.getPrice(symbol);
  }

  /**
   * Get top movers, optionally scoped to a single exchange
   */
  async getTopMovers(limit = 10, exchange?: ExchangeName): Promise<{ gainers: Ticker[]; losers: Ticker[] }> {
    if (exchange) {
      const client = this.getClient(exchange);
      return client.getTopMovers(limit);
    }
    return this.getTopMoversAggregated(limit);
  }

  async getDerivativesData(symbol: string, exchange?: ExchangeName) {
    const client = this.getClient(exchange || this.defaultExchange);
    if (typeof client.getDerivativesData !== 'function') {
      throw new Error('Derivatives data not supported for this exchange');
    }
    return client.getDerivativesData(symbol);
  }

  /**
   * Get multiple tickers at once
   */
  async getMultipleTickers(symbols: string[], exchange?: ExchangeName): Promise<Map<string, Ticker>> {
    const client = this.getClient(exchange || this.defaultExchange);
    const results = await Promise.allSettled(
      symbols.map(symbol => client.getTicker(symbol))
    );

    const tickerMap = new Map<string, Ticker>();
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        tickerMap.set(symbols[index], result.value);
      }
    });

    return tickerMap;
  }
}

// Export singleton instance
export const exchangeAggregator = new ExchangeAggregator(env.DEFAULT_EXCHANGE);

