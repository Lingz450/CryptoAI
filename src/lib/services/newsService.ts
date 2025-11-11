// News & Events feed with LLM digests
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import OpenAI from 'openai';
import { env } from '@/env';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY || 'dummy-key' });

export type EventType = 'CPI' | 'FED' | 'ETF' | 'UNLOCK' | 'AIRDROP' | 'LISTING' | 'HALVING' | 'REGULATORY';
export type EventSentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface MacroEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  sentiment: EventSentiment;
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedSymbols: string[];
  scheduledAt: Date;
  tags: string[];
  source?: string;
  url?: string;
}

export interface LLMDigest {
  summary: string;
  sentiment: EventSentiment;
  confidence: number; // 0-100
  keyPoints: string[];
  tradingImplications: string[];
  affectedAssets: Array<{
    symbol: string;
    impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    reasoning: string;
  }>;
}

export interface EventRiskLabel {
  symbol: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  nextEvent: MacroEvent;
  hoursUntil: number;
  recommendation: string;
}

const CACHE_TTL = 300; // 5 minutes

export class NewsService {
  /**
   * Fetch macro events from calendar APIs
   */
  async fetchMacroEvents(
    startDate: Date,
    endDate: Date
  ): Promise<MacroEvent[]> {
    // Mock implementation - integrate with actual calendar APIs
    // Examples: EconomicCalendar API, CryptoCompare, etc.
    
    const mockEvents: MacroEvent[] = [
      {
        id: '1',
        title: 'US CPI Data Release',
        description: 'Consumer Price Index for November',
        type: 'CPI',
        sentiment: 'NEUTRAL',
        impactLevel: 'CRITICAL',
        affectedSymbols: ['BTC', 'ETH', 'ALL'],
        scheduledAt: new Date('2025-11-15T13:30:00Z'),
        tags: ['inflation', 'fed', 'macro'],
        source: 'Bureau of Labor Statistics',
        url: 'https://www.bls.gov/cpi/',
      },
      {
        id: '2',
        title: 'Ethereum ETF Decision',
        description: 'SEC decision on spot Ethereum ETF applications',
        type: 'ETF',
        sentiment: 'BULLISH',
        impactLevel: 'HIGH',
        affectedSymbols: ['ETH', 'ALTCOINS'],
        scheduledAt: new Date('2025-11-20T16:00:00Z'),
        tags: ['etf', 'sec', 'regulatory'],
        source: 'SEC',
      },
      {
        id: '3',
        title: 'SOL Token Unlock',
        description: '10M SOL tokens ($2B) to be unlocked',
        type: 'UNLOCK',
        sentiment: 'BEARISH',
        impactLevel: 'MEDIUM',
        affectedSymbols: ['SOL'],
        scheduledAt: new Date('2025-11-18T00:00:00Z'),
        tags: ['unlock', 'supply'],
      },
    ];

    return mockEvents.filter(
      e => e.scheduledAt >= startDate && e.scheduledAt <= endDate
    );
  }

  /**
   * Generate LLM digest for events
   */
  async generateLLMDigest(
    events: MacroEvent[],
    symbols?: string[]
  ): Promise<LLMDigest> {
    const cacheKey = `digest:${events.map(e => e.id).join(',')}}:${symbols?.join(',')}`;
    
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as LLMDigest;
      }
    }

    // Prepare context for LLM
    const eventsText = events.map(e => 
      `${e.title} (${e.type}, ${e.impactLevel} impact, scheduled ${e.scheduledAt.toISOString()}): ${e.description}`
    ).join('\n');

    const symbolsText = symbols?.length ? `Focus on: ${symbols.join(', ')}` : 'All crypto assets';

    const prompt = `Analyze these upcoming crypto market events and provide a trading digest:

Events:
${eventsText}

${symbolsText}

Provide:
1. A concise summary (2-3 sentences)
2. Overall market sentiment (BULLISH/BEARISH/NEUTRAL)
3. 3-5 key points
4. Trading implications
5. Asset-specific impacts

Format as JSON with keys: summary, sentiment, keyPoints[], tradingImplications[], affectedAssets[{symbol, impact, reasoning}]`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a professional crypto market analyst providing actionable trading insights.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0].message.content || '{}';
      const parsed = JSON.parse(content);

      const digest: LLMDigest = {
        summary: parsed.summary || 'No summary available',
        sentiment: parsed.sentiment || 'NEUTRAL',
        confidence: 85, // Mock confidence score
        keyPoints: parsed.keyPoints || [],
        tradingImplications: parsed.tradingImplications || [],
        affectedAssets: parsed.affectedAssets || [],
      };

      if (redis) {
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(digest));
      }

      return digest;
    } catch (error) {
      // Fallback digest if LLM fails
      return {
        summary: `${events.length} major events upcoming. Monitor closely for volatility.`,
        sentiment: 'NEUTRAL',
        confidence: 50,
        keyPoints: events.map(e => e.title),
        tradingImplications: [
          'Expect increased volatility around event times',
          'Consider reducing leverage ahead of high-impact events',
          'Watch for liquidity gaps during announcements',
        ],
        affectedAssets: [],
      };
    }
  }

  /**
   * Get event risk labels for symbols
   */
  async getEventRiskLabels(
    symbols: string[]
  ): Promise<EventRiskLabel[]> {
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcomingEvents = await this.fetchMacroEvents(now, next24h);
    const labels: EventRiskLabel[] = [];

    for (const symbol of symbols) {
      const relevantEvents = upcomingEvents.filter(
        e => e.affectedSymbols.includes(symbol) || e.affectedSymbols.includes('ALL')
      );

      if (relevantEvents.length > 0) {
        const nextEvent = relevantEvents[0];
        const hoursUntil = (nextEvent.scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60);

        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        let recommendation = 'Monitor positions';

        if (nextEvent.impactLevel === 'CRITICAL' && hoursUntil < 12) {
          riskLevel = 'HIGH';
          recommendation = 'Consider closing or hedging positions before event';
        } else if (nextEvent.impactLevel === 'HIGH' || hoursUntil < 6) {
          riskLevel = 'MEDIUM';
          recommendation = 'Tighten stops and monitor closely';
        }

        labels.push({
          symbol,
          riskLevel,
          nextEvent,
          hoursUntil,
          recommendation,
        });
      }
    }

    return labels;
  }

  /**
   * Auto-tag coins with event risk
   */
  async autoTagEventRisk(): Promise<Map<string, string>> {
    const labels = await this.getEventRiskLabels([
      'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'LINK', 'UNI'
    ]);

    const tags = new Map<string, string>();

    for (const label of labels) {
      if (label.riskLevel === 'HIGH') {
        tags.set(label.symbol, `⚠️ High event risk: ${label.nextEvent.title} in ${Math.floor(label.hoursUntil)}h`);
      } else if (label.riskLevel === 'MEDIUM') {
        tags.set(label.symbol, `⚡ Event risk: ${label.nextEvent.title} in ${Math.floor(label.hoursUntil)}h`);
      }
    }

    return tags;
  }

  /**
   * Get curated news feed
   */
  async getNewsFeed(
    limit: number = 20,
    symbols?: string[]
  ): Promise<Array<MacroEvent & { digest?: LLMDigest }>> {
    const now = new Date();
    const next7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let events = await this.fetchMacroEvents(now, next7days);

    // Filter by symbols if provided
    if (symbols && symbols.length > 0) {
      events = events.filter(e =>
        e.affectedSymbols.some(s => symbols.includes(s) || s === 'ALL')
      );
    }

    // Sort by impact and time
    events.sort((a, b) => {
      const impactWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const impactDiff = impactWeight[b.impactLevel] - impactWeight[a.impactLevel];
      if (impactDiff !== 0) return impactDiff;
      return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    });

    // Generate digests for top events
    const topEvents = events.slice(0, 5);
    if (topEvents.length > 0) {
      const digest = await this.generateLLMDigest(topEvents, symbols);
      
      // Attach digest to first event
      return events.slice(0, limit).map((e, i) => ({
        ...e,
        digest: i === 0 ? digest : undefined,
      }));
    }

    return events.slice(0, limit);
  }
}

export const newsService = new NewsService();

