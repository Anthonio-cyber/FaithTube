import { CATEGORIES, extractScriptureReferences, formatReference, type VideoSummary } from '@faithtube/shared';
import { prisma } from '../db/client.js';
import { PUBLISHED_VIDEO_WHERE, toChannelSummary, toVideoSummary, videoSummarySelect } from './serialize.js';
import { normalize } from '../ai/textAnalysis.js';

export interface SearchResults {
  videos: VideoSummary[];
  channels: ReturnType<typeof toChannelSummary>[];
  playlists: Array<{ id: string; title: string; itemCount: number; ownerName: string }>;
  scriptureReferences: string[];
  matchedCategories: string[];
  interpretedAs: string;
}

export interface SearchOptions {
  categorySlug?: string;
  sort?: 'relevance' | 'newest' | 'views' | 'duration';
  duration?: 'short' | 'medium' | 'long';
  uploadedWithin?: 'day' | 'week' | 'month' | 'year';
  limit?: number;
}

/**
 * Search across videos, channels and playlists.
 *
 * Ranking is computed in application code over a candidate set rather than in
 * SQL, because the useful signals here (scripture reference overlap, title vs
 * transcript position, channel authority) do not express well in a portable
 * LIKE query — and this keeps the same behaviour on SQLite and Postgres.
 */
export async function search(rawQuery: string, options: SearchOptions = {}): Promise<SearchResults> {
  const query = rawQuery.trim();
  const limit = options.limit ?? 30;
  if (!query) {
    return { videos: [], channels: [], playlists: [], scriptureReferences: [], matchedCategories: [], interpretedAs: '' };
  }

  const terms = normalize(query)
    .replace(/[^a-z0-9\s'#]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
  const hashtags = terms.filter((t) => t.startsWith('#')).map((t) => t.slice(1));
  const words = terms.filter((t) => !t.startsWith('#'));

  const refs = extractScriptureReferences(query).map(formatReference);
  const matchedCategories = CATEGORIES.filter(
    (category) =>
      words.some((word) => category.name.toLowerCase().includes(word) || category.slug.includes(word)) ||
      category.keywords.some((keyword) => words.some((word) => keyword.includes(word))),
  ).map((c) => c.slug);

  const since = uploadedSince(options.uploadedWithin);
  const durationFilter = durationRange(options.duration);

  const candidates = await prisma.video.findMany({
    where: {
      ...PUBLISHED_VIDEO_WHERE,
      categorySlug: options.categorySlug,
      publishedAt: since ? { gte: since } : undefined,
      durationSeconds: durationFilter,
      OR: [
        ...words.map((word) => ({ title: { contains: word } })),
        ...words.map((word) => ({ description: { contains: word } })),
        ...words.map((word) => ({ tags: { contains: word } })),
        ...words.map((word) => ({ transcriptText: { contains: word } })),
        ...refs.map((ref) => ({ scriptureRefs: { contains: ref } })),
        ...hashtags.map((tag) => ({ tags: { contains: tag } })),
        ...(matchedCategories.length ? [{ categorySlug: { in: matchedCategories } }] : []),
        { channel: { name: { contains: query } } },
      ],
    },
    select: { ...videoSummarySelect, transcriptText: true, scriptureRefs: true } as never,
    take: 300,
  });

  const scored = (candidates as never[]).map((row) => {
    const raw = row as unknown as { transcriptText: string | null; scriptureRefs: string };
    const video = toVideoSummary(row as never);
    const title = normalize(video.title);
    const description = normalize(video.description);
    const tags = video.tags.map(normalize);
    const transcript = normalize(raw.transcriptText ?? '').slice(0, 60_000);

    let score = 0;
    for (const word of words) {
      if (title.includes(word)) score += title.startsWith(word) ? 6 : 4;
      if (tags.some((tag) => tag === word)) score += 3.5;
      else if (tags.some((tag) => tag.includes(word))) score += 2;
      if (description.includes(word)) score += 1.2;
      if (transcript.includes(word)) score += 0.8;
      if (normalize(video.channel.name).includes(word)) score += 2.5;
    }
    for (const tag of hashtags) if (tags.some((t) => t.includes(tag))) score += 3;
    for (const ref of refs) if (raw.scriptureRefs.includes(ref)) score += 7;
    if (matchedCategories.includes(video.categorySlug)) score += 2;

    // Light authority and freshness signals so equally-matching results order sensibly.
    score += Math.log10(video.viewCount + 10) / 2;
    score += Math.log10(video.channel.subscriberCount + 10) / 4;
    if (video.channel.verifiedChristianCreator) score += 0.8;

    return { video, score };
  });

  const sorted = sortResults(scored, options.sort ?? 'relevance');

  const [channels, playlists] = await Promise.all([
    prisma.channel.findMany({
      where: {
        suspended: false,
        OR: [{ name: { contains: query } }, { handle: { contains: normalize(query).replace(/\s/g, '') } }, { description: { contains: query } }],
      },
      orderBy: { subscriberCount: 'desc' },
      take: 8,
    }),
    prisma.playlist.findMany({
      where: { visibility: 'PUBLIC', title: { contains: query } },
      include: { owner: { select: { displayName: true } } },
      orderBy: { itemCount: 'desc' },
      take: 8,
    }),
  ]);

  return {
    videos: sorted.slice(0, limit),
    channels: channels.map(toChannelSummary),
    playlists: playlists.map((p) => ({
      id: p.id,
      title: p.title,
      itemCount: p.itemCount,
      ownerName: p.owner.displayName,
    })),
    scriptureReferences: refs,
    matchedCategories,
    interpretedAs: describeQuery(query, refs, matchedCategories),
  };
}

function sortResults(scored: Array<{ video: VideoSummary; score: number }>, sort: string): VideoSummary[] {
  const list = [...scored];
  switch (sort) {
    case 'newest':
      list.sort((a, b) => (b.video.publishedAt ?? '').localeCompare(a.video.publishedAt ?? ''));
      break;
    case 'views':
      list.sort((a, b) => b.video.viewCount - a.video.viewCount);
      break;
    case 'duration':
      list.sort((a, b) => b.video.durationSeconds - a.video.durationSeconds);
      break;
    default:
      list.sort((a, b) => b.score - a.score);
  }
  return list.map((entry) => entry.video);
}

function uploadedSince(window?: string): Date | undefined {
  const days = { day: 1, week: 7, month: 30, year: 365 }[window ?? ''] as number | undefined;
  return days ? new Date(Date.now() - days * 86_400_000) : undefined;
}

function durationRange(duration?: string) {
  if (duration === 'short') return { lte: 240 };
  if (duration === 'medium') return { gt: 240, lte: 1200 };
  if (duration === 'long') return { gt: 1200 };
  return undefined;
}

function describeQuery(query: string, refs: string[], categories: string[]): string {
  const parts: string[] = [];
  if (refs.length) parts.push(`Scripture: ${refs.join(', ')}`);
  if (categories.length) parts.push(`Category: ${categories.join(', ')}`);
  return parts.length ? `${query} — ${parts.join(' · ')}` : query;
}

/** Type-ahead suggestions drawn from real titles, tags, channels and topics. */
export async function suggest(prefix: string, limit = 8): Promise<string[]> {
  const term = normalize(prefix);
  if (term.length < 2) return [];

  const [videos, channels] = await Promise.all([
    prisma.video.findMany({
      where: { ...PUBLISHED_VIDEO_WHERE, title: { contains: term } },
      select: { title: true },
      orderBy: { viewCount: 'desc' },
      take: limit,
    }),
    prisma.channel.findMany({
      where: { suspended: false, name: { contains: term } },
      select: { name: true },
      orderBy: { subscriberCount: 'desc' },
      take: 4,
    }),
  ]);

  const categoryMatches = CATEGORIES.filter((c) => c.name.toLowerCase().includes(term)).map((c) => c.name);
  return [...new Set([...videos.map((v) => v.title), ...channels.map((c) => c.name), ...categoryMatches])].slice(0, limit);
}
