import crypto from 'node:crypto';

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** IPs are hashed before storage so audit logs never hold raw addresses. */
export function hashIp(ip: string | undefined, salt: string): string | null {
  if (!ip) return null;
  return crypto.createHmac('sha256', salt).update(ip).digest('hex').slice(0, 32);
}

export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
