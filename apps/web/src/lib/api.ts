/**
 * API client.
 *
 * The session cookie is httpOnly and set by the API, so the browser sends it
 * automatically; no token is ever kept in localStorage where a script could
 * read it. The Bearer fallback exists only for the mobile client.
 */
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

  /** True when the server told us a service simply is not configured here. */
  get notConfigured() {
    return this.code === 'not_configured';
  }

  get howToFix(): string | null {
    const details = this.details as { howToFix?: string } | undefined;
    return details?.howToFix ?? null;
  }
}

/**
 * Where the API lives.
 *
 * Empty (the default) means same-origin: the client is served by the API itself,
 * or a host rewrite proxies /api to it. Set VITE_API_URL at build time to point
 * a separately hosted client — a Vercel deployment, say — at an API elsewhere.
 *
 * Note that a cross-origin API must also send SameSite=None cookies and list
 * this client's origin in CORS_EXTRA_ORIGINS, or the session will not stick.
 */
const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const BASE = `${API_ORIGIN}/api`;

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, headers, ...rest } = options;

  const url = new URL(`${BASE}${path}`, API_ORIGIN || window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  const isFormData = body instanceof FormData;
  const response = await fetch(url.toString(), {
    ...rest,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    const error = payload as { error?: string; message?: string; details?: unknown } | null;
    throw new ApiError(
      response.status,
      error?.error ?? 'request_failed',
      error?.message ?? `Request failed with status ${response.status}.`,
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

/**
 * Upload with progress. fetch has no upload-progress event, so this uses
 * XMLHttpRequest — the one place where it is still the right tool.
 */
export function uploadWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress: (percent: number) => void,
): { promise: Promise<T>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<T>((resolve, reject) => {
    xhr.open('POST', `${BASE}${path}`);
    xhr.withCredentials = true;

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener('load', () => {
      const payload = safeParse(xhr.responseText) as { error?: string; message?: string; details?: unknown };
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload as T);
      else {
        reject(
          new ApiError(
            xhr.status,
            payload?.error ?? 'upload_failed',
            payload?.message ?? 'Your upload could not be completed.',
            payload?.details,
          ),
        );
      }
    });

    xhr.addEventListener('error', () => reject(new ApiError(0, 'network_error', 'The connection was lost during upload.')));
    xhr.addEventListener('abort', () => reject(new ApiError(0, 'aborted', 'Upload cancelled.')));
    xhr.send(formData);
  });

  return { promise, abort: () => xhr.abort() };
}
