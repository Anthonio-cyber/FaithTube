/**
 * The mobile design tokens.
 *
 * These mirror the web palette exactly — the same navy, gold and cream — so the
 * two clients read as one product, but the spacing and type scale are chosen for
 * touch rather than copied from the web layout.
 */
export const colors = {
  navy: '#0B1730',
  navyDeep: '#060D1D',
  navySoft: '#152444',
  navyMuted: '#1E3054',
  gold: '#D8A24A',
  goldSoft: '#F0CE8E',
  goldDeep: '#B07F2E',
  cream: '#FBF7EF',
  creamDim: '#F2EBDD',
  plum: '#3A2A5C',
  verified: '#3FA37A',
  warn: '#C8792F',
  danger: '#B4453C',
} as const;

export interface Palette {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
}

export const lightPalette: Palette = {
  background: colors.cream,
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  border: 'rgba(11,23,48,0.10)',
  text: colors.navy,
  textMuted: 'rgba(11,23,48,0.58)',
  accent: colors.gold,
  accentText: colors.navy,
};

export const darkPalette: Palette = {
  background: colors.navyDeep,
  surface: colors.navySoft,
  surfaceRaised: colors.navyMuted,
  border: 'rgba(255,255,255,0.10)',
  text: colors.cream,
  textMuted: 'rgba(251,247,239,0.58)',
  accent: colors.gold,
  accentText: colors.navy,
};

/** A 4pt scale — comfortable thumb targets without feeling loose. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const typography = {
  display: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  // Minimum touch target per platform accessibility guidance.
  minTouchTarget: 44,
} as const;
