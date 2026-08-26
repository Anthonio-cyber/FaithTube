import { HATE_TERMS, SCAM_TERMS, SEXUAL_TERMS, SPAM_PATTERNS } from './lexicon.js';
import { clamp01, matchesAny, normalize, saturate, scoreTerms } from './textAnalysis.js';
import type { CommentModerationVerdict } from './types.js';

/** Directed at a person's life or safety — removed on a single match. */
const SEVERE_HARASSMENT_PATTERNS: RegExp[] = [
  /\bkill yourself\b|\bkys\b/i,
  /\bgo (?:and )?die\b/i,
  /\byou should (?:be dead|die)\b/i,
  /\bi hope you (?:die|get hurt)\b/i,
];

/** Insulting but not a threat — one match is held, several are removed. */
const HARASSMENT_PATTERNS: RegExp[] = [
  /\byou(?:'re| are) (?:an? )?(?:idiot|moron|stupid|worthless|trash|garbage)\b/i,
  /\bshut up,? you\b/i,
  /\bnobody (?:likes|wants) you\b/i,
  /\bgo to hell\b/i,
];

const LINK_SPAM_PATTERNS: RegExp[] = [
  /\b(?:t\.me|wa\.me|whatsapp)\b.{0,40}\b(?:prophet|prophecy|healing|money)\b/i,
  /\b(?:dm|message) me (?:on|at) (?:whatsapp|telegram)\b/i,
  /\bcheck (?:out )?my (?:channel|profile|link)\b.{0,20}(?:https?:\/\/|www\.)/i,
  /\b(?:earn|make) \$?\d+[k]? (?:a|per) (?:day|week)\b/i,
];

/**
 * Comment moderation. It looks for spam, scams, harassment, explicit language and
 * hate — and nothing else. Theological disagreement, sharp debate and criticism of
 * a video's argument are explicitly out of scope: the platform hosts believers who
 * differ, and disagreement is not abuse.
 */
export function moderateComment(body: string): CommentModerationVerdict {
  const text = normalize(body);

  const hate = scoreTerms(text, HATE_TERMS);
  if (hate.total >= 3) {
    return { action: 'REMOVE', label: 'hate', score: 0.95, reason: 'Hateful content directed at a person or group.' };
  }

  const sexual = scoreTerms(text, SEXUAL_TERMS);
  if (sexual.total >= 3) {
    return { action: 'REMOVE', label: 'explicit', score: 0.9, reason: 'Sexually explicit content.' };
  }

  const severe = matchesAny(text, SEVERE_HARASSMENT_PATTERNS);
  if (severe.length) {
    return {
      action: 'REMOVE',
      label: 'harassment',
      score: 0.95,
      reason: 'Content telling someone to harm or kill themselves.',
    };
  }

  const harassment = matchesAny(text, HARASSMENT_PATTERNS);
  if (harassment.length) {
    return {
      action: harassment.length > 1 ? 'REMOVE' : 'HOLD',
      label: 'harassment',
      score: clamp01(0.55 + harassment.length * 0.2),
      reason: 'Personal attack rather than disagreement with the content.',
    };
  }

  const scam = scoreTerms(text, SCAM_TERMS);
  const linkSpam = matchesAny(text, LINK_SPAM_PATTERNS);
  if (scam.total >= 2.5 || linkSpam.length >= 2) {
    return { action: 'REMOVE', label: 'scam', score: 0.88, reason: 'Solicitation or fraudulent religious claim.' };
  }
  if (scam.total >= 1.2 || linkSpam.length === 1) {
    return { action: 'HOLD', label: 'scam', score: 0.6, reason: 'Possible solicitation; held for creator review.' };
  }

  const spam = matchesAny(text, SPAM_PATTERNS);
  const linkCount = (text.match(/https?:\/\//g) ?? []).length;
  const shouting = body.length > 24 && body.replace(/[^A-Z]/g, '').length / body.length > 0.7;
  const spamScore = clamp01(saturate(spam.length * 1.2 + Math.max(0, linkCount - 1) * 0.8 + (shouting ? 0.5 : 0), 2));
  if (spamScore >= 0.7) {
    return { action: 'REMOVE', label: 'spam', score: spamScore, reason: 'Spam pattern.' };
  }
  if (spamScore >= 0.45) {
    return { action: 'HOLD', label: 'spam', score: spamScore, reason: 'Possible spam; held for review.' };
  }

  return { action: 'ALLOW', label: null, score: spamScore, reason: 'No policy signals detected.' };
}
