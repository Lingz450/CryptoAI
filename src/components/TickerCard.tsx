'use client';

import { Card } from '@/components/ui/card';
import { formatPrice, formatPercent, getChangeColor, getChangeBgColor } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { type Ticker } from '@/lib/exchanges/types';

interface TickerCardProps {
  ticker: Ticker;
  onClick?: () => void;
}

export function TickerCard({ ticker, onClick }: TickerCardProps) {
  const isPositive = ticker.changePercent24h >= 0;

  return (
    <Card
      className={`p-4 cursor-pointer transition-all hover:border-primary/50 ${
        onClick ? 'hover:shadow-lg hover:shadow-primary/10' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold">{ticker.symbol.replace('USDT', '')}</h3>
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
          </div>
          
          <div className="mt-1">
            <p className="text-2xl font-mono font-bold">
              ${formatPrice(ticker.price)}
            </p>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${getChangeColor(
                ticker.changePercent24h
              )} ${getChangeBgColor(ticker.changePercent24h)}`}
            >
              {formatPercent(ticker.changePercent24h)}
            </span>
            <span className="text-xs text-muted-foreground">24h</span>
          </div>
        </div>

        <div className="text-right text-xs text-muted-foreground space-y-1">
          <div>
            <span className="block">High</span>
            <span className="font-mono">${formatPrice(ticker.high24h)}</span>
          </div>
          <div>
            <span className="block">Low</span>
            <span className="font-mono">${formatPrice(ticker.low24h)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

