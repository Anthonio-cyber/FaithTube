import type {
  ChannelSummary,
  Chapter,
  ModerationScores,
  PublicUser,
  Role,
  TranscriptCue,
  VideoDetail,
  VideoSource,
  VideoStatus,
  VideoSummary,
  Visibility,
} from '@faithtube/shared';
import { parseJson } from '../lib/json.js';

type ChannelRow = {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  subscriberCount: number;
  verifiedChristianCreator: boolean;
};

export function toChannelSummary(channel: ChannelRow): ChannelSummary {
  return {
    id: channel.id,
    handle: channel.handle,
    name: channel.name,
    avatarUrl: channel.avatarUrl,
    bannerUrl: channel.bannerUrl,
    subscriberCount: channel.subscriberCount,
    verifiedChristianCreator: channel.verifiedChristianCreator,
  };
}

type VideoRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  publishedAt: Date | null;
  createdAt: Date;
  categorySlug: string;
  tags: string;
  isShort: boolean;
  isLive: boolean;
  ageRestricted: boolean;
  premiumOnly: boolean;
  christianContentVerified: boolean;
  channel: ChannelRow;
};

export function toVideoSummary(video: VideoRow): VideoSummary {
  return {
    id: video.id,
    slug: video.slug,
    title: video.title,
    // Cards only need an excerpt; the full text lives on the detail response.
    description: video.description.slice(0, 400),
    thumbnailUrl: video.thumbnailUrl,
    durationSeconds: video.durationSeconds,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    publishedAt: video.publishedAt?.toISOString() ?? null,
    createdAt: video.createdAt.toISOString(),
    categorySlug: video.categorySlug,
    tags: parseJson<string[]>(video.tags, []),
    isShort: video.isShort,
    isLive: video.isLive,
    ageRestricted: video.ageRestricted,
    premiumOnly: video.premiumOnly,
    christianContentVerified: video.christianContentVerified,
    channel: toChannelSummary(video.channel),
  };
}

type VideoDetailRow = VideoRow & {
  status: string;
  visibility: string;
  scheduledFor: Date | null;
  transcript: string | null;
  chapters: string;
  scriptureRefs: string;
  contentWarnings: string;
  sources: string;
  captionsUrl: string | null;
};

export interface ViewerState {
  liked: boolean;
  saved: boolean;
  subscribed: boolean;
  progressSeconds: number;
}

export function toVideoDetail(video: VideoDetailRow, viewerState: ViewerState | null): VideoDetail {
  return {
    ...toVideoSummary(video),
    description: video.description,
    status: video.status as VideoStatus,
    visibility: video.visibility as Visibility,
    scheduledFor: video.scheduledFor?.toISOString() ?? null,
    transcript: video.transcript ? parseJson<TranscriptCue[]>(video.transcript, []) : null,
    chapters: parseJson<Chapter[]>(video.chapters, []),
    scriptureRefs: parseJson<string[]>(video.scriptureRefs, []),
    contentWarnings: parseJson<string[]>(video.contentWarnings, []),
    sources: parseJson<VideoSource[]>(video.sources, []),
    captionsUrl: video.captionsUrl,
    viewerState,
  };
}

type UserRow = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  role: string;
  createdAt: Date;
  premium?: { status: string } | null;
};

export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    displayName: user.displayName,
    username: user.username,
    avatarUrl: user.avatarUrl,
    role: user.role as Role,
    isPremium: Boolean(user.premium && ['ACTIVE', 'TRIALING', 'COMPLIMENTARY'].includes(user.premium.status)),
    createdAt: user.createdAt.toISOString(),
  };
}

export function toScores(raw: string): ModerationScores {
  return parseJson<ModerationScores>(raw, {
    christianRelevance: 0,
    safety: 0,
    familySuitability: 0,
    spamRisk: 0,
    hateRisk: 0,
    sexualContentRisk: 0,
    violenceRisk: 0,
    scamRisk: 0,
    copyrightRisk: 0,
    misleadingClaimsRisk: 0,
    evasionRisk: 0,
  });
}

/** Public video selection — never leaks moderation internals or storage keys. */
export const videoSummarySelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  thumbnailUrl: true,
  durationSeconds: true,
  viewCount: true,
  likeCount: true,
  publishedAt: true,
  createdAt: true,
  categorySlug: true,
  tags: true,
  isShort: true,
  isLive: true,
  ageRestricted: true,
  premiumOnly: true,
  christianContentVerified: true,
  channel: {
    select: {
      id: true,
      handle: true,
      name: true,
      avatarUrl: true,
      bannerUrl: true,
      subscriberCount: true,
      verifiedChristianCreator: true,
    },
  },
} as const;

export const videoDetailSelect = {
  ...videoSummarySelect,
  status: true,
  visibility: true,
  scheduledFor: true,
  transcript: true,
  chapters: true,
  scriptureRefs: true,
  contentWarnings: true,
  sources: true,
  captionsUrl: true,
} as const;

/**
 * The one condition that decides whether a video may be shown to the public.
 * Every discovery, search and recommendation query composes this — a video that
 * has not completed moderation can never reach a feed.
 */
export const PUBLISHED_VIDEO_WHERE = {
  status: 'PUBLISHED',
  visibility: 'PUBLIC',
  christianContentVerified: true,
  removedAt: null,
} as const;
