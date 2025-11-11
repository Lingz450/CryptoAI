'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import {
  formatLargeNumber,
  formatPercent,
  formatPrice,
  formatTimeAgo,
  getChangeColor,
} from '@/lib/utils';
import {
  Activity,
  Loader2,
  Play,
  Save,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Volume2,
  Zap,
  Clock,
  Pencil,
} from 'lucide-react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/routers/_app';
import { $Enums } from '@prisma/client';

type ScreenerType = $Enums.ScreenerType;

type RouterOutputs = inferRouterOutputs<AppRouter>;
type SavedScreener = RouterOutputs['screeners']['listSaved'][number];

type FiltersState = {
  exchange: 'aggregated' | 'binance' | 'bybit' | 'okx';
  minVolume: number | '';
  minGhostScore: number | '';
};

const defaultFilters: FiltersState = {
  exchange: 'aggregated',
  minVolume: 1_000_000,
  minGhostScore: 70,
};

const scheduleLabels: Record<'NONE' | 'HOURLY' | 'DAILY', string> = {
  NONE: 'Manual',
  HOURLY: 'Hourly digest',
  DAILY: 'Daily digest',
};

export default function ScreenersPage() {
  const { status } = useSession();
  const router = useRouter();

  const [activeScreener, setActiveScreener] =
    useState<ScreenerType>('GHOST_SCORE_HIGH' as ScreenerType);
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [limit, setLimit] = useState(20);
  const [screenerName, setScreenerName] = useState('My Ghost Scan');
  const [schedule, setSchedule] = useState<'NONE' | 'HOURLY' | 'DAILY'>('NONE');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualResults, setManualResults] = useState<any[] | null>(null);

  const sanitizedFilters = useMemo(() => {
    return {
      exchange: filters.exchange,
      minVolume: filters.minVolume === '' ? undefined : Number(filters.minVolume),
      minGhostScore:
        filters.minGhostScore === '' ? undefined : Number(filters.minGhostScore),
    };
  }, [filters]);

  const {
    data: results,
    isLoading,
    refetch,
  } = trpc.screeners.scan.useQuery(
    { type: activeScreener, limit, filters: sanitizedFilters },
    {
      enabled: status === 'authenticated',
    }
  );

  const {
    data: savedScreeners,
    isLoading: isLoadingSaved,
    refetch: refetchSaved,
  } = trpc.screeners.listSaved.useQuery(undefined, {
    enabled: status === 'authenticated',
  });

  const saveMutation = trpc.screeners.save.useMutation({
    onSuccess: () => {
      refetchSaved();
      setEditingId(null);
    },
  });

  const deleteMutation = trpc.screeners.delete.useMutation({
    onSuccess: () => {
      refetchSaved();
    },
  });

  const runSavedMutation = trpc.screeners.runSaved.useMutation({
    onSuccess: (data) => {
      setManualResults(data.results);
      setActiveScreener(data.screener.type as ScreenerType);
      const storedFilters = (data.screener.filters as FiltersState & {
        minVolume?: number;
        minGhostScore?: number;
        exchange?: FiltersState['exchange'];
        limit?: number;
      }) || { exchange: 'aggregated' };

      setFilters({
        exchange: storedFilters.exchange ?? 'aggregated',
        minVolume:
          typeof storedFilters.minVolume === 'number' ? storedFilters.minVolume : '',
        minGhostScore:
          typeof storedFilters.minGhostScore === 'number'
            ? storedFilters.minGhostScore
            : '',
      });

      setLimit(storedFilters.limit ?? data.limit ?? 20);
    },
  });

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin?callbackUrl=/screeners');
    return null;
  }

  const screeners = [
    {
      type: 'GHOST_SCORE_HIGH' as ScreenerType,
      name: 'High GhostScore',
      description: 'Coins with GhostScore above 70',
      icon: Zap,
      color: 'text-primary',
    },
    {
      type: 'ATR_BREAKOUT' as ScreenerType,
      name: 'ATR Breakout',
      description: 'Volatility breakouts with high ATR',
      icon: Activity,
      color: 'text-orange-500',
    },
    {
      type: 'VOLUME_SURGE' as ScreenerType,
      name: 'Volume Surge',
      description: 'Unusual volume spikes (2x+ average)',
      icon: Volume2,
      color: 'text-blue-500',
    },
    {
      type: 'RSI_EXTREME' as ScreenerType,
      name: 'RSI Extremes',
      description: 'Overbought (>70) or Oversold (<30)',
      icon: TrendingUp,
      color: 'text-purple-500',
    },
    {
      type: 'PRICE_BREAKOUT' as ScreenerType,
      name: 'Price Breakout',
      description: 'Breaking support/resistance levels',
      icon: TrendingUp,
      color: 'text-green-500',
    },
  ];

  const handleScan = () => {
    setManualResults(null);
    setIsScanning(true);
    refetch().finally(() => setIsScanning(false));
  };

  const handleSave = () => {
    saveMutation.mutate({
      id: editingId ?? undefined,
      name: screenerName || `My ${activeScreener} scan`,
      type: activeScreener,
      limit,
      filters: sanitizedFilters,
      schedule,
    });
  };

  const displayedResults = manualResults ?? results;
  const isBusy = isLoading || runSavedMutation.isLoading;

  const handleEdit = (screener: SavedScreener) => {
    const savedFilters = (screener.filters as FiltersState & {
      limit?: number;
    }) || { exchange: 'aggregated' };

    setEditingId(screener.id);
    setScreenerName(screener.name);
    setFilters({
      exchange: savedFilters.exchange ?? 'aggregated',
      minVolume:
        typeof savedFilters.minVolume === 'number' ? savedFilters.minVolume : '',
      minGhostScore:
        typeof savedFilters.minGhostScore === 'number'
          ? savedFilters.minGhostScore
          : '',
    });
    setLimit(savedFilters.limit ?? 20);
    setSchedule((screener.schedule as 'HOURLY' | 'DAILY') ?? 'NONE');
    setActiveScreener(screener.type as ScreenerType);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <Search className="w-8 h-8 inline-block mr-2 text-primary" />
            Market Screeners
          </h1>
          <p className="text-muted-foreground">
            Find trading opportunities with advanced market scanning
          </p>
        </div>

        {/* Screener Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {screeners.map((screener) => {
            const Icon = screener.icon;
            const isActive = activeScreener === screener.type;

            return (
              <Card
                key={screener.type}
                className={`cursor-pointer transition-all ${
                  isActive ? 'border-primary/50 bg-primary/5' : 'hover:border-border/50'
                }`}
                onClick={() => setActiveScreener(screener.type)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${screener.color}`} />
                    {screener.name}
                  </CardTitle>
                  <CardDescription>{screener.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        {/* Filters & Save */}
        <Card className="mb-8 border-dashed">
          <CardHeader>
            <CardTitle>Filters & Scheduling</CardTitle>
            <CardDescription>
              Tune filters and save your favorite configuration for scheduled digests.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Exchange</label>
                <select
                  value={filters.exchange}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, exchange: e.target.value as FiltersState['exchange'] }))
                  }
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="aggregated">Aggregated</option>
                  <option value="binance">Binance</option>
                  <option value="bybit">Bybit</option>
                  <option value="okx">OKX</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Min Volume (Quote)</label>
                <input
                  type="number"
                  min={0}
                  value={filters.minVolume}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      minVolume: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                  placeholder="1,000,000"
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Min GhostScore</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={filters.minGhostScore}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      minGhostScore: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                  placeholder="70"
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Results Limit</label>
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Save As</label>
                <input
                  type="text"
                  value={screenerName}
                  onChange={(e) => setScreenerName(e.target.value)}
                  placeholder="My Ghost Scan"
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Schedule</label>
                <select
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value as 'NONE' | 'HOURLY' | 'DAILY')}
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="NONE">Manual</option>
                  <option value="HOURLY">Hourly digest</option>
                  <option value="DAILY">Daily digest</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSave} disabled={saveMutation.isLoading}>
                {saveMutation.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Screener
                  </>
                )}
              </Button>
              {editingId && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setScreenerName('My Ghost Scan');
                    setFilters(defaultFilters);
                    setSchedule('NONE');
                  }}
                >
                  Cancel edit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Saved Screeners */}
        <div className="mb-10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold">Saved Screeners</h3>
              <p className="text-sm text-muted-foreground">
                Automate digests and reuse your favorite filters
              </p>
            </div>
          </div>
          {isLoadingSaved ? (
            <Card className="border-dashed">
              <CardContent className="py-8 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </CardContent>
            </Card>
          ) : savedScreeners && savedScreeners.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedScreeners.map((screener) => {
                const storedFilters = (screener.filters as FiltersState & {
                  minVolume?: number;
                  minGhostScore?: number;
                  exchange?: FiltersState['exchange'];
                }) || { exchange: 'aggregated' };
                return (
                  <Card key={screener.id} className="border-muted">
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                      <div>
                        <CardTitle>{screener.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {screener.schedule
                            ? scheduleLabels[screener.schedule as 'HOURLY' | 'DAILY']
                            : 'Manual'}
                          {screener.lastRun && (
                            <span className="text-xs text-muted-foreground">
                              · Last run {formatTimeAgo(screener.lastRun.getTime())}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(screener)}
                          aria-label="Edit screener"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(screener.id)}
                          disabled={deleteMutation.isLoading}
                          aria-label="Delete screener"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Type: {screener.type}</span>
                        {storedFilters.exchange && (
                          <span>Exchange: {storedFilters.exchange}</span>
                        )}
                        {storedFilters.minVolume && (
                          <span>Min Vol: {formatLargeNumber(storedFilters.minVolume)}</span>
                        )}
                        {storedFilters.minGhostScore && (
                          <span>Min GhostScore: {storedFilters.minGhostScore}</span>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => runSavedMutation.mutate({ id: screener.id })}
                          disabled={runSavedMutation.isLoading}
                        >
                          {runSavedMutation.isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Run now'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No saved screeners yet. Configure filters above and click Save to get started.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Scan Button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">
              {screeners.find((s) => s.type === activeScreener)?.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {displayedResults?.length || 0} opportunities found
            </p>
          </div>
          <Button onClick={handleScan} disabled={isScanning || isBusy} className="glow">
            {isScanning || isBusy ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Scan
              </>
            )}
          </Button>
        </div>

        {/* Results */}
        {isBusy ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-24" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-48" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !displayedResults || displayedResults.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground mb-4">
                Try running a scan or select a different screener
              </p>
              <Button onClick={handleScan}>
                <Play className="w-4 h-4 mr-2" />
                Run Scan
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {displayedResults.map((coin: any) => (
              <Card
                key={coin.symbol}
                className="hover:border-primary/50 transition-all cursor-pointer"
                onClick={() => router.push(`/coin/${coin.symbol}`)}
              >
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {coin.symbol}
                      {coin.ghostScore && coin.ghostScore >= 70 && (
                        <Zap className="w-4 h-4 text-primary" />
                      )}
                    </CardTitle>
                    <CardDescription>{coin.exchange}</CardDescription>
                  </div>
                  <div className={`text-right ${getChangeColor(coin.priceChange24h)}`}>
                    <div className="text-2xl font-bold">{formatPercent(coin.priceChange24h)}</div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Price</div>
                      <div className="text-lg font-semibold">{formatPrice(coin.price)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Volume 24h</div>
                      <div className="text-lg font-semibold">{formatLargeNumber(coin.volume24h)}</div>
                    </div>
                    {coin.ghostScore && (
                      <div>
                        <div className="text-sm text-muted-foreground">GhostScore</div>
                        <div className="text-lg font-semibold text-primary">{coin.ghostScore}/100</div>
                      </div>
                    )}
                    {coin.rsi && (
                      <div>
                        <div className="text-sm text-muted-foreground">RSI</div>
                        <div className="text-lg font-semibold">{coin.rsi.toFixed(1)}</div>
                      </div>
                    )}
                    {coin.atr && (
                      <div>
                        <div className="text-sm text-muted-foreground">ATR</div>
                        <div className="text-lg font-semibold">{formatPercent(coin.atr)}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
