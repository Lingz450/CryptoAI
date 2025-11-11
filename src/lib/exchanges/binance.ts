// Binance exchange integration
import { env } from '@/env';
import axios, { type AxiosInstance } from 'axios';
import type {
  Ticker,
  OrderBook,
  Candle,
  ExchangeInfo,
  TickerStats,
  DerivativesData,
} from './types';

const BINANCE_BASE_URL = 'https://api.binance.com/api/v3';
const BINANCE_FUTURES_URL = 'https://fapi.binance.com/fapi/v1';
const REQUEST_TIMEOUT = 5000; // 5 seconds timeout

export class BinanceClient {
  private baseUrl: string;
  private apiKey?: string;
  private secretKey?: string;
  private useFutures: boolean;
  private axiosInstance: AxiosInstance;

  constructor(apiKey?: string, secretKey?: string, useFutures = false) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.useFutures = useFutures;
    this.baseUrl = useFutures ? BINANCE_FUTURES_URL : BINANCE_BASE_URL;
    
    // Create axios instance with timeout
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: REQUEST_TIMEOUT,
    });
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
   * Get current price for a symbol
   */
  async getPrice(symbol: string): Promise<number> {
    const normalized = this.normalizeSymbol(symbol);
    const response = await this.axiosInstance.get('/ticker/price', {
      params: { symbol: normalized },
    });
    return parseFloat(response.data.price);
  }

  /**
   * Get 24hr ticker statistics
   */
  async getTicker(symbol: string): Promise<Ticker> {
    const normalized = this.normalizeSymbol(symbol);
    const response = await this.axiosInstance.get('/ticker/24hr', {
      params: { symbol: normalized },
    });
    
    const data = response.data;
    return {
      symbol: normalized,
      price: parseFloat(data.lastPrice),
      change24h: parseFloat(data.priceChange),
      changePercent24h: parseFloat(data.priceChangePercent),
      high24h: parseFloat(data.highPrice),
      low24h: parseFloat(data.lowPrice),
      volume24h: parseFloat(data.volume),
      volumeQuote24h: parseFloat(data.quoteVolume),
      timestamp: data.closeTime,
      exchange: 'binance',
    };
  }

  /**
   * Get all tickers (for top movers, screeners)
   */
  async getAllTickers(): Promise<Ticker[]> {
    const response = await this.axiosInstance.get('/ticker/24hr');
    
    return response.data
      .filter((t: any) => t.symbol.endsWith('USDT'))
      .map((data: any) => ({
        symbol: data.symbol,
        price: parseFloat(data.lastPrice),
        change24h: parseFloat(data.priceChange),
        changePercent24h: parseFloat(data.priceChangePercent),
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        volume24h: parseFloat(data.volume),
        volumeQuote24h: parseFloat(data.quoteVolume),
        timestamp: data.closeTime,
        exchange: 'binance' as const,
      }));
  }

  /**
   * Get order book depth
   */
  async getOrderBook(symbol: string, limit = 20): Promise<OrderBook> {
    const normalized = this.normalizeSymbol(symbol);
    const response = await this.axiosInstance.get('/depth', {
      params: { symbol: normalized, limit },
    });

    return {
      symbol: normalized,
      bids: response.data.bids.map(([price, qty]: [string, string]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
      })),
      asks: response.data.asks.map(([price, qty]: [string, string]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
      })),
      timestamp: Date.now(),
      exchange: 'binance',
    };
  }

  /**
   * Get historical klines/candlestick data
   */
  async getCandles(
    symbol: string,
    interval: string = '1h',
    limit: number = 100
  ): Promise<Candle[]> {
    const normalized = this.normalizeSymbol(symbol);
    const response = await this.axiosInstance.get('/klines', {
      params: {
        symbol: normalized,
        interval, // 1m, 5m, 15m, 1h, 4h, 1d, etc.
        limit,
      },
    });

    return response.data.map((candle: any[]) => ({
      timestamp: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
    }));
  }

  /**
   * Get exchange info (trading rules, precision, etc.)
   */
  async getExchangeInfo(symbol?: string): Promise<ExchangeInfo | ExchangeInfo[]> {
    const response = await this.axiosInstance.get('/exchangeInfo');
    
    const symbols = response.data.symbols
      .filter((s: any) => s.symbol.endsWith('USDT'))
      .map((s: any) => {
        const priceFilter = s.filters.find((f: any) => f.filterType === 'PRICE_FILTER');
        const lotSizeFilter = s.filters.find((f: any) => f.filterType === 'LOT_SIZE');
        
        return {
          symbol: s.symbol,
          baseAsset: s.baseAsset,
          quoteAsset: s.quoteAsset,
          status: s.status,
          minPrice: parseFloat(priceFilter?.minPrice || '0'),
          maxPrice: parseFloat(priceFilter?.maxPrice || '0'),
          tickSize: parseFloat(priceFilter?.tickSize || '0'),
          minQty: parseFloat(lotSizeFilter?.minQty || '0'),
          maxQty: parseFloat(lotSizeFilter?.maxQty || '0'),
          stepSize: parseFloat(lotSizeFilter?.stepSize || '0'),
        };
      });

    if (symbol) {
      const normalized = this.normalizeSymbol(symbol);
      return symbols.find((s: ExchangeInfo) => s.symbol === normalized);
    }

    return symbols;
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
   * Search for a symbol by price
   */
  async findPairByPrice(targetPrice: number, tolerance = 0.1): Promise<Ticker[]> {
    const tickers = await this.getAllTickers();
    const range = targetPrice * tolerance;
    
    return tickers
      .filter(t => Math.abs(t.price - targetPrice) <= range)
      .sort((a, b) => Math.abs(a.price - targetPrice) - Math.abs(b.price - targetPrice))
      .slice(0, 10);
  }

  async getDerivativesData(symbol: string): Promise<DerivativesData> {
    const normalized = this.normalizeSymbol(symbol);
    const futuresClient = axios.create({
      baseURL: BINANCE_FUTURES_URL,
      timeout: REQUEST_TIMEOUT,
    });
    const [oiRes, fundingRes, ratioRes] = await Promise.all([
      futuresClient.get('/openInterest', { params: { symbol: normalized } }),
      futuresClient.get('/fundingRate', { params: { symbol: normalized, limit: 1 } }),
      futuresClient.get('/longShortRatio', {
        params: { symbol: normalized, period: '4h', limit: 1 },
      }),
    ]);

    const openInterest = parseFloat(oiRes.data.openInterest || '0');
    const fundingRate = parseFloat(fundingRes.data[0]?.fundingRate || '0');
    const longShortRatio = parseFloat(ratioRes.data[0]?.longShortRatio || '1');
    const liquidationImbalance = longShortRatio - 1;

    return {
      symbol: normalized,
      exchange: 'binance',
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
export const binanceClient = new BinanceClient(
  env.BINANCE_API_KEY,
  env.BINANCE_SECRET_KEY
);
