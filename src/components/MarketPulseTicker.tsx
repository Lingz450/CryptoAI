'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
import { formatPrice, formatPercent, getChangeColor } from '@/lib/utils';

const MAJOR_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB'];

export function MarketPulseTicker() {
  const [tickers, setTickers] = useState<any[]>([]);
  const [liveConnections, setLiveConnections] = useState<Set<string>>(new Set());

  // Initial load from REST API
  const { data } = trpc.market.getMultipleTickers.useQuery({
    symbols: MAJOR_SYMBOLS,
  });

  useEffect(() => {
    if (data) {
      setTickers(data);
    }
  }, [data]);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    const eventSources: EventSource[] = [];
    const connected = new Set<string>();

    MAJOR_SYMBOLS.forEach((symbol) => {
      try {
        const es = new EventSource(`/api/realtime/${symbol}`);

        es.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'ticker' && message.data) {
              // Update ticker in state
              setTickers((prev) => {
                const index = prev.findIndex((t) => t.symbol === message.data.symbol || t.symbol === `${symbol}USDT`);
                if (index >= 0) {
                  const updated = [...prev];
                  updated[index] = message.data;
                  return updated;
                } else {
                  return [...prev, message.data];
                }
              });
              connected.add(symbol);
              setLiveConnections(new Set(connected));
            }
          } catch (err) {
            console.error('Error parsing ticker:', err);
          }
        };

        es.onerror = () => {
          connected.delete(symbol);
          setLiveConnections(new Set(connected));
        };

        eventSources.push(es);
      } catch (error) {
        console.error(`Failed to connect to ${symbol}:`, error);
      }
    });

    return () => {
      eventSources.forEach((es) => es.close());
      setLiveConnections(new Set());
    };
  }, []);

  if (!tickers.length) {
    return (
      <div className="bg-card border-b border-border py-3">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-8">
            {MAJOR_SYMBOLS.map((symbol) => (
              <div key={symbol} className="flex items-center gap-2 animate-pulse">
                <span className="font-bold text-sm">{symbol}</span>
                <span className="w-20 h-4 bg-muted rounded"></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border-b border-border py-3 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-8 overflow-x-auto scrollbar-hide">
          {tickers.map((ticker) => {
            const symbol = ticker.symbol.replace('USDT', '').replace('BUSD', '');
            const isLive = liveConnections.has(symbol);
            
            return (
              <div
                key={ticker.symbol}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                <span className="font-bold text-sm flex items-center gap-1">
                  {isLive && (
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Live" />
                  )}
                  {symbol}
                </span>
                <span className="font-mono text-sm">
                  ${formatPrice(ticker.price)}
                </span>
                <span
                  className={`text-xs font-semibold ${getChangeColor(
                    ticker.changePercent24h
                  )}`}
                >
                  {formatPercent(ticker.changePercent24h, 2)}
                </span>
              </div>
            );
          })}
          
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Real-time · {liveConnections.size}/{MAJOR_SYMBOLS.length} connected
          </span>
        </div>
      </div>
    </div>
  );
}

