import crypto from 'node:crypto';
import { DEFAULT_PREMIUM_PLAN, type PremiumPlan } from '@faithtube/shared';
import { env } from '../config/env.js';
import { notConfigured } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../db/client.js';
import { parseJson, stringifyJson } from '../lib/json.js';

const log = logger('stripe');
const API = 'https://api.stripe.com/v1';

export function stripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

function assertConfigured() {
  if (!stripeConfigured()) {
    throw notConfigured('Stripe', 'Set STRIPE_SECRET_KEY, STRIPE_PRICE_ID and STRIPE_WEBHOOK_SECRET, then restart the API.');
  }
}

/** Form-encoded POST to the Stripe REST API — no SDK in the runtime tree. */
async function stripeRequest<T>(path: string, params?: Record<string, string>): Promise<T> {
  assertConfigured();
  const res = await fetch(`${API}${path}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const data = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok) {
    log.error(`Stripe ${path} failed`, data.error?.message);
    throw new Error(data.error?.message ?? 'Stripe request failed');
  }
  return data;
}

/** The live plan. Price and features are admin-editable via PlatformSetting. */
export async function currentPlan(): Promise<PremiumPlan> {
  const row = await prisma.platformSetting.findUnique({ where: { key: 'premium.plan' } });
  if (!row) return DEFAULT_PREMIUM_PLAN;
  return { ...DEFAULT_PREMIUM_PLAN, ...parseJson<Partial<PremiumPlan>>(row.value, {}) };
}

export async function updatePlan(patch: Partial<PremiumPlan>): Promise<PremiumPlan> {
  const plan = { ...(await currentPlan()), ...patch };
  await prisma.platformSetting.upsert({
    where: { key: 'premium.plan' },
    create: { key: 'premium.plan', value: stringifyJson(plan) },
    update: { value: stringifyJson(plan) },
  });
  return plan;
}

export interface CheckoutSession {
  url: string;
  sessionId: string;
}

export async function createCheckoutSession(userId: string, email: string): Promise<CheckoutSession> {
  assertConfigured();
  const plan = await currentPlan();

  const params: Record<string, string> = {
    mode: 'subscription',
    success_url: `${env.APP_URL}/premium?checkout=success`,
    cancel_url: `${env.APP_URL}/premium?checkout=cancelled`,
    customer_email: email,
    'metadata[userId]': userId,
    'subscription_data[metadata][userId]': userId,
  };

  if (env.STRIPE_PRICE_ID) {
    params['line_items[0][price]'] = env.STRIPE_PRICE_ID;
    params['line_items[0][quantity]'] = '1';
  } else {
    // Price created inline from the admin-configured plan when no price id is set.
    params['line_items[0][quantity]'] = '1';
    params['line_items[0][price_data][currency]'] = plan.currency.toLowerCase();
    params['line_items[0][price_data][unit_amount]'] = String(plan.amountMinor);
    params['line_items[0][price_data][recurring][interval]'] = plan.interval;
    params['line_items[0][price_data][product_data][name]'] = `FaithTube ${plan.name}`;
  }

  const session = await stripeRequest<{ id: string; url: string }>('/checkout/sessions', params);
  return { url: session.url, sessionId: session.id };
}

export async function createBillingPortalSession(customerId: string): Promise<string> {
  const session = await stripeRequest<{ url: string }>('/billing_portal/sessions', {
    customer: customerId,
    return_url: `${env.APP_URL}/settings/billing`,
  });
  return session.url;
}

export async function cancelSubscription(subscriptionId: string, atPeriodEnd: boolean): Promise<void> {
  if (atPeriodEnd) {
    await stripeRequest(`/subscriptions/${subscriptionId}`, { cancel_at_period_end: 'true' });
  } else {
    assertConfigured();
    await fetch(`${API}/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
  }
}

/**
 * Verifies a Stripe webhook signature (scheme v1, HMAC-SHA256 over
 * "timestamp.payload"). Unsigned or stale events are rejected.
 */
export function verifyWebhookSignature(payload: Buffer, signatureHeader: string | undefined): boolean {
  if (!env.STRIPE_WEBHOOK_SECRET || !signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [key, value] = part.split('=');
      return [key, value];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  // Reject replays older than five minutes.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const expected = crypto
    .createHmac('sha256', env.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${payload.toString('utf8')}`)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
