// OKX exchange integration
import { env } from '@/env';
import axios, { type AxiosInstance } from 'axios';
import type { Candle, DerivativesData, Ticker, OrderBook } from './types';

const OKX_BASE_URL = 'https://www.okx.com';
const REQUEST_TIMEOUT = 5000; // 5 seconds timeout

export class OKXClient {
  private baseUrl: string;
  private apiKey?: string;
  private secretKey?: string;
  private passphrase?: string;
  private axiosInstance: AxiosInstance;

  constructor(apiKey?: string, secretKey?: string, passphrase?: string) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.passphrase = passphrase;
    this.baseUrl = OKX_BASE_URL;
    
    // Create axios instance with timeout
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: REQUEST_TIMEOUT,
    });
  }

  /**
   * Normalize symbol for OKX (e.g., BTC -> BTC-USDT)
   */
  private normalizeSymbol(symbol: string): string {
    const normalized = symbol.toUpperCase().replace(/[^A-Z]/g, '');
    if (normalized.includes('-')) return normalized;
    return `${normalized}-USDT`;
  }

  /**
   * Get current ticker
   */
  async getTicker(symbol: string): Promise<Ticker> {
    const normalized = this.normalizeSymbol(symbol);
    const response = await this.axiosInstance.get('/api/v5/market/ticker', {
      params: {
        instId: normalized,
      },
    });

    const data = response.data.data[0];
    if (!data) throw new Error(`Symbol ${symbol} not found on OKX`);

    const price = parseFloat(data.last);
    const openPrice = parseFloat(data.open24h);
    const change24h = price - openPrice;
    const changePercent24h = (change24h / openPrice) * 100;

    return {
      symbol: normalized,
      price,
      change24h,
      changePercent24h,
      high24h: parseFloat(data.high24h),
      low24h: parseFloat(data.low24h),
      volume24h: parseFloat(data.vol24h),
      volumeQuote24h: parseFloat(data.volCcy24h),
      timestamp: parseInt(data.ts),
      exchange: 'okx',
    };
  }

  /**
   * Get all tickers
   */
  async getAllTickers(): Promise<Ticker[]> {
    const response = await this.axiosInstance.get('/api/v5/market/tickers', {
      params: {
        instType: 'SPOT',
      },
    });

    return response.data.data
      .filter((t: any) => t.instId.endsWith('-USDT'))
      .map((data: any) => {
        const price = parseFloat(data.last);
        const openPrice = parseFloat(data.open24h);
        const change24h = price - openPrice;
        const changePercent24h = (change24h / openPrice) * 100;

        return {
          symbol: data.instId,
          price,
          change24h,
          changePercent24h,
          high24h: parseFloat(data.high24h),
          low24h: parseFloat(data.low24h),
          volume24h: parseFloat(data.vol24h),
          volumeQuote24h: parseFloat(data.volCcy24h),
          timestamp: parseInt(data.ts),
          exchange: 'okx' as const,
        };
      });
  }

  /**
   * Get order book
   */
  async getOrderBook(symbol: string, limit = 20): Promise<OrderBook> {
    const normalized = this.normalizeSymbol(symbol);
    const response = await this.axiosInstance.get('/api/v5/market/books', {
      params: {
        instId: normalized,
        sz: limit,
      },
    });

    const data = response.data.data[0];

    return {
      symbol: normalized,
      bids: data.bids.map(([price, qty]: [string, string]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
      })),
      asks: data.asks.map(([price, qty]: [string, string]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
      })),
      timestamp: parseInt(data.ts),
      exchange: 'okx',
    };
  }

  /**
   * Get historical candles
   */
  async getCandles(
    symbol: string,
    interval: string = '1H',
    limit: number = 100
  ): Promise<Candle[]> {
    const normalized = this.normalizeSymbol(symbol);
    
    // OKX bar mapping: 1m, 3m, 5m, 15m, 30m, 1H, 2H, 4H, 6H, 12H, 1D, 1W, 1M
    const intervalMap: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1H',
      '4h': '4H',
      '1d': '1D',
    };

    const response = await this.axiosInstance.get('/api/v5/market/candles', {
      params: {
        instId: normalized,
        bar: intervalMap[interval] || interval,
        limit,
      },
    });

    return response.data.data.map((candle: string[]) => ({
      timestamp: parseInt(candle[0]),
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
    })).reverse(); // OKX returns newest first
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
    const [oiRes, fundingRes] = await Promise.all([
      this.axiosInstance.get('/api/v5/public/open-interest', {
        params: { instId: normalized, instType: 'PERPETUAL' },
      }),
      this.axiosInstance.get('/api/v5/public/funding-rate', {
        params: { instId: normalized, limit: 1 },
      }),
    ]);

    const openInterest = parseFloat(oiRes.data.data[0]?.openInterest || '0');
    const fundingRate = parseFloat(fundingRes.data.data[0]?.fundingRate || '0');
    const longShortRatio = 1;
    const liquidationImbalance = 0;

    return {
      symbol: normalized,
      exchange: 'okx',
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
export const okxClient = new OKXClient(
  env.OKX_API_KEY,
  env.OKX_SECRET_KEY,
  env.OKX_PASSPHRASE
);
