'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Search,
  TrendingUp,
  Bell,
  Eye,
  BarChart3,
  Settings,
  Home,
  Users,
  Target,
  Activity,
  DollarSign,
  BookOpen,
} from 'lucide-react';

interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: any;
  action: () => void;
  keywords?: string[];
  group: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();

  // Register keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      // Also support pressing 'P' directly
      if (e.key === 'p' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        // Don't trigger if user is typing in an input
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setOpen(true);
        }
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const commands: CommandAction[] = useMemo(
    () => [
      // Navigation
      {
        id: 'nav-home',
        label: 'Home / Dashboard',
        icon: Home,
        action: () => {
          router.push('/dashboard');
          setOpen(false);
        },
        keywords: ['home', 'dashboard', 'main'],
        group: 'Navigation',
      },
      {
        id: 'nav-watchlist',
        label: 'Watchlist',
        icon: Eye,
        action: () => {
          router.push('/watchlist');
          setOpen(false);
        },
        keywords: ['watchlist', 'favorites', 'tracked'],
        group: 'Navigation',
      },
      {
        id: 'nav-alerts',
        label: 'Alerts',
        icon: Bell,
        action: () => {
          router.push('/alerts');
          setOpen(false);
        },
        keywords: ['alerts', 'notifications', 'triggers'],
        group: 'Navigation',
      },
      {
        id: 'nav-screeners',
        label: 'Screeners',
        icon: BarChart3,
        action: () => {
          router.push('/screeners');
          setOpen(false);
        },
        keywords: ['screeners', 'scan', 'filter'],
        group: 'Navigation',
      },
      {
        id: 'nav-setups',
        label: 'Trade Setups',
        icon: Target,
        action: () => {
          router.push('/setups');
          setOpen(false);
        },
        keywords: ['setups', 'trades', 'positions'],
        group: 'Navigation',
      },
      {
        id: 'nav-backtest',
        label: 'Strategy Lab',
        icon: Activity,
        action: () => {
          router.push('/backtest');
          setOpen(false);
        },
        keywords: ['backtest', 'strategy', 'lab', 'test'],
        group: 'Navigation',
      },
      {
        id: 'nav-rooms',
        label: 'Rooms',
        icon: Users,
        action: () => {
          router.push('/rooms');
          setOpen(false);
        },
        keywords: ['rooms', 'team', 'collaborate'],
        group: 'Navigation',
      },
      {
        id: 'nav-settings',
        label: 'Settings',
        icon: Settings,
        action: () => {
          router.push('/settings');
          setOpen(false);
        },
        keywords: ['settings', 'preferences', 'config'],
        group: 'Navigation',
      },

      // Quick Actions
      {
        id: 'action-new-alert',
        label: 'Create New Alert',
        description: 'Set up a price or indicator alert',
        icon: Bell,
        action: () => {
          router.push('/alerts?action=create');
          setOpen(false);
        },
        keywords: ['create', 'new', 'alert', 'notification'],
        group: 'Actions',
      },
      {
        id: 'action-new-screener',
        label: 'Create New Screener',
        description: 'Build a custom coin screener',
        icon: BarChart3,
        action: () => {
          router.push('/screeners?action=create');
          setOpen(false);
        },
        keywords: ['create', 'new', 'screener', 'scan'],
        group: 'Actions',
      },
      {
        id: 'action-new-setup',
        label: 'Create Trade Setup',
        description: 'Document a new trading idea',
        icon: Target,
        action: () => {
          router.push('/setups?action=create');
          setOpen(false);
        },
        keywords: ['create', 'new', 'setup', 'trade'],
        group: 'Actions',
      },
      {
        id: 'action-run-backtest',
        label: 'Run Backtest',
        description: 'Test a strategy on historical data',
        icon: Activity,
        action: () => {
          router.push('/backtest?action=new');
          setOpen(false);
        },
        keywords: ['backtest', 'test', 'strategy', 'historical'],
        group: 'Actions',
      },

      // Search Coins
      {
        id: 'search-btc',
        label: 'Bitcoin (BTC)',
        icon: DollarSign,
        action: () => {
          router.push('/coin/BTCUSDT');
          setOpen(false);
        },
        keywords: ['btc', 'bitcoin'],
        group: 'Popular Coins',
      },
      {
        id: 'search-eth',
        label: 'Ethereum (ETH)',
        icon: DollarSign,
        action: () => {
          router.push('/coin/ETHUSDT');
          setOpen(false);
        },
        keywords: ['eth', 'ethereum'],
        group: 'Popular Coins',
      },
      {
        id: 'search-sol',
        label: 'Solana (SOL)',
        icon: DollarSign,
        action: () => {
          router.push('/coin/SOLUSDT');
          setOpen(false);
        },
        keywords: ['sol', 'solana'],
        group: 'Popular Coins',
      },
      {
        id: 'search-bnb',
        label: 'BNB',
        icon: DollarSign,
        action: () => {
          router.push('/coin/BNBUSDT');
          setOpen(false);
        },
        keywords: ['bnb', 'binance'],
        group: 'Popular Coins',
      },

      // Templates
      {
        id: 'template-breakout',
        label: 'Breakout Screener Template',
        description: 'ATR breakout with volume confirmation',
        icon: TrendingUp,
        action: () => {
          router.push('/screeners?template=breakout');
          setOpen(false);
        },
        keywords: ['template', 'breakout', 'atr', 'volume'],
        group: 'Templates',
      },
      {
        id: 'template-ema-cross',
        label: 'EMA Crossover Template',
        description: 'Golden cross / death cross detector',
        icon: TrendingUp,
        action: () => {
          router.push('/screeners?template=ema-cross');
          setOpen(false);
        },
        keywords: ['template', 'ema', 'crossover', 'golden', 'death'],
        group: 'Templates',
      },
      {
        id: 'template-rsi-reversal',
        label: 'RSI Reversal Template',
        description: 'Oversold/overbought reversal plays',
        icon: TrendingUp,
        action: () => {
          router.push('/screeners?template=rsi-reversal');
          setOpen(false);
        },
        keywords: ['template', 'rsi', 'reversal', 'oversold', 'overbought'],
        group: 'Templates',
      },
    ],
    [router]
  );

  const filteredCommands = useMemo(() => {
    if (!search) return commands;

    const searchLower = search.toLowerCase();
    return commands.filter((cmd) => {
      const labelMatch = cmd.label.toLowerCase().includes(searchLower);
      const descMatch = cmd.description?.toLowerCase().includes(searchLower);
      const keywordMatch = cmd.keywords?.some((kw) => kw.includes(searchLower));
      return labelMatch || descMatch || keywordMatch;
    });
  }, [search, commands]);

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandAction[]> = {};
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.group]) {
        groups[cmd.group] = [];
      }
      groups[cmd.group].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Type a command or search..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {Object.entries(groupedCommands).map(([group, items], groupIdx) => (
          <div key={group}>
            {groupIdx > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {items.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <CommandItem
                    key={cmd.id}
                    onSelect={() => cmd.action()}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{cmd.label}</span>
                      {cmd.description && (
                        <span className="text-xs text-muted-foreground">
                          {cmd.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

