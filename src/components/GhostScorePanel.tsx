'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPercent } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  BarChart3,
  Target,
  DollarSign,
  BarChart4,
  Info,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface SubScoreData {
  score: number;
  weight: number;
  sparkline?: number[];
}

interface GhostScorePanelProps {
  totalScore: number;
  interpretation: {
    label: string;
    description: string;
    emoji: string;
  };
  trend: SubScoreData & {
    direction: string;
    ema50?: number;
    ema200?: number;
  };
  momentum: SubScoreData & {
    rsi: number;
    condition: string;
  };
  volatility: SubScoreData & {
    atr: number;
    atrPercent: number;
  };
  structure: SubScoreData & {
    nearSupport: boolean;
    nearResistance: boolean;
  };
  volume: SubScoreData & {
    volumeRatio: number;
  };
  derivatives: SubScoreData & {
    fundingRate: number;
    longShortRatio: number;
    openInterest: number;
  };
  evidence: string[];
}

const MiniSparkline = ({ data, color = '#8884d8' }: { data?: number[]; color?: string }) => {
  if (!data || data.length === 0) {
    return <div className="w-12 h-6 bg-muted/20 rounded" />;
  }

  const chartData = data.map((value, index) => ({ value, index }));

  return (
    <div className="w-12 h-6">
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

export function GhostScorePanel({
  totalScore,
  interpretation,
  trend,
  momentum,
  volatility,
  structure,
  volume,
  derivatives,
  evidence,
}: GhostScorePanelProps) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 70) return 'bg-green-500/10 border-green-500/30';
    if (score >= 50) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  const SubScoreRow = ({
    icon: Icon,
    label,
    score,
    weight,
    sparkline,
    color,
    details,
  }: {
    icon: any;
    label: string;
    score: number;
    weight: number;
    sparkline?: number[];
    color: string;
    details: string;
  }) => (
    <div className={`p-3 rounded-lg border ${getScoreBgColor(score)}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs text-muted-foreground">({weight}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <MiniSparkline data={sparkline} color={color.replace('text-', '#')} />
          <span className={`text-lg font-bold ${getScoreColor(score)}`}>{score}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{details}</p>
    </div>
  );

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            GhostScore 2.0
          </CardTitle>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end mb-1">
              <span className="text-4xl font-bold">{totalScore}</span>
              <span className="text-2xl text-muted-foreground">/100</span>
              <span className="text-3xl">{interpretation.emoji}</span>
            </div>
            <div className="text-sm font-semibold text-primary">{interpretation.label}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sub-scores Breakdown */}
        <div className="space-y-3">
          <SubScoreRow
            icon={Activity}
            label="Trend"
            score={trend.score}
            weight={trend.weight}
            sparkline={trend.sparkline}
            color="text-blue-500"
            details={`${trend.direction} · EMA50: ${trend.ema50?.toFixed(2) || 'N/A'} · EMA200: ${trend.ema200?.toFixed(2) || 'N/A'}`}
          />

          <SubScoreRow
            icon={Zap}
            label="Momentum"
            score={momentum.score}
            weight={momentum.weight}
            sparkline={momentum.sparkline}
            color="text-purple-500"
            details={`RSI: ${momentum.rsi.toFixed(1)} · ${momentum.condition}`}
          />

          <SubScoreRow
            icon={BarChart3}
            label="Volatility"
            score={volatility.score}
            weight={volatility.weight}
            sparkline={volatility.sparkline}
            color="text-orange-500"
            details={`ATR: ${volatility.atr.toFixed(2)} · ${volatility.atrPercent.toFixed(2)}% of price`}
          />

          <SubScoreRow
            icon={Target}
            label="Structure"
            score={structure.score}
            weight={structure.weight}
            sparkline={structure.sparkline}
            color="text-cyan-500"
            details={`${structure.nearSupport ? 'Near support' : ''} ${structure.nearResistance ? 'Near resistance' : ''} ${!structure.nearSupport && !structure.nearResistance ? 'Clean chart' : ''}`}
          />

          <SubScoreRow
            icon={BarChart4}
            label="Volume"
            score={volume.score}
            weight={volume.weight}
            sparkline={volume.sparkline}
            color="text-teal-500"
            details={`Volume ratio: ${volume.volumeRatio.toFixed(2)}x recent avg`}
          />

          <SubScoreRow
            icon={DollarSign}
            label="Derivatives"
            score={derivatives.score}
            weight={derivatives.weight}
            sparkline={derivatives.sparkline}
            color="text-pink-500"
            details={`Funding: ${formatPercent(derivatives.fundingRate * 100)} · L/S: ${derivatives.longShortRatio.toFixed(2)} · OI: $${(derivatives.openInterest / 1e6).toFixed(1)}M`}
          />
        </div>

        {/* Evidence Panel */}
        {evidence && evidence.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="evidence" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" />
                  Evidence & Insights ({evidence.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 mt-2">
                  {evidence.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Score Interpretation */}
        <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
          <strong>Score breakdown:</strong> Each component is weighted by importance. Trend (30%), Momentum
          (20%), Volatility (15%), Structure (15%), Volume (10%), Derivatives (10%).
        </div>
      </CardContent>
    </Card>
  );
}

