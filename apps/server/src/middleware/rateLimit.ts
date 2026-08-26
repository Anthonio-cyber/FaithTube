import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { tooManyRequests } from '../lib/errors.js';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-process fixed-window limiter. Single-node deployments are covered as-is;
 * for multi-node, point `store` at Redis — the interface is one get/increment.
 */
const buckets = new Map<string, Bucket>();

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 60_000).unref?.();

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Defaults to user id when signed in, else client IP. */
  keyBy?: (req: Request) => string;
  name?: string;
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, name = 'default' } = options;
  return (req: Request, res: Response, next: NextFunction) => {
    if (!env.RATE_LIMIT_ENABLED) return next();
    const identity = options.keyBy?.(req) ?? req.auth?.userId ?? req.ip ?? 'anonymous';
    const key = `${name}:${identity}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Remaining', String(max - 1));
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return next(tooManyRequests());
    }
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    next();
  };
}

export const authLimiter = rateLimit({ name: 'auth', windowMs: 15 * 60_000, max: 20 });
export const writeLimiter = rateLimit({ name: 'write', windowMs: 60_000, max: 90 });
export const uploadLimiter = rateLimit({ name: 'upload', windowMs: 60 * 60_000, max: 25 });
export const searchLimiter = rateLimit({ name: 'search', windowMs: 60_000, max: 120 });
export const reportLimiter = rateLimit({ name: 'report', windowMs: 60 * 60_000, max: 30 });
