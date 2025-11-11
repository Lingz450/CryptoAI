// Server-Sent Events endpoint for real-time ticker data
import { NextRequest } from 'next/server';
import { wsManager } from '@/lib/exchanges/websocket';
import type { Ticker } from '@/lib/exchanges/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol;

  // Create a ReadableStream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', symbol })}\n\n`));

      // Callback for ticker updates
      const callback = (ticker: Ticker) => {
        try {
          const data = JSON.stringify({ type: 'ticker', data: ticker });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (error) {
          console.error('Error sending ticker update:', error);
        }
      };

      // Subscribe to ticker updates
      wsManager.subscribeAggregated(symbol, callback);

      // Store callback for cleanup
      (request as any)._tickerCallback = callback;

      // Heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (error) {
          clearInterval(heartbeatInterval);
        }
      }, 30000); // Every 30 seconds

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        wsManager.unsubscribeAggregated(symbol, callback);
        try {
          controller.close();
        } catch (e) {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

