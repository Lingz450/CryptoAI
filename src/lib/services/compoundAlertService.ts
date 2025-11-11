// Compound alert service with regime awareness and cooldown logic
import { prisma } from '../prisma';
import { priceService } from './priceService';
import { derivativesService } from './derivativesService';
import { regimeDetector } from './regimeDetector';
import {
  calculateRSI,
  calculateEMA,
  calculateATR,
  calculateADX,
} from '../indicators';
import type { Alert } from '@prisma/client';

export interface CompoundRule {
  type: 'PRICE' | 'RSI' | 'EMA_CROSS' | 'ATR' | 'VOLUME' | 'FUNDING' | 'OI' | 'LONG_SHORT_RATIO';
  condition: 'ABOVE' | 'BELOW' | 'CROSS_ABOVE' | 'CROSS_BELOW';
  value: number;
  symbol?: string; // For cross-symbol rules like BTC break
}

export interface CompoundAlertCheckResult {
  alert: Alert;
  triggered: boolean;
  rules: Array<{ rule: CompoundRule; passed: boolean; currentValue: number }>;
  message: string;
  regimeCheck?: {
    passed: boolean;
    currentRegime: string;
    requiredRegime: string;
  };
  cooldownCheck?: {
    passed: boolean;
    cooldownEnds?: Date;
  };
  minMoveCheck?: {
    passed: boolean;
    actualMove: number;
    requiredMove: number;
  };
}

export class CompoundAlertService {
  /**
   * Check compound alert with all rules and filters
   */
  async checkCompoundAlert(alert: Alert): Promise<CompoundAlertCheckResult> {
    // Check cooldown first
    const cooldownCheck = this.checkCooldown(alert);
    if (!cooldownCheck.passed) {
      return {
        alert,
        triggered: false,
        rules: [],
        message: `Alert in cooldown until ${cooldownCheck.cooldownEnds?.toLocaleString()}`,
        cooldownCheck,
      };
    }

    // Parse compound rules
    const rules = Array.isArray(alert.compoundRules)
      ? (alert.compoundRules as unknown as CompoundRule[])
      : [];
    const ruleResults: Array<{ rule: CompoundRule; passed: boolean; currentValue: number }> = [];

    // Evaluate each rule
    for (const rule of rules) {
      const result = await this.evaluateRule(alert.symbol, rule);
      ruleResults.push(result);
    }

    // Determine if alert triggered based on condition (AND/OR)
    const isAndCondition = alert.condition === 'AND';
    const triggered = isAndCondition
      ? ruleResults.every((r) => r.passed)
      : ruleResults.some((r) => r.passed);

    // If triggered, check regime requirement
    let regimeCheck: CompoundAlertCheckResult['regimeCheck'];
    if (triggered && alert.requireRegime) {
      regimeCheck = await this.checkRegime(alert);
      if (!regimeCheck.passed) {
        return {
          alert,
          triggered: false,
          rules: ruleResults,
          message: `Regime check failed: current ${regimeCheck.currentRegime}, required ${regimeCheck.requiredRegime}`,
          regimeCheck,
        };
      }
    }

    // If triggered, check minimum move requirement
    let minMoveCheck: CompoundAlertCheckResult['minMoveCheck'];
    if (triggered && alert.minMovePercent) {
      minMoveCheck = await this.checkMinMove(alert);
      if (!minMoveCheck.passed) {
        return {
          alert,
          triggered: false,
          rules: ruleResults,
          message: `Min move check failed: ${minMoveCheck.actualMove.toFixed(2)}% < ${minMoveCheck.requiredMove}%`,
          minMoveCheck,
        };
      }
    }

    // Generate message
    const message = this.generateMessage(alert, ruleResults, triggered);

    return {
      alert,
      triggered,
      rules: ruleResults,
      message,
      regimeCheck,
      cooldownCheck,
      minMoveCheck,
    };
  }

  /**
   * Evaluate a single rule
   */
  private async evaluateRule(
    primarySymbol: string,
    rule: CompoundRule
  ): Promise<{ rule: CompoundRule; passed: boolean; currentValue: number }> {
    const symbol = rule.symbol || primarySymbol;

    switch (rule.type) {
      case 'PRICE': {
        const ticker = await priceService.getTicker(symbol);
        const currentValue = ticker.price;
        const passed = this.compareValue(currentValue, rule.value, rule.condition);
        return { rule, passed, currentValue };
      }

      case 'RSI': {
        const candles = await priceService.getCandles(symbol, '1h', 50);
        const prices = candles.map((c) => c.close);
        const rsiValues = calculateRSI(prices, 14);
        const currentValue = rsiValues[rsiValues.length - 1] || 50;
        const passed = this.compareValue(currentValue, rule.value, rule.condition);
        return { rule, passed, currentValue };
      }

      case 'EMA_CROSS': {
        const candles = await priceService.getCandles(symbol, '1h', 250);
        const prices = candles.map((c) => c.close);
        const fastEMA = calculateEMA(prices, 50);
        const slowEMA = calculateEMA(prices, 200);

        const currentFast = fastEMA[fastEMA.length - 1];
        const currentSlow = slowEMA[slowEMA.length - 1];
        const prevFast = fastEMA[fastEMA.length - 2];
        const prevSlow = slowEMA[slowEMA.length - 2];

        let passed = false;
        if (rule.condition === 'CROSS_ABOVE') {
          passed = prevFast <= prevSlow && currentFast > currentSlow;
        } else if (rule.condition === 'CROSS_BELOW') {
          passed = prevFast >= prevSlow && currentFast < currentSlow;
        }

        return { rule, passed, currentValue: currentFast - currentSlow };
      }

      case 'ATR': {
        const candles = await priceService.getCandles(symbol, '1h', 50);
        const atrValues = calculateATR(candles, 14);
        const currentPrice = candles[candles.length - 1].close;
        const atr = atrValues[atrValues.length - 1];
        const atrPercent = (atr / currentPrice) * 100;
        const passed = this.compareValue(atrPercent, rule.value, rule.condition);
        return { rule, passed, currentValue: atrPercent };
      }

      case 'VOLUME': {
        const candles = await priceService.getCandles(symbol, '1h', 30);
        const recent5 = candles.slice(-5);
        const baseline20 = candles.slice(-25, -5);

        const avgRecent = recent5.reduce((sum, c) => sum + c.volume, 0) / 5;
        const avgBaseline = baseline20.reduce((sum, c) => sum + c.volume, 0) / 20;
        const volumeRatio = avgRecent / avgBaseline;

        const passed = this.compareValue(volumeRatio, rule.value, rule.condition);
        return { rule, passed, currentValue: volumeRatio };
      }

      case 'FUNDING': {
        const derivatives = await derivativesService.get(symbol);
        const fundingPercent = derivatives.fundingRate * 100;
        const passed = this.compareValue(fundingPercent, rule.value, rule.condition);
        return { rule, passed, currentValue: fundingPercent };
      }

      case 'OI': {
        const derivatives = await derivativesService.get(symbol);
        const oi = derivatives.openInterest;
        const passed = this.compareValue(oi, rule.value, rule.condition);
        return { rule, passed, currentValue: oi };
      }

      case 'LONG_SHORT_RATIO': {
        const derivatives = await derivativesService.get(symbol);
        const lsr = derivatives.longShortRatio;
        const passed = this.compareValue(lsr, rule.value, rule.condition);
        return { rule, passed, currentValue: lsr };
      }

      default:
        throw new Error(`Unknown rule type: ${(rule as any).type}`);
    }
  }

  /**
   * Compare values based on condition
   */
  private compareValue(
    current: number,
    target: number,
    condition: CompoundRule['condition']
  ): boolean {
    switch (condition) {
      case 'ABOVE':
        return current >= target;
      case 'BELOW':
        return current <= target;
      case 'CROSS_ABOVE':
      case 'CROSS_BELOW':
        // Handled in rule-specific logic
        return true;
      default:
        return false;
    }
  }

  /**
   * Check cooldown period
   */
  private checkCooldown(alert: Alert): { passed: boolean; cooldownEnds?: Date } {
    if (!alert.cooldownMinutes || !alert.lastCooldownEnd) {
      return { passed: true };
    }

    const now = new Date();
    const cooldownEnds = alert.lastCooldownEnd;

    if (now < cooldownEnds) {
      return { passed: false, cooldownEnds };
    }

    return { passed: true };
  }

  /**
   * Check market regime requirement
   */
  private async checkRegime(
    alert: Alert
  ): Promise<{ passed: boolean; currentRegime: string; requiredRegime: string }> {
    const candles = await priceService.getCandles(alert.symbol, '1h', 100);
    const regime = regimeDetector.detectRegime(candles);

    return {
      passed: regime.regime === alert.requireRegime,
      currentRegime: regime.regime,
      requiredRegime: alert.requireRegime!,
    };
  }

  /**
   * Check minimum move requirement
   */
  private async checkMinMove(
    alert: Alert
  ): Promise<{ passed: boolean; actualMove: number; requiredMove: number }> {
    const candles = await priceService.getCandles(alert.symbol, '1h', 24);
    const firstPrice = candles[0].close;
    const lastPrice = candles[candles.length - 1].close;
    const actualMove = Math.abs(((lastPrice - firstPrice) / firstPrice) * 100);
    const requiredMove = Number(alert.minMovePercent);

    return {
      passed: actualMove >= requiredMove,
      actualMove,
      requiredMove,
    };
  }

  /**
   * Generate message describing alert result
   */
  private generateMessage(
    alert: Alert,
    ruleResults: Array<{ rule: CompoundRule; passed: boolean; currentValue: number }>,
    triggered: boolean
  ): string {
    const passedRules = ruleResults.filter((r) => r.passed);
    const failedRules = ruleResults.filter((r) => !r.passed);

    if (triggered) {
      const ruleDescriptions = passedRules.map((r) => {
        const ruleType = r.rule.type;
        const value = r.currentValue.toFixed(2);
        return `${ruleType}: ${value}`;
      });

      return `🔥 ${alert.symbol} compound alert triggered! ${ruleDescriptions.join(' · ')}`;
    }

    return `${alert.symbol} compound alert: ${passedRules.length}/${ruleResults.length} rules passed`;
  }

  /**
   * Update alert reliability stats after trigger
   */
  async updateReliabilityStats(
    alertId: string,
    wasSuccessful: boolean,
    pnl?: number
  ): Promise<void> {
    const alert = await prisma.alert.findUnique({ where: { id: alertId } });
    if (!alert) return;

    const newHitCount = wasSuccessful ? alert.hitCount + 1 : alert.hitCount;
    const newTotalTriggers = alert.totalTriggers + 1;
    const newSuccessRate = (newHitCount / newTotalTriggers) * 100;

    let newAvgPnl = alert.avgPnl ? Number(alert.avgPnl) : 0;
    if (pnl !== undefined) {
      newAvgPnl = ((newAvgPnl * alert.totalTriggers) + pnl) / newTotalTriggers;
    }

    await prisma.alert.update({
      where: { id: alertId },
      data: {
        hitCount: newHitCount,
        totalTriggers: newTotalTriggers,
        successRate: newSuccessRate,
        avgPnl: newAvgPnl,
      },
    });
  }

  /**
   * Set cooldown after alert triggers
   */
  async setCooldown(alertId: string, cooldownMinutes: number): Promise<void> {
    const cooldownEnds = new Date();
    cooldownEnds.setMinutes(cooldownEnds.getMinutes() + cooldownMinutes);

    await prisma.alert.update({
      where: { id: alertId },
      data: {
        lastCooldownEnd: cooldownEnds,
      },
    });
  }

  /**
   * Get global reliability score across all alerts for a user
   */
  async getGlobalReliabilityScore(userId: string): Promise<{
    avgSuccessRate: number;
    totalAlerts: number;
    totalTriggers: number;
    topPerformers: Array<{ id: string; symbol: string; successRate: number }>;
  }> {
    const alerts = await prisma.alert.findMany({
      where: { userId },
      select: {
        id: true,
        symbol: true,
        successRate: true,
        totalTriggers: true,
      },
    });

    const alertsWithTriggers = alerts.filter((a) => a.totalTriggers > 0);
    const avgSuccessRate =
      alertsWithTriggers.reduce((sum, a) => sum + Number(a.successRate || 0), 0) /
      (alertsWithTriggers.length || 1);

    const totalTriggers = alerts.reduce((sum, a) => sum + a.totalTriggers, 0);

    const topPerformers = alerts
      .filter((a) => a.totalTriggers >= 3) // At least 3 triggers for reliability
      .sort((a, b) => Number(b.successRate || 0) - Number(a.successRate || 0))
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        symbol: a.symbol,
        successRate: Number(a.successRate || 0),
      }));

    return {
      avgSuccessRate,
      totalAlerts: alerts.length,
      totalTriggers,
      topPerformers,
    };
  }
}

export const compoundAlertService = new CompoundAlertService();

