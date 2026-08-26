import type { WeightedTerm } from './lexicon.js';

/** Normalises text for matching: lowercase, unicode-folded, punctuation-tolerant. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export interface TermHit {
  term: string;
  weight: number;
  count: number;
}

/**
 * Counts weighted term occurrences. Multi-word terms are matched as phrases;
 * single words are matched on word boundaries so "sin" does not match "single".
 */
export function scoreTerms(text: string, lexicon: WeightedTerm[]): { total: number; hits: TermHit[] } {
  const haystack = normalize(text);
  const hits: TermHit[] = [];
  let total = 0;
  for (const entry of lexicon) {
    const needle = normalize(entry.term);
    const pattern = needle.includes(' ')
      ? new RegExp(escapeRegExp(needle), 'g')
      : new RegExp(`\\b${escapeRegExp(needle)}\\b`, 'g');
    const count = (haystack.match(pattern) ?? []).length;
    if (count === 0) continue;
    // Repetition adds diminishing value: keyword stuffing should not win.
    const contribution = entry.weight * (1 + Math.log10(count));
    total += contribution;
    hits.push({ term: entry.term, weight: entry.weight, count });
  }
  return { total, hits };
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchesAny(text: string, patterns: RegExp[]): RegExp[] {
  const haystack = normalize(text);
  return patterns.filter((pattern) => pattern.test(haystack));
}

export function containsAny(text: string, needles: string[]): string[] {
  const haystack = normalize(text);
  return needles.filter((needle) => haystack.includes(normalize(needle)));
}

/** Maps an unbounded weighted score onto 0..1 with a soft knee at `midpoint`. */
export function saturate(score: number, midpoint: number): number {
  if (score <= 0) return 0;
  return score / (score + midpoint);
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Words per minute of speech; unusually low values suggest music or silence. */
export function speechDensity(transcriptWordCount: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return transcriptWordCount / (durationSeconds / 60);
}
