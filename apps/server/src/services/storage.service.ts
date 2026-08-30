import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { presignUrl } from '../lib/awsSign.js';
import { env } from '../config/env.js';
import { notConfigured } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const log = logger('storage');

export interface StoredObject {
  key: string;
  url: string;
  sizeBytes: number;
  contentType: string;
}

export interface PresignedUpload {
  uploadUrl: string;
  /** Headers the browser must send with the PUT, because they were signed. */
  headers: Record<string, string>;
  expiresInSeconds: number;
}

export interface StorageDriver {
  readonly name: string;
  put(key: string, source: string | Buffer, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  urlFor(key: string): string;
  /** Absolute local path when the driver keeps bytes on disk; null for remote drivers. */
  localPath(key: string): string | null;
  /**
   * A URL the browser can upload to directly, or null when this driver cannot
   * offer one. Only object storage can: a local disk has no address a browser
   * could reach, so callers fall back to posting the file through the API.
   */
  presignPut?(key: string, contentType: string): PresignedUpload | null;
  /** Size and type of a stored object, or null when it is not there. */
  stat(key: string): Promise<{ sizeBytes: number; contentType: string } | null>;
}

class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';
  private root = path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR);

  private full(key: string) {
    // Reject traversal: keys are opaque ids joined with a known prefix.
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(this.root)) throw new Error('Invalid storage key');
    return resolved;
  }

  async put(key: string, source: string | Buffer, contentType: string): Promise<StoredObject> {
    const target = this.full(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    if (Buffer.isBuffer(source)) {
      await fs.writeFile(target, source);
    } else {
      await pipeline(createReadStream(source), createWriteStream(target));
    }
    const stat = await fs.stat(target);
    return { key, url: this.urlFor(key), sizeBytes: stat.size, contentType };
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.full(key), { force: true });
  }

  urlFor(key: string): string {
    const base = env.CDN_BASE_URL ?? env.STORAGE_PUBLIC_BASE;
    return `${base.replace(/\/$/, '')}/${key}`;
  }

  async stat(key: string): Promise<{ sizeBytes: number; contentType: string } | null> {
    try {
      const info = await fs.stat(this.full(key));
      return { sizeBytes: info.size, contentType: 'application/octet-stream' };
    } catch {
      return null;
    }
  }

  localPath(key: string): string {
    return this.full(key);
  }
}

/**
 * S3-compatible driver. Uploads are signed with SigV4 over plain fetch so the
 * server carries no vendor SDK. Activated by STORAGE_DRIVER=s3 plus credentials.
 */
class S3StorageDriver implements StorageDriver {
  readonly name = 's3';

  private assertConfigured() {
    if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_REGION) {
      throw notConfigured(
        'Object storage (S3)',
        'Set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY, or set STORAGE_DRIVER=local.',
      );
    }
  }

  async put(key: string, source: string | Buffer, contentType: string): Promise<StoredObject> {
    this.assertConfigured();
    const body = Buffer.isBuffer(source) ? source : await fs.readFile(source);
    const { signedFetch } = await import('../lib/awsSign.js');
    const res = await signedFetch({
      method: 'PUT',
      host: this.host(),
      path: this.objectPath(key),
      region: env.S3_REGION!,
      service: 's3',
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      body,
      headers: { 'content-type': contentType },
    });
    if (!res.ok) throw new Error(`S3 upload failed (${res.status}): ${await res.text()}`);
    return { key, url: this.urlFor(key), sizeBytes: body.length, contentType };
  }

  async delete(key: string): Promise<void> {
    this.assertConfigured();
    const { signedFetch } = await import('../lib/awsSign.js');
    await signedFetch({
      method: 'DELETE',
      host: this.host(),
      path: this.objectPath(key),
      region: env.S3_REGION!,
      service: 's3',
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      headers: {},
    });
  }

  /**
   * Two addressing styles, because providers differ.
   *
   * A configured endpoint (Cloudflare R2, MinIO, Backblaze) is an *account*
   * address, so the bucket belongs in the path. Amazon's own S3 has no endpoint
   * configured and uses virtual-hosted style, where the bucket is a subdomain.
   * Getting this wrong produces a NoSuchBucket that reads like a credentials
   * problem, so the two cases are kept explicit.
   */
  private host(): string {
    if (env.S3_ENDPOINT) return env.S3_ENDPOINT.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return `${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`;
  }

  private objectPath(key: string): string {
    return env.S3_ENDPOINT ? `/${env.S3_BUCKET}/${key}` : `/${key}`;
  }

  presignPut(key: string, contentType: string): PresignedUpload {
    this.assertConfigured();
    const expiresInSeconds = env.UPLOAD_URL_TTL_SECONDS;
    const uploadUrl = presignUrl({
      method: 'PUT',
      host: this.host(),
      path: this.objectPath(key),
      region: env.S3_REGION!,
      service: 's3',
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      expiresInSeconds,
      signedHeaders: { 'content-type': contentType },
    });
    return { uploadUrl, headers: { 'content-type': contentType }, expiresInSeconds };
  }

  urlFor(key: string): string {
    if (env.CDN_BASE_URL) return `${env.CDN_BASE_URL.replace(/\/$/, '')}/${key}`;
    return `https://${this.host()}${this.objectPath(key)}`;
  }

  /**
   * A HEAD against the object. This is what turns "the client says it uploaded"
   * into something checked: the finalize step will not create a video row for
   * an object that is not actually in the bucket, and it takes the size from
   * storage rather than from the request.
   */
  async stat(key: string): Promise<{ sizeBytes: number; contentType: string } | null> {
    this.assertConfigured();
    const { signedFetch } = await import('../lib/awsSign.js');
    const res = await signedFetch({
      method: 'HEAD',
      host: this.host(),
      path: this.objectPath(key),
      region: env.S3_REGION!,
      service: 's3',
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      headers: {},
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`S3 HEAD failed (${res.status})`);
    return {
      sizeBytes: Number(res.headers.get('content-length') ?? 0),
      contentType: res.headers.get('content-type') ?? 'application/octet-stream',
    };
  }

  localPath(): null {
    return null;
  }
}

export const storage: StorageDriver = env.STORAGE_DRIVER === 's3' ? new S3StorageDriver() : new LocalStorageDriver();

log.info(`Storage driver: ${storage.name}`);

export function mediaKey(kind: 'video' | 'thumbnail' | 'avatar' | 'banner' | 'caption' | 'post', id: string, ext: string) {
  const safeExt = ext.replace(/[^a-z0-9.]/gi, '').replace(/^\.?/, '.');
  return `${kind}/${id.slice(0, 2)}/${id}${safeExt}`;
}
