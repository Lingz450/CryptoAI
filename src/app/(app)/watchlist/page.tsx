"use client";

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import { formatPrice, formatPercent, getChangeColor, formatTimeAgo } from '@/lib/utils';
import { Star, Plus, Trash2, TrendingUp, TrendingDown, Zap, Loader2 } from 'lucide-react';

export default function WatchlistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [newSymbol, setNewSymbol] = useState('');
  const [isAddingSymbol, setIsAddingSymbol] = useState(false);

  const { data: watchlist, isLoading, refetch } = trpc.watchlist.list.useQuery(undefined, {
    enabled: status === 'authenticated',
  });

  const { data: symbolOptions, isLoading: isLoadingSymbols } = trpc.market.listSymbols.useQuery(
    { limit: 60 },
    {
      enabled: isAddingSymbol,
    }
  );

  const filteredSymbols = useMemo(() => {
    if (!symbolOptions) return [];
    const query = newSymbol.trim().toUpperCase();
    if (!query) return symbolOptions;
    return symbolOptions.filter((coin) => coin.symbol.includes(query));
  }, [symbolOptions, newSymbol]);

  const addMutation = trpc.watchlist.add.useMutation({
    onSuccess: () => {
      refetch();
      setNewSymbol('');
      setIsAddingSymbol(false);
    },
  });

  const removeMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => {
      refetch();
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
    router.push('/auth/signin?callbackUrl=/watchlist');
    return null;
  }

  const handleAddSymbol = (symbolInput?: string) => {
    const targetSymbol = (symbolInput ?? newSymbol).trim();
    if (!targetSymbol || addMutation.isLoading) return;
    addMutation.mutate({ symbol: targetSymbol.toUpperCase() });
  };

  const handleRemoveSymbol = (id: string) => {
    if (confirm('Remove this coin from watchlist?')) {
      removeMutation.mutate({ id });
    }
  };

  const handleSelectSuggestion = (symbol: string) => {
    const normalized = symbol.toUpperCase();
    setNewSymbol(normalized);
    handleAddSymbol(normalized);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              <Star className="w-8 h-8 inline-block mr-2 text-primary" />
              Watchlist
            </h1>
            <p className="text-muted-foreground">
              Track your favorite coins with real-time updates
            </p>
          </div>

          <Button
            onClick={() => setIsAddingSymbol(!isAddingSymbol)}
            className="glow"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Coin
          </Button>
        </div>

        {/* Add Symbol Form */}
        {isAddingSymbol && (
          <Card className="mb-6 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Add Coin to Watchlist</CardTitle>
              <CardDescription>
                Enter the symbol (e.g., BTC, ETH, SOL)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
                  placeholder="Symbol (e.g., BTC)"
                  className="flex-1 px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={addMutation.isLoading}
                />
                <Button
                  onClick={() => handleAddSymbol()}
                  disabled={!newSymbol.trim() || addMutation.isLoading}
                >
                  {addMutation.isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Add'
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsAddingSymbol(false);
                    setNewSymbol('');
                  }}
                >
                  Cancel
                </Button>
              </div>
              {addMutation.error && (
                <p className="text-sm text-destructive mt-2">
                  {addMutation.error.message}
                </p>
              )}

              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    Select a coin
                  </span>
                  {symbolOptions && (
                    <span className="text-xs text-muted-foreground">
                      Showing {filteredSymbols.length} of {symbolOptions.length}
                    </span>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto border border-border rounded-lg p-2">
                  {isLoadingSymbols ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : filteredSymbols.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No coins match "{newSymbol.trim() || 'your search'}".
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {filteredSymbols.map((coin) => (
                        <button
                          key={coin.symbol}
                          type="button"
                          onClick={() => handleSelectSuggestion(coin.symbol)}
                          className={`text-left p-3 rounded-lg border transition-all ${
                            newSymbol.toUpperCase() === coin.symbol
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/70 hover:bg-primary/5'
                          }`}
                        >
                          <div className="flex items-center justify-between text-sm font-semibold mb-1">
                            <span>{coin.symbol}</span>
                            <span className={getChangeColor(coin.changePercent24h)}>
                              {formatPercent(coin.changePercent24h)}
                            </span>
                          </div>
                          <div className="text-lg font-bold">{formatPrice(coin.price)}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {coin.exchange.toUpperCase()} • {coin.fullSymbol}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Watchlist Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-24" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-32 mb-2" />
                  <div className="h-4 bg-muted rounded w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !watchlist || watchlist.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Star className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No coins in watchlist</h3>
              <p className="text-muted-foreground mb-4">
                Start tracking your favorite coins
              </p>
              <Button onClick={() => setIsAddingSymbol(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Coin
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchlist.map((item) => {
              const change = item.analysis?.priceChange24h ?? 0;
              return (
              <Card
                key={item.id}
                className="hover:border-primary/50 transition-all cursor-pointer group"
                onClick={() => router.push(`/coin/${item.symbol}`)}
              >
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {item.symbol}
                      {item.analysis?.ghostScore && item.analysis.ghostScore >= 70 && (
                        <Zap className="w-4 h-4 text-primary" />
                      )}
                    </CardTitle>
                    <CardDescription>
                      {item.analysis?.exchange || 'Loading...'}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveSymbol(item.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={removeMutation.isLoading}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {item.analysis ? (
                    <div className="space-y-3">
                      <div>
                        <div className="text-2xl font-bold">
                          {formatPrice(item.analysis.price)}
                        </div>
                        <div className={`flex items-center gap-1 ${getChangeColor(change)}`}>
                          {change >= 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          <span className="font-semibold">
                            {formatPercent(change)}
                          </span>
                        </div>
                      </div>

                      {item.analysis.ghostScore && (
                        <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg">
                          <span className="text-sm font-medium">GhostScore</span>
                          <span className="text-lg font-bold text-primary">
                            {item.analysis.ghostScore}/100
                          </span>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        Added {formatTimeAgo(new Date(item.addedAt).getTime())}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading data...</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}

