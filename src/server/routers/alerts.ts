// Alerts tRPC router
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { alertService } from '@/lib/services/alertService';

export const alertsRouter = createTRPCRouter({
  // Get user's alerts
  getMyAlerts: protectedProcedure
    .input(
      z.object({
        includeTriggered: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      return alertService.getUserAlerts(ctx.session.user.id, input.includeTriggered);
    }),

  // Create alert
  createAlert: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        targetPrice: z.number(),
        alertType: z.enum(['PRICE_CROSS', 'RSI_LEVEL', 'EMA_CROSS', 'ATR_SPIKE', 'VOLUME_SURGE']).default('PRICE_CROSS'),
        condition: z.enum(['ABOVE', 'BELOW', 'CROSS_ABOVE', 'CROSS_BELOW']).default('ABOVE'),
        metadata: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return alertService.createAlert(
        ctx.session.user.id,
        input.symbol,
        input.targetPrice,
        input.alertType,
        input.condition,
        input.metadata
      );
    }),

  // Delete alert
  deleteAlert: protectedProcedure
    .input(
      z.object({
        alertId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return alertService.deleteAlert(input.alertId, ctx.session.user.id);
    }),

  // Reset alert
  resetAlert: protectedProcedure
    .input(
      z.object({
        alertId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return alertService.resetAlert(input.alertId, ctx.session.user.id);
    }),
});

