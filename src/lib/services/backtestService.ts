import { calculateEMA, calculateRSI } from '@/lib/indicators';
import { priceService } from '@/lib/services/priceService';
import type { ExchangeName } from '@/lib/exchanges';

export type BacktestParams = {
  symbol: string;
  fastPeriod: number;
  slowPeriod: number;
  interval: string;
  limit: number;
  exchange?: ExchangeName;
  minRsi?: number;
  maxRsi?: number;
};

export type BacktestTrade = {
  entryIndex: number;
  exitIndex: number;
  entryPrice: number;
  exitPrice: number;
  profitPct: number;
};

export type BacktestReport = {
  winRate: number;
  maxDrawdown: number;
  profitFactor: number;
  totalReturn: number;
  trades: BacktestTrade[];
  equityCurve: number[];
  signals: number[];
};

export async function runEmaBacktest(params: BacktestParams): Promise<BacktestReport> {
  const candles = await priceService.getCandles(
    params.symbol,
    params.interval,
    params.limit,
    params.exchange
  );

  const closes = candles.map((c) => c.close);
  if (closes.length < params.slowPeriod + 5) {
    throw new Error('Not enough candles to run that backtest.');
  }

  const fastSeries = calculateEMA(closes, params.fastPeriod);
  const slowSeries = calculateEMA(closes, params.slowPeriod);
  const rsiSeries = calculateRSI(closes, 14);

  const fastArr = Array<number | undefined>(closes.length).fill(undefined);
  const slowArr = Array<number | undefined>(closes.length).fill(undefined);
  const rsiArr = Array<number | undefined>(closes.length).fill(undefined);

  fastSeries.forEach((value, idx) => {
    fastArr[idx + params.fastPeriod - 1] = value;
  });
  slowSeries.forEach((value, idx) => {
    slowArr[idx + params.slowPeriod - 1] = value;
  });
  rsiSeries.forEach((value, idx) => {
    rsiArr[idx + 14] = value;
  });

  const trades: BacktestTrade[] = [];
  const equityCurve: number[] = [];
  let position: { entryPrice: number; entryIndex: number } | null = null;
  let equity = 100;
  let peak = equity;

  const rsiMin = params.minRsi ?? 0;
  const rsiMax = params.maxRsi ?? 100;

  for (let i = 1; i < closes.length; i++) {
    const fast = fastArr[i];
    const slow = slowArr[i];
    const prevFast = fastArr[i - 1];
    const prevSlow = slowArr[i - 1];
    const rsi = rsiArr[i];

    if (
      fast === undefined ||
      slow === undefined ||
      prevFast === undefined ||
      prevSlow === undefined
    ) {
      equityCurve.push(equity);
      continue;
    }

    const previousRsi = rsiArr[i - 1];
    const rsiFilter =
      rsi !== undefined &&
      rsi >= rsiMin &&
      rsi <= rsiMax &&
      (previousRsi === undefined || rsi >= previousRsi);

    if (
      !position &&
      prevFast <= prevSlow &&
      fast > slow &&
      (params.minRsi == null || (rsi !== undefined && rsiFilter))
    ) {
      position = { entryPrice: closes[i], entryIndex: i };
    }

    if (
      position &&
      prevFast >= prevSlow &&
      fast < slow
    ) {
      const exitPrice = closes[i];
      const profitPct = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;

      trades.push({
        entryIndex: position.entryIndex,
        exitIndex: i,
        entryPrice: position.entryPrice,
        exitPrice,
        profitPct,
      });

      equity *= 1 + profitPct / 100;
      position = null;
    }

      equityCurve.push(equity);
      peak = Math.max(peak, equity);
  }

  const totalProfit = equity - 100;
  const winningTrades = trades.filter((trade) => trade.profitPct > 0);
  const losingTrades = trades.filter((trade) => trade.profitPct <= 0);
  const winRate = trades.length ? winningTrades.length / trades.length : 0;
  const avgWin = winningTrades.reduce((sum, t) => sum + t.profitPct, 0);
  const avgLoss = losingTrades.reduce((sum, t) => sum + Math.abs(t.profitPct), 0);
  const profitFactor = avgLoss === 0 ? winningTrades.length : avgWin / avgLoss;
  let equityHigh = 100;
  let maxDrawdown = 0;
  equityCurve.forEach((value) => {
    equityHigh = Math.max(equityHigh, value);
    const dd = equityHigh === 0 ? 0 : (equityHigh - value) / equityHigh;
    maxDrawdown = Math.max(maxDrawdown, dd);
  });

  return {
    winRate,
    profitFactor,
    maxDrawdown,
    totalReturn: totalProfit,
    trades,
    equityCurve,
    signals: trades.map((trade) => trade.entryIndex),
  };
}
