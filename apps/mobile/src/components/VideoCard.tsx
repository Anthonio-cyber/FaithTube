import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { mediaUrl } from '@/lib/api';
import { formatCount, timeAgo } from '@/lib/format';
import { radius, spacing, typography } from '@/theme';
import { Avatar, DurationPill, PlaceholderArt, VerifiedBadge } from './ui';

export interface VideoSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  publishedAt: string | null;
  categorySlug: string;
  isShort: boolean;
  isLive: boolean;
  premiumOnly: boolean;
  ageRestricted: boolean;
  christianContentVerified: boolean;
  channel: {
    id: string;
    handle: string;
    name: string;
    avatarUrl: string | null;
    subscriberCount: number;
    verifiedChristianCreator: boolean;
  };
  progressSeconds?: number;
  percentComplete?: number;
}

export function VideoCard({
  video,
  onPress,
  compact,
}: {
  video: VideoSummary;
  onPress: (video: VideoSummary) => void;
  compact?: boolean;
}) {
  const { palette } = useApp();
  const meta = `${formatCount(video.viewCount)} views · ${timeAgo(video.publishedAt)}`;
  const thumb = mediaUrl(video.thumbnailUrl);

  if (compact) {
    return (
      <Pressable
        onPress={() => onPress(video)}
        accessibilityRole="button"
        accessibilityLabel={`${video.title}, ${meta}`}
        style={({ pressed }) => [styles.compactRow, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.compactThumb}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <PlaceholderArt title={video.title} categorySlug={video.categorySlug} style={StyleSheet.absoluteFill} />
          )}
          <DurationPill seconds={video.durationSeconds} />
        </View>
        <View style={styles.compactBody}>
          <Text numberOfLines={2} style={[typography.label, { color: palette.text, lineHeight: 18 }]}>
            {video.title}
          </Text>
          <Text numberOfLines={1} style={[typography.caption, { color: palette.textMuted, marginTop: 3 }]}>
            {video.channel.name}
          </Text>
          <Text numberOfLines={1} style={[typography.caption, { color: palette.textMuted }]}>
            {meta}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(video)}
      accessibilityRole="button"
      accessibilityLabel={`${video.title} by ${video.channel.name}, ${meta}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.thumb}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <PlaceholderArt title={video.title} categorySlug={video.categorySlug} style={StyleSheet.absoluteFill} />
        )}

        {video.isLive ? (
          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        ) : (
          <DurationPill seconds={video.durationSeconds} />
        )}

        {video.ageRestricted ? (
          <View style={styles.ageTag}>
            <Text style={styles.ageText}>18+</Text>
          </View>
        ) : null}

        {/* Resume position, so Continue Watching reads at a glance. */}
        {video.percentComplete ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${video.percentComplete}%` }]} />
          </View>
        ) : null}
      </View>

      <View style={styles.cardBody}>
        <Avatar uri={mediaUrl(video.channel.avatarUrl)} name={video.channel.name} size={34} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[typography.heading, { color: palette.text, lineHeight: 20 }]}>
            {video.title}
          </Text>
          <Text numberOfLines={1} style={[typography.caption, { color: palette.textMuted, marginTop: 3 }]}>
            {video.channel.name} · {meta}
          </Text>
          <View style={{ marginTop: 5 }}>
            <VerifiedBadge verified={video.christianContentVerified} compact />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.xl },
  thumb: {
    aspectRatio: 16 / 9,
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#152444',
  },
  cardBody: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  compactRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  compactThumb: {
    width: 140,
    aspectRatio: 16 / 9,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: '#152444',
  },
  compactBody: { flex: 1, justifyContent: 'center' },
  liveTag: {
    position: 'absolute',
    left: 6,
    top: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#B4453C',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  ageTag: {
    position: 'absolute',
    left: 6,
    top: 6,
    backgroundColor: 'rgba(200,121,47,0.92)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ageText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(6,13,29,0.5)' },
  progressFill: { height: 3, backgroundColor: '#D8A24A' },
});
