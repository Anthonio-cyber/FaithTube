import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { handler } from '../lib/async.js';
import { attachAuth } from '../middleware/auth.js';
import { searchLimiter } from '../middleware/rateLimit.js';
import { validateQuery, query } from '../middleware/validate.js';
import { search, suggest } from '../services/search.service.js';
import { searchBible, topicSuggestions } from '../services/bible.service.js';
import { PUBLISHED_VIDEO_WHERE, toVideoSummary, videoSummarySelect } from '../services/serialize.js';

export const searchRouter = Router();

const searchQuery = z.object({
  q: z.string().min(1).max(200),
  categorySlug: z.string().optional(),
  sort: z.enum(['relevance', 'newest', 'views', 'duration']).default('relevance'),
  duration: z.enum(['short', 'medium', 'long']).optional(),
  uploadedWithin: z.enum(['day', 'week', 'month', 'year']).optional(),
  limit: z.coerce.number().min(1).max(50).default(30),
});

searchRouter.get(
  '/',
  attachAuth,
  searchLimiter,
  validateQuery(searchQuery),
  handler(async (req, res) => {
    const params = query<z.infer<typeof searchQuery>>(req);
    const results = await search(params.q, params);

    // Search history feeds recommendations; it is only stored for signed-in users.
    if (req.auth) {
      await prisma.searchQuery.create({
        data: { userId: req.auth.userId, query: params.q.slice(0, 200), resultCount: results.videos.length },
      });
    }

    res.json(results);
  }),
);

searchRouter.get(
  '/suggest',
  searchLimiter,
  validateQuery(z.object({ q: z.string().min(1).max(100) })),
  handler(async (req, res) => {
    const params = query<{ q: string }>(req);
    res.json({ items: await suggest(params.q) });
  }),
);

/**
 * Bible Search.
 *
 * Returns Scripture, matching videos and — when an AI service is configured —
 * an explanation that the response keeps in its own `aiSummary` field with a
 * disclaimer, so the UI can never present generated text as Scripture.
 */
searchRouter.get(
  '/bible',
  attachAuth,
  searchLimiter,
  validateQuery(z.object({ q: z.string().min(2).max(300), summarise: z.coerce.boolean().default(true) })),
  handler(async (req, res) => {
    const params = query<{ q: string; summarise: boolean }>(req);

    const [scripture, videoResults] = await Promise.all([
      searchBible(params.q, { includeSummary: params.summarise }),
      search(params.q, { limit: 12 }),
    ]);

    // Videos that cite one of the matched references, surfaced separately.
    const references = scripture.verses.map((verse) => `${verse.book} ${verse.chapter}`);
    const referenceVideos = references.length
      ? await prisma.video.findMany({
          where: {
            ...PUBLISHED_VIDEO_WHERE,
            OR: references.map((ref) => ({ scriptureRefs: { contains: ref } })),
          },
          select: videoSummarySelect,
          orderBy: { viewCount: 'desc' },
          take: 12,
        })
      : [];

    res.json({
      query: params.q,
      scripture: {
        translation: scripture.translation,
        verses: scripture.verses,
        matchedTopics: scripture.matchedTopics,
      },
      aiSummary: scripture.aiSummary,
      videos: videoResults.videos,
      sermonsOnThesePassages: referenceVideos.map(toVideoSummary),
    });
  }),
);

searchRouter.get(
  '/bible/topics',
  handler(async (_req, res) => {
    res.json({ items: topicSuggestions() });
  }),
);
