import 'dotenv/config';
import { z } from 'zod';

/**
 * Every external dependency is optional. When a key is absent the platform falls
 * back to a documented local implementation and the /api/system/integrations
 * endpoint reports the service as "not configured" — nothing is faked as working.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().default('http://localhost:5173'),
  API_URL: z.string().default('http://localhost:4000'),
  DATABASE_URL: z.string().default('file:./prisma/dev.db'),

  JWT_SECRET: z.string().default('dev-only-insecure-secret-change-me'),
  SESSION_TTL_DAYS: z.coerce.number().default(30),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.coerce.boolean().default(false),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./var/uploads'),
  STORAGE_PUBLIC_BASE: z.string().default('/media'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  CDN_BASE_URL: z.string().optional(),

  MAX_UPLOAD_BYTES: z.coerce.number().default(2 * 1024 * 1024 * 1024),

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
  TRANSCODE_ENABLED: z.coerce.boolean().default(true),

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

  SERVE_WEB: z.coerce.boolean().default(false),
  WEB_DIST_DIR: z.string().default('../web/dist'),

  WORKER_ENABLED: z.coerce.boolean().default(true),
  WORKER_POLL_MS: z.coerce.number().default(1500),

  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  SEED_ADMIN_EMAIL: z.string().default('admin@faithtube.example'),
  SEED_ADMIN_PASSWORD: z.string().default('ChangeMe!2024'),
});

const parsed = schema.safeParse(process.env);
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
