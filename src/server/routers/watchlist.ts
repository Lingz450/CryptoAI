// Watchlist tRPC router
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { TRPCError } from '@trpc/server';
import type { WatchlistItem } from '@prisma/client';
import type { ExchangeName } from '@/lib/exchanges';
import { analysisService } from '@/lib/services/analysisService';

type WatchlistAnalysis = {
  symbol: string;
  exchange?: ExchangeName;
  price: number;
  priceChange24h: number;
  ghostScore?: number;
};

type WatchlistListItem = WatchlistItem & {
  analysis?: WatchlistAnalysis;
};

async function getUserWatchlistItems(userId: string) {
  return prisma.watchlistItem.findMany({
    where: { userId },
    orderBy: [{ position: 'asc' }, { addedAt: 'desc' }],
  });
}

async function hydrateWithAnalysis(items: WatchlistItem[]): Promise<WatchlistListItem[]> {
  if (items.length === 0) return [];

  const symbols = items.map((item) => item.symbol.toUpperCase());
  const analysisMap = await analysisService.analyzeMultipleCoins(symbols);

  return items.map((item) => {
    const analysis = analysisMap.get(item.symbol.toUpperCase());
    if (!analysis || !analysis.ticker) {
      return { ...item };
    }

    return {
      ...item,
      analysis: {
        symbol: analysis.symbol ?? item.symbol.toUpperCase(),
        exchange: analysis.ticker.exchange,
        price: analysis.ticker.price,
        priceChange24h: analysis.ticker.changePercent24h ?? 0,
        ghostScore: analysis.ghostScore?.totalScore,
      },
    };
  });
}

async function createWatchlistEntry(userId: string, input: { symbol: string; tags?: string[]; notes?: string }) {
  const normalizedSymbol = input.symbol.toUpperCase();

  const existing = await prisma.watchlistItem.findUnique({
    where: {
      userId_symbol: {
        userId,
        symbol: normalizedSymbol,
      },
    },
  });

  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Symbol already in watchlist',
    });
  }

  return prisma.watchlistItem.create({
    data: {
      userId,
      symbol: normalizedSymbol,
      tags: input.tags || [],
      notes: input.notes,
    },
  });
}

async function deleteWatchlistEntryBySymbol(userId: string, symbol: string) {
  return prisma.watchlistItem.delete({
    where: {
      userId_symbol: {
        userId,
        symbol: symbol.toUpperCase(),
      },
    },
  });
}

async function deleteWatchlistEntryById(userId: string, id: string) {
  const item = await prisma.watchlistItem.findFirst({
    where: { id, userId },
  });

  if (!item) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Watchlist item not found',
    });
  }

  await prisma.watchlistItem.delete({
    where: { id },
  });

  return item;
}

export const watchlistRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const items = await getUserWatchlistItems(ctx.session.user.id);
    return hydrateWithAnalysis(items);
  }),

  // Get user's watchlist
  getMyWatchlist: protectedProcedure.query(async ({ ctx }) => {
    return getUserWatchlistItems(ctx.session.user.id);
  }),

  // Add to watchlist
  addToWatchlist: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createWatchlistEntry(ctx.session.user.id, input);
    }),

  add: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createWatchlistEntry(ctx.session.user.id, input);
    }),

  // Remove from watchlist
  removeFromWatchlist: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return deleteWatchlistEntryBySymbol(ctx.session.user.id, input.symbol);
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return deleteWatchlistEntryById(ctx.session.user.id, input.id);
    }),

  // Update watchlist item
  updateWatchlistItem: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
        position: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const item = await prisma.watchlistItem.findFirst({
        where: { id, userId: ctx.session.user.id },
      });

      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Watchlist item not found',
        });
      }

      return prisma.watchlistItem.update({
        where: { id },
        data,
      });
    }),

  // Clear watchlist
  clearWatchlist: protectedProcedure.mutation(async ({ ctx }) => {
    return prisma.watchlistItem.deleteMany({
      where: { userId: ctx.session.user.id },
    });
  }),
});

