import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format number with commas
 */
export function formatNumber(num: number, decimals = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format price with appropriate decimals
 */
export function formatPrice(price?: number | null): string {
  const value = Number(price ?? 0);
  
  if (!Number.isFinite(value) || value === 0) {
    return '0.00';
  }
  
  if (value < 1) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    });
  } else if (value < 100) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  } else {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}

/**
 * Format percentage
 */
export function formatPercent(percent?: number | null, decimals = 2): string {
  const value = Number(percent ?? 0);
  if (!Number.isFinite(value)) {
    return '0.00%';
  }
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format large numbers (1M, 1B, etc.)
 */
export function formatLargeNumber(num?: number | null): string {
  const value = Number(num ?? 0);
  
  if (!Number.isFinite(value)) {
    return '0.00';
  }
  
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toFixed(2);
}

/**
 * Format timestamp
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format time ago
 */
export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Normalize symbol (BTC -> BTCUSDT)
 */
export function normalizeSymbol(symbol: string): string {
  const clean = symbol.toUpperCase().replace(/[^A-Z]/g, '');
  if (clean.includes('USDT')) return clean;
  return `${clean}USDT`;
}

/**
 * Get base symbol (BTCUSDT -> BTC)
 */
export function getBaseSymbol(symbol: string): string {
  return symbol.replace('USDT', '').replace('-USDT', '').replace('PERP', '');
}

/**
 * Get color for percent change
 */
export function getChangeColor(change: number): string {
  if (change > 0) return 'text-green-500';
  if (change < 0) return 'text-red-500';
  return 'text-muted-foreground';
}

/**
 * Get background color for percent change
 */
export function getChangeBgColor(change: number): string {
  if (change > 0) return 'bg-green-500/10';
  if (change < 0) return 'bg-red-500/10';
  return 'bg-muted';
}

