import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { DEFAULT_NOTIFICATION_PREFS, type Role, type SessionUser } from '@faithtube/shared';
import { prisma } from '../db/client.js';
import { env } from '../config/env.js';
import { badRequest, conflict, unauthorized } from '../lib/errors.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { addDays } from '../lib/time.js';
import { parseJson } from '../lib/json.js';
import { normalizeHandle } from '../lib/ids.js';

export const SESSION_COOKIE = 'ft_session';
const BCRYPT_ROUNDS = 12;

export interface TokenPayload {
  sub: string;
  sid: string;
  role: Role;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Passwords are checked for length and obvious weakness only. We deliberately do
 * not impose character-class rules, which push people toward worse passwords.
 */
export function assertPasswordStrength(password: string) {
  if (password.length < 10) throw badRequest('Choose a password of at least 10 characters.');
  if (password.length > 200) throw badRequest('That password is too long.');
  const weak = ['password', '12345678', 'qwerty', 'faithtube', 'letmein'];
  if (weak.some((w) => password.toLowerCase().includes(w))) {
    throw badRequest('That password is too easy to guess. Please choose another.');
  }
}

export async function createSession(
  userId: string,
  role: Role,
  meta: { userAgent?: string; ipHash?: string | null },
): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const raw = randomToken();
  const expiresAt = addDays(new Date(), env.SESSION_TTL_DAYS);
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(raw),
      userAgent: meta.userAgent?.slice(0, 250),
      ipHash: meta.ipHash ?? null,
      expiresAt,
    },
  });
  const token = jwt.sign({ sub: userId, sid: session.id, role } satisfies TokenPayload, env.JWT_SECRET, {
    expiresIn: `${env.SESSION_TTL_DAYS}d`,
  });
  // The raw opaque token is stored alongside the JWT so a session can be revoked
  // server-side; the JWT alone would stay valid until expiry.
  await prisma.session.update({ where: { id: session.id }, data: { tokenHash: sha256(raw) } });
  return { token: `${token}.${raw}`, sessionId: session.id, expiresAt };
}

export async function resolveSession(compositeToken: string) {
  const lastDot = compositeToken.lastIndexOf('.');
  if (lastDot === -1) return null;
  const jwtPart = compositeToken.slice(0, lastDot);
  const opaquePart = compositeToken.slice(lastDot + 1);

  let payload: TokenPayload;
  try {
    payload = jwt.verify(jwtPart, env.JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    include: { user: { include: { channel: true, premium: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.tokenHash !== sha256(opaquePart)) return null;
  if (session.user.deletedAt) return null;
  return session;
}

export async function revokeSession(sessionId: string) {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string) {
  await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    domain: env.COOKIE_DOMAIN,
    expires: expiresAt,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: '/', domain: env.COOKIE_DOMAIN });
}

const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'moderator', 'faithtube', 'support', 'help', 'api', 'watch', 'channel',
  'studio', 'premium', 'settings', 'about', 'terms', 'privacy', 'live', 'shorts', 'clips', 'search',
  'system', 'staff', 'official', 'root', 'null', 'undefined',
]);

export async function assertUsernameAvailable(username: string, exceptUserId?: string) {
  const normalized = normalizeHandle(username);
  if (normalized.length < 3) throw badRequest('Usernames need at least 3 characters.');
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(normalized)) {
    throw badRequest('Usernames may use letters, numbers, dots, dashes and underscores.');
  }
  if (RESERVED_USERNAMES.has(normalized)) throw conflict('That username is reserved.');
  const existing = await prisma.user.findUnique({ where: { username: normalized } });
  if (existing && existing.id !== exceptUserId) throw conflict('That username is already taken.');
  return normalized;
}

/** Suggests a free username derived from a display name or email local-part. */
export async function suggestUsername(seed: string): Promise<string> {
  const base = normalizeHandle(seed) || 'believer';
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(Math.random() * 10000)}`;
    if (RESERVED_USERNAMES.has(candidate)) continue;
    const taken = await prisma.user.findUnique({ where: { username: candidate } });
    if (!taken) return candidate;
  }
  return `${base}${Date.now().toString(36)}`;
}

type UserWithRelations = Awaited<ReturnType<typeof resolveSession>> extends infer S
  ? S extends { user: infer U }
    ? U
    : never
  : never;

export function toSessionUser(user: NonNullable<UserWithRelations>): SessionUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    username: user.username,
    avatarUrl: user.avatarUrl,
    role: user.role as Role,
    country: user.country,
    createdAt: user.createdAt.toISOString(),
    onboardingComplete: user.onboardingComplete,
    interests: parseJson<string[]>(user.interests, []),
    isPremium: Boolean(user.premium && ['ACTIVE', 'TRIALING', 'COMPLIMENTARY'].includes(user.premium.status)),
    premiumStatus: (user.premium?.status as SessionUser['premiumStatus']) ?? null,
    channelId: user.channel?.id ?? null,
    channelHandle: user.channel?.handle ?? null,
    suspendedUntil: user.suspendedUntil ? user.suspendedUntil.toISOString() : null,
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS, ...parseJson(user.notificationPrefs, {}) },
  };
}

export function assertNotSuspended(user: { suspendedUntil: Date | null; suspensionReason: string | null }) {
  if (user.suspendedUntil && user.suspendedUntil > new Date()) {
    throw unauthorized(
      `This account is suspended until ${user.suspendedUntil.toISOString().slice(0, 10)}.` +
        (user.suspensionReason ? ` Reason: ${user.suspensionReason}` : ''),
    );
  }
}
