import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, typography } from '@/theme';

/** The FaithTube mark: a chapel arch with a cross at its apex and a play form. */
export function LogoMark({ size = 32, color = colors.gold }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M32 6v11M26.5 11.5h11" stroke={color} strokeWidth={3.2} strokeLinecap="round" />
      <Path
        d="M14 54V33.5a18 18 0 0 1 36 0V54a2.5 2.5 0 0 1-2.5 2.5h-31A2.5 2.5 0 0 1 14 54Z"
        fill="none"
        stroke={color}
        strokeWidth={3.6}
        strokeLinejoin="round"
      />
      <Path d="M27 31 42 40l-15 9Z" fill={color} />
    </Svg>
  );
}

export function Wordmark({ color = colors.navy, size = 30 }: { color?: string; size?: number }) {
  return (
    <View style={styles.row}>
      <LogoMark size={size} />
      <Text style={[styles.word, { color, fontSize: size * 0.72 }]}>
        <Text style={styles.wordBold}>Faith</Text>
        <Text style={styles.wordLight}>Tube</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { letterSpacing: -0.6 },
  wordBold: { fontWeight: '700' },
  wordLight: { fontWeight: '300' },
});

export { typography };
