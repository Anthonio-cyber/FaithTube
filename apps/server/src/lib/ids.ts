import { customAlphabet } from 'nanoid';

const SLUG_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const slugId = customAlphabet(SLUG_ALPHABET, 11);
const keyId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 24);

/** Short, URL-safe, unambiguous video identifier used in /watch/:slug. */
export const newVideoSlug = () => slugId();
export const newStorageKey = () => keyId();

export function slugify(input: string, maxLength = 48): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength);
}

/** Channel handles are @-prefixed in the UI but stored bare and lowercased. */
export function normalizeHandle(input: string): string {
  return input.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);
}
