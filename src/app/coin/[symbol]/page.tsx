'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { MarketPulseTicker } from '@/components/MarketPulseTicker';
import { ShareCard } from '@/components/ShareCard';
import { DerivativesBar } from '@/components/DerivativesBar';
import { GhostScorePanel } from '@/components/GhostScorePanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import { formatPrice, formatPercent, getChangeColor, formatLargeNumber, formatTimeAgo } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  AlertCircle,
  ArrowLeft,
  Zap,
  BarChart3,
  Sparkles,
  Loader2,
} from 'lucide-react';

export default function CoinPage({ params }: { params: { symbol: string } }) {
  const { symbol } = params;
  const router = useRouter();
  const [explanation, setExplanation] = useState<string | null>(null);

  const { data: analysis, isLoading, error } = trpc.market.analyzeCoin.useQuery({
    symbol: symbol.toUpperCase(),
  });

  const { data: derivatives } = trpc.market.getDerivatives.useQuery({
    symbol: symbol.toUpperCase(),
  });

  const explainMutation = trpc.ai.explainAnalysis.useMutation({
    onSuccess: (response) => setExplanation(response.explanation),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <MarketPulseTicker />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-40 bg-muted rounded"></div>
              <div className="h-40 bg-muted rounded"></div>
              <div className="h-40 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Navbar />
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Analysis</CardTitle>
            <CardDescription>
              {error?.message || 'Failed to load coin analysis'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')}>Back to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPositive = analysis.ticker.changePercent24h >= 0;
  const ghostInterpretation = analysis.ghostScore.interpretation;
  const shareDescription = `GhostScore ${analysis.ghostScore.totalScore}/100 · ${analysis.trend.direction} · ${formatPercent(
    analysis.ticker.changePercent24h
  )} today`;
  const sharePath = `/coin/${analysis.symbol}`;

  return (
    <div className="min-h-screen bg-background ghost-grid">
      <Navbar />
      <MarketPulseTicker />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 space-y-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">{analysis.symbol.replace('USDT', '')}</h1>
              <div className="flex items-center gap-4">
                <span className="text-3xl font-mono font-bold">
                  ${formatPrice(analysis.ticker.price)}
                </span>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded text-lg font-semibold ${getChangeColor(
                    analysis.ticker.changePercent24h
                  )}`}
                >
                  {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                  {formatPercent(analysis.ticker.changePercent24h)}
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">GhostScore</div>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-4xl font-bold">{analysis.ghostScore.totalScore}</span>
                <span className="text-2xl text-muted-foreground">/100</span>
                <span className="text-2xl">{ghostInterpretation.emoji}</span>
              </div>
              <div className="text-sm font-semibold text-primary">{ghostInterpretation.label}</div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              disabled={explainMutation.isLoading}
              onClick={() => explainMutation.mutate({ symbol: analysis.symbol })}
            >
              {explainMutation.isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ghost is thinking...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2 text-primary" />
                  Have Ghost explain this
                </>
              )}
            </Button>
          </div>
        </div>

        {explainMutation.error && (
          <p className="text-sm text-destructive mb-4">{explainMutation.error.message}</p>
        )}

        <ShareCard
          title={`${analysis.symbol.replace('USDT', '')} · GhostFX Analysis`}
          description={shareDescription}
          path={sharePath}
          hashtags={[analysis.symbol.replace('USDT', ''), 'GhostScore']}
          className="mb-8"
        />

        {explanation && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle>Ghost's Take</CardTitle>
              <CardDescription>Friendly breakdown of the current setup</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                {explanation}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">24h High</div>
              <div className="text-xl font-mono font-bold">${formatPrice(analysis.ticker.high24h)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">24h Low</div>
              <div className="text-xl font-mono font-bold">${formatPrice(analysis.ticker.low24h)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">24h Volume</div>
              <div className="text-xl font-mono font-bold">${formatLargeNumber(analysis.ticker.volumeQuote24h)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Last Update</div>
              <div className="text-xl font-mono font-bold">{formatTimeAgo(analysis.timestamp)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Derivatives Bar */}
        {derivatives && (
          <div className="mb-8">
            <DerivativesBar
              symbol={analysis.symbol}
              data={{
                openInterest: derivatives.openInterest,
                fundingRate: derivatives.fundingRate,
                cumulativeVolumeDelta: derivatives.cumulativeVolumeDelta,
                longShortRatio: derivatives.longShortRatio,
                liquidationImbalance: derivatives.liquidationImbalance,
                timestamp: derivatives.timestamp,
              }}
              subScore={analysis.ghostScore?.derivatives?.score}
              evidence={
                analysis.ghostScore?.derivatives
                  ? `Funding: ${formatPercent(derivatives.fundingRate * 100)} · L/S Ratio: ${derivatives.longShortRatio.toFixed(2)} · OI: $${formatLargeNumber(derivatives.openInterest)}`
                  : undefined
              }
            />
          </div>
        )}

        {/* GhostScore 2.0 Panel */}
        <div className="mb-8">
          <GhostScorePanel
            totalScore={analysis.ghostScore.totalScore}
            interpretation={analysis.ghostScore.interpretation}
            trend={{
              score: analysis.ghostScore.trend.score,
              weight: analysis.ghostScore.trend.weight,
              sparkline: analysis.ghostScore.trend.sparkline,
              direction: analysis.ghostScore.trend.direction,
              ema50: analysis.trend.ema50,
              ema200: analysis.trend.ema200,
            }}
            momentum={{
              score: analysis.ghostScore.momentum.score,
              weight: analysis.ghostScore.momentum.weight,
              sparkline: analysis.ghostScore.momentum.sparkline,
              rsi: analysis.ghostScore.momentum.rsi,
              condition: analysis.ghostScore.momentum.rsiCondition,
            }}
            volatility={{
              score: analysis.ghostScore.volatility.score,
              weight: analysis.ghostScore.volatility.weight,
              sparkline: analysis.ghostScore.volatility.sparkline,
              atr: analysis.ghostScore.volatility.atr,
              atrPercent: analysis.ghostScore.volatility.atrPercent,
            }}
            structure={{
              score: analysis.ghostScore.structure.score,
              weight: analysis.ghostScore.structure.weight,
              sparkline: analysis.ghostScore.structure.sparkline,
              nearSupport: analysis.ghostScore.structure.nearSupport,
              nearResistance: analysis.ghostScore.structure.nearResistance,
            }}
            volume={{
              score: analysis.ghostScore.volume.score,
              weight: analysis.ghostScore.volume.weight,
              sparkline: analysis.ghostScore.volume.sparkline,
              volumeRatio: analysis.ghostScore.volume.volumeRatio,
            }}
            derivatives={{
              score: analysis.ghostScore.derivatives.score,
              weight: analysis.ghostScore.derivatives.weight,
              sparkline: analysis.ghostScore.derivatives.sparkline,
              fundingRate: analysis.ghostScore.derivatives.fundingRate,
              longShortRatio: analysis.ghostScore.derivatives.longShortRatio,
              openInterest: analysis.ghostScore.derivatives.openInterest,
            }}
            evidence={analysis.ghostScore.evidence || []}
          />
        </div>

        {/* Main Analysis Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Trend */}
          <Card className="border-blue-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Direction</span>
                <span className={`font-semibold ${
                  analysis.trend.direction === 'UPTREND' ? 'text-green-500' :
                  analysis.trend.direction === 'DOWNTREND' ? 'text-red-500' :
                  'text-muted-foreground'
                }`}>
                  {analysis.trend.direction}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">EMA50</span>
                <span className="font-mono">${formatPrice(analysis.trend.ema50)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">EMA200</span>
                <span className="font-mono">${formatPrice(analysis.trend.ema200)}</span>
              </div>
              <div className="pt-2 text-xs text-muted-foreground">
                {analysis.trend.description}
              </div>
            </CardContent>
          </Card>

          {/* Momentum */}
          <Card className="border-purple-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-500" />
                Momentum
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">RSI</span>
                <span className={`font-semibold ${
                  analysis.momentum.condition === 'OVERSOLD' ? 'text-blue-500' :
                  analysis.momentum.condition === 'OVERBOUGHT' ? 'text-orange-500' :
                  'text-muted-foreground'
                }`}>
                  {analysis.momentum.rsi.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Condition</span>
                <span className="font-semibold">{analysis.momentum.condition}</span>
              </div>
              <div className="pt-2 text-xs text-muted-foreground">
                {analysis.momentum.description}
              </div>
            </CardContent>
          </Card>

          {/* Volatility */}
          <Card className="border-orange-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-500" />
                Volatility
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">ATR</span>
                <span className="font-mono">${analysis.volatility.atr.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">ATR %</span>
                <span className="font-mono">{analysis.volatility.atrPercent.toFixed(2)}%</span>
              </div>
              <div className="pt-2 text-xs text-muted-foreground">
                {analysis.volatility.description}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Support & Resistance */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Support & Resistance Levels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-green-500 mb-3">Support</h4>
                <div className="space-y-2">
                  {analysis.levels.support.length > 0 ? (
                    analysis.levels.support.map((level, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-green-500/10 rounded">
                        <span className="text-sm">S{i + 1}</span>
                        <span className="font-mono font-bold">${formatPrice(level)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No strong support identified</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-red-500 mb-3">Resistance</h4>
                <div className="space-y-2">
                  {analysis.levels.resistance.length > 0 ? (
                    analysis.levels.resistance.map((level, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-red-500/10 rounded">
                        <span className="text-sm">R{i + 1}</span>
                        <span className="font-mono font-bold">${formatPrice(level)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No strong resistance identified</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suggested Setup */}
        {analysis.suggestedSetup && (
          <Card className="border-primary/50 glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-primary" />
                Suggested Setup
              </CardTitle>
              <CardDescription>{analysis.suggestedSetup.reasoning}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Direction</div>
                  <div className={`text-lg font-bold ${
                    analysis.suggestedSetup.direction === 'LONG' ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {analysis.suggestedSetup.direction}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Entry</div>
                  <div className="text-lg font-mono font-bold">${formatPrice(analysis.suggestedSetup.entry)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Stop Loss</div>
                  <div className="text-lg font-mono font-bold text-red-500">${formatPrice(analysis.suggestedSetup.stopLoss)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Take Profit</div>
                  <div className="text-lg font-mono font-bold text-green-500">${formatPrice(analysis.suggestedSetup.takeProfit1)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">R:R</div>
                  <div className="text-lg font-bold text-primary">1:{analysis.suggestedSetup.riskReward}</div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                ⚠️ <strong>Disclaimer:</strong> This is educational analysis, not financial advice. Always do your own research and manage risk appropriately.
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

