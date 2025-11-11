import { env } from '@/env';
import type { CoinAnalysis } from './analysisService';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

type Tone = 'casual' | 'professional' | 'educational';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

class AIService {
  private client: OpenAI | null;
  private model: string;

  constructor() {
    this.client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
    this.model = env.OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  isAvailable() {
    return Boolean(this.client);
  }

  private ensureClient() {
    if (!this.client) {
      throw new Error('AI is not configured. Please add OPENAI_API_KEY to your environment.');
    }
    return this.client;
  }

  getAnalysisSummary(analysis: CoinAnalysis) {
    const supports = analysis.levels.support.length
      ? analysis.levels.support.map((s) => `$${s.toFixed(2)}`).join(', ')
      : 'n/a';
    const resistances = analysis.levels.resistance.length
      ? analysis.levels.resistance.map((r) => `$${r.toFixed(2)}`).join(', ')
      : 'n/a';

    const setup =
      analysis.suggestedSetup
        ? `${analysis.suggestedSetup.direction} entry ${analysis.suggestedSetup.entry.toFixed(2)}, SL ${analysis.suggestedSetup.stopLoss.toFixed(2)}, TP1 ${analysis.suggestedSetup.takeProfit1.toFixed(2)}`
        : 'No suggested setup';

    return [
      `Symbol: ${analysis.symbol}`,
      `Price: $${analysis.ticker.price.toFixed(2)} (${analysis.ticker.changePercent24h.toFixed(2)}% 24h)`,
      `GhostScore: ${analysis.ghostScore.totalScore} (${analysis.ghostScore.interpretation.label})`,
      `Trend: ${analysis.trend.direction} | EMA50 ${analysis.trend.ema50.toFixed(
        2
      )} vs EMA200 ${analysis.trend.ema200.toFixed(2)}`,
      `Momentum: RSI ${analysis.momentum.rsi.toFixed(1)} (${analysis.momentum.condition})`,
      `Volatility: ATR ${analysis.volatility.atr.toFixed(4)} (${analysis.volatility.atrPercent.toFixed(2)}%)`,
      `Structure: Support ${supports} | Resistance ${resistances}`,
      `Suggested setup: ${setup}`,
    ].join('\n');
  }

  async explainAnalysis(analysis: CoinAnalysis, options?: { tone?: Tone }) {
    const client = this.ensureClient();
    const tone = options?.tone ?? 'casual';
    const toneHint =
      tone === 'professional'
        ? 'Use a professional, concise tone suitable for traders.'
        : tone === 'educational'
        ? 'Teach like a mentor, explain jargon briefly.'
        : 'Keep it friendly and conversational.';

    const summary = this.getAnalysisSummary(analysis);

    const completion = await client.chat.completions.create({
      model: this.model,
      temperature: 0.35,
      messages: [
        {
          role: 'system',
          content:
            'You are Ghost, an AI trading co-pilot. Explain crypto market intel with personality but stay factual. Highlight trend, momentum, volatility, and key levels. Always remind users it is not financial advice.',
        },
        {
          role: 'user',
          content: `${toneHint}\nAnalyze the following market snapshot and explain what stands out. Keep it under 180 words. Add a short "Not financial advice" reminder at the end.\n\n${summary}`,
        },
      ],
    });

    return completion.choices[0]?.message?.content?.trim() ?? 'Ghost is speechless right now.';
  }

  async chat(
    messages: ChatMessage[],
    options?: { analysisSummary?: string; userName?: string; commandSummary?: string }
  ) {
    const client = this.ensureClient();

    const conversation: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'You are Ghost, an AI crypto analyst and assistant. Speak naturally, use short paragraphs or bullets, and weave in GhostScore insights when relevant. You can suggest alerts or watchlist actions, but remind users it is not financial advice.',
      },
    ];

    if (options?.analysisSummary) {
      conversation.push({
        role: 'system',
        content: `Latest market context:\n${options.analysisSummary}`,
      });
    }

    if (options?.commandSummary) {
      conversation.push({
        role: 'system',
        content: `System operations performed for the user: ${options.commandSummary}`,
      });
    }

    conversation.push(
      ...messages.map<ChatCompletionMessageParam>((msg) => ({
        role: msg.role,
        content: msg.content,
      }))
    );

    const completion = await client.chat.completions.create({
      model: this.model,
      temperature: 0.4,
      messages: conversation,
    });

    return completion.choices[0]?.message?.content?.trim() ?? 'I need another espresso—try again?';
  }
}

export const aiService = new AIService();
