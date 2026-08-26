import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES } from '@faithtube/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { useToast } from '@/context/ToastContext';
import { RayBackdrop, Wordmark } from '@/components/brand/Logo';
import { Checkbox, Field, Input, ProgressBar } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/format';

const INTEREST_OPTIONS = CATEGORIES.filter((category) => category.onboarding);

/**
 * First-run experience. Interests feed the recommendation engine directly, and
 * the agreements are captured here for accounts created through Google, which
 * never saw the sign-up form.
 */
export default function OnboardingPage() {
  const { user, setUser } = useAuth();
  const { brand } = useConfig();
  const { push } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [username, setUsername] = useState(user?.username ?? '');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [agreements, setAgreements] = useState({ christianContent: false, guidelines: false, privacy: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) navigate('/signin', { replace: true });
    else if (user.onboardingComplete) navigate('/', { replace: true });
  }, [user, navigate]);

  const steps = ['Welcome', 'Your name', 'What you want to watch', 'Agreements'];

  function toggleInterest(slug: string) {
    setInterests((current) => (current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]));
  }

  async function finish() {
    setBusy(true);
    try {
      const data = await api<{ user: typeof user }>('/auth/onboarding', {
        method: 'POST',
        body: {
          username: username.trim() || undefined,
          displayName: displayName.trim() || undefined,
          interests,
          agreements,
        },
      });
      setUser(data.user ?? null);
      push('You are all set. Welcome.', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'We could not finish setting up your account.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const canContinue =
    step === 0
      ? true
      : step === 1
        ? displayName.trim().length >= 2 && username.trim().length >= 3
        : step === 2
          ? interests.length >= 1
          : agreements.christianContent && agreements.guidelines && agreements.privacy;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-dawn px-4 py-10 text-cream">
      <RayBackdrop className="text-gold" />

      <div className="relative w-full max-w-2xl">
        <div className="mb-8 text-center">
          <Wordmark className="text-cream" />
        </div>

        <div className="rounded-3xl bg-white/[0.06] p-6 backdrop-blur-sm ring-1 ring-white/10 sm:p-9">
          <ProgressBar value={((step + 1) / steps.length) * 100} className="mb-6 bg-white/15" label="Setup progress" />

          {step === 0 ? (
            <div className="text-center">
              <h1 className="font-display text-3xl font-semibold tracking-tight">Welcome to {brand.name}</h1>
              <p className="mt-3 text-lg text-gold-soft">{brand.motto}</p>
              <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-cream/75">
                This is a video platform for Christian content only. Every upload is reviewed before anyone can watch it,
                and a person always has the final say. Let us set up your account — it takes about a minute.
              </p>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <h1 className="font-display text-2xl font-semibold">What should we call you?</h1>
              <Field label="Display name" id="ob-name" required>
                <Input
                  id="ob-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="!bg-white/10 !text-cream !ring-white/20 placeholder:!text-cream/40"
                  maxLength={60}
                />
              </Field>
              <Field label="Username" id="ob-username" required hint="This is your public @handle.">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-cream/50">@</span>
                  <Input
                    id="ob-username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value.toLowerCase())}
                    className="!bg-white/10 !pl-7 !text-cream !ring-white/20"
                    maxLength={30}
                  />
                </div>
              </Field>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <h1 className="font-display text-2xl font-semibold">What would you like to watch?</h1>
              <p className="mt-1.5 text-sm text-cream/65">
                Pick as many as you like. We use these to shape your home page — you can change them any time in settings.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {INTEREST_OPTIONS.map((category) => {
                  const selected = interests.includes(category.slug);
                  return (
                    <button
                      key={category.slug}
                      type="button"
                      onClick={() => toggleInterest(category.slug)}
                      aria-pressed={selected}
                      className={cx(
                        'rounded-2xl px-3.5 py-3 text-left text-sm transition',
                        selected
                          ? 'bg-gilt font-semibold text-navy shadow-glow'
                          : 'bg-white/[0.08] text-cream/85 ring-1 ring-white/10 hover:bg-white/[0.14]',
                      )}
                    >
                      <span className="block">{category.name}</span>
                      <span className={cx('mt-0.5 block text-[0.7rem]', selected ? 'text-navy/70' : 'text-cream/50')}>
                        {category.blurb}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-cream/50">
                {interests.length} selected{interests.length === 0 ? ' — pick at least one to continue' : ''}
              </p>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-semibold">Before you start</h1>
              <p className="text-sm text-cream/70">
                These three matter, so please read them rather than clicking through.
              </p>
              <div className="space-y-4 rounded-2xl bg-white/[0.06] p-4">
                <Checkbox
                  id="ob-christian"
                  checked={agreements.christianContent}
                  onChange={(event) => setAgreements((a) => ({ ...a, christianContent: event.target.checked }))}
                  label={<span className="text-cream">I understand this platform is for Christian content only.</span>}
                  description="Uploads that are not Christ-centred are removed, whatever the account behind them."
                />
                <Checkbox
                  id="ob-guidelines"
                  checked={agreements.guidelines}
                  onChange={(event) => setAgreements((a) => ({ ...a, guidelines: event.target.checked }))}
                  label={<span className="text-cream">I agree to the Community Guidelines.</span>}
                  description="Disagree freely and charitably. Harassment, spam and solicitation are not permitted."
                />
                <Checkbox
                  id="ob-privacy"
                  checked={agreements.privacy}
                  onChange={(event) => setAgreements((a) => ({ ...a, privacy: event.target.checked }))}
                  label={<span className="text-cream">I have read the Privacy Policy.</span>}
                  description="Your email address is never shown publicly unless you choose to share it."
                />
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              className="!text-cream/70 hover:!bg-white/10"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              disabled={step === 0}
            >
              Back
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-cream/45">
                Step {step + 1} of {steps.length}
              </span>
              {step < steps.length - 1 ? (
                <Button variant="gold" onClick={() => setStep((value) => value + 1)} disabled={!canContinue}>
                  Continue
                </Button>
              ) : (
                <Button variant="gold" onClick={finish} loading={busy} disabled={!canContinue}>
                  Start watching
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
