import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * Mobile API client.
 *
 * The web client rides an httpOnly cookie, which React Native has no equivalent
 * for, so mobile uses the Bearer token the same endpoints already return and
 * keeps it in the device keychain / keystore — not in AsyncStorage, which is
 * plain text on disk.
 */
const TOKEN_KEY = 'faithtube.session';

/**
 * Where the API lives.
 *
 * EXPO_PUBLIC_API_URL wins, so a build can be pointed at a deployment without
 * editing app.json. Note that a physical device cannot reach "localhost" — that
 * resolves to the phone itself — so during development set this to your
 * machine's LAN address, e.g. EXPO_PUBLIC_API_URL=http://192.168.1.20:4000.
 */
export function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const fromConfig = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  return (fromEnv || fromConfig || 'http://localhost:4000').replace(/\/$/, '');
}

let cachedToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export async function setToken(token: string | null): Promise<void> {
  cachedToken = token;
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // A keychain failure must not wedge sign-in; the session simply will not
    // survive a restart.
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get notConfigured() {
    return this.code === 'not_configured';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${apiBaseUrl()}/api${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  const token = await getToken();
  const isFormData = options.body instanceof FormData;

  const response = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    signal: options.signal,
    headers: {
      ...(isFormData ? {} : options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: isFormData ? (options.body as FormData) : options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    const error = payload as { error?: string; message?: string; details?: unknown } | null;
    // A rejected session is cleared immediately so the app returns to sign-in
    // rather than retrying with a token the server has revoked.
    if (response.status === 401) await setToken(null);
    throw new ApiError(
      response.status,
      error?.error ?? 'request_failed',
      error?.message ?? `Request failed (${response.status}).`,
      error?.details,
    );
  }

  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Absolute URL for media the API returned as a site-relative path. */
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${apiBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
}
