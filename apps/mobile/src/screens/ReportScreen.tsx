import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { api, ApiError } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/theme';
import { Button, Card } from '@/components/ui';
import type { StackScreenProps } from '@/navigation';

const REASONS: Array<[string, string]> = [
  ['NOT_CHRISTIAN_CONTENT', 'Not Christian content'],
  ['DANGEROUS_CONTENT', 'Dangerous or harmful'],
  ['SPAM', 'Spam or misleading repetition'],
  ['HARASSMENT', 'Harassment or bullying'],
  ['SCAM', 'Scam or fraud'],
  ['COPYRIGHT', 'Copyright concern'],
  ['SEXUAL_CONTENT', 'Sexual content'],
  ['VIOLENCE', 'Violence'],
  ['MISLEADING', 'Misleading claims'],
  ['IMPERSONATION', 'Impersonation'],
  ['OTHER', 'Something else'],
];

export function ReportScreen({ route, navigation }: StackScreenProps<'Report'>) {
  const { palette } = useApp();
  const { targetType, targetId, label } = route.params;
  const [reason, setReason] = useState(REASONS[0][0]);
  const [details, setDetails] = useState('');

  const submit = useMutation({
    mutationFn: () => api<{ message: string }>('/reports', { method: 'POST', body: { targetType, targetId, reason, details } }),
    onSuccess: (result) => {
      Alert.alert('Thank you', result.message ?? 'A moderator will review this.');
      navigation.goBack();
    },
    onError: (err) => Alert.alert('Could not send', err instanceof ApiError ? err.message : 'Please try again.'),
  });

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Card>
        <Text style={[typography.body, { color: palette.textMuted }]}>
          Reporting <Text style={{ color: palette.text, fontWeight: '600' }}>“{label}”</Text>. Reports go to a human
          moderator. Please only report content that breaks our guidelines — disagreeing with a video is not grounds for
          a report.
        </Text>
      </Card>

      <Card>
        <Text style={[typography.heading, { color: palette.text, marginBottom: spacing.sm }]}>What is the problem?</Text>
        {REASONS.map(([value, text]) => (
          <Pressable
            key={value}
            onPress={() => setReason(value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: reason === value }}
            style={styles.reasonRow}
          >
            <View style={[styles.radio, { borderColor: reason === value ? colors.gold : palette.border }]}>
              {reason === value ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={[typography.body, { color: palette.text }]}>{text}</Text>
          </Pressable>
        ))}
      </Card>

      <Card>
        <Text style={[typography.heading, { color: palette.text, marginBottom: spacing.sm }]}>Anything else?</Text>
        <TextInput
          value={details}
          onChangeText={setDetails}
          multiline
          numberOfLines={4}
          maxLength={2000}
          accessibilityLabel="Extra details for the moderator"
          placeholder="Timestamps or context help our team review this faster."
          placeholderTextColor={palette.textMuted}
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
        />
      </Card>

      <Button label="Send report" variant="gold" loading={submit.isPending} onPress={() => submit.mutate()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: typography.minTouchTarget },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  input: {
    minHeight: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    textAlignVertical: 'top',
  },
});
