// Enhanced Rooms service with setup cards and leaderboards
import { prisma } from '@/lib/prisma';
import type { Setup, User } from '@prisma/client';

export interface SetupCard {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  riskReward: number;
  confidence: number;
  reasoning: string;
  imageUrl?: string;
  analyst: {
    id: string;
    name: string;
    image?: string;
  };
  shareUrl: string;
  createdAt: Date;
  status: 'ACTIVE' | 'HIT_TP' | 'HIT_SL' | 'CANCELLED';
  pnl?: number;
  auditTrail: Array<{
    action: string;
    timestamp: Date;
    user: string;
  }>;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  userImage?: string;
  stats: {
    totalSetups: number;
    winRate: number;
    avgRiskReward: number;
    totalPnl: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
  rank: number;
  badge?: 'GOLD' | 'SILVER' | 'BRONZE';
}

export interface SeasonalLeaderboard {
  season: string;
  startDate: Date;
  endDate: Date;
  entries: LeaderboardEntry[];
}

export class RoomsService {
  /**
   * Create shareable setup card
   */
  async createSetupCard(
    roomId: string,
    userId: string,
    setup: Omit<Setup, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<SetupCard> {
    // Generate unique share token
    const shareToken = this.generateShareToken();

    const created = await prisma.setup.create({
      data: {
        ...setup,
        userId,
        shareToken,
        isPublic: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Create audit trail entry
    await this.logSetupAction(created.id, userId, 'CREATED');

    const shareUrl = `${process.env.NEXT_PUBLIC_URL}/setup/${shareToken}`;

    return {
      id: created.id,
      symbol: created.symbol,
      direction: created.direction,
      entry: Number(created.entry),
      stopLoss: Number(created.stopLoss),
      takeProfit1: Number(created.takeProfit1) || 0,
      riskReward: Number(created.riskReward) || 0,
      confidence: created.confidence || 70,
      reasoning: created.reasoning || '',
      imageUrl: created.imageUrl || undefined,
      analyst: {
        id: created.user.id,
        name: created.user.name || 'Anonymous',
        image: created.user.image || undefined,
      },
      shareUrl,
      createdAt: created.createdAt,
      status: created.status as any,
      pnl: created.pnl ? Number(created.pnl) : undefined,
      auditTrail: [
        {
          action: 'Created setup',
          timestamp: created.createdAt,
          user: created.user.name || 'Anonymous',
        },
      ],
    };
  }

  /**
   * Get setup card by share token
   */
  async getSetupCard(shareToken: string): Promise<SetupCard | null> {
    const setup = await prisma.setup.findUnique({
      where: { shareToken },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    if (!setup) return null;

    // Increment view count
    await prisma.setup.update({
      where: { id: setup.id },
      data: { viewCount: { increment: 1 } },
    });

    // Get audit trail
    const auditTrail = await this.getSetupAuditTrail(setup.id);

    const shareUrl = `${process.env.NEXT_PUBLIC_URL}/setup/${shareToken}`;

    return {
      id: setup.id,
      symbol: setup.symbol,
      direction: setup.direction,
      entry: Number(setup.entry),
      stopLoss: Number(setup.stopLoss),
      takeProfit1: Number(setup.takeProfit1) || 0,
      riskReward: Number(setup.riskReward) || 0,
      confidence: setup.confidence || 70,
      reasoning: setup.reasoning || '',
      imageUrl: setup.imageUrl || undefined,
      analyst: {
        id: setup.user.id,
        name: setup.user.name || 'Anonymous',
        image: setup.user.image || undefined,
      },
      shareUrl,
      createdAt: setup.createdAt,
      status: setup.status as any,
      pnl: setup.pnl ? Number(setup.pnl) : undefined,
      auditTrail,
    };
  }

  /**
   * Clone setup card
   */
  async cloneSetupCard(
    shareToken: string,
    userId: string
  ): Promise<SetupCard> {
    const original = await prisma.setup.findUnique({
      where: { shareToken },
    });

    if (!original) {
      throw new Error('Setup not found');
    }

    // Increment clone count
    await prisma.setup.update({
      where: { id: original.id },
      data: { cloneCount: { increment: 1 } },
    });

    // Create cloned setup
    const cloned = await prisma.setup.create({
      data: {
        userId,
        symbol: original.symbol,
        direction: original.direction,
        entry: original.entry,
        stopLoss: original.stopLoss,
        takeProfit1: original.takeProfit1,
        takeProfit2: original.takeProfit2,
        takeProfit3: original.takeProfit3,
        leverage: original.leverage,
        riskReward: original.riskReward,
        confidence: original.confidence,
        reasoning: `Cloned from setup by ${original.userId}`,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return this.getSetupCard(shareToken) as Promise<SetupCard>;
  }

  /**
   * Generate seasonal leaderboard
   */
  async getSeasonalLeaderboard(
    roomId: string,
    season?: string
  ): Promise<SeasonalLeaderboard> {
    // Define season dates
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

    const seasonName = season || `Q${currentQuarter} ${currentYear}`;
    const startDate = new Date(currentYear, (currentQuarter - 1) * 3, 1);
    const endDate = new Date(currentYear, currentQuarter * 3, 0);

    // Get all setups in this season for this room
    const setups = await prisma.setup.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: true,
      },
    });

    // Group by user
    const userStats = new Map<string, {
      user: User;
      setups: Setup[];
    }>();

    for (const setup of setups) {
      if (!userStats.has(setup.userId)) {
        userStats.set(setup.userId, {
          user: setup.user,
          setups: [],
        });
      }
      userStats.get(setup.userId)!.setups.push(setup);
    }

    // Calculate stats for each user
    const entries: LeaderboardEntry[] = [];

    for (const [userId, { user, setups }] of userStats.entries()) {
      const closedSetups = setups.filter(s => s.status !== 'ACTIVE');
      const winners = closedSetups.filter(s => s.status === 'HIT_TP');
      const losers = closedSetups.filter(s => s.status === 'HIT_SL');

      const winRate = closedSetups.length > 0 
        ? (winners.length / closedSetups.length) * 100 
        : 0;

      const avgRR = setups.reduce((sum, s) => sum + Number(s.riskReward || 0), 0) / setups.length;

      const totalPnl = closedSetups.reduce((sum, s) => sum + Number(s.pnl || 0), 0);

      // Calculate max drawdown
      let peak = 0;
      let maxDrawdown = 0;
      let runningPnl = 0;

      for (const setup of closedSetups) {
        runningPnl += Number(setup.pnl || 0);
        if (runningPnl > peak) peak = runningPnl;
        const drawdown = peak - runningPnl;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }

      // Calculate Sharpe ratio (simplified)
      const returns = closedSetups.map(s => Number(s.pnl || 0));
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const stdDev = Math.sqrt(
        returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      );
      const sharpeRatio = stdDev > 0 ? (avgReturn * Math.sqrt(252)) / stdDev : 0;

      entries.push({
        userId: user.id,
        userName: user.name || 'Anonymous',
        userImage: user.image || undefined,
        stats: {
          totalSetups: setups.length,
          winRate,
          avgRiskReward: avgRR,
          totalPnl,
          maxDrawdown,
          sharpeRatio,
        },
        rank: 0, // Will be set after sorting
      });
    }

    // Sort by composite score (Sharpe * Win Rate * Avg R:R)
    entries.sort((a, b) => {
      const scoreA = a.stats.sharpeRatio * a.stats.winRate * a.stats.avgRiskReward;
      const scoreB = b.stats.sharpeRatio * b.stats.winRate * b.stats.avgRiskReward;
      return scoreB - scoreA;
    });

    // Assign ranks and badges
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
      if (index === 0) entry.badge = 'GOLD';
      else if (index === 1) entry.badge = 'SILVER';
      else if (index === 2) entry.badge = 'BRONZE';
    });

    return {
      season: seasonName,
      startDate,
      endDate,
      entries,
    };
  }

  /**
   * Log setup action for audit trail
   */
  private async logSetupAction(
    setupId: string,
    userId: string,
    action: string
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resource: 'setup',
        resourceId: setupId,
        metadata: {
          setupId,
          action,
        },
      },
    });
  }

  /**
   * Get audit trail for setup
   */
  private async getSetupAuditTrail(setupId: string): Promise<SetupCard['auditTrail']> {
    const logs = await prisma.auditLog.findMany({
      where: {
        resource: 'setup',
        resourceId: setupId,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return logs.map(log => ({
      action: log.action,
      timestamp: log.createdAt,
      user: log.user?.name || 'System',
    }));
  }

  /**
   * Generate unique share token
   */
  private generateShareToken(): string {
    return `setup_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

export const roomsService = new RoomsService();

