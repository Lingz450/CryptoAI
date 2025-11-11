'use client';

import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { MarketPulseTicker } from '@/components/MarketPulseTicker';
import { TickerCard } from '@/components/TickerCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';
import { Activity, TrendingUp, Bell, Target, Zap, BarChart3 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  
  const { data: topMovers, isLoading: isLoadingMovers } = trpc.market.getTopMovers.useQuery(
    { limit: 5 },
    { 
      staleTime: 30000, // Cache for 30 seconds
      refetchInterval: 60000, // Refetch every minute
    }
  );
  
  const { data: tickers, isLoading: isLoadingTickers } = trpc.market.getMultipleTickers.useQuery(
    { symbols: ['BTC', 'ETH', 'SOL', 'BNB'] },
    { 
      staleTime: 30000,
      refetchInterval: 60000,
    }
  );

  return (
    <div className="min-h-screen bg-background ghost-grid">
      {/* Navigation */}
      <Navbar />
      
      {/* Market Pulse Ticker */}
      <MarketPulseTicker />

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Live Market Intelligence</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Crypto Command Center
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Real-time market analysis powered by AI. Track coins, set alerts, find setups, and never miss a move.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Button size="lg" className="glow" onClick={() => router.push('/dashboard')}>
              Launch Dashboard
            </Button>
            <Button size="lg" variant="outline" onClick={() => router.push('/coin/BTC')}>
              Explore Markets
            </Button>
          </div>
        </div>

        {/* Major Coins Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {isLoadingTickers ? (
            // Loading skeletons
            <>
              {['BTC', 'ETH', 'SOL', 'BNB'].map((symbol) => (
                <Card key={symbol} className="animate-pulse">
                  <CardHeader className="pb-2">
                    <div className="h-6 bg-muted rounded w-20 mb-2" />
                    <div className="h-4 bg-muted rounded w-16" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 bg-muted rounded w-32 mb-2" />
                    <div className="h-6 bg-muted rounded w-24" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : tickers && tickers.length > 0 ? (
            // Actual ticker cards
            <>
              {tickers.map((ticker) => (
                <TickerCard
                  key={ticker.symbol}
                  ticker={ticker}
                  onClick={() => router.push(`/coin/${ticker.symbol.replace('USDT', '')}`)}
                />
              ))}
            </>
          ) : (
            // Error/empty state
            <Card className="col-span-full">
              <CardContent className="py-8 text-center text-muted-foreground">
                Unable to load market data. Please refresh the page.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <Card className="border-primary/20">
            <CardHeader>
              <Activity className="w-8 h-8 mb-2 text-primary" />
              <CardTitle>Market Pulse</CardTitle>
              <CardDescription>
                Live price feeds from Binance, Bybit, and OKX. Always up-to-date.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-primary/20">
            <CardHeader>
              <Target className="w-8 h-8 mb-2 text-primary" />
              <CardTitle>GhostScore AI</CardTitle>
              <CardDescription>
                AI-powered strength meter analyzing trend, momentum, volatility, and structure.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-primary/20">
            <CardHeader>
              <Bell className="w-8 h-8 mb-2 text-primary" />
              <CardTitle>Smart Alerts</CardTitle>
              <CardDescription>
                Price alerts, RSI levels, EMA crosses, ATR spikes. Never miss an entry.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Top Movers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {isLoadingMovers ? (
            // Loading skeletons for both columns
            <>
              <Card className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-48" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                        <div className="space-y-2">
                          <div className="h-5 bg-muted rounded w-16" />
                          <div className="h-4 bg-muted rounded w-20" />
                        </div>
                        <div className="h-6 bg-muted rounded w-16" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-48" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                        <div className="space-y-2">
                          <div className="h-5 bg-muted rounded w-16" />
                          <div className="h-4 bg-muted rounded w-20" />
                        </div>
                        <div className="h-6 bg-muted rounded w-16" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : topMovers ? (
            // Actual top movers data
            <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Top Gainers (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topMovers.gainers.slice(0, 5).map((ticker) => (
                    <div
                      key={ticker.symbol}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors"
                      onClick={() => router.push(`/coin/${ticker.symbol.replace('USDT', '')}`)}
                    >
                      <div>
                        <p className="font-bold">{ticker.symbol.replace('USDT', '')}</p>
                        <p className="text-sm text-muted-foreground">
                          ${ticker.price.toFixed(2)}
                        </p>
                      </div>
                      <span className="text-green-500 font-bold">
                        +{ticker.changePercent24h.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-red-500 rotate-180" />
                  Top Losers (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topMovers.losers.slice(0, 5).map((ticker) => (
                    <div
                      key={ticker.symbol}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors"
                      onClick={() => router.push(`/coin/${ticker.symbol.replace('USDT', '')}`)}
                    >
                      <div>
                        <p className="font-bold">{ticker.symbol.replace('USDT', '')}</p>
                        <p className="text-sm text-muted-foreground">
                          ${ticker.price.toFixed(2)}
                        </p>
                      </div>
                      <span className="text-red-500 font-bold">
                        {ticker.changePercent24h.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            </>
          ) : (
            // Error/empty state
            <Card className="col-span-full">
              <CardContent className="py-8 text-center text-muted-foreground">
                Unable to load market movers. Please refresh the page.
              </CardContent>
            </Card>
          )}
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center">
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 mb-4 mx-auto">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-3xl">Ready to level up your trading?</CardTitle>
              <CardDescription className="text-base">
                Join GhostFX and get access to advanced screeners, backtesting, AI insights, and more.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" className="glow" onClick={() => router.push('/dashboard')}>
                Get Started Free
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>© 2025 GhostFX. Not financial advice. Trade responsibly.</p>
        </div>
      </footer>
    </div>
  );
}

