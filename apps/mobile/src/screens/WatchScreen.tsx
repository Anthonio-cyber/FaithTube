import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Share } from 'react-native';
import { Audio, ResizeMode, Video, type AVPlaybackStatus } from 'expo-av';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { api, ApiError, mediaUrl } from '@/lib/api';
import { formatCount, formatDuration, timeAgo } from '@/lib/format';
import { colors, radius, spacing, typography } from '@/theme';
import { Avatar, Badge, Button, Card, Loading, PlaceholderArt, VerifiedBadge } from '@/components/ui';
import { VideoCard, type VideoSummary } from '@/components/VideoCard';
import type { StackScreenProps } from '@/navigation';

interface VideoDetail extends VideoSummary {
  sources: Array<{ quality: string; url: string; height: number }>;
  chapters: Array<{ startSeconds: number; title: string }>;
  transcript: Array<{ startSeconds: number; endSeconds: number; text: string }> | null;
  scriptureRefs: string[];
  contentWarnings: string[];
  viewerState: { liked: boolean; saved: boolean; subscribed: boolean; progressSeconds: number } | null;
}

export function WatchScreen({ route, navigation }: StackScreenProps<'Watch'>) {
  const { slug } = route.params;
  const { palette, user } = useApp();
  const queryClient = useQueryClient();
  const player = useRef<Video>(null);
  const lastReport = useRef({ at: Date.now(), position: 0 });
  const [acknowledgedAgeGate, setAcknowledgedAgeGate] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['video', slug],
    queryFn: () => api<{ video: VideoDetail }>(`/videos/${slug}`),
    retry: false,
  });

  const video = data?.video;

  const { data: related } = useQuery({
    queryKey: ['related', video?.id],
    queryFn: () => api<{ items: VideoSummary[] }>(`/videos/${video!.id}/related`),
    enabled: Boolean(video?.id),
  });

  /**
   * Background playback is a Premium feature, and in expo-av it is a property of
   * the audio session rather than of the player. Setting it here means a
   * Premium member can lock their phone during a sermon and keep listening,
   * while everyone else pauses — which is the entitlement, honestly enforced.
   */
  useEffect(() => {
    void Audio.setAudioModeAsync({
      staysActiveInBackground: user?.isPremium ?? false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    }).catch(() => undefined);
  }, [user?.isPremium]);

  const like = useMutation({
    mutationFn: (value: 1 | 0) => api(`/videos/${video!.id}/like`, { method: 'POST', body: { value } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['video', slug] }),
  });

  const save = useMutation({
    mutationFn: () => api(`/videos/${video!.id}/save`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['video', slug] }),
  });

  const subscribe = useMutation({
    mutationFn: () => api(`/channels/${video!.channel.id}/subscribe`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['video', slug] }),
  });

  /** Progress is reported on a throttle so a closed app still keeps the place. */
  const onPlaybackStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded || !user || !video) return;
      const position = status.positionMillis / 1000;
      const now = Date.now();
      if (now - lastReport.current.at < 15_000 && !status.didJustFinish) return;

      const watched = Math.max(0, Math.min((now - lastReport.current.at) / 1000, Math.abs(position - lastReport.current.position) + 1));
      lastReport.current = { at: now, position };

      void api(`/videos/${video.id}/progress`, {
        method: 'POST',
        body: {
          progressSeconds: Math.round(position),
          watchedSeconds: Math.round(watched),
          completed: Boolean(status.didJustFinish),
        },
      }).catch(() => undefined);
    },
    [user, video],
  );

  if (isLoading) return <Loading label="Loading video" />;

  if (error instanceof ApiError || !video) {
    return (
      <View style={styles.centered}>
        <Text style={[typography.title, { color: palette.text }]}>Not available</Text>
        <Text style={[typography.body, { color: palette.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
          {error instanceof ApiError && error.status === 403
            ? error.message
            : 'This video may have been removed, or it may still be in review.'}
        </Text>
      </View>
    );
  }

  const source = video.sources.find((s) => s.height <= 720) ?? video.sources[0];
  const needsAgeGate = video.ageRestricted && !acknowledgedAgeGate;

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.player}>
        {needsAgeGate ? (
          <View style={styles.ageGate}>
            <Text style={styles.ageGateTitle}>Content notice</Text>
            <Text style={styles.ageGateBody}>
              This is Christian content, but it covers subjects some viewers will find heavy
              {video.contentWarnings.length ? `: ${video.contentWarnings.join(', ').toLowerCase()}` : ''}.
            </Text>
            <Button label="I understand — play" variant="gold" onPress={() => setAcknowledgedAgeGate(true)} style={{ marginTop: spacing.lg }} />
          </View>
        ) : source ? (
          <Video
            ref={player}
            source={{ uri: mediaUrl(source.url)! }}
            style={StyleSheet.absoluteFill}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldCorrectPitch
            positionMillis={(video.viewerState?.progressSeconds ?? 0) * 1000}
            onPlaybackStatusUpdate={onPlaybackStatus}
          />
        ) : (
          <>
            <PlaceholderArt title={video.title} categorySlug={video.categorySlug} style={StyleSheet.absoluteFill} />
            <View style={styles.noSource}>
              <Text style={styles.noSourceText}>
                This video has no playable file on this deployment.
              </Text>
            </View>
          </>
        )}
      </View>

      <View style={{ padding: spacing.lg }}>
        <View style={styles.badgeRow}>
          <VerifiedBadge verified={video.christianContentVerified} />
          {video.premiumOnly ? <Badge label="Premium" tone="gold" /> : null}
          {video.ageRestricted ? <Badge label="18+" tone="warn" /> : null}
        </View>

        <Text style={[typography.title, { color: palette.text, marginTop: spacing.sm }]}>{video.title}</Text>
        <Text style={[typography.caption, { color: palette.textMuted, marginTop: 4 }]}>
          {formatCount(video.viewCount)} views · {timeAgo(video.publishedAt)}
        </Text>

        <View style={[styles.channelRow, { borderColor: palette.border }]}>
          <Pressable
            style={styles.channelInfo}
            accessibilityRole="button"
            onPress={() => navigation.navigate('Channel', { handle: video.channel.handle })}
          >
            <Avatar uri={mediaUrl(video.channel.avatarUrl)} name={video.channel.name} size={40} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[typography.label, { color: palette.text }]}>
                {video.channel.name}
              </Text>
              <Text style={[typography.caption, { color: palette.textMuted }]}>
                {formatCount(video.channel.subscriberCount)} subscribers
              </Text>
            </View>
          </Pressable>
          <Button
            label={video.viewerState?.subscribed ? 'Subscribed' : 'Subscribe'}
            variant={video.viewerState?.subscribed ? 'outline' : 'primary'}
            onPress={() => subscribe.mutate()}
            loading={subscribe.isPending}
          />
        </View>

        <View style={styles.actionRow}>
          <Action
            label={formatCount(video.likeCount)}
            hint="Like"
            active={video.viewerState?.liked}
            onPress={() => like.mutate(video.viewerState?.liked ? 0 : 1)}
          />
          <Action
            label={video.viewerState?.saved ? 'Saved' : 'Save'}
            hint="Save to library"
            active={video.viewerState?.saved}
            onPress={() => save.mutate()}
          />
          <Action
            label="Share"
            hint="Share this video"
            onPress={() => void Share.share({ message: `${video.title} — FaithTube` })}
          />
          <Action label="Report" hint="Report this video" onPress={() => navigation.navigate('Report', { targetType: 'VIDEO', targetId: video.id, label: video.title })} />
        </View>

        {video.description ? (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={[typography.body, { color: palette.text }]}>{video.description}</Text>
            {video.scriptureRefs.length ? (
              <View style={styles.refRow}>
                {video.scriptureRefs.map((ref) => (
                  <View key={ref} style={styles.refPill}>
                    <Text style={styles.refText}>{ref}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}

        {video.chapters.length ? (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={[typography.heading, { color: palette.text, marginBottom: spacing.sm }]}>Chapters</Text>
            {video.chapters.map((chapter) => (
              <Pressable
                key={chapter.startSeconds}
                accessibilityRole="button"
                accessibilityLabel={`Jump to ${chapter.title} at ${formatDuration(chapter.startSeconds)}`}
                onPress={() => void player.current?.setPositionAsync(chapter.startSeconds * 1000)}
                style={styles.chapterRow}
              >
                <Text style={styles.chapterTime}>{formatDuration(chapter.startSeconds)}</Text>
                <Text style={[typography.body, { color: palette.text, flex: 1 }]}>{chapter.title}</Text>
              </Pressable>
            ))}
          </Card>
        ) : null}

        {video.transcript?.length ? (
          <Card style={{ marginTop: spacing.md }}>
            <Pressable
              onPress={() => setShowTranscript((value) => !value)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showTranscript }}
              style={styles.transcriptToggle}
            >
              <Text style={[typography.heading, { color: palette.text }]}>Transcript</Text>
              <Text style={[typography.caption, { color: palette.textMuted }]}>{showTranscript ? 'Hide' : 'Show'}</Text>
            </Pressable>
            {showTranscript
              ? video.transcript.map((cue, index) => (
                  <Pressable
                    key={index}
                    onPress={() => void player.current?.setPositionAsync(cue.startSeconds * 1000)}
                    style={styles.cueRow}
                  >
                    {cue.endSeconds > 0 ? <Text style={styles.chapterTime}>{formatDuration(cue.startSeconds)}</Text> : null}
                    <Text style={[typography.body, { color: palette.text, flex: 1 }]}>{cue.text}</Text>
                  </Pressable>
                ))
              : null}
          </Card>
        ) : null}

        {related?.items.length ? (
          <View style={{ marginTop: spacing.xl }}>
            <Text style={[typography.title, { color: palette.text, marginBottom: spacing.md }]}>Related</Text>
            {related.items.slice(0, 8).map((item) => (
              <VideoCard
                key={item.id}
                video={item}
                compact
                onPress={(next) => navigation.push('Watch', { slug: next.slug, title: next.title })}
              />
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Action({ label, hint, onPress, active }: { label: string; hint: string; onPress: () => void; active?: boolean }) {
  const { palette } = useApp();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: palette.surface, borderColor: palette.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[typography.label, { color: active ? colors.goldDeep : palette.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  player: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  channelInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  action: {
    minHeight: typography.minTouchTarget,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  refRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  refPill: { backgroundColor: 'rgba(216,162,74,0.16)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  refText: { color: colors.goldDeep, fontSize: 11.5, fontWeight: '600' },
  chapterRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, minHeight: typography.minTouchTarget, alignItems: 'center' },
  chapterTime: { color: colors.goldDeep, fontSize: 12.5, fontWeight: '600', width: 52 },
  transcriptToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: typography.minTouchTarget },
  cueRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  ageGate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.navy },
  ageGateTitle: { color: colors.cream, fontSize: 18, fontWeight: '700' },
  ageGateBody: { color: 'rgba(251,247,239,0.75)', fontSize: 14, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  noSource: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,13,29,0.75)', padding: spacing.xl },
  noSourceText: { color: 'rgba(251,247,239,0.85)', fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
