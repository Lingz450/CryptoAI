// Exchange types and interfaces

export type ExchangeName = 'binance' | 'bybit' | 'okx';

export interface Ticker {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  volumeQuote24h: number;
  timestamp: number;
  exchange: ExchangeName;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
  exchange: ExchangeName;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Trade {
  id: string;
  symbol: string;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

export interface ExchangeInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  minPrice: number;
  maxPrice: number;
  tickSize: number;
  minQty: number;
  maxQty: number;
  stepSize: number;
}

export interface TickerStats {
  symbol: string;
  priceChange: number;
  priceChangePercent: number;
  weightedAvgPrice: number;
  lastPrice: number;
  lastQty: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  openTime: number;
  closeTime: number;
  count: number; // Number of trades
}

export interface DerivativesData {
  symbol: string;
  exchange: ExchangeName;
  openInterest: number;
  fundingRate: number;
  longShortRatio: number;
  liquidationImbalance: number;
  cumulativeVolumeDelta: number;
  timestamp: number;
}

