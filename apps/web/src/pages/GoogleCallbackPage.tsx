import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Wordmark } from '@/components/brand/Logo';
import { Spinner } from '@/components/ui/Button';

/**
 * Google redirects here with an authorization code. We hand the code to the API,
 * which performs the exchange server-side and sets the session cookie.
 */
export default function GoogleCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    const code = params.get('code');
    const state = params.get('state');
    const denied = params.get('error');

    if (denied) {
      setError('Google sign-in was cancelled.');
      return;
    }
    if (!code) {
      setError('Google did not return an authorization code.');
      return;
    }
    // CSRF check: the state we generated must come back unchanged.
    if (state && sessionStorage.getItem('ft_oauth_state') && state !== sessionStorage.getItem('ft_oauth_state')) {
      setError('That sign-in request could not be verified. Please try again.');
      return;
    }

    api<{ user: never; needsOnboarding: boolean }>('/auth/google/callback', { method: 'POST', body: { code, state } })
      .then((data) => {
        sessionStorage.removeItem('ft_oauth_state');
        setUser(data.user);
        navigate(data.needsOnboarding ? '/welcome' : '/', { replace: true });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Google sign-in could not be completed.'));
  }, [params, navigate, setUser]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-dawn px-4 text-center text-cream">
      <Wordmark className="text-cream" />
      {error ? (
        <>
          <p className="max-w-sm text-sm text-cream/80">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/signin', { replace: true })}
            className="rounded-full bg-gilt px-5 py-2.5 text-sm font-semibold text-navy"
          >
            Back to sign in
          </button>
        </>
      ) : (
        <div className="flex items-center gap-3 text-sm text-cream/70">
          <Spinner />
          Completing sign-in…
        </div>
      )}
    </div>
  );
}
