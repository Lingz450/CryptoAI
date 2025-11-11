import { priceService } from '@/lib/services/priceService';
import { runScreenerScan } from '@/lib/services/screenerRunner';
import { prisma } from '@/lib/prisma';
import { formatPercent } from '@/lib/utils';

export type GrowthDigest = {
  topMovers: { symbol: string; change: number; price: number }[];
  atrBreakouts: { symbol: string; atr: number; change: number }[];
  watchlistHighlights: { userId: string; symbol: string }[];
};

export async function compileWeeklyDigest(): Promise<GrowthDigest> {
  const movers = await priceService.getTopMovers(5);
  const atrResults = await runScreenerScan({
    type: 'ATR_BREAKOUT',
    limit: 5,
  });
  const watchlists = await prisma.watchlistItem.findMany({
    orderBy: { addedAt: 'desc' },
    take: 5,
    include: { user: { select: { id: true } } },
  });

  return {
    topMovers: [
      ...movers.gainers.slice(0, 3),
      ...movers.losers.slice(0, 2),
    ].map((coin) => ({
      symbol: coin.symbol,
      change: coin.changePercent24h,
      price: coin.price,
    })),
    atrBreakouts: atrResults.map((entry) => ({
      symbol: entry.symbol,
      atr: entry.atr ?? 0,
      change: entry.priceChange24h,
    })),
    watchlistHighlights: watchlists.map((item) => ({
      userId: item.userId,
      symbol: item.symbol,
    })),
  };
}

export async function sendWeeklyDigest(digest: GrowthDigest) {
  const lines = [
    'GhostFX Weekly Market Pulse',
    '',
    'Top movers:',
    ...digest.topMovers.map((coin) => `${coin.symbol}: ${formatPercent(coin.change)} @ $${coin.price.toFixed(2)}`),
    '',
    'ATR breakouts:',
    ...digest.atrBreakouts.map((entry) => `${entry.symbol}: ATR ${entry.atr.toFixed(2)}, change ${formatPercent(entry.change)}`),
    '',
    'Latest watchlist additions:',
    ...digest.watchlistHighlights.map((item) => `${item.symbol} (added by ${item.userId})`),
    '',
    'Made with GhostFX',
  ];

  console.log(lines.join('\n'));
  // TODO: wire to email/Telegram/push provider
}
