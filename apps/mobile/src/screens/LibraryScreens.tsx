import React, { useCallback } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { api, mediaUrl } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { colors, radius, spacing, typography } from '@/theme';
import { VideoCard, type VideoSummary } from '@/components/VideoCard';
import { Avatar, Badge, Button, Card, EmptyState, Loading } from '@/components/ui';
import type { StackScreenProps, TabScreenProps } from '@/navigation';

export function SubscriptionsScreen({ navigation }: TabScreenProps<'ConnectTab'>) {
  const { palette, user } = useApp();

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions-feed'],
    queryFn: () =>
      api<{ items: VideoSummary[]; channels: Array<{ id: string; name: string; handle: string; avatarUrl: string | null }> }>(
        '/discover/subscriptions-feed',
      ),
    enabled: Boolean(user),
  });

  const openVideo = useCallback(
    (video: VideoSummary) => navigation.navigate('Watch', { slug: video.slug, title: video.title }),
    [navigation],
  );

  if (isLoading) return <Loading />;

  return (
    <FlatList
      style={{ backgroundColor: palette.background }}
      data={data?.items ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      ListHeaderComponent={
        data?.channels.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.channelStrip}
          >
            {data.channels.map((channel) => (
              <Pressable
                key={channel.id}
                onPress={() => navigation.navigate('Channel', { handle: channel.handle })}
                accessibilityRole="button"
                accessibilityLabel={channel.name}
                style={styles.channelChip}
              >
                <Avatar uri={mediaUrl(channel.avatarUrl)} name={channel.name} size={54} />
                <Text numberOfLines={2} style={[typography.caption, { color: palette.textMuted, textAlign: 'center', marginTop: 5 }]}>
                  {channel.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          title="You are not following anyone yet"
          body="Subscribe to a channel and its new videos will land here."
        />
      }
      renderItem={({ item }) => <VideoCard video={item} onPress={openVideo} />}
    />
  );
}

export function LibraryScreen({ navigation }: StackScreenProps<'Library'>) {
  const { palette, user } = useApp();

  const { data: continueWatching } = useQuery({
    queryKey: ['continue-watching'],
    queryFn: () => api<{ items: VideoSummary[] }>('/library/continue-watching'),
    enabled: Boolean(user),
  });

  const { data: saved } = useQuery({
    queryKey: ['saved'],
    queryFn: () => api<{ items: VideoSummary[] }>('/library/saved'),
    enabled: Boolean(user),
  });

  const openVideo = useCallback(
    (video: VideoSummary) => navigation.navigate('Watch', { slug: video.slug, title: video.title }),
    [navigation],
  );

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={{ paddingVertical: spacing.lg, paddingBottom: spacing.xxl }}>
      <Text style={[typography.title, { color: palette.text, paddingHorizontal: spacing.lg, marginBottom: spacing.md }]}>
        Continue watching
      </Text>
      {continueWatching?.items.length ? (
        continueWatching.items.map((video) => <VideoCard key={video.id} video={video} compact onPress={openVideo} />)
      ) : (
        <Text style={[typography.body, { color: palette.textMuted, paddingHorizontal: spacing.lg }]}>
          Videos you start but do not finish will wait for you here.
        </Text>
      )}

      <Text style={[typography.title, { color: palette.text, paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md }]}>
        Saved
      </Text>
      {saved?.items.length ? (
        saved.items.map((video) => <VideoCard key={video.id} video={video} compact onPress={openVideo} />)
      ) : (
        <Text style={[typography.body, { color: palette.textMuted, paddingHorizontal: spacing.lg }]}>
          Tap Save on any video to keep it here.
        </Text>
      )}
    </ScrollView>
  );
}

export function ProfileScreen(_props: TabScreenProps<'ProfileTab'>) {
  const { palette, user, signOut } = useApp();

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      api<{ items: Array<{ id: string; title: string; body: string; createdAt: string; read: boolean }>; unreadCount: number }>(
        '/notifications',
        { query: { limit: 15 } },
      ),
    enabled: Boolean(user),
  });

  const { data: plan } = useQuery({
    queryKey: ['premium-plan'],
    queryFn: () => api<{ plan: { displayPrice: string; interval: string; features: string[] }; checkoutAvailable: boolean }>('/premium/plan'),
  });

  if (!user) return <Loading />;

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar uri={mediaUrl(user.avatarUrl)} name={user.displayName} size={58} />
          <View style={{ flex: 1 }}>
            <Text style={[typography.title, { color: palette.text }]}>{user.displayName}</Text>
            <Text style={[typography.caption, { color: palette.textMuted }]}>@{user.username}</Text>
            {user.isPremium ? (
              <View style={{ alignSelf: 'flex-start', marginTop: 5 }}>
                <Badge label="Premium" tone="gold" />
              </View>
            ) : null}
          </View>
        </View>
      </Card>

      {!user.isPremium && plan ? (
        <Card style={{ backgroundColor: colors.navy }}>
          <Text style={{ color: colors.goldSoft, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>PREMIUM</Text>
          <Text style={{ color: colors.cream, fontSize: 19, fontWeight: '700', marginTop: 6 }}>
            {plan.plan.displayPrice}/{plan.plan.interval}
          </Text>
          <Text style={{ color: 'rgba(251,247,239,0.7)', fontSize: 13, marginTop: 6, lineHeight: 19 }}>
            Ad-free viewing, background playback and offline downloads on this device.
          </Text>
          {!plan.checkoutAvailable ? (
            <Text style={{ color: 'rgba(251,247,239,0.5)', fontSize: 12, marginTop: spacing.md, lineHeight: 17 }}>
              Card payments are not configured on this deployment yet.
            </Text>
          ) : (
            <Text style={{ color: 'rgba(251,247,239,0.5)', fontSize: 12, marginTop: spacing.md, lineHeight: 17 }}>
              Subscribe from the FaithTube website — checkout is handled there securely.
            </Text>
          )}
        </Card>
      ) : null}

      <Card>
        <Text style={[typography.heading, { color: palette.text, marginBottom: spacing.sm }]}>
          Notifications{notifications?.unreadCount ? ` (${notifications.unreadCount} unread)` : ''}
        </Text>
        {notifications?.items.length ? (
          notifications.items.slice(0, 8).map((notification) => (
            <View key={notification.id} style={[styles.notification, { borderColor: palette.border }]}>
              <Text style={[typography.label, { color: palette.text }]}>{notification.title}</Text>
              {notification.body ? (
                <Text numberOfLines={2} style={[typography.caption, { color: palette.textMuted, marginTop: 2 }]}>
                  {notification.body}
                </Text>
              ) : null}
              <Text style={[typography.caption, { color: palette.textMuted, marginTop: 3 }]}>{timeAgo(notification.createdAt)}</Text>
            </View>
          ))
        ) : (
          <Text style={[typography.body, { color: palette.textMuted }]}>Nothing new.</Text>
        )}
      </Card>

      <Card>
        <Text style={[typography.heading, { color: palette.text, marginBottom: spacing.sm }]}>How FaithTube works</Text>
        <Text style={[typography.body, { color: palette.textMuted }]}>
          Every video is reviewed before it can be watched, and a person always has the final say. Creators are never paid
          by subscriber count here — there is no monetisation threshold to reach.
        </Text>
      </Card>

      <Button label="Sign out" variant="outline" onPress={() => void signOut()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  channelStrip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.lg },
  channelChip: { width: 68, alignItems: 'center' },
  notification: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
