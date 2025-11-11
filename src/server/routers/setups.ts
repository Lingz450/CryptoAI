import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';

export const setupsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const setups = await prisma.setup.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return setups;
  }),

  create: protectedProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(20),
        direction: z.enum(['LONG', 'SHORT']),
        entry: z.number().positive(),
        stopLoss: z.number().positive(),
        takeProfit: z.number().positive(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const setup = await prisma.setup.create({
        data: {
          userId: ctx.session.user.id,
          symbol: input.symbol,
          direction: input.direction,
          entry: input.entry,
          stopLoss: input.stopLoss,
          takeProfit: input.takeProfit,
          notes: input.notes,
          status: 'PENDING',
        },
      });
      return setup;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.setup.delete({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      });
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const setup = await prisma.setup.update({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        data: {
          status: input.status,
        },
      });
      return setup;
    }),
});

