import {
  categoryBySlug,
  extractScriptureReferences,
  REJECTION_MESSAGES,
  type ModerationFinding,
  type ModerationResult,
  type ModerationScores,
  type RejectionReason,
} from '@faithtube/shared';
import {
  ANTI_CHRISTIAN_MARKERS,
  APOLOGETIC_FRAMING,
  CHRISTIAN_TERMS,
  COPYRIGHT_MARKERS,
  DANGEROUS_TERMS,
  EVASION_PATTERNS,
  HATE_TERMS,
  MISLEADING_TERMS,
  NON_CHRISTIAN_MARKERS,
  SCAM_TERMS,
  SENSITIVE_TOPIC_TERMS,
  SENSITIVE_TOPIC_WARNINGS,
  SEXUAL_TERMS,
  SPAM_PATTERNS,
  VIOLENCE_TERMS,
} from './lexicon.js';
import { clamp01, containsAny, matchesAny, round2, saturate, scoreTerms, speechDensity } from './textAnalysis.js';
import type { ModerationInput, ModerationProvider } from './types.js';

/** Decision thresholds. Tuned so that ambiguity routes to a human, never to auto-reject. */
const THRESHOLDS = {
  approveRelevance: 0.62,
  reviewRelevance: 0.34,
  rejectRelevance: 0.18,
  safeSafety: 0.85,
  reviewSafety: 0.6,
  highRisk: 0.62,
  severeRisk: 0.8,
  restrictSensitivity: 0.45,
};

/**
 * The on-device classifier.
 *
 * Its job is not to adjudicate theology — it deliberately has no notion of
 * denomination, and nothing in the lexicon distinguishes one Christian tradition
 * from another. It answers two narrower questions: does this upload look
 * Christ-centred, and is it safe? Anything it cannot answer confidently is sent
 * to a human moderator.
 */
export class HeuristicModerator implements ModerationProvider {
  readonly name = 'heuristic-v1';

  async classify(input: ModerationInput): Promise<ModerationResult> {
    return classifyHeuristically(input);
  }
}

export function classifyHeuristically(input: ModerationInput): ModerationResult {
  const findings: ModerationFinding[] = [];

  const metadataText = [input.title, input.description, input.tags.join(' ')].join('\n');
  const thumbnailText = (input.thumbnailSignals ?? []).join(' ');
  const frameText = (input.frameSignals ?? []).join(' ');
  const fullText = [metadataText, input.transcript, thumbnailText, frameText].join('\n');
  const wordCount = input.transcript.trim() ? input.transcript.trim().split(/\s+/).length : 0;

  // ---------------------------------------------------------------- relevance
  const christian = scoreTerms(fullText, CHRISTIAN_TERMS);
  const christianInMetadata = scoreTerms(metadataText, CHRISTIAN_TERMS);
  const scriptureRefs = extractScriptureReferences(fullText);
  const category = categoryBySlug(input.categorySlug);
  const categoryHits = category ? containsAny(fullText, category.keywords) : [];

  // Long transcripts naturally accumulate hits; normalise by length so a
  // ten-minute sermon and a ninety-minute service score comparably.
  const lengthFactor = Math.max(1, Math.sqrt(Math.max(wordCount, 120) / 400));
  const normalizedChristian = christian.total / lengthFactor;

  let relevanceRaw = normalizedChristian;
  relevanceRaw += Math.min(scriptureRefs.length, 8) * 1.4;
  relevanceRaw += Math.min(categoryHits.length, 5) * 1.1;
  // Metadata alone is easy to game, so it contributes but cannot carry a video.
  relevanceRaw += Math.min(christianInMetadata.total, 9) * 0.35;
  if (input.channel.verifiedChristianCreator) relevanceRaw += 2.2;

  const antiChristian = scoreTerms(fullText, ANTI_CHRISTIAN_MARKERS);
  const apologetics = containsAny(fullText, APOLOGETIC_FRAMING);
  // Apologetics legitimately quotes objections; discount those hits heavily.
  const antiPenalty = apologetics.length > 0 ? antiChristian.total * 0.25 : antiChristian.total * 1.4;

  const nonChristian = scoreTerms(fullText, NON_CHRISTIAN_MARKERS);
  relevanceRaw -= antiPenalty + nonChristian.total * 0.9;

  let christianRelevance = clamp01(saturate(Math.max(relevanceRaw, 0), 7.5));

  // A video with no usable text at all cannot be assessed automatically.
  const hasUsableText = wordCount >= 25 || christianInMetadata.total >= 2;
  if (!hasUsableText) {
    christianRelevance = Math.min(christianRelevance, 0.4);
    findings.push({
      signal: 'christianRelevance',
      severity: 'medium',
      detail:
        'Too little usable text (no transcript and sparse metadata) to assess content automatically. Human review required.',
    });
  }

  // Music-heavy worship uploads legitimately have low speech density.
  const density = speechDensity(wordCount, input.durationSeconds);
  const musicCategory = ['worship', 'christian-music'].includes(input.categorySlug);
  if (density > 0 && density < 25 && !musicCategory && input.durationSeconds > 180) {
    findings.push({
      signal: 'christianRelevance',
      severity: 'low',
      detail: `Low speech density (${density.toFixed(0)} words/min) for a talk-based category.`,
    });
  }

  if (christian.hits.length) {
    findings.push({
      signal: 'christianRelevance',
      severity: 'info',
      detail: `Christian markers: ${christian.hits
        .sort((a, b) => b.weight * b.count - a.weight * a.count)
        .slice(0, 8)
        .map((h) => `${h.term}×${h.count}`)
        .join(', ')}.`,
    });
  }
  if (scriptureRefs.length) {
    findings.push({
      signal: 'christianRelevance',
      severity: 'info',
      detail: `Scripture references detected: ${scriptureRefs.slice(0, 6).map((r) => r.raw).join('; ')}.`,
    });
  }
  if (nonChristian.hits.length) {
    findings.push({
      signal: 'christianRelevance',
      severity: nonChristian.total > 3 ? 'high' : 'medium',
      detail: `Non-Christian content markers: ${nonChristian.hits.map((h) => h.term).join(', ')}.`,
    });
  }
  if (antiChristian.hits.length) {
    findings.push({
      signal: 'christianRelevance',
      severity: apologetics.length ? 'low' : 'high',
      detail: apologetics.length
        ? `Objections to the faith present, but framed apologetically (${apologetics.slice(0, 3).join(', ')}).`
        : `Content appears to attack the Christian faith: ${antiChristian.hits.map((h) => h.term).join(', ')}.`,
    });
  }

  // ------------------------------------------------------------------ safety
  const sexual = scoreTerms(fullText, SEXUAL_TERMS);
  const violence = scoreTerms(fullText, VIOLENCE_TERMS);
  const hate = scoreTerms(fullText, HATE_TERMS);
  const dangerous = scoreTerms(fullText, DANGEROUS_TERMS);
  const scam = scoreTerms(fullText, SCAM_TERMS);
  const copyright = scoreTerms(fullText, COPYRIGHT_MARKERS);
  const misleading = scoreTerms(fullText, MISLEADING_TERMS);
  const sensitive = scoreTerms(fullText, SENSITIVE_TOPIC_TERMS);
  const spamMatches = matchesAny(metadataText, SPAM_PATTERNS);
  const evasionMatches = matchesAny(fullText, EVASION_PATTERNS);

  const sexualContentRisk = clamp01(saturate(sexual.total, 3.2));
  const violenceRisk = clamp01(saturate(violence.total, 3.6));
  const hateRisk = clamp01(saturate(hate.total, 3.0));
  const dangerRisk = clamp01(saturate(dangerous.total, 3.0));
  const scamRisk = clamp01(saturate(scam.total, 3.4));
  const copyrightRisk = clamp01(saturate(copyright.total, 4.5));
  const misleadingClaimsRisk = clamp01(saturate(misleading.total, 4.0));
  const evasionRisk = clamp01(evasionMatches.length * 0.45);
  const sensitivity = clamp01(saturate(sensitive.total, 4.0));

  const tagCount = input.tags.length;
  const spamRaw = spamMatches.length * 0.3 + (tagCount > 25 ? 0.25 : 0) + duplicateTitleWordPenalty(input.title);
  const spamRisk = clamp01(spamRaw);

  const riskEntries: Array<[string, number, ModerationFinding['signal'], RejectionReason]> = [
    ['Sexual content', sexualContentRisk, 'sexualContentRisk', 'SEXUAL_CONTENT'],
    ['Graphic violence', violenceRisk, 'violenceRisk', 'VIOLENCE'],
    ['Hate or harassment', hateRisk, 'hateRisk', 'HATE_OR_HARASSMENT'],
    ['Dangerous content', dangerRisk, 'safety', 'DANGEROUS_CONTENT'],
    ['Scam or fraudulent religious claims', scamRisk, 'scamRisk', 'SCAM_OR_FRAUD'],
    ['Copyright risk', copyrightRisk, 'copyrightRisk', 'COPYRIGHT_RISK'],
    ['Misleading claims', misleadingClaimsRisk, 'misleadingClaimsRisk', 'MISLEADING_CLAIMS'],
    ['Spam', spamRisk, 'spamRisk', 'SPAM'],
    ['Moderation evasion', evasionRisk, 'evasionRisk', 'MODERATION_EVASION'],
  ];

  for (const [label, value, signal] of riskEntries) {
    if (value >= 0.35) {
      findings.push({
        signal,
        severity: value >= THRESHOLDS.severeRisk ? 'high' : value >= THRESHOLDS.highRisk ? 'medium' : 'low',
        detail: `${label} risk at ${(value * 100).toFixed(0)}%.`,
      });
    }
  }
  if (evasionMatches.length) {
    findings.push({
      signal: 'evasionRisk',
      severity: 'high',
      detail: `Upload text contains instructions aimed at the review system (${evasionMatches.length} pattern${
        evasionMatches.length === 1 ? '' : 's'
      }).`,
    });
  }

  const worstRisk = Math.max(
    sexualContentRisk,
    violenceRisk,
    hateRisk,
    dangerRisk,
    scamRisk,
    misleadingClaimsRisk,
    evasionRisk,
  );
  const safety = clamp01(1 - worstRisk);

  // Family suitability drops for sensitive topics even when they are entirely
  // appropriate Christian teaching — that is what the age gate exists for.
  const familySuitability = clamp01(
    1 - Math.max(sensitivity * 0.75, sexualContentRisk, violenceRisk * 0.9, dangerRisk * 0.8),
  );

  const contentWarnings = Object.entries(SENSITIVE_TOPIC_WARNINGS)
    .filter(([term]) => sensitive.hits.some((hit) => hit.term === term))
    .map(([, warning]) => warning);
  const uniqueWarnings = [...new Set(contentWarnings)];

  const scores: ModerationScores = {
    christianRelevance: round2(christianRelevance),
    safety: round2(safety),
    familySuitability: round2(familySuitability),
    spamRisk: round2(spamRisk),
    hateRisk: round2(hateRisk),
    sexualContentRisk: round2(sexualContentRisk),
    violenceRisk: round2(violenceRisk),
    scamRisk: round2(scamRisk),
    copyrightRisk: round2(copyrightRisk),
    misleadingClaimsRisk: round2(misleadingClaimsRisk),
    evasionRisk: round2(evasionRisk),
  };

  // ---------------------------------------------------------------- decision
  const trust = channelTrust(input);
  const decision = decide({ scores, sensitivity, trust, hasUsableText });

  const rejectionReason = decision.decision === 'REJECTED' ? decision.reason : null;
  const creatorMessage = rejectionReason
    ? REJECTION_MESSAGES[rejectionReason]
    : decision.decision === 'HUMAN_REVIEW'
      ? 'Your video is queued for a human moderator. This usually happens when our automated review could not confidently confirm the content, and it is not a judgement against you.'
      : decision.decision === 'RESTRICTED'
        ? 'Your video is approved with an age restriction because of the sensitive topics it covers. Viewers will see a content notice before it plays.'
        : 'Your video passed review and is ready to publish.';

  return {
    decision: decision.decision,
    scores,
    confidence: round2(decision.confidence),
    findings,
    internalNotes: decision.notes,
    creatorMessage,
    provider: 'heuristic-v1',
    ageRestricted: decision.decision === 'RESTRICTED' || sensitivity >= THRESHOLDS.restrictSensitivity,
    contentWarnings: uniqueWarnings,
  };
}

/** Repeated words in a title are a classic keyword-stuffing signal. */
function duplicateTitleWordPenalty(title: string): number {
  const words = title.toLowerCase().match(/[a-z']{3,}/g) ?? [];
  if (words.length < 6) return 0;
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  const maxRepeat = Math.max(...counts.values());
  return maxRepeat >= 4 ? 0.35 : maxRepeat === 3 ? 0.15 : 0;
}

/**
 * A track record shifts borderline calls. A channel with many approvals gets a
 * little benefit of the doubt; recent rejections and strikes remove it.
 * Trust never rescues a video that trips a severe safety signal.
 */
export function channelTrust(input: ModerationInput): number {
  const { approvedVideoCount, rejectedVideoCount, strikeCount, verifiedChristianCreator } = input.channel;
  const base = Math.min(approvedVideoCount / 25, 1) * 0.5;
  const penalty = Math.min(rejectedVideoCount * 0.12 + strikeCount * 0.25, 0.9);
  const verifiedBonus = verifiedChristianCreator ? 0.25 : 0;
  return clamp01(0.35 + base + verifiedBonus - penalty);
}

interface DecisionInput {
  scores: ModerationScores;
  sensitivity: number;
  trust: number;
  hasUsableText: boolean;
}

interface DecisionOutput {
  decision: ModerationResult['decision'];
  confidence: number;
  notes: string;
  reason: RejectionReason;
}

export function decide({ scores, sensitivity, trust, hasUsableText }: DecisionInput): DecisionOutput {
  const notes: string[] = [];

  // 1. Severe safety violations reject regardless of Christian relevance.
  const severe: Array<[RejectionReason, number, string]> = [
    ['SEXUAL_CONTENT', scores.sexualContentRisk, 'sexual content'],
    ['HATE_OR_HARASSMENT', scores.hateRisk, 'hate or harassment'],
    ['VIOLENCE', scores.violenceRisk, 'graphic violence'],
    ['SCAM_OR_FRAUD', scores.scamRisk, 'scam or fraudulent religious claims'],
    ['MODERATION_EVASION', scores.evasionRisk, 'moderation evasion'],
    ['MISLEADING_CLAIMS', scores.misleadingClaimsRisk, 'seriously misleading claims'],
  ];
  for (const [reason, value, label] of severe) {
    if (value >= THRESHOLDS.severeRisk) {
      notes.push(`Auto-rejected: ${label} scored ${(value * 100).toFixed(0)}%.`);
      return { decision: 'REJECTED', confidence: 0.9, notes: notes.join(' '), reason };
    }
    if (value >= THRESHOLDS.highRisk) {
      notes.push(`Elevated ${label} risk (${(value * 100).toFixed(0)}%) — routed to a human moderator.`);
      return { decision: 'HUMAN_REVIEW', confidence: 0.55, notes: notes.join(' '), reason };
    }
  }

  if (scores.spamRisk >= 0.7) {
    notes.push('Spam indicators dominate the metadata.');
    return { decision: 'REJECTED', confidence: 0.78, notes: notes.join(' '), reason: 'SPAM' };
  }
  if (scores.copyrightRisk >= 0.7) {
    notes.push('Strong copyright-risk indicators; a human should confirm rights.');
    return { decision: 'HUMAN_REVIEW', confidence: 0.6, notes: notes.join(' '), reason: 'COPYRIGHT_RISK' };
  }

  // 2. Christian-content requirement.
  const relevance = scores.christianRelevance;
  const trustAdjusted = clamp01(relevance + (trust - 0.5) * 0.12);

  if (relevance < THRESHOLDS.rejectRelevance && hasUsableText) {
    notes.push(
      `Christian relevance ${(relevance * 100).toFixed(0)}% is below the platform minimum with sufficient text to judge.`,
    );
    return { decision: 'REJECTED', confidence: 0.82, notes: notes.join(' '), reason: 'NOT_CHRISTIAN_CONTENT' };
  }
  if (trustAdjusted < THRESHOLDS.approveRelevance) {
    notes.push(
      `Christian relevance ${(relevance * 100).toFixed(0)}% (trust-adjusted ${(trustAdjusted * 100).toFixed(
        0,
      )}%) is inconclusive.`,
    );
    if (!hasUsableText) notes.push('No transcript was available.');
    return { decision: 'HUMAN_REVIEW', confidence: 0.5, notes: notes.join(' '), reason: 'NOT_CHRISTIAN_CONTENT' };
  }

  // 3. Christian and safe, but heavy — restrict rather than reject.
  if (sensitivity >= THRESHOLDS.restrictSensitivity || scores.familySuitability < 0.5) {
    notes.push('Christian content covering sensitive topics; age restriction applied.');
    return { decision: 'RESTRICTED', confidence: 0.72, notes: notes.join(' '), reason: 'OTHER' };
  }

  if (scores.safety < THRESHOLDS.reviewSafety) {
    notes.push(`Safety score ${(scores.safety * 100).toFixed(0)}% warrants a second look.`);
    return { decision: 'HUMAN_REVIEW', confidence: 0.52, notes: notes.join(' '), reason: 'OTHER' };
  }

  notes.push(
    `Approved: relevance ${(relevance * 100).toFixed(0)}%, safety ${(scores.safety * 100).toFixed(
      0,
    )}%, family suitability ${(scores.familySuitability * 100).toFixed(0)}%.`,
  );
  const confidence = clamp01(0.6 + (trustAdjusted - THRESHOLDS.approveRelevance) + scores.safety * 0.2);
  return { decision: 'APPROVED', confidence, notes: notes.join(' '), reason: 'OTHER' };
}
