// OG Card Generator & Market Pulse Digest
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';

export interface OGCardConfig {
  title: string;
  subtitle?: string;
  stats?: Array<{ label: string; value: string; color?: string }>;
  score?: { value: number; label: string };
  theme: 'dark' | 'light';
  includeQR?: boolean;
  url?: string;
}

export interface MarketPulseDigest {
  week: string;
  summary: string;
  topPerformers: Array<{
    symbol: string;
    change: number;
    volume: number;
  }>;
  topDecliners: Array<{
    symbol: string;
    change: number;
    volume: number;
  }>;
  topSignals: Array<{
    symbol: string;
    signal: string;
    ghostScore: number;
  }>;
  marketInsights: string[];
  upcomingEvents: Array<{
    title: string;
    date: Date;
    impact: string;
  }>;
  generatedAt: Date;
}

export class OGCardService {
  /**
   * Generate OG card HTML (can be rendered to image)
   */
  generateOGCardHTML(config: OGCardConfig): string {
    const { title, subtitle, stats, score, theme, includeQR, url } = config;
    
    const bgColor = theme === 'dark' ? '#0a0a0a' : '#ffffff';
    const textColor = theme === 'dark' ? '#ffffff' : '#000000';
    const accentColor = '#8b5cf6';

    let qrCodeSVG = '';
    if (includeQR && url) {
      // QR code will be generated separately and injected
      qrCodeSVG = `<div class="qr-code" style="position: absolute; bottom: 20px; right: 20px; width: 100px; height: 100px; background: white; border-radius: 8px; padding: 8px;"></div>`;
    }

    const statsHTML = stats?.map(stat => `
      <div style="text-align: center;">
        <div style="font-size: 14px; color: ${textColor}80; margin-bottom: 4px;">${stat.label}</div>
        <div style="font-size: 24px; font-weight: bold; color: ${stat.color || accentColor};">${stat.value}</div>
      </div>
    `).join('') || '';

    const scoreHTML = score ? `
      <div style="text-align: center; margin: 30px 0;">
        <div style="font-size: 72px; font-weight: bold; color: ${accentColor};">${score.value}</div>
        <div style="font-size: 18px; color: ${textColor}80;">${score.label}</div>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: ${bgColor};
            color: ${textColor};
          }
        </style>
      </head>
      <body>
        <div style="width: 1200px; height: 630px; background: ${bgColor}; padding: 60px; position: relative; background-image: radial-gradient(circle at 25% 25%, ${accentColor}20 0%, transparent 50%);">
          <!-- Logo/Branding -->
          <div style="font-size: 24px; font-weight: bold; color: ${accentColor}; margin-bottom: 40px;">GhostFX</div>
          
          <!-- Title -->
          <div style="font-size: 48px; font-weight: bold; margin-bottom: 16px; line-height: 1.2;">${title}</div>
          
          <!-- Subtitle -->
          ${subtitle ? `<div style="font-size: 24px; color: ${textColor}80; margin-bottom: 40px;">${subtitle}</div>` : ''}
          
          <!-- Score Section -->
          ${scoreHTML}
          
          <!-- Stats Grid -->
          ${stats && stats.length > 0 ? `
            <div style="display: grid; grid-template-columns: repeat(${Math.min(stats.length, 4)}, 1fr); gap: 30px; margin-top: 40px;">
              ${statsHTML}
            </div>
          ` : ''}
          
          <!-- QR Code -->
          ${qrCodeSVG}
          
          <!-- Footer -->
          <div style="position: absolute; bottom: 30px; left: 60px; font-size: 16px; color: ${textColor}60;">
            Real-time crypto intelligence · ghostfx.io
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate QR code as data URL
   */
  async generateQRCode(url: string): Promise<string> {
    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      return qrDataUrl;
    } catch (error) {
      console.error('QR generation failed:', error);
      return '';
    }
  }

  /**
   * Generate OG card for setup
   */
  async generateSetupCard(setupId: string): Promise<string> {
    const setup = await prisma.setup.findUnique({
      where: { id: setupId },
      include: { user: true },
    });

    if (!setup) {
      throw new Error('Setup not found');
    }

    const config: OGCardConfig = {
      title: `${setup.symbol} ${setup.direction} Setup`,
      subtitle: `by ${setup.user.name || 'Anonymous Analyst'}`,
      stats: [
        { label: 'Entry', value: `$${Number(setup.entry).toFixed(2)}` },
        { label: 'Stop Loss', value: `$${Number(setup.stopLoss).toFixed(2)}`, color: '#ef4444' },
        { label: 'Take Profit', value: `$${Number(setup.takeProfit1).toFixed(2)}`, color: '#22c55e' },
        { label: 'R:R', value: `1:${Number(setup.riskReward).toFixed(1)}`, color: '#8b5cf6' },
      ],
      score: setup.confidence ? {
        value: setup.confidence,
        label: 'Confidence Score',
      } : undefined,
      theme: 'dark',
      includeQR: true,
      url: `${process.env.NEXT_PUBLIC_URL}/setup/${setup.shareToken}`,
    };

    return this.generateOGCardHTML(config);
  }

  /**
   * Generate OG card for screener result
   */
  async generateScreenerCard(
    screenerName: string,
    results: Array<{ symbol: string; ghostScore: number }>
  ): Promise<string> {
    const config: OGCardConfig = {
      title: screenerName,
      subtitle: `${results.length} signals found`,
      stats: results.slice(0, 4).map(r => ({
        label: r.symbol,
        value: `${r.ghostScore}/100`,
        color: r.ghostScore >= 70 ? '#22c55e' : r.ghostScore >= 50 ? '#eab308' : '#ef4444',
      })),
      theme: 'dark',
      includeQR: false,
    };

    return this.generateOGCardHTML(config);
  }

  /**
   * Compile weekly Market Pulse digest
   */
  async compileWeeklyDigest(): Promise<MarketPulseDigest> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Mock implementation - integrate with actual data sources
    const topPerformers = [
      { symbol: 'SOL', change: 15.2, volume: 2500000000 },
      { symbol: 'AVAX', change: 12.8, volume: 800000000 },
      { symbol: 'MATIC', change: 9.5, volume: 600000000 },
    ];

    const topDecliners = [
      { symbol: 'XRP', change: -8.3, volume: 1200000000 },
      { symbol: 'ADA', change: -6.7, volume: 900000000 },
      { symbol: 'DOGE', change: -5.2, volume: 700000000 },
    ];

    const topSignals = [
      { symbol: 'BTC', signal: 'Golden Cross on 4H', ghostScore: 85 },
      { symbol: 'ETH', signal: 'RSI Oversold + Volume Surge', ghostScore: 78 },
      { symbol: 'SOL', signal: 'Breakout above resistance', ghostScore: 75 },
    ];

    const marketInsights = [
      'Bitcoin dominance increased to 52%, suggesting capital rotation into BTC',
      'Funding rates turned negative across major pairs, potential squeeze setup',
      'On-chain metrics show accumulation phase for ETH and SOL',
      'Correlation with traditional markets decreased to 0.35, crypto decoupling',
    ];

    const upcomingEvents = [
      { title: 'FOMC Meeting', date: new Date('2025-11-20'), impact: 'HIGH' },
      { title: 'ETH ETF Decision', date: new Date('2025-11-22'), impact: 'MEDIUM' },
    ];

    return {
      week: `Week of ${weekAgo.toLocaleDateString()} - ${now.toLocaleDateString()}`,
      summary: `Crypto markets showed strength this week with major altcoins outperforming BTC. Total market cap increased 5.2% while Bitcoin dominance rose to 52%. Key technicals suggest continuation of the current uptrend with potential resistance at $45,000 for BTC.`,
      topPerformers,
      topDecliners,
      topSignals,
      marketInsights,
      upcomingEvents,
      generatedAt: now,
    };
  }

  /**
   * Format digest as HTML email
   */
  formatDigestEmail(digest: MarketPulseDigest): string {
    const performersHTML = digest.topPerformers.map(p => `
      <tr>
        <td style="padding: 8px; font-weight: bold;">${p.symbol}</td>
        <td style="padding: 8px; color: #22c55e; text-align: right;">+${p.change.toFixed(1)}%</td>
        <td style="padding: 8px; color: #666; text-align: right;">$${(p.volume / 1e6).toFixed(0)}M</td>
      </tr>
    `).join('');

    const declinersHTML = digest.topDecliners.map(d => `
      <tr>
        <td style="padding: 8px; font-weight: bold;">${d.symbol}</td>
        <td style="padding: 8px; color: #ef4444; text-align: right;">${d.change.toFixed(1)}%</td>
        <td style="padding: 8px; color: #666; text-align: right;">$${(d.volume / 1e6).toFixed(0)}M</td>
      </tr>
    `).join('');

    const signalsHTML = digest.topSignals.map(s => `
      <div style="padding: 12px; background: #f9fafb; border-left: 3px solid #8b5cf6; margin-bottom: 12px; border-radius: 4px;">
        <div style="font-weight: bold; margin-bottom: 4px;">${s.symbol} · GhostScore ${s.ghostScore}/100</div>
        <div style="color: #666; font-size: 14px;">${s.signal}</div>
      </div>
    `).join('');

    const insightsHTML = digest.marketInsights.map(i => `
      <li style="margin-bottom: 8px; line-height: 1.6;">${i}</li>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .section { padding: 20px; background: white; }
          .section-title { font-size: 20px; font-weight: bold; margin-bottom: 16px; color: #8b5cf6; }
          table { width: 100%; border-collapse: collapse; }
          .footer { padding: 20px; background: #f9fafb; text-align: center; color: #666; font-size: 14px; border-radius: 0 0 8px 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">Market Pulse</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">${digest.week}</p>
          </div>
          
          <div class="section">
            <div class="section-title">Executive Summary</div>
            <p style="color: #666;">${digest.summary}</p>
          </div>
          
          <div class="section">
            <div class="section-title">📈 Top Performers</div>
            <table>${performersHTML}</table>
          </div>
          
          <div class="section">
            <div class="section-title">📉 Top Decliners</div>
            <table>${declinersHTML}</table>
          </div>
          
          <div class="section">
            <div class="section-title">🎯 Top Signals</div>
            ${signalsHTML}
          </div>
          
          <div class="section">
            <div class="section-title">💡 Market Insights</div>
            <ul style="color: #666; padding-left: 20px;">${insightsHTML}</ul>
          </div>
          
          <div class="footer">
            <p>Stay ahead with GhostFX · <a href="${process.env.NEXT_PUBLIC_URL}" style="color: #8b5cf6; text-decoration: none;">ghostfx.io</a></p>
            <p style="margin-top: 12px; font-size: 12px;">
              <a href="${process.env.NEXT_PUBLIC_URL}/unsubscribe" style="color: #999;">Unsubscribe</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send digest email to subscribers
   */
  async sendWeeklyDigest(digest: MarketPulseDigest): Promise<void> {
    // Get all users with digest enabled
    const users = await prisma.user.findMany({
      where: {
        notificationPreferences: {
          some: {
            digestEmail: true,
          },
        },
      },
      select: {
        email: true,
        name: true,
      },
    });

    const emailHTML = this.formatDigestEmail(digest);

    // Send emails (implement with your email service)
    console.log(`Would send digest to ${users.length} users`);
    // In production: integrate with SendGrid, AWS SES, etc.
  }
}

export const ogCardService = new OGCardService();

