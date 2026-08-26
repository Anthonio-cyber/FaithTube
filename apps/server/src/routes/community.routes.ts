import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { handler } from '../lib/async.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { attachAuth, auth, requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { parseJson, stringifyJson } from '../lib/json.js';

export const communityRouter = Router();

interface PollOption {
  id: string;
  label: string;
  votes: number;
}

communityRouter.get(
  '/:channelHandle',
  attachAuth,
  handler(async (req, res) => {
    const handle = req.params.channelHandle.replace(/^@/, '').toLowerCase();
    const channel = await prisma.channel.findFirst({ where: { OR: [{ handle }, { id: req.params.channelHandle }] } });
    if (!channel) throw notFound('That channel is not available.');

    const posts = await prisma.communityPost.findMany({
      where: { channelId: channel.id, status: 'VISIBLE' },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    const myVotes = req.auth
      ? new Map(
          (
            await prisma.communityPollVote.findMany({
              where: { userId: req.auth.userId, postId: { in: posts.map((p) => p.id) } },
              select: { postId: true, optionId: true },
            })
          ).map((vote) => [vote.postId, vote.optionId]),
        )
      : new Map<string, string>();

    res.json({
      items: posts.map((post) => {
        const options = parseJson<PollOption[]>(post.pollOptions, []);
        const totalVotes = options.reduce((sum, option) => sum + option.votes, 0);
        return {
          id: post.id,
          type: post.type,
          body: post.body,
          imageUrl: post.imageUrl,
          scriptureRef: post.scriptureRef,
          likeCount: post.likeCount,
          createdAt: post.createdAt.toISOString(),
          poll: options.length
            ? {
                options: options.map((option) => ({
                  ...option,
                  percent: totalVotes ? Math.round((option.votes / totalVotes) * 100) : 0,
                })),
                totalVotes,
                myVote: myVotes.get(post.id) ?? null,
              }
            : null,
        };
      }),
      channel: { id: channel.id, name: channel.name, handle: channel.handle, avatarUrl: channel.avatarUrl },
    });
  }),
);

communityRouter.post(
  '/:postId/vote',
  requireAuth,
  writeLimiter,
  validateBody(z.object({ optionId: z.string() })),
  handler(async (req, res) => {
    const context = auth(req);
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.postId } });
    if (!post) throw notFound('No such post.');

    const options = parseJson<PollOption[]>(post.pollOptions, []);
    if (!options.length) throw badRequest('That post is not a poll.');

    const optionId = (req.body as { optionId: string }).optionId;
    const chosen = options.find((option) => option.id === optionId);
    if (!chosen) throw badRequest('That is not one of the options.');

    const existing = await prisma.communityPollVote.findUnique({
      where: { postId_userId: { postId: post.id, userId: context.userId } },
    });

    if (existing) {
      if (existing.optionId === optionId) return res.json({ ok: true, unchanged: true });
      // Moving a vote decrements the previous option, so totals stay correct.
      const previous = options.find((option) => option.id === existing.optionId);
      if (previous) previous.votes = Math.max(0, previous.votes - 1);
      chosen.votes += 1;
      await prisma.communityPollVote.update({ where: { id: existing.id }, data: { optionId } });
    } else {
      chosen.votes += 1;
      await prisma.communityPollVote.create({ data: { postId: post.id, userId: context.userId, optionId } });
    }

    await prisma.communityPost.update({ where: { id: post.id }, data: { pollOptions: stringifyJson(options) } });
    const totalVotes = options.reduce((sum, option) => sum + option.votes, 0);
    res.json({
      ok: true,
      options: options.map((option) => ({
        ...option,
        percent: totalVotes ? Math.round((option.votes / totalVotes) * 100) : 0,
      })),
      totalVotes,
    });
  }),
);

communityRouter.post(
  '/:postId/like',
  requireAuth,
  writeLimiter,
  handler(async (req, res) => {
    const post = await prisma.communityPost.update({
      where: { id: req.params.postId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    res.json(post);
  }),
);

communityRouter.delete(
  '/:postId',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const post = await prisma.communityPost.findUnique({
      where: { id: req.params.postId },
      include: { channel: true },
    });
    if (!post) throw notFound('No such post.');
    const isStaff = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(context.role);
    if (post.channel.ownerId !== context.userId && !isStaff) throw forbidden();

    await prisma.communityPost.delete({ where: { id: post.id } });
    res.json({ ok: true });
  }),
);
