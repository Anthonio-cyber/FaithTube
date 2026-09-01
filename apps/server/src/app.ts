import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env, isProd } from './config/env.js';
import { databaseStorage } from './services/storage.service.js';
import { attachAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { rateLimit } from './middleware/rateLimit.js';
import { authRouter } from './routes/auth.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { videosRouter } from './routes/videos.routes.js';
import { channelsRouter } from './routes/channels.routes.js';
import { commentsRouter } from './routes/comments.routes.js';
import { libraryRouter } from './routes/library.routes.js';
import { discoverRouter } from './routes/discover.routes.js';
import { searchRouter } from './routes/search.routes.js';
import { assistantRouter } from './routes/assistant.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { reportsRouter } from './routes/reports.routes.js';
import { premiumRouter } from './routes/premium.routes.js';
import { studioRouter } from './routes/studio.routes.js';
import { liveRouter } from './routes/live.routes.js';
import { communityRouter } from './routes/community.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { systemRouter } from './routes/system.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  /**
   * Content Security Policy.
   *
   * Helmet's default policy is `default-src 'self'`, which would block the web
   * font stylesheet and any media served from a CDN or object-storage bucket —
   * so the directives below are stated explicitly rather than left to default.
   * Only origins this deployment is actually configured to use are allowed.
   */
  const mediaOrigins = [env.CDN_BASE_URL, env.S3_ENDPOINT, env.LIVE_PLAYBACK_BASE]
    .filter((value): value is string => Boolean(value))
    .map((value) => new URL(value.startsWith('http') ? value : `https://${value}`).origin);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: isProd
        ? {
            useDefaults: true,
            directives: {
              'default-src': ["'self'"],
              'script-src': ["'self'"],
              // Tailwind emits a static stylesheet, but the player and charts set
              // inline style attributes for positions and widths.
              'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
              'img-src': ["'self'", 'data:', 'blob:', ...mediaOrigins],
              'media-src': ["'self'", 'blob:', ...mediaOrigins],
              'connect-src': ["'self'", ...mediaOrigins],
              'frame-ancestors': ["'none'"],
              'object-src': ["'none'"],
              'base-uri': ["'self'"],
              'form-action': ["'self'"],
              'upgrade-insecure-requests': [],
            },
          }
        : false,
    }),
  );
  app.use(compression());
  /**
   * CORS.
   *
   * In single-service mode the client is same-origin and none of this applies.
   * Otherwise the allowlist is APP_URL plus anything named in
   * CORS_EXTRA_ORIGINS, with the usual local development ports added outside
   * production. Requests with no Origin — native mobile, curl, server-to-server
   * — are allowed through, because CORS is a browser control and blocking them
   * would break the mobile client for no security gain.
   */
  const allowedOrigins = new Set(
    [
      env.APP_URL,
      ...env.CORS_EXTRA_ORIGINS.split(',').map((value) => value.trim()),
      ...(isProd ? [] : ['http://localhost:5173', 'http://localhost:8081', 'http://localhost:8082', 'http://localhost:19006']),
    ].filter(Boolean),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Reject by withholding the header rather than by throwing: the browser
        // then blocks the request itself, and a disallowed origin does not turn
        // into a 500 in the server's error log.
        callback(null, !origin || allowedOrigins.has(origin));
      },
      credentials: true,
    }),
  );
  app.use(cookieParser());

  // The Stripe webhook needs the raw body for signature verification, so the
  // JSON parser is mounted after that route is registered.
  app.use('/api/premium', premiumRouter);

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  app.use(rateLimit({ name: 'global', windowMs: 60_000, max: 600 }));
  app.use(attachAuth);

  // Media served by this process. Behind a CDN, or on object storage, none of
  // this is reached — urlFor points elsewhere and the bytes never touch the API.
  const dbMedia = databaseStorage;
  if (dbMedia) {
    // Range support is not optional for video: without it a browser cannot seek,
    // and some players refuse to start at all.
    app.get(`${env.STORAGE_PUBLIC_BASE}/*`, async (req, res) => {
      const key = decodeURIComponent((req.params as Record<string, string>)[0] ?? '');
      const file = await dbMedia.read(key);
      if (!file) {
        res.status(404).json({ error: 'not_found', message: 'That file is no longer available.' });
        return;
      }

      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.setHeader('Accept-Ranges', 'bytes');

      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
      if (range) {
        const start = range[1] ? Number(range[1]) : 0;
        const end = range[2] ? Math.min(Number(range[2]), file.data.length - 1) : file.data.length - 1;
        if (Number.isNaN(start) || start > end || start >= file.data.length) {
          res.status(416).setHeader('Content-Range', `bytes */${file.data.length}`).end();
          return;
        }
        res
          .status(206)
          .setHeader('Content-Range', `bytes ${start}-${end}/${file.data.length}`)
          .setHeader('Content-Length', String(end - start + 1))
          .end(file.data.subarray(start, end + 1));
        return;
      }

      res.setHeader('Content-Length', String(file.data.length));
      res.end(file.data);
    });
  } else {
    app.use(
      env.STORAGE_PUBLIC_BASE,
      express.static(path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR), {
        maxAge: '7d',
        immutable: true,
        fallthrough: false,
      }),
    );
  }

  app.use('/api/system', systemRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/videos', videosRouter);
  app.use('/api/channels', channelsRouter);
  app.use('/api/comments', commentsRouter);
  app.use('/api/library', libraryRouter);
  app.use('/api/discover', discoverRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/assistant', assistantRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/studio', studioRouter);
  app.use('/api/live', liveRouter);
  app.use('/api/community', communityRouter);
  app.use('/api/admin', adminRouter);

  // Single-service mode. Mounted after every /api route so the SPA fallback can
  // never shadow an endpoint: an unknown /api/* path still returns JSON 404.
  if (env.SERVE_WEB) {
    const webDist = path.resolve(process.cwd(), env.WEB_DIST_DIR);

    app.use('/api', notFoundHandler);

    // Hashed asset filenames are safe to cache hard; index.html never is.
    app.use(
      express.static(webDist, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );

    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(webDist, 'index.html'));
    });
  } else {
    app.use(notFoundHandler);
  }

  app.use(errorHandler);

  return app;
}
