import path from 'node:path';
import { scoreTerms } from './textAnalysis.js';
import { NON_CHRISTIAN_MARKERS, SEXUAL_TERMS, VIOLENCE_TERMS } from './lexicon.js';

export interface ThumbnailCheck {
  passed: boolean;
  signals: string[];
  reason: string | null;
}

/**
 * Thumbnail screening.
 *
 * Without a configured vision model the platform cannot inspect pixels, so this
 * checks what it genuinely can: the filename, the creator-supplied alt text, and
 * the image's declared type and dimensions. When a vision provider is configured
 * the pipeline additionally passes sampled frame descriptions to the classifier.
 * We never report an image as "visually verified" when no vision model ran.
 */
export function checkThumbnailMetadata(input: {
  originalFilename: string;
  altText?: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
}): ThumbnailCheck {
  const signals: string[] = [];
  const haystack = [path.basename(input.originalFilename, path.extname(input.originalFilename)).replace(/[-_]+/g, ' '), input.altText ?? ''].join(' ');

  const sexual = scoreTerms(haystack, SEXUAL_TERMS);
  const violence = scoreTerms(haystack, VIOLENCE_TERMS);
  const offTopic = scoreTerms(haystack, NON_CHRISTIAN_MARKERS);

  if (sexual.total > 0) signals.push(`filename/alt text suggests sexual content (${sexual.hits.map((h) => h.term).join(', ')})`);
  if (violence.total > 0) signals.push(`filename/alt text suggests graphic violence (${violence.hits.map((h) => h.term).join(', ')})`);
  if (offTopic.total > 1.5) signals.push(`filename/alt text suggests off-platform content (${offTopic.hits.map((h) => h.term).join(', ')})`);

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.mimeType)) {
    return { passed: false, signals, reason: 'Thumbnails must be JPEG, PNG or WebP.' };
  }
  if (input.sizeBytes > 8 * 1024 * 1024) {
    return { passed: false, signals, reason: 'Thumbnails must be 8 MB or smaller.' };
  }
  if (input.width && input.height && input.width / input.height < 1.2) {
    signals.push('unusual aspect ratio for a landscape thumbnail');
  }

  const failed = sexual.total >= 3 || violence.total >= 3;
  return {
    passed: !failed,
    signals,
    reason: failed ? 'This thumbnail appears to depict content that is not permitted.' : null,
  };
}
