export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, 'bad_request', message, details);
export const unauthorized = (message = 'You need to sign in to do that.') =>
  new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have permission to do that.') =>
  new HttpError(403, 'forbidden', message);
export const notFound = (message = 'Not found.') => new HttpError(404, 'not_found', message);
export const conflict = (message: string) => new HttpError(409, 'conflict', message);
export const tooManyRequests = (message = 'Too many requests. Please slow down.') =>
  new HttpError(429, 'rate_limited', message);
export const notConfigured = (service: string, howToFix: string) =>
  new HttpError(501, 'not_configured', `${service} is not configured on this deployment.`, { howToFix });
