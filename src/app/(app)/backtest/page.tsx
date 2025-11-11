'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';
import { formatPercent, formatPrice } from '@/lib/utils';
import { Loader2, Play, RotateCw, Zap } from 'lucide-react';

const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'];

export default function BacktestPage() {
  const router = useRouter();
  const [symbol, setSymbol] = useState('BTC');
  const [fast, setFast] = useState(10);
  const [slow, setSlow] = useState(50);
  const [interval, setInterval] = useState('1h');
  const [limit, setLimit] = useState(500);
  const [minRsi, setMinRsi] = useState('');
  const [maxRsi, setMaxRsi] = useState('');
  const [lastTrade, setLastTrade] = useState<{
    entryPrice: number;
    exitPrice: number;
    direction: 'LONG';
  } | null>(null);

  const backtestMutation = trpc.backtest.runEma.useMutation({
    onSuccess: (data) => {
      const recent = data.trades[data.trades.length - 1];
      if (recent) {
        setLastTrade({
          entryPrice: recent.entryPrice,
          exitPrice: recent.exitPrice,
          direction: 'LONG',
        });
      } else {
        setLastTrade(null);
      }
    },
  });

  const setupMutation = trpc.setups.create.useMutation({
    onSuccess: () => {
      router.push('/setups');
    },
  });

  const handleBacktest = () => {
    backtestMutation.mutate({
      symbol,
      fastPeriod: fast,
      slowPeriod: slow,
      interval,
      limit,
      minRsi: minRsi ? Number(minRsi) : undefined,
      maxRsi: maxRsi ? Number(maxRsi) : undefined,
    });
  };

  const handleConvertSetup = () => {
    if (!lastTrade) return;
    setupMutation.mutate({
      symbol,
      direction: 'LONG',
      entry: lastTrade.entryPrice,
      stopLoss: lastTrade.exitPrice,
      takeProfit: lastTrade.exitPrice * 1.02,
    });
  };

  const run = backtestMutation.data;
  const equity = run?.equityCurve ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Backtesting Lab</h1>
            <p className="text-muted-foreground">EMA crossover simulated in seconds</p>
          </div>
          <Button onClick={handleBacktest} disabled={backtestMutation.isLoading}>
            {backtestMutation.isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Backtest
              </>
            )}
          </Button>
        </div>

        <Card className="space-y-4 p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Symbol</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Fast EMA</label>
              <input
                type="number"
                value={fast}
                min={5}
                onChange={(e) => setFast(Number(e.target.value))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Slow EMA</label>
              <input
                type="number"
                value={slow}
                min={fast + 5}
                onChange={(e) => setSlow(Number(e.target.value))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Interval</label>
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
              >
                {intervals.map((int) => (
                  <option key={int} value={int}>
                    {int}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Limit</label>
              <input
                type="number"
                min={100}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Min RSI</label>
              <input
                type="number"
                min={0}
                max={100}
                value={minRsi}
                onChange={(e) => setMinRsi(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Max RSI</label>
              <input
                type="number"
                min={0}
                max={100}
                value={maxRsi}
                onChange={(e) => setMaxRsi(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
              />
            </div>
          </div>
        </Card>

        {run && (
          <Card className="space-y-4 border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="text-primary" />
                Backtest summary
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Metric label="Win rate" value={`${(run.winRate * 100).toFixed(1)}%`} />
                <Metric label="Profit factor" value={run.profitFactor.toFixed(2)} />
                <Metric label="Max drawdown" value={`${(run.maxDrawdown * 100).toFixed(1)}%`} />
                <Metric label="Total return" value={`${run.totalReturn.toFixed(1)}%`} />
            </CardContent>

            <CardContent>
              <div className="h-32 rounded-xl border border-primary/20 bg-bar p-2 flex items-end gap-1">
                {equity.map((value, index) => {
                  const normalized = ((value - 80) / 20) * 100;
                  return (
                    <div
                      key={index}
                      className="flex-1 rounded bg-primary/70"
                      style={{ height: `${Math.min(Math.max(normalized, 5), 100)}%` }}
                    ></div>
                  );
                })}
              </div>
            </CardContent>

            <CardContent className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={!lastTrade || setupMutation.isLoading}
                onClick={handleConvertSetup}
              >
                <RotateCw className="w-4 h-4 mr-2" />
                Convert latest trade into setup
              </Button>
              <Button variant="ghost" onClick={() => router.push('/setups')}>
                View saved setups
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
