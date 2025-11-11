// tRPC client setup
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink, loggerLink } from '@trpc/client';
import type { AppRouter } from '@/server/routers/_app';
import superjson from 'superjson';

export const trpc = createTRPCReact<AppRouter>();

export function getTRPCUrl() {
  if (typeof window !== 'undefined') {
    // browser should use relative path
    return '/api/trpc';
  }

  if (process.env.VERCEL_URL) {
    // reference for vercel.com
    return `https://${process.env.VERCEL_URL}/api/trpc`;
  }

  // assume localhost
  return `http://localhost:${process.env.PORT ?? 3000}/api/trpc`;
}

export function getTRPCClient() {
  return trpc.createClient({
    transformer: superjson,
    links: [
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === 'development' ||
          (opts.direction === 'down' && opts.result instanceof Error),
      }),
      httpBatchLink({
        url: getTRPCUrl(),
      }),
    ],
  });
}

