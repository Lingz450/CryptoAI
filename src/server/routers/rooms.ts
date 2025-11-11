import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';

const roomInput = z.object({
  name: z.string().min(3).max(80),
  description: z.string().max(400).optional(),
});

const joinInput = z.object({
  inviteCode: z.string().min(4).max(32),
});

const watchlistInput = z.object({
  roomId: z.string(),
  symbol: z.string().min(2).max(10),
  notes: z.string().max(200).optional(),
});

const alertInput = z.object({
  roomId: z.string(),
  symbol: z.string().min(2).max(10),
  targetPrice: z.number().positive(),
  condition: z.enum(['ABOVE', 'BELOW']),
});

const screenerInput = z.object({
  roomId: z.string(),
  name: z.string().min(3).max(60),
  configuration: z.record(z.any()),
});

async function ensureRoomOwner(ctx: Parameters<typeof protectedProcedure['_def']['resolver']>[0]['ctx'], roomId: string) {
  const membership = await prisma.roomMembership.findFirst({
    where: {
      roomId,
      userId: ctx.session.user.id,
      role: { in: ['OWNER', 'ANALYST'] },
    },
  });
  if (!membership) {
    throw new Error('Permission denied');
  }
  return membership;
}

export const roomsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rooms = await prisma.roomMembership.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        room: {
          include: {
            owner: { select: { id: true, name: true } },
            watchlistItems: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
            roomAlerts: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
            screeners: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    return rooms;
  }),

  create: protectedProcedure.input(roomInput).mutation(async ({ ctx, input }) => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();

    const room = await prisma.room.create({
      data: {
        name: input.name,
        description: input.description,
        ownerId: ctx.session.user.id,
        inviteCode: code,
        members: {
          create: {
            userId: ctx.session.user.id,
            role: 'OWNER',
          },
        },
      },
    });

    return room;
  }),

  join: protectedProcedure.input(joinInput).mutation(async ({ ctx, input }) => {
    const room = await prisma.room.findUnique({
      where: { inviteCode: input.inviteCode },
    });
    if (!room) {
      throw new Error('Room not found');
    }
    const existing = await prisma.roomMembership.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: ctx.session.user.id,
        },
      },
    });
    if (existing) {
      return room;
    }
    await prisma.roomMembership.create({
      data: {
        roomId: room.id,
        userId: ctx.session.user.id,
        role: 'MEMBER',
      },
    });
    return room;
  }),

  watchlist: protectedProcedure.input(watchlistInput).mutation(async ({ ctx, input }) => {
    await ensureRoomOwner(ctx, input.roomId);
    const item = await prisma.roomWatchlistItem.create({
      data: {
        roomId: input.roomId,
        symbol: input.symbol.toUpperCase(),
        notes: input.notes,
        addedBy: ctx.session.user.id,
      },
    });
    await prisma.roomActivity.create({
      data: {
        roomId: input.roomId,
        userId: ctx.session.user.id,
        message: `${ctx.session.user.name || 'Someone'} shared ${item.symbol} to the room watchlist.`,
      },
    });
    return item;
  }),

  alerts: protectedProcedure.input(alertInput).mutation(async ({ ctx, input }) => {
    await ensureRoomOwner(ctx, input.roomId);
    const alert = await prisma.roomAlert.create({
      data: {
        roomId: input.roomId,
        symbol: input.symbol.toUpperCase(),
        targetPrice: input.targetPrice,
        condition: input.condition,
        createdBy: ctx.session.user.id,
      },
    });
    await prisma.roomActivity.create({
      data: {
        roomId: input.roomId,
        userId: ctx.session.user.id,
        message: `${ctx.session.user.name || 'Someone'} set an alert for ${alert.symbol} ${alert.condition.toLowerCase()} $${alert.targetPrice}.`,
      },
    });
    return alert;
  }),

  screener: protectedProcedure.input(screenerInput).mutation(async ({ ctx, input }) => {
    await ensureRoomOwner(ctx, input.roomId);
    const screener = await prisma.roomScreener.create({
      data: {
        roomId: input.roomId,
        name: input.name,
        configuration: input.configuration,
        createdBy: ctx.session.user.id,
      },
    });
    await prisma.roomActivity.create({
      data: {
        roomId: input.roomId,
        userId: ctx.session.user.id,
        message: `${ctx.session.user.name || 'Someone'} saved a screener: ${input.name}.`,
      },
    });
    return screener;
  }),

  activity: protectedProcedure.input(z.object({ roomId: z.string() })).query(async ({ ctx, input }) => {
    await prisma.roomMembership.findFirstOrThrow({
      where: { roomId: input.roomId, userId: ctx.session.user.id },
    });
    return prisma.roomActivity.findMany({
      where: { roomId: input.roomId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { id: true, name: true, image: true } } },
    });
  }),
});
