import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { runScreenerScan, type ScreenerFilterConfig } from '@/lib/services/screenerRunner';
import { $Enums } from '@prisma/client';

type ScreenerType = $Enums.ScreenerType;

const screenerTypeEnum = z.nativeEnum($Enums.ScreenerType);

const scheduleEnum = z.enum(['NONE', 'HOURLY', 'DAILY']);

const filtersSchema = z.object({
  exchange: z.enum(['aggregated', 'binance', 'bybit', 'okx']).optional(),
  minVolume: z.number().min(0).optional(),
  minGhostScore: z.number().min(0).max(100).optional(),
});

const baseScanInput = z.object({
  type: screenerTypeEnum,
  limit: z.number().min(1).max(50).default(20),
  filters: filtersSchema.optional(),
});

const saveInput = baseScanInput.extend({
  id: z.string().optional(),
  name: z.string().min(2).max(80),
  schedule: scheduleEnum.default('NONE'),
});

export const screenersRouter = createTRPCRouter({
  scan: protectedProcedure.input(baseScanInput).query(async ({ input }) => {
    return runScreenerScan({
      type: input.type,
      limit: input.limit,
      filters: input.filters,
    });
  }),

  listSaved: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.screener.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { updatedAt: 'desc' },
    });
  }),

  save: protectedProcedure.input(saveInput).mutation(async ({ ctx, input }) => {
    const filters: ScreenerFilterConfig = {
      ...input.filters,
      limit: input.limit,
    };

    const scheduleValue = input.schedule === 'NONE' ? null : input.schedule;
    const enabled = input.schedule !== 'NONE';

    if (input.id) {
      const existing = await ctx.prisma.screener.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });
      if (!existing) {
        throw new Error('Screener not found');
      }
      return ctx.prisma.screener.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          type: input.type,
          filters,
          schedule: scheduleValue,
          enabled,
        },
      });
    }

    return ctx.prisma.screener.create({
      data: {
        userId: ctx.session.user.id,
        name: input.name,
        type: input.type,
        filters,
        schedule: scheduleValue,
        enabled,
      },
    });
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.screener.deleteMany({
        where: { id: input.id, userId: ctx.session.user.id },
      });
      return { success: true };
    }),

  runSaved: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const screener = await ctx.prisma.screener.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });

      if (!screener) {
        throw new Error('Screener not found');
      }

      const filters = (screener.filters as ScreenerFilterConfig) || {};
      const limit = filters.limit ?? 20;

      const results = await runScreenerScan({
        type: screener.type as ScreenerType,
        limit,
        filters,
      });

      await ctx.prisma.screenerRun.create({
        data: {
          screenerId: screener.id,
          results,
          resultCount: results.length,
        },
      });

      await ctx.prisma.screener.update({
        where: { id: screener.id },
        data: {
          lastRun: new Date(),
        },
      });

      return {
        screener,
        results,
        limit,
      };
    }),
});


