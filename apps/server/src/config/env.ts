import 'dotenv/config';
import { z } from 'zod';

/**
 * Every external dependency is optional. When a key is absent the platform falls
 * back to a documented local implementation and the /api/system/integrations
 * endpoint reports the service as "not configured" — nothing is faked as working.
 */
/**
 * Parses a boolean environment variable.
 *
 * z.coerce.boolean() cannot be used here: it applies JavaScript truthiness, so
 * the string "false" becomes true and every flag is stuck on. This accepts the
 * spellings people actually write in a .env file or a host's dashboard.
 */
const boolFromEnv = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .default(defaultValue)
    .transform((value, ctx) => {
      if (typeof value === 'boolean') return value;
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Expected a boolean, received "${value}"` });
      return z.NEVER;
    });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().default('http://localhost:5173'),
  API_URL: z.string().default('http://localhost:4000'),
  DATABASE_URL: z.string().default('file:./prisma/dev.db'),

  JWT_SECRET: z.string().default('dev-only-insecure-secret-change-me'),
  SESSION_TTL_DAYS: z.coerce.number().default(30),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: boolFromEnv(false),
  /**
   * "lax" suits a same-origin deployment. A client on a different domain — a
   * Vercel-hosted front end talking to an API elsewhere — needs "none", which
   * browsers only honour on a secure cookie.
   */
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  /**
   * local — files on disk (development, or a host with a durable volume)
   * s3    — any S3-compatible object storage; the right answer in production
   * db    — media rows in Postgres. For a host with neither a durable disk nor
   *         object storage, where "local" means silently losing every upload.
   */
  STORAGE_DRIVER: z.enum(['local', 's3', 'db']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./var/uploads'),
  STORAGE_PUBLIC_BASE: z.string().default('/media'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  CDN_BASE_URL: z.string().optional(),

  MAX_UPLOAD_BYTES: z.coerce.number().default(2 * 1024 * 1024 * 1024),
  /**
   * How long a direct-to-storage upload URL stays valid. It has to outlast the
   * upload itself on a slow connection, so this is generous — the URL is
   * single-key, single-method and only ever handed to the person uploading.
   */
  UPLOAD_URL_TTL_SECONDS: z.coerce.number().default(6 * 60 * 60),
  /**
   * Ceiling for a single file under STORAGE_DRIVER=db. A database is not a
   * media store, and a free Postgres tier is often half a gigabyte in total —
   * so refuse the file with a clear message rather than filling the database
   * that also holds every account and comment.
   */
  DB_STORAGE_MAX_BYTES: z.coerce.number().default(48 * 1024 * 1024),

  MODERATION_PROVIDER: z.enum(['auto', 'heuristic', 'anthropic']).default('auto'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5'),
  ANTHROPIC_BASE_URL: z.string().default('https://api.anthropic.com'),

  TRANSCRIPTION_PROVIDER: z.enum(['auto', 'none', 'whisper']).default('auto'),
  WHISPER_API_URL: z.string().optional(),
  WHISPER_API_KEY: z.string().optional(),
  WHISPER_MODEL: z.string().default('whisper-1'),

  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
  TRANSCODE_ENABLED: boolFromEnv(true),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),

  LIVE_INGEST_BASE: z.string().optional(),
  LIVE_PLAYBACK_BASE: z.string().optional(),

  /**
   * Single-service mode: the API also serves the built web client, so one
   * process on one free subdomain hosts the whole platform with no CORS.
   */
  /**
   * Extra browser origins allowed to call the API, comma-separated. Same-origin
   * deployments (SERVE_WEB=true) need none of this; it exists for a separately
   * hosted web client or an Expo web build on a non-default port.
   */
  CORS_EXTRA_ORIGINS: z.string().default(''),

  SERVE_WEB: boolFromEnv(false),
  WEB_DIST_DIR: z.string().default('../web/dist'),

  WORKER_ENABLED: boolFromEnv(true),
  /**
   * Drains the job queue in the request that enqueued it, instead of leaving it
   * to the background worker. This is what makes a serverless host workable:
   * there is no process to poll, and a schedule slow enough to be free would
   * leave uploads sitting unreviewed for hours.
   */
  INLINE_PIPELINE: boolFromEnv(false),
  /** Shared secret for the cron-driven processing endpoint. Unset = disabled. */
  CRON_SECRET: z.string().optional(),
  /** Jobs per cron invocation. Keep it low enough to fit a function timeout. */
  CRON_MAX_JOBS: z.coerce.number().default(3),
  WORKER_POLL_MS: z.coerce.number().default(1500),

  RATE_LIMIT_ENABLED: boolFromEnv(true),
  SEED_ADMIN_EMAIL: z.string().default('admin@faithtube.example'),
  SEED_ADMIN_PASSWORD: z.string().default('ChangeMe!2024'),
});

/**
 * Hosts that know their own public URL announce it. Using it as the default for
 * APP_URL and API_URL removes the single most common deployment mistake: the
 * site is up, but every sign-in fails CORS because the operator could not know
 * the generated hostname until after the service existed. An explicitly set
 * APP_URL always wins — a custom domain still overrides this.
 */
/**
 * Serverless hosts have no persistent process and no writable disk. Detecting
 * that here means the platform is correctly configured on arrival rather than
 * depending on the operator setting three flags they have no way to know about.
 */
const isServerless = Boolean(process.env.VERCEL);

const hostProvidedUrl =
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined) ??
  process.env.RENDER_EXTERNAL_URL ??
  (process.env.FLY_APP_NAME ? `https://${process.env.FLY_APP_NAME}.fly.dev` : undefined) ??
  (process.env.KOYEB_PUBLIC_DOMAIN ? `https://${process.env.KOYEB_PUBLIC_DOMAIN}` : undefined);

const rawEnv: NodeJS.ProcessEnv = { ...process.env };
if (hostProvidedUrl) {
  rawEnv.APP_URL ||= hostProvidedUrl;
  rawEnv.API_URL ||= hostProvidedUrl;
}
/**
 * Hosts whose filesystem does not survive a restart. On these, STORAGE_DRIVER
 * must never be left as "local": uploads would appear to succeed and then be
 * gone by the next deploy or idle-timeout.
 */
const isEphemeralDisk = isServerless || Boolean(process.env.RENDER);

if (isServerless) {
  // A polling worker inside a function would hold the invocation open and still
  // die between requests; the queue is drained inline instead.
  rawEnv.WORKER_ENABLED ||= 'false';
  rawEnv.INLINE_PIPELINE ||= 'true';
  // The filesystem is read-only apart from /tmp, so local storage cannot work
  // and ffmpeg is not installed.
  rawEnv.STORAGE_DRIVER ||= 's3';
  rawEnv.TRANSCODE_ENABLED ||= 'false';
}

const parsed = schema.safeParse(rawEnv);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

if (isProd && env.JWT_SECRET === 'dev-only-insecure-secret-change-me') {
  console.error('FATAL: JWT_SECRET must be set to a strong random value in production.');
  process.exit(1);
}

// Storing media on a disk that is wiped on restart is not a degraded mode, it
// is data loss that only shows up later. Where object storage has not been
// configured, the database at least keeps the file. Say so clearly at boot.
export const storageDowngradedToDatabase =
  isEphemeralDisk && env.STORAGE_DRIVER === 'local' && !env.S3_BUCKET;

// Browsers silently drop a SameSite=None cookie that is not Secure, which would
// look like "sign-in does nothing" rather than an error. Fail loudly instead.
if (env.COOKIE_SAMESITE === 'none' && !env.COOKIE_SECURE) {
  console.error('FATAL: COOKIE_SAMESITE=none requires COOKIE_SECURE=true, or browsers will discard the session cookie.');
  process.exit(1);
}

/** The largest upload this deployment can actually keep, in bytes. */
export function effectiveMaxUploadBytes(): number {
  const driver = storageDowngradedToDatabase ? 'db' : env.STORAGE_DRIVER;
  return driver === 'db' ? Math.min(env.MAX_UPLOAD_BYTES, env.DB_STORAGE_MAX_BYTES) : env.MAX_UPLOAD_BYTES;
}

/** The limit as a person should read it — GB once it is large enough to warrant it. */
export function uploadLimitLabel(): string {
  const bytes = effectiveMaxUploadBytes();
  return bytes >= 1024 * 1024 * 1024
    ? `${Math.round(bytes / 1024 / 1024 / 1024)} GB`
    : `${Math.round(bytes / 1024 / 1024)} MB`;
}

/** What the admin dashboard shows on the integrations panel. */
export function integrationStatus() {
  return {
    googleAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    stripe: Boolean(env.STRIPE_SECRET_KEY),
    anthropicModeration: Boolean(env.ANTHROPIC_API_KEY),
    transcription: env.TRANSCRIPTION_PROVIDER === 'whisper' || Boolean(env.WHISPER_API_URL && env.WHISPER_API_KEY),
    objectStorage: env.STORAGE_DRIVER === 's3' ? Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY_ID) : true,
    cdn: Boolean(env.CDN_BASE_URL),
    liveIngest: Boolean(env.LIVE_INGEST_BASE && env.LIVE_PLAYBACK_BASE),
  };
}
