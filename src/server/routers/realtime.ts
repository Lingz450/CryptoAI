// Real-time data router using WebSockets
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { observable } from '@trpc/server/observable';
import { wsManager } from '@/lib/exchanges/websocket';
import type { Ticker } from '@/lib/exchanges/types';

export const realtimeRouter = createTRPCRouter({
  /**
   * Subscribe to real-time ticker updates for a symbol
   */
  subscribeTicker: publicProcedure
    .input(z.object({ symbol: z.string() }))
    .subscription(({ input }) => {
      return observable<Ticker>((emit) => {
        // Callback for ticker updates
        const callback = (ticker: Ticker) => {
          emit.next(ticker);
        };

        // Subscribe to aggregated ticker from all exchanges
        wsManager.subscribeAggregated(input.symbol, callback);

        // Cleanup on unsubscribe
        return () => {
          wsManager.unsubscribeAggregated(input.symbol, callback);
        };
      });
    }),

  /**
   * Subscribe to multiple tickers at once
   */
  subscribeMultiple: publicProcedure
    .input(z.object({ symbols: z.array(z.string()) }))
    .subscription(({ input }) => {
      return observable<{ symbol: string; ticker: Ticker }>((emit) => {
        const callbacks: Array<{ symbol: string; callback: (ticker: Ticker) => void }> = [];

        // Subscribe to each symbol
        input.symbols.forEach((symbol) => {
          const callback = (ticker: Ticker) => {
            emit.next({ symbol, ticker });
          };

          wsManager.subscribeAggregated(symbol, callback);
          callbacks.push({ symbol, callback });
        });

        // Cleanup on unsubscribe
        return () => {
          callbacks.forEach(({ symbol, callback }) => {
            wsManager.unsubscribeAggregated(symbol, callback);
          });
        };
      });
    }),
});

