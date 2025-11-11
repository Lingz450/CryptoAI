// Complete coin analysis service
import { priceService } from './priceService';
import { calculateGhostScore, interpretGhostScore, generateEvidence, type GhostScoreBreakdown } from './ghostScore';
import {
  calculateEMA,
  calculateRSI,
  calculateATR,
  detectTrend,
  findSupportResistance,
  checkRSICondition,
} from '../indicators';
import type { Ticker, Candle } from '../exchanges/types';

export interface CoinAnalysis {
  symbol: string;
  ticker: Ticker;
  trend: {
    direction: 'UPTREND' | 'DOWNTREND' | 'NEUTRAL';
    ema50: number;
    ema200: number;
    description: string;
  };
  momentum: {
    rsi: number;
    condition: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
    description: string;
  };
  volatility: {
    atr: number;
    atrPercent: number;
    description: string;
  };
  levels: {
    support: number[];
    resistance: number[];
    currentPrice: number;
  };
  ghostScore: GhostScoreBreakdown & {
    interpretation: ReturnType<typeof interpretGhostScore>;
    evidence: string[];
  };
  suggestedSetup?: {
    direction: 'LONG' | 'SHORT';
    entry: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    riskReward: number;
    reasoning: string;
  };
  timestamp: number;
}

export class AnalysisService {
  /**
   * Generate complete analysis for a coin
   */
  async analyzeCoin(symbol: string, exchange?: any): Promise<CoinAnalysis> {
    // Fetch ticker and candle data
    const [ticker, candles] = await Promise.all([
      priceService.getTicker(symbol, exchange),
      priceService.getCandles(symbol, '1h', 250, exchange),
    ]);

    if (candles.length < 200) {
      throw new Error(`Insufficient data for ${symbol} analysis`);
    }

    const prices = candles.map(c => c.close);
    const currentPrice = ticker.price;

    // Calculate indicators
    const ema50Values = calculateEMA(prices, 50);
    const ema200Values = calculateEMA(prices, 200);
    const rsiValues = calculateRSI(prices, 14);
    const atrValues = calculateATR(candles, 14);
    const trend = detectTrend(prices, 50, 200);
    const levels = findSupportResistance(candles, 100);

    // Get latest values
    const ema50 = ema50Values[ema50Values.length - 1];
    const ema200 = ema200Values[ema200Values.length - 1];
    const rsi = rsiValues[rsiValues.length - 1];
    const rsiCondition = checkRSICondition(rsi);
    const atr = atrValues[atrValues.length - 1];
    const atrPercent = (atr / currentPrice) * 100;

    // Calculate GhostScore
    const ghostScore = await calculateGhostScore(symbol, candles);
    const interpretation = interpretGhostScore(ghostScore.totalScore);
    const evidence = generateEvidence(ghostScore);

    // Generate trend description
    const trendDescription = this.describeTrend(trend, ema50, ema200, currentPrice);

    // Generate momentum description
    const momentumDescription = this.describeMomentum(rsi, rsiCondition);

    // Generate volatility description
    const volatilityDescription = this.describeVolatility(atrPercent);

    // Generate suggested setup
    const suggestedSetup = this.generateSetup(
      currentPrice,
      trend,
      rsi,
      levels,
      ghostScore.totalScore
    );

    return {
      symbol: symbol.toUpperCase(),
      ticker,
      trend: {
        direction: trend,
        ema50,
        ema200,
        description: trendDescription,
      },
      momentum: {
        rsi,
        condition: rsiCondition,
        description: momentumDescription,
      },
      volatility: {
        atr,
        atrPercent,
        description: volatilityDescription,
      },
      levels: {
        support: levels.support,
        resistance: levels.resistance,
        currentPrice,
      },
      ghostScore: {
        ...ghostScore,
        interpretation,
        evidence,
      },
      suggestedSetup,
      timestamp: Date.now(),
    };
  }

  /**
   * Describe trend in human language
   */
  private describeTrend(
    trend: 'UPTREND' | 'DOWNTREND' | 'NEUTRAL',
    ema50: number,
    ema200: number,
    currentPrice: number
  ): string {
    if (trend === 'UPTREND') {
      const gap = ((ema50 - ema200) / ema200) * 100;
      if (currentPrice > ema50) {
        return `Strong uptrend. Price trading above both EMAs. EMA50 is ${gap.toFixed(1)}% above EMA200. Bulls in control.`;
      }
      return `Uptrend structure intact. Price testing support at EMA50. Watch for bounce or breakdown.`;
    } else if (trend === 'DOWNTREND') {
      const gap = ((ema200 - ema50) / ema200) * 100;
      return `Downtrend active. Price below key moving averages. EMA50 is ${gap.toFixed(1)}% below EMA200. Bears in control.`;
    } else {
      return `Consolidation phase. EMAs converging. Waiting for directional breakout.`;
    }
  }

  /**
   * Describe momentum in human language
   */
  private describeMomentum(rsi: number, condition: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL'): string {
    if (condition === 'OVERSOLD') {
      return `RSI at ${rsi.toFixed(1)} — oversold territory. Potential reversal setup if support holds. Watch for bullish divergence.`;
    } else if (condition === 'OVERBOUGHT') {
      return `RSI at ${rsi.toFixed(1)} — overbought zone. Strong momentum but vulnerable to pullback. Consider taking profits.`;
    } else if (rsi > 55) {
      return `RSI at ${rsi.toFixed(1)} — healthy bullish momentum. Room to run higher before overbought.`;
    } else if (rsi < 45) {
      return `RSI at ${rsi.toFixed(1)} — bearish momentum building. Watch for breakdown confirmation.`;
    } else {
      return `RSI at ${rsi.toFixed(1)} — neutral zone. No clear momentum signal yet.`;
    }
  }

  /**
   * Describe volatility in human language
   */
  private describeVolatility(atrPercent: number): string {
    if (atrPercent < 1) {
      return `Low volatility (${atrPercent.toFixed(2)}%). Consolidating. Potential breakout loading.`;
    } else if (atrPercent < 3) {
      return `Normal volatility (${atrPercent.toFixed(2)}%). Healthy for trend continuation.`;
    } else if (atrPercent < 5) {
      return `Elevated volatility (${atrPercent.toFixed(2)}%). Good for breakout trades. Use wider stops.`;
    } else {
      return `High volatility (${atrPercent.toFixed(2)}%). Choppy conditions. Reduce size or wait.`;
    }
  }

  /**
   * Generate suggested trade setup
   */
  private generateSetup(
    currentPrice: number,
    trend: 'UPTREND' | 'DOWNTREND' | 'NEUTRAL',
    rsi: number,
    levels: { support: number[]; resistance: number[] },
    ghostScore: number
  ): CoinAnalysis['suggestedSetup'] {
    // Only suggest setups with GhostScore > 55
    if (ghostScore < 55) return undefined;

    let direction: 'LONG' | 'SHORT';
    let entry: number;
    let stopLoss: number;
    let takeProfit1: number;
    let takeProfit2: number;
    let reasoning: string;

    if (trend === 'UPTREND' && rsi < 65) {
      direction = 'LONG';
      entry = currentPrice;
      
      // Stop loss below nearest support or 3-5% below entry
      const supportLevel = levels.support[0];
      const stopDistance = supportLevel
        ? Math.min(currentPrice - supportLevel, currentPrice * 0.05)
        : currentPrice * 0.03;
      
      stopLoss = currentPrice - stopDistance;

      // TP1 at 1.5R, TP2 at 2.5R or nearest resistance
      const riskAmount = currentPrice - stopLoss;
      takeProfit1 = currentPrice + riskAmount * 1.5;
      
      const resistanceLevel = levels.resistance[0];
      takeProfit2 = resistanceLevel || currentPrice + riskAmount * 2.5;

      reasoning = `Uptrend continuation. Entry above EMA50. Stop below support at $${stopLoss.toFixed(2)}. Target resistance at $${takeProfit2.toFixed(2)}.`;
    } else if (trend === 'DOWNTREND' && rsi > 35) {
      direction = 'SHORT';
      entry = currentPrice;

      // Stop loss above nearest resistance or 3-5% above entry
      const resistanceLevel = levels.resistance[0];
      const stopDistance = resistanceLevel
        ? Math.min(resistanceLevel - currentPrice, currentPrice * 0.05)
        : currentPrice * 0.03;
      
      stopLoss = currentPrice + stopDistance;

      // TP1 at 1.5R, TP2 at 2.5R or nearest support
      const riskAmount = stopLoss - currentPrice;
      takeProfit1 = currentPrice - riskAmount * 1.5;
      
      const supportLevel = levels.support[0];
      takeProfit2 = supportLevel || currentPrice - riskAmount * 2.5;

      reasoning = `Downtrend continuation. Entry below EMA50. Stop above resistance at $${stopLoss.toFixed(2)}. Target support at $${takeProfit2.toFixed(2)}.`;
    } else {
      return undefined; // No clear setup
    }

    const riskReward = Math.abs((takeProfit1 - entry) / (entry - stopLoss));

    return {
      direction,
      entry,
      stopLoss,
      takeProfit1,
      takeProfit2,
      riskReward: Math.round(riskReward * 10) / 10,
      reasoning,
    };
  }

  /**
   * Get quick analysis for multiple coins (lighter version)
   */
  async analyzeMultipleCoins(symbols: string[]): Promise<Map<string, Partial<CoinAnalysis>>> {
    const results = new Map();

    await Promise.allSettled(
      symbols.map(async symbol => {
        try {
          const analysis = await this.analyzeCoin(symbol);
          results.set(symbol, {
            symbol: analysis.symbol,
            ticker: analysis.ticker,
            trend: analysis.trend,
            ghostScore: analysis.ghostScore,
          });
        } catch (error) {
          console.error(`Failed to analyze ${symbol}:`, error);
        }
      })
    );

    return results;
  }
}

// Export singleton
export const analysisService = new AnalysisService();

