// Advanced Scanner Service - EMA, RSI, and custom scans
import { priceService } from './priceService';
import { calculateEMA, calculateRSI } from '@/lib/indicators';
import type { Ticker } from '@/lib/exchanges/types';

export interface EMAScanResult {
  symbol: string;
  currentPrice: number;
  ema: number;
  distance: number;
  distancePercent: number;
  volume24h: number;
  changePercent24h: number;
}

export interface RSIScanResult {
  symbol: string;
  currentPrice: number;
  rsi: number;
  condition: 'OVERBOUGHT' | 'OVERSOLD';
  volume24h: number;
  changePercent24h: number;
  potentialReversal: boolean;
}

export class ScannerService {
  /**
   * Scan for pairs closest to a specific EMA
   */
  async scanEMAProximity(
    emaPeriod: number,
    timeframe: string = '1h',
    limit: number = 10
  ): Promise<EMAScanResult[]> {
    const tickers = await priceService.getAllTickers();
    
    // Filter high volume pairs
    const filtered = tickers.filter(t => t.volumeQuote24h > 1000000);
    
    const results: EMAScanResult[] = [];

    // Calculate EMA for each pair
    for (const ticker of filtered.slice(0, 100)) { // Limit to top 100 by volume
      try {
        const candles = await priceService.getCandles(ticker.symbol, timeframe, emaPeriod + 50);
        const prices = candles.map(c => c.close);
        const emaValues = calculateEMA(prices, emaPeriod);
        
        if (emaValues.length > 0) {
          const ema = emaValues[emaValues.length - 1];
          const distance = ticker.price - ema;
          const distancePercent = (distance / ema) * 100;
          
          results.push({
            symbol: ticker.symbol,
            currentPrice: ticker.price,
            ema,
            distance,
            distancePercent,
            volume24h: ticker.volumeQuote24h,
            changePercent24h: ticker.changePercent24h,
          });
        }
      } catch (error) {
        // Skip pairs with errors
        continue;
      }
    }

    // Sort by proximity to EMA (smallest distance first)
    results.sort((a, b) => Math.abs(a.distancePercent) - Math.abs(b.distancePercent));

    return results.slice(0, limit);
  }

  /**
   * Scan for RSI extremes (overbought/oversold)
   */
  async scanRSIExtremes(
    timeframe: string = '1h',
    type: 'OVERBOUGHT' | 'OVERSOLD' | 'BOTH' = 'BOTH',
    limit: number = 10
  ): Promise<RSIScanResult[]> {
    const tickers = await priceService.getAllTickers();
    
    // Filter high volume pairs
    const filtered = tickers.filter(t => t.volumeQuote24h > 1000000);
    
    const results: RSIScanResult[] = [];

    // Calculate RSI for each pair
    for (const ticker of filtered.slice(0, 100)) {
      try {
        const candles = await priceService.getCandles(ticker.symbol, timeframe, 50);
        const prices = candles.map(c => c.close);
        const rsiValues = calculateRSI(prices, 14);
        
        if (rsiValues.length > 0) {
          const rsi = rsiValues[rsiValues.length - 1];
          
          // Determine condition
          let condition: 'OVERBOUGHT' | 'OVERSOLD' | null = null;
          if (rsi > 70) condition = 'OVERBOUGHT';
          if (rsi < 30) condition = 'OVERSOLD';
          
          // Filter by type
          if (type === 'BOTH' && condition) {
            results.push({
              symbol: ticker.symbol,
              currentPrice: ticker.price,
              rsi,
              condition,
              volume24h: ticker.volumeQuote24h,
              changePercent24h: ticker.changePercent24h,
              potentialReversal: this.checkReversalPotential(rsi, condition),
            });
          } else if (type === condition) {
            results.push({
              symbol: ticker.symbol,
              currentPrice: ticker.price,
              rsi,
              condition: condition!,
              volume24h: ticker.volumeQuote24h,
              changePercent24h: ticker.changePercent24h,
              potentialReversal: this.checkReversalPotential(rsi, condition!),
            });
          }
        }
      } catch (error) {
        continue;
      }
    }

    // Sort by RSI extremity
    if (type === 'OVERBOUGHT' || type === 'BOTH') {
      results.sort((a, b) => {
        if (a.condition === 'OVERBOUGHT' && b.condition === 'OVERBOUGHT') {
          return b.rsi - a.rsi;
        }
        if (a.condition === 'OVERSOLD' && b.condition === 'OVERSOLD') {
          return a.rsi - b.rsi;
        }
        return a.rsi - b.rsi;
      });
    } else {
      results.sort((a, b) => a.rsi - b.rsi);
    }

    return results.slice(0, limit);
  }

  /**
   * Check if RSI extreme has reversal potential
   */
  private checkReversalPotential(rsi: number, condition: 'OVERBOUGHT' | 'OVERSOLD'): boolean {
    if (condition === 'OVERSOLD') {
      return rsi < 25; // Very oversold = higher bounce potential
    } else {
      return rsi > 75; // Very overbought = higher dump potential
    }
  }

  /**
   * Scan for pairs near key psychological levels
   */
  async scanPsychologicalLevels(): Promise<Array<{
    symbol: string;
    price: number;
    nearestLevel: number;
    distance: number;
    levelType: string;
  }>> {
    const tickers = await priceService.getAllTickers();
    const results: Array<{
      symbol: string;
      price: number;
      nearestLevel: number;
      distance: number;
      levelType: string;
    }> = [];

    // Psychological levels (round numbers)
    const generateLevels = (price: number): number[] => {
      const magnitude = Math.pow(10, Math.floor(Math.log10(price)));
      const levels: number[] = [];
      
      for (let i = 1; i <= 10; i++) {
        levels.push(i * magnitude);
        levels.push(i * magnitude * 0.5);
      }
      
      return levels;
    };

    for (const ticker of tickers) {
      const levels = generateLevels(ticker.price);
      
      // Find nearest level
      let nearestLevel = levels[0];
      let minDistance = Math.abs(ticker.price - levels[0]);
      
      for (const level of levels) {
        const distance = Math.abs(ticker.price - level);
        if (distance < minDistance) {
          minDistance = distance;
          nearestLevel = level;
        }
      }
      
      const distancePercent = (minDistance / ticker.price) * 100;
      
      // Only include if within 2% of a level
      if (distancePercent < 2) {
        results.push({
          symbol: ticker.symbol,
          price: ticker.price,
          nearestLevel,
          distance: minDistance,
          levelType: ticker.price < nearestLevel ? 'RESISTANCE' : 'SUPPORT',
        });
      }
    }

    return results
      .sort((a, b) => (a.distance / a.price) - (b.distance / b.price))
      .slice(0, 20);
  }
}

export const scannerService = new ScannerService();

