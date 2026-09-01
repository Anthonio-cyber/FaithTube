import { env } from '../config/env.js';
import { badRequest, notConfigured } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const log = logger('google');

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

export function googleConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
}

function assertConfigured() {
  if (!googleConfigured()) {
    throw notConfigured(
      'Google sign-in',
      'Create an OAuth 2.0 Web client in Google Cloud Console, then set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET ' +
        'and GOOGLE_REDIRECT_URI (it must exactly match the redirect URI registered with Google).',
    );
  }
}

export function googleAuthUrl(state: string): string {
  assertConfigured();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'select_account',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges an authorization code for tokens and reads the profile from the
 * returned id_token. The exchange happens server-side, so the client secret is
 * never present in browser or app code.
 */
export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  assertConfigured();

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    log.warn('Google token exchange failed', await tokenRes.text());
    throw badRequest('We could not complete Google sign-in. Please try again.');
  }

  const tokens = (await tokenRes.json()) as { id_token?: string; access_token?: string };
  if (!tokens.id_token) throw badRequest('Google did not return an identity token.');

  // The id_token arrives over a TLS connection direct from Google's token
  // endpoint in exchange for our client secret, so its payload is trustworthy
  // here; we still confirm audience and expiry before using it.
  const payload = decodeJwtPayload(tokens.id_token);
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    throw badRequest('That identity token was not issued by Google.');
  }
  if (payload.aud !== env.GOOGLE_CLIENT_ID) throw badRequest('That Google token was issued for a different application.');
  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) throw badRequest('That Google sign-in has expired.');
  if (!payload.email) throw badRequest('Your Google account did not share an email address.');

  return {
    sub: String(payload.sub),
    email: String(payload.email).toLowerCase(),
    emailVerified: Boolean(payload.email_verified),
    name: String(payload.name ?? ''),
    picture: payload.picture ? String(payload.picture) : null,
  };
}

interface GoogleIdTokenPayload {
  sub?: string;
  iss?: string;
  aud?: string;
  exp?: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

function decodeJwtPayload(token: string): GoogleIdTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw badRequest('Malformed Google identity token.');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as GoogleIdTokenPayload;
}
