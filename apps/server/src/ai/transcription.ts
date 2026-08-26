import fs from 'node:fs/promises';
import type { TranscriptCue } from '@faithtube/shared';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import type { TranscriptionProvider, TranscriptionResult } from './types.js';

const log = logger('transcription');

/**
 * Used when no speech-to-text service is configured. It does not invent a
 * transcript: it returns whatever real text the creator supplied (uploaded
 * captions, or description) and marks the result `automated: false`, which the
 * classifier reads as "evidence is missing" rather than "nothing was said".
 */
class MetadataTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'metadata-fallback';
  readonly available = true;

  async transcribe(input: { fallbackText: string }): Promise<TranscriptionResult> {
    const text = input.fallbackText.trim();
    return {
      cues: text ? [{ startSeconds: 0, endSeconds: 0, text }] : [],
      text,
      language: 'en',
      provider: this.name,
      automated: false,
    };
  }
}

/** Whisper-compatible HTTP transcription (OpenAI Whisper, faster-whisper server, etc.). */
class WhisperTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'whisper';
  readonly available = Boolean(env.WHISPER_API_URL && env.WHISPER_API_KEY);

  async transcribe(input: { audioPath: string | null; fallbackText: string }): Promise<TranscriptionResult> {
    if (!this.available || !input.audioPath) {
      return new MetadataTranscriptionProvider().transcribe(input);
    }
    try {
      const audio = await fs.readFile(input.audioPath);
      const form = new FormData();
      form.append('file', new Blob([audio]), 'audio.m4a');
      form.append('model', env.WHISPER_MODEL);
      form.append('response_format', 'verbose_json');

      const res = await fetch(env.WHISPER_API_URL!, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.WHISPER_API_KEY}` },
        body: form,
      });
      if (!res.ok) throw new Error(`Transcription failed (${res.status})`);

      const data = (await res.json()) as {
        text?: string;
        language?: string;
        segments?: Array<{ start: number; end: number; text: string }>;
      };
      const cues: TranscriptCue[] = (data.segments ?? []).map((seg) => ({
        startSeconds: Math.round(seg.start),
        endSeconds: Math.round(seg.end),
        text: seg.text.trim(),
      }));
      return {
        cues,
        text: data.text ?? cues.map((c) => c.text).join(' '),
        language: data.language ?? 'en',
        provider: this.name,
        automated: true,
      };
    } catch (err) {
      log.warn('Whisper transcription failed; falling back to supplied text', err);
      return new MetadataTranscriptionProvider().transcribe(input);
    }
  }
}

export function transcriptionProvider(): TranscriptionProvider {
  const whisper = new WhisperTranscriptionProvider();
  if (env.TRANSCRIPTION_PROVIDER === 'none') return new MetadataTranscriptionProvider();
  if (env.TRANSCRIPTION_PROVIDER === 'whisper') return whisper;
  return whisper.available ? whisper : new MetadataTranscriptionProvider();
}

/** Splits a long unsegmented transcript into readable cues for the watch page. */
export function synthesiseCues(text: string, durationSeconds: number): TranscriptCue[] {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [];
  if (!sentences.length || durationSeconds <= 0) return [];
  const totalChars = text.length || 1;
  const cues: TranscriptCue[] = [];
  let elapsed = 0;
  let buffer = '';
  for (const sentence of sentences) {
    buffer += sentence;
    if (buffer.length < 220) continue;
    const span = (buffer.length / totalChars) * durationSeconds;
    cues.push({
      startSeconds: Math.round(elapsed),
      endSeconds: Math.round(elapsed + span),
      text: buffer.trim(),
    });
    elapsed += span;
    buffer = '';
  }
  if (buffer.trim()) {
    cues.push({ startSeconds: Math.round(elapsed), endSeconds: Math.round(durationSeconds), text: buffer.trim() });
  }
  return cues;
}
