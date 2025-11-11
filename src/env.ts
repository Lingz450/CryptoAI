import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']),
    DATABASE_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string(),
    NEXTAUTH_URL: z.string().url().optional(),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    DEFAULT_EXCHANGE: z.enum(['binance', 'bybit', 'okx']).default('binance'),
    ADMIN_TELEGRAM_IDS: z
      .string()
      .optional()
      .transform((val) =>
        val ? val.split(',').map((id) => id.trim()).filter(Boolean) : []
      ),
    ALERT_CHECK_INTERVAL: z.coerce.number().int().min(1_000).default(60_000),
    MARKET_PULSE_INTERVAL: z.coerce.number().int().min(1_000).default(180_000),
    UNIVERSE_LIMIT: z.coerce.number().int().min(10).max(500).default(100),
    REDIS_URL: z.string().url().optional(),
    BINANCE_API_KEY: z.string().optional(),
    BINANCE_SECRET_KEY: z.string().optional(),
    BYBIT_API_KEY: z.string().optional(),
    BYBIT_SECRET_KEY: z.string().optional(),
    OKX_API_KEY: z.string().optional(),
    OKX_SECRET_KEY: z.string().optional(),
    OKX_PASSPHRASE: z.string().optional(),
    REFERRAL_CODE: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().optional(),
    FEATURE_FLAGS: z
      .string()
      .optional()
      .transform((val) =>
        val ? val.split(',').map((flag) => flag.trim()).filter(Boolean) : []
      ),
    VERCEL_URL: z.string().optional(),
    PORT: z.coerce.number().int().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_ENV: z
      .enum(['development', 'production', 'staging'])
      .optional(),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_REFERRAL_CODE: z.string().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    DEFAULT_EXCHANGE: process.env.DEFAULT_EXCHANGE,
    ADMIN_TELEGRAM_IDS: process.env.ADMIN_TELEGRAM_IDS,
    ALERT_CHECK_INTERVAL: process.env.ALERT_CHECK_INTERVAL,
    MARKET_PULSE_INTERVAL: process.env.MARKET_PULSE_INTERVAL,
    UNIVERSE_LIMIT: process.env.UNIVERSE_LIMIT,
    REDIS_URL: process.env.REDIS_URL,
    BINANCE_API_KEY: process.env.BINANCE_API_KEY,
    BINANCE_SECRET_KEY: process.env.BINANCE_SECRET_KEY,
    BYBIT_API_KEY: process.env.BYBIT_API_KEY,
    BYBIT_SECRET_KEY: process.env.BYBIT_SECRET_KEY,
    OKX_API_KEY: process.env.OKX_API_KEY,
    OKX_SECRET_KEY: process.env.OKX_SECRET_KEY,
    OKX_PASSPHRASE: process.env.OKX_PASSPHRASE,
    REFERRAL_CODE: process.env.REFERRAL_CODE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    FEATURE_FLAGS: process.env.FEATURE_FLAGS,
    VERCEL_URL: process.env.VERCEL_URL,
    PORT: process.env.PORT,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_REFERRAL_CODE: process.env.NEXT_PUBLIC_REFERRAL_CODE,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION &&
    process.env.SKIP_ENV_VALIDATION !== 'false',
  emptyStringAsUndefined: true,
});

export type FeatureFlag = (typeof env.FEATURE_FLAGS)[number];
