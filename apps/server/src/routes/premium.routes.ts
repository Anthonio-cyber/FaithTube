import { Router, raw } from 'express';
import { z } from 'zod';
import { formatPrice } from '@faithtube/shared';
import { prisma } from '../db/client.js';
import { handler } from '../lib/async.js';
import { badRequest, notConfigured, notFound } from '../lib/errors.js';
import { attachAuth, auth, requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import {
  cancelSubscription,
  createBillingPortalSession,
  createCheckoutSession,
  currentPlan,
  stripeConfigured,
  verifyWebhookSignature,
} from '../services/stripe.service.js';
import { notify } from '../services/notification.service.js';
import { recordAudit } from '../services/audit.service.js';
import { logger } from '../lib/logger.js';

const log = logger('premium');
export const premiumRouter = Router();

premiumRouter.get(
  '/plan',
  attachAuth,
  handler(async (req, res) => {
    const plan = await currentPlan();
    const subscription = req.auth
      ? await prisma.premiumSubscription.findUnique({ where: { userId: req.auth.userId } })
      : null;

    res.json({
      plan: { ...plan, displayPrice: formatPrice(plan.amountMinor, plan.currency) },
      checkoutAvailable: stripeConfigured(),
      // The UI shows a clear "payments not configured" state rather than a
      // button that silently does nothing.
      checkoutUnavailableReason: stripeConfigured()
        ? null
        : 'Card payments are not configured on this deployment yet. An administrator can enable them by setting STRIPE_SECRET_KEY.',
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            provider: subscription.provider,
          }
        : null,
    });
  }),
);

premiumRouter.post(
  '/checkout',
  requireAuth,
  writeLimiter,
  handler(async (req, res) => {
    const context = auth(req);
    if (!stripeConfigured()) {
      throw notConfigured(
        'Premium checkout',
        'Set STRIPE_SECRET_KEY (and optionally STRIPE_PRICE_ID) on the API, add STRIPE_WEBHOOK_SECRET, ' +
          'and point a Stripe webhook at POST /api/premium/webhook.',
      );
    }

    const existing = await prisma.premiumSubscription.findUnique({ where: { userId: context.userId } });
    if (existing && ['ACTIVE', 'TRIALING', 'COMPLIMENTARY'].includes(existing.status)) {
      throw badRequest('You already have Premium.');
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: context.userId }, select: { email: true } });
    const session = await createCheckoutSession(context.userId, user.email);
    res.json({ url: session.url });
  }),
);

premiumRouter.post(
  '/portal',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const subscription = await prisma.premiumSubscription.findUnique({ where: { userId: context.userId } });
    if (!subscription?.providerCustomerId) throw notFound('No billing account found for you.');
    res.json({ url: await createBillingPortalSession(subscription.providerCustomerId) });
  }),
);

premiumRouter.post(
  '/cancel',
  requireAuth,
  writeLimiter,
  validateBody(z.object({ immediate: z.boolean().default(false) })),
  handler(async (req, res) => {
    const context = auth(req);
    const subscription = await prisma.premiumSubscription.findUnique({ where: { userId: context.userId } });
    if (!subscription) throw notFound('You do not have a Premium subscription.');

    const immediate = (req.body as { immediate: boolean }).immediate;
    if (subscription.providerSubscriptionId && subscription.provider === 'stripe') {
      await cancelSubscription(subscription.providerSubscriptionId, !immediate);
    }

    await prisma.premiumSubscription.update({
      where: { id: subscription.id },
      data: immediate
        ? { status: 'CANCELED', canceledAt: new Date() }
        : { cancelAtPeriodEnd: true },
    });

    await recordAudit({ action: 'premium.cancel', targetType: 'USER', targetId: context.userId, summary: immediate ? 'Cancelled immediately' : 'Cancels at period end', req });
    res.json({
      ok: true,
      message: immediate
        ? 'Your Premium subscription has ended.'
        : 'Your Premium subscription will end at the close of the current billing period.',
    });
  }),
);

/**
 * Stripe webhook. Mounted with a raw body parser so the signature can be
 * verified against the exact bytes Stripe signed.
 */
premiumRouter.post(
  '/webhook',
  raw({ type: 'application/json' }),
  handler(async (req, res) => {
    const payload = req.body as Buffer;
    if (!verifyWebhookSignature(payload, req.headers['stripe-signature'] as string | undefined)) {
      return res.status(400).json({ error: 'invalid_signature', message: 'Webhook signature verification failed.' });
    }

    const event = JSON.parse(payload.toString('utf8')) as {
      type: string;
      data: { object: Record<string, unknown> };
    };
    const object = event.data.object;

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const userId = (object.metadata as Record<string, string> | undefined)?.userId;
          if (!userId) break;
          await prisma.premiumSubscription.upsert({
            where: { userId },
            create: {
              userId,
              status: 'ACTIVE',
              provider: 'stripe',
              providerCustomerId: String(object.customer ?? ''),
              providerSubscriptionId: object.subscription ? String(object.subscription) : null,
            },
            update: {
              status: 'ACTIVE',
              providerCustomerId: String(object.customer ?? ''),
              providerSubscriptionId: object.subscription ? String(object.subscription) : null,
              canceledAt: null,
              cancelAtPeriodEnd: false,
            },
          });
          const plan = await currentPlan();
          await prisma.payment.create({
            data: {
              userId,
              provider: 'stripe',
              providerPaymentId: String(object.id),
              amountMinor: Number(object.amount_total ?? plan.amountMinor),
              currency: String(object.currency ?? plan.currency).toUpperCase(),
              status: 'SUCCEEDED',
              purpose: 'premium',
              description: 'FaithTube Premium subscription',
            },
          });
          await notify({
            userId,
            type: 'PREMIUM',
            title: 'Welcome to Premium',
            body: 'Ad-free viewing, offline downloads, background playback and premium Bible study are now unlocked.',
            linkUrl: '/premium',
          });
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscriptionId = String(object.id);
          const status = String(object.status);
          const mapped =
            event.type === 'customer.subscription.deleted'
              ? 'CANCELED'
              : status === 'active'
                ? 'ACTIVE'
                : status === 'trialing'
                  ? 'TRIALING'
                  : status === 'past_due' || status === 'unpaid'
                    ? 'PAST_DUE'
                    : 'CANCELED';
          await prisma.premiumSubscription.updateMany({
            where: { providerSubscriptionId: subscriptionId },
            data: {
              status: mapped,
              cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
              currentPeriodEnd: object.current_period_end
                ? new Date(Number(object.current_period_end) * 1000)
                : undefined,
              canceledAt: mapped === 'CANCELED' ? new Date() : null,
            },
          });
          break;
        }

        case 'invoice.payment_failed': {
          const customerId = String(object.customer ?? '');
          const subscription = await prisma.premiumSubscription.findFirst({ where: { providerCustomerId: customerId } });
          if (subscription) {
            await prisma.premiumSubscription.update({ where: { id: subscription.id }, data: { status: 'PAST_DUE' } });
            await notify({
              userId: subscription.userId,
              type: 'PREMIUM',
              title: 'We could not take your Premium payment',
              body: 'Please update your payment details to keep your Premium features.',
              linkUrl: '/settings/billing',
            });
          }
          break;
        }

        default:
          log.debug(`Unhandled Stripe event ${event.type}`);
      }
    } catch (err) {
      log.error(`Failed to process Stripe event ${event.type}`, err);
      // 500 makes Stripe retry, which is what we want for a transient failure.
      return res.status(500).json({ error: 'processing_failed' });
    }

    res.json({ received: true });
  }),
);
