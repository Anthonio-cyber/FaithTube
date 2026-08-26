import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/errors.js';
import { isProd } from '../config/env.js';
import { logger } from '../lib/logger.js';

const log = logger('http');

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'not_found', message: 'No such endpoint.' });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'validation_failed',
      message: 'Some of the details you sent are not valid.',
      details: err.flatten().fieldErrors,
    });
  }
  if (typeof err === 'object' && err && 'code' in err && (err as { code: string }).code === 'P2002') {
    return res.status(409).json({ error: 'conflict', message: 'That value is already taken.' });
  }
  if (typeof err === 'object' && err && 'code' in err && (err as { code: string }).code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'file_too_large', message: 'That file exceeds the upload limit.' });
  }

  log.error(`Unhandled error on ${req.method} ${req.path}`, err);
  res.status(500).json({
    error: 'internal_error',
    message: 'Something went wrong on our side. Please try again.',
    details: isProd ? undefined : String(err instanceof Error ? err.stack : err),
  });
}
