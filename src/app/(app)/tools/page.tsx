'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import { formatPrice, formatPercent, formatLargeNumber } from '@/lib/utils';
import {
  Calculator,
  Search,
  TrendingUp,
  DollarSign,
  Target,
  Activity,
  Zap,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ToolsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'position-calc');

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/tools?tab=${value}`, { scroll: false });
  };

  // Position Size Calculator
  const [posCalc, setPosCalc] = useState({
    entry: '',
    stopLoss: '',
    risk: '',
    leverage: '1',
  });

  const positionCalc = trpc.tools.calculatePositionSize.useQuery(
    {
      entryPrice: parseFloat(posCalc.entry) || 0,
      stopLoss: parseFloat(posCalc.stopLoss) || 0,
      riskAmount: parseFloat(posCalc.risk) || 0,
      leverage: parseInt(posCalc.leverage) || 1,
    },
    { enabled: !!(posCalc.entry && posCalc.stopLoss && posCalc.risk) }
  );

  // Pair Finder
  const [pairPrice, setPairPrice] = useState('');
  const pairFinder = trpc.tools.findPairByPrice.useQuery(
    { price: parseFloat(pairPrice) || 0 },
    { enabled: !!pairPrice && parseFloat(pairPrice) > 0 }
  );

  // EMA Scanner
  const [emaConfig, setEmaConfig] = useState({
    period: '200',
    timeframe: '1h',
  });
  const [emaQueryEnabled, setEmaQueryEnabled] = useState(false);
  const emaScanner = trpc.tools.scanEMA.useQuery(
    {
      emaPeriod: parseInt(emaConfig.period),
      timeframe: emaConfig.timeframe,
      limit: 10,
    },
    { enabled: emaQueryEnabled }
  );

  // RSI Scanner
  const [rsiConfig, setRsiConfig] = useState({
    timeframe: '1h',
    type: 'BOTH' as 'OVERBOUGHT' | 'OVERSOLD' | 'BOTH',
  });
  const [rsiQueryEnabled, setRsiQueryEnabled] = useState(false);
  const rsiScanner = trpc.tools.scanRSI.useQuery(
    {
      timeframe: rsiConfig.timeframe,
      type: rsiConfig.type,
      limit: 10,
    },
    { enabled: rsiQueryEnabled }
  );

  const handleEmaScan = () => {
    setEmaQueryEnabled(false);
    setTimeout(() => setEmaQueryEnabled(true), 100);
  };

  const handleRsiScan = () => {
    setRsiQueryEnabled(false);
    setTimeout(() => setRsiQueryEnabled(true), 100);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <Calculator className="w-8 h-8 inline-block mr-2 text-primary" />
            Trading Tools
          </h1>
          <p className="text-muted-foreground">
            Professional calculators and scanners for crypto trading
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
            <TabsTrigger value="position-calc">
              <Calculator className="w-4 h-4 mr-2" />
              Position Size
            </TabsTrigger>
            <TabsTrigger value="pair-finder">
              <Search className="w-4 h-4 mr-2" />
              Pair Finder
            </TabsTrigger>
            <TabsTrigger value="ema-scanner">
              <TrendingUp className="w-4 h-4 mr-2" />
              EMA Scanner
            </TabsTrigger>
            <TabsTrigger value="rsi-scanner">
              <Activity className="w-4 h-4 mr-2" />
              RSI Scanner
            </TabsTrigger>
          </TabsList>

          {/* Position Size Calculator */}
          <TabsContent value="position-calc">
            <Card>
              <CardHeader>
                <CardTitle>Position Size Calculator</CardTitle>
                <CardDescription>
                  Calculate optimal position size based on your risk parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Entry Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={posCalc.entry}
                      onChange={(e) => setPosCalc({ ...posCalc, entry: e.target.value })}
                      placeholder="64200"
                      className="w-full px-4 py-2 bg-background border border-input rounded-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Stop Loss</label>
                    <input
                      type="number"
                      step="0.01"
                      value={posCalc.stopLoss}
                      onChange={(e) => setPosCalc({ ...posCalc, stopLoss: e.target.value })}
                      placeholder="63450"
                      className="w-full px-4 py-2 bg-background border border-input rounded-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Risk Amount (USDT)</label>
                    <input
                      type="number"
                      step="1"
                      value={posCalc.risk}
                      onChange={(e) => setPosCalc({ ...posCalc, risk: e.target.value })}
                      placeholder="50"
                      className="w-full px-4 py-2 bg-background border border-input rounded-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Leverage</label>
                    <input
                      type="number"
                      step="1"
                      value={posCalc.leverage}
                      onChange={(e) => setPosCalc({ ...posCalc, leverage: e.target.value })}
                      placeholder="5"
                      className="w-full px-4 py-2 bg-background border border-input rounded-lg"
                    />
                  </div>
                </div>

                {positionCalc.data && (
                  <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                    <h3 className="font-semibold text-lg mb-3">Results</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Position Size</div>
                        <div className="text-xl font-bold">${formatPrice(positionCalc.data.positionSize)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Quantity</div>
                        <div className="text-xl font-bold">{positionCalc.data.quantity.toFixed(4)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Margin Required</div>
                        <div className="text-xl font-bold">${formatPrice(positionCalc.data.marginRequired)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Stop Loss %</div>
                        <div className="text-xl font-bold text-red-500">
                          {positionCalc.data.stopLossPercent.toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Est. Fees</div>
                        <div className="text-xl font-bold">${positionCalc.data.estimatedFees.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Max Loss</div>
                        <div className="text-xl font-bold text-red-500">
                          ${positionCalc.data.maxLoss.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pair Finder */}
          <TabsContent value="pair-finder">
            <Card>
              <CardHeader>
                <CardTitle>Pair Finder by Price</CardTitle>
                <CardDescription>
                  Find which coin matches a price from a screenshot or chart
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Price</label>
                  <input
                    type="number"
                    step="any"
                    value={pairPrice}
                    onChange={(e) => setPairPrice(e.target.value)}
                    placeholder="0.0000321"
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter any price - we'll find coins that match
                  </p>
                </div>

                {pairFinder.isLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}

                {pairFinder.data && pairFinder.data.length > 0 && (
                  <div className="space-y-2 mt-6">
                    <h3 className="font-semibold mb-3">Matching Pairs ({pairFinder.data.length})</h3>
                    {pairFinder.data.map((match) => (
                      <div
                        key={match.symbol}
                        className="p-3 bg-muted/50 rounded-lg flex items-center justify-between hover:bg-muted transition-colors"
                      >
                        <div>
                          <div className="font-semibold">{match.symbol.replace('USDT', '')}</div>
                          <div className="text-sm text-muted-foreground">
                            ${formatPrice(match.price)} · {match.priceMatch.toFixed(1)}% match
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-semibold ${match.changePercent24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {formatPercent(match.changePercent24h)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Vol: ${formatLargeNumber(match.volume24h)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {pairFinder.data && pairFinder.data.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No matching pairs found. Try adjusting the price.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* EMA Scanner */}
          <TabsContent value="ema-scanner">
            <Card>
              <CardHeader>
                <CardTitle>EMA Proximity Scanner</CardTitle>
                <CardDescription>
                  Find coins closest to a specific EMA - perfect for bounce/rejection plays
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">EMA Period</label>
                    <select
                      value={emaConfig.period}
                      onChange={(e) => setEmaConfig({ ...emaConfig, period: e.target.value })}
                      className="w-full px-4 py-2 bg-background border border-input rounded-lg"
                    >
                      <option value="50">EMA 50</option>
                      <option value="100">EMA 100</option>
                      <option value="200">EMA 200</option>
                      <option value="20">EMA 20</option>
                      <option value="9">EMA 9</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Timeframe</label>
                    <select
                      value={emaConfig.timeframe}
                      onChange={(e) => setEmaConfig({ ...emaConfig, timeframe: e.target.value })}
                      className="w-full px-4 py-2 bg-background border border-input rounded-lg"
                    >
                      <option value="15m">15 Minutes</option>
                      <option value="1h">1 Hour</option>
                      <option value="4h">4 Hours</option>
                      <option value="1d">1 Day</option>
                    </select>
                  </div>
                </div>

                <Button onClick={handleEmaScan} className="w-full" disabled={emaScanner.isLoading}>
                  {emaScanner.isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Scan Now
                    </>
                  )}
                </Button>

                {emaScanner.isLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}

                {emaScanner.data && emaScanner.data.length > 0 && (
                  <div className="space-y-2 mt-6">
                    <h3 className="font-semibold mb-3">
                      Top 10 Pairs Near EMA {emaConfig.period} ({emaConfig.timeframe})
                    </h3>
                    {emaScanner.data.map((result, i) => (
                      <div
                        key={result.symbol}
                        className="p-3 bg-muted/50 rounded-lg flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-6">#{i + 1}</span>
                          <div>
                            <div className="font-semibold">{result.symbol.replace('USDT', '')}</div>
                            <div className="text-sm text-muted-foreground">
                              Price: ${formatPrice(result.currentPrice)} · EMA: ${formatPrice(result.ema)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${result.distancePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {result.distancePercent >= 0 ? '+' : ''}{result.distancePercent.toFixed(2)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {result.distancePercent > 0 ? 'Above EMA' : 'Below EMA'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* RSI Scanner */}
          <TabsContent value="rsi-scanner">
            <Card>
              <CardHeader>
                <CardTitle>RSI Extreme Scanner</CardTitle>
                <CardDescription>
                  Find overbought/oversold coins for reversal trades
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Timeframe</label>
                    <select
                      value={rsiConfig.timeframe}
                      onChange={(e) => setRsiConfig({ ...rsiConfig, timeframe: e.target.value })}
                      className="w-full px-4 py-2 bg-background border border-input rounded-lg"
                    >
                      <option value="15m">15 Minutes</option>
                      <option value="1h">1 Hour</option>
                      <option value="4h">4 Hours</option>
                      <option value="1d">1 Day</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <select
                      value={rsiConfig.type}
                      onChange={(e) => setRsiConfig({ ...rsiConfig, type: e.target.value as any })}
                      className="w-full px-4 py-2 bg-background border border-input rounded-lg"
                    >
                      <option value="BOTH">Both</option>
                      <option value="OVERBOUGHT">Overbought Only</option>
                      <option value="OVERSOLD">Oversold Only</option>
                    </select>
                  </div>
                </div>

                <Button onClick={handleRsiScan} className="w-full" disabled={rsiScanner.isLoading}>
                  {rsiScanner.isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Scan Now
                    </>
                  )}
                </Button>

                {rsiScanner.isLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}

                {rsiScanner.data && rsiScanner.data.length > 0 && (
                  <div className="space-y-2 mt-6">
                    <h3 className="font-semibold mb-3">
                      RSI Extremes ({rsiConfig.timeframe})
                    </h3>
                    {rsiScanner.data.map((result, i) => (
                      <div
                        key={result.symbol}
                        className={`p-3 rounded-lg flex items-center justify-between ${
                          result.condition === 'OVERSOLD'
                            ? 'bg-green-500/10 border border-green-500/30'
                            : 'bg-red-500/10 border border-red-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-6">#{i + 1}</span>
                          <div>
                            <div className="font-semibold flex items-center gap-2">
                              {result.symbol.replace('USDT', '')}
                              {result.potentialReversal && (
                                <span className="text-xs px-2 py-0.5 bg-primary/20 rounded">
                                  High Reversal Potential
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ${formatPrice(result.currentPrice)} · {formatPercent(result.changePercent24h)} 24h
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${result.condition === 'OVERSOLD' ? 'text-green-500' : 'text-red-500'}`}>
                            {result.rsi.toFixed(1)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {result.condition}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

