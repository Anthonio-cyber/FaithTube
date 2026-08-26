import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const log = logger('anthropic');

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeRequest {
  system?: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export function anthropicConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

/**
 * Thin Messages API client. Kept dependency-free so the server has no vendor SDK
 * in its runtime tree; the request shape is the documented public contract.
 */
export async function callClaude(request: ClaudeRequest): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');

  const res = await fetch(`${env.ANTHROPIC_BASE_URL.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: request.model ?? env.ANTHROPIC_MODEL,
      max_tokens: request.maxTokens ?? 1500,
      temperature: request.temperature ?? 0,
      system: request.system,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    log.error(`Claude request failed (${res.status})`, detail.slice(0, 500));
    throw new Error(`Claude API error ${res.status}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return (data.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')
    .trim();
}

/** Pulls the first JSON object out of a model response, tolerating prose or fences. */
export function extractJson<T>(raw: string): T | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
