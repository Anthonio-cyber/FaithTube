import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const log = logger('media');

export interface ProbeResult {
  durationSeconds: number;
  width: number;
  height: number;
  bitrateKbps: number | null;
  hasAudio: boolean;
  videoCodec: string | null;
  audioCodec: string | null;
}

export interface RenditionSpec {
  label: string;
  height: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
}

/** Adaptive ladder. The pipeline only produces renditions below the source height. */
export const RENDITION_LADDER: RenditionSpec[] = [
  { label: '144p', height: 144, videoBitrateKbps: 120, audioBitrateKbps: 48 },
  { label: '240p', height: 240, videoBitrateKbps: 300, audioBitrateKbps: 64 },
  { label: '360p', height: 360, videoBitrateKbps: 700, audioBitrateKbps: 96 },
  { label: '480p', height: 480, videoBitrateKbps: 1200, audioBitrateKbps: 128 },
  { label: '720p', height: 720, videoBitrateKbps: 2500, audioBitrateKbps: 128 },
  { label: '1080p', height: 1080, videoBitrateKbps: 4500, audioBitrateKbps: 192 },
  { label: '1440p', height: 1440, videoBitrateKbps: 9000, audioBitrateKbps: 192 },
  { label: '2160p', height: 2160, videoBitrateKbps: 18000, audioBitrateKbps: 256 },
];

let ffmpegAvailable: boolean | null = null;

/** ffmpeg is optional. Without it the platform serves the original file only. */
export async function hasFfmpeg(): Promise<boolean> {
  if (ffmpegAvailable !== null) return ffmpegAvailable;
  if (!env.TRANSCODE_ENABLED) {
    ffmpegAvailable = false;
    return false;
  }
  try {
    await run(env.FFMPEG_PATH, ['-version'], 8000);
    await run(env.FFPROBE_PATH, ['-version'], 8000);
    ffmpegAvailable = true;
    log.info('ffmpeg detected — transcoding, thumbnails and audio extraction are enabled.');
  } catch {
    ffmpegAvailable = false;
    log.warn(
      'ffmpeg/ffprobe not found. Videos will be served as uploaded, with no generated thumbnails, ' +
        'renditions or extracted audio. Install ffmpeg or set FFMPEG_PATH to enable full processing.',
    );
  }
  return ffmpegAvailable;
}

export async function probe(filePath: string): Promise<ProbeResult> {
  if (!(await hasFfmpeg())) {
    const stat = await fs.stat(filePath).catch(() => null);
    return {
      durationSeconds: 0,
      width: 0,
      height: 0,
      bitrateKbps: stat ? Math.round((stat.size * 8) / 1000 / 60) : null,
      hasAudio: false,
      videoCodec: null,
      audioCodec: null,
    };
  }

  const out = await run(
    env.FFPROBE_PATH,
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
    60_000,
  );
  const parsed = JSON.parse(out) as {
    format?: { duration?: string; bit_rate?: string };
    streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number }>;
  };
  const video = parsed.streams?.find((s) => s.codec_type === 'video');
  const audio = parsed.streams?.find((s) => s.codec_type === 'audio');
  return {
    durationSeconds: Math.round(Number(parsed.format?.duration ?? 0)),
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    bitrateKbps: parsed.format?.bit_rate ? Math.round(Number(parsed.format.bit_rate) / 1000) : null,
    hasAudio: Boolean(audio),
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
  };
}

/** Extracts a mono 16 kHz audio track — the shape speech-to-text services expect. */
export async function extractAudio(videoPath: string): Promise<string | null> {
  if (!(await hasFfmpeg())) return null;
  const target = path.join(os.tmpdir(), `ft-audio-${Date.now()}-${Math.random().toString(36).slice(2)}.m4a`);
  try {
    await run(
      env.FFMPEG_PATH,
      ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'aac', '-b:a', '64k', target],
      15 * 60_000,
    );
    return target;
  } catch (err) {
    log.warn('Audio extraction failed', err);
    return null;
  }
}

export async function captureThumbnail(videoPath: string, atSeconds: number, targetPath: string): Promise<boolean> {
  if (!(await hasFfmpeg())) return false;
  try {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await run(
      env.FFMPEG_PATH,
      ['-y', '-ss', String(Math.max(0, atSeconds)), '-i', videoPath, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '3', targetPath],
      120_000,
    );
    return true;
  } catch (err) {
    log.warn('Thumbnail capture failed', err);
    return false;
  }
}

/**
 * Samples evenly spaced frames for visual review. Returns local file paths; the
 * moderation pipeline passes them to a vision model when one is configured and
 * otherwise records only that sampling happened.
 */
export async function sampleFrames(videoPath: string, durationSeconds: number, count = 6): Promise<string[]> {
  if (!(await hasFfmpeg()) || durationSeconds <= 0) return [];
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ft-frames-'));
  const frames: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const at = ((i + 0.5) / count) * durationSeconds;
    const target = path.join(dir, `frame-${i}.jpg`);
    try {
      await run(
        env.FFMPEG_PATH,
        ['-y', '-ss', String(at), '-i', videoPath, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '5', target],
        60_000,
      );
      frames.push(target);
    } catch {
      // A single failed sample is not fatal.
    }
  }
  return frames;
}

export async function transcode(
  videoPath: string,
  spec: RenditionSpec,
  targetPath: string,
): Promise<{ ok: boolean; sizeBytes: number }> {
  if (!(await hasFfmpeg())) return { ok: false, sizeBytes: 0 };
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  try {
    await run(
      env.FFMPEG_PATH,
      [
        '-y', '-i', videoPath,
        '-vf', `scale=-2:${spec.height}`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-maxrate', `${spec.videoBitrateKbps}k`, '-bufsize', `${spec.videoBitrateKbps * 2}k`,
        '-c:a', 'aac', '-b:a', `${spec.audioBitrateKbps}k`,
        '-movflags', '+faststart',
        targetPath,
      ],
      60 * 60_000,
    );
    const stat = await fs.stat(targetPath);
    return { ok: true, sizeBytes: stat.size };
  } catch (err) {
    log.warn(`Transcode to ${spec.label} failed`, err);
    return { ok: false, sizeBytes: 0 };
  }
}

export function laddersFor(sourceHeight: number): RenditionSpec[] {
  if (!sourceHeight) return [];
  return RENDITION_LADDER.filter((spec) => spec.height <= sourceHeight).slice(-4);
}

function run(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} exited with ${code}: ${stderr.slice(-800)}`));
    });
  });
}
