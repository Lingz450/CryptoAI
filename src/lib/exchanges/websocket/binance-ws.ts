// Binance WebSocket client for real-time data
import WebSocket from 'ws';
import type { Ticker } from '../types';

export class BinanceWebSocketClient {
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private subscriptions = new Set<string>();
  private listeners = new Map<string, Set<(ticker: Ticker) => void>>();
  private isConnecting = false;

  constructor() {
    this.connect();
  }

  /**
   * Connect to Binance WebSocket
   */
  private connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    console.log('🔌 Connecting to Binance WebSocket...');

    try {
      this.ws = new WebSocket('wss://stream.binance.com:9443/stream');

      this.ws.on('open', () => {
        console.log('✅ Binance WebSocket connected');
        this.isConnecting = false;
        this.startPingPong();
        this.resubscribeAll();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.stream && message.data) {
            this.handleTickerUpdate(message.data);
          }
        } catch (error) {
          console.error('Error parsing Binance message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('❌ Binance WebSocket error:', error.message);
      });

      this.ws.on('close', () => {
        console.log('🔌 Binance WebSocket disconnected. Reconnecting in 5s...');
        this.cleanup();
        this.scheduleReconnect();
      });

      this.ws.on('ping', () => {
        this.ws?.pong();
      });

    } catch (error) {
      console.error('Failed to create Binance WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Start ping/pong to keep connection alive (Binance disconnects after 24h without activity)
   */
  private startPingPong() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 3 * 60 * 1000); // Every 3 minutes
  }

  /**
   * Subscribe to ticker updates for a symbol
   */
  subscribe(symbol: string, callback: (ticker: Ticker) => void) {
    const normalized = this.normalizeSymbol(symbol);
    const stream = `${normalized.toLowerCase()}@ticker`;

    // Add listener
    if (!this.listeners.has(stream)) {
      this.listeners.set(stream, new Set());
    }
    this.listeners.get(stream)!.add(callback);

    // Subscribe to stream
    if (!this.subscriptions.has(stream)) {
      this.subscriptions.add(stream);
      this.sendSubscribe([stream]);
    }
  }

  /**
   * Unsubscribe from ticker updates
   */
  unsubscribe(symbol: string, callback: (ticker: Ticker) => void) {
    const normalized = this.normalizeSymbol(symbol);
    const stream = `${normalized.toLowerCase()}@ticker`;

    const streamListeners = this.listeners.get(stream);
    if (streamListeners) {
      streamListeners.delete(callback);
      
      if (streamListeners.size === 0) {
        this.listeners.delete(stream);
        this.subscriptions.delete(stream);
        this.sendUnsubscribe([stream]);
      }
    }
  }

  /**
   * Send subscribe message to WebSocket
   */
  private sendSubscribe(streams: string[]) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'SUBSCRIBE',
        params: streams,
        id: Date.now(),
      }));
    }
  }

  /**
   * Send unsubscribe message to WebSocket
   */
  private sendUnsubscribe(streams: string[]) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'UNSUBSCRIBE',
        params: streams,
        id: Date.now(),
      }));
    }
  }

  /**
   * Resubscribe to all streams after reconnection
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
    const stream = `${data.s.toLowerCase()}@ticker`;
    const listeners = this.listeners.get(stream);

    if (listeners && listeners.size > 0) {
      const ticker: Ticker = {
        symbol: data.s,
        price: parseFloat(data.c),
        change24h: parseFloat(data.p),
        changePercent24h: parseFloat(data.P),
        high24h: parseFloat(data.h),
        low24h: parseFloat(data.l),
        volume24h: parseFloat(data.v),
        volumeQuote24h: parseFloat(data.q),
        timestamp: data.E,
        exchange: 'binance',
      };

      listeners.forEach((callback) => callback(ticker));
    }
  }

  /**
   * Normalize symbol for Binance (e.g., BTC -> BTCUSDT)
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
      console.log('🔄 Reconnecting to Binance WebSocket...');
      this.connect();
    }, 5000); // 5 seconds
  }

  /**
   * Cleanup resources
   */
  private cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

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
export const binanceWS = new BinanceWebSocketClient();

