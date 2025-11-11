'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import { formatPrice, formatPercent, getChangeColor, formatLargeNumber } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Star,
  Bell,
  Search,
  Zap,
  BarChart3,
  Loader2,
  ArrowRight
} from 'lucide-react';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const { data: topMovers, isLoading: isLoadingMovers } = trpc.market.getTopMovers.useQuery({
    limit: 6,
  });

  const { data: watchlist, isLoading: isLoadingWatchlist } = trpc.watchlist.list.useQuery(undefined, {
    enabled: status === 'authenticated',
  });

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin?callbackUrl=/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Welcome back, {session?.user?.name || session?.user?.email?.split('@')[0]}!
          </h1>
          <p className="text-muted-foreground">
            Your crypto command center
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Star className="w-4 h-4" />
                Watchlist
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {isLoadingWatchlist ? '...' : watchlist?.length || 0}
              </div>
              <Button
                variant="link"
                size="sm"
                onClick={() => router.push('/watchlist')}
                className="p-0 h-auto text-primary"
              >
                View All →
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <Button
                variant="link"
                size="sm"
                onClick={() => router.push('/alerts')}
                className="p-0 h-auto text-primary"
              >
                Manage →
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                Screeners
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">5</div>
              <Button
                variant="link"
                size="sm"
                onClick={() => router.push('/screeners')}
                className="p-0 h-auto text-primary"
              >
                Scan →
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Setups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <Button
                variant="link"
                size="sm"
                onClick={() => router.push('/setups')}
                className="p-0 h-auto text-primary"
              >
                View All →
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Watchlist Preview */}
        {watchlist && watchlist.length > 0 && (
          <Card className="mb-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Your Watchlist</CardTitle>
                <CardDescription>Quick view of your tracked coins</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/watchlist')}
              >
                View All
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {watchlist.slice(0, 6).map((item) => {
                  const change = item.analysis?.priceChange24h ?? 0;
                  return (
                  <div
                    key={item.id}
                    onClick={() => router.push(`/coin/${item.symbol}`)}
                    className="p-4 border border-border rounded-lg hover:border-primary/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-bold text-lg flex items-center gap-2">
                          {item.symbol}
                          {item.analysis?.ghostScore && item.analysis.ghostScore >= 70 && (
                            <Zap className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.analysis?.exchange}
                        </div>
                      </div>
                      {item.analysis?.ghostScore && (
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Score</div>
                          <div className="text-sm font-bold text-primary">
                            {item.analysis.ghostScore}
                          </div>
                        </div>
                      )}
                    </div>
                    {item.analysis && (
                      <>
                        <div className="text-xl font-bold mb-1">
                          {formatPrice(item.analysis.price)}
                        </div>
                        <div className={`flex items-center gap-1 text-sm ${getChangeColor(change)}`}>
                          {change >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {formatPercent(change)}
                        </div>
                      </>
                    )}
                  </div>
                )})}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Market Movers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Top Market Movers
            </CardTitle>
            <CardDescription>Biggest gainers and losers in the last 24h</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingMovers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                {topMovers?.gainers && topMovers.gainers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-green-500 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Top Gainers
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {topMovers.gainers.slice(0, 3).map((coin) => {
                        const percentChange =
                          ((coin as { priceChange24h?: number }).priceChange24h ??
                            coin.changePercent24h ??
                            0);
                        return (
                        <div
                          key={coin.symbol}
                          onClick={() => router.push(`/coin/${coin.symbol}`)}
                          className="p-3 border border-green-500/20 bg-green-500/5 rounded-lg hover:border-green-500/50 transition-all cursor-pointer"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="font-bold">{coin.symbol}</div>
                            <div className="text-xs px-2 py-1 bg-green-500/20 text-green-500 rounded">
                              {formatPercent(percentChange)}
                            </div>
                          </div>
                          <div className="text-lg font-semibold">
                            {formatPrice(coin.price)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Vol: {formatLargeNumber(coin.volume24h)}
                          </div>
                        </div>
                      )})}
                    </div>
                  </div>
                )}

                {topMovers?.losers && topMovers.losers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-red-500 mb-3 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" />
                      Top Losers
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {topMovers.losers.slice(0, 3).map((coin) => {
                        const percentChange =
                          ((coin as { priceChange24h?: number }).priceChange24h ??
                            coin.changePercent24h ??
                            0);
                        return (
                        <div
                          key={coin.symbol}
                          onClick={() => router.push(`/coin/${coin.symbol}`)}
                          className="p-3 border border-red-500/20 bg-red-500/5 rounded-lg hover:border-red-500/50 transition-all cursor-pointer"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="font-bold">{coin.symbol}</div>
                            <div className="text-xs px-2 py-1 bg-red-500/20 text-red-500 rounded">
                              {formatPercent(percentChange)}
                            </div>
                          </div>
                          <div className="text-lg font-semibold">
                            {formatPrice(coin.price)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Vol: {formatLargeNumber(coin.volume24h)}
                          </div>
                        </div>
                      )})}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
