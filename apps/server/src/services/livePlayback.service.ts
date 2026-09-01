import { prisma } from '../db/client.js';
import { badRequest } from '../lib/errors.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const log = logger('live');

/** Admin-managed list of hostnames a creator may point a stream's playback at. */
const SETTING_KEY = 'live.playbackHosts';

/**
 * Live video has to come from somewhere, and most ministries already stream
 * through something — a diocesan encoder, a church's existing host, a paid
 * provider. Rather than requiring this deployment to buy one, an administrator
 * names the hosts they trust and creators may use those.
 *
 * It is an allowlist rather than "any https URL" for two reasons. The player
 * embeds whatever it is given, so an open field is an invitation to point the
 * platform at something nobody here reviewed; and the content security policy
 * has to name the origins media may load from, which is only safe to widen for
 * hosts somebody deliberately approved.
 *
 * Cached because the policy is consulted on every request. Small, and refreshed
 * whenever an administrator changes it.
 */
let cached: string[] = [];

function normaliseHost(value: string): string | null {
  const trimmed = value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!trimmed) return null;
  // A hostname, optionally with a port. Nothing else.
  return /^[a-z0-9.-]+(:\d{1,5})?$/i.test(trimmed) ? trimmed.toLowerCase() : null;
}

export async function refreshPlaybackHosts(): Promise<string[]> {
  try {
    const row = await prisma.platformSetting.findUnique({ where: { key: SETTING_KEY } });
    const parsed = row ? (JSON.parse(row.value) as unknown) : [];
    cached = Array.isArray(parsed)
      ? [...new Set(parsed.map((v) => normaliseHost(String(v))).filter((v): v is string => Boolean(v)))]
      : [];
  } catch (error) {
    log.warn('Could not read the live playback allowlist; keeping the previous one.', error);
  }
  return cached;
}

export function playbackHosts(): string[] {
  return cached;
}

/** Every origin media may be loaded from, for the content security policy. */
export function playbackOrigins(): string[] {
  const configured = env.LIVE_PLAYBACK_BASE
    ? [new URL(env.LIVE_PLAYBACK_BASE.startsWith('http') ? env.LIVE_PLAYBACK_BASE : `https://${env.LIVE_PLAYBACK_BASE}`).host]
    : [];
  return [...new Set([...configured, ...cached])].map((host) => `https://${host}`);
}

export async function setPlaybackHosts(hosts: string[]): Promise<string[]> {
  const clean = [...new Set(hosts.map((h) => normaliseHost(h)).filter((h): h is string => Boolean(h)))];
  await prisma.platformSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(clean) },
    update: { value: JSON.stringify(clean) },
  });
  cached = clean;
  return clean;
}

/**
 * Checks a creator-supplied playback URL. Rejected URLs get a message that says
 * what is allowed, because "invalid URL" would leave a creator guessing.
 */
export function assertPlaybackUrlAllowed(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw badRequest('That playback address is not a valid URL.');
  }
  if (url.protocol !== 'https:') {
    throw badRequest('A playback address must start with https:// — browsers will not play an insecure stream on a secure page.');
  }
  if (!/\.(m3u8|mpd)$/i.test(url.pathname)) {
    throw badRequest('A playback address must point at an HLS (.m3u8) or DASH (.mpd) playlist.');
  }
  const allowed = playbackHosts();
  if (!allowed.includes(url.host.toLowerCase())) {
    throw badRequest(
      allowed.length
        ? `Streams can only be played from hosts an administrator has approved: ${allowed.join(', ')}.`
        : 'No streaming hosts have been approved on this site yet. Ask an administrator to add the one you use.',
    );
  }
  return url.toString();
}
