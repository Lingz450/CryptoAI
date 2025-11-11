// Advanced backtesting engine with walk-forward and Monte Carlo
import type { Candle } from '@/lib/exchanges/types';
import {
  calculateEMA,
  calculateRSI,
  calculateATR,
  calculateADX,
} from '@/lib/indicators';

export interface StrategyProfile {
  name: string;
  type: 'EMA_CROSS' | 'RSI_EXTREMES' | 'ATR_BREAKOUT' | 'FUNDING_DIVERGENCE' | 'CUSTOM';
  params: {
    emaFast?: number;
    emaSlow?: number;
    rsiPeriod?: number;
    rsiOverbought?: number;
    rsiOversold?: number;
    atrMultiplier?: number;
    atrPeriod?: number;
    fundingThreshold?: number;
    volumeMultiplier?: number;
  };
  entryRules: string[];
  exitRules: string[];
  riskPercent: number; // % of capital per trade
  stopLossATR?: number; // ATR multiplier for SL
  takeProfitATR?: number; // ATR multiplier for TP
}

export interface Trade {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  direction: 'LONG' | 'SHORT';
  pnl: number;
  pnlPercent: number;
  rMultiple: number;
  maxDrawdown: number;
  holdingPeriod: number; // hours
}

export interface BacktestResults {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  expectancy: number;
  avgRMultiple: number;
  totalReturn: number;
  cagr: number;
  trades: Trade[];
  equityCurve: Array<{ time: number; equity: number }>;
  drawdownCurve: Array<{ time: number; drawdown: number }>;
}

export interface MonteCarloResults {
  simulations: number;
  distributions: {
    returns: number[];
    sharpe: number[];
    maxDrawdown: number[];
    winRate: number[];
  };
  confidence: {
    percentile5: number;
    percentile25: number;
    median: number;
    percentile75: number;
    percentile95: number;
  };
  riskOfRuin: number; // Probability of losing 50%+
}

export interface WalkForwardResults {
  windows: Array<{
    trainStart: number;
    trainEnd: number;
    testStart: number;
    testEnd: number;
    trainResults: BacktestResults;
    testResults: BacktestResults;
    efficiency: number; // test/train performance ratio
  }>;
  avgEfficiency: number;
  isRobust: boolean; // efficiency > 0.7
  overallResults: BacktestResults;
}

export class BacktestEngine {
  /**
   * Run standard backtest
   */
  async runBacktest(
    strategy: StrategyProfile,
    candles: Candle[],
    initialCapital: number = 10000
  ): Promise<BacktestResults> {
    const trades: Trade[] = [];
    let capital = initialCapital;
    let peakCapital = initialCapital;
    let maxDrawdown = 0;
    
    const equityCurve: Array<{ time: number; equity: number }> = [
      { time: candles[0].timestamp, equity: capital }
    ];

    // Pre-calculate indicators
    const prices = candles.map(c => c.close);
    const rsiValues = calculateRSI(prices, strategy.params.rsiPeriod || 14);
    const atrValues = calculateATR(candles, strategy.params.atrPeriod || 14);
    const emaFast = calculateEMA(prices, strategy.params.emaFast || 50);
    const emaSlow = calculateEMA(prices, strategy.params.emaSlow || 200);

    let inPosition = false;
    let positionEntry: { price: number; time: number; direction: 'LONG' | 'SHORT' } | null = null;

    // Iterate through candles
    for (let i = 200; i < candles.length; i++) {
      const candle = candles[i];
      const signal = this.evaluateStrategy(strategy, i, {
        prices,
        rsi: rsiValues,
        atr: atrValues,
        emaFast,
        emaSlow,
        candles,
      });

      // Entry logic
      if (!inPosition && signal.entry) {
        inPosition = true;
        positionEntry = {
          price: candle.close,
          time: candle.timestamp,
          direction: signal.direction!,
        };
      }

      // Exit logic
      if (inPosition && positionEntry && signal.exit) {
        const exitPrice = candle.close;
        const entryPrice = positionEntry.price;
        
        let pnl: number;
        if (positionEntry.direction === 'LONG') {
          pnl = (exitPrice - entryPrice) / entryPrice;
        } else {
          pnl = (entryPrice - exitPrice) / entryPrice;
        }

        const positionSize = capital * (strategy.riskPercent / 100);
        const tradePnl = positionSize * pnl;
        capital += tradePnl;

        // Calculate R-multiple (actual return / risk)
        const risk = strategy.stopLossATR 
          ? atrValues[i] * strategy.stopLossATR 
          : entryPrice * 0.02; // 2% default
        const rMultiple = Math.abs(exitPrice - entryPrice) / risk * (pnl > 0 ? 1 : -1);

        trades.push({
          entryTime: positionEntry.time,
          exitTime: candle.timestamp,
          entryPrice: positionEntry.price,
          exitPrice: exitPrice,
          direction: positionEntry.direction,
          pnl: tradePnl,
          pnlPercent: pnl * 100,
          rMultiple,
          maxDrawdown: 0,
          holdingPeriod: (candle.timestamp - positionEntry.time) / (1000 * 60 * 60),
        });

        // Update drawdown
        if (capital > peakCapital) {
          peakCapital = capital;
        }
        const currentDrawdown = ((peakCapital - capital) / peakCapital) * 100;
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
        }

        equityCurve.push({ time: candle.timestamp, equity: capital });
        
        inPosition = false;
        positionEntry = null;
      }
    }

    return this.calculateMetrics(trades, equityCurve, initialCapital, maxDrawdown);
  }

  /**
   * Evaluate strategy at a specific bar
   */
  private evaluateStrategy(
    strategy: StrategyProfile,
    index: number,
    indicators: {
      prices: number[];
      rsi: number[];
      atr: number[];
      emaFast: number[];
      emaSlow: number[];
      candles: Candle[];
    }
  ): { entry: boolean; exit: boolean; direction?: 'LONG' | 'SHORT' } {
    const { prices, rsi, atr, emaFast, emaSlow, candles } = indicators;

    switch (strategy.type) {
      case 'EMA_CROSS': {
        const prevFast = emaFast[index - 1];
        const prevSlow = emaSlow[index - 1];
        const currFast = emaFast[index];
        const currSlow = emaSlow[index];

        const goldenCross = prevFast <= prevSlow && currFast > currSlow;
        const deathCross = prevFast >= prevSlow && currFast < currSlow;

        return {
          entry: goldenCross || deathCross,
          exit: goldenCross ? deathCross : goldenCross,
          direction: goldenCross ? 'LONG' : 'SHORT',
        };
      }

      case 'RSI_EXTREMES': {
        const currentRSI = rsi[index];
        const oversold = strategy.params.rsiOversold || 30;
        const overbought = strategy.params.rsiOverbought || 70;

        const longEntry = currentRSI < oversold;
        const shortEntry = currentRSI > overbought;
        const longExit = currentRSI > 50;
        const shortExit = currentRSI < 50;

        return {
          entry: longEntry || shortEntry,
          exit: longExit || shortExit,
          direction: longEntry ? 'LONG' : 'SHORT',
        };
      }

      case 'ATR_BREAKOUT': {
        const currentATR = atr[index];
        const avgATR = atr.slice(Math.max(0, index - 20), index)
          .reduce((sum, val) => sum + val, 0) / 20;
        const multiplier = strategy.params.atrMultiplier || 1.5;

        const breakout = currentATR > avgATR * multiplier;
        const trend = prices[index] > prices[index - 10];

        return {
          entry: breakout,
          exit: currentATR < avgATR * 0.8,
          direction: trend ? 'LONG' : 'SHORT',
        };
      }

      default:
        return { entry: false, exit: false };
    }
  }

  /**
   * Calculate performance metrics
   */
  private calculateMetrics(
    trades: Trade[],
    equityCurve: Array<{ time: number; equity: number }>,
    initialCapital: number,
    maxDrawdown: number
  ): BacktestResults {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
        largestWin: 0,
        largestLoss: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        expectancy: 0,
        avgRMultiple: 0,
        totalReturn: 0,
        cagr: 0,
        trades: [],
        equityCurve: [],
        drawdownCurve: [],
      };
    }

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);

    const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

    const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;

    const returns = trades.map(t => t.pnlPercent / 100);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );

    const sharpeRatio = stdDev > 0 ? (avgReturn * Math.sqrt(252)) / stdDev : 0;

    const downside = returns.filter(r => r < 0);
    const downsideStdDev = Math.sqrt(
      downside.reduce((sum, r) => sum + Math.pow(r, 2), 0) / (downside.length || 1)
    );
    const sortinoRatio = downsideStdDev > 0 ? (avgReturn * Math.sqrt(252)) / downsideStdDev : 0;

    const expectancy = avgWin * (winningTrades.length / trades.length) - 
                       avgLoss * (losingTrades.length / trades.length);

    const finalCapital = equityCurve[equityCurve.length - 1].equity;
    const totalReturn = ((finalCapital - initialCapital) / initialCapital) * 100;

    const years = (equityCurve[equityCurve.length - 1].time - equityCurve[0].time) / (1000 * 60 * 60 * 24 * 365);
    const cagr = years > 0 ? (Math.pow(finalCapital / initialCapital, 1 / years) - 1) * 100 : 0;

    const avgRMultiple = trades.reduce((sum, t) => sum + t.rMultiple, 0) / trades.length;

    // Calculate drawdown curve
    let peak = initialCapital;
    const drawdownCurve = equityCurve.map(point => {
      if (point.equity > peak) peak = point.equity;
      const drawdown = ((peak - point.equity) / peak) * 100;
      return { time: point.time, drawdown };
    });

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / trades.length) * 100,
      profitFactor,
      avgWin,
      avgLoss,
      largestWin: Math.max(...trades.map(t => t.pnl)),
      largestLoss: Math.min(...trades.map(t => t.pnl)),
      maxDrawdown: Math.max(...drawdownCurve.map(d => d.drawdown)),
      maxDrawdownPercent: maxDrawdown,
      sharpeRatio,
      sortinoRatio,
      expectancy,
      avgRMultiple,
      totalReturn,
      cagr,
      trades,
      equityCurve,
      drawdownCurve,
    };
  }

  /**
   * Run Monte Carlo simulation
   */
  async runMonteCarlo(
    strategy: StrategyProfile,
    baseResults: BacktestResults,
    simulations: number = 1000
  ): Promise<MonteCarloResults> {
    const distributions = {
      returns: [] as number[],
      sharpe: [] as number[],
      maxDrawdown: [] as number[],
      winRate: [] as number[],
    };

    const trades = baseResults.trades;

    for (let sim = 0; sim < simulations; sim++) {
      // Randomly resample trades with replacement
      const resampledTrades: Trade[] = [];
      for (let i = 0; i < trades.length; i++) {
        const randomIndex = Math.floor(Math.random() * trades.length);
        resampledTrades.push({ ...trades[randomIndex] });
      }

      // Calculate metrics for this simulation
      const simResults = this.calculateMetrics(
        resampledTrades,
        baseResults.equityCurve,
        10000,
        0
      );

      distributions.returns.push(simResults.totalReturn);
      distributions.sharpe.push(simResults.sharpeRatio);
      distributions.maxDrawdown.push(simResults.maxDrawdown);
      distributions.winRate.push(simResults.winRate);
    }

    // Sort and calculate percentiles
    const sortedReturns = distributions.returns.sort((a, b) => a - b);
    const confidence = {
      percentile5: sortedReturns[Math.floor(simulations * 0.05)],
      percentile25: sortedReturns[Math.floor(simulations * 0.25)],
      median: sortedReturns[Math.floor(simulations * 0.5)],
      percentile75: sortedReturns[Math.floor(simulations * 0.75)],
      percentile95: sortedReturns[Math.floor(simulations * 0.95)],
    };

    // Risk of ruin (probability of losing 50%+)
    const ruinCount = distributions.returns.filter(r => r < -50).length;
    const riskOfRuin = (ruinCount / simulations) * 100;

    return {
      simulations,
      distributions,
      confidence,
      riskOfRuin,
    };
  }

  /**
   * Run walk-forward analysis
   */
  async runWalkForward(
    strategy: StrategyProfile,
    candles: Candle[],
    trainMonths: number = 6,
    testMonths: number = 1
  ): Promise<WalkForwardResults> {
    const windows: WalkForwardResults['windows'] = [];
    const msPerMonth = 30 * 24 * 60 * 60 * 1000;
    
    const trainPeriod = trainMonths * msPerMonth;
    const testPeriod = testMonths * msPerMonth;
    const totalPeriod = trainPeriod + testPeriod;

    const startTime = candles[0].timestamp;
    const endTime = candles[candles.length - 1].timestamp;

    let currentStart = startTime;

    while (currentStart + totalPeriod <= endTime) {
      const trainEnd = currentStart + trainPeriod;
      const testEnd = trainEnd + testPeriod;

      // Split data
      const trainData = candles.filter(
        c => c.timestamp >= currentStart && c.timestamp < trainEnd
      );
      const testData = candles.filter(
        c => c.timestamp >= trainEnd && c.timestamp < testEnd
      );

      if (trainData.length < 200 || testData.length < 50) {
        break;
      }

      // Run backtests
      const trainResults = await this.runBacktest(strategy, trainData);
      const testResults = await this.runBacktest(strategy, testData);

      // Calculate efficiency
      const efficiency = testResults.sharpeRatio / (trainResults.sharpeRatio || 1);

      windows.push({
        trainStart: currentStart,
        trainEnd,
        testStart: trainEnd,
        testEnd,
        trainResults,
        testResults,
        efficiency,
      });

      currentStart = trainEnd; // Walk forward by test period
    }

    const avgEfficiency = windows.reduce((sum, w) => sum + w.efficiency, 0) / windows.length;
    const isRobust = avgEfficiency > 0.7; // Test performance is at least 70% of train

    // Overall results on full dataset
    const overallResults = await this.runBacktest(strategy, candles);

    return {
      windows,
      avgEfficiency,
      isRobust,
      overallResults,
    };
  }
}

export const backtestEngine = new BacktestEngine();

