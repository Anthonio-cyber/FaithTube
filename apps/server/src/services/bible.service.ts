import { extractScriptureReferences, formatReference } from '@faithtube/shared';
import { TOPIC_INDEX, TRANSLATION, VERSES, type Verse } from '../data/verses.js';
import { anthropicConfigured, callClaude } from '../ai/anthropicClient.js';
import { logger } from '../lib/logger.js';
import { normalize } from '../ai/textAnalysis.js';

const log = logger('bible');

export interface BibleSearchResult {
  translation: typeof TRANSLATION;
  /** Actual Scripture text. Never generated. */
  verses: Verse[];
  matchedTopics: string[];
  /**
   * AI-written explanation, always separated from Scripture in the response so
   * the UI can label it clearly. Null when no AI service is configured.
   */
  aiSummary: {
    text: string;
    model: string;
    disclaimer: string;
  } | null;
}

const AI_DISCLAIMER =
  'This explanation was written by an AI assistant. It is not Scripture and it is not a substitute for reading the Bible ' +
  'itself, for your church’s teaching, or for a pastor. Check everything against the passages above.';

const STOP_WORDS = new Set([
  'what', 'does', 'the', 'bible', 'say', 'about', 'a', 'an', 'and', 'of', 'for', 'to', 'in', 'on', 'is', 'are',
  'how', 'can', 'i', 'we', 'you', 'my', 'me', 'do', 'should', 'when', 'why', 'who', 'verse', 'verses', 'scripture',
  'god', 'lord', 'jesus', 'christ',
]);

/**
 * Bible Search.
 *
 * Three paths, in order: an explicit reference ("Romans 8:28"), a topic match
 * against the curated index, then a full-text scan of the verse set. Scripture
 * text always comes from the dataset — the AI layer only ever adds commentary
 * around verses that were already retrieved.
 */
export async function searchBible(query: string, options: { includeSummary?: boolean } = {}): Promise<BibleSearchResult> {
  const refs = extractScriptureReferences(query);
  let verses: Verse[] = [];
  const matchedTopics: string[] = [];

  if (refs.length) {
    const wanted = new Set(refs.map((ref) => `${ref.book} ${ref.chapter}`));
    verses = VERSES.filter((verse) => wanted.has(`${verse.book} ${verse.chapter}`));
    // Fall back to the chapter's book if that exact chapter is not in the subset.
    if (!verses.length) {
      const books = new Set(refs.map((ref) => ref.book));
      verses = VERSES.filter((verse) => books.has(verse.book)).slice(0, 6);
    }
  }

  const terms = normalize(query)
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));

  if (verses.length < 6) {
    for (const [topic, topicVerses] of TOPIC_INDEX) {
      if (terms.some((term) => topic.includes(term) || term.includes(topic))) {
        matchedTopics.push(topic);
        verses.push(...topicVerses);
      }
    }
  }

  if (verses.length < 4 && terms.length) {
    const scored = VERSES.map((verse) => {
      const haystack = normalize(`${verse.text} ${verse.topics.join(' ')}`);
      const hits = terms.filter((term) => haystack.includes(term)).length;
      return { verse, hits };
    })
      .filter((entry) => entry.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 8);
    verses.push(...scored.map((entry) => entry.verse));
  }

  const unique = dedupe(verses).slice(0, 12);

  let aiSummary: BibleSearchResult['aiSummary'] = null;
  if (options.includeSummary && unique.length && anthropicConfigured()) {
    aiSummary = await summarise(query, unique);
  }

  return {
    translation: TRANSLATION,
    verses: unique,
    matchedTopics: [...new Set(matchedTopics)],
    aiSummary,
  };
}

async function summarise(query: string, verses: Verse[]): Promise<BibleSearchResult['aiSummary']> {
  try {
    const text = await callClaude({
      maxTokens: 700,
      temperature: 0.2,
      system:
        'You help people understand Scripture on FaithTube, a Christian video platform. ' +
        'You are given a question and a set of Bible passages that were retrieved for it. ' +
        'Write 3-5 sentences that explain what these passages say about the question. Rules: ' +
        'quote only from the passages provided; never invent a verse or a reference; ' +
        'stay within what historic Christianity holds in common and do not take sides between denominations; ' +
        'do not give medical, legal or financial advice; ' +
        'if the question touches crisis or self-harm, gently encourage the reader to speak to their pastor and to seek professional help. ' +
        'Write plainly and warmly, with no headings or lists.',
      messages: [
        {
          role: 'user',
          content: `Question: ${query}\n\nPassages:\n${verses
            .map((verse) => `${verse.reference} — ${verse.text}`)
            .join('\n\n')}`,
        },
      ],
    });
    const { env } = await import('../config/env.js');
    return { text: text.trim(), model: env.ANTHROPIC_MODEL, disclaimer: AI_DISCLAIMER };
  } catch (err) {
    log.warn('Bible summary generation failed', err);
    return null;
  }
}

function dedupe(verses: Verse[]): Verse[] {
  const seen = new Set<string>();
  return verses.filter((verse) => {
    if (seen.has(verse.reference)) return false;
    seen.add(verse.reference);
    return true;
  });
}

/** Reference strings a video's metadata mentions, used for scripture-based search. */
export function referencesIn(text: string): string[] {
  return [...new Set(extractScriptureReferences(text).map(formatReference))];
}

export function topicSuggestions(): string[] {
  return [...TOPIC_INDEX.keys()].sort();
}
