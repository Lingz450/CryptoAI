import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { analysisService } from '@/lib/services/analysisService';
import { aiService } from '@/lib/services/aiService';
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from '../trpc';

const explainInput = z.object({
  symbol: z.string().min(2, 'Symbol is required'),
  tone: z.enum(['casual', 'professional', 'educational']).optional(),
});

const chatInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
      })
    )
    .min(1),
  symbol: z.string().optional(),
});

function ensureAI() {
  if (!aiService.isAvailable()) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'AI assistant is not configured yet.',
    });
  }
}

function parseSymbolFromMessage(message: string) {
  const tickerFromDollar = message.match(/\$([a-zA-Z]{2,10})/);
  if (tickerFromDollar) {
    return tickerFromDollar[1].toUpperCase();
  }

  const tokens = message
    .split(/\s+/)
    .map((token) => token.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean);

  const uppercaseToken = tokens.find(
    (token) => token.length >= 2 && token.length <= 6 && token === token.toUpperCase()
  );

  return uppercaseToken?.toUpperCase();
}

type CommandContext = {
  prisma: PrismaClient;
  session: {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
    };
  };
};

async function executeSlashCommand(message: string, ctx: CommandContext) {
  const trimmed = message.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const [command, ...rest] = trimmed.slice(1).split(/\s+/);
  const normalized = command.toLowerCase();

  if (normalized === 'watch' && rest[0]?.toLowerCase() === 'add') {
    const symbols = rest
      .slice(1)
      .map((sym) => sym.toUpperCase().replace(/[^A-Z0-9]/g, ''))
      .filter(Boolean);

    if (symbols.length === 0) {
      return 'Please provide at least one symbol to add to your watchlist.';
    }

    await Promise.all(
      symbols.map((symbol) =>
        ctx.prisma.watchlistItem.upsert({
          where: {
            userId_symbol: {
              userId: ctx.session.user.id,
              symbol,
            },
          },
          update: {},
          create: {
            userId: ctx.session.user.id,
            symbol,
          },
        })
      )
    );

    return `Added ${symbols.join(', ')} to your watchlist.`;
  }

  if (normalized === 'alert') {
    const symbol = rest[0]?.toUpperCase();
    const priceToken = rest[1];

    if (!symbol || !priceToken) {
      return 'Use /alert SYMBOL PRICE [above|below], e.g. /alert BTC 65000 above';
    }

    const price = Number(priceToken.replace(/[^0-9.]/g, ''));
    if (Number.isNaN(price)) {
      return 'Please provide a valid price for the alert.';
    }

    const directionToken = rest[2]?.toLowerCase();
    const condition = directionToken === 'below' ? 'BELOW' : 'ABOVE';

    await ctx.prisma.alert.create({
      data: {
        userId: ctx.session.user.id,
        symbol,
        targetPrice: new Prisma.Decimal(price),
        alertType: 'PRICE_CROSS',
        condition,
      },
    });

    return `Alert armed for ${symbol} ${condition === 'ABOVE' ? 'above' : 'below'} $${price}.`;
  }

  return 'Command not recognized. Try /watch add BTC or /alert BTC 65000 above.';
}

export const aiRouter = createTRPCRouter({
  explainAnalysis: publicProcedure.input(explainInput).mutation(async ({ input }) => {
    ensureAI();
    const analysis = await analysisService.analyzeCoin(input.symbol);
    const explanation = await aiService.explainAnalysis(analysis, {
      tone: input.tone,
    });
    return { explanation };
  }),

  chat: protectedProcedure.input(chatInput).mutation(async ({ ctx, input }) => {
    ensureAI();
    const lastMessage = input.messages[input.messages.length - 1];

    const commandSummary = await executeSlashCommand(lastMessage.content, ctx);
    const symbol =
      input.symbol || parseSymbolFromMessage(lastMessage.content);

    let analysisSummary: string | undefined;
    if (symbol) {
      try {
        const analysis = await analysisService.analyzeCoin(symbol);
        analysisSummary = aiService.getAnalysisSummary(analysis);
      } catch (error) {
        console.warn('Failed to fetch analysis for chat context:', error);
      }
    }

    const response = await aiService.chat(input.messages, {
      analysisSummary,
      userName: ctx.session.user.name || ctx.session.user.email || 'trader',
      commandSummary:
        commandSummary && commandSummary.startsWith('Command not recognized')
          ? undefined
          : commandSummary || undefined,
    });

    return {
      response,
      commandSummary,
    };
  }),
});
