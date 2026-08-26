import type { NextFunction, Request, Response } from 'express';
import { can, hasRole, type Permission, type Role } from '@faithtube/shared';
import { resolveSession, SESSION_COOKIE } from '../services/auth.service.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { prisma } from '../db/client.js';

export interface AuthContext {
  userId: string;
  sessionId: string;
  role: Role;
  channelId: string | null;
  isPremium: boolean;
  suspendedUntil: Date | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookie = req.cookies?.[SESSION_COOKIE];
  return typeof cookie === 'string' ? cookie : null;
}

/** Attaches req.auth when a valid session is present. Never rejects on its own. */
export async function attachAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) return next();
    const session = await resolveSession(token);
    if (!session) return next();
    req.auth = {
      userId: session.userId,
      sessionId: session.id,
      role: session.user.role as Role,
      channelId: session.user.channel?.id ?? null,
      isPremium: Boolean(
        session.user.premium && ['ACTIVE', 'TRIALING', 'COMPLIMENTARY'].includes(session.user.premium.status),
      ),
      suspendedUntil: session.user.suspendedUntil,
    };
    // Best-effort presence tracking; a failure here must not break the request.
    void prisma.user
      .update({ where: { id: session.userId }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(unauthorized());
  if (req.auth.suspendedUntil && req.auth.suspendedUntil > new Date()) {
    return next(forbidden('This account is suspended. Contact support if you believe this is a mistake.'));
  }
  next();
}

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (!hasRole(req.auth.role, role)) return next(forbidden());
    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (!can(req.auth.role, permission)) {
      return next(forbidden(`This action requires the "${permission}" permission.`));
    }
    next();
  };
}

/** Convenience for handlers that need the context and have already run requireAuth. */
export function auth(req: Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
