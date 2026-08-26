import type { Chapter, TranscriptCue } from '@faithtube/shared';
import { extractScriptureReferences } from '@faithtube/shared';
import { anthropicConfigured, callClaude, extractJson } from './anthropicClient.js';
import { logger } from '../lib/logger.js';

const log = logger('ai:chapters');

/**
 * Chapter generation. With Claude configured we ask for semantic chapters; without
 * it we derive them from scripture references and topic shifts in the transcript,
 * which for sermon content is a genuinely useful signal.
 */
export async function generateChapters(
  cues: TranscriptCue[],
  durationSeconds: number,
  title: string,
): Promise<Chapter[]> {
  if (!cues.length || durationSeconds < 180) return [];

  if (anthropicConfigured()) {
    try {
      const outline = cues
        .filter((cue) => cue.endSeconds > 0)
        .map((cue) => `[${formatStamp(cue.startSeconds)}] ${cue.text}`)
        .join('\n')
        .slice(0, 20_000);
      const raw = await callClaude({
        maxTokens: 900,
        system:
          'You create chapter markers for Christian video content (sermons, Bible studies, worship). ' +
          'Return JSON only: {"chapters":[{"startSeconds":number,"title":"short title"}]}. ' +
          'Use 3-10 chapters, always start at 0, use the speaker\'s own structure (passage read, main points, application, prayer), ' +
          'and keep titles under 60 characters. Never invent content that is not in the transcript.',
        messages: [{ role: 'user', content: `Video title: ${title}\nDuration: ${durationSeconds}s\n\n${outline}` }],
      });
      const parsed = extractJson<{ chapters?: Chapter[] }>(raw);
      const chapters = sanitise(parsed?.chapters ?? [], durationSeconds);
      if (chapters.length >= 2) return chapters;
    } catch (err) {
      log.warn('Claude chapter generation failed; using transcript heuristics', err);
    }
  }

  return heuristicChapters(cues, durationSeconds);
}

/** Anchors chapters on scripture references, which mark structure in most teaching. */
export function heuristicChapters(cues: TranscriptCue[], durationSeconds: number): Chapter[] {
  const chapters: Chapter[] = [{ startSeconds: 0, title: 'Introduction' }];
  const minGap = Math.max(90, durationSeconds / 12);

  for (const cue of cues) {
    if (!cue.endSeconds && !cue.startSeconds) continue;
    const last = chapters[chapters.length - 1];
    if (cue.startSeconds - last.startSeconds < minGap) continue;

    const refs = extractScriptureReferences(cue.text);
    if (refs.length) {
      chapters.push({ startSeconds: cue.startSeconds, title: `Reading ${refs[0].raw}` });
      continue;
    }
    const marker = detectStructuralMarker(cue.text);
    if (marker) chapters.push({ startSeconds: cue.startSeconds, title: marker });
  }

  return sanitise(chapters, durationSeconds).slice(0, 12);
}

const STRUCTURAL_MARKERS: Array<[RegExp, string]> = [
  [/\blet(?:'| u)s pray\b|\bwould you pray with me\b/i, 'Prayer'],
  [/\bfirst(?:ly)?,? (?:point|we see)\b|\bpoint (?:one|1)\b/i, 'First point'],
  [/\bsecond(?:ly)?,? (?:point|we see)\b|\bpoint (?:two|2)\b/i, 'Second point'],
  [/\bthird(?:ly)?,? (?:point|we see)\b|\bpoint (?:three|3)\b/i, 'Third point'],
  [/\bin (?:conclusion|closing)\b|\bas we close\b|\bfinally\b/i, 'Closing'],
  [/\blet me tell you a story\b|\bi remember when\b/i, 'Illustration'],
  [/\bso what does this mean for (?:us|you)\b|\bapplication\b/i, 'Application'],
  [/\bthe invitation\b|\bif you don'?t know (?:jesus|christ)\b/i, 'Invitation'],
  [/\blet(?:'| u)s (?:sing|worship)\b/i, 'Worship'],
];

function detectStructuralMarker(text: string): string | null {
  for (const [pattern, label] of STRUCTURAL_MARKERS) if (pattern.test(text)) return label;
  return null;
}

function sanitise(chapters: Chapter[], durationSeconds: number): Chapter[] {
  const cleaned = chapters
    .filter((c) => Number.isFinite(c.startSeconds) && c.startSeconds >= 0 && c.startSeconds < durationSeconds)
    .map((c) => ({ startSeconds: Math.round(c.startSeconds), title: String(c.title).trim().slice(0, 70) }))
    .filter((c) => c.title.length > 0)
    .sort((a, b) => a.startSeconds - b.startSeconds);

  const deduped: Chapter[] = [];
  for (const chapter of cleaned) {
    if (deduped.some((c) => Math.abs(c.startSeconds - chapter.startSeconds) < 20)) continue;
    deduped.push(chapter);
  }
  if (deduped.length && deduped[0].startSeconds !== 0) deduped.unshift({ startSeconds: 0, title: 'Start' });
  return deduped;
}

function formatStamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
