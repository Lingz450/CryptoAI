// Main tRPC router
import { createTRPCRouter } from '../trpc';
import { marketRouter } from './market';
import { alertsRouter } from './alerts';
import { aiRouter } from './ai';
import { watchlistRouter } from './watchlist';
import { screenersRouter } from './screeners';
import { setupsRouter } from './setups';
import { realtimeRouter } from './realtime';
import { roomsRouter } from './rooms';
import { backtestRouter } from './backtest';

export const appRouter = createTRPCRouter({
  market: marketRouter,
  ai: aiRouter,
  alerts: alertsRouter,
  watchlist: watchlistRouter,
  screeners: screenersRouter,
  setups: setupsRouter,
  realtime: realtimeRouter,
  rooms: roomsRouter,
  backtest: backtestRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;

