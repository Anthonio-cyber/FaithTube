import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(result.error);
    // Express 5 makes req.query a getter; keep parsed output on a separate field.
    (req as Request & { parsedQuery?: unknown }).parsedQuery = result.data;
    next();
  };
}

export function query<T>(req: Request): T {
  return (req as Request & { parsedQuery: T }).parsedQuery;
}
