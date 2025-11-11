'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatTimeAgo } from '@/lib/utils';
import { Loader2, UserPlus, List, Zap, Share2 } from 'lucide-react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/routers/_app';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type RoomMembershipWithRelations = RouterOutputs['rooms']['list'][number];
type RoomActivityEntry = RouterOutputs['rooms']['activity'][number];
const resolveTimestamp = (value: Date | string) => new Date(value).getTime();

export default function RoomsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const {
    data: rooms,
    isLoading,
    refetch,
  } = trpc.rooms.list.useQuery(undefined, {
    enabled: status === 'authenticated',
  });

  const createRoomMutation = trpc.rooms.create.useMutation({
    onSuccess: () => {
      refetch();
      setName('');
      setDescription('');
    },
  });

  const joinRoomMutation = trpc.rooms.join.useMutation({
    onSuccess: () => {
      refetch();
      setInviteCode('');
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
    router.push('/auth/signin?callbackUrl=/rooms');
    return null;
  }

  const membershipList = (rooms ?? []) as RoomMembershipWithRelations[];
  const hasRooms = membershipList.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Rooms</h1>
            <p className="text-muted-foreground">
              Shared workspaces for watchlists, alerts, and screeners.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push('/watchlist')}>
              <List className="w-4 h-4 mr-2" />
              Go to Watchlist
            </Button>
            <Button variant="ghost" onClick={() => router.push('/screeners')}>
              <Zap className="w-4 h-4 mr-2" />
              Go to Screeners
            </Button>
          </div>
        </div>

        <Card className="space-y-4 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-primary" />
              Create a new room
            </CardTitle>
            <CardDescription>Invite analysts and share resources</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              className="rounded-lg border border-input bg-background px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Room name"
            />
            <input
              className="rounded-lg border border-input bg-background px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
            />
            <Button onClick={() => createRoomMutation.mutate({ name, description })}>
              {createRoomMutation.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Create Room'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="space-y-4 border-muted/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              Join with invite code
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="ABCD123"
            />
            <Button onClick={() => joinRoomMutation.mutate({ inviteCode })}>
              Join
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !hasRooms ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No rooms yet. Create one or join using an invite code.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {membershipList.map((membership) => (
              <RoomCard key={membership.room.id} membership={membership} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RoomCard({ membership }: { membership: RoomMembershipWithRelations }) {
  const room = membership.room;
  const [watchSymbol, setWatchSymbol] = useState('');
  const [alertSymbol, setAlertSymbol] = useState('');
  const [alertPrice, setAlertPrice] = useState('');
  const [screenerName, setScreenerName] = useState('');

  const watchlistMutation = trpc.rooms.watchlist.useMutation();
  const alertMutation = trpc.rooms.alerts.useMutation();
  const screenerMutation = trpc.rooms.screener.useMutation();
  const activityQuery = trpc.rooms.activity.useQuery(
    { roomId: room.id },
    { enabled: Boolean(room.id) }
  );
  const activityEntries = (activityQuery.data ?? []) as RoomActivityEntry[];

  return (
    <Card className="space-y-4 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{room.name}</span>
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            {membership.role}
          </span>
        </CardTitle>
        <CardDescription>{room.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground">Owner: {room.owner?.name || 'Owner'}</div>
        <div>
          <h4 className="text-sm font-semibold mb-2">Shared watchlist</h4>
          <div className="flex gap-2">
            <input
              value={watchSymbol}
              onChange={(e) => setWatchSymbol(e.target.value.toUpperCase())}
              placeholder="Symbol"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <Button size="sm" onClick={() => watchlistMutation.mutate({ roomId: room.id, symbol: watchSymbol })}>
              Add
            </Button>
          </div>
          <div className="mt-3 space-y-1 text-sm">
            {room.watchlistItems?.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>{item.symbol}</span>
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(resolveTimestamp(item.createdAt))}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-2">Shared alerts</h4>
          <div className="flex gap-2">
            <input
              value={alertSymbol}
              onChange={(e) => setAlertSymbol(e.target.value.toUpperCase())}
              placeholder="Symbol"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              value={alertPrice}
              onChange={(e) => setAlertPrice(e.target.value)}
              placeholder="Target price"
              className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <Button
              size="sm"
              onClick={() =>
                alertMutation.mutate({
                  roomId: room.id,
                  symbol: alertSymbol,
                  targetPrice: Number(alertPrice) || 0,
                  condition: 'ABOVE',
                })
              }
            >
              Alert
            </Button>
          </div>
          <div className="mt-3 text-sm">
            {room.roomAlerts?.map((alert) => {
              const numericTarget =
                typeof alert.targetPrice === 'number'
                  ? alert.targetPrice
                  : Number(alert.targetPrice);
              return (
                <div key={alert.id} className="flex justify-between">
                  <span>
                    {alert.symbol} {alert.condition === 'ABOVE' ? 'above' : 'below'} $
                    {Number.isFinite(numericTarget) ? numericTarget.toFixed(2) : '—'}
                  </span>
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(resolveTimestamp(alert.createdAt))}
                </span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-2">Shared screeners</h4>
          <div className="flex gap-2">
            <input
              value={screenerName}
              onChange={(e) => setScreenerName(e.target.value)}
              placeholder="Screen name"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <Button
              size="sm"
              onClick={() =>
                screenerMutation.mutate({
                  roomId: room.id,
                  name: screenerName,
                  configuration: { type: 'ATR_BREAKOUT', limit: 20 },
                })
              }
            >
              Save
            </Button>
          </div>
          <div className="mt-3 text-sm space-y-1">
            {room.screeners?.map((screener) => (
              <div key={screener.id} className="flex justify-between">
                <span>{screener.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(resolveTimestamp(screener.createdAt))}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">Activity</h4>
          {activityQuery.isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <div className="space-y-1 text-xs text-muted-foreground">
              {activityEntries.map((entry) => (
                <div key={entry.id} className="flex justify-between">
                  <span>{entry.message}</span>
                  <span>{formatTimeAgo(resolveTimestamp(entry.createdAt))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
