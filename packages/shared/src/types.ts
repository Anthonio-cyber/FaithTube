import type { ModerationDecision, ModerationScores, VideoStatus, Visibility } from './moderation.js';
import type { Role } from './roles.js';
import type { PremiumStatus } from './premium.js';

export interface PublicUser {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  role: Role;
  isPremium: boolean;
  createdAt: string;
}

export interface SessionUser extends PublicUser {
  email: string;
  /** False for a Google-only account, which has no password to change. */
  hasPassword: boolean;
  country: string | null;
  onboardingComplete: boolean;
  interests: string[];
  premiumStatus: PremiumStatus | null;
  channelId: string | null;
  channelHandle: string | null;
  suspendedUntil: string | null;
  notificationPrefs: NotificationPreferences;
}

export interface NotificationPreferences {
  newUploads: boolean;
  newSubscribers: boolean;
  comments: boolean;
  replies: boolean;
  live: boolean;
  moderation: boolean;
  premium: boolean;
  announcements: boolean;
  email: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  newUploads: true,
  newSubscribers: true,
  comments: true,
  replies: true,
  live: true,
  moderation: true,
  premium: true,
  announcements: true,
  email: false,
};

export interface ChannelSummary {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  subscriberCount: number;
  verifiedChristianCreator: boolean;
}

export interface VideoSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  publishedAt: string | null;
  createdAt: string;
  categorySlug: string;
  tags: string[];
  isShort: boolean;
  isLive: boolean;
  ageRestricted: boolean;
  premiumOnly: boolean;
  christianContentVerified: boolean;
  channel: ChannelSummary;
}

export interface VideoDetail extends VideoSummary {
  status: VideoStatus;
  visibility: Visibility;
  scheduledFor: string | null;
  transcript: TranscriptCue[] | null;
  chapters: Chapter[];
  scriptureRefs: string[];
  contentWarnings: string[];
  viewerState: {
    liked: boolean;
    saved: boolean;
    subscribed: boolean;
    progressSeconds: number;
  } | null;
  sources: VideoSource[];
  captionsUrl: string | null;
}

export interface VideoSource {
  quality: string;
  url: string;
  width: number;
  height: number;
  bitrateKbps: number | null;
  /** Present when the platform only holds the original file. */
  original?: boolean;
}

export interface Chapter {
  startSeconds: number;
  title: string;
}

export interface TranscriptCue {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface ModerationSummary {
  id: string;
  videoId: string;
  decision: ModerationDecision;
  scores: ModerationScores;
  confidence: number;
  provider: string;
  model: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}
