import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { api, apiBaseUrl, ApiError, getToken } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/theme';
import { Button, Card, EmptyState } from '@/components/ui';
import type { TabScreenProps } from '@/navigation';

const CATEGORIES = [
  ['sermons', 'Sermons'],
  ['bible-studies', 'Bible Studies'],
  ['worship', 'Worship'],
  ['testimonies', 'Testimonies'],
  ['evangelism', 'Evangelism'],
  ['youth', 'Youth'],
  ['family', 'Family'],
  ['christian-animation', 'Christian Animation'],
  ['prayer', 'Prayer'],
] as const;

interface PipelineStage {
  kind: string;
  label: string;
  status: string;
}

/**
 * Upload from the device library.
 *
 * The review step polls the real pipeline rather than showing a spinner and
 * declaring success — the creator sees the actual decision when it lands.
 */
export function CreateScreen({ navigation }: TabScreenProps<'CreateTab'>) {
  const { palette, user } = useApp();
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categorySlug, setCategorySlug] = useState<string>('sermons');
  const [uploading, setUploading] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);

  const { data: status } = useQuery({
    queryKey: ['upload-status', videoId],
    queryFn: () =>
      api<{
        status: string;
        pipeline: { stages: PipelineStage[]; overallProgress: number };
        review: { decision: string; message: string; canAppeal: boolean } | null;
      }>(`/videos/${videoId}/status`),
    enabled: Boolean(videoId),
    refetchInterval: (query) => {
      const data = query.state.data as { status: string } | undefined;
      const terminal = ['PUBLISHED', 'REJECTED', 'AWAITING_REVIEW', 'APPROVED', 'SCHEDULED'];
      return data && terminal.includes(data.status) ? false : 2500;
    },
  });

  if (!user) {
    return <EmptyState title="Sign in to upload" body="You need an account before you can share a video on FaithTube." />;
  }

  if (!user.channelHandle) {
    return (
      <EmptyState
        title="Create your channel first"
        body="Set up a channel on the FaithTube website, then come back here to upload from your phone."
      />
    );
  }

  async function pickVideo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'FaithTube needs access to your library to upload a video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;

    const selected = result.assets[0];
    setAsset(selected);
    if (!title) {
      setTitle((selected.fileName ?? '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 140));
    }
  }

  async function submit() {
    if (!asset) return;
    setUploading(true);
    try {
      const body = new FormData();
      // React Native's FormData takes a file descriptor rather than a Blob.
      body.append('video', {
        uri: asset.uri,
        name: asset.fileName ?? 'upload.mp4',
        type: asset.mimeType ?? 'video/mp4',
      } as unknown as Blob);
      body.append('title', title.trim());
      body.append('description', description.trim());
      body.append('categorySlug', categorySlug);
      body.append('visibility', 'PUBLIC');

      const token = await getToken();
      const response = await fetch(`${apiBaseUrl()}/api/videos`, {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
        body,
      });
      const payload = (await response.json()) as { video?: { id: string }; message?: string };
      if (!response.ok) throw new ApiError(response.status, 'upload_failed', payload.message ?? 'Upload failed.');

      setVideoId(payload.video!.id);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof ApiError ? err.message : 'Your upload could not be completed.');
    } finally {
      setUploading(false);
    }
  }

  if (videoId) {
    const decision = status?.review?.decision;
    return (
      <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={{ padding: spacing.lg }}>
        <Card>
          <Text style={[typography.title, { color: palette.text, textAlign: 'center' }]}>
            {decision === 'APPROVED' || decision === 'RESTRICTED'
              ? 'Approved'
              : decision === 'REJECTED'
                ? 'Not approved'
                : decision === 'HUMAN_REVIEW'
                  ? 'With a moderator'
                  : 'Review in progress…'}
          </Text>
          <Text style={[typography.body, { color: palette.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
            {status?.review?.message ?? 'We are reading your video now. This usually takes a minute or two.'}
          </Text>

          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            {(status?.pipeline.stages ?? []).map((stage) => (
              <View key={stage.kind} style={styles.stageRow}>
                <View
                  style={[
                    styles.stageDot,
                    {
                      backgroundColor:
                        stage.status === 'DONE'
                          ? colors.verified
                          : stage.status === 'RUNNING'
                            ? colors.gold
                            : stage.status === 'FAILED'
                              ? colors.danger
                              : palette.border,
                    },
                  ]}
                />
                <Text style={[typography.body, { color: stage.status === 'DONE' ? palette.text : palette.textMuted }]}>
                  {stage.label}
                </Text>
              </View>
            ))}
          </View>

          <Button
            label="Done"
            variant="gold"
            style={{ marginTop: spacing.xl }}
            onPress={() => {
              setVideoId(null);
              setAsset(null);
              setTitle('');
              setDescription('');
              navigation.navigate('HomeTab');
            }}
          />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={[typography.heading, { color: palette.text }]}>Upload a video</Text>
        <Text style={[typography.body, { color: palette.textMuted, marginTop: 4 }]}>
          Every upload is reviewed before anyone can watch it.
        </Text>
        <Button
          label={asset ? 'Change video' : 'Choose a video'}
          variant={asset ? 'outline' : 'gold'}
          onPress={() => void pickVideo()}
          style={{ marginTop: spacing.lg }}
        />
        {asset ? (
          <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.sm }]} numberOfLines={1}>
            {asset.fileName ?? 'Selected video'}
            {asset.fileSize ? ` · ${(asset.fileSize / 1024 / 1024).toFixed(1)} MB` : ''}
          </Text>
        ) : null}
      </Card>

      {asset ? (
        <>
          <Card>
            <Text style={styles.label}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={140}
              accessibilityLabel="Video title"
              style={[styles.input, { color: palette.text, borderColor: palette.border }]}
            />

            <Text style={[styles.label, { marginTop: spacing.lg }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              maxLength={6000}
              accessibilityLabel="Video description"
              placeholder="What is this teaching about? Which passage does it cover?"
              placeholderTextColor={palette.textMuted}
              style={[styles.input, styles.multiline, { color: palette.text, borderColor: palette.border }]}
            />

            <Text style={[styles.label, { marginTop: spacing.lg }]}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map(([slug, name]) => (
                <Text
                  key={slug}
                  accessibilityRole="button"
                  accessibilityState={{ selected: categorySlug === slug }}
                  onPress={() => setCategorySlug(slug)}
                  style={[
                    styles.chip,
                    { borderColor: palette.border, color: palette.text },
                    categorySlug === slug && { backgroundColor: colors.gold, color: colors.navy, borderColor: colors.gold },
                  ]}
                >
                  {name}
                </Text>
              ))}
            </View>
          </Card>

          <Button
            label="Submit for review"
            variant="gold"
            loading={uploading}
            disabled={title.trim().length < 3}
            onPress={() => void submit()}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { color: '#8b8b8b', fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  input: {
    minHeight: typography.minTouchTarget,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  multiline: { minHeight: 110, paddingTop: spacing.md, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    fontSize: 13,
    overflow: 'hidden',
  },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stageDot: { width: 9, height: 9, borderRadius: 5 },
});
