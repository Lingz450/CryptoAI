'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import { formatPrice } from '@/lib/utils';
import { Bell, Plus, Trash2, Check, Loader2, AlertCircle } from 'lucide-react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/routers/_app';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type UserAlert = RouterOutputs['alerts']['getMyAlerts'][number];
type AlertTypeOption = Extract<
  UserAlert['alertType'],
  'PRICE_CROSS' | 'RSI_LEVEL' | 'EMA_CROSS' | 'ATR_SPIKE' | 'VOLUME_SURGE'
>;
type AlertConditionOption = Extract<
  UserAlert['condition'],
  'ABOVE' | 'BELOW' | 'CROSS_ABOVE' | 'CROSS_BELOW'
>;

const ALERT_TYPE_OPTIONS: Array<{ value: AlertTypeOption; label: string; helper: string }> = [
  { value: 'PRICE_CROSS', label: 'Price Level', helper: 'Trigger when price crosses your target.' },
  { value: 'RSI_LEVEL', label: 'RSI Level', helper: 'Watch for RSI overbought or oversold zones.' },
  { value: 'EMA_CROSS', label: 'EMA Cross', helper: 'Golden/Death cross style alerts.' },
  { value: 'ATR_SPIKE', label: 'ATR Spike', helper: 'Volatility breakout detector.' },
  { value: 'VOLUME_SURGE', label: 'Volume Surge', helper: 'Flow increases that matter.' },
];

const CONDITION_OPTIONS: Record<AlertTypeOption, Array<{ value: AlertConditionOption; label: string }>> = {
  PRICE_CROSS: [
    { value: 'ABOVE', label: 'Breaks Above' },
    { value: 'BELOW', label: 'Breaks Below' },
  ],
  RSI_LEVEL: [
    { value: 'ABOVE', label: 'RSI Above Level' },
    { value: 'BELOW', label: 'RSI Below Level' },
  ],
  EMA_CROSS: [
    { value: 'CROSS_ABOVE', label: 'Fast crosses above slow' },
    { value: 'CROSS_BELOW', label: 'Fast crosses below slow' },
  ],
  ATR_SPIKE: [
    { value: 'ABOVE', label: 'ATR above threshold' },
    { value: 'BELOW', label: 'ATR cooling down' },
  ],
  VOLUME_SURGE: [
    { value: 'ABOVE', label: 'Volume above baseline' },
    { value: 'BELOW', label: 'Volume drains' },
  ],
};

const DEFAULT_FORM = {
  symbol: '',
  alertType: 'PRICE_CROSS' as AlertTypeOption,
  condition: 'ABOVE' as AlertConditionOption,
  targetPrice: '',
  rsiLevel: '70',
};

export default function AlertsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);

  const alertsQuery = trpc.alerts.getMyAlerts.useQuery(
    { includeTriggered: true },
    { enabled: status === 'authenticated' }
  );

  const createAlert = trpc.alerts.createAlert.useMutation({
    onSuccess: () => {
      alertsQuery.refetch();
      setIsCreating(false);
      setFormData(DEFAULT_FORM);
    },
  });

  const deleteAlert = trpc.alerts.deleteAlert.useMutation({
    onSuccess: () => alertsQuery.refetch(),
  });

  useEffect(() => {
    const allowedConditions = CONDITION_OPTIONS[formData.alertType];
    if (!allowedConditions.some((option) => option.value === formData.condition)) {
      setFormData((prev) => ({
        ...prev,
        condition: allowedConditions[0]?.value ?? 'ABOVE',
      }));
    }
  }, [formData.alertType, formData.condition]);

  const alerts = useMemo<UserAlert[]>(() => alertsQuery.data ?? [], [alertsQuery.data]);
  const activeAlerts = alerts.filter((alert) => !alert.triggered);
  const triggeredAlerts = alerts.filter((alert) => alert.triggered);

  if (status === 'loading' || alertsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin?callbackUrl=/alerts');
    return null;
  }

  const handleCreateAlert = () => {
    const symbol = formData.symbol.trim().toUpperCase();
    if (!symbol) return;

    const numericTarget =
      formData.alertType === 'RSI_LEVEL'
        ? Number(formData.rsiLevel)
        : Number(formData.targetPrice);

    if (!Number.isFinite(numericTarget)) return;

    createAlert.mutate({
      symbol,
      targetPrice: numericTarget,
      alertType: formData.alertType,
      condition: formData.condition,
      metadata:
        formData.alertType === 'RSI_LEVEL'
          ? { rsiLevel: numericTarget }
          : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-2">
              <Bell className="w-8 h-8 text-primary" />
              Alerts
            </h1>
            <p className="text-muted-foreground">
              Scenario-aware alerts with RSI, EMA, ATR, and price triggers.
            </p>
          </div>
          <Button onClick={() => setIsCreating((prev) => !prev)} className="glow">
            <Plus className="w-4 h-4 mr-2" />
            {isCreating ? 'Close' : 'Create Alert'}
          </Button>
        </header>

        {isCreating && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle>Create New Alert</CardTitle>
              <CardDescription>
                GhostFX watches the market so you can focus on execution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Symbol</label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={(e) => setFormData((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                    placeholder="BTC, ETH, SOL..."
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Alert Type</label>
                  <select
                    value={formData.alertType}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        alertType: e.target.value as AlertTypeOption,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 focus:ring-2 focus:ring-primary"
                  >
                    {ALERT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ALERT_TYPE_OPTIONS.find((option) => option.value === formData.alertType)?.helper}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Condition</label>
                  <select
                    value={formData.condition}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        condition: e.target.value as AlertConditionOption,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 focus:ring-2 focus:ring-primary"
                  >
                    {CONDITION_OPTIONS[formData.alertType].map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.alertType === 'RSI_LEVEL' ? (
                  <div>
                    <label className="text-sm font-medium">RSI Level</label>
                    <input
                      type="number"
                      value={formData.rsiLevel}
                      onChange={(e) => setFormData((prev) => ({ ...prev, rsiLevel: e.target.value }))}
                      placeholder="70"
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 focus:ring-2 focus:ring-primary"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-medium">Target Price</label>
                    <input
                      type="number"
                      value={formData.targetPrice}
                      onChange={(e) => setFormData((prev) => ({ ...prev, targetPrice: e.target.value }))}
                      placeholder="65000"
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateAlert} disabled={createAlert.isLoading}>
                  {createAlert.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Alert'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Active Alerts
            </h2>
            <span className="text-sm text-muted-foreground">({activeAlerts.length})</span>
          </div>

          {activeAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <p>No live alerts yet. Spin one up in seconds.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {activeAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} onDelete={(id) => deleteAlert.mutate({ alertId: id })} />
              ))}
            </div>
          )}
        </section>

        {triggeredAlerts.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Check className="w-4 h-4 text-green-400" />
              Recently triggered
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {triggeredAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} onDelete={(id) => deleteAlert.mutate({ alertId: id })} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function AlertCard({ alert, onDelete }: { alert: UserAlert; onDelete: (id: string) => void }) {
  const targetValue = toNumericValue(alert.targetPrice);

  const conditionLabel = (() => {
    switch (alert.condition) {
      case 'ABOVE':
        return 'Above';
      case 'BELOW':
        return 'Below';
      case 'CROSS_ABOVE':
        return 'Crosses Above';
      case 'CROSS_BELOW':
        return 'Crosses Below';
      default:
        return alert.condition;
    }
  })();

  const alertLabel = (() => {
    switch (alert.alertType) {
      case 'PRICE_CROSS':
        return 'Price';
      case 'RSI_LEVEL':
        return 'RSI';
      case 'EMA_CROSS':
        return 'EMA Cross';
      case 'ATR_SPIKE':
        return 'ATR Spike';
      case 'VOLUME_SURGE':
        return 'Volume Surge';
      default:
        return alert.alertType;
    }
  })();

  const rsiValue = getMetadataNumber(alert.metadata, 'rsiLevel');
  const metadataValue =
    alert.alertType === 'RSI_LEVEL'
      ? `${rsiValue ?? targetValue ?? '—'} RSI`
      : targetValue != null
      ? formatPrice(targetValue)
      : '—';

  return (
    <Card className="border-muted/30">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <span>
            {alert.symbol} <span className="text-sm font-normal text-muted-foreground">({alertLabel})</span>
          </span>
          {alert.triggered && (
            <span className="text-xs uppercase tracking-wide text-green-400">Triggered</span>
          )}
        </CardTitle>
        <CardDescription className="flex flex-wrap gap-2 text-xs uppercase tracking-wide">
          <span>{conditionLabel}</span>
          <span>•</span>
          <span>{metadataValue}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground space-y-1">
          {alert.message && <p>{alert.message}</p>}
          <p>
            Created {new Date(alert.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onDelete(alert.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function toNumericValue(value: UserAlert['targetPrice']): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'object' && typeof (value as { toNumber?: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  return null;
}

function getMetadataNumber(metadata: UserAlert['metadata'], key: string): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>)[key];
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
