import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/theme';
import { VideoCard, type VideoSummary } from '@/components/VideoCard';
import { Card, EmptyState, Loading } from '@/components/ui';
import type { StackScreenProps, TabScreenProps } from '@/navigation';

export function DiscoverScreen({ navigation }: TabScreenProps<'DiscoverTab'>) {
  const { palette } = useApp();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ items: Array<{ slug: string; name: string; blurb: string; videoCount: number }> }>('/discover/categories'),
  });

  const { data: results, isFetching } = useQuery({
    queryKey: ['search', submitted],
    queryFn: () => api<{ videos: VideoSummary[]; scriptureReferences: string[] }>('/search', { query: { q: submitted } }),
    enabled: submitted.trim().length > 0,
  });

  const openVideo = useCallback(
    (video: VideoSummary) => navigation.navigate('Watch', { slug: video.slug, title: video.title }),
    [navigation],
  );

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={{ paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
      <View style={{ padding: spacing.lg }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => setSubmitted(query.trim())}
          returnKeyType="search"
          placeholder="Search sermons, Scripture, channels…"
          placeholderTextColor={palette.textMuted}
          accessibilityLabel="Search FaithTube"
          style={[styles.input, { backgroundColor: palette.surface, color: palette.text, borderColor: palette.border }]}
        />

        <Pressable
          onPress={() => navigation.navigate('Bible')}
          accessibilityRole="button"
          style={[styles.bibleCta, { borderColor: palette.border, backgroundColor: palette.surface }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[typography.heading, { color: palette.text }]}>Bible Search</Text>
            <Text style={[typography.caption, { color: palette.textMuted, marginTop: 2 }]}>
              Ask a question and get Scripture alongside teaching on it
            </Text>
          </View>
          <Text style={{ color: colors.goldDeep, fontSize: 20 }}>›</Text>
        </Pressable>
      </View>

      {submitted ? (
        <View>
          <Text style={[typography.title, { color: palette.text, paddingHorizontal: spacing.lg, marginBottom: spacing.md }]}>
            Results for “{submitted}”
          </Text>
          {isFetching ? (
            <Loading />
          ) : results?.videos.length ? (
            results.videos.map((video) => <VideoCard key={video.id} video={video} compact onPress={openVideo} />)
          ) : (
            <EmptyState title="Nothing matched" body="Try a different wording, or a passage like “Romans 8”." />
          )}
        </View>
      ) : (
        <View>
          <Text style={[typography.title, { color: palette.text, paddingHorizontal: spacing.lg, marginBottom: spacing.md }]}>
            Browse by category
          </Text>
          <FlatList
            scrollEnabled={false}
            data={categories?.items ?? []}
            keyExtractor={(item) => item.slug}
            numColumns={2}
            columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
            contentContainerStyle={{ gap: spacing.md }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => navigation.navigate('Category', { slug: item.slug, name: item.name })}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.videoCount} videos`}
                style={({ pressed }) => [styles.categoryCard, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.categoryName}>{item.name}</Text>
                <Text style={styles.categoryBlurb} numberOfLines={2}>
                  {item.blurb}
                </Text>
                <Text style={styles.categoryCount}>{item.videoCount} videos</Text>
              </Pressable>
            )}
          />
        </View>
      )}
    </ScrollView>
  );
}

export function CategoryScreen({ route, navigation }: StackScreenProps<'Category'>) {
  const { palette } = useApp();
  const { slug } = route.params;

  const { data, isLoading } = useQuery({
    queryKey: ['category', slug],
    queryFn: () => api<{ items: VideoSummary[] }>(`/discover/categories/${slug}`),
  });

  if (isLoading) return <Loading />;

  return (
    <FlatList
      style={{ backgroundColor: palette.background }}
      data={data?.items ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: spacing.xxl }}
      ListEmptyComponent={<EmptyState title="Nothing here yet" body="No approved videos in this category so far." />}
      renderItem={({ item }) => (
        <VideoCard video={item} onPress={(video) => navigation.navigate('Watch', { slug: video.slug, title: video.title })} />
      )}
    />
  );
}

export function BibleScreen({ navigation }: StackScreenProps<'Bible'>) {
  const { palette } = useApp();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data, isFetching } = useQuery({
    queryKey: ['bible', submitted],
    queryFn: () =>
      api<{
        scripture: { translation: { name: string }; verses: Array<{ reference: string; text: string }> };
        aiSummary: { text: string; disclaimer: string } | null;
        sermonsOnThesePassages: VideoSummary[];
      }>('/search/bible', { query: { q: submitted } }),
    enabled: submitted.trim().length > 1,
  });

  const examples = ['What does the Bible say about forgiveness?', 'Romans 8', 'Verses about anxiety', 'Psalm 23'];

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
      <TextInput
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => setSubmitted(query.trim())}
        returnKeyType="search"
        placeholder="What does the Bible say about…"
        placeholderTextColor={palette.textMuted}
        accessibilityLabel="Ask a question or name a passage"
        style={[styles.input, { backgroundColor: palette.surface, color: palette.text, borderColor: palette.border }]}
      />

      {!submitted ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          {examples.map((example) => (
            <Pressable
              key={example}
              onPress={() => {
                setQuery(example);
                setSubmitted(example);
              }}
              accessibilityRole="button"
              style={[styles.example, { backgroundColor: palette.surface, borderColor: palette.border }]}
            >
              <Text style={[typography.body, { color: palette.text }]}>{example}</Text>
            </Pressable>
          ))}
        </View>
      ) : isFetching ? (
        <Loading />
      ) : (
        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          {data?.scripture.verses.length ? (
            <>
              <View style={styles.scriptureHeader}>
                <Text style={[typography.heading, { color: palette.text }]}>Scripture</Text>
                <Text style={[typography.caption, { color: palette.textMuted }]}>{data.scripture.translation.name}</Text>
              </View>
              {data.scripture.verses.map((verse) => (
                <Card key={verse.reference}>
                  <Text style={styles.verseRef}>{verse.reference}</Text>
                  <Text style={[typography.body, { color: palette.text, marginTop: 6, fontSize: 16, lineHeight: 24 }]}>{verse.text}</Text>
                </Card>
              ))}
            </>
          ) : (
            <EmptyState title="No passage matched" body="Try naming a book and chapter, or a topic such as fear or prayer." />
          )}

          {/* Generated commentary is boxed and labelled so it can never be
              mistaken for Scripture. */}
          {data?.aiSummary ? (
            <View style={[styles.aiBox, { borderColor: 'rgba(58,42,92,0.35)' }]}>
              <Text style={styles.aiLabel}>AI-generated explanation — not Scripture</Text>
              <Text style={[typography.body, { color: palette.text, marginTop: 6 }]}>{data.aiSummary.text}</Text>
              <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.md }]}>{data.aiSummary.disclaimer}</Text>
            </View>
          ) : null}

          {data?.sermonsOnThesePassages.length ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.heading, { color: palette.text, marginBottom: spacing.sm }]}>Teaching on these passages</Text>
              {data.sermonsOnThesePassages.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  compact
                  onPress={(next) => navigation.navigate('Watch', { slug: next.slug, title: next.title })}
                />
              ))}
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: typography.minTouchTarget + 4,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
  },
  bibleCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  categoryCard: { flex: 1, backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.lg, minHeight: 110, justifyContent: 'space-between' },
  categoryName: { color: colors.cream, fontSize: 15, fontWeight: '700' },
  categoryBlurb: { color: 'rgba(251,247,239,0.6)', fontSize: 12, marginTop: 3, lineHeight: 16 },
  categoryCount: { color: colors.goldSoft, fontSize: 11, marginTop: spacing.sm, fontWeight: '600' },
  example: { padding: spacing.lg, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, minHeight: typography.minTouchTarget, justifyContent: 'center' },
  scriptureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  verseRef: { color: colors.goldDeep, fontSize: 13, fontWeight: '700' },
  aiBox: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.lg, padding: spacing.lg, backgroundColor: 'rgba(58,42,92,0.05)' },
  aiLabel: { color: colors.plum, fontSize: 12, fontWeight: '700' },
});
