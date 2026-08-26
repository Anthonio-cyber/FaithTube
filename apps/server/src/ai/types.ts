import type { ModerationResult, TranscriptCue } from '@faithtube/shared';

/** Everything the classifiers get to look at for one upload. */
export interface ModerationInput {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  categorySlug: string;
  /** Flattened transcript text; empty string when transcription is unavailable. */
  transcript: string;
  transcriptCues?: TranscriptCue[];
  durationSeconds: number;
  /** Text extracted from, or describing, the thumbnail (filename, alt text, OCR when available). */
  thumbnailSignals?: string[];
  /** Sampled frame descriptions when visual analysis is configured. */
  frameSignals?: string[];
  channel: {
    id: string;
    name: string;
    /** Prior approvals raise trust; prior rejections lower it. */
    approvedVideoCount: number;
    rejectedVideoCount: number;
    strikeCount: number;
    verifiedChristianCreator: boolean;
  };
  isShort: boolean;
  isLive: boolean;
}

export interface ModerationProvider {
  readonly name: string;
  readonly model?: string;
  classify(input: ModerationInput): Promise<ModerationResult>;
}

export interface TranscriptionResult {
  cues: TranscriptCue[];
  text: string;
  language: string;
  provider: string;
  /** False when no transcription service is configured and text came from captions/metadata. */
  automated: boolean;
}

export interface TranscriptionProvider {
  readonly name: string;
  readonly available: boolean;
  transcribe(input: { videoId: string; audioPath: string | null; fallbackText: string }): Promise<TranscriptionResult>;
}

export interface CommentModerationVerdict {
  action: 'ALLOW' | 'HOLD' | 'REMOVE';
  label: string | null;
  score: number;
  reason: string;
}
