import { z } from 'zod';

/**
 * A boolean that survives the wire.
 *
 * Query strings and multipart form fields arrive as text, and `z.coerce.boolean()`
 * applies JavaScript truthiness to them — so the string "false" parses as true
 * and any flag the client explicitly turned off comes back on. This parses the
 * spellings clients actually send.
 */
function parseBooleanish(value: unknown, ctx: z.RefinementCtx): boolean | typeof z.NEVER {
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Expected a boolean, received "${String(value)}"` });
  return z.NEVER;
}

export const booleanish = (defaultValue: boolean) =>
  z.union([z.boolean(), z.string()]).default(defaultValue).transform(parseBooleanish);

export const optionalBooleanish = () =>
  z.union([z.boolean(), z.string()]).optional().transform((value, ctx) => {
    if (value === undefined) return undefined;
    return parseBooleanish(value, ctx);
  });
