// Pricing tiers and feature limits
import type { UserRole } from '@prisma/client';

export interface FeatureLimits {
  watchlists: number;
  alerts: number;
  screeners: number;
  backtests: number;
  rooms: number;
  apiAccess: boolean;
  compoundAlerts: boolean;
  regimeAwareness: boolean;
  derivativesData: boolean;
  prioritySupport: boolean;
  auditLogs: boolean;
  webhooks: boolean;
  customBranding: boolean;
}

export interface PricingTier {
  role: UserRole;
  name: string;
  price: number;
  interval: 'month' | 'year';
  description: string;
  features: string[];
  limits: FeatureLimits;
  popular?: boolean;
}

export const PRICING_TIERS: Record<UserRole, PricingTier> = {
  USER: {
    role: 'USER',
    name: 'Free',
    price: 0,
    interval: 'month',
    description: 'Get started with basic crypto intelligence',
    features: [
      '5 watchlist items',
      '10 active alerts',
      '3 saved screeners',
      'Basic GhostScore analysis',
      'Real-time price data',
      'Support/resistance levels',
      'Community access',
    ],
    limits: {
      watchlists: 5,
      alerts: 10,
      screeners: 3,
      backtests: 5,
      rooms: 1,
      apiAccess: false,
      compoundAlerts: false,
      regimeAwareness: false,
      derivativesData: false,
      prioritySupport: false,
      auditLogs: false,
      webhooks: false,
      customBranding: false,
    },
  },

  PRO: {
    role: 'PRO',
    name: 'Pro',
    price: 29,
    interval: 'month',
    description: 'Advanced trading tools for serious traders',
    features: [
      'Unlimited watchlists',
      'Unlimited alerts',
      'Unlimited screeners',
      'Compound alert rules',
      'Regime awareness (ADX-based)',
      'Derivatives data (OI, funding, CVD)',
      'Advanced GhostScore 2.0',
      'Backtest strategies',
      'Export to CSV/JSON',
      'Email digest reports',
      'Priority email support',
    ],
    limits: {
      watchlists: -1, // -1 = unlimited
      alerts: -1,
      screeners: -1,
      backtests: -1,
      rooms: 5,
      apiAccess: false,
      compoundAlerts: true,
      regimeAwareness: true,
      derivativesData: true,
      prioritySupport: true,
      auditLogs: false,
      webhooks: false,
      customBranding: false,
    },
    popular: true,
  },

  ADMIN: {
    role: 'ADMIN',
    name: 'Team',
    price: 99,
    interval: 'month',
    description: 'For teams and professional traders',
    features: [
      'Everything in Pro',
      'Up to 10 team rooms',
      'Shareable setup cards',
      'Team leaderboards',
      'Audit trails',
      'API access with webhooks',
      'Shadow trade tracking',
      'Portfolio risk analysis',
      'Custom screener templates',
      'Dedicated Slack channel',
      'Priority phone support',
    ],
    limits: {
      watchlists: -1,
      alerts: -1,
      screeners: -1,
      backtests: -1,
      rooms: 10,
      apiAccess: true,
      compoundAlerts: true,
      regimeAwareness: true,
      derivativesData: true,
      prioritySupport: true,
      auditLogs: true,
      webhooks: true,
      customBranding: false,
    },
  },

  OWNER: {
    role: 'OWNER',
    name: 'Enterprise',
    price: 0, // Custom pricing
    interval: 'month',
    description: 'Custom solutions for institutions',
    features: [
      'Everything in Team',
      'Unlimited rooms',
      'Custom integrations',
      'White-label branding',
      'Dedicated account manager',
      'On-premise deployment',
      'Custom SLA',
      'Advanced analytics',
      'Data export API',
      '24/7 premium support',
    ],
    limits: {
      watchlists: -1,
      alerts: -1,
      screeners: -1,
      backtests: -1,
      rooms: -1,
      apiAccess: true,
      compoundAlerts: true,
      regimeAwareness: true,
      derivativesData: true,
      prioritySupport: true,
      auditLogs: true,
      webhooks: true,
      customBranding: true,
    },
  },
};

export class PricingService {
  /**
   * Get pricing tier for a user role
   */
  getTier(role: UserRole): PricingTier {
    return PRICING_TIERS[role];
  }

  /**
   * Get feature limits for a user role
   */
  getLimits(role: UserRole): FeatureLimits {
    return PRICING_TIERS[role].limits;
  }

  /**
   * Check if user can perform action based on their tier
   */
  canPerformAction(
    role: UserRole,
    action: keyof FeatureLimits,
    currentCount?: number
  ): { allowed: boolean; reason?: string } {
    const limits = this.getLimits(role);
    const limit = limits[action];

    // Boolean feature check
    if (typeof limit === 'boolean') {
      return {
        allowed: limit,
        reason: limit ? undefined : `Upgrade to ${this.getRequiredTier(action)} to access this feature`,
      };
    }

    // Numeric limit check
    if (typeof limit === 'number') {
      if (limit === -1) {
        // Unlimited
        return { allowed: true };
      }

      if (currentCount !== undefined && currentCount >= limit) {
        return {
          allowed: false,
          reason: `You've reached your limit of ${limit}. Upgrade to ${this.getRequiredTier(action)} for more.`,
        };
      }

      return { allowed: true };
    }

    return { allowed: true };
  }

  /**
   * Get the minimum tier required for a feature
   */
  private getRequiredTier(feature: keyof FeatureLimits): string {
    for (const [role, tier] of Object.entries(PRICING_TIERS)) {
      const limit = tier.limits[feature];
      if (typeof limit === 'boolean' && limit === true) {
        return tier.name;
      }
      if (typeof limit === 'number' && limit !== 0) {
        return tier.name;
      }
    }
    return 'Pro';
  }

  /**
   * Get all tiers for pricing page
   */
  getAllTiers(): PricingTier[] {
    return [
      PRICING_TIERS.USER,
      PRICING_TIERS.PRO,
      PRICING_TIERS.ADMIN,
    ];
  }

  /**
   * Check if user should be shown upgrade prompt
   */
  shouldShowUpgrade(role: UserRole, feature: keyof FeatureLimits): boolean {
    const { allowed } = this.canPerformAction(role, feature);
    return !allowed && role !== 'OWNER';
  }

  /**
   * Get upgrade CTA message
   */
  getUpgradeMessage(role: UserRole, feature: keyof FeatureLimits): string {
    const requiredTier = this.getRequiredTier(feature);
    const currentTier = this.getTier(role);

    if (role === 'USER') {
      return `Unlock ${feature.replace(/([A-Z])/g, ' $1').toLowerCase()} with ${requiredTier}`;
    }

    return `Upgrade to ${requiredTier} for advanced ${feature.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
  }
}

export const pricingService = new PricingService();

// Helper hook for React components
export function useFeatureAccess(role: UserRole, feature: keyof FeatureLimits) {
  return pricingService.canPerformAction(role, feature);
}

