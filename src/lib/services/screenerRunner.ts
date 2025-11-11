import { env } from '@/env';
import { calculateIndicators } from '@/lib/indicators';
import type { Candle, ExchangeName } from '@/lib/exchanges';
import { priceService } from '@/lib/services/priceService';
import { calculateGhostScore } from '@/lib/services/ghostScore';
import { $Enums } from '@prisma/client';

type ScreenerType = $Enums.ScreenerType;

const DEFAULT_SYMBOLS = [
  'BTC',
  'ETH',
  'BNB',
  'SOL',
  'XRP',
  'ADA',
  'DOGE',
  'DOT',
  'MATIC',
  'AVAX',
  'LINK',
  'UNI',
  'ATOM',
  'LTC',
  'ETC',
  'FIL',
  'APT',
  'ARB',
  'OP',
  'INJ',
];

export type ScreenerFilterConfig = {
  exchange?: 'aggregated' | ExchangeName;
  minVolume?: number;
  minGhostScore?: number;
  limit?: number;
};

export type ScreenerResult = {
  symbol: string;
  exchange: ExchangeName;
  price: number;
  priceChange24h: number;
  volume24h: number;
  ghostScore?: number;
  rsi?: number;
  atr?: number;
};

export async function runScreenerScan(input: {
  type: ScreenerType;
  limit?: number;
  filters?: ScreenerFilterConfig | null;
  symbols?: string[];
}): Promise<ScreenerResult[]> {
  const { type, filters, symbols = DEFAULT_SYMBOLS } = input;
  const limit = input.limit ?? filters?.limit ?? 20;

  const results: ScreenerResult[] = [];

  for (const symbol of symbols) {
    try {
      const exchangeOverride =
        filters?.exchange && filters.exchange !== 'aggregated'
          ? filters.exchange
          : undefined;

      const candles = (await priceService.getCandles(
        symbol,
        '1h',
        240,
        exchangeOverride
      )) as Candle[] | undefined;

      if (!candles || candles.length < 50) continue;

      const latestCandle = candles[candles.length - 1];
      const referenceIndex = Math.max(0, candles.length - 25);
      const referenceCandle = candles[referenceIndex];
      const priceChange24h =
        referenceCandle && referenceCandle.close !== 0
          ? ((latestCandle.close - referenceCandle.close) / referenceCandle.close) * 100
          : 0;

      const last24hCandles = candles.slice(-24);
      const volume24h = last24hCandles.reduce(
        (sum: number, c: Candle) => sum + c.volume,
        0
      );

      if (filters?.minVolume && volume24h < filters.minVolume) {
        continue;
      }

      const indicators = calculateIndicators(candles);

      let ghostScore: number | undefined;
      if (candles.length >= 200) {
        try {
            const breakdown = await calculateGhostScore(symbol, candles);
          ghostScore = breakdown.totalScore;
        } catch (ghostError) {
          console.warn(`GhostScore calculation failed for ${symbol}:`, ghostError);
        }
      }

      if (
        typeof filters?.minGhostScore === 'number' &&
        (typeof ghostScore !== 'number' || ghostScore < filters.minGhostScore)
      ) {
        continue;
      }

      let includeInResults = false;

  switch (type as string) {
    case 'GHOST_SCORE_HIGH':
      includeInResults = typeof ghostScore === 'number' && ghostScore >= 70;
      break;

        case 'ATR_BREAKOUT':
          includeInResults =
            typeof indicators.atrPercent === 'number' && indicators.atrPercent > 3.0;
          break;

        case 'VOLUME_SURGE': {
          const baselineWindow = candles.slice(-21, -1);
          const baselineVolume =
            baselineWindow.reduce((sum: number, c: Candle) => sum + c.volume, 0) /
            Math.max(1, baselineWindow.length);
          includeInResults =
            baselineVolume > 0 && latestCandle.volume > baselineVolume * 2;
          break;
        }

        case 'RSI_EXTREME':
          includeInResults =
            typeof indicators.rsi === 'number' &&
            (indicators.rsi >= 70 || indicators.rsi <= 30);
          break;

        case 'PRICE_BREAKOUT': {
          const recentCandles = candles.slice(-20);
          if (recentCandles.length > 0) {
            const resistance = Math.max(...recentCandles.map((p: Candle) => p.high));
            const support = Math.min(...recentCandles.map((p: Candle) => p.low));
            includeInResults = latestCandle.close > resistance || latestCandle.close < support;
          }
          break;
        }

        case 'EMA_CROSS':
          includeInResults =
            typeof indicators.rsi === 'number' &&
            indicators.rsi >= 55 &&
            indicators.rsi <= 65;
          break;

        default:
          includeInResults = true;
          break;
      }

      if (!includeInResults) continue;

      const exchangeLabel =
        filters?.exchange && filters.exchange !== 'aggregated'
          ? filters.exchange
          : (env.DEFAULT_EXCHANGE as ExchangeName);

      results.push({
        symbol,
        exchange: exchangeLabel,
        price: latestCandle.close,
        priceChange24h,
        volume24h,
        ghostScore,
        rsi: indicators.rsi,
        atr: indicators.atrPercent,
      });

      if (results.length >= limit) break;
    } catch (error) {
      console.error(`Error scanning ${symbol}:`, error);
    }
  }

  results.sort((a, b) => {
    const aHasGhost = typeof a.ghostScore === 'number';
    const bHasGhost = typeof b.ghostScore === 'number';

    if (aHasGhost && bHasGhost) {
      return (b.ghostScore as number) - (a.ghostScore as number);
    }
    if (aHasGhost) {
      return -1;
    }
    if (bHasGhost) {
      return 1;
    }
    return b.volume24h - a.volume24h;
  });

  return results.slice(0, limit);
}
