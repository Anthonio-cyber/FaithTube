import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hasRole, ROLES, type Role } from '@faithtube/shared';
import { api, ApiError } from '@/lib/api';
import { cx, formatCount, formatMoney, timeAgo } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar, Badge, Card, EmptyState, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { DualSeriesChart, StatTile, type Point } from '@/components/ui/Charts';

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/moderation', label: 'Moderation' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/settings', label: 'Settings' },
  { to: '/admin/audit', label: 'Audit log' },
];

export function AdminLayout() {
  const { user } = useAuth();

  if (!user || !hasRole(user.role, 'MODERATOR')) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Not available</h1>
        <p className="mt-2 text-sm ft-muted">You do not have permission to view the moderation area.</p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-gold-deep hover:underline dark:text-gold-soft">
          Back to home
        </Link>
      </div>
    );
  }

  const visible = hasRole(user.role, 'ADMIN') ? ADMIN_NAV : ADMIN_NAV.filter((item) => ['Overview', 'Moderation', 'Audit log'].includes(item.label));

  return (
    <div className="mx-auto max-w-7xl">
      <nav aria-label="Moderation sections" className="ft-no-scrollbar mb-6 flex gap-1 overflow-x-auto border-b border-navy/10 dark:border-white/10">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cx(
                'relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition',
                isActive ? 'text-navy dark:text-cream' : 'ft-muted hover:text-navy dark:hover:text-cream',
              )
            }
          >
            {({ isActive }) => (
              <>
                {item.label}
                {isActive ? <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gold" /> : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

interface Overview {
  windowDays: number;
  users: { total: number; activeLast7Days: number; newInWindow: number };
  channels: { total: number };
  videos: { total: number; published: number; approved: number; rejected: number; awaitingReview: number; uploadedInWindow: number };
  moderation: { byDecision: Record<string, number>; openReports: number; pendingAppeals: number; autoResolutionRate: number };
  premium: { subscribers: number; plan: { amountMinor: number; currency: string }; monthlyRecurringMinor: number };
  engagement: { totalViews: number; totalWatchHours: number };
  series: { signups: Point[]; uploads: Point[] };
  integrations: Record<string, boolean>;
}

export function AdminOverviewPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-overview', days],
    queryFn: () => api<Overview>('/admin/overview', { query: { days } }),
  });

  if (isLoading || !data) return <div className="py-20 text-center text-sm ft-muted">Loading platform analytics…</div>;

  return (
    <div>
      <PageHeader
        eyebrow="Moderation Center"
        title="Platform overview"
        description={`Activity across the last ${data.windowDays} days.`}
        action={
          <Select value={String(days)} onChange={(event) => setDays(Number(event.target.value))} aria-label="Time range" className="!h-9 !w-auto !py-0 !text-sm">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </Select>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Members" value={formatCount(data.users.total)} hint={`${formatCount(data.users.activeLast7Days)} active this week`} />
        <StatTile label="Channels" value={formatCount(data.channels.total)} />
        <StatTile label="Published videos" value={formatCount(data.videos.published)} hint={`${formatCount(data.videos.total)} uploaded in total`} />
        <StatTile label="Watch time" value={`${formatCount(data.engagement.totalWatchHours)} hrs`} />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Awaiting human review"
          value={formatCount(data.videos.awaitingReview)}
          tone={data.videos.awaitingReview > 20 ? 'warn' : 'neutral'}
        />
        <StatTile label="Open reports" value={formatCount(data.moderation.openReports)} tone={data.moderation.openReports > 10 ? 'warn' : 'neutral'} />
        <StatTile label="Pending appeals" value={formatCount(data.moderation.pendingAppeals)} tone={data.moderation.pendingAppeals > 5 ? 'warn' : 'neutral'} />
        <StatTile label="Rejected" value={formatCount(data.videos.rejected)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <h2 className="mb-3 font-display text-base font-semibold">Sign-ups and uploads</h2>
          <DualSeriesChart
            series={[
              { label: 'New members', data: data.series.signups },
              { label: 'Videos uploaded', data: data.series.uploads },
            ]}
            formatValue={formatCount}
          />
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 font-display text-base font-semibold">Moderation outcomes</h2>
            <dl className="space-y-2 text-sm">
              {Object.entries(data.moderation.byDecision).map(([decision, count]) => (
                <div key={decision} className="flex justify-between">
                  <dt className="capitalize ft-muted">{decision.toLowerCase().replace(/_/g, ' ')}</dt>
                  <dd className="font-medium tabular-nums">{formatCount(count)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 border-t border-navy/10 pt-3 text-xs leading-relaxed ft-muted dark:border-white/10">
              {data.moderation.autoResolutionRate}% of reviews were resolved without needing a person. The rest reached
              the human queue — which is the intended behaviour when the classifier is not confident.
            </p>
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-semibold">Premium</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="ft-muted">Subscribers</dt>
                <dd className="font-medium tabular-nums">{formatCount(data.premium.subscribers)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="ft-muted">Price</dt>
                <dd className="font-medium">{formatMoney(data.premium.plan.amountMinor, data.premium.plan.currency)}/month</dd>
              </div>
              <div className="flex justify-between">
                <dt className="ft-muted">Recurring revenue</dt>
                <dd className="font-medium tabular-nums">{formatMoney(data.premium.monthlyRecurringMinor, data.premium.plan.currency)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <Card className="mt-5">
        <h2 className="mb-3 font-display text-base font-semibold">Integrations</h2>
        <p className="mb-3 text-sm ft-muted">
          What this deployment actually has configured. Anything marked off is not silently degraded — the interface tells
          people it is unavailable.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(data.integrations).map(([key, enabled]) => (
            <li key={key} className="flex items-center justify-between rounded-xl bg-navy/[0.03] px-3.5 py-2.5 text-sm dark:bg-white/[0.03]">
              <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
              <Badge tone={enabled ? 'verified' : 'neutral'}>{enabled ? 'configured' : 'not configured'}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  role: Role;
  country: string | null;
  strikeCount: number;
  suspendedUntil: string | null;
  suspensionReason: string | null;
  premiumStatus: string | null;
  channel: { id: string; handle: string; name: string } | null;
  createdAt: string;
  lastSeenAt: string;
}

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [suspendDays, setSuspendDays] = useState(7);
  const [suspendReason, setSuspendReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => api<{ items: AdminUser[] }>('/admin/users', { query: { q: search || undefined } }),
  });

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api(`/admin/users/${id}/role`, { method: 'POST', body: { role } }),
    onSuccess: () => {
      push('Role updated.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'Could not change that role.', 'error'),
  });

  const suspend = useMutation({
    mutationFn: ({ id, days, reason }: { id: string; days: number; reason: string }) =>
      api(`/admin/users/${id}/suspend`, { method: 'POST', body: { days, reason } }),
    onSuccess: () => {
      push('Account updated.', 'success');
      setSuspendTarget(null);
      setSuspendReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'Could not update that account.', 'error'),
  });

  const canAssignRoles = me ? hasRole(me.role, 'SUPER_ADMIN') : false;

  return (
    <div>
      <PageHeader eyebrow="Moderation Center" title="Users" description="Find an account, change its role, or suspend it." />

      <div className="mb-5">
        <label htmlFor="admin-user-search" className="sr-only">
          Search users
        </label>
        <Input
          id="admin-user-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, username or email"
          className="max-w-md"
        />
      </div>

      {isLoading ? (
        <div className="ft-skeleton h-64 rounded-2xl" />
      ) : data?.items.length ? (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-navy/10 dark:ring-white/10">
          <table className="w-full text-sm">
            <caption className="sr-only">Platform members</caption>
            <thead className="bg-navy/[0.03] text-left text-xs uppercase tracking-wide ft-muted dark:bg-white/[0.03]">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Member</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Role</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Joined</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => {
                const suspended = row.suspendedUntil && new Date(row.suspendedUntil) > new Date();
                return (
                  <tr key={row.id} className="border-t border-navy/8 dark:border-white/8">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={row.avatarUrl} name={row.displayName} size={32} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{row.displayName}</p>
                          <p className="truncate text-xs ft-muted">
                            @{row.username} · {row.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {canAssignRoles && row.id !== me?.id ? (
                        <Select
                          value={row.role}
                          onChange={(event) => setRole.mutate({ id: row.id, role: event.target.value as Role })}
                          aria-label={`Role for ${row.displayName}`}
                          className="!h-8 !w-auto !py-0 !text-xs"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role.toLowerCase().replace(/_/g, ' ')}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Badge tone={row.role === 'SUPER_ADMIN' || row.role === 'ADMIN' ? 'gold' : 'neutral'}>
                          {row.role.toLowerCase().replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {suspended ? <Badge tone="danger">suspended</Badge> : <Badge tone="verified">active</Badge>}
                        {row.strikeCount > 0 ? <Badge tone="warn">{row.strikeCount} strikes</Badge> : null}
                        {row.premiumStatus ? <Badge tone="gold">premium</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs ft-muted">{timeAgo(row.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSuspendTarget(row)}>
                        {suspended ? 'Reinstate' : 'Suspend'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No members matched" description="Try a different name, username or email." />
      )}

      <Modal
        open={Boolean(suspendTarget)}
        onClose={() => setSuspendTarget(null)}
        title={suspendTarget?.suspendedUntil && new Date(suspendTarget.suspendedUntil) > new Date() ? 'Reinstate account' : 'Suspend account'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspendTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={suspend.isPending}
              disabled={suspendDays > 0 && suspendReason.trim().length < 5}
              onClick={() => suspend.mutate({ id: suspendTarget!.id, days: suspendDays, reason: suspendReason || 'Reinstated.' })}
            >
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm ft-muted">
            {suspendTarget?.displayName} (@{suspendTarget?.username}). Suspending signs them out everywhere immediately and
            notifies them of the reason.
          </p>
          <Field label="Length" id="susp-days" hint="Set to 0 to lift an existing suspension.">
            <Select id="susp-days" value={String(suspendDays)} onChange={(event) => setSuspendDays(Number(event.target.value))}>
              <option value="0">Lift suspension</option>
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="365">1 year</option>
              <option value="3650">Indefinite</option>
            </Select>
          </Field>
          {suspendDays > 0 ? (
            <Field label="Reason" id="susp-reason" required hint="Sent to the member.">
              <Textarea id="susp-reason" value={suspendReason} onChange={(event) => setSuspendReason(event.target.value)} rows={3} maxLength={500} />
            </Field>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

export function AdminAuditPage() {
  const [filter, setFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit', filter],
    queryFn: () =>
      api<{
        items: Array<{
          id: string;
          action: string;
          summary: string;
          targetType: string | null;
          targetId: string | null;
          actor: { displayName: string; username: string; role: string } | null;
          createdAt: string;
        }>;
      }>('/admin/audit', { query: { action: filter || undefined, limit: 100 } }),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Moderation Center"
        title="Audit log"
        description="Every administrative and moderation action, in order. This log is append-only."
      />

      <div className="mb-5">
        <label htmlFor="audit-filter" className="sr-only">
          Filter by action
        </label>
        <Input
          id="audit-filter"
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by action, e.g. moderation.reject"
          className="max-w-md"
        />
      </div>

      {isLoading ? (
        <div className="ft-skeleton h-64 rounded-2xl" />
      ) : data?.items.length ? (
        <ul className="space-y-1.5">
          {data.items.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl bg-navy/[0.03] px-4 py-2.5 text-sm dark:bg-white/[0.03]">
              <code className="shrink-0 rounded bg-navy/10 px-1.5 py-0.5 text-xs dark:bg-white/10">{entry.action}</code>
              <span className="min-w-0 flex-1">{entry.summary}</span>
              <span className="shrink-0 text-xs ft-muted">
                {entry.actor ? `@${entry.actor.username}` : 'system'} · {timeAgo(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nothing logged yet" description="Moderation and administrative actions appear here as they happen." />
      )}
    </div>
  );
}

export function AdminSettingsPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [price, setPrice] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');

  const { data } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () =>
      api<{ plan: { name: string; amountMinor: number; currency: string; features: string[] }; integrations: Record<string, boolean> }>('/admin/settings'),
  });

  const updatePlan = useMutation({
    mutationFn: () => api('/admin/premium/plan', { method: 'PUT', body: { amountMinor: Math.round(Number(price) * 100) } }),
    onSuccess: () => {
      push('Premium price updated.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['premium-plan'] });
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'Could not update the price.', 'error'),
  });

  const announce = useMutation({
    mutationFn: () => api<{ delivered: number }>('/admin/announcements', { method: 'POST', body: { title: announcementTitle, body: announcementBody } }),
    onSuccess: (result) => {
      push(`Announcement sent to ${result.delivered} members.`, 'success');
      setAnnouncementTitle('');
      setAnnouncementBody('');
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'Could not send that announcement.', 'error'),
  });

  const canBill = user ? hasRole(user.role, 'SUPER_ADMIN') : false;

  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Moderation Center" title="Platform settings" />

      <div className="space-y-5">
        <Card className="space-y-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Premium pricing</h2>
            <p className="mt-1 text-sm ft-muted">
              Current price: {data ? formatMoney(data.plan.amountMinor, data.plan.currency) : '—'} per month. Changing this
              affects new checkouts; existing subscriptions keep the price they signed up at until they renew with the
              payment provider.
            </p>
          </div>

          {canBill ? (
            <div className="flex items-end gap-3">
              <Field label={`New price (${data?.plan.currency ?? 'USD'})`} id="plan-price">
                <Input
                  id="plan-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder={data ? String(data.plan.amountMinor / 100) : '25.00'}
                />
              </Field>
              <Button variant="gold" loading={updatePlan.isPending} disabled={!price} onClick={() => updatePlan.mutate()}>
                Update price
              </Button>
            </div>
          ) : (
            <p className="rounded-xl bg-navy/[0.03] p-3.5 text-sm ft-muted dark:bg-white/[0.03]">
              Billing settings require the super-admin role. Moderators and admins cannot change pricing.
            </p>
          )}
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Platform announcement</h2>
            <p className="mt-1 text-sm ft-muted">Sends a notification to every member. Use sparingly.</p>
          </div>
          <Field label="Title" id="ann-title" required>
            <Input id="ann-title" value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} maxLength={120} />
          </Field>
          <Field label="Message" id="ann-body" required>
            <Textarea id="ann-body" value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} rows={4} maxLength={1000} />
          </Field>
          <Button
            variant="gold"
            loading={announce.isPending}
            disabled={announcementTitle.trim().length < 3 || announcementBody.trim().length < 3}
            onClick={() => announce.mutate()}
          >
            Send to everyone
          </Button>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold">Integration status</h2>
          <ul className="mt-3 space-y-2">
            {Object.entries(data?.integrations ?? {}).map(([key, enabled]) => (
              <li key={key} className="flex items-center justify-between rounded-xl bg-navy/[0.03] px-3.5 py-2.5 text-sm dark:bg-white/[0.03]">
                <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                <Badge tone={enabled ? 'verified' : 'neutral'}>{enabled ? 'configured' : 'not configured'}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed ft-muted">
            Integrations are configured with environment variables on the API and require a restart. See the deployment
            guide in the repository for each key.
          </p>
        </Card>
      </div>
    </div>
  );
}
