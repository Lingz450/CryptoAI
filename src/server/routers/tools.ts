// Trading Tools Router - Calculators, scanners, pair finder
import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc';
import { pairFinderService } from '@/lib/services/pairFinderService';
import { tradingCalcService } from '@/lib/services/tradingCalcService';
import { scannerService } from '@/lib/services/scannerService';

export const toolsRouter = createTRPCRouter({
  // Pair Finder - Find coins by price
  findPairByPrice: publicProcedure
    .input(
      z.object({
        price: z.number().positive(),
        tolerance: z.number().min(0).max(1).default(0.05),
      })
    )
    .query(async ({ input }) => {
      return pairFinderService.findPairByPrice(input.price, input.tolerance);
    }),

  // Guess coin by price (single best match)
  guessCoin: publicProcedure
    .input(
      z.object({
        price: z.number().positive(),
      })
    )
    .query(async ({ input }) => {
      return pairFinderService.guessCoinByPrice(input.price);
    }),

  // Find pairs in price range
  findPairsInRange: publicProcedure
    .input(
      z.object({
        minPrice: z.number().positive(),
        maxPrice: z.number().positive(),
      })
    )
    .query(async ({ input }) => {
      return pairFinderService.findPairsInRange(input.minPrice, input.maxPrice);
    }),

  // Position Size Calculator
  calculatePositionSize: publicProcedure
    .input(
      z.object({
        entryPrice: z.number().positive(),
        stopLoss: z.number().positive(),
        riskAmount: z.number().positive(),
        leverage: z.number().min(1).max(125).default(1),
        accountBalance: z.number().positive().optional(),
      })
    )
    .query(({ input }) => {
      return tradingCalcService.calculatePositionSize(
        input.entryPrice,
        input.stopLoss,
        input.riskAmount,
        input.leverage,
        input.accountBalance
      );
    }),

  // Create Trade Call
  createTradeCall: publicProcedure
    .input(
      z.object({
        symbol: z.string(),
        direction: z.enum(['LONG', 'SHORT']),
        entry: z.number().positive(),
        stopLoss: z.number().positive(),
        takeProfits: z.array(z.number().positive()),
        leverage: z.number().min(1).max(125).default(1),
      })
    )
    .query(({ input }) => {
      return tradingCalcService.createTradeCall(
        input.symbol,
        input.direction,
        input.entry,
        input.stopLoss,
        input.takeProfits,
        input.leverage
      );
    }),

  // Calculate PnL
  calculatePnL: publicProcedure
    .input(
      z.object({
        entryPrice: z.number().positive(),
        currentPrice: z.number().positive(),
        quantity: z.number().positive(),
        direction: z.enum(['LONG', 'SHORT']),
        leverage: z.number().min(1).max(125).default(1),
      })
    )
    .query(({ input }) => {
      return tradingCalcService.calculatePnL(
        input.entryPrice,
        input.currentPrice,
        input.quantity,
        input.direction,
        input.leverage
      );
    }),

  // Calculate Liquidation Price
  calculateLiquidation: publicProcedure
    .input(
      z.object({
        entryPrice: z.number().positive(),
        leverage: z.number().min(1).max(125),
        direction: z.enum(['LONG', 'SHORT']),
        maintenanceMarginRate: z.number().min(0).max(1).default(0.005),
      })
    )
    .query(({ input }) => {
      return tradingCalcService.calculateLiquidationPrice(
        input.entryPrice,
        input.leverage,
        input.direction,
        input.maintenanceMarginRate
      );
    }),

  // Validate Trade Setup
  validateSetup: publicProcedure
    .input(
      z.object({
        entry: z.number().positive(),
        stopLoss: z.number().positive(),
        takeProfits: z.array(z.number().positive()),
        direction: z.enum(['LONG', 'SHORT']),
      })
    )
    .query(({ input }) => {
      return tradingCalcService.validateTradeSetup(
        input.entry,
        input.stopLoss,
        input.takeProfits,
        input.direction
      );
    }),

  // EMA Scanner
  scanEMA: publicProcedure
    .input(
      z.object({
        emaPeriod: z.number().min(1).max(500),
        timeframe: z.string().default('1h'),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      return scannerService.scanEMAProximity(
        input.emaPeriod,
        input.timeframe,
        input.limit
      );
    }),

  // RSI Scanner
  scanRSI: publicProcedure
    .input(
      z.object({
        timeframe: z.string().default('1h'),
        type: z.enum(['OVERBOUGHT', 'OVERSOLD', 'BOTH']).default('BOTH'),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      return scannerService.scanRSIExtremes(
        input.timeframe,
        input.type,
        input.limit
      );
    }),

  // Psychological Levels Scanner
  scanPsychologicalLevels: publicProcedure.query(async () => {
    return scannerService.scanPsychologicalLevels();
  }),
});

