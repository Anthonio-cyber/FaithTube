import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CATEGORIES, DEFAULT_NOTIFICATION_PREFS, type NotificationPreferences } from '@faithtube/shared';
import { api, ApiError } from '@/lib/api';
import { cx, formatDate } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar, Card, Field, Input, Modal, Textarea, Toggle } from '@/components/ui';
import { Button, LinkButton } from '@/components/ui/Button';
import { IconDownload, IconTrash } from '@/components/ui/Icons';

const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'interests', label: 'Interests' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'appearance', label: 'Appearance & accessibility' },
  { id: 'privacy', label: 'Privacy & security' },
  { id: 'billing', label: 'Billing' },
];

export default function SettingsPage() {
  const { section = 'profile' } = useParams();
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">Sign in to manage your account</h1>
        <LinkButton to="/signin?next=/settings" variant="gold" className="mt-6">
          Sign in
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Profile" title="Settings" />

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav aria-label="Settings sections" className="ft-no-scrollbar -mx-1 flex gap-1 overflow-x-auto md:flex-col">
          {SECTIONS.map((item) => (
            <Link
              key={item.id}
              to={`/settings/${item.id}`}
              className={cx(
                'whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition',
                section === item.id
                  ? 'bg-gold/12 text-gold-deep dark:bg-gold/15 dark:text-gold-soft'
                  : 'ft-muted hover:bg-navy/[0.05] dark:hover:bg-white/5',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="min-w-0">
          {section === 'profile' ? <ProfileSection /> : null}
          {section === 'interests' ? <InterestsSection /> : null}
          {section === 'notifications' ? <NotificationsSection /> : null}
          {section === 'appearance' ? <AppearanceSection /> : null}
          {section === 'privacy' ? <PrivacySection /> : null}
          {section === 'billing' ? <BillingSection /> : null}
        </div>
      </div>
    </div>
  );
}

function ProfileSection() {
  const { user, refresh } = useAuth();
  const { push } = useToast();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState(user?.country ?? '');

  const save = useMutation({
    mutationFn: () =>
      api('/users/me', {
        method: 'PATCH',
        body: { displayName, username, bio, country: country || null },
      }),
    onSuccess: async () => {
      await refresh();
      push('Profile updated.', 'success');
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'Could not save your profile.', 'error'),
  });

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append('avatar', file);
      return api('/users/me/avatar', { method: 'POST', body });
    },
    onSuccess: async () => {
      await refresh();
      push('Profile picture updated.', 'success');
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'Could not upload that image.', 'error'),
  });

  return (
    <Card className="space-y-5">
      <h2 className="font-display text-lg font-semibold">Your profile</h2>

      <div className="flex items-center gap-4">
        <Avatar src={user?.avatarUrl} name={user?.displayName ?? ''} size={64} />
        <label className="cursor-pointer rounded-full bg-navy/[0.06] px-4 py-2 text-sm font-medium transition hover:bg-navy/[0.1] dark:bg-white/10">
          Change picture
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadAvatar.mutate(file);
            }}
          />
        </label>
      </div>

      <Field label="Display name" id="s-name">
        <Input id="s-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={60} />
      </Field>

      <Field label="Username" id="s-username" hint="Your public @handle.">
        <Input id="s-username" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} maxLength={30} />
      </Field>

      <Field label="About you" id="s-bio" hint="Shown on your public profile. Optional.">
        <Textarea id="s-bio" value={bio} onChange={(event) => setBio(event.target.value)} rows={3} maxLength={500} />
      </Field>

      <Field label="Country or region" id="s-country">
        <Input id="s-country" value={country} onChange={(event) => setCountry(event.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
      </Field>

      <div className="rounded-xl bg-navy/[0.03] p-3.5 text-sm dark:bg-white/[0.03]">
        <p className="font-medium">Email address</p>
        <p className="mt-0.5 ft-muted">{user?.email}</p>
        <p className="mt-1.5 text-xs ft-muted">
          Your email is never shown publicly. It is used to sign you in and to send account notices only.
        </p>
      </div>

      <Button variant="gold" loading={save.isPending} onClick={() => save.mutate()}>
        Save changes
      </Button>
    </Card>
  );
}

function InterestsSection() {
  const { user, refresh } = useAuth();
  const { push } = useToast();
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);

  const save = useMutation({
    mutationFn: () => api('/users/me', { method: 'PATCH', body: { interests } }),
    onSuccess: async () => {
      await refresh();
      push('Your recommendations will update from now on.', 'success');
    },
  });

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold">What you want to watch</h2>
        <p className="mt-1 text-sm ft-muted">These shape your home page and recommendations.</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {CATEGORIES.map((category) => {
          const selected = interests.includes(category.slug);
          return (
            <button
              key={category.slug}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                setInterests((current) =>
                  current.includes(category.slug) ? current.filter((item) => item !== category.slug) : [...current, category.slug],
                )
              }
              className={cx(
                'rounded-xl px-3 py-2.5 text-left text-sm transition',
                selected ? 'bg-gilt font-semibold text-navy' : 'bg-navy/[0.05] hover:bg-navy/[0.1] dark:bg-white/[0.06] dark:hover:bg-white/[0.12]',
              )}
            >
              {category.name}
            </button>
          );
        })}
      </div>

      <Button variant="gold" loading={save.isPending} onClick={() => save.mutate()}>
        Save interests
      </Button>
    </Card>
  );
}

function NotificationsSection() {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);

  const { data } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => api<{ preferences: NotificationPreferences }>('/notifications/preferences'),
  });

  useEffect(() => {
    if (data?.preferences) setPrefs(data.preferences);
  }, [data]);

  const save = useMutation({
    mutationFn: (next: Partial<NotificationPreferences>) => api('/notifications/preferences', { method: 'PATCH', body: next }),
    onSuccess: () => {
      push('Notification preferences saved.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['notification-prefs'] });
    },
  });

  function update(key: keyof NotificationPreferences, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    save.mutate({ [key]: value });
  }

  const rows: Array<[keyof NotificationPreferences, string, string]> = [
    ['newUploads', 'New uploads', 'When a channel you follow publishes a video.'],
    ['live', 'Live streams', 'When a channel you follow goes live.'],
    ['newSubscribers', 'New subscribers', 'When someone subscribes to your channel.'],
    ['comments', 'Comments', 'When someone comments on your video.'],
    ['replies', 'Replies', 'When someone replies to your comment.'],
    ['premium', 'Premium', 'Billing and subscription notices.'],
    ['announcements', 'Platform announcements', 'Occasional updates from the FaithTube team.'],
    ['email', 'Email me as well', 'Send these to your inbox in addition to in-app.'],
  ];

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold">Notifications</h2>
      <p className="mt-1 text-sm ft-muted">Choose what reaches you.</p>

      <div className="mt-4 divide-y divide-navy/8 dark:divide-white/8">
        {rows.map(([key, label, description]) => (
          <Toggle key={key} checked={prefs[key]} onChange={(value) => update(key, value)} label={label} description={description} />
        ))}
      </div>

      <p className="mt-4 rounded-xl bg-navy/[0.03] p-3.5 text-xs leading-relaxed ft-muted dark:bg-white/[0.03]">
        Review outcomes for your own uploads are always delivered, whatever you choose here — you need to know if a video
        was approved or rejected.
      </p>
    </Card>
  );
}

function AppearanceSection() {
  const { theme, setTheme, highContrast, setHighContrast } = useTheme();

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold">Appearance</h2>
        <p className="mt-1 text-sm ft-muted">How FaithTube looks on this device.</p>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Theme</legend>
        <div className="grid grid-cols-3 gap-2">
          {(['light', 'dark', 'system'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={theme === option}
              onClick={() => setTheme(option)}
              className={cx(
                'rounded-xl px-3 py-2.5 text-sm capitalize transition',
                theme === option ? 'bg-gilt font-semibold text-navy' : 'bg-navy/[0.05] hover:bg-navy/[0.1] dark:bg-white/[0.06]',
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="divide-y divide-navy/8 dark:divide-white/8">
        <Toggle
          checked={highContrast}
          onChange={setHighContrast}
          label="High contrast"
          description="Stronger borders and text, with decorative gradients removed."
        />
      </div>

      <div className="rounded-xl bg-navy/[0.03] p-4 text-sm dark:bg-white/[0.03]">
        <h3 className="font-medium">Keyboard shortcuts</h3>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs ft-muted">
          {[
            ['/', 'Focus search'],
            ['Space or K', 'Play or pause'],
            ['← →', 'Back or forward 5 seconds'],
            ['J / L', 'Back or forward 10 seconds'],
            ['↑ ↓', 'Volume'],
            ['M', 'Mute'],
            ['F', 'Fullscreen'],
            ['C', 'Captions'],
            ['0–9', 'Jump through the video'],
          ].map(([key, action]) => (
            <div key={key} className="flex gap-2">
              <dt className="shrink-0 rounded bg-navy/10 px-1.5 font-mono dark:bg-white/10">{key}</dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}

/**
 * Changing a password signs every other device out, which is the whole point
 * of the control: it is what you reach for when you think someone else has it.
 */
function PasswordCard() {
  const { user } = useAuth();
  const { push } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () => api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
    onSuccess: () => {
      push('Your password has been changed. Other devices were signed out.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Your password could not be changed.'),
  });

  // A Google account has no password to change; saying so is more useful than
  // showing a form that can only fail.
  if (user && !user.hasPassword) {
    return (
      <Card>
        <h2 className="font-display text-lg font-semibold">Password</h2>
        <p className="mt-1 text-sm leading-relaxed ft-muted">
          You sign in with Google, so there is no FaithTube password on this account. Your Google account settings control
          access.
        </p>
      </Card>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('The two new passwords do not match.');
      return;
    }
    if (newPassword.length < 10) {
      setError('Choose a password of at least 10 characters.');
      return;
    }
    setError(null);
    change.mutate();
  }

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold">Password</h2>
      <p className="mt-1 text-sm leading-relaxed ft-muted">
        Changing your password signs you out everywhere except this device.
      </p>
      <form className="mt-4 space-y-4" onSubmit={submit}>
        <Field label="Current password" id="current-password" required>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </Field>
        <Field label="New password" id="new-password" hint="At least 10 characters." required>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </Field>
        <Field label="Confirm new password" id="confirm-password" required>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="gold" disabled={change.isPending}>
          {change.isPending ? 'Changing…' : 'Change password'}
        </Button>
      </form>
    </Card>
  );
}

function PrivacySection() {
  const { push } = useToast();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  const { data: sessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: () =>
      api<{ items: Array<{ id: string; userAgent: string | null; createdAt: string; expiresAt: string; current: boolean }> }>('/users/me/sessions'),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api(`/users/me/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => push('That device has been signed out.', 'success'),
  });

  const deleteAccount = useMutation({
    mutationFn: () => api('/users/me/delete', { method: 'POST', body: { confirm: confirmation } }),
    onSuccess: () => {
      push('Your account has been closed.', 'success');
      navigate('/');
      window.location.reload();
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'Your account could not be closed.', 'error'),
  });

  return (
    <div className="space-y-5">
      <PasswordCard />

      <Card>
        <h2 className="font-display text-lg font-semibold">Signed-in devices</h2>
        <p className="mt-1 text-sm ft-muted">Sign out anywhere you do not recognise.</p>
        <ul className="mt-4 space-y-2">
          {sessions?.items.map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-3 rounded-xl bg-navy/[0.03] px-3.5 py-2.5 text-sm dark:bg-white/[0.03]">
              <div className="min-w-0">
                <p className="truncate font-medium">{shortenAgent(session.userAgent)}</p>
                <p className="text-xs ft-muted">
                  Signed in {formatDate(session.createdAt)}
                  {session.current ? ' · this device' : ''}
                </p>
              </div>
              {!session.current ? (
                <Button variant="ghost" size="sm" onClick={() => revoke.mutate(session.id)}>
                  Sign out
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold">Your data</h2>
        <p className="mt-1 text-sm leading-relaxed ft-muted">
          Download everything FaithTube holds about you: your profile, channel, videos, comments, playlists, watch history,
          subscriptions and payments, as a JSON file.
        </p>
        <a
          href="/api/users/me/export"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-navy/[0.06] px-4 py-2 text-sm font-medium transition hover:bg-navy/[0.1] dark:bg-white/10"
        >
          <IconDownload className="h-4 w-4" />
          Download my data
        </a>
      </Card>

      <Card className="ring-danger/25">
        <h2 className="font-display text-lg font-semibold text-danger">Close your account</h2>
        <p className="mt-1 text-sm leading-relaxed ft-muted">
          This removes your personal details and unpublishes your videos. It cannot be undone.
        </p>
        <Button variant="danger" className="mt-4" onClick={() => setDeleteOpen(true)}>
          <IconTrash className="h-4 w-4" />
          Close my account
        </Button>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Close your account?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Keep my account
            </Button>
            <Button
              variant="danger"
              loading={deleteAccount.isPending}
              disabled={confirmation !== 'DELETE MY ACCOUNT'}
              onClick={() => deleteAccount.mutate()}
            >
              Close permanently
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed ft-muted">
          Your profile, channel and videos will be removed from FaithTube. Comments you have written stay, attributed to a
          former member. This cannot be reversed.
        </p>
        <Field label='Type "DELETE MY ACCOUNT" to confirm' id="del-confirm" required>
          <Input id="del-confirm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2" />
        </Field>
      </Modal>
    </div>
  );
}

function BillingSection() {
  const { user } = useAuth();
  const { push } = useToast();

  const { data } = useQuery({
    queryKey: ['premium-plan'],
    queryFn: () =>
      api<{ subscription: { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; provider: string } | null; plan: { displayPrice: string; interval: string } }>(
        '/premium/plan',
      ),
  });

  const portal = useMutation({
    mutationFn: () => api<{ url: string }>('/premium/portal', { method: 'POST' }),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'Billing portal is not available.', 'error'),
  });

  return (
    <Card className="space-y-4">
      <h2 className="font-display text-lg font-semibold">Billing</h2>

      {data?.subscription ? (
        <>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="ft-muted">Status</dt>
              <dd className="font-medium capitalize">{data.subscription.status.toLowerCase().replace(/_/g, ' ')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="ft-muted">Price</dt>
              <dd className="font-medium">
                {data.plan.displayPrice}/{data.plan.interval}
              </dd>
            </div>
            {data.subscription.currentPeriodEnd ? (
              <div className="flex justify-between">
                <dt className="ft-muted">{data.subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'}</dt>
                <dd className="font-medium">{formatDate(data.subscription.currentPeriodEnd)}</dd>
              </div>
            ) : null}
          </dl>

          {data.subscription.provider === 'stripe' ? (
            <Button variant="outline" loading={portal.isPending} onClick={() => portal.mutate()}>
              Manage payment method
            </Button>
          ) : (
            <p className="rounded-xl bg-navy/[0.03] p-3.5 text-sm ft-muted dark:bg-white/[0.03]">
              This subscription was granted by an administrator, so there is nothing to pay or manage.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-sm ft-muted">
            {user?.isPremium ? 'You have Premium.' : 'You do not have a Premium subscription.'}
          </p>
          <LinkButton to="/premium" variant="gold" size="sm">
            About Premium
          </LinkButton>
        </>
      )}

      <p className="rounded-xl bg-navy/[0.03] p-3.5 text-xs leading-relaxed ft-muted dark:bg-white/[0.03]">
        FaithTube never stores your card details. Payments are processed entirely by our payment provider.
      </p>
    </Card>
  );
}

function shortenAgent(agent: string | null): string {
  if (!agent) return 'Unknown device';
  const browser = /Firefox\/[\d.]+/.test(agent)
    ? 'Firefox'
    : /Edg\//.test(agent)
      ? 'Edge'
      : /Chrome\//.test(agent)
        ? 'Chrome'
        : /Safari\//.test(agent)
          ? 'Safari'
          : 'Browser';
  const platform = /iPhone|iPad/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' : /Mac OS/.test(agent) ? 'macOS' : /Windows/.test(agent) ? 'Windows' : /Linux/.test(agent) ? 'Linux' : '';
  return platform ? `${browser} on ${platform}` : browser;
}
