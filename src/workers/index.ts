// Background workers entry point
import { Worker, Queue } from 'bullmq';
import { env } from '@/env';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { alertService } from '@/lib/services/alertService';
import { priceService } from '@/lib/services/priceService';
import { derivativesService } from '@/lib/services/derivativesService';
import { runScreenerScan, type ScreenerFilterConfig } from '@/lib/services/screenerRunner';
import { compileWeeklyDigest, sendWeeklyDigest } from '@/lib/services/growthDigestService';
import { logger } from '@/lib/logger';
import type { ScreenerType, Screener } from '@prisma/client';

if (!redis) {
  logger.error('Redis is required for workers');
  process.exit(1);
}

const connection = {
  host: env.REDIS_URL ? new URL(env.REDIS_URL).hostname : 'localhost',
  port: env.REDIS_URL ? Number(new URL(env.REDIS_URL).port || '6379') : 6379,
};

// ============================================
// ALERT WORKER
// ============================================

const alertQueue = new Queue('alerts', { connection });

const alertWorker = new Worker(
  'alerts',
  async () => {
    logger.info('Checking alerts...');
    try {
      const results = await alertService.checkAllAlerts();
      const triggered = results.filter((r) => r.triggered);

      if (triggered.length > 0) {
        logger.info('Triggered %d alert(s)', triggered.length);
      }

      return { checked: results.length, triggered: triggered.length };
    } catch (error) {
      logger.error({ error }, 'Alert worker error');
      throw error;
    }
  },
  { connection }
);

alertWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, result: job.returnvalue }, 'Alert job completed');
});

alertWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Alert job failed');
});

// Schedule alert checks every minute
async function scheduleAlertChecks() {
  await alertQueue.add(
    'check-alerts',
    {},
    {
      repeat: {
        every: parseInt(process.env.ALERT_CHECK_INTERVAL || '60000'),
      },
    }
  );
  logger.info('Alert worker scheduled');
}

// ============================================
// MARKET PULSE WORKER
// ============================================

const pulseQueue = new Queue('market-pulse', { connection });

const pulseWorker = new Worker(
  'market-pulse',
  async () => {
    logger.info('Updating market pulse...');
    try {
      const symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC'];
      const tickers = await priceService.getMultipleTickers(symbols);
      
      // Store in Redis for quick access
      for (const [symbol, ticker] of tickers.entries()) {
        await redis!.setex(
          `pulse:${symbol}`,
          300, // 5 minutes
          JSON.stringify(ticker)
        );
      }
      
      return { updated: tickers.size };
    } catch (error) {
      logger.error({ error }, 'Market pulse error');
      throw error;
    }
  },
  { connection }
);

pulseWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Market pulse job completed');
});

pulseWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Market pulse job failed');
});

// Schedule market pulse updates every 3 minutes
async function scheduleMarketPulse() {
  await pulseQueue.add(
    'update-pulse',
    {},
    {
      repeat: {
        every: parseInt(process.env.MARKET_PULSE_INTERVAL || '180000'),
      },
    }
  );
  logger.info('Market pulse worker scheduled');
}

// ============================================
// TOP 100 REFRESH WORKER
// ============================================

const universeQueue = new Queue('universe', { connection });

const universeWorker = new Worker(
  'universe',
  async () => {
    logger.info('Refreshing top 100 universe...');
    try {
      const tickers = await priceService.getAllTickers();
      
      // Sort by volume and take top 100
      const top100 = tickers
        .filter(t => t.volumeQuote24h > 1000000)
        .sort((a, b) => b.volumeQuote24h - a.volumeQuote24h)
        .slice(0, parseInt(process.env.UNIVERSE_LIMIT || '100'));
      
      // Store in Redis
      await redis!.setex(
        'universe:top100',
        3600, // 1 hour
        JSON.stringify(top100.map(t => t.symbol))
      );
      
      return { count: top100.length };
    } catch (error) {
      logger.error({ error }, 'Universe refresh error');
      throw error;
    }
  },
  { connection }
);

universeWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, result: job.returnvalue }, 'Universe job completed');
});

universeWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Universe job failed');
});

// Schedule universe refresh every 30 minutes
async function scheduleUniverseRefresh() {
  await universeQueue.add(
    'refresh-universe',
    {},
    {
      repeat: {
        every: 1800000, // 30 minutes
      },
    }
  );
  logger.info('Universe refresh worker scheduled');
}

// ============================================
// SCREENER DIGEST WORKER
// ============================================

const screenerDigestQueue = new Queue('screener-digests', { connection });

const scheduleMinutes: Record<string, number> = {
  HOURLY: 60,
  DAILY: 60 * 24,
};

const screenerDigestWorker = new Worker(
  'screener-digests',
  async () => {
    logger.info('Running scheduled screeners...');
    try {
      const now = new Date();
      const screeners = await prisma.screener.findMany({
        where: {
          enabled: true,
          schedule: { in: ['HOURLY', 'DAILY'] },
        },
      });

      let processed = 0;

      for (const screener of screeners) {
        const scheduleKey = screener.schedule as keyof typeof scheduleMinutes;
        const intervalMinutes = scheduleMinutes[scheduleKey] ?? 60;
        const due =
          !screener.lastRun ||
          now.getTime() - screener.lastRun.getTime() >= intervalMinutes * 60 * 1000;

        if (!due) continue;

        const filters = (screener.filters as ScreenerFilterConfig) || {};
        const limit = filters.limit ?? 20;

        const results = await runScreenerScan({
          type: screener.type as ScreenerType,
          limit,
          filters,
        });

        await prisma.screenerRun.create({
          data: {
            screenerId: screener.id,
            results,
            resultCount: results.length,
          },
        });

        await prisma.screener.update({
          where: { id: screener.id },
          data: { lastRun: now },
        });

        processed += 1;
        logger.info(
          { screenerId: screener.id, matches: results.length },
          'Screener digest ready'
        );
      }

      return { processed };
    } catch (error) {
      logger.error({ error }, 'Screener digest error');
      throw error;
    }
  },
  { connection }
);

screenerDigestWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, result: job.returnvalue }, 'Screener digest job completed');
});

screenerDigestWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Screener digest job failed');
});

async function scheduleScreenerDigests() {
  await screenerDigestQueue.add(
    'run-saved-screeners',
    {},
    {
      repeat: {
        every: 15 * 60 * 1000,
      },
    }
  );
  logger.info('Screener digest worker scheduled');
}

// ============================================
// GROWTH DIGEST WORKER
// ============================================

const growthDigestQueue = new Queue('growth-digest', { connection });

const growthDigestWorker = new Worker(
  'growth-digest',
  async () => {
    logger.info('Compiling weekly market digest...');
    const digest = await compileWeeklyDigest();
    await sendWeeklyDigest(digest);
    return { delivered: true };
  },
  { connection }
);

growthDigestWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Weekly digest job completed');
});

growthDigestWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Weekly digest job failed');
});

async function scheduleGrowthDigest() {
  await growthDigestQueue.add(
    'weekly-digest',
    {},
    {
      repeat: {
        every: 7 * 24 * 60 * 60 * 1000,
      },
    }
  );
  console.log('Growth digest worker scheduled');
}

// ============================================
// DERIVATIVES DATA WORKER
// ============================================

const derivativesQueue = new Queue('derivatives', { connection });

const derivativesWorker = new Worker(
  'derivatives',
  async () => {
    logger.info('Refreshing derivatives data...');
    try {
      // Get top coins from universe
      const universeData = await redis!.get('universe:top100');
      const symbols = universeData ? JSON.parse(universeData) : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
      
      let updated = 0;
      const errors: string[] = [];
      
      // Fetch derivatives data for each symbol with jitter to avoid rate limits
      for (const symbol of symbols) {
        try {
          // Add random jitter (0-200ms) to avoid hitting rate limits
          await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
          
          const data = await derivativesService.get(symbol);
          
          // Store in Redis with metadata
          const cacheKey = `derivatives:binance:${symbol}`;
          await redis!.setex(cacheKey, 300, JSON.stringify(data)); // 5 min TTL
          
          // Also store historical data point for sparklines
          const historyKey = `derivatives:history:${symbol}`;
          const history = await redis!.lrange(historyKey, 0, 19); // Get last 20 points
          await redis!.lpush(
            historyKey,
            JSON.stringify({
              oi: data.openInterest,
              funding: data.fundingRate,
              cvd: data.cumulativeVolumeDelta,
              lsr: data.longShortRatio,
              timestamp: data.timestamp,
            })
          );
          await redis!.ltrim(historyKey, 0, 19); // Keep only last 20 points
          await redis!.expire(historyKey, 3600); // 1 hour TTL
          
          updated++;
        } catch (error: any) {
          errors.push(`${symbol}: ${error.message}`);
        }
      }
      
      if (errors.length > 0 && errors.length < symbols.length) {
        logger.warn({ errors: errors.slice(0, 5) }, 'Some derivatives updates failed');
      }
      
      return { updated, failed: errors.length };
    } catch (error) {
      logger.error({ error }, 'Derivatives worker error');
      throw error;
    }
  },
  { connection, limiter: { max: 5, duration: 1000 } } // Rate limit: 5 jobs per second
);

derivativesWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, result: job.returnvalue }, 'Derivatives job completed');
});

derivativesWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Derivatives job failed');
});

// Schedule derivatives refresh every 5 minutes
async function scheduleDerivativesRefresh() {
  await derivativesQueue.add(
    'refresh-derivatives',
    {},
    {
      repeat: {
        every: parseInt(process.env.DERIVATIVES_REFRESH_INTERVAL || '300000'), // 5 minutes
      },
    }
  );
  logger.info('Derivatives worker scheduled');
}

// ============================================
// START ALL WORKERS
// ============================================

async function startWorkers() {
  logger.info('Starting GhostFX workers...');

  try {
    await scheduleAlertChecks();
    await scheduleMarketPulse();
    await scheduleUniverseRefresh();
    await scheduleScreenerDigests();
    await scheduleGrowthDigest();
    await scheduleDerivativesRefresh();

    logger.info('All workers started successfully');
    logger.info('Workers running. Press Ctrl+C to stop.');
  } catch (error) {
    logger.error({ error }, 'Failed to start workers');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down workers...');
  await alertWorker.close();
  await pulseWorker.close();
  await universeWorker.close();
  await screenerDigestWorker.close();
  await growthDigestWorker.close();
  await derivativesWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down workers...');
  await alertWorker.close();
  await pulseWorker.close();
  await universeWorker.close();
  await screenerDigestWorker.close();
  await growthDigestWorker.close();
  await derivativesWorker.close();
  process.exit(0);
});

// Start workers if this file is run directly
if (require.main === module) {
  startWorkers().catch((error) => {
  logger.error({ error }, 'Worker startup error');
    process.exit(1);
  });
}

export { alertQueue, pulseQueue, universeQueue, screenerDigestQueue, derivativesQueue };

