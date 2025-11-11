// React hook for real-time ticker data using Server-Sent Events
import { useEffect, useState, useRef } from 'react';
import type { Ticker } from '@/lib/exchanges/types';

interface UseRealtimeTickerOptions {
  symbol: string;
  enabled?: boolean;
}

export function useRealtimeTicker({ symbol, enabled = true }: UseRealtimeTickerOptions) {
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled || !symbol) {
      return;
    }

    console.log(`📡 Connecting to real-time ticker: ${symbol}`);

    // Create EventSource connection
    const eventSource = new EventSource(`/api/realtime/${symbol}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log(`✅ Connected to ${symbol} real-time stream`);
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'ticker' && message.data) {
          setTicker(message.data);
        } else if (message.type === 'connected') {
          console.log(`🔗 Stream connected for ${message.symbol}`);
        }
      } catch (err) {
        console.error('Error parsing ticker data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error(`❌ Real-time stream error for ${symbol}:`, err);
      setIsConnected(false);
      setError('Connection lost. Reconnecting...');

      // EventSource automatically reconnects, so we don't need to manually reconnect
    };

    // Cleanup on unmount
    return () => {
      console.log(`🔌 Disconnecting from ${symbol} real-time stream`);
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [symbol, enabled]);

  return { ticker, isConnected, error };
}

