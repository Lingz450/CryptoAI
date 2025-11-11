'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import { Settings, User, Bell, Key, LogOut, Loader2, Check } from 'lucide-react';

export default function SettingsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
  });

  const [notifications, setNotifications] = useState({
    priceAlerts: true,
    setupUpdates: true,
    marketNews: false,
    weeklyReport: true,
  });

  // Update form when session loads
  useEffect(() => {
    if (session?.user) {
      setFormData({
        name: session.user.name || '',
        email: session.user.email || '',
      });
    }
  }, [session]);

  const updateProfileMutation = trpc.user.updateProfile.useMutation({
    onSuccess: async (data) => {
      // Update the session with new name
      await update({ name: data.name });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin?callbackUrl=/settings');
    return null;
  }

  const handleSaveProfile = async () => {
    setSaveSuccess(false);
    updateProfileMutation.mutate({
      name: formData.name,
    });
  };

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      await signOut({ callbackUrl: '/' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <Settings className="w-8 h-8 inline-block mr-2 text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your name"
                  className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-4 py-2 bg-muted border border-input rounded-lg opacity-50 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              {updateProfileMutation.error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{updateProfileMutation.error.message}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleSaveProfile}
                  disabled={updateProfileMutation.isLoading || !formData.name}
                >
                  {updateProfileMutation.isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Saved!
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose what notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Price Alerts</div>
                  <div className="text-sm text-muted-foreground">
                    Get notified when price alerts are triggered
                  </div>
                </div>
                <Button
                  variant={notifications.priceAlerts ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNotifications({ ...notifications, priceAlerts: !notifications.priceAlerts })}
                >
                  {notifications.priceAlerts ? 'On' : 'Off'}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Setup Updates</div>
                  <div className="text-sm text-muted-foreground">
                    Notifications about your trade setups
                  </div>
                </div>
                <Button
                  variant={notifications.setupUpdates ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNotifications({ ...notifications, setupUpdates: !notifications.setupUpdates })}
                >
                  {notifications.setupUpdates ? 'On' : 'Off'}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Market News</div>
                  <div className="text-sm text-muted-foreground">
                    Important market updates and news
                  </div>
                </div>
                <Button
                  variant={notifications.marketNews ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNotifications({ ...notifications, marketNews: !notifications.marketNews })}
                >
                  {notifications.marketNews ? 'On' : 'Off'}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Weekly Report</div>
                  <div className="text-sm text-muted-foreground">
                    Summary of your trading activity
                  </div>
                </div>
                <Button
                  variant={notifications.weeklyReport ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNotifications({ ...notifications, weeklyReport: !notifications.weeklyReport })}
                >
                  {notifications.weeklyReport ? 'On' : 'Off'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* API Keys */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Connect your exchange accounts (Coming Soon)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  API key management will be available soon. You'll be able to connect Binance, Bybit, and OKX accounts.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

