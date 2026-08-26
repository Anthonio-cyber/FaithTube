import React, { useCallback } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { api, mediaUrl } from '@/lib/api';
import { formatCount } from '@/lib/format';
import { spacing, typography } from '@/theme';
import { Avatar, Badge, Button, EmptyState, Loading } from '@/components/ui';
import { VideoCard, type VideoSummary } from '@/components/VideoCard';
import type { StackScreenProps } from '@/navigation';

export function ChannelScreen({ route, navigation }: StackScreenProps<'Channel'>) {
  const { handle } = route.params;
  const { palette } = useApp();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['channel', handle],
    queryFn: () =>
      api<{
        channel: {
          id: string;
          name: string;
          handle: string;
          description: string;
          avatarUrl: string | null;
          subscriberCount: number;
          videoCount: number;
          verifiedChristianCreator: boolean;
        };
        subscribed: boolean;
      }>(`/channels/${handle}`),
  });

  const { data: videos } = useQuery({
    queryKey: ['channel-videos', handle],
    queryFn: () => api<{ items: VideoSummary[] }>(`/channels/${handle}/videos`),
  });

  const subscribe = useMutation({
    mutationFn: () => api(`/channels/${data!.channel.id}/subscribe`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['channel', handle] }),
  });

  const openVideo = useCallback(
    (video: VideoSummary) => navigation.push('Watch', { slug: video.slug, title: video.title }),
    [navigation],
  );

  if (isLoading) return <Loading />;
  if (!data) return <EmptyState title="Channel not found" body="It may have been removed or suspended." />;

  const { channel, subscribed } = data;

  return (
    <FlatList
      style={{ backgroundColor: palette.background }}
      data={videos?.items ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      ListHeaderComponent={
        <View style={{ padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar uri={mediaUrl(channel.avatarUrl)} name={channel.name} size={64} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.title, { color: palette.text }]}>{channel.name}</Text>
              <Text style={[typography.caption, { color: palette.textMuted, marginTop: 2 }]}>
                @{channel.handle} · {formatCount(channel.subscriberCount)} subscribers
              </Text>
              {channel.verifiedChristianCreator ? (
                <View style={{ alignSelf: 'flex-start', marginTop: 5 }}>
                  <Badge label="Verified Christian creator" tone="verified" />
                </View>
              ) : null}
            </View>
          </View>

          {channel.description ? (
            <Text style={[typography.body, { color: palette.textMuted, marginTop: spacing.md }]}>{channel.description}</Text>
          ) : null}

          <Button
            label={subscribed ? 'Subscribed' : 'Subscribe'}
            variant={subscribed ? 'outline' : 'primary'}
            onPress={() => subscribe.mutate()}
            loading={subscribe.isPending}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      }
      ListEmptyComponent={<EmptyState title="No videos yet" body="This channel has not published anything that has passed review." />}
      renderItem={({ item }) => <VideoCard video={item} onPress={openVideo} />}
    />
  );
}

export const channelStyles = StyleSheet.create({});
