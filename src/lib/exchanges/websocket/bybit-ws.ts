// Bybit WebSocket client for real-time data (v5)
import WebSocket from 'ws';
import type { Ticker } from '../types';

export class BybitWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private subscriptions = new Set<string>();
  private listeners = new Map<string, Set<(ticker: Ticker) => void>>();
  private isConnecting = false;

  constructor() {
    this.connect();
  }

  /**
   * Connect to Bybit WebSocket (v5 public spot)
   */
  private connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    console.log('🔌 Connecting to Bybit WebSocket...');

    try {
      this.ws = new WebSocket('wss://stream.bybit.com/v5/public/spot');

      this.ws.on('open', () => {
        console.log('✅ Bybit WebSocket connected');
        this.isConnecting = false;
        this.resubscribeAll();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.topic?.startsWith('tickers.')) {
            this.handleTickerUpdate(message.data);
          } else if (message.op === 'pong') {
            // Pong received
          }
        } catch (error) {
          console.error('Error parsing Bybit message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('❌ Bybit WebSocket error:', error.message);
      });

      this.ws.on('close', () => {
        console.log('🔌 Bybit WebSocket disconnected. Reconnecting in 5s...');
        this.cleanup();
        this.scheduleReconnect();
      });

    } catch (error) {
      console.error('Failed to create Bybit WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Subscribe to ticker updates for a symbol
   */
  subscribe(symbol: string, callback: (ticker: Ticker) => void) {
    const normalized = this.normalizeSymbol(symbol);
    const topic = `tickers.${normalized}`;

    // Add listener
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, new Set());
    }
    this.listeners.get(topic)!.add(callback);

    // Subscribe to topic
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.add(topic);
      this.sendSubscribe([topic]);
    }
  }

  /**
   * Unsubscribe from ticker updates
   */
  unsubscribe(symbol: string, callback: (ticker: Ticker) => void) {
    const normalized = this.normalizeSymbol(symbol);
    const topic = `tickers.${normalized}`;

    const topicListeners = this.listeners.get(topic);
    if (topicListeners) {
      topicListeners.delete(callback);
      
      if (topicListeners.size === 0) {
        this.listeners.delete(topic);
        this.subscriptions.delete(topic);
        this.sendUnsubscribe([topic]);
      }
    }
  }

  /**
   * Send subscribe message to WebSocket
   */
  private sendSubscribe(topics: string[]) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        op: 'subscribe',
        args: topics,
      }));
    }
  }

  /**
   * Send unsubscribe message to WebSocket
   */
  private sendUnsubscribe(topics: string[]) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        op: 'unsubscribe',
        args: topics,
      }));
    }
  }

  /**
   * Resubscribe to all topics after reconnection
   */
  private resubscribeAll() {
    if (this.subscriptions.size > 0) {
      this.sendSubscribe(Array.from(this.subscriptions));
    }
  }

  /**
   * Handle ticker update from WebSocket
   */
  private handleTickerUpdate(data: any) {
    const topic = `tickers.${data.symbol}`;
    const listeners = this.listeners.get(topic);

    if (listeners && listeners.size > 0) {
      const ticker: Ticker = {
        symbol: data.symbol,
        price: parseFloat(data.lastPrice),
        change24h: parseFloat(data.price24hPcnt) * parseFloat(data.lastPrice) / 100,
        changePercent24h: parseFloat(data.price24hPcnt),
        high24h: parseFloat(data.highPrice24h),
        low24h: parseFloat(data.lowPrice24h),
        volume24h: parseFloat(data.volume24h),
        volumeQuote24h: parseFloat(data.turnover24h),
        timestamp: Date.now(),
        exchange: 'bybit',
      };

      listeners.forEach((callback) => callback(ticker));
    }
  }

  /**
   * Normalize symbol for Bybit (e.g., BTC -> BTCUSDT)
   */
  private normalizeSymbol(symbol: string): string {
    const normalized = symbol.toUpperCase().replace(/[^A-Z]/g, '');
    if (normalized.includes('USDT')) return normalized;
    return `${normalized}USDT`;
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      console.log('🔄 Reconnecting to Bybit WebSocket...');
      this.connect();
    }, 5000); // 5 seconds
  }

  /**
   * Cleanup resources
   */
  private cleanup() {
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }

    this.isConnecting = false;
  }

  /**
   * Close connection and cleanup
   */
  close() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.cleanup();
    this.subscriptions.clear();
    this.listeners.clear();
  }
}

// Singleton instance
export const bybitWS = new BybitWebSocketClient();

