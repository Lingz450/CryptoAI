// Market data tRPC router
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { priceService } from '@/lib/services/priceService';
import { analysisService } from '@/lib/services/analysisService';
import { screenerService } from '@/lib/services/screenerService';
import { derivativesService } from '@/lib/services/derivativesService';
import { getBaseSymbol } from '@/lib/utils';

export const marketRouter = createTRPCRouter({
  listSymbols: publicProcedure
    .input(
      z.object({
        query: z.string().optional(),
        limit: z.number().min(1).max(200).default(60),
        exchange: z.enum(['binance', 'bybit', 'okx']).optional(),
      })
    )
    .query(async ({ input }) => {
      const tickers = await priceService.getAllTickers(input.exchange);

      const symbolMap = new Map<
        string,
        {
          symbol: string;
          fullSymbol: string;
          price: number;
          changePercent24h: number;
          volume24h: number;
          exchange: string;
        }
      >();

      for (const ticker of tickers) {
        const baseSymbol = getBaseSymbol(ticker.symbol);
        const existing = symbolMap.get(baseSymbol);

        if (!existing || ticker.volumeQuote24h > existing.volume24h) {
          symbolMap.set(baseSymbol, {
            symbol: baseSymbol,
            fullSymbol: ticker.symbol,
            price: ticker.price,
            changePercent24h: ticker.changePercent24h,
            volume24h: ticker.volumeQuote24h,
            exchange: ticker.exchange,
          });
        }
      }

      let symbols = Array.from(symbolMap.values()).sort(
        (a, b) => b.volume24h - a.volume24h
      );

      const query = input.query?.trim().toUpperCase();
      if (query) {
        symbols = symbols.filter((item) => item.symbol.includes(query));
      }

      return symbols.slice(0, input.limit);
    }),
  // Get ticker for a symbol
  getTicker: publicProcedure
    .input(
      z.object({
        symbol: z.string(),
        exchange: z.enum(['binance', 'bybit', 'okx']).optional(),
      })
    )
    .query(async ({ input }) => {
      return priceService.getTicker(input.symbol, input.exchange);
    }),

  // Get multiple tickers
  getMultipleTickers: publicProcedure
    .input(
      z.object({
        symbols: z.array(z.string()),
        exchange: z.enum(['binance', 'bybit', 'okx']).optional(),
      })
    )
    .query(async ({ input }) => {
      const tickers = await priceService.getMultipleTickers(
        input.symbols,
        input.exchange
      );
      return Array.from(tickers.entries()).map(([symbol, ticker]) => {
        const { symbol: _ignored, ...rest } = ticker;
        return {
          symbol,
          ...rest,
        };
      });
    }),

  // Get top movers
  getTopMovers: publicProcedure
    .input(
      z.object({
        limit: z.number().default(10),
        exchange: z.enum(['binance', 'bybit', 'okx']).optional(),
      })
    )
    .query(async ({ input }) => {
      return priceService.getTopMovers(input.limit, input.exchange);
    }),

  // Get candles
  getCandles: publicProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: z.string().default('1h'),
        limit: z.number().default(100),
        exchange: z.enum(['binance', 'bybit', 'okx']).optional(),
      })
    )
    .query(async ({ input }) => {
      return priceService.getCandles(
        input.symbol,
        input.interval,
        input.limit,
        input.exchange
      );
    }),

  // Get order book
  getOrderBook: publicProcedure
    .input(
      z.object({
        symbol: z.string(),
        limit: z.number().default(20),
        exchange: z.enum(['binance', 'bybit', 'okx']).optional(),
      })
    )
    .query(async ({ input }) => {
      return priceService.getOrderBook(
        input.symbol,
        input.limit,
        input.exchange
      );
    }),

  getDerivatives: publicProcedure
    .input(
      z.object({
        symbol: z.string(),
        exchange: z.enum(['binance', 'bybit', 'okx']).optional(),
      })
    )
    .query(async ({ input }) => {
      return derivativesService.get(input.symbol, input.exchange);
    }),

  // Get complete coin analysis
  analyzeCoin: publicProcedure
    .input(
      z.object({
        symbol: z.string(),
        exchange: z.enum(['binance', 'bybit', 'okx']).optional(),
      })
    )
    .query(async ({ input }) => {
      return analysisService.analyzeCoin(input.symbol, input.exchange);
    }),

  // Screeners
  scanATRBreakouts: publicProcedure
    .input(
      z.object({
        limit: z.number().default(100),
        multiplier: z.number().default(1.5),
        exchange: z.enum(['binance', 'bybit', 'okx']).optional(),
      })
    )
    .query(async ({ input }) => {
      return screenerService.scanATRBreakouts(
        input.limit,
        input.multiplier,
        input.exchange
      );
    }),

  scanEMACrossover: publicProcedure
    .input(
      z.object({
        limit: z.number().default(100),
        fastPeriod: z.number().default(50),
        slowPeriod: z.number().default(200),
        exchange: z.enum(['binance', 'bybit', 'okx']).optional(),
      })
    )
    .query(async ({ input }) => {
      return screenerService.scanEMACrossover(
        input.limit,
        input.fastPeriod,
        input.slowPeriod,
        input.exchange
      );
    }),

  scanRSIExtremes: publicProcedure
    .input(
      z.object({
        limit: z.number().default(100),
        oversoldThreshold: z.number().default(30),
        overboughtThreshold: z.number().default(70),
        exchange: z.enum(['binance', 'bybit', 'okx']).optional(),
      })
    )
    .query(async ({ input }) => {
      return screenerService.scanRSIExtremes(
        input.limit,
        input.oversoldThreshold,
        input.overboughtThreshold,
        input.exchange
      );
    }),

  scanVolumeSurge: publicProcedure
    .input(
      z.object({
        limit: z.number().default(100),
        multiplier: z.number().default(2.0),
        exchange: z.enum(['binance', 'bybit', 'okx']).optional(),
      })
    )
    .query(async ({ input }) => {
      return screenerService.scanVolumeSurge(
        input.limit,
        input.multiplier,
        input.exchange
      );
    }),

  scanHighGhostScore: publicProcedure
    .input(
      z.object({
        limit: z.number().default(50),
        minScore: z.number().default(65),
        exchange: z.enum(['binance', 'bybit', 'okx']).optional(),
      })
    )
    .query(async ({ input }) => {
      return screenerService.scanHighGhostScore(
        input.limit,
        input.minScore,
        input.exchange
      );
    }),
});

