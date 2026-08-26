import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { booleanish, optionalBooleanish } from '../lib/zod.js';

/**
 * Regression tests for a bug that shipped once: `z.coerce.boolean()` applies
 * JavaScript truthiness, so the string "false" parsed as true. Because upload
 * flags arrive as multipart text, un-ticking "Premium members only" still
 * marked the video Premium-only.
 */
describe('boolean parsing from the wire', () => {
  const schema = z.object({ flag: booleanish(false) });

  it('reads the string "false" as false', () => {
    expect(schema.parse({ flag: 'false' }).flag).toBe(false);
  });

  it('accepts the spellings clients actually send', () => {
    for (const truthy of ['true', 'TRUE', '1', 'yes', 'on', true]) {
      expect(schema.parse({ flag: truthy }).flag, String(truthy)).toBe(true);
    }
    for (const falsy of ['false', 'FALSE', '0', 'no', 'off', '', false]) {
      expect(schema.parse({ flag: falsy }).flag, String(falsy)).toBe(false);
    }
  });

  it('applies the default when the field is absent', () => {
    expect(schema.parse({}).flag).toBe(false);
    expect(z.object({ flag: booleanish(true) }).parse({}).flag).toBe(true);
  });

  it('rejects a value that is not a boolean at all', () => {
    expect(() => schema.parse({ flag: 'maybe' })).toThrow();
  });

  it('leaves an optional flag undefined rather than guessing', () => {
    const optional = z.object({ flag: optionalBooleanish() });
    expect(optional.parse({}).flag).toBeUndefined();
    expect(optional.parse({ flag: 'false' }).flag).toBe(false);
    expect(optional.parse({ flag: 'true' }).flag).toBe(true);
  });

  it('demonstrates the behaviour this replaces', () => {
    // Kept as documentation: this is why the helper exists.
    expect(z.coerce.boolean().parse('false')).toBe(true);
  });
});
