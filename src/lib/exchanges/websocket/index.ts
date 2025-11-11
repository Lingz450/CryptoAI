// WebSocket manager for all exchanges
import { binanceWS } from './binance-ws';
import { bybitWS } from './bybit-ws';
import { okxWS } from './okx-ws';
import type { Ticker } from '../types';

export { binanceWS, bybitWS, okxWS };

/**
 * Unified WebSocket manager for real-time data
 */
export class WebSocketManager {
  private aggregatedListeners = new Map<string, Set<(ticker: Ticker) => void>>();
  private latestTickers = new Map<string, Map<string, Ticker>>(); // symbol -> exchange -> ticker

  /**
   * Subscribe to aggregated ticker updates from all exchanges
   */
  subscribeAggregated(symbol: string, callback: (ticker: Ticker) => void) {
    const normalized = this.normalizeSymbol(symbol);

    // Add listener
    if (!this.aggregatedListeners.has(normalized)) {
      this.aggregatedListeners.set(normalized, new Set());
      this.latestTickers.set(normalized, new Map());
    }
    this.aggregatedListeners.get(normalized)!.add(callback);

    // Subscribe to all exchanges
    const binanceCallback = (ticker: Ticker) => this.handleExchangeTicker(normalized, 'binance', ticker);
    const bybitCallback = (ticker: Ticker) => this.handleExchangeTicker(normalized, 'bybit', ticker);
    const okxCallback = (ticker: Ticker) => this.handleExchangeTicker(normalized, 'okx', ticker);

    binanceWS.subscribe(symbol, binanceCallback);
    bybitWS.subscribe(symbol, bybitCallback);
    okxWS.subscribe(symbol, okxCallback);

    // Store callbacks for cleanup
    (callback as any)._exchangeCallbacks = {
      binance: binanceCallback,
      bybit: bybitCallback,
      okx: okxCallback,
    };
  }

  /**
   * Unsubscribe from aggregated ticker updates
   */
  unsubscribeAggregated(symbol: string, callback: (ticker: Ticker) => void) {
    const normalized = this.normalizeSymbol(symbol);
    const listeners = this.aggregatedListeners.get(normalized);

    if (listeners) {
      listeners.delete(callback);

      // Unsubscribe from exchanges if no more listeners
      if (listeners.size === 0) {
        const exchangeCallbacks = (callback as any)._exchangeCallbacks;
        if (exchangeCallbacks) {
          binanceWS.unsubscribe(symbol, exchangeCallbacks.binance);
          bybitWS.unsubscribe(symbol, exchangeCallbacks.bybit);
          okxWS.unsubscribe(symbol, exchangeCallbacks.okx);
        }

        this.aggregatedListeners.delete(normalized);
        this.latestTickers.delete(normalized);
      }
    }
  }

  /**
   * Handle ticker update from an exchange
   */
  private handleExchangeTicker(symbol: string, exchange: string, ticker: Ticker) {
    const exchangeTickers = this.latestTickers.get(symbol);
    if (!exchangeTickers) return;

    // Store latest ticker from this exchange
    exchangeTickers.set(exchange, ticker);

    // Aggregate tickers from all exchanges
    const tickers = Array.from(exchangeTickers.values());
    if (tickers.length === 0) return;

    // Calculate weighted average based on volume
    const totalVolume = tickers.reduce((sum, t) => sum + t.volumeQuote24h, 0);

    const aggregated: Ticker & { sources: number } = {
      symbol: ticker.symbol,
      price: tickers.reduce((sum, t) => sum + (t.price * t.volumeQuote24h / totalVolume), 0),
      change24h: tickers.reduce((sum, t) => sum + (t.change24h * t.volumeQuote24h / totalVolume), 0),
      changePercent24h: tickers.reduce((sum, t) => sum + (t.changePercent24h * t.volumeQuote24h / totalVolume), 0),
      high24h: Math.max(...tickers.map(t => t.high24h)),
      low24h: Math.min(...tickers.map(t => t.low24h)),
      volume24h: tickers.reduce((sum, t) => sum + t.volume24h, 0),
      volumeQuote24h: totalVolume,
      timestamp: Date.now(),
      exchange: 'binance', // Default for compatibility
      sources: tickers.length,
    };

    // Notify all listeners
    const listeners = this.aggregatedListeners.get(symbol);
    if (listeners) {
      listeners.forEach((callback) => callback(aggregated));
    }
  }

  /**
   * Normalize symbol
   */
  private normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase().replace(/[^A-Z]/g, '');
  }

  /**
   * Close all connections
   */
  closeAll() {
    binanceWS.close();
    bybitWS.close();
    okxWS.close();
    this.aggregatedListeners.clear();
    this.latestTickers.clear();
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();

