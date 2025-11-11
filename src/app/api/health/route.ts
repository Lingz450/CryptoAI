import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; details?: string }> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = { status: 'ok' };
  } catch (error) {
    logger.error({ error }, 'Health check: database failed');
    checks.db = { status: 'error', details: 'Database unreachable' };
  }

  if (redis) {
    try {
      await redis.ping();
      checks.redis = { status: 'ok' };
    } catch (error) {
      logger.error({ error }, 'Health check: redis failed');
      checks.redis = { status: 'error', details: 'Redis unavailable' };
    }
  } else {
    checks.redis = { status: 'error', details: 'Redis not configured' };
  }

  const healthy = Object.values(checks).every((check) => check.status === 'ok');

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      checks,
      uptime: process.uptime(),
    },
    { status: healthy ? 200 : 503 }
  );
}
