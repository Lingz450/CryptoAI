// Portfolio & Shadow Trade tracking service
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { exchangeAggregator } from '@/lib/exchanges';
import { regimeDetector } from './regimeDetector';
import { priceService } from './priceService';
import type { ExchangeName } from '@/lib/exchanges/types';

export interface ExchangeCredentials {
  exchange: ExchangeName;
  apiKey: string;
  secretKey: string;
  readOnly: boolean; // Must be true for safety
}

export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  leverage: number;
  exchange: string;
  marginUsed: number;
}

export interface PortfolioSnapshot {
  totalEquity: number;
  availableBalance: number;
  marginUsed: number;
  unrealizedPnl: number;
  positions: Position[];
  timestamp: number;
}

export interface RiskCluster {
  symbols: string[];
  avgCorrelation: number;
  totalExposure: number;
  exposurePercent: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  warning?: string;
}

export interface ShadowTrade {
  id: string;
  userId: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'ACTIVE' | 'CLOSED';
  enteredAt: Date;
  exitedAt?: Date;
  exitPrice?: number;
  pnl?: number;
  notes?: string;
}

const CACHE_TTL = 60; // 1 minute

export class PortfolioService {
  /**
   * Get portfolio snapshot from exchange
   */
  async getPortfolio(
    userId: string,
    credentials: ExchangeCredentials
  ): Promise<PortfolioSnapshot> {
    // Verify read-only
    if (!credentials.readOnly) {
      throw new Error('Only read-only API keys are allowed');
    }

    // Check cache first
    const cacheKey = `portfolio:${userId}:${credentials.exchange}`;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as PortfolioSnapshot;
      }
    }

    // Fetch positions from exchange (mock implementation)
    // In production, integrate with actual exchange APIs
    const positions = await this.fetchExchangePositions(credentials);

    // Calculate totals
    let totalEquity = 10000; // Mock starting capital
    let marginUsed = 0;
    let unrealizedPnl = 0;

    for (const pos of positions) {
      marginUsed += pos.marginUsed;
      unrealizedPnl += pos.unrealizedPnl;
    }

    totalEquity += unrealizedPnl;

    const snapshot: PortfolioSnapshot = {
      totalEquity,
      availableBalance: totalEquity - marginUsed,
      marginUsed,
      unrealizedPnl,
      positions,
      timestamp: Date.now(),
    };

    // Cache it
    if (redis) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(snapshot));
    }

    // Store in database
    await this.syncPositionsToDatabase(userId, positions);

    return snapshot;
  }

  /**
   * Fetch positions from exchange (mock - implement actual API calls)
   */
  private async fetchExchangePositions(
    credentials: ExchangeCredentials
  ): Promise<Position[]> {
    // Mock implementation - replace with actual exchange API calls
    // For now, return stored positions from database
    return [];
  }

  /**
   * Sync positions to database
   */
  private async syncPositionsToDatabase(
    userId: string,
    positions: Position[]
  ): Promise<void> {
    for (const pos of positions) {
      await prisma.walletPosition.upsert({
        where: {
          userId_exchange_symbol_side: {
            userId,
            exchange: pos.exchange,
            symbol: pos.symbol,
            side: pos.side,
          },
        },
        create: {
          userId,
          exchange: pos.exchange,
          symbol: pos.symbol,
          side: pos.side,
          quantity: pos.quantity,
          entryPrice: pos.entryPrice,
          leverage: pos.leverage,
          unrealizedPnl: pos.unrealizedPnl,
        },
        update: {
          quantity: pos.quantity,
          entryPrice: pos.entryPrice,
          leverage: pos.leverage,
          unrealizedPnl: pos.unrealizedPnl,
        },
      });
    }
  }

  /**
   * Analyze portfolio risk clusters
   */
  async analyzeRiskClusters(
    positions: Position[]
  ): Promise<RiskCluster[]> {
    if (positions.length < 2) {
      return [];
    }

    // Group by correlation
    const clusters: RiskCluster[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < positions.length; i++) {
      if (processed.has(positions[i].symbol)) continue;

      const cluster: string[] = [positions[i].symbol];
      let totalExposure = Math.abs(positions[i].unrealizedPnl);
      let correlationSum = 0;
      let correlationCount = 0;

      // Find correlated positions
      for (let j = i + 1; j < positions.length; j++) {
        if (processed.has(positions[j].symbol)) continue;

        const correlation = await this.calculateCorrelation(
          positions[i].symbol,
          positions[j].symbol
        );

        if (Math.abs(correlation) > 0.7) {
          cluster.push(positions[j].symbol);
          totalExposure += Math.abs(positions[j].unrealizedPnl);
          correlationSum += Math.abs(correlation);
          correlationCount++;
          processed.add(positions[j].symbol);
        }
      }

      if (cluster.length > 1) {
        const avgCorrelation = correlationCount > 0 ? correlationSum / correlationCount : 0;
        const totalEquity = positions.reduce((sum, p) => sum + Math.abs(p.unrealizedPnl), 0);
        const exposurePercent = (totalExposure / totalEquity) * 100;

        let riskLevel: RiskCluster['riskLevel'] = 'LOW';
        let warning: string | undefined;

        if (exposurePercent > 50) {
          riskLevel = 'CRITICAL';
          warning = `${exposurePercent.toFixed(0)}% of portfolio in correlated assets. Extreme concentration risk.`;
        } else if (exposurePercent > 30) {
          riskLevel = 'HIGH';
          warning = `${exposurePercent.toFixed(0)}% exposure to correlated cluster. Consider hedging.`;
        } else if (exposurePercent > 15) {
          riskLevel = 'MEDIUM';
          warning = `Moderate correlation risk. Monitor closely.`;
        }

        clusters.push({
          symbols: cluster,
          avgCorrelation,
          totalExposure,
          exposurePercent,
          riskLevel,
          warning,
        });
      }

      processed.add(positions[i].symbol);
    }

    return clusters.sort((a, b) => b.exposurePercent - a.exposurePercent);
  }

  /**
   * Calculate correlation between two symbols
   */
  private async calculateCorrelation(
    symbol1: string,
    symbol2: string
  ): Promise<number> {
    // Fetch 30-day price history
    const [candles1, candles2] = await Promise.all([
      priceService.getCandles(symbol1, '1d', 30),
      priceService.getCandles(symbol2, '1d', 30),
    ]);

    const prices1 = candles1.map(c => c.close);
    const prices2 = candles2.map(c => c.close);

    // Calculate Pearson correlation
    const n = Math.min(prices1.length, prices2.length);
    if (n < 10) return 0;

    const mean1 = prices1.reduce((sum, p) => sum + p, 0) / n;
    const mean2 = prices2.reduce((sum, p) => sum + p, 0) / n;

    let numerator = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = prices1[i] - mean1;
      const diff2 = prices2[i] - mean2;
      numerator += diff1 * diff2;
      sum1Sq += diff1 * diff1;
      sum2Sq += diff2 * diff2;
    }

    const denominator = Math.sqrt(sum1Sq * sum2Sq);
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Create shadow trade
   */
  async createShadowTrade(
    userId: string,
    trade: Omit<ShadowTrade, 'id' | 'userId' | 'status' | 'enteredAt'>
  ): Promise<ShadowTrade> {
    const executedTrade = await prisma.executedTrade.create({
      data: {
        userId,
        symbol: trade.symbol,
        direction: trade.direction,
        entryPrice: trade.entryPrice,
        quantity: trade.quantity,
        leverage: trade.leverage || 1,
        notes: trade.notes,
      },
    });

    return {
      id: executedTrade.id,
      userId,
      symbol: trade.symbol,
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      quantity: trade.quantity,
      leverage: trade.leverage || 1,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      status: 'ACTIVE',
      enteredAt: executedTrade.enteredAt,
      notes: trade.notes,
    };
  }

  /**
   * Close shadow trade
   */
  async closeShadowTrade(
    tradeId: string,
    exitPrice: number
  ): Promise<ShadowTrade> {
    const trade = await prisma.executedTrade.findUnique({
      where: { id: tradeId },
    });

    if (!trade) {
      throw new Error('Trade not found');
    }

    const entryPrice = Number(trade.entryPrice);
    let pnl: number;

    if (trade.direction === 'LONG') {
      pnl = ((exitPrice - entryPrice) / entryPrice) * Number(trade.quantity);
    } else {
      pnl = ((entryPrice - exitPrice) / entryPrice) * Number(trade.quantity);
    }

    const pnlPercent = (pnl / Number(trade.quantity)) * 100;

    await prisma.executedTrade.update({
      where: { id: tradeId },
      data: {
        exitPrice,
        exitedAt: new Date(),
        pnl,
        pnlPercent,
      },
    });

    return {
      id: trade.id,
      userId: trade.userId,
      symbol: trade.symbol,
      direction: trade.direction,
      entryPrice,
      quantity: Number(trade.quantity),
      leverage: trade.leverage || 1,
      status: 'CLOSED',
      enteredAt: trade.enteredAt,
      exitedAt: new Date(),
      exitPrice,
      pnl,
      notes: trade.notes || undefined,
    };
  }

  /**
   * Get active shadow trades
   */
  async getActiveShadowTrades(userId: string): Promise<ShadowTrade[]> {
    const trades = await prisma.executedTrade.findMany({
      where: {
        userId,
        exitedAt: null,
      },
      orderBy: { enteredAt: 'desc' },
    });

    return trades.map(t => ({
      id: t.id,
      userId: t.userId,
      symbol: t.symbol,
      direction: t.direction,
      entryPrice: Number(t.entryPrice),
      quantity: Number(t.quantity),
      leverage: t.leverage || 1,
      status: 'ACTIVE' as const,
      enteredAt: t.enteredAt,
      notes: t.notes || undefined,
    }));
  }

  /**
   * Get portfolio performance summary
   */
  async getPerformanceSummary(userId: string): Promise<{
    totalTrades: number;
    winRate: number;
    avgPnl: number;
    totalPnl: number;
    bestTrade: number;
    worstTrade: number;
    avgHoldTime: number;
  }> {
    const trades = await prisma.executedTrade.findMany({
      where: {
        userId,
        exitedAt: { not: null },
      },
    });

    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        avgPnl: 0,
        totalPnl: 0,
        bestTrade: 0,
        worstTrade: 0,
        avgHoldTime: 0,
      };
    }

    const winners = trades.filter(t => Number(t.pnl || 0) > 0);
    const totalPnl = trades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
    const avgPnl = totalPnl / trades.length;
    const bestTrade = Math.max(...trades.map(t => Number(t.pnl || 0)));
    const worstTrade = Math.min(...trades.map(t => Number(t.pnl || 0)));

    const avgHoldTime = trades.reduce((sum, t) => {
      if (!t.exitedAt) return sum;
      return sum + (t.exitedAt.getTime() - t.enteredAt.getTime());
    }, 0) / trades.length / (1000 * 60 * 60); // Convert to hours

    return {
      totalTrades: trades.length,
      winRate: (winners.length / trades.length) * 100,
      avgPnl,
      totalPnl,
      bestTrade,
      worstTrade,
      avgHoldTime,
    };
  }

  /**
   * Check if position aligns with setup
   */
  async validatePositionWithSetup(
    position: Position,
    setupId: string
  ): Promise<{
    valid: boolean;
    warnings: string[];
  }> {
    const setup = await prisma.setup.findUnique({
      where: { id: setupId },
    });

    if (!setup) {
      return { valid: false, warnings: ['Setup not found'] };
    }

    const warnings: string[] = [];

    // Check direction
    if (position.side !== setup.direction) {
      warnings.push(`Position is ${position.side} but setup calls for ${setup.direction}`);
    }

    // Check entry price
    const entryDiff = Math.abs(position.entryPrice - Number(setup.entry)) / Number(setup.entry);
    if (entryDiff > 0.02) {
      warnings.push(`Entry price ${entryDiff.toFixed(1)}% away from setup entry`);
    }

    // Check regime
    const candles = await priceService.getCandles(position.symbol, '1h', 100);
    const regime = regimeDetector.detectRegime(candles);
    
    if (regime.regime === 'CHOP') {
      warnings.push('Market is choppy - consider tightening stops');
    }

    return {
      valid: warnings.length === 0,
      warnings,
    };
  }
}

export const portfolioService = new PortfolioService();

