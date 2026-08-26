import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { ApiError } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/theme';
import { Button } from '@/components/ui';
import { LogoMark } from '@/components/Brand';

export function AuthScreen() {
  const { signIn, palette } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.navy }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <LogoMark size={56} />
          <Text style={styles.wordmark}>
            <Text style={{ fontWeight: '700' }}>Faith</Text>
            <Text style={{ fontWeight: '300' }}>Tube</Text>
          </Text>
          <Text style={styles.motto}>Every Video. Christ-Centered.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            accessibilityLabel="Email address"
            placeholderTextColor="rgba(251,247,239,0.4)"
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: spacing.lg }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            accessibilityLabel="Password"
            onSubmitEditing={submit}
            returnKeyType="go"
            placeholderTextColor="rgba(251,247,239,0.4)"
            style={styles.input}
          />

          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Button label="Sign in" variant="gold" onPress={submit} loading={busy} style={{ marginTop: spacing.xl }} />

          <Text style={styles.footnote}>
            New to FaithTube? Create your account on the web, then sign in here. Every video on this platform passes a
            Christ-centred review before anyone can watch it.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  brand: { alignItems: 'center', marginBottom: spacing.xxl },
  wordmark: { color: colors.cream, fontSize: 30, marginTop: spacing.md, letterSpacing: -0.6 },
  motto: { color: colors.goldSoft, fontSize: 12, marginTop: spacing.sm, letterSpacing: 1, fontWeight: '600' },
  form: { gap: 0 },
  label: { color: 'rgba(251,247,239,0.75)', fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  input: {
    minHeight: typography.minTouchTarget + 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    color: colors.cream,
    fontSize: 16,
  },
  error: { color: '#F0A9A3', fontSize: 13, marginTop: spacing.md },
  footnote: { color: 'rgba(251,247,239,0.5)', fontSize: 12, lineHeight: 18, marginTop: spacing.xl, textAlign: 'center' },
});
