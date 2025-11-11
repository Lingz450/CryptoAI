// Alert checking and notification service
import { prisma } from '../prisma';
import { priceService } from './priceService';
import { calculateRSI, calculateEMA, calculateATR } from '../indicators';
import type { Alert, AlertType, AlertCondition } from '@prisma/client';

export interface AlertCheckResult {
  alert: Alert;
  triggered: boolean;
  currentValue: number;
  targetValue: number;
  message: string;
}

export class AlertService {
  /**
   * Check all active alerts
   */
  async checkAllAlerts(): Promise<AlertCheckResult[]> {
    const alerts = await prisma.alert.findMany({
      where: {
        enabled: true,
        triggered: false,
      },
      include: {
        user: true,
      },
    });

    const results: AlertCheckResult[] = [];

    for (const alert of alerts) {
      try {
        const result = await this.checkAlert(alert);
        if (result.triggered) {
          await this.triggerAlert(alert, result);
        }
        results.push(result);
      } catch (error) {
        console.error(`Error checking alert ${alert.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Check a single alert
   */
  async checkAlert(alert: Alert): Promise<AlertCheckResult> {
    switch (alert.alertType) {
      case 'PRICE_CROSS':
        return this.checkPriceCrossAlert(alert);
      case 'RSI_LEVEL':
        return this.checkRSIAlert(alert);
      case 'EMA_CROSS':
        return this.checkEMACrossAlert(alert);
      case 'ATR_SPIKE':
        return this.checkATRSpikeAlert(alert);
      case 'VOLUME_SURGE':
        return this.checkVolumeSurgeAlert(alert);
      default:
        throw new Error(`Unknown alert type: ${alert.alertType}`);
    }
  }

  /**
   * Check price cross alert
   */
  private async checkPriceCrossAlert(alert: Alert): Promise<AlertCheckResult> {
    const ticker = await priceService.getTicker(alert.symbol);
    const currentPrice = ticker.price;
    const targetPrice = Number(alert.targetPrice);

    let triggered = false;

    if (alert.condition === 'ABOVE' && currentPrice >= targetPrice) {
      triggered = true;
    } else if (alert.condition === 'BELOW' && currentPrice <= targetPrice) {
      triggered = true;
    }

    const message = triggered
      ? `${alert.symbol} ${alert.condition === 'ABOVE' ? 'broke above' : 'fell below'} $${targetPrice.toLocaleString()}`
      : `${alert.symbol} at $${currentPrice.toLocaleString()}, target $${targetPrice.toLocaleString()}`;

    return {
      alert,
      triggered,
      currentValue: currentPrice,
      targetValue: targetPrice,
      message,
    };
  }

  /**
   * Check RSI alert
   */
  private async checkRSIAlert(alert: Alert): Promise<AlertCheckResult> {
    const candles = await priceService.getCandles(alert.symbol, '1h', 50);
    const prices = candles.map(c => c.close);
    const rsiValues = calculateRSI(prices, 14);

    if (rsiValues.length === 0) {
      throw new Error('Insufficient data for RSI calculation');
    }

    const currentRSI = rsiValues[rsiValues.length - 1];
    const targetRSI = Number(alert.targetPrice);

    let triggered = false;

    if (alert.condition === 'ABOVE' && currentRSI >= targetRSI) {
      triggered = true;
    } else if (alert.condition === 'BELOW' && currentRSI <= targetRSI) {
      triggered = true;
    }

    const message = triggered
      ? `${alert.symbol} RSI ${alert.condition === 'ABOVE' ? 'rose above' : 'dropped below'} ${targetRSI}`
      : `${alert.symbol} RSI at ${currentRSI.toFixed(2)}, target ${targetRSI}`;

    return {
      alert,
      triggered,
      currentValue: currentRSI,
      targetValue: targetRSI,
      message,
    };
  }

  /**
   * Check EMA cross alert
   */
  private async checkEMACrossAlert(alert: Alert): Promise<AlertCheckResult> {
    const candles = await priceService.getCandles(alert.symbol, '1h', 250);
    const prices = candles.map(c => c.close);

    const metadata = alert.metadata as any;
    const fastPeriod = metadata?.fastPeriod || 50;
    const slowPeriod = metadata?.slowPeriod || 200;

    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);

    if (fastEMA.length < 2 || slowEMA.length < 2) {
      throw new Error('Insufficient data for EMA calculation');
    }

    const currentFast = fastEMA[fastEMA.length - 1];
    const prevFast = fastEMA[fastEMA.length - 2];
    const currentSlow = slowEMA[slowEMA.length - 1];
    const prevSlow = slowEMA[slowEMA.length - 2];

    let triggered = false;
    let crossType = '';

    if (alert.condition === 'CROSS_ABOVE' && prevFast <= prevSlow && currentFast > currentSlow) {
      triggered = true;
      crossType = 'Golden Cross';
    } else if (
      alert.condition === 'CROSS_BELOW' &&
      prevFast >= prevSlow &&
      currentFast < currentSlow
    ) {
      triggered = true;
      crossType = 'Death Cross';
    }

    const message = triggered
      ? `${alert.symbol} ${crossType}: EMA${fastPeriod} crossed ${alert.condition === 'CROSS_ABOVE' ? 'above' : 'below'} EMA${slowPeriod}`
      : `${alert.symbol} EMA${fastPeriod}: ${currentFast.toFixed(2)}, EMA${slowPeriod}: ${currentSlow.toFixed(2)}`;

    return {
      alert,
      triggered,
      currentValue: currentFast,
      targetValue: currentSlow,
      message,
    };
  }

  /**
   * Check ATR spike alert
   */
  private async checkATRSpikeAlert(alert: Alert): Promise<AlertCheckResult> {
    const candles = await priceService.getCandles(alert.symbol, '1h', 50);
    const atrValues = calculateATR(candles, 14);

    if (atrValues.length < 2) {
      throw new Error('Insufficient data for ATR calculation');
    }

    const currentATR = atrValues[atrValues.length - 1];
    const avgATR =
      atrValues.slice(-14).reduce((total: number, value: number) => total + value, 0) / 14;
    const currentPrice = candles[candles.length - 1].close;
    const atrPercent = (currentATR / currentPrice) * 100;

    const spikeThreshold = Number(alert.targetPrice) || 1.5; // Default 1.5x average
    const triggered = currentATR >= avgATR * spikeThreshold;

    const message = triggered
      ? `${alert.symbol} volatility spike: ATR ${atrPercent.toFixed(2)}% (${(currentATR / avgATR).toFixed(2)}x avg)`
      : `${alert.symbol} ATR: ${atrPercent.toFixed(2)}% (${(currentATR / avgATR).toFixed(2)}x avg)`;

    return {
      alert,
      triggered,
      currentValue: currentATR,
      targetValue: avgATR * spikeThreshold,
      message,
    };
  }

  /**
   * Check volume surge alert
   */
  private async checkVolumeSurgeAlert(alert: Alert): Promise<AlertCheckResult> {
    const candles = await priceService.getCandles(alert.symbol, '1h', 30);

    if (candles.length < 20) {
      throw new Error('Insufficient data for volume analysis');
    }

    const recentVolume =
      candles.slice(-5).reduce((sum: number, candle) => sum + candle.volume, 0) / 5;
    const avgVolume =
      candles.slice(-25, -5).reduce((sum: number, candle) => sum + candle.volume, 0) / 20;
    const volumeRatio = recentVolume / avgVolume;

    const surgeThreshold = Number(alert.targetPrice) || 2.0; // Default 2x average
    const triggered = volumeRatio >= surgeThreshold;

    const message = triggered
      ? `${alert.symbol} volume surge: ${volumeRatio.toFixed(2)}x average`
      : `${alert.symbol} volume: ${volumeRatio.toFixed(2)}x average`;

    return {
      alert,
      triggered,
      currentValue: volumeRatio,
      targetValue: surgeThreshold,
      message,
    };
  }

  /**
   * Trigger an alert (mark as triggered and send notification)
   */
  async triggerAlert(alert: Alert, result: AlertCheckResult): Promise<void> {
    // Update alert in database
    await prisma.alert.update({
      where: { id: alert.id },
      data: {
        triggered: true,
        triggeredAt: new Date(),
      },
    });

    // Send notifications (implement notification channels)
    await this.sendNotification(alert, result);

    console.log(`✅ Alert triggered: ${result.message}`);
  }

  /**
   * Send notification through various channels
   */
  private async sendNotification(alert: Alert, result: AlertCheckResult): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: alert.userId },
      include: { notificationPreferences: true },
    });

    if (!user) return;

    const prefs = user.notificationPreferences?.[0];

    // Get additional context
    const ticker = await priceService.getTicker(alert.symbol);
    const context = {
      symbol: alert.symbol,
      price: ticker.price,
      change24h: ticker.changePercent24h,
      message: result.message,
      alertType: alert.alertType,
    };

    // Email notification
    if (prefs?.alertsEmail) {
      await this.sendEmailNotification(user.email!, context);
    }

    // Telegram notification
    if (prefs?.alertsTelegram && user.telegramId) {
      await this.sendTelegramNotification(user.telegramId, context);
    }

    // Push notification
    if (prefs?.alertsPush) {
      await this.sendPushNotification(user.id, context);
    }
  }

  private async sendEmailNotification(email: string, context: any): Promise<void> {
    // Implement email sending
    console.log(`📧 Email notification to ${email}:`, context.message);
    // TODO: Integrate with nodemailer or email service
  }

  private async sendTelegramNotification(telegramId: string, context: any): Promise<void> {
    // Implement Telegram notification
    console.log(`📱 Telegram notification to ${telegramId}:`, context.message);
    // TODO: Integrate with Telegram Bot API
  }

  private async sendPushNotification(userId: string, context: any): Promise<void> {
    // Implement push notification
    console.log(`🔔 Push notification to ${userId}:`, context.message);
    // TODO: Integrate with Web Push API
  }

  /**
   * Create a new alert
   */
  async createAlert(
    userId: string,
    symbol: string,
    targetPrice: number,
    alertType: AlertType = 'PRICE_CROSS',
    condition: AlertCondition = 'ABOVE',
    metadata?: any
  ) {
    return prisma.alert.create({
      data: {
        userId,
        symbol: symbol.toUpperCase(),
        targetPrice,
        alertType,
        condition,
        metadata,
      },
    });
  }

  /**
   * Get user's alerts
   */
  async getUserAlerts(userId: string, includeTriggered = false) {
    return prisma.alert.findMany({
      where: {
        userId,
        ...(includeTriggered ? {} : { triggered: false }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete alert
   */
  async deleteAlert(alertId: string, userId: string) {
    return prisma.alert.delete({
      where: {
        id: alertId,
        userId, // Ensure user owns the alert
      },
    });
  }

  /**
   * Reset triggered alerts
   */
  async resetAlert(alertId: string, userId: string) {
    return prisma.alert.update({
      where: {
        id: alertId,
        userId,
      },
      data: {
        triggered: false,
        triggeredAt: null,
      },
    });
  }
}

// Export singleton
export const alertService = new AlertService();

