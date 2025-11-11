// OKX WebSocket client for real-time data (v5)
import WebSocket from 'ws';
import type { Ticker } from '../types';

export class OKXWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private subscriptions = new Set<string>();
  private listeners = new Map<string, Set<(ticker: Ticker) => void>>();
  private isConnecting = false;

  constructor() {
    this.connect();
  }

  /**
   * Connect to OKX WebSocket (v5 public)
   */
  private connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    console.log('🔌 Connecting to OKX WebSocket...');

    try {
      this.ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');

      this.ws.on('open', () => {
        console.log('✅ OKX WebSocket connected');
        this.isConnecting = false;
        this.resubscribeAll();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.arg?.channel === 'tickers' && message.data) {
            this.handleTickerUpdate(message.data[0]);
          } else if (message.event === 'error') {
            console.error('OKX WebSocket error:', message.msg);
          }
        } catch (error) {
          console.error('Error parsing OKX message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('❌ OKX WebSocket error:', error.message);
      });

      this.ws.on('close', () => {
        console.log('🔌 OKX WebSocket disconnected. Reconnecting in 5s...');
        this.cleanup();
        this.scheduleReconnect();
      });

    } catch (error) {
      console.error('Failed to create OKX WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Subscribe to ticker updates for a symbol
   */
  subscribe(symbol: string, callback: (ticker: Ticker) => void) {
    const normalized = this.normalizeSymbol(symbol);
    const instId = normalized;

    // Add listener
    if (!this.listeners.has(instId)) {
      this.listeners.set(instId, new Set());
    }
    this.listeners.get(instId)!.add(callback);

    // Subscribe to channel
    if (!this.subscriptions.has(instId)) {
      this.subscriptions.add(instId);
      this.sendSubscribe([instId]);
    }
  }

  /**
   * Unsubscribe from ticker updates
   */
  unsubscribe(symbol: string, callback: (ticker: Ticker) => void) {
    const normalized = this.normalizeSymbol(symbol);
    const instId = normalized;

    const instIdListeners = this.listeners.get(instId);
    if (instIdListeners) {
      instIdListeners.delete(callback);
      
      if (instIdListeners.size === 0) {
        this.listeners.delete(instId);
        this.subscriptions.delete(instId);
        this.sendUnsubscribe([instId]);
      }
    }
  }

  /**
   * Send subscribe message to WebSocket
   */
  private sendSubscribe(instIds: string[]) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        op: 'subscribe',
        args: instIds.map(instId => ({
          channel: 'tickers',
          instId,
        })),
      }));
    }
  }

  /**
   * Send unsubscribe message to WebSocket
   */
  private sendUnsubscribe(instIds: string[]) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        op: 'unsubscribe',
        args: instIds.map(instId => ({
          channel: 'tickers',
          instId,
        })),
      }));
    }
  }

  /**
   * Resubscribe to all channels after reconnection
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
    const instId = data.instId;
    const listeners = this.listeners.get(instId);

    if (listeners && listeners.size > 0) {
      const symbol = instId.replace('-', ''); // Convert BTC-USDT to BTCUSDT

      const ticker: Ticker = {
        symbol,
        price: parseFloat(data.last),
        change24h: parseFloat(data.last) - parseFloat(data.open24h),
        changePercent24h: parseFloat(data.changePercent24h || data.change24h || '0'),
        high24h: parseFloat(data.high24h),
        low24h: parseFloat(data.low24h),
        volume24h: parseFloat(data.vol24h),
        volumeQuote24h: parseFloat(data.volCcy24h),
        timestamp: parseInt(data.ts),
        exchange: 'okx',
      };

      listeners.forEach((callback) => callback(ticker));
    }
  }

  /**
   * Normalize symbol for OKX (e.g., BTC -> BTC-USDT)
   */
  private normalizeSymbol(symbol: string): string {
    const normalized = symbol.toUpperCase().replace(/[^A-Z]/g, '');
    if (normalized.includes('USDT')) {
      // Already has USDT, convert BTCUSDT -> BTC-USDT
      const base = normalized.replace('USDT', '');
      return `${base}-USDT`;
    }
    return `${normalized}-USDT`;
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      console.log('🔄 Reconnecting to OKX WebSocket...');
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
export const okxWS = new OKXWebSocketClient();

