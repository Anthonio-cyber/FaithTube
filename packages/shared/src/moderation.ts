/** Lifecycle of an uploaded video, from bytes on disk to a published page. */
export const VIDEO_STATUSES = [
  'UPLOADING',
  'PROCESSING',
  'AI_ANALYSIS',
  'AWAITING_REVIEW',
  'APPROVED',
  'RESTRICTED',
  'REJECTED',
  'PUBLISHED',
  'SCHEDULED',
  'REMOVED',
] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const MODERATION_DECISIONS = ['APPROVED', 'HUMAN_REVIEW', 'REJECTED', 'RESTRICTED'] as const;
export type ModerationDecision = (typeof MODERATION_DECISIONS)[number];

export const VISIBILITIES = ['PUBLIC', 'UNLISTED', 'PRIVATE', 'SCHEDULED'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** Signals the classifier reports on. Kept stable so the admin UI can render history. */
export const MODERATION_SIGNALS = [
  'christianRelevance',
  'safety',
  'familySuitability',
  'spamRisk',
  'hateRisk',
  'sexualContentRisk',
  'violenceRisk',
  'scamRisk',
  'copyrightRisk',
  'misleadingClaimsRisk',
  'evasionRisk',
] as const;
export type ModerationSignal = (typeof MODERATION_SIGNALS)[number];

export type ModerationScores = Record<ModerationSignal, number>;

export interface ModerationFinding {
  signal: ModerationSignal;
  severity: 'info' | 'low' | 'medium' | 'high';
  /** Shown to moderators only. */
  detail: string;
}

export interface ModerationResult {
  decision: ModerationDecision;
  scores: ModerationScores;
  /** 0..1 — how sure the classifier is about its own decision. */
  confidence: number;
  findings: ModerationFinding[];
  /** Moderator-facing rationale. Never shown verbatim to creators. */
  internalNotes: string;
  /** Creator-facing explanation. Deliberately non-specific about detection methods. */
  creatorMessage: string;
  provider: string;
  model?: string;
  /** True when the video is Christian but needs an age gate or content warning. */
  ageRestricted: boolean;
  contentWarnings: string[];
}

export const REJECTION_REASONS = [
  'NOT_CHRISTIAN_CONTENT',
  'SEXUAL_CONTENT',
  'VIOLENCE',
  'HATE_OR_HARASSMENT',
  'SPAM',
  'SCAM_OR_FRAUD',
  'DANGEROUS_CONTENT',
  'COPYRIGHT_RISK',
  'MISLEADING_CLAIMS',
  'IMPERSONATION',
  'MODERATION_EVASION',
  'OTHER',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

/**
 * Creator-facing copy. Intentionally general: it tells a creator what rule was
 * missed without describing how the classifier reached that conclusion.
 */
export const REJECTION_MESSAGES: Record<RejectionReason, string> = {
  NOT_CHRISTIAN_CONTENT:
    'This video does not appear to be Christ-centred content. FaithTube only hosts videos whose primary purpose is Christian teaching, worship, testimony, evangelism or Christian storytelling.',
  SEXUAL_CONTENT: 'This video contains sexual or suggestive material, which is not permitted on FaithTube.',
  VIOLENCE: 'This video contains graphic or gratuitous violence, which is not permitted on FaithTube.',
  HATE_OR_HARASSMENT:
    'This video contains content that targets or demeans people, which our community guidelines do not allow.',
  SPAM: 'This video was identified as spam or repetitive low-value content.',
  SCAM_OR_FRAUD:
    'This video appears to solicit money or personal details in a way our guidelines do not permit, including fraudulent religious claims.',
  DANGEROUS_CONTENT: 'This video promotes dangerous or illegal activity.',
  COPYRIGHT_RISK: 'This video appears to contain material you may not have the rights to distribute.',
  MISLEADING_CLAIMS: 'This video contains claims that could seriously mislead viewers.',
  IMPERSONATION: 'This video appears to impersonate another person, ministry or organisation.',
  MODERATION_EVASION: 'This upload appears to have been constructed to bypass our review process.',
  OTHER: 'This video does not meet FaithTube’s content requirements.',
};

export const REPORT_REASONS = [
  'NOT_CHRISTIAN_CONTENT',
  'DANGEROUS_CONTENT',
  'SPAM',
  'HARASSMENT',
  'SCAM',
  'COPYRIGHT',
  'SEXUAL_CONTENT',
  'VIOLENCE',
  'MISLEADING',
  'IMPERSONATION',
  'OTHER',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  NOT_CHRISTIAN_CONTENT: 'Not Christian content',
  DANGEROUS_CONTENT: 'Dangerous or harmful',
  SPAM: 'Spam or misleading repetition',
  HARASSMENT: 'Harassment or bullying',
  SCAM: 'Scam or fraud',
  COPYRIGHT: 'Copyright concern',
  SEXUAL_CONTENT: 'Sexual content',
  VIOLENCE: 'Violence',
  MISLEADING: 'Misleading claims',
  IMPERSONATION: 'Impersonation',
  OTHER: 'Something else',
};

export const REPORT_STATUSES = ['OPEN', 'IN_REVIEW', 'ACTIONED', 'DISMISSED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const APPEAL_STATUSES = ['PENDING', 'UPHELD', 'OVERTURNED', 'CHANGES_REQUESTED'] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

/** A creator gets one appeal per moderation decision; this stops appeal loops. */
export const MAX_APPEALS_PER_VIDEO = 1;
