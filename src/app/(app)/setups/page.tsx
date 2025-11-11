'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import { formatPrice, formatPercent, getChangeColor } from '@/lib/utils';
import { TrendingUp, Plus, Trash2, Check, Loader2, Target, AlertCircle } from 'lucide-react';

type SetupDirection = 'LONG' | 'SHORT';
type SetupStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export default function SetupsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    symbol: '',
    direction: 'LONG' as SetupDirection,
    entry: '',
    stopLoss: '',
    takeProfit: '',
    notes: '',
  });

  const { data: setups, isLoading, refetch } = trpc.setups.list.useQuery(undefined, {
    enabled: status === 'authenticated',
  });

  const createMutation = trpc.setups.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsCreating(false);
      setFormData({ symbol: '', direction: 'LONG', entry: '', stopLoss: '', takeProfit: '', notes: '' });
    },
  });

  const deleteMutation = trpc.setups.delete.useMutation({
    onSuccess: () => refetch(),
  });

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin?callbackUrl=/setups');
    return null;
  }

  const handleCreateSetup = () => {
    createMutation.mutate({
      symbol: formData.symbol.toUpperCase(),
      direction: formData.direction,
      entry: parseFloat(formData.entry),
      stopLoss: parseFloat(formData.stopLoss),
      takeProfit: parseFloat(formData.takeProfit),
      notes: formData.notes || undefined,
    });
  };

  const calculateRiskReward = (entry: number, sl: number, tp: number) => {
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    return reward / risk;
  };

  const getStatusColor = (status: SetupStatus) => {
    const colors: Record<SetupStatus, string> = {
      PENDING: 'bg-yellow-500/20 text-yellow-500',
      ACTIVE: 'bg-green-500/20 text-green-500',
      COMPLETED: 'bg-blue-500/20 text-blue-500',
      CANCELLED: 'bg-gray-500/20 text-gray-500',
    };
    return colors[status];
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              <Target className="w-8 h-8 inline-block mr-2 text-primary" />
              Trade Setups
            </h1>
            <p className="text-muted-foreground">
              Plan and track your trade ideas
            </p>
          </div>

          <Button onClick={() => setIsCreating(!isCreating)} className="glow">
            <Plus className="w-4 h-4 mr-2" />
            New Setup
          </Button>
        </div>

        {/* Create Setup Form */}
        {isCreating && (
          <Card className="mb-6 border-primary/20">
            <CardHeader>
              <CardTitle>Create Trade Setup</CardTitle>
              <CardDescription>Define your entry, stop loss, and take profit levels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Symbol</label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                    placeholder="BTC, ETH, SOL..."
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Direction</label>
                  <select
                    value={formData.direction}
                    onChange={(e) => setFormData({ ...formData, direction: e.target.value as SetupDirection })}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="LONG">Long</option>
                    <option value="SHORT">Short</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Entry Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.entry}
                    onChange={(e) => setFormData({ ...formData, entry: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Stop Loss</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.stopLoss}
                    onChange={(e) => setFormData({ ...formData, stopLoss: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Take Profit</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.takeProfit}
                    onChange={(e) => setFormData({ ...formData, takeProfit: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {formData.entry && formData.stopLoss && formData.takeProfit && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Risk/Reward Ratio</label>
                    <div className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg text-lg font-bold text-primary">
                      1:{calculateRiskReward(
                        parseFloat(formData.entry),
                        parseFloat(formData.stopLoss),
                        parseFloat(formData.takeProfit)
                      ).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Trade thesis, key levels, etc..."
                  rows={3}
                  className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {createMutation.error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{createMutation.error.message}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleCreateSetup}
                  disabled={!formData.symbol || !formData.entry || !formData.stopLoss || !formData.takeProfit || createMutation.isLoading}
                >
                  {createMutation.isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Create Setup
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsCreating(false);
                    setFormData({ symbol: '', direction: 'LONG', entry: '', stopLoss: '', takeProfit: '', notes: '' });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Setups List */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-32" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-48" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !setups || setups.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No setups created</h3>
              <p className="text-muted-foreground mb-4">
                Create your first trade setup to start tracking your ideas
              </p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Setup
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {setups.map((setup: any) => {
              const entry = Number(setup.entry) || 0;
              const stopLoss = Number(setup.stopLoss) || 0;
              const takeProfit = Number(setup.takeProfit1 || setup.takeProfit) || 0;
              const rr = calculateRiskReward(entry, stopLoss, takeProfit);
              
              return (
                <Card key={setup.id} className="hover:border-primary/50 transition-all">
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {setup.direction === 'LONG' ? (
                          <TrendingUp className="w-5 h-5 text-green-500" />
                        ) : (
                          <TrendingUp className="w-5 h-5 text-red-500 rotate-180" />
                        )}
                        {setup.symbol}
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(setup.status)}`}>
                          {setup.status}
                        </span>
                      </CardTitle>
                      <CardDescription>
                        {setup.direction} • R:R 1:{rr.toFixed(2)}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Delete this setup?')) {
                          deleteMutation.mutate({ id: setup.id });
                        }
                      }}
                      disabled={deleteMutation.isLoading}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Entry</div>
                        <div className="text-lg font-semibold">${formatPrice(entry)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Stop Loss</div>
                        <div className="text-lg font-semibold text-red-500">${formatPrice(stopLoss)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Take Profit</div>
                        <div className="text-lg font-semibold text-green-500">${formatPrice(takeProfit)}</div>
                      </div>
                    </div>
                    {setup.notes && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm">{setup.notes}</p>
                      </div>
                    )}
                    <div className="mt-4 text-xs text-muted-foreground">
                      Created {new Date(setup.createdAt).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

