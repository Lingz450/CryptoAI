import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { runEmaBacktest } from '@/lib/services/backtestService';

export const backtestRouter = createTRPCRouter({
  runEma: protectedProcedure
    .input(
      z.object({
        symbol: z.string().min(2).max(10),
        fastPeriod: z.number().int().min(5).default(10),
        slowPeriod: z.number().int().min(20).default(50),
        interval: z.string().default('1h'),
        limit: z.number().int().min(100).max(1000).default(250),
        minRsi: z.number().min(0).max(100).optional(),
        maxRsi: z.number().min(0).max(100).optional(),
        exchange: z.enum(['binance', 'bybit', 'okx']).optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.fastPeriod >= input.slowPeriod) {
        throw new Error('Fast period must be less than slow period.');
      }
      const backtest = await runEmaBacktest({
        symbol: input.symbol,
        fastPeriod: input.fastPeriod,
        slowPeriod: input.slowPeriod,
        interval: input.interval,
        limit: input.limit,
        exchange: input.exchange,
        minRsi: input.minRsi,
        maxRsi: input.maxRsi,
      });
      return backtest;
    }),
});
