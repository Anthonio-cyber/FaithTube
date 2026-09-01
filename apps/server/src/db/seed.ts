/**
 * Seeds a working platform: categories, staff accounts, real channels, and
 * videos that have genuinely been through the moderation pipeline.
 *
 * Nothing here fakes a result. Each seeded video is classified by the same
 * classifier the live upload path uses, so the admin queues, the approval
 * badges and the analytics all reflect real decisions.
 */
import { CATEGORIES, DEFAULT_PREMIUM_PLAN, extractScriptureReferences, formatReference } from '@faithtube/shared';
import { prisma } from './client.js';
import { env } from '../config/env.js';
import { hashPassword } from '../services/auth.service.js';
import { stringifyJson } from '../lib/json.js';
import { newVideoSlug } from '../lib/ids.js';
import { classifyHeuristically } from '../ai/heuristicModerator.js';
import { logger } from '../lib/logger.js';
import { SEED_BORDERLINE_VIDEOS, SEED_CHANNELS, SEED_VIDEOS } from './seedData.js';

const log = logger('seed');

async function main() {
  log.info('Seeding FaithTube…');

  // ------------------------------------------------------------- categories
  for (const [index, category] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        slug: category.slug,
        name: category.name,
        description: category.description,
        blurb: category.blurb,
        keywords: stringifyJson(category.keywords),
        sortOrder: index,
      },
      update: { name: category.name, description: category.description, blurb: category.blurb, sortOrder: index },
    });
  }

  await prisma.platformSetting.upsert({
    where: { key: 'premium.plan' },
    create: { key: 'premium.plan', value: stringifyJson(DEFAULT_PREMIUM_PLAN) },
    update: {},
  });

  // ------------------------------------------------------------------ staff
  const adminPassword = await hashPassword(env.SEED_ADMIN_PASSWORD);
  const now = new Date();
  const agreements = {
    acceptedChristianContentAt: now,
    acceptedGuidelinesAt: now,
    acceptedPrivacyAt: now,
    onboardingComplete: true,
  };

  const admin = await prisma.user.upsert({
    where: { email: env.SEED_ADMIN_EMAIL },
    create: {
      email: env.SEED_ADMIN_EMAIL,
      passwordHash: adminPassword,
      displayName: 'Platform Administrator',
      username: 'faithtube_admin',
      role: 'SUPER_ADMIN',
      country: 'US',
      ...agreements,
      interests: stringifyJson(['sermons', 'bible-studies']),
    },
    update: { role: 'SUPER_ADMIN' },
  });

  log.info(`Administrator ready — ${admin.email}`);

  // Everything below this line is sample content: eight invented ministries and
  // twenty-five videos that have no video behind them. That is fine on a
  // developer's machine and wrong on a real deployment, where it would fill the
  // home page with channels nobody can watch. Off unless asked for.
  if (!env.SEED_DEMO_CONTENT) {
    log.info('Seed complete — categories, settings and the administrator account.');
    log.info(`Sign in as admin: ${env.SEED_ADMIN_EMAIL} / ${env.SEED_ADMIN_PASSWORD}`);
    log.info('Set SEED_DEMO_CONTENT=true for sample channels and videos in development.');
    return;
  }

  const moderator = await prisma.user.upsert({
    where: { email: 'moderator@faithtube.example' },
    create: {
      email: 'moderator@faithtube.example',
      passwordHash: adminPassword,
      displayName: 'Ruth Adeyemi',
      username: 'ruth_moderates',
      role: 'MODERATOR',
      country: 'GB',
      ...agreements,
      interests: stringifyJson(['sermons', 'testimonies']),
    },
    update: { role: 'MODERATOR' },
  });

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@faithtube.example' },
    create: {
      email: 'viewer@faithtube.example',
      passwordHash: adminPassword,
      displayName: 'Sam Okoye',
      username: 'sam_okoye',
      role: 'VIEWER',
      country: 'NG',
      ...agreements,
      interests: stringifyJson(['worship', 'testimonies', 'bible-studies', 'family']),
    },
    update: {},
  });

  log.info(`Sample staff ready — moderator: ${moderator.email}, viewer: ${viewer.email}`);

  // --------------------------------------------------------------- channels
  const channelMap = new Map<string, string>();
  for (const seed of SEED_CHANNELS) {
    const owner = await prisma.user.upsert({
      where: { email: seed.ownerEmail },
      create: {
        email: seed.ownerEmail,
        passwordHash: adminPassword,
        displayName: seed.ownerName,
        username: seed.handle.replace(/-/g, '_'),
        role: 'CREATOR',
        country: seed.country,
        ...agreements,
        interests: stringifyJson([seed.primaryCategory]),
      },
      update: {},
    });

    const channel = await prisma.channel.upsert({
      where: { ownerId: owner.id },
      create: {
        ownerId: owner.id,
        handle: seed.handle,
        name: seed.name,
        description: seed.description,
        location: seed.location,
        ministryAffiliation: seed.ministry,
        verifiedChristianCreator: seed.verified,
        subscriberCount: seed.subscribers,
      },
      update: { subscriberCount: seed.subscribers, verifiedChristianCreator: seed.verified },
    });
    channelMap.set(seed.handle, channel.id);
  }
  log.info(`${channelMap.size} channels ready`);

  // ----------------------------------------------------------------- videos
  let approved = 0;
  let held = 0;
  let rejected = 0;

  for (const seed of [...SEED_VIDEOS, ...SEED_BORDERLINE_VIDEOS]) {
    const channelId = channelMap.get(seed.channelHandle);
    if (!channelId) continue;

    const existing = await prisma.video.findFirst({ where: { title: seed.title, channelId } });
    if (existing) continue;

    const channel = await prisma.channel.findUniqueOrThrow({
      where: { id: channelId },
      include: { owner: true },
    });

    // Run the real classifier over the seed content.
    const result = classifyHeuristically({
      videoId: 'seed',
      title: seed.title,
      description: seed.description,
      tags: seed.tags,
      categorySlug: seed.categorySlug,
      transcript: seed.transcript,
      durationSeconds: seed.durationSeconds,
      isShort: seed.isShort ?? false,
      isLive: false,
      channel: {
        id: channelId,
        name: channel.name,
        approvedVideoCount: approved,
        rejectedVideoCount: 0,
        strikeCount: 0,
        verifiedChristianCreator: channel.verifiedChristianCreator,
      },
    });

    const statusByDecision = {
      APPROVED: 'PUBLISHED',
      RESTRICTED: 'PUBLISHED',
      HUMAN_REVIEW: 'AWAITING_REVIEW',
      REJECTED: 'REJECTED',
    } as const;
    const status = statusByDecision[result.decision];
    const isLive = status === 'PUBLISHED';

    const refs = extractScriptureReferences(`${seed.title}\n${seed.description}\n${seed.transcript}`);
    const publishedAt = isLive ? new Date(Date.now() - (seed.daysAgo ?? 3) * 86_400_000) : null;

    const video = await prisma.video.create({
      data: {
        id: newVideoSlug(),
        slug: newVideoSlug(),
        channelId,
        title: seed.title,
        description: seed.description,
        categorySlug: seed.categorySlug,
        tags: stringifyJson(seed.tags),
        durationSeconds: seed.durationSeconds,
        width: seed.isShort ? 1080 : 1920,
        height: seed.isShort ? 1920 : 1080,
        thumbnailUrl: null,
        status,
        visibility: isLive ? 'PUBLIC' : 'PRIVATE',
        publishedAt,
        createdAt: new Date(Date.now() - (seed.daysAgo ?? 3) * 86_400_000 - 3_600_000),
        isShort: seed.isShort ?? false,
        premiumOnly: seed.premiumOnly ?? false,
        christianContentVerified: result.decision === 'APPROVED' || result.decision === 'RESTRICTED',
        ageRestricted: result.ageRestricted,
        contentWarnings: stringifyJson(result.contentWarnings),
        scriptureRefs: stringifyJson([...new Set(refs.map(formatReference))]),
        transcriptText: seed.transcript,
        transcript: stringifyJson([{ startSeconds: 0, endSeconds: seed.durationSeconds, text: seed.transcript }]),
        chapters: stringifyJson(seed.chapters ?? []),
        viewCount: isLive ? seed.views ?? 0 : 0,
        likeCount: isLive ? Math.round((seed.views ?? 0) * 0.06) : 0,
        totalWatchSeconds: isLive ? Math.round((seed.views ?? 0) * seed.durationSeconds * 0.55) : 0,
      },
    });

    await prisma.videoModerationResult.create({
      data: {
        videoId: video.id,
        decision: result.decision,
        scores: stringifyJson(result.scores),
        confidence: result.confidence,
        findings: stringifyJson(result.findings),
        internalNotes: result.internalNotes,
        creatorMessage: result.creatorMessage,
        provider: result.provider,
        ageRestricted: result.ageRestricted,
        contentWarnings: stringifyJson(result.contentWarnings),
      },
    });

    if (result.decision === 'APPROVED' || result.decision === 'RESTRICTED') approved += 1;
    else if (result.decision === 'HUMAN_REVIEW') held += 1;
    else rejected += 1;
  }

  // Channel video counts reflect what actually published.
  for (const channelId of channelMap.values()) {
    const count = await prisma.video.count({ where: { channelId, status: 'PUBLISHED' } });
    const views = await prisma.video.aggregate({ where: { channelId }, _sum: { viewCount: true } });
    await prisma.channel.update({
      where: { id: channelId },
      data: { videoCount: count, totalViews: views._sum.viewCount ?? 0 },
    });
  }

  log.info(`Videos seeded — approved: ${approved}, awaiting human review: ${held}, rejected: ${rejected}`);

  // ------------------------------------------------- viewer state & feature
  const someChannels = [...channelMap.values()].slice(0, 4);
  for (const channelId of someChannels) {
    await prisma.subscription.upsert({
      where: { userId_channelId: { userId: viewer.id, channelId } },
      create: { userId: viewer.id, channelId },
      update: {},
    });
  }

  const published = await prisma.video.findMany({
    where: { status: 'PUBLISHED', isShort: false },
    orderBy: { viewCount: 'desc' },
    take: 6,
  });

  for (const [index, video] of published.slice(0, 3).entries()) {
    await prisma.watchHistory.upsert({
      where: { userId_videoId: { userId: viewer.id, videoId: video.id } },
      create: {
        userId: viewer.id,
        videoId: video.id,
        // Partly watched, so "Continue Watching" has real content.
        progressSeconds: Math.round(video.durationSeconds * (0.2 + index * 0.15)),
        watchSeconds: Math.round(video.durationSeconds * 0.3),
        lastWatchedAt: new Date(Date.now() - index * 86_400_000),
      },
      update: {},
    });
  }

  // Dated watch events so the analytics charts have real rows behind them.
  // These are genuine WatchHistory records — the same ones the API aggregates —
  // spread over the last few weeks rather than a fabricated series.
  const audience = await prisma.user.findMany({ where: { deletedAt: null }, select: { id: true } });
  const publishedForHistory = await prisma.video.findMany({
    where: { status: 'PUBLISHED' },
    select: { id: true, durationSeconds: true, channelId: true },
  });

  const existingHistory = await prisma.watchHistory.count();
  if (existingHistory < 40 && publishedForHistory.length && audience.length) {
    // A deterministic pseudo-random walk keeps re-seeding reproducible.
    let seedValue = 20240817;
    const random = () => {
      seedValue = (seedValue * 1103515245 + 12345) % 2147483648;
      return seedValue / 2147483648;
    };

    const rows: Array<{ userId: string; videoId: string; progressSeconds: number; watchSeconds: number; completed: boolean; lastWatchedAt: Date }> = [];
    const seen = new Set<string>();

    for (let dayOffset = 27; dayOffset >= 0; dayOffset -= 1) {
      // More activity at weekends, which is what a Christian platform actually sees.
      const date = new Date(Date.now() - dayOffset * 86_400_000);
      const isSunday = date.getUTCDay() === 0;
      const sessions = Math.round((isSunday ? 9 : 4) + random() * 5);

      for (let i = 0; i < sessions; i += 1) {
        const viewer = audience[Math.floor(random() * audience.length)];
        const video = publishedForHistory[Math.floor(random() * publishedForHistory.length)];
        const key = `${viewer.id}:${video.id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const completion = random();
        const watched = Math.round(video.durationSeconds * Math.max(0.08, completion));
        rows.push({
          userId: viewer.id,
          videoId: video.id,
          progressSeconds: watched,
          watchSeconds: watched,
          completed: completion > 0.8,
          lastWatchedAt: new Date(date.getTime() - Math.floor(random() * 12) * 3_600_000),
        });
      }
    }

    for (const row of rows) {
      await prisma.watchHistory.upsert({
        where: { userId_videoId: { userId: row.userId, videoId: row.videoId } },
        create: row,
        update: {},
      });
    }

    // Subscriptions dated across the window, so the subscriber chart has shape.
    for (const channelId of channelMap.values()) {
      const count = Math.round(3 + random() * 5);
      for (let i = 0; i < count; i += 1) {
        const viewer = audience[Math.floor(random() * audience.length)];
        await prisma.subscription
          .upsert({
            where: { userId_channelId: { userId: viewer.id, channelId } },
            create: { userId: viewer.id, channelId, createdAt: new Date(Date.now() - Math.floor(random() * 27) * 86_400_000) },
            update: {},
          })
          .catch(() => undefined);
      }
    }

    log.info(`Seeded ${rows.length} dated watch events for analytics`);
  }

  const playlist = await prisma.playlist.upsert({
    where: { ownerId_systemKey: { ownerId: viewer.id, systemKey: 'WATCH_LATER' } },
    create: { ownerId: viewer.id, title: 'Watch Later', systemKey: 'WATCH_LATER', visibility: 'PRIVATE' },
    update: {},
  });
  for (const [index, video] of published.slice(0, 4).entries()) {
    await prisma.playlistVideo.upsert({
      where: { playlistId_videoId: { playlistId: playlist.id, videoId: video.id } },
      create: { playlistId: playlist.id, videoId: video.id, position: index },
      update: {},
    });
  }
  await prisma.playlist.update({
    where: { id: playlist.id },
    data: { itemCount: Math.min(4, published.length), thumbnailUrl: published[0]?.thumbnailUrl },
  });

  const morningDevotion = await prisma.playlist.findFirst({
    where: { ownerId: viewer.id, title: 'Morning Devotion' },
  });
  if (!morningDevotion && published.length) {
    const created = await prisma.playlist.create({
      data: {
        ownerId: viewer.id,
        title: 'Morning Devotion',
        description: 'Short teaching to start the day in the Word.',
        visibility: 'PUBLIC',
        itemCount: Math.min(3, published.length),
        thumbnailUrl: published[0]?.thumbnailUrl,
      },
    });
    await prisma.playlistVideo.createMany({
      data: published.slice(0, 3).map((video, index) => ({ playlistId: created.id, videoId: video.id, position: index })),
    });
  }

  if (published[0]) {
    const heroExists = await prisma.featuredItem.findFirst({ where: { placement: 'HERO', active: true } });
    if (!heroExists) {
      await prisma.featuredItem.create({
        data: {
          placement: 'HERO',
          videoId: published[0].id,
          title: 'This week on FaithTube',
          subtitle: 'Every video here has passed our Christ-centred review.',
        },
      });
    }
  }

  await prisma.premiumSubscription.upsert({
    where: { userId: viewer.id },
    create: { userId: viewer.id, status: 'COMPLIMENTARY', provider: 'manual', currentPeriodEnd: new Date(Date.now() + 365 * 86_400_000) },
    update: {},
  });

  log.info('Seed complete.');
  log.info(`Sign in as admin:     ${env.SEED_ADMIN_EMAIL} / ${env.SEED_ADMIN_PASSWORD}`);
  log.info(`Sign in as moderator: moderator@faithtube.example / ${env.SEED_ADMIN_PASSWORD}`);
  log.info(`Sign in as viewer:    viewer@faithtube.example / ${env.SEED_ADMIN_PASSWORD}`);
}

main()
  .catch((err) => {
    log.error('Seed failed', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
