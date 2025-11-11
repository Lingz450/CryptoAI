'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPercent, formatLargeNumber } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  AlertCircle,
  Award,
  BarChart3,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import type { BacktestResults, MonteCarloResults, WalkForwardResults } from '@/lib/services/backtestEngine';

interface StrategyLabResultsProps {
  results: BacktestResults;
  monteCarlo?: MonteCarloResults;
  walkForward?: WalkForwardResults;
}

export function StrategyLabResults({
  results,
  monteCarlo,
  walkForward,
}: StrategyLabResultsProps) {
  const getMetricColor = (value: number, good: number, bad: number) => {
    if (value >= good) return 'text-green-500';
    if (value <= bad) return 'text-red-500';
    return 'text-yellow-500';
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Return</div>
            <div className={`text-2xl font-bold ${getMetricColor(results.totalReturn, 20, 0)}`}>
              {formatPercent(results.totalReturn)}
            </div>
            <div className="text-xs text-muted-foreground">
              CAGR: {results.cagr.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Win Rate</div>
            <div className={`text-2xl font-bold ${getMetricColor(results.winRate, 50, 40)}`}>
              {results.winRate.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">
              {results.winningTrades}/{results.totalTrades} trades
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Profit Factor</div>
            <div className={`text-2xl font-bold ${getMetricColor(results.profitFactor, 2, 1)}`}>
              {results.profitFactor.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">
              Avg R: {results.avgRMultiple.toFixed(2)}R
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Max Drawdown</div>
            <div className={`text-2xl font-bold ${getMetricColor(-results.maxDrawdown, -10, -30)}`}>
              -{results.maxDrawdown.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">
              Sharpe: {results.sharpeRatio.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Equity Curve */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Equity Curve
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={results.equityCurve}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tickFormatter={(t) => new Date(t).toLocaleDateString()}
                stroke="#666"
              />
              <YAxis stroke="#666" tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                labelFormatter={(t) => new Date(t).toLocaleString()}
                formatter={(v: number) => [`$${v.toFixed(2)}`, 'Equity']}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="#22c55e"
                fillOpacity={1}
                fill="url(#equityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Drawdown Curve */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-500" />
            Drawdown Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={results.drawdownCurve}>
              <defs>
                <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tickFormatter={(t) => new Date(t).toLocaleDateString()}
                stroke="#666"
              />
              <YAxis stroke="#666" tickFormatter={(v) => `-${v.toFixed(0)}%`} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                labelFormatter={(t) => new Date(t).toLocaleString()}
                formatter={(v: number) => [`-${v.toFixed(2)}%`, 'Drawdown']}
              />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#ddGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Trade Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Trade Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Trades</span>
              <span className="font-semibold">{results.totalTrades}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Winning Trades</span>
              <span className="font-semibold text-green-500">{results.winningTrades}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Losing Trades</span>
              <span className="font-semibold text-red-500">{results.losingTrades}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg Win</span>
              <span className="font-semibold text-green-500">
                ${results.avgWin.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg Loss</span>
              <span className="font-semibold text-red-500">
                ${results.avgLoss.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Expectancy</span>
              <span className={`font-semibold ${results.expectancy > 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${results.expectancy.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Risk Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Sharpe Ratio</span>
              <span className={`font-semibold ${getMetricColor(results.sharpeRatio, 1.5, 0.5)}`}>
                {results.sharpeRatio.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Sortino Ratio</span>
              <span className={`font-semibold ${getMetricColor(results.sortinoRatio, 2, 1)}`}>
                {results.sortinoRatio.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg R-Multiple</span>
              <span className={`font-semibold ${getMetricColor(results.avgRMultiple, 2, 0)}`}>
                {results.avgRMultiple.toFixed(2)}R
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Largest Win</span>
              <span className="font-semibold text-green-500">
                ${results.largestWin.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Largest Loss</span>
              <span className="font-semibold text-red-500">
                ${results.largestLoss.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monte Carlo Results */}
      {monteCarlo && (
        <Card className="border-purple-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-500" />
              Monte Carlo Simulation ({monteCarlo.simulations.toLocaleString()} runs)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-5 gap-2 text-center">
              <div>
                <div className="text-xs text-muted-foreground">5th %ile</div>
                <div className="text-sm font-bold text-red-500">
                  {monteCarlo.confidence.percentile5.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">25th %ile</div>
                <div className="text-sm font-bold text-orange-500">
                  {monteCarlo.confidence.percentile25.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Median</div>
                <div className="text-sm font-bold text-primary">
                  {monteCarlo.confidence.median.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">75th %ile</div>
                <div className="text-sm font-bold text-green-500">
                  {monteCarlo.confidence.percentile75.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">95th %ile</div>
                <div className="text-sm font-bold text-green-600">
                  {monteCarlo.confidence.percentile95.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Risk of Ruin (50%+ loss)</span>
                <span className={`text-lg font-bold ${monteCarlo.riskOfRuin > 5 ? 'text-red-500' : 'text-green-500'}`}>
                  {monteCarlo.riskOfRuin.toFixed(2)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Walk-Forward Results */}
      {walkForward && (
        <Card className="border-blue-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              Walk-Forward Analysis ({walkForward.windows.length} windows)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Avg Efficiency</div>
                <div className={`text-2xl font-bold ${getMetricColor(walkForward.avgEfficiency * 100, 70, 50)}`}>
                  {(walkForward.avgEfficiency * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Robust?</div>
                <div className={`text-2xl font-bold ${walkForward.isRobust ? 'text-green-500' : 'text-red-500'}`}>
                  {walkForward.isRobust ? 'YES' : 'NO'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Windows</div>
                <div className="text-2xl font-bold text-primary">
                  {walkForward.windows.length}
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded">
              <strong>Efficiency</strong> measures how well the strategy performs on out-of-sample (test) data compared to in-sample (train) data. 
              &gt;70% is considered robust (not overfitted).
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

