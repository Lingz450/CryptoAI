'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import { formatPrice, formatPercent, formatLargeNumber } from '@/lib/utils';
import {
  Activity,
  Zap,
  X,
  Bell,
  ExternalLink,
  Copy,
  Target,
  TrendingUp,
  ArrowUpDown,
} from 'lucide-react';

export default function RSIScannerPage() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 50, eta: null as number | null });
  const [results, setResults] = useState<any[]>([]);
  const cancelRef = useRef(false);

  // Configurable thresholds
  const [config, setConfig] = useState({
    timeframe: '1h',
    type: 'BOTH' as 'OVERBOUGHT' | 'OVERSOLD' | 'BOTH',
    overboughtThreshold: 70,
    oversoldThreshold: 30,
    strictMode: false,
  });

  // Apply strict mode thresholds
  useEffect(() => {
    if (config.strictMode) {
      setConfig(c => ({ ...c, overboughtThreshold: 75, oversoldThreshold: 25 }));
    } else {
      setConfig(c => ({ ...c, overboughtThreshold: 70, oversoldThreshold: 30 }));
    }
  }, [config.strictMode]);

  const rsiScanner = trpc.tools.scanRSI.useQuery(
    {
      timeframe: config.timeframe,
      type: config.type,
      limit: 20,
    },
    { enabled: false }
  );

  const handleScan = async () => {
    cancelRef.current = false;
    setIsScanning(true);
    setResults([]);
    setProgress({ done: 0, total: 50, eta: 50 });

    // Simulate streaming progress
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (cancelRef.current) {
        clearInterval(interval);
        setIsScanning(false);
        return;
      }

      setProgress(p => {
        const newDone = Math.min(p.done + Math.random() * 5, p.total);
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = newDone / elapsed;
        const remaining = p.total - newDone;
        const eta = rate > 0 ? Math.ceil(remaining / rate) : null;
        
        return { ...p, done: Math.floor(newDone), eta };
      });
    }, 200);

    // Actual scan
    try {
      const data = await rsiScanner.refetch();
      setResults(data.data || []);
      setProgress({ done: 50, total: 50, eta: 0 });
    } catch (error) {
      console.error('Scan error:', error);
    } finally {
      clearInterval(interval);
      setIsScanning(false);
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
    setIsScanning(false);
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 's' && !isScanning) {
      handleScan();
    }
    if (e.key === 'Escape' && isScanning) {
      handleCancel();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isScanning]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Premium Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                RSI Extreme Scanner
              </h1>
              <p className="text-[#A8B0BE] text-lg">
                Find overbought/oversold coins for high-probability reversal trades
              </p>
            </div>
          </div>

          {/* Controls */}
          <Card className="rounded-2xl border-[#232830] shadow-[0_6px_24px_rgba(0,0,0,0.2)] p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {/* Timeframe */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#A8B0BE]">Timeframe</label>
                <select
                  value={config.timeframe}
                  onChange={(e) => setConfig({ ...config, timeframe: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-[#232830] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  disabled={isScanning}
                >
                  <option value="15m">15 Minutes</option>
                  <option value="1h">1 Hour</option>
                  <option value="4h">4 Hours</option>
                  <option value="1d">1 Day</option>
                </select>
              </div>

              {/* Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#A8B0BE]">Type</label>
                <select
                  value={config.type}
                  onChange={(e) => setConfig({ ...config, type: e.target.value as any })}
                  className="w-full px-4 py-3 bg-background border border-[#232830] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  disabled={isScanning}
                >
                  <option value="BOTH">Both Extremes</option>
                  <option value="OVERSOLD">Oversold Only</option>
                  <option value="OVERBOUGHT">Overbought Only</option>
                </select>
              </div>

              {/* Thresholds */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#A8B0BE]">Thresholds</label>
                <div className="flex items-center gap-2 px-4 py-3 bg-background border border-[#232830] rounded-xl">
                  <span className="text-sm text-[#A8B0BE]">OB: {config.overboughtThreshold}</span>
                  <span className="text-[#232830]">|</span>
                  <span className="text-sm text-[#A8B0BE]">OS: {config.oversoldThreshold}</span>
                </div>
              </div>

              {/* Strict Mode Toggle */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#A8B0BE]">Mode</label>
                <button
                  onClick={() => setConfig({ ...config, strictMode: !config.strictMode })}
                  className={`w-full px-4 py-3 rounded-xl border transition-all ${
                    config.strictMode
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-background border-[#232830] hover:border-primary/50'
                  }`}
                  disabled={isScanning}
                >
                  {config.strictMode ? '🔥 Strict (75/25)' : '📊 Normal (70/30)'}
                </button>
              </div>
            </div>

            {/* Scan Button */}
            <Button
              onClick={handleScan}
              disabled={isScanning}
              className="w-full h-14 text-lg rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/20 transition-all duration-200 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-background"
            >
              {isScanning ? (
                <>
                  <div className="w-5 h-5 mr-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Scanning... Press ESC to cancel
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  Start Scan (S)
                </>
              )}
            </Button>

            {/* Progress Bar */}
            {isScanning && (
              <div className="mt-6 rounded-2xl border border-[#232830] bg-[#0a0a0a] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-[#A8B0BE]">
                    {progress.done} / {progress.total} scanned
                    {progress.eta && progress.eta > 0 && ` • ~${progress.eta}s left`}
                  </span>
                  <button
                    onClick={handleCancel}
                    className="text-sm text-[#A8B0BE] hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <div className="h-2 w-full rounded-full bg-[#232830] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-[width] duration-200 ease-out"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                    role="progressbar"
                    aria-valuenow={progress.done}
                    aria-valuemax={progress.total}
                  />
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">
                {results.length} Extreme{results.length !== 1 ? 's' : ''} Found
              </h2>
              <div className="text-sm text-[#A8B0BE]">
                {config.timeframe} timeframe • {config.type.toLowerCase()}
              </div>
            </div>

            {results.map((result, i) => (
              <Card
                key={result.symbol}
                className="rounded-2xl border-[#232830] shadow-[0_6px_24px_rgba(0,0,0,0.2)] p-6 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:translate-y-[-2px] transition-all duration-200 ease-out group"
              >
                <div className="flex items-center justify-between">
                  {/* Left: Coin Info */}
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold text-[#A8B0BE]">#{i + 1}</div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">
                          {result.symbol.replace('USDT', '')}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            result.condition === 'OVERSOLD'
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {result.condition}
                        </span>
                        {result.potentialReversal && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            🎯 High Reversal
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-[#A8B0BE]">
                        <span className="font-mono">${formatPrice(result.currentPrice)}</span>
                        <span className={result.changePercent24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {formatPercent(result.changePercent24h)}
                        </span>
                        <span>Vol: ${formatLargeNumber(result.volume24h)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Center: RSI Value */}
                  <div className="text-center">
                    <div className="text-sm text-[#A8B0BE] mb-1">RSI</div>
                    <div
                      className={`text-5xl font-bold font-mono ${
                        result.condition === 'OVERSOLD' ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {result.rsi.toFixed(1)}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/coin/${result.symbol}`)}
                      className="rounded-xl border-[#232830] hover:border-primary/50 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Analyze
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/alerts?symbol=${result.symbol}`)}
                      className="rounded-xl border-[#232830] hover:border-primary/50"
                    >
                      <Bell className="w-4 h-4 mr-2" />
                      Alert
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/setups?symbol=${result.symbol}`)}
                      className="rounded-xl border-[#232830] hover:border-primary/50"
                    >
                      <Target className="w-4 h-4 mr-2" />
                      Setup
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isScanning && results.length === 0 && !rsiScanner.error && (
          <Card className="rounded-2xl border-[#232830] shadow-[0_6px_24px_rgba(0,0,0,0.2)] p-12">
            <div className="text-center">
              <Activity className="w-16 h-16 mx-auto mb-4 text-[#232830]" />
              <h3 className="text-xl font-semibold mb-2">Ready to Scan</h3>
              <p className="text-[#A8B0BE] mb-6">
                Press <kbd className="px-2 py-1 bg-[#232830] rounded">S</kbd> or click the button above to find RSI extremes
              </p>
              <p className="text-sm text-[#A8B0BE]">
                Tip: Use strict mode (75/25) for higher quality signals
              </p>
            </div>
          </Card>
        )}

        {/* Error State */}
        {rsiScanner.error && (
          <Card className="rounded-2xl border-red-500/30 bg-red-500/5 p-6">
            <div className="flex items-start gap-3">
              <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-400 mb-1">Scan Failed</h3>
                <p className="text-sm text-[#A8B0BE] mb-3">{rsiScanner.error.message}</p>
                <p className="text-sm text-[#A8B0BE]">
                  💡 Try: Different timeframe or check your internet connection
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Keyboard Shortcuts Help */}
        <div className="mt-8 text-center text-sm text-[#A8B0BE]">
          <kbd className="px-2 py-1 bg-[#232830] rounded">S</kbd> Start Scan •
          <kbd className="px-2 py-1 bg-[#232830] rounded ml-2">ESC</kbd> Cancel •
          <kbd className="px-2 py-1 bg-[#232830] rounded ml-2">↑↓</kbd> Navigate
        </div>
      </div>
    </div>
  );
}

