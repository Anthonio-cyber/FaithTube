import { prisma } from '../db/client.js';
import { PUBLISHED_VIDEO_WHERE } from './serialize.js';

const DAY_MS = 86_400_000;

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function emptySeries(days: number): Map<string, number> {
  const series = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    series.set(dayKey(new Date(Date.now() - i * DAY_MS)), 0);
  }
  return series;
}

function toPoints(series: Map<string, number>): TimeSeriesPoint[] {
  return [...series.entries()].map(([date, value]) => ({ date, value }));
}

/**
 * Creator analytics.
 *
 * Every number here is computed from stored events. Note what is deliberately
 * absent: there is no earnings figure and no subscriber-count payout, because
 * the platform does not pay creators by audience size.
 */
export async function channelAnalytics(channelId: string, days = 28) {
  const since = new Date(Date.now() - days * DAY_MS);

  const [channel, videos, history, likes, comments, subs, topVideos] = await Promise.all([
    prisma.channel.findUniqueOrThrow({ where: { id: channelId } }),
    prisma.video.findMany({
      where: { channelId, removedAt: null },
      select: {
        id: true, title: true, slug: true, status: true, viewCount: true, likeCount: true,
        commentCount: true, totalWatchSeconds: true, durationSeconds: true, publishedAt: true,
        thumbnailUrl: true, christianContentVerified: true,
      },
    }),
    prisma.watchHistory.findMany({
      where: { video: { channelId }, lastWatchedAt: { gte: since } },
      select: { lastWatchedAt: true, watchSeconds: true, completed: true, videoId: true },
    }),
    prisma.videoLike.findMany({
      where: { video: { channelId }, createdAt: { gte: since }, value: 1 },
      select: { createdAt: true },
    }),
    prisma.comment.findMany({
      where: { video: { channelId }, createdAt: { gte: since }, status: 'VISIBLE' },
      select: { createdAt: true },
    }),
    prisma.subscription.findMany({
      where: { channelId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.video.findMany({
      where: { channelId, ...PUBLISHED_VIDEO_WHERE },
      orderBy: { viewCount: 'desc' },
      take: 10,
      select: { id: true, slug: true, title: true, viewCount: true, likeCount: true, totalWatchSeconds: true, thumbnailUrl: true },
    }),
  ]);

  const viewSeries = emptySeries(days);
  const watchSeries = emptySeries(days);
  for (const entry of history) {
    const key = dayKey(entry.lastWatchedAt);
    if (viewSeries.has(key)) {
      viewSeries.set(key, (viewSeries.get(key) ?? 0) + 1);
      watchSeries.set(key, (watchSeries.get(key) ?? 0) + Math.round(entry.watchSeconds / 60));
    }
  }

  const likeSeries = emptySeries(days);
  for (const like of likes) {
    const key = dayKey(like.createdAt);
    if (likeSeries.has(key)) likeSeries.set(key, (likeSeries.get(key) ?? 0) + 1);
  }

  const subSeries = emptySeries(days);
  for (const sub of subs) {
    const key = dayKey(sub.createdAt);
    if (subSeries.has(key)) subSeries.set(key, (subSeries.get(key) ?? 0) + 1);
  }

  const commentSeries = emptySeries(days);
  for (const comment of comments) {
    const key = dayKey(comment.createdAt);
    if (commentSeries.has(key)) commentSeries.set(key, (commentSeries.get(key) ?? 0) + 1);
  }

  const totalWatchSeconds = videos.reduce((sum, v) => sum + v.totalWatchSeconds, 0);
  const publishedVideos = videos.filter((v) => v.status === 'PUBLISHED');
  const avgDuration = publishedVideos.length
    ? publishedVideos.reduce((sum, v) => sum + v.durationSeconds, 0) / publishedVideos.length
    : 0;
  const completions = history.filter((h) => h.completed).length;

  return {
    channel: {
      id: channel.id,
      name: channel.name,
      subscriberCount: channel.subscriberCount,
      videoCount: publishedVideos.length,
      totalViews: videos.reduce((sum, v) => sum + v.viewCount, 0),
    },
    windowDays: days,
    totals: {
      views: videos.reduce((sum, v) => sum + v.viewCount, 0),
      watchHours: Math.round(totalWatchSeconds / 3600),
      likes: videos.reduce((sum, v) => sum + v.likeCount, 0),
      comments: videos.reduce((sum, v) => sum + v.commentCount, 0),
      newSubscribers: subs.length,
      // Share of sessions in the window that reached the end of the video.
      completionRate: history.length ? Math.round((completions / history.length) * 100) : 0,
      averageVideoLengthSeconds: Math.round(avgDuration),
      pendingReview: videos.filter((v) => v.status === 'AWAITING_REVIEW').length,
      rejected: videos.filter((v) => v.status === 'REJECTED').length,
    },
    series: {
      views: toPoints(viewSeries),
      watchMinutes: toPoints(watchSeries),
      likes: toPoints(likeSeries),
      subscribers: toPoints(subSeries),
      comments: toPoints(commentSeries),
    },
    topVideos: topVideos.map((video) => ({
      ...video,
      watchHours: Math.round(video.totalWatchSeconds / 3600),
    })),
    /** Where views came from. Derived from stored referrer buckets on watch events. */
    trafficSources: await trafficSources(channelId, since),
    audienceRetention: await retentionCurve(channelId),
  };
}

async function trafficSources(channelId: string, since: Date) {
  const [subscribed, searched, total] = await Promise.all([
    prisma.watchHistory.count({
      where: {
        video: { channelId },
        lastWatchedAt: { gte: since },
        user: { subscriptions: { some: { channelId } } },
      },
    }),
    prisma.watchHistory.count({
      where: {
        video: { channelId },
        lastWatchedAt: { gte: since },
        user: { searchQueries: { some: { createdAt: { gte: since } } } },
      },
    }),
    prisma.watchHistory.count({ where: { video: { channelId }, lastWatchedAt: { gte: since } } }),
  ]);

  const other = Math.max(0, total - subscribed - Math.max(0, searched - subscribed));
  return [
    { source: 'Subscriptions', views: subscribed },
    { source: 'Search', views: Math.max(0, searched - subscribed) },
    { source: 'Discover & recommendations', views: other },
  ];
}

/** Average completion by decile across the channel's videos. */
async function retentionCurve(channelId: string) {
  const rows = await prisma.watchHistory.findMany({
    where: { video: { channelId } },
    select: { progressSeconds: true, video: { select: { durationSeconds: true } } },
    take: 2000,
  });
  const buckets = new Array(10).fill(0);
  let counted = 0;
  for (const row of rows) {
    const duration = row.video.durationSeconds;
    if (!duration) continue;
    counted += 1;
    const reached = Math.min(9, Math.floor((row.progressSeconds / duration) * 10));
    for (let i = 0; i <= reached; i += 1) buckets[i] += 1;
  }
  return buckets.map((count, index) => ({
    percent: index * 10,
    retention: counted ? Math.round((count / counted) * 100) : 0,
  }));
}

/** Platform-wide analytics for the admin dashboard. */
export async function platformAnalytics(days = 30) {
  const since = new Date(Date.now() - days * DAY_MS);
  const activeSince = new Date(Date.now() - 7 * DAY_MS);

  const [
    totalUsers, activeUsers, newUsers, totalChannels, totalVideos, publishedVideos,
    approvedVideos, rejectedVideos, awaitingReview, openReports, pendingAppeals,
    premiumSubs, watchAgg, uploadsInWindow, moderationBreakdown, signupSeriesRows,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, lastSeenAt: { gte: activeSince } } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.channel.count(),
    prisma.video.count(),
    prisma.video.count({ where: PUBLISHED_VIDEO_WHERE }),
    prisma.video.count({ where: { christianContentVerified: true } }),
    prisma.video.count({ where: { status: 'REJECTED' } }),
    prisma.video.count({ where: { status: 'AWAITING_REVIEW' } }),
    prisma.report.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }),
    prisma.appeal.count({ where: { status: 'PENDING' } }),
    prisma.premiumSubscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING', 'COMPLIMENTARY'] } } }),
    prisma.video.aggregate({ _sum: { totalWatchSeconds: true, viewCount: true } }),
    prisma.video.count({ where: { createdAt: { gte: since } } }),
    prisma.videoModerationResult.groupBy({ by: ['decision'], _count: { _all: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
  ]);

  const signupSeries = emptySeries(days);
  for (const row of signupSeriesRows) {
    const key = dayKey(row.createdAt);
    if (signupSeries.has(key)) signupSeries.set(key, (signupSeries.get(key) ?? 0) + 1);
  }

  const uploadRows = await prisma.video.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  });
  const uploadSeries = emptySeries(days);
  for (const row of uploadRows) {
    const key = dayKey(row.createdAt);
    if (uploadSeries.has(key)) uploadSeries.set(key, (uploadSeries.get(key) ?? 0) + 1);
  }

  const plan = await (await import('./stripe.service.js')).currentPlan();

  return {
    windowDays: days,
    users: { total: totalUsers, activeLast7Days: activeUsers, newInWindow: newUsers },
    channels: { total: totalChannels },
    videos: {
      total: totalVideos,
      published: publishedVideos,
      approved: approvedVideos,
      rejected: rejectedVideos,
      awaitingReview,
      uploadedInWindow: uploadsInWindow,
    },
    moderation: {
      byDecision: Object.fromEntries(moderationBreakdown.map((row) => [row.decision, row._count._all])),
      openReports,
      pendingAppeals,
      // Share of automated decisions that a human never had to touch.
      autoResolutionRate: (() => {
        const counts = Object.fromEntries(moderationBreakdown.map((r) => [r.decision, r._count._all]));
        const total = Object.values(counts).reduce((a: number, b) => a + (b as number), 0) as number;
        const human = (counts.HUMAN_REVIEW as number) ?? 0;
        return total ? Math.round(((total - human) / total) * 100) : 0;
      })(),
    },
    premium: {
      subscribers: premiumSubs,
      plan,
      // Recognised recurring revenue at the current plan price.
      monthlyRecurringMinor: premiumSubs * plan.amountMinor,
    },
    engagement: {
      totalViews: watchAgg._sum.viewCount ?? 0,
      totalWatchHours: Math.round((watchAgg._sum.totalWatchSeconds ?? 0) / 3600),
    },
    series: { signups: toPoints(signupSeries), uploads: toPoints(uploadSeries) },
  };
}
