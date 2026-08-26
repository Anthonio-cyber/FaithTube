import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { RayBackdrop } from '@/components/brand/Logo';
import { Card, Modal } from '@/components/ui';
import { Button, LinkButton } from '@/components/ui/Button';
import { IconCheck, IconPremium } from '@/components/ui/Icons';

interface PlanResponse {
  plan: { id: string; name: string; amountMinor: number; currency: string; interval: string; features: string[]; displayPrice: string };
  checkoutAvailable: boolean;
  checkoutUnavailableReason: string | null;
  subscription: { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; provider: string } | null;
}

export default function PremiumPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const [params] = useSearchParams();
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ['premium-plan'],
    queryFn: () => api<PlanResponse>('/premium/plan'),
  });

  const checkout = useMutation({
    mutationFn: () => api<{ url: string }>('/premium/checkout', { method: 'POST' }),
    onSuccess: (result) => {
      // Stripe Checkout is hosted; card details never touch this application.
      window.location.href = result.url;
    },
    onError: (err) => {
      if (err instanceof ApiError && err.notConfigured) {
        push('Card payments are not set up on this deployment', 'warning', err.howToFix ?? undefined);
      } else {
        push(err instanceof ApiError ? err.message : 'Checkout could not be started.', 'error');
      }
    },
  });

  const cancel = useMutation({
    mutationFn: () => api<{ message: string }>('/premium/cancel', { method: 'POST', body: { immediate: false } }),
    onSuccess: (result) => {
      push(result.message, 'success');
      setCancelOpen(false);
      void refetch();
    },
  });

  const checkoutState = params.get('checkout');
  const plan = data?.plan;
  const active = data?.subscription && ['ACTIVE', 'TRIALING', 'COMPLIMENTARY'].includes(data.subscription.status);

  return (
    <div className="mx-auto max-w-4xl pb-10">
      {checkoutState === 'success' ? (
        <div className="mb-6 rounded-2xl bg-verified/10 p-4 text-sm ring-1 ring-verified/25">
          <p className="font-medium text-verified">Thank you — your Premium subscription is being confirmed.</p>
          <p className="mt-1 ft-muted">It can take a few seconds for your account to update. Refresh if you do not see it yet.</p>
        </div>
      ) : null}
      {checkoutState === 'cancelled' ? (
        <div className="mb-6 rounded-2xl bg-navy/[0.05] p-4 text-sm dark:bg-white/[0.05]">
          Checkout was cancelled. Nothing has been charged.
        </div>
      ) : null}

      <section className="relative overflow-hidden rounded-3xl bg-dawn px-6 py-12 text-center text-cream sm:px-12">
        <RayBackdrop className="text-gold" />
        <div className="relative mx-auto max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-medium">
            <IconPremium className="h-3.5 w-3.5 text-gold" />
            FaithTube Premium
          </span>
          <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Go deeper, without interruption
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-cream/70">
            Premium supports the platform directly and unlocks the features that make long-form teaching easier to live
            with — offline, in the background, ad-free.
          </p>

          <p className="mt-8">
            <span className="font-display text-5xl font-semibold">{plan ? formatMoney(plan.amountMinor, plan.currency) : '—'}</span>
            <span className="text-lg text-cream/60">/{plan?.interval ?? 'month'}</span>
          </p>

          <div className="mt-7">
            {!user ? (
              <LinkButton to="/signin?next=/premium" variant="gold" size="lg">
                Sign in to start Premium
              </LinkButton>
            ) : active ? (
              <div className="space-y-3">
                <p className="rounded-xl bg-white/10 px-4 py-3 text-sm">
                  You have Premium
                  {data?.subscription?.status === 'COMPLIMENTARY' ? ' (complimentary)' : ''}
                  {data?.subscription?.currentPeriodEnd
                    ? data.subscription.cancelAtPeriodEnd
                      ? ` — ends ${formatDate(data.subscription.currentPeriodEnd)}`
                      : ` — renews ${formatDate(data.subscription.currentPeriodEnd)}`
                    : ''}
                  .
                </p>
                {!data?.subscription?.cancelAtPeriodEnd && data?.subscription?.provider === 'stripe' ? (
                  <Button variant="outline" className="!text-cream !ring-white/25 hover:!bg-white/10" onClick={() => setCancelOpen(true)}>
                    Cancel subscription
                  </Button>
                ) : null}
              </div>
            ) : (
              <>
                <Button variant="gold" size="lg" loading={checkout.isPending} onClick={() => checkout.mutate()}>
                  Start Premium
                </Button>
                {!data?.checkoutAvailable ? (
                  <p className="mx-auto mt-4 max-w-md rounded-xl bg-white/[0.08] px-4 py-3 text-xs leading-relaxed text-cream/70">
                    {data?.checkoutUnavailableReason}
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-cream/50">Secure checkout. Cancel any time.</p>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        {(plan?.features ?? []).map((feature) => (
          <div key={feature} className="flex items-start gap-3 rounded-2xl bg-navy/[0.03] p-4 dark:bg-white/[0.03]">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-verified/15 text-verified">
              <IconCheck className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm leading-relaxed">{feature}</p>
          </div>
        ))}
      </section>

      <Card className="mt-8">
        <h2 className="font-display text-lg font-semibold">Where your subscription goes</h2>
        <p className="mt-2 text-sm leading-relaxed ft-muted">
          Premium pays for storage, bandwidth and the review process that keeps this platform Christ-centred. It does not
          become a payout pool for creators based on their subscriber count — FaithTube deliberately has no such system.
          If creator support is introduced later, it will be a separate, opt-in arrangement with its own clearly stated
          rules, and it will never be automatic.
        </p>
      </Card>

      <Card className="mt-4">
        <h2 className="font-display text-lg font-semibold">Questions</h2>
        <dl className="mt-3 space-y-4 text-sm">
          <div>
            <dt className="font-medium">Can I cancel?</dt>
            <dd className="mt-1 ft-muted">Yes, at any time. You keep Premium until the end of the period you have paid for.</dd>
          </div>
          <div>
            <dt className="font-medium">Do you store my card?</dt>
            <dd className="mt-1 ft-muted">
              No. Payment details are handled entirely by our payment provider and never reach FaithTube's servers or database.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Does Premium change what I am allowed to watch?</dt>
            <dd className="mt-1 ft-muted">
              Only in that some documentaries and long-form courses are Premium-only. Every video on the platform, Premium
              or not, has passed the same content review.
            </dd>
          </div>
        </dl>
      </Card>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel Premium?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep Premium
            </Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel at period end
            </Button>
          </>
        }
      >
        <p className="text-sm ft-muted">
          Your Premium features will stay active until the end of the current billing period. You will not be charged again.
        </p>
      </Modal>
    </div>
  );
}
