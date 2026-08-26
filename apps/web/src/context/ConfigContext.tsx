import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { brand as fallbackBrand, CATEGORIES, DEFAULT_PREMIUM_PLAN, type CategoryDefinition, type PremiumPlan } from '@faithtube/shared';
import { api } from '@/lib/api';

export interface PlatformConfig {
  brand: typeof fallbackBrand;
  categories: CategoryDefinition[];
  plan: PremiumPlan;
  features: {
    googleSignIn: boolean;
    premiumCheckout: boolean;
    aiModeration: boolean;
    automaticTranscription: boolean;
    videoTranscoding: boolean;
    liveStreaming: boolean;
    cdn: boolean;
  };
  moderation: { provider: string; note: string };
  limits: { maxUploadBytes: number; maxUploadLabel: string };
}

const FALLBACK: PlatformConfig = {
  brand: fallbackBrand,
  categories: CATEGORIES,
  plan: DEFAULT_PREMIUM_PLAN,
  features: {
    googleSignIn: false,
    premiumCheckout: false,
    aiModeration: false,
    automaticTranscription: false,
    videoTranscoding: false,
    liveStreaming: false,
    cdn: false,
  },
  moderation: { provider: 'unknown', note: '' },
  limits: { maxUploadBytes: 2147483648, maxUploadLabel: '2 GB' },
};

const ConfigContext = createContext<PlatformConfig>(FALLBACK);

/**
 * Reads what this deployment can actually do. Every optional integration has a
 * flag here so the interface can show an honest "not configured" state instead
 * of a control that pretends to work.
 */
export function ConfigProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ['system-config'],
    queryFn: () => api<PlatformConfig>('/system/config'),
    staleTime: 5 * 60_000,
  });

  return <ConfigContext.Provider value={data ?? FALLBACK}>{children}</ConfigContext.Provider>;
}

export function useConfig(): PlatformConfig {
  return useContext(ConfigContext);
}
