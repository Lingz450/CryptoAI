// Pair Finder Service - Find coins by price
import { priceService } from './priceService';
import type { Ticker } from '@/lib/exchanges/types';

export interface PairMatch {
  symbol: string;
  price: number;
  priceMatch: number; // How close the match is (0-100%)
  volume24h: number;
  changePercent24h: number;
}

export class PairFinderService {
  /**
   * Find pairs that match a target price
   * Useful for "mystery screenshots" where you see a price but don't know the coin
   */
  async findPairByPrice(
    targetPrice: number,
    tolerance: number = 0.05 // 5% tolerance by default
  ): Promise<PairMatch[]> {
    // Get all tickers
    const tickers = await priceService.getAllTickers();

    const matches: PairMatch[] = [];
    const range = targetPrice * tolerance;

    for (const ticker of tickers) {
      const priceDiff = Math.abs(ticker.price - targetPrice);
      
      // Check if within tolerance
      if (priceDiff <= range) {
        const matchPercent = 100 - (priceDiff / targetPrice) * 100;
        
        matches.push({
          symbol: ticker.symbol,
          price: ticker.price,
          priceMatch: matchPercent,
          volume24h: ticker.volumeQuote24h,
          changePercent24h: ticker.changePercent24h,
        });
      }
    }

    // Sort by match accuracy, then by volume
    matches.sort((a, b) => {
      const matchDiff = b.priceMatch - a.priceMatch;
      if (Math.abs(matchDiff) > 0.1) return matchDiff;
      return b.volume24h - a.volume24h;
    });

    return matches.slice(0, 10); // Top 10 matches
  }

  /**
   * Guess the coin from a price (single best match)
   */
  async guessCoinByPrice(targetPrice: number): Promise<PairMatch | null> {
    const matches = await this.findPairByPrice(targetPrice, 0.1); // 10% tolerance
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Find pairs within a price range
   */
  async findPairsInRange(
    minPrice: number,
    maxPrice: number
  ): Promise<PairMatch[]> {
    const tickers = await priceService.getAllTickers();

    const matches: PairMatch[] = tickers
      .filter(t => t.price >= minPrice && t.price <= maxPrice)
      .map(t => ({
        symbol: t.symbol,
        price: t.price,
        priceMatch: 100,
        volume24h: t.volumeQuote24h,
        changePercent24h: t.changePercent24h,
      }))
      .sort((a, b) => b.volume24h - a.volume24h);

    return matches.slice(0, 50);
  }
}

export const pairFinderService = new PairFinderService();

