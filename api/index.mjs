/**
 * Vercel serverless entry point.
 *
 * An Express app is already a `(req, res)` function, so it can be exported
 * straight to Vercel's Node runtime — there is no adapter and no second copy of
 * the routing. Everything under /api is rewritten here by vercel.json, so this
 * one function serves the whole API.
 *
 * Two differences from the long-running server, both handled in config/env.ts
 * by detecting VERCEL: there is no background worker (the job queue is drained
 * in the request that fills it), and SERVE_WEB stays off because Vercel's CDN
 * serves the built client directly.
 */
import { createApp } from '../apps/server/dist/app.js';

const app = createApp();

export default app;
