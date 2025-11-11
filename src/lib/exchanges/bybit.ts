// Bybit exchange integration
import { env } from '@/env';
import axios, { type AxiosInstance } from 'axios';
import type { Candle, DerivativesData, Ticker, OrderBook } from './types';

const BYBIT_BASE_URL = 'https://api.bybit.com';
const REQUEST_TIMEOUT = 5000; // 5 seconds timeout

export class BybitClient {
  private baseUrl: string;
  private apiKey?: string;
  private secretKey?: string;
  private axiosInstance: AxiosInstance;

  constructor(apiKey?: string, secretKey?: string) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.baseUrl = BYBIT_BASE_URL;
    
    // Create axios instance with timeout
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: REQUEST_TIMEOUT,
    });
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
   * Get current ticker
   */
  async getTicker(symbol: string): Promise<Ticker> {
    const normalized = this.normalizeSymbol(symbol);
    const response = await this.axiosInstance.get('/v5/market/tickers', {
      params: {
        category: 'spot',
        symbol: normalized,
      },
    });

    const data = response.data.result.list[0];
    if (!data) throw new Error(`Symbol ${symbol} not found on Bybit`);

    return {
      symbol: normalized,
      price: parseFloat(data.lastPrice),
      change24h: parseFloat(data.price24hPcnt) * parseFloat(data.prevPrice24h) / 100,
      changePercent24h: parseFloat(data.price24hPcnt),
      high24h: parseFloat(data.highPrice24h),
      low24h: parseFloat(data.lowPrice24h),
      volume24h: parseFloat(data.volume24h),
      volumeQuote24h: parseFloat(data.turnover24h),
      timestamp: Date.now(),
      exchange: 'bybit',
    };
  }

  /**
   * Get all tickers
   */
  async getAllTickers(): Promise<Ticker[]> {
    const response = await this.axiosInstance.get('/v5/market/tickers', {
      params: {
        category: 'spot',
      },
    });

    return response.data.result.list
      .filter((t: any) => t.symbol.endsWith('USDT'))
      .map((data: any) => ({
        symbol: data.symbol,
        price: parseFloat(data.lastPrice),
        change24h: parseFloat(data.price24hPcnt) * parseFloat(data.prevPrice24h || data.lastPrice) / 100,
        changePercent24h: parseFloat(data.price24hPcnt),
        high24h: parseFloat(data.highPrice24h),
        low24h: parseFloat(data.lowPrice24h),
        volume24h: parseFloat(data.volume24h),
        volumeQuote24h: parseFloat(data.turnover24h),
        timestamp: Date.now(),
        exchange: 'bybit' as const,
      }));
  }

  /**
   * Get order book
   */
  async getOrderBook(symbol: string, limit = 20): Promise<OrderBook> {
    const normalized = this.normalizeSymbol(symbol);
    const response = await this.axiosInstance.get('/v5/market/orderbook', {
      params: {
        category: 'spot',
        symbol: normalized,
        limit,
      },
    });

    const data = response.data.result;

    return {
      symbol: normalized,
      bids: data.b.map(([price, qty]: [string, string]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
      })),
      asks: data.a.map(([price, qty]: [string, string]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
      })),
      timestamp: parseInt(data.ts),
      exchange: 'bybit',
    };
  }

  /**
   * Get historical klines
   */
  async getCandles(
    symbol: string,
    interval: string = '60',
    limit: number = 100
  ): Promise<Candle[]> {
    const normalized = this.normalizeSymbol(symbol);
    
    // Bybit interval mapping: 1,3,5,15,30,60,120,240,360,720,D,M,W
    const intervalMap: Record<string, string> = {
      '1m': '1',
      '5m': '5',
      '15m': '15',
      '30m': '30',
      '1h': '60',
      '4h': '240',
      '1d': 'D',
    };

    const response = await this.axiosInstance.get('/v5/market/kline', {
      params: {
        category: 'spot',
        symbol: normalized,
        interval: intervalMap[interval] || interval,
        limit,
      },
    });

    return response.data.result.list.map((candle: any[]) => ({
      timestamp: parseInt(candle[0]),
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
    })).reverse(); // Bybit returns newest first, reverse to oldest first
  }

  /**
   * Get top gainers and losers
   */
  async getTopMovers(limit = 10): Promise<{ gainers: Ticker[]; losers: Ticker[] }> {
    const tickers = await this.getAllTickers();
    
    // Filter out low volume coins
    const filtered = tickers.filter(t => t.volumeQuote24h > 1000000);
    
    const sorted = [...filtered].sort((a, b) => b.changePercent24h - a.changePercent24h);
    
    return {
      gainers: sorted.slice(0, limit),
      losers: sorted.slice(-limit).reverse(),
    };
  }

  /**
   * Get current price
   */
  async getPrice(symbol: string): Promise<number> {
    const ticker = await this.getTicker(symbol);
    return ticker.price;
  }

  async getDerivativesData(symbol: string): Promise<DerivativesData> {
    const normalized = this.normalizeSymbol(symbol);
    const [oiRes, fundingRes, ratioRes] = await Promise.all([
      this.axiosInstance.get('/v5/market/open-interest', {
        params: { category: 'perpetual', symbol: normalized },
      }),
      this.axiosInstance.get('/v5/market/funding-rate', {
        params: { category: 'perpetual', symbol: normalized, limit: 1 },
      }),
      this.axiosInstance.get('/v5/market/long-short-ratio', {
        params: { category: 'perpetual', symbol: normalized, interval: '4h', limit: 1 },
      }),
    ]);

    const openInterest = parseFloat(oiRes.data.result.openInterest || '0');
    const fundingRate = parseFloat(fundingRes.data.result[0]?.fundingRate || '0');
    const longShortRatio = parseFloat(ratioRes.data.result[0]?.longShortRatio || '1');
    const liquidationImbalance = longShortRatio - 1;

    return {
      symbol: normalized,
      exchange: 'bybit',
      openInterest,
      fundingRate,
      longShortRatio,
      liquidationImbalance,
      cumulativeVolumeDelta: 0,
      timestamp: Date.now(),
    };
  }
}

// Export singleton instance
export const bybitClient = new BybitClient(
  env.BYBIT_API_KEY,
  env.BYBIT_SECRET_KEY
);
