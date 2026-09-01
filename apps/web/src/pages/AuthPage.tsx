import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { useToast } from '@/context/ToastContext';
import { RayBackdrop, Wordmark } from '@/components/brand/Logo';
import { Checkbox, Field, Input } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { IconShield } from '@/components/ui/Icons';

export default function AuthPage({ mode }: { mode: 'signin' | 'signup' }) {
  const { signIn, register, signInWithGoogle, user } = useAuth();
  const { brand, features } = useConfig();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [country, setCountry] = useState('');
  const [agreements, setAgreements] = useState({ christianContent: false, guidelines: false, privacy: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [usernameNote, setUsernameNote] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate(user.onboardingComplete ? next : '/welcome', { replace: true });
  }, [user, navigate, next]);

  // Live username availability, so nobody fills the whole form to be told no.
  useEffect(() => {
    if (mode !== 'signup' || username.trim().length < 3) {
      setUsernameNote(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const result = await api<{ available: boolean; message?: string; suggestion?: string }>('/auth/check-username', {
          method: 'POST',
          body: { username: username.trim() },
        });
        setUsernameNote(
          result.available
            ? `@${username.trim().toLowerCase()} is available`
            : `${result.message ?? 'Not available.'}${result.suggestion ? ` Try @${result.suggestion}.` : ''}`,
        );
        setErrors((current) => ({ ...current, username: result.available ? '' : (result.message ?? '') }));
      } catch {
        setUsernameNote(null);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [username, mode]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        push('Welcome back.', 'success');
      } else {
        if (!agreements.christianContent || !agreements.guidelines || !agreements.privacy) {
          setErrors({ agreements: 'Please accept all three to create an account.' });
          return;
        }
        await register({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          username: username.trim(),
          country: country || undefined,
          agreements: agreements as { christianContent: true; guidelines: true; privacy: true },
        });
        push('Your account is ready.', 'success');
        navigate('/welcome', { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = err.details as Record<string, string[]> | undefined;
        if (fieldErrors && typeof fieldErrors === 'object') {
          setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([key, value]) => [key, value?.[0] ?? ''])));
        }
        push(err.message, 'error');
      } else {
        push('Something went wrong. Please try again.', 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    try {
      await signInWithGoogle();
    } catch (err) {
      push('Google sign-in is not available here', 'warning', err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-dawn p-12 text-cream lg:flex lg:flex-col lg:justify-between">
        <RayBackdrop className="text-gold" />
        <Link to="/" className="relative">
          <Wordmark className="text-cream" />
        </Link>
        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight">{brand.motto}</h2>
          <p className="mt-4 text-sm leading-relaxed text-cream/70">{brand.description}</p>
          <div className="mt-8 flex items-start gap-3 rounded-2xl bg-white/[0.06] p-4">
            <IconShield className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <p className="text-xs leading-relaxed text-cream/75">
              Every video is reviewed before it can be watched. Creators are never paid by subscriber count here — this
              platform exists for teaching, worship and the Gospel, not for chasing an audience.
            </p>
          </div>
        </div>
        <p className="relative text-xs text-cream/45">{brand.supportingMotto}</p>
      </div>

      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-block lg:hidden">
            <Wordmark />
          </Link>

          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {mode === 'signin' ? 'Welcome back' : `Join ${brand.name}`}
          </h1>
          <p className="mt-1.5 text-sm ft-muted">
            {mode === 'signin'
              ? 'Sign in to keep your place, follow channels and build playlists.'
              : 'Create an account to watch, follow, comment and — if God has called you to it — teach.'}
          </p>

          <div className="mt-6 space-y-3">
            <Button
              variant="outline"
              fullWidth
              size="lg"
              onClick={onGoogle}
              type="button"
              disabled={!features.googleSignIn}
            >
              <GoogleGlyph />
              Continue with Google
            </Button>
            {!features.googleSignIn ? (
              <p className="text-center text-xs ft-muted">
                Google sign-in is not configured on this deployment. Email sign-in below works normally.
              </p>
            ) : null}
          </div>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-navy/10 dark:bg-white/10" />
            <span className="text-xs ft-muted">or with email</span>
            <span className="h-px flex-1 bg-navy/10 dark:bg-white/10" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === 'signup' ? (
              <>
                <Field label="Display name" id="displayName" required error={errors.displayName}>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={60}
                    invalid={Boolean(errors.displayName)}
                  />
                </Field>

                <Field label="Username" id="username" required error={errors.username} hint={usernameNote ?? 'Letters, numbers, dots, dashes and underscores.'}>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm ft-muted">@</span>
                    <Input
                      id="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      autoComplete="username"
                      required
                      minLength={3}
                      maxLength={30}
                      className="pl-7"
                      invalid={Boolean(errors.username)}
                    />
                  </div>
                </Field>
              </>
            ) : null}

            <Field label="Email address" id="email" required error={errors.email}>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                invalid={Boolean(errors.email)}
              />
            </Field>

            <Field
              label="Password"
              id="password"
              required
              error={errors.password}
              hint={mode === 'signup' ? 'At least 10 characters. A short phrase works well.' : undefined}
            >
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'signup' ? 10 : 1}
                invalid={Boolean(errors.password)}
              />
            </Field>

            {mode === 'signup' ? (
              <>
                <Field label="Country or region" id="country" hint="Used to show you relevant ministries. Optional.">
                  <Input
                    id="country"
                    value={country}
                    onChange={(event) => setCountry(event.target.value.toUpperCase().slice(0, 2))}
                    placeholder="GB"
                    maxLength={2}
                    autoComplete="country"
                  />
                </Field>

                <fieldset className="space-y-3 rounded-2xl bg-navy/[0.03] p-4 dark:bg-white/[0.03]">
                  <legend className="sr-only">Agreements</legend>
                  <Checkbox
                    id="agree-christian"
                    checked={agreements.christianContent}
                    onChange={(event) => setAgreements((a) => ({ ...a, christianContent: event.target.checked }))}
                    label={
                      <>
                        I understand {brand.name} hosts <strong>Christian content only</strong>, and I agree to the{' '}
                        <Link to="/content-policy" className="text-gold-deep underline dark:text-gold-soft">
                          Christian Content Policy
                        </Link>
                        .
                      </>
                    }
                  />
                  <Checkbox
                    id="agree-guidelines"
                    checked={agreements.guidelines}
                    onChange={(event) => setAgreements((a) => ({ ...a, guidelines: event.target.checked }))}
                    label={
                      <>
                        I agree to the{' '}
                        <Link to="/terms" className="text-gold-deep underline dark:text-gold-soft">
                          Community Guidelines and Terms
                        </Link>
                        .
                      </>
                    }
                  />
                  <Checkbox
                    id="agree-privacy"
                    checked={agreements.privacy}
                    onChange={(event) => setAgreements((a) => ({ ...a, privacy: event.target.checked }))}
                    label={
                      <>
                        I have read the{' '}
                        <Link to="/privacy" className="text-gold-deep underline dark:text-gold-soft">
                          Privacy Policy
                        </Link>
                        .
                      </>
                    }
                  />
                  {errors.agreements ? (
                    <p role="alert" className="text-xs font-medium text-danger">
                      {errors.agreements}
                    </p>
                  ) : null}
                </fieldset>
              </>
            ) : null}

            <Button type="submit" fullWidth size="lg" loading={busy}>
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm ft-muted">
            {mode === 'signin' ? (
              <>
                New here?{' '}
                <Link to="/signup" className="font-medium text-gold-deep hover:underline dark:text-gold-soft">
                  Create an account
                </Link>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Link to="/signin" className="font-medium text-gold-deep hover:underline dark:text-gold-soft">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.15rem] w-[1.15rem]" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6v-3.1h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
    </svg>
  );
}
