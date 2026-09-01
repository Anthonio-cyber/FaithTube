import { Router } from 'express';
import { z } from 'zod';
import { handler } from '../lib/async.js';
import { searchLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { askAssistant } from '../ai/assistant.js';

export const assistantRouter = Router();

const askSchema = z.object({ question: z.string().min(3).max(500) });

/**
 * Open to signed-out visitors on purpose: someone who has not made an account
 * is exactly the person most likely to arrive with a question. It is rate
 * limited, and the retrieval path costs nothing.
 */
assistantRouter.post(
  '/ask',
  searchLimiter,
  validateBody(askSchema),
  handler(async (req, res) => {
    const { question } = req.body as z.infer<typeof askSchema>;
    res.json(await askAssistant(question));
  }),
);
