import { describe, expect, it } from 'vitest';
import { presignUrl } from '../lib/awsSign.js';

/**
 * The expected signature below is AWS's own published example for a
 * query-string-authenticated GET ("Signing AWS requests with Signature Version
 * 4" → *Query string request authentication*). Checking against it means the
 * canonical request, the scope and the key derivation are all verified against
 * the specification rather than against our own reimplementation of it.
 */
describe('presignUrl', () => {
  const AWS_EXAMPLE = {
    method: 'GET',
    host: 'examplebucket.s3.amazonaws.com',
    path: '/test.txt',
    region: 'us-east-1',
    service: 's3',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    expiresInSeconds: 86400,
    now: new Date('2013-05-24T00:00:00Z'),
  };

  it('reproduces the signature from the AWS specification', () => {
    const url = new URL(presignUrl(AWS_EXAMPLE));
    expect(url.searchParams.get('X-Amz-Signature')).toBe(
      'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
  });

  it('carries every parameter the storage service needs to validate the request', () => {
    const url = new URL(presignUrl(AWS_EXAMPLE));
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-Credential')).toBe('AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request');
    expect(url.searchParams.get('X-Amz-Date')).toBe('20130524T000000Z');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('86400');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
  });

  it('signs any extra header it is given, so the client must send it back', () => {
    const withType = presignUrl({ ...AWS_EXAMPLE, method: 'PUT', signedHeaders: { 'content-type': 'video/mp4' } });
    const without = presignUrl({ ...AWS_EXAMPLE, method: 'PUT' });
    expect(new URL(withType).searchParams.get('X-Amz-SignedHeaders')).toBe('content-type;host');
    expect(new URL(withType).searchParams.get('X-Amz-Signature')).not.toBe(
      new URL(without).searchParams.get('X-Amz-Signature'),
    );
  });

  it('encodes the key but not the separators, so nested keys stay valid paths', () => {
    const url = presignUrl({ ...AWS_EXAMPLE, path: '/video/ab/a b+c.mp4' });
    expect(url).toContain('/video/ab/a%20b%2Bc.mp4?');
  });
});
