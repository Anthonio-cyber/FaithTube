import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { anthropicConfigured } from './anthropicClient.js';
import { AnthropicModerator } from './anthropicModerator.js';
import { HeuristicModerator } from './heuristicModerator.js';
import type { ModerationProvider } from './types.js';

const log = logger('ai');

let cached: ModerationProvider | null = null;

/**
 * Provider selection:
 *   MODERATION_PROVIDER=auto (default) — Claude when a key is present, else heuristic
 *   MODERATION_PROVIDER=anthropic      — Claude, required
 *   MODERATION_PROVIDER=heuristic      — always the on-device classifier
 */
export function moderationProvider(): ModerationProvider {
  if (cached) return cached;
  const wantsClaude =
    env.MODERATION_PROVIDER === 'anthropic' || (env.MODERATION_PROVIDER === 'auto' && anthropicConfigured());

  if (wantsClaude && !anthropicConfigured()) {
    log.warn('MODERATION_PROVIDER=anthropic but ANTHROPIC_API_KEY is missing; using the heuristic classifier.');
    cached = new HeuristicModerator();
  } else if (wantsClaude) {
    log.info(`Moderation provider: Claude (${env.ANTHROPIC_MODEL})`);
    cached = new AnthropicModerator();
  } else {
    log.info('Moderation provider: on-device heuristic classifier');
    cached = new HeuristicModerator();
  }
  return cached;
}

export { HeuristicModerator, AnthropicModerator };
export * from './types.js';
