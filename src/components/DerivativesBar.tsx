'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPercent, formatLargeNumber } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Zap,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DerivativesBarProps {
  symbol: string;
  data: {
    openInterest: number;
    openInterestChange24h?: number;
    fundingRate: number;
    fundingRateChange24h?: number;
    cumulativeVolumeDelta: number;
    cvdChange24h?: number;
    longShortRatio: number;
    liquidationImbalance: number;
    liquidationLongs24h?: number;
    liquidationShorts24h?: number;
    timestamp: number;
  };
  sparklines?: {
    oi: number[];
    funding: number[];
    cvd: number[];
    lsr: number[];
  };
  evidence?: string;
  subScore?: number;
}

export function DerivativesBar({
  symbol,
  data,
  sparklines,
  evidence,
  subScore,
}: DerivativesBarProps) {
  const getFundingColor = (rate: number) => {
    if (rate > 0.01) return 'text-red-500';
    if (rate < -0.01) return 'text-green-500';
    return 'text-muted-foreground';
  };

  const getLSRColor = (ratio: number) => {
    if (ratio > 1.2) return 'text-red-500'; // Too many longs
    if (ratio < 0.8) return 'text-green-500'; // Too many shorts (contrarian bullish)
    return 'text-muted-foreground';
  };

  const getCVDColor = (cvd: number) => {
    if (cvd > 0) return 'text-green-500';
    if (cvd < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const getLiquidationColor = (imbalance: number) => {
    if (imbalance > 0.2) return 'text-red-500'; // More long liquidations
    if (imbalance < -0.2) return 'text-green-500'; // More short liquidations
    return 'text-muted-foreground';
  };

  const MiniSparkline = ({ data, color = '#8884d8' }: { data: number[]; color?: string }) => {
    if (!data || data.length === 0) return null;

    const chartData = data.map((value, index) => ({ value, index }));

    return (
      <div className="w-16 h-8">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-500" />
            Derivatives Flow
          </CardTitle>
          {subScore !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 cursor-help">
                    <span className="text-sm text-muted-foreground">Sub-Score</span>
                    <span className="text-xl font-bold text-purple-500">{subScore}/100</span>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">{evidence || 'Derivatives metrics analysis'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Open Interest */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="space-y-1 cursor-help">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <DollarSign className="w-3 h-3" />
                    Open Interest
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm">
                      ${formatLargeNumber(data.openInterest)}
                    </span>
                    {data.openInterestChange24h !== undefined && (
                      <span
                        className={`text-xs flex items-center ${
                          data.openInterestChange24h >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {data.openInterestChange24h >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {formatPercent(Math.abs(data.openInterestChange24h))}
                      </span>
                    )}
                  </div>
                  {sparklines?.oi && (
                    <MiniSparkline
                      data={sparklines.oi}
                      color={data.openInterestChange24h && data.openInterestChange24h >= 0 ? '#22c55e' : '#ef4444'}
                    />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Total value of open perpetual contracts. Rising OI with price = strong trend.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Funding Rate */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="space-y-1 cursor-help">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Zap className="w-3 h-3" />
                    Funding Rate
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-bold text-sm ${getFundingColor(data.fundingRate)}`}>
                      {formatPercent(data.fundingRate * 100)}
                    </span>
                    {data.fundingRateChange24h !== undefined && (
                      <span
                        className={`text-xs flex items-center ${
                          data.fundingRateChange24h >= 0 ? 'text-red-500' : 'text-green-500'
                        }`}
                      >
                        {data.fundingRateChange24h >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {formatPercent(Math.abs(data.fundingRateChange24h * 100))}
                      </span>
                    )}
                  </div>
                  {sparklines?.funding && (
                    <MiniSparkline
                      data={sparklines.funding}
                      color={data.fundingRate >= 0 ? '#ef4444' : '#22c55e'}
                    />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Positive = longs pay shorts. Negative = shorts pay longs. High funding = potential reversal.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* CVD */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="space-y-1 cursor-help">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Activity className="w-3 h-3" />
                    CVD
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-bold text-sm ${getCVDColor(data.cumulativeVolumeDelta)}`}>
                      {data.cumulativeVolumeDelta >= 0 ? '+' : ''}
                      {formatLargeNumber(data.cumulativeVolumeDelta)}
                    </span>
                    {data.cvdChange24h !== undefined && (
                      <span
                        className={`text-xs flex items-center ${
                          data.cvdChange24h >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {data.cvdChange24h >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {formatPercent(Math.abs(data.cvdChange24h))}
                      </span>
                    )}
                  </div>
                  {sparklines?.cvd && (
                    <MiniSparkline
                      data={sparklines.cvd}
                      color={data.cumulativeVolumeDelta >= 0 ? '#22c55e' : '#ef4444'}
                    />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Cumulative Volume Delta. Positive = buying pressure. Negative = selling pressure.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Long/Short Ratio */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="space-y-1 cursor-help">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Activity className="w-3 h-3" />
                    L/S Ratio
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-bold text-sm ${getLSRColor(data.longShortRatio)}`}>
                      {data.longShortRatio.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({data.longShortRatio > 1 ? 'Long' : 'Short'} biased)
                    </span>
                  </div>
                  {sparklines?.lsr && (
                    <MiniSparkline
                      data={sparklines.lsr}
                      color={data.longShortRatio > 1 ? '#ef4444' : '#22c55e'}
                    />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Ratio of long to short positions. {'>'} 1 = more longs. Extreme values = reversal risk.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Liquidations */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="space-y-1 cursor-help">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangle className="w-3 h-3" />
                    Liquidations
                  </div>
                  <div className="flex flex-col gap-1">
                    <span
                      className={`font-mono font-bold text-sm ${getLiquidationColor(
                        data.liquidationImbalance
                      )}`}
                    >
                      {data.liquidationImbalance > 0 ? 'Long' : 'Short'} Heavy
                    </span>
                    {data.liquidationLongs24h !== undefined && data.liquidationShorts24h !== undefined && (
                      <div className="text-xs space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-red-500">L:</span>
                          <span className="text-red-500">${formatLargeNumber(data.liquidationLongs24h)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-green-500">S:</span>
                          <span className="text-green-500">
                            ${formatLargeNumber(data.liquidationShorts24h)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  24h liquidation imbalance. More long liq = bearish. More short liq = bullish.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Evidence banner if provided */}
        {evidence && (
          <div className="mt-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <p className="text-xs text-purple-300 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{evidence}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

