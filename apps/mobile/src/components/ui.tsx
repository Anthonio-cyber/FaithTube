import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Rect, G } from 'react-native-svg';
import { useApp } from '@/context/AppContext';
import { colors, radius, spacing, typography } from '@/theme';
import { formatDuration, initials } from '@/lib/format';

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { palette } = useApp();
  return <View style={[{ flex: 1, backgroundColor: palette.background }, style]}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { palette } = useApp();
  return (
    <View
      style={[
        {
          backgroundColor: palette.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.border,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'gold' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette, isDark } = useApp();

  const background =
    variant === 'gold' ? colors.gold : variant === 'primary' ? (isDark ? colors.cream : colors.navy) : 'transparent';
  const textColor =
    variant === 'gold'
      ? colors.navy
      : variant === 'primary'
        ? isDark
          ? colors.navy
          : colors.cream
        : palette.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'outline' && { borderWidth: 1, borderColor: palette.border },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={textColor} /> : null}
      <Text style={[styles.buttonLabel, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

export function Avatar({ uri, name, size = 40 }: { uri?: string | null; name: string; size?: number }) {
  const { palette, isDark } = useApp();
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? colors.navyMuted : colors.navy,
      }}
    >
      <Text style={{ color: colors.cream, fontSize: size * 0.36, fontWeight: '600' }}>{initials(name)}</Text>
    </View>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'gold' | 'verified' | 'danger' | 'warn' }) {
  const { palette } = useApp();
  const tones = {
    neutral: { bg: palette.border, fg: palette.textMuted },
    gold: { bg: 'rgba(216,162,74,0.18)', fg: colors.goldDeep },
    verified: { bg: 'rgba(63,163,122,0.16)', fg: colors.verified },
    danger: { bg: 'rgba(180,69,60,0.16)', fg: colors.danger },
    warn: { bg: 'rgba(200,121,47,0.16)', fg: colors.warn },
  };
  const { bg, fg } = tones[tone];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/**
 * The Christian-content indicator. Rendered only when the API reports the video
 * completed moderation — never optimistically.
 */
export function VerifiedBadge({ verified, compact }: { verified: boolean; compact?: boolean }) {
  if (!verified) return null;
  return (
    <View style={styles.verified} accessibilityLabel="Christian Content Verified">
      <Svg width={13} height={13} viewBox="0 0 24 24">
        <Path
          d="M12 21.5c4.5-1.8 7-5.4 7-10V5.4L12 2.5 5 5.4v6.1c0 4.6 2.5 8.2 7 10Z"
          fill="none"
          stroke={colors.verified}
          strokeWidth={1.8}
        />
        <Path d="m9 11.8 2.2 2.2L15.2 10" fill="none" stroke={colors.verified} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
      {!compact ? <Text style={styles.verifiedText}>Christian Content Verified</Text> : null}
    </View>
  );
}

/**
 * Deterministic placeholder art for videos with no thumbnail, matching the web
 * client so the same video looks the same on both.
 */
export function PlaceholderArt({ title, categorySlug, style }: { title: string; categorySlug: string; style?: StyleProp<ViewStyle> }) {
  const hash = [...title].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const palettes = [
    ['#152444', '#0B1730'],
    ['#3A2A5C', '#151033'],
    ['#123A3A', '#08201F'],
    ['#402B18', '#1B1109'],
    ['#1B2E4A', '#0A1526'],
  ];
  const [from, to] = palettes[hash % palettes.length];

  return (
    <View style={[{ overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={`g${hash}`} x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect width="320" height="180" fill={`url(#g${hash})`} />
        <G opacity={0.16}>
          <Path d="M160 -40 60 220h30l70-210 70 210h30L160 -40Z" fill={colors.goldSoft} />
        </G>
      </Svg>
      <LogoGlyph />
      <Text style={styles.placeholderLabel}>{categorySlug.replace(/-/g, ' ').toUpperCase()}</Text>
    </View>
  );
}

function LogoGlyph() {
  return (
    <Svg width={30} height={30} viewBox="0 0 64 64">
      <Path d="M32 8v10M27 13h10" stroke={colors.gold} strokeWidth={3.4} strokeLinecap="round" opacity={0.85} />
      <Path d="M16 54V34a16 16 0 0 1 32 0v20Z" fill="none" stroke={colors.gold} strokeWidth={3.4} opacity={0.85} />
    </Svg>
  );
}

export function DurationPill({ seconds }: { seconds: number }) {
  return (
    <View style={styles.duration}>
      <Text style={styles.durationText}>{formatDuration(seconds)}</Text>
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  const { palette } = useApp();
  return (
    <View style={styles.empty}>
      <LogoGlyph />
      <Text style={[styles.emptyTitle, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: palette.textMuted }]}>{body}</Text>
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  const { palette } = useApp();
  return (
    <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.gold} />
    </View>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { palette } = useApp();
  return (
    <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
      <Text style={[typography.title, { color: palette.text }]}>{title}</Text>
      {subtitle ? <Text style={[typography.caption, { color: palette.textMuted, marginTop: 2 }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: typography.minTouchTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonLabel: { fontSize: 15, fontWeight: '600' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifiedText: { color: colors.verified, fontSize: 11.5, fontWeight: '600' },
  placeholderLabel: {
    color: 'rgba(251,247,239,0.55)',
    fontSize: 9,
    letterSpacing: 1.4,
    marginTop: 6,
    fontWeight: '600',
  },
  duration: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(6,13,29,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  durationText: { color: colors.cream, fontSize: 11, fontWeight: '600' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: spacing.md },
  emptyBody: { fontSize: 14, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  loading: { paddingVertical: 48, alignItems: 'center' },
});
