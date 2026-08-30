import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { badRequest } from '../lib/errors.js';

/**
 * A short-lived, signed permit for one direct-to-storage upload.
 *
 * When the browser uploads straight to object storage, the API never sees the
 * bytes — so at the point the video row is created it has only the client's
 * word for which storage key belongs to it. Without a permit, anyone could
 * claim any key in the bucket, including another creator's video. The grant is
 * issued alongside the upload URL, bound to the user it was issued to, and
 * verified on the way back.
 *
 * It is deliberately stateless: a database row per upload attempt would need
 * its own expiry sweep, and the signature already carries everything that
 * matters.
 */
export interface UploadGrant {
  key: string;
  userId: string;
  contentType: string;
  kind: 'video' | 'thumbnail';
  /** Unix seconds. */
  exp: number;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', env.JWT_SECRET).update(payload).digest('base64url');
}

export function issueUploadGrant(grant: Omit<UploadGrant, 'exp'>, ttlSeconds: number): string {
  const payload: UploadGrant = { ...grant, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function verifyUploadGrant(token: string, expected: { userId: string; kind: UploadGrant['kind'] }): UploadGrant {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) throw badRequest('That upload could not be verified. Please start the upload again.');

  const want = Buffer.from(sign(encoded));
  const got = Buffer.from(signature);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) {
    throw badRequest('That upload could not be verified. Please start the upload again.');
  }

  let grant: UploadGrant;
  try {
    grant = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as UploadGrant;
  } catch {
    throw badRequest('That upload could not be verified. Please start the upload again.');
  }

  if (grant.exp < Math.floor(Date.now() / 1000)) {
    throw badRequest('That upload took too long to finish. Please try again.');
  }
  // A valid grant for a different account, or for a thumbnail being passed off
  // as a video, is exactly what this check exists to stop.
  if (grant.userId !== expected.userId || grant.kind !== expected.kind) {
    throw badRequest('That upload could not be verified. Please start the upload again.');
  }
  return grant;
}
