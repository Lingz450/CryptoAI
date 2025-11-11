// Trading Calculator Service - Position sizing, margin, PnL calculations
import { priceService } from './priceService';

export interface PositionSizeCalculation {
  entryPrice: number;
  stopLoss: number;
  riskAmount: number;
  leverage: number;
  
  // Results
  positionSize: number; // In USDT
  quantity: number; // In base asset
  notionalValue: number;
  marginRequired: number;
  riskPercent: number;
  
  // Fees (0.1% taker fee estimate)
  estimatedFees: number;
  totalCost: number;
  
  // Risk metrics
  stopLossPercent: number;
  maxLoss: number;
}

export interface TradeCallSetup {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  leverage: number;
  takeProfits: number[];
  
  // Calculated
  riskReward: number[];
  stopLossPercent: number;
  potentialGain: number[];
  potentialGainPercent: number[];
  
  // Formatted for display
  formatted: {
    title: string;
    description: string;
    levels: string;
    riskReward: string;
    warning?: string;
  };
}

export interface PnLCalculation {
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  leverage: number;
  direction: 'LONG' | 'SHORT';
  
  // Results
  pnl: number;
  pnlPercent: number;
  roi: number;
  unrealizedPnl: number;
  liquidationPrice: number;
}

export class TradingCalcService {
  /**
   * Calculate position size based on risk parameters
   */
  calculatePositionSize(
    entryPrice: number,
    stopLoss: number,
    riskAmount: number,
    leverage: number = 1,
    accountBalance?: number
  ): PositionSizeCalculation {
    // Calculate stop loss percentage
    const stopLossPercent = Math.abs((stopLoss - entryPrice) / entryPrice) * 100;
    
    // Calculate position size
    const riskPerUnit = Math.abs(entryPrice - stopLoss);
    const quantity = riskAmount / riskPerUnit;
    const positionSize = quantity * entryPrice;
    const notionalValue = positionSize * leverage;
    const marginRequired = positionSize / leverage;
    
    // Calculate fees (0.1% taker fee)
    const estimatedFees = positionSize * 0.001 * 2; // Entry + exit
    const totalCost = marginRequired + estimatedFees;
    
    // Max loss including fees
    const maxLoss = riskAmount + estimatedFees;
    
    // Risk percent of account
    const riskPercent = accountBalance 
      ? (maxLoss / accountBalance) * 100 
      : 0;

    return {
      entryPrice,
      stopLoss,
      riskAmount,
      leverage,
      positionSize,
      quantity,
      notionalValue,
      marginRequired,
      riskPercent,
      estimatedFees,
      totalCost,
      stopLossPercent,
      maxLoss,
    };
  }

  /**
   * Create formatted trade call
   */
  createTradeCall(
    symbol: string,
    direction: 'LONG' | 'SHORT',
    entry: number,
    stopLoss: number,
    takeProfits: number[],
    leverage: number = 1
  ): TradeCallSetup {
    const risk = Math.abs(entry - stopLoss);
    const stopLossPercent = (risk / entry) * 100;
    
    // Calculate R:R for each TP
    const riskReward = takeProfits.map(tp => {
      const reward = Math.abs(tp - entry);
      return reward / risk;
    });
    
    // Calculate potential gains
    const potentialGain = takeProfits.map(tp => Math.abs(tp - entry));
    const potentialGainPercent = takeProfits.map(tp => 
      (Math.abs(tp - entry) / entry) * 100 * leverage
    );

    // Format for display
    const tpFormatted = takeProfits
      .map((tp, i) => `TP${i + 1}: $${tp.toFixed(2)} (${riskReward[i].toFixed(1)}R)`)
      .join(' | ');

    const warning = leverage > 10 
      ? '⚠️ High leverage - manage risk carefully'
      : undefined;

    return {
      symbol,
      direction,
      entry,
      stopLoss,
      leverage,
      takeProfits,
      riskReward,
      stopLossPercent,
      potentialGain,
      potentialGainPercent,
      formatted: {
        title: `${direction} ${symbol} ${leverage}x`,
        description: `Entry: $${entry.toFixed(2)} | SL: $${stopLoss.toFixed(2)} (${stopLossPercent.toFixed(2)}%)`,
        levels: tpFormatted,
        riskReward: `R:R ${riskReward.map(r => `1:${r.toFixed(1)}`).join(', ')}`,
        warning,
      },
    };
  }

  /**
   * Calculate PnL for a position
   */
  calculatePnL(
    entryPrice: number,
    currentPrice: number,
    quantity: number,
    direction: 'LONG' | 'SHORT',
    leverage: number = 1
  ): PnLCalculation {
    let pnlPercent: number;
    
    if (direction === 'LONG') {
      pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    } else {
      pnlPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
    }
    
    const roi = pnlPercent * leverage;
    const positionValue = quantity * entryPrice;
    const unrealizedPnl = (positionValue * roi) / 100;
    
    // Calculate liquidation price
    let liquidationPrice: number;
    const maintenanceMargin = 0.005; // 0.5% maintenance margin
    
    if (direction === 'LONG') {
      liquidationPrice = entryPrice * (1 - (1 / leverage) + maintenanceMargin);
    } else {
      liquidationPrice = entryPrice * (1 + (1 / leverage) - maintenanceMargin);
    }

    return {
      symbol: '',
      entryPrice,
      currentPrice,
      quantity,
      leverage,
      direction,
      pnl: unrealizedPnl,
      pnlPercent,
      roi,
      unrealizedPnl,
      liquidationPrice,
    };
  }

  /**
   * Calculate required margin for a trade
   */
  calculateMargin(
    entryPrice: number,
    quantity: number,
    leverage: number
  ): {
    notional: number;
    initialMargin: number;
    maintenanceMargin: number;
    freeMarginNeeded: number;
  } {
    const notional = entryPrice * quantity;
    const initialMargin = notional / leverage;
    const maintenanceMargin = notional * 0.005; // 0.5%
    const freeMarginNeeded = initialMargin * 1.1; // 10% buffer

    return {
      notional,
      initialMargin,
      maintenanceMargin,
      freeMarginNeeded,
    };
  }

  /**
   * Calculate liquidation price
   */
  calculateLiquidationPrice(
    entryPrice: number,
    leverage: number,
    direction: 'LONG' | 'SHORT',
    maintenanceMarginRate: number = 0.005
  ): number {
    if (direction === 'LONG') {
      return entryPrice * (1 - (1 / leverage) + maintenanceMarginRate);
    } else {
      return entryPrice * (1 + (1 / leverage) - maintenanceMarginRate);
    }
  }

  /**
   * Calculate R-multiple for a closed trade
   */
  calculateRMultiple(
    entry: number,
    exit: number,
    stopLoss: number,
    direction: 'LONG' | 'SHORT'
  ): number {
    const risk = Math.abs(entry - stopLoss);
    const actualPnL = direction === 'LONG' 
      ? exit - entry 
      : entry - exit;
    
    return actualPnL / risk;
  }

  /**
   * Validate trade setup
   */
  validateTradeSetup(
    entry: number,
    stopLoss: number,
    takeProfits: number[],
    direction: 'LONG' | 'SHORT'
  ): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate stop loss is on correct side
    if (direction === 'LONG' && stopLoss >= entry) {
      errors.push('Stop loss must be below entry for LONG positions');
    }
    if (direction === 'SHORT' && stopLoss <= entry) {
      errors.push('Stop loss must be above entry for SHORT positions');
    }

    // Validate take profits
    for (const tp of takeProfits) {
      if (direction === 'LONG' && tp <= entry) {
        errors.push('Take profit must be above entry for LONG positions');
      }
      if (direction === 'SHORT' && tp >= entry) {
        errors.push('Take profit must be below entry for SHORT positions');
      }
    }

    // Check R:R
    const risk = Math.abs(entry - stopLoss);
    for (let i = 0; i < takeProfits.length; i++) {
      const reward = Math.abs(takeProfits[i] - entry);
      const rr = reward / risk;
      
      if (rr < 1) {
        warnings.push(`TP${i + 1} has R:R of ${rr.toFixed(2)} (less than 1:1)`);
      }
    }

    // Check stop loss size
    const slPercent = (risk / entry) * 100;
    if (slPercent > 10) {
      warnings.push(`Stop loss is ${slPercent.toFixed(1)}% - very wide!`);
    }
    if (slPercent < 0.5) {
      warnings.push(`Stop loss is ${slPercent.toFixed(1)}% - very tight, may get stopped out`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export const tradingCalcService = new TradingCalcService();

