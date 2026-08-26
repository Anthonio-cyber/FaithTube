export interface PremiumPlan {
  id: string;
  name: string;
  /** Price in minor units (cents). Editable from the admin dashboard at runtime. */
  amountMinor: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
}

/**
 * Default plan shipped with the platform. The live values are stored in
 * PlatformSetting rows so an admin can change price without a deploy.
 */
export const DEFAULT_PREMIUM_PLAN: PremiumPlan = {
  id: 'premium-monthly',
  name: 'Premium',
  amountMinor: 2500,
  currency: 'USD',
  interval: 'month',
  features: [
    'Ad-free viewing across web and mobile',
    'Background playback',
    'Offline viewing on mobile',
    'Highest available playback quality',
    'Premium Christian documentaries and teaching',
    'Advanced Bible discovery and AI-assisted study',
    'Enhanced playlists and collections',
    'Premium badge on your profile',
    'Priority support',
  ],
};

export function formatPrice(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountMinor / 100);
}

export const PREMIUM_STATUSES = ['ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING', 'COMPLIMENTARY'] as const;
export type PremiumStatus = (typeof PREMIUM_STATUSES)[number];
