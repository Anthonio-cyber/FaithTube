import crypto from 'node:crypto';

/** Minimal AWS SigV4 request signer — enough for S3-compatible object storage. */
export interface SignedRequest {
  method: string;
  host: string;
  path: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  headers: Record<string, string>;
  body?: Buffer;
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function signingKeyFor(secretAccessKey: string, dateStamp: string, region: string, service: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service), 'aws4_request');
}

/** Each path segment is encoded, but the separators are not. */
function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join('/');
}

export async function signedFetch(req: SignedRequest): Promise<Response> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payload = req.body ?? Buffer.alloc(0);
  const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');

  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), v])),
    host: req.host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };

  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${headers[k].trim()}\n`).join('');
  const signedHeaders = sortedKeys.join(';');
  const canonicalRequest = [req.method, req.path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const scope = `${dateStamp}/${req.region}/${req.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const signingKey = signingKeyFor(req.secretAccessKey, dateStamp, req.region, req.service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  headers.authorization = `AWS4-HMAC-SHA256 Credential=${req.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(`https://${req.host}${req.path}`, {
    method: req.method,
    headers,
    body: payload.length ? new Uint8Array(payload) : undefined,
  });
}


export interface PresignRequest {
  method: string;
  host: string;
  path: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSeconds: number;
  /**
   * Headers the client must send and that are therefore part of the signature.
   * Keep this minimal: every header listed here has to be reproduced exactly by
   * the browser, and a mismatch is rejected as a signature error.
   */
  signedHeaders?: Record<string, string>;
  now?: Date;
}

/**
 * Builds a query-signed URL that a browser can PUT to directly.
 *
 * This is what keeps video off the API entirely: the bytes go from the
 * uploader's machine to object storage, so no request-body limit, function
 * timeout or server disk is ever in the path. UNSIGNED-PAYLOAD is used because
 * the client cannot hash a multi-gigabyte file before starting the upload —
 * the URL's expiry and the signed headers are what bound it.
 */
export function presignUrl(req: PresignRequest): string {
  const now = req.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${req.region}/${req.service}/aws4_request`;

  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(req.signedHeaders ?? {}).map(([k, v]) => [k.toLowerCase(), v])),
    host: req.host,
  };
  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${headers[k].trim()}\n`).join('');
  const signedHeaderList = sortedKeys.join(';');

  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${req.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(req.expiresInSeconds),
    'X-Amz-SignedHeaders': signedHeaderList,
  };
  // Query parameters must be sorted by key, and encoded, before signing.
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join('&');

  const canonicalPath = encodePath(req.path);
  const canonicalRequest = [
    req.method,
    canonicalPath,
    canonicalQuery,
    canonicalHeaders,
    signedHeaderList,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const signingKey = signingKeyFor(req.secretAccessKey, dateStamp, req.region, req.service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return `https://${req.host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
