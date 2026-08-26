import { DEFAULT_NOTIFICATION_PREFS, type NotificationPreferences } from '@faithtube/shared';
import { prisma } from '../db/client.js';
import { parseJson } from '../lib/json.js';
import { logger } from '../lib/logger.js';

const log = logger('notifications');

export type NotificationType =
  | 'NEW_UPLOAD'
  | 'NEW_SUBSCRIBER'
  | 'COMMENT'
  | 'REPLY'
  | 'LIVE'
  | 'PREMIUM'
  | 'MODERATION'
  | 'ANNOUNCEMENT';

/** Maps a notification type onto the preference switch that gates it. */
const PREF_KEY: Record<NotificationType, keyof NotificationPreferences> = {
  NEW_UPLOAD: 'newUploads',
  NEW_SUBSCRIBER: 'newSubscribers',
  COMMENT: 'comments',
  REPLY: 'replies',
  LIVE: 'live',
  PREMIUM: 'premium',
  MODERATION: 'moderation',
  ANNOUNCEMENT: 'announcements',
};

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  linkUrl?: string;
  imageUrl?: string;
}

export async function notify(input: NotifyInput): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { notificationPrefs: true, deletedAt: true },
    });
    if (!user || user.deletedAt) return;

    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...parseJson(user.notificationPrefs, {}),
    };
    // Moderation outcomes are always delivered: a creator must learn why their
    // video was rejected even if they muted everything else.
    if (input.type !== 'MODERATION' && !prefs[PREF_KEY[input.type]]) return;

    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title.slice(0, 200),
        body: (input.body ?? '').slice(0, 1000),
        linkUrl: input.linkUrl,
        imageUrl: input.imageUrl,
      },
    });
  } catch (err) {
    log.error('Failed to create notification', err);
  }
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>): Promise<void> {
  // Chunked so a channel with many subscribers does not hold one long transaction.
  const chunkSize = 200;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    await Promise.all(userIds.slice(i, i + chunkSize).map((userId) => notify({ ...input, userId })));
  }
}

export async function notifySubscribers(
  channelId: string,
  input: Omit<NotifyInput, 'userId'>,
  gate: 'notifyUploads' | 'notifyLive' = 'notifyUploads',
): Promise<void> {
  const subs = await prisma.subscription.findMany({
    where: { channelId, [gate]: true },
    select: { userId: true },
  });
  await notifyMany(subs.map((s) => s.userId), input);
}

/** Fan-out to every active user — used for platform announcements only. */
export async function notifyAllUsers(input: Omit<NotifyInput, 'userId'>): Promise<number> {
  const users = await prisma.user.findMany({ where: { deletedAt: null }, select: { id: true } });
  await notifyMany(users.map((u) => u.id), input);
  return users.length;
}
