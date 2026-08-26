import type { Request } from 'express';
import { prisma } from '../db/client.js';
import { hashIp } from '../lib/crypto.js';
import { env } from '../config/env.js';
import { stringifyJson } from '../lib/json.js';
import { logger } from '../lib/logger.js';

const log = logger('audit');

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

/**
 * Every administrative and moderation action lands here. Writes are best-effort:
 * a logging failure must never block the action a moderator just took, but it is
 * surfaced loudly in the server log.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.adminLog.create({
      data: {
        actorId: entry.actorId ?? entry.req?.auth?.userId ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        summary: entry.summary,
        metadata: stringifyJson(entry.metadata ?? {}),
        ipHash: hashIp(entry.req?.ip, env.JWT_SECRET),
      },
    });
  } catch (err) {
    log.error(`Failed to write audit entry for ${entry.action}`, err);
  }
}
