import { prisma } from '../db/client.js';
import { parseJson } from '../lib/json.js';
import { PUBLISHED_VIDEO_WHERE, toVideoSummary, videoSummarySelect } from './serialize.js';
import type { VideoSummary } from '@faithtube/shared';

interface ScoredVideo {
  video: VideoSummary;
  score: number;
  reasons: string[];
}

const WEIGHTS = {
  subscribedChannel: 3.2,
  interestCategory: 2.0,
  watchedCategory: 1.6,
  likedChannel: 1.4,
  searchTopic: 1.2,
  freshness: 1.5,
  popularity: 1.0,
  completionAffinity: 1.1,
  shortFormPenalty: -0.6,
};

/**
 * Recommendation engine.
 *
 * Candidates are drawn only from PUBLISHED_VIDEO_WHERE, so a video that has not
 * passed moderation can never be recommended — that constraint is structural,
 * not a filter applied afterwards.
 */
export async function recommendForUser(
  userId: string | null,
  options: { limit?: number; excludeVideoIds?: string[]; includeShorts?: boolean } = {},
): Promise<VideoSummary[]> {
  const limit = options.limit ?? 24;
  const exclude = new Set(options.excludeVideoIds ?? []);

  if (!userId) return trendingVideos({ limit, includeShorts: options.includeShorts });

  const [user, subs, history, likes, searches] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { interests: true } }),
    prisma.subscription.findMany({ where: { userId }, select: { channelId: true } }),
    prisma.watchHistory.findMany({
      where: { userId },
      orderBy: { lastWatchedAt: 'desc' },
      take: 120,
      select: {
        videoId: true,
        completed: true,
        watchSeconds: true,
        video: { select: { categorySlug: true, channelId: true, durationSeconds: true, tags: true } },
      },
    }),
    prisma.videoLike.findMany({
      where: { userId, value: 1 },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: { videoId: true, video: { select: { channelId: true, categorySlug: true } } },
    }),
    prisma.searchQuery.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { query: true },
    }),
  ]);

  const interests = new Set(parseJson<string[]>(user?.interests ?? '[]', []));
  const subscribedChannels = new Set(subs.map((s) => s.channelId));
  const watchedVideoIds = new Set(history.map((h) => h.videoId));
  const likedChannels = new Set(likes.map((l) => l.video.channelId));

  // Category affinity weighted by how much of each video the viewer actually watched.
  const categoryAffinity = new Map<string, number>();
  for (const entry of history) {
    const duration = entry.video.durationSeconds || 1;
    const completion = Math.min(entry.watchSeconds / duration, 1);
    const weight = entry.completed ? 1 : Math.max(completion, 0.15);
    categoryAffinity.set(entry.video.categorySlug, (categoryAffinity.get(entry.video.categorySlug) ?? 0) + weight);
  }
  for (const like of likes) {
    categoryAffinity.set(like.video.categorySlug, (categoryAffinity.get(like.video.categorySlug) ?? 0) + 0.6);
  }
  const maxAffinity = Math.max(1, ...categoryAffinity.values());

  const searchTerms = searches
    .flatMap((s) => s.query.toLowerCase().split(/\s+/))
    .filter((term) => term.length > 3);

  const candidates = await prisma.video.findMany({
    where: {
      ...PUBLISHED_VIDEO_WHERE,
      isShort: options.includeShorts ? undefined : false,
      id: { notIn: [...watchedVideoIds, ...exclude].slice(0, 400) },
    },
    select: { ...videoSummarySelect, channelId: true, transcriptText: false } as never,
    orderBy: { publishedAt: 'desc' },
    take: 400,
  });

  const now = Date.now();
  const scored: ScoredVideo[] = candidates.map((row) => {
    const video = toVideoSummary(row as never);
    const channelId = (row as unknown as { channelId: string }).channelId;
    let score = 0;
    const reasons: string[] = [];

    if (subscribedChannels.has(channelId)) {
      score += WEIGHTS.subscribedChannel;
      reasons.push('From a channel you follow');
    }
    if (interests.has(video.categorySlug)) {
      score += WEIGHTS.interestCategory;
      reasons.push('Matches your interests');
    }
    const affinity = (categoryAffinity.get(video.categorySlug) ?? 0) / maxAffinity;
    if (affinity > 0) {
      score += affinity * WEIGHTS.watchedCategory;
      if (affinity > 0.5) reasons.push('Similar to what you watch');
    }
    if (likedChannels.has(channelId)) score += WEIGHTS.likedChannel;

    if (searchTerms.length) {
      const haystack = `${video.title} ${video.tags.join(' ')}`.toLowerCase();
      const matches = searchTerms.filter((term) => haystack.includes(term)).length;
      if (matches) {
        score += Math.min(matches, 3) * (WEIGHTS.searchTopic / 3);
        reasons.push('Related to your recent searches');
      }
    }

    // Freshness decays over two weeks; popularity uses a log so a single viral
    // video cannot dominate every feed.
    const ageDays = video.publishedAt ? (now - new Date(video.publishedAt).getTime()) / 86_400_000 : 999;
    score += WEIGHTS.freshness * Math.exp(-ageDays / 14);
    score += WEIGHTS.popularity * Math.log10(video.viewCount + 10) / 4;

    if (video.isShort) score += WEIGHTS.shortFormPenalty;

    return { video, score, reasons };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.video);
}

/**
 * Trending uses velocity — views and engagement relative to age — rather than
 * raw view count, so long-standing videos do not permanently occupy the rail.
 */
export async function trendingVideos(options: { limit?: number; categorySlug?: string; includeShorts?: boolean } = {}) {
  const limit = options.limit ?? 24;
  const since = new Date(Date.now() - 21 * 86_400_000);
  const rows = await prisma.video.findMany({
    where: {
      ...PUBLISHED_VIDEO_WHERE,
      publishedAt: { gte: since },
      categorySlug: options.categorySlug,
      isShort: options.includeShorts ? undefined : false,
    },
    select: videoSummarySelect,
    orderBy: { viewCount: 'desc' },
    take: 200,
  });

  const now = Date.now();
  return rows
    .map((row) => {
      const video = toVideoSummary(row);
      const ageHours = video.publishedAt ? Math.max(1, (now - new Date(video.publishedAt).getTime()) / 3_600_000) : 1e6;
      const engagement = video.viewCount + video.likeCount * 6;
      // Gravity exponent damps older items, the standard hot-ranking shape.
      const velocity = engagement / Math.pow(ageHours + 2, 1.35);
      return { video, velocity };
    })
    .sort((a, b) => b.velocity - a.velocity)
    .slice(0, limit)
    .map((entry) => entry.video);
}

/** Related videos on the watch page: same channel, category and tag overlap. */
export async function relatedVideos(videoId: string, limit = 12): Promise<VideoSummary[]> {
  const source = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, channelId: true, categorySlug: true, tags: true, scriptureRefs: true },
  });
  if (!source) return [];

  const tags = new Set(parseJson<string[]>(source.tags, []).map((t) => t.toLowerCase()));
  const refs = new Set(parseJson<string[]>(source.scriptureRefs, []));

  const rows = await prisma.video.findMany({
    where: {
      ...PUBLISHED_VIDEO_WHERE,
      id: { not: source.id },
      OR: [{ channelId: source.channelId }, { categorySlug: source.categorySlug }],
    },
    select: { ...videoSummarySelect, channelId: true, tags: true, scriptureRefs: true } as never,
    orderBy: { publishedAt: 'desc' },
    take: 150,
  });

  return rows
    .map((row) => {
      const video = toVideoSummary(row as never);
      const raw = row as unknown as { channelId: string; scriptureRefs: string };
      let score = 0;
      if (raw.channelId === source.channelId) score += 3;
      if (video.categorySlug === source.categorySlug) score += 2;
      score += video.tags.filter((t) => tags.has(t.toLowerCase())).length * 1.2;
      score += parseJson<string[]>(raw.scriptureRefs, []).filter((r) => refs.has(r)).length * 1.6;
      score += Math.log10(video.viewCount + 10) / 3;
      return { video, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.video);
}
