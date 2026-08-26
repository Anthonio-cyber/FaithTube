import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import { colors, spacing, typography } from '@/theme';
import { VideoCard, type VideoSummary } from '@/components/VideoCard';
import { EmptyState, Loading, SectionTitle } from '@/components/ui';
import type { TabScreenProps } from '@/navigation';

interface HomeResponse {
  hero: { video: VideoSummary; title: string | null } | null;
  continueWatching: VideoSummary[];
  recommended: VideoSummary[];
  trending: VideoSummary[];
  recent: VideoSummary[];
  rails: Array<{ category: { slug: string; name: string; blurb: string }; items: VideoSummary[] }>;
}

export function HomeScreen({ navigation }: TabScreenProps<'HomeTab'>) {
  const { palette, user } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['home', user?.id ?? 'anon'],
    queryFn: () => api<HomeResponse>('/discover/home'),
  });

  const openVideo = useCallback(
    (video: VideoSummary) => navigation.navigate('Watch', { slug: video.slug, title: video.title }),
    [navigation],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (isLoading) return <Loading label="Loading your home page" />;

  const hasContent = Boolean(data?.hero || data?.recommended.length);
  if (!hasContent) {
    return (
      <EmptyState
        title="Nothing published yet"
        body="Once creators upload and their videos pass review, they will appear here."
      />
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      {data?.hero ? (
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>{data.hero.title ?? 'FEATURED'}</Text>
          <VideoCard video={data.hero.video} onPress={openVideo} />
        </View>
      ) : null}

      {user && data?.continueWatching.length ? (
        <Rail title="Continue Watching" subtitle="Pick up where you left off" items={data.continueWatching} onPress={openVideo} />
      ) : null}

      <Rail
        title={user ? 'Recommended For You' : 'Start Here'}
        subtitle={user ? 'Shaped by what you watch and follow' : 'Teaching, worship and testimony'}
        items={data?.recommended ?? []}
        onPress={openVideo}
      />

      <Rail title="Christian Trending" subtitle="What the community is watching" items={data?.trending ?? []} onPress={openVideo} />

      {data?.rails.map((rail) => (
        <Rail key={rail.category.slug} title={rail.category.name} subtitle={rail.category.blurb} items={rail.items} onPress={openVideo} />
      ))}

      <Rail title="Recently Uploaded" subtitle="The newest approved videos" items={data?.recent ?? []} onPress={openVideo} />

      <View style={[styles.footer, { borderTopColor: palette.border }]}>
        <Text style={[typography.caption, { color: palette.textMuted, textAlign: 'center' }]}>
          Every video on FaithTube passes a Christ-centred review before anyone can watch it.
        </Text>
      </View>
    </ScrollView>
  );
}

/** Horizontal rail. FlatList keeps long rails virtualised on low-end devices. */
function Rail({
  title,
  subtitle,
  items,
  onPress,
}: {
  title: string;
  subtitle?: string;
  items: VideoSummary[];
  onPress: (video: VideoSummary) => void;
}) {
  if (!items.length) return null;
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <SectionTitle title={title} subtitle={subtitle} />
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        snapToInterval={280 + spacing.md}
        decelerationRate="fast"
        renderItem={({ item }) => (
          <View style={{ width: 280 }}>
            <VideoCard video={item} onPress={onPress} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: spacing.md, marginBottom: spacing.lg },
  heroEyebrow: {
    color: colors.goldDeep,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  footer: { marginTop: spacing.lg, paddingTop: spacing.lg, paddingHorizontal: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth },
});
