import React, { useCallback, useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View, type ViewToken } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { api, mediaUrl } from '@/lib/api';
import { formatCount } from '@/lib/format';
import { colors, spacing, typography } from '@/theme';
import { Avatar, EmptyState, Loading, PlaceholderArt } from '@/components/ui';
import type { VideoSummary } from '@/components/VideoCard';
import type { StackScreenProps } from '@/navigation';

type Clip = VideoSummary & { sources: Array<{ url: string; height: number }> };

/**
 * Faith Clips — the vertical feed.
 *
 * Only the visible clip plays. `viewabilityConfig` decides which that is, and
 * every other player is unmounted, which keeps memory flat on long scrolls.
 */
export function ClipsScreen({ navigation }: StackScreenProps<'Clips'>) {
  const { palette } = useApp();
  const [activeIndex, setActiveIndex] = useState(0);
  const [height, setHeight] = useState(Dimensions.get('window').height);

  const { data, isLoading } = useQuery({
    queryKey: ['clips'],
    queryFn: () => api<{ items: Clip[] }>('/discover/clips', { query: { limit: 15 } }),
  });

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setActiveIndex(first.index);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  const renderClip = useCallback(
    ({ item, index }: { item: Clip; index: number }) => {
      const source = item.sources?.[0];
      const isActive = index === activeIndex;

      return (
        <View style={[styles.page, { height }]}>
          {source && Math.abs(index - activeIndex) <= 1 ? (
            <Video
              source={{ uri: mediaUrl(source.url)! }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.CONTAIN}
              isLooping
              shouldPlay={isActive}
              isMuted={!isActive}
              useNativeControls={false}
            />
          ) : (
            <PlaceholderArt title={item.title} categorySlug={item.categorySlug} style={StyleSheet.absoluteFill} />
          )}

          <View style={styles.overlay} pointerEvents="box-none">
            <Pressable
              onPress={() => navigation.navigate('Channel', { handle: item.channel.handle })}
              accessibilityRole="button"
              style={styles.clipChannel}
            >
              <Avatar uri={mediaUrl(item.channel.avatarUrl)} name={item.channel.name} size={30} />
              <Text style={styles.clipChannelName}>{item.channel.name}</Text>
            </Pressable>
            <Text numberOfLines={2} style={styles.clipTitle}>
              {item.title}
            </Text>
            <Text style={styles.clipMeta}>
              {formatCount(item.viewCount)} views · {formatCount(item.likeCount)} likes
            </Text>
          </View>
        </View>
      );
    },
    [activeIndex, height, navigation],
  );

  if (isLoading) return <Loading />;

  if (!data?.items.length) {
    return (
      <EmptyState
        title="No Faith Clips yet"
        body="Short vertical videos appear here once creators upload them and they pass review."
      />
    );
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.navyDeep }}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
    >
      <FlatList
        data={data.items}
        keyExtractor={(item) => item.id}
        renderItem={renderClip}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        // Keeping the window tight matters here: video players are expensive.
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', backgroundColor: colors.navyDeep, justifyContent: 'flex-end' },
  overlay: { padding: spacing.lg, paddingBottom: spacing.xxl, backgroundColor: 'rgba(6,13,29,0.55)' },
  clipChannel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  clipChannelName: { color: colors.cream, fontSize: 14, fontWeight: '600' },
  clipTitle: { color: colors.cream, fontSize: 15, marginTop: spacing.sm, lineHeight: 21 },
  clipMeta: { color: 'rgba(251,247,239,0.6)', fontSize: 12, marginTop: 4 },
});
