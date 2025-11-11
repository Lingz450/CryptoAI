// User profile and settings router
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { TRPCError } from '@trpc/server';

export const userRouter = createTRPCRouter({
  // Get current user profile
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return user;
  }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        image: z.string().url().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await prisma.user.update({
        where: { id: ctx.session.user.id },
        data: {
          name: input.name,
          image: input.image,
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      });

      return updated;
    }),

  // Get notification preferences
  getNotificationPreferences: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: ctx.session.user.id },
    });

    // Return default preferences if none exist
    if (!prefs) {
      return {
        alertsEmail: true,
        alertsTelegram: true,
        alertsPush: true,
        digestEmail: true,
        digestFrequency: 'WEEKLY',
        screenerNotifications: true,
      };
    }

    return prefs;
  }),

  // Update notification preferences
  updateNotificationPreferences: protectedProcedure
    .input(
      z.object({
        alertsEmail: z.boolean().optional(),
        alertsTelegram: z.boolean().optional(),
        alertsPush: z.boolean().optional(),
        digestEmail: z.boolean().optional(),
        digestFrequency: z.enum(['DAILY', 'WEEKLY']).optional(),
        screenerNotifications: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await prisma.notificationPreference.upsert({
        where: { userId: ctx.session.user.id },
        create: {
          userId: ctx.session.user.id,
          ...input,
        },
        update: input,
      });

      return updated;
    }),
});

