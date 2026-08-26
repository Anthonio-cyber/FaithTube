import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { formatCount, timeAgo } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar, Badge, Card, EmptyState, Field, Input, Select, Textarea } from '@/components/ui';
import { Button } from '@/components/ui/Button';

export function StudioCommentsPage() {
  const { push } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['held-comments'],
    queryFn: () =>
      api<{
        items: Array<{
          id: string;
          body: string;
          createdAt: string;
          label: string | null;
          score: number;
          author: { displayName: string; username: string; avatarUrl: string | null };
          video: { id: string; slug: string; title: string };
        }>;
      }>('/comments/held'),
  });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'remove' }) =>
      api(`/comments/${id}/creator-action`, { method: 'POST', body: { action } }),
    onSuccess: (_result, variables) => {
      push(variables.action === 'approve' ? 'Comment published.' : 'Comment removed.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['held-comments'] });
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Creator Studio"
        title="Comments held for review"
        description="Our classifier held these because they looked like spam, solicitation or abuse. It does not hold comments for disagreeing with you — read each one and decide."
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="ft-skeleton h-24 rounded-2xl" />
          ))}
        </div>
      ) : data?.items.length ? (
        <div className="space-y-3">
          {data.items.map((comment) => (
            <Card key={comment.id}>
              <div className="flex items-start gap-3">
                <Avatar src={comment.author.avatarUrl} name={comment.author.displayName} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{comment.author.displayName}</span>
                    <span className="text-xs ft-muted">{timeAgo(comment.createdAt)}</span>
                    {comment.label ? (
                      <Badge tone="warn">
                        {comment.label} · {Math.round(comment.score * 100)}%
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{comment.body}</p>
                  <Link to={`/watch/${comment.video.slug}`} className="mt-1.5 block truncate text-xs text-gold-deep hover:underline dark:text-gold-soft">
                    on “{comment.video.title}”
                  </Link>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => act.mutate({ id: comment.id, action: 'remove' })}>
                  Remove
                </Button>
                <Button variant="gold" size="sm" onClick={() => act.mutate({ id: comment.id, action: 'approve' })}>
                  Publish
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Nothing held" description="Comments that need your judgement will appear here." />
      )}
    </div>
  );
}

export function StudioCommunityPage() {
  const { push } = useToast();
  const [type, setType] = useState('TEXT');
  const [body, setBody] = useState('');
  const [scriptureRef, setScriptureRef] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  const post = useMutation({
    mutationFn: () =>
      api<{ held: boolean }>('/studio/community', {
        method: 'POST',
        body: {
          type,
          body: body.trim(),
          scriptureRef: scriptureRef.trim() || undefined,
          pollOptions: type === 'POLL' ? pollOptions.filter(Boolean) : undefined,
        },
      }),
    onSuccess: (result) => {
      if (result.held) push('Your post is being reviewed before it appears.', 'warning');
      else push('Posted to your community.', 'success');
      setBody('');
      setScriptureRef('');
      setPollOptions(['', '']);
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'Your post could not be published.', 'error'),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Creator Studio"
        title="Community post"
        description="Share an update, ask your congregation a question, run a poll, or post the verse you are sitting with this week."
      />

      <Card className="space-y-5">
        <Field label="Post type" id="cp-type">
          <Select id="cp-type" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="TEXT">Text update</option>
            <option value="VERSE">Bible verse</option>
            <option value="QUESTION">Question</option>
            <option value="POLL">Poll</option>
            <option value="ANNOUNCEMENT">Announcement</option>
          </Select>
        </Field>

        {type === 'VERSE' ? (
          <Field label="Reference" id="cp-ref" hint="For example: Romans 8:28">
            <Input id="cp-ref" value={scriptureRef} onChange={(event) => setScriptureRef(event.target.value)} maxLength={60} />
          </Field>
        ) : null}

        <Field label="Message" id="cp-body" required>
          <Textarea id="cp-body" value={body} onChange={(event) => setBody(event.target.value)} rows={5} maxLength={4000} />
        </Field>

        {type === 'POLL' ? (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Poll options</legend>
            {pollOptions.map((option, index) => (
              <Input
                key={index}
                value={option}
                onChange={(event) => {
                  const next = [...pollOptions];
                  next[index] = event.target.value;
                  setPollOptions(next);
                }}
                placeholder={`Option ${index + 1}`}
                maxLength={120}
                aria-label={`Poll option ${index + 1}`}
              />
            ))}
            {pollOptions.length < 6 ? (
              <Button variant="ghost" size="sm" onClick={() => setPollOptions([...pollOptions, ''])}>
                Add option
              </Button>
            ) : null}
          </fieldset>
        ) : null}

        <p className="text-xs ft-muted">
          Community posts follow the same guidelines as videos. Anything that reads as spam or solicitation is held for
          review before it reaches your subscribers.
        </p>

        <Button variant="gold" fullWidth loading={post.isPending} disabled={body.trim().length < 1} onClick={() => post.mutate()}>
          Publish post
        </Button>
      </Card>
    </div>
  );
}

export function StudioAudiencePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['studio-audience'],
    queryFn: () =>
      api<{
        total: number;
        recent: Array<{ displayName: string; username: string; avatarUrl: string | null; country: string | null; subscribedAt: string }>;
        byCountry: Array<{ country: string | null; count: number }>;
      }>('/studio/audience'),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Creator Studio"
        title="Your audience"
        description="Who is following your channel. Subscriber count does not generate income on FaithTube — these are people to serve, not a number to grow."
      />

      {isLoading ? (
        <div className="ft-skeleton h-64 rounded-2xl" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Card>
            <h2 className="mb-3 font-display text-base font-semibold">Recent subscribers</h2>
            {data?.recent.length ? (
              <ul className="space-y-2.5">
                {data.recent.map((person) => (
                  <li key={person.username} className="flex items-center gap-3">
                    <Avatar src={person.avatarUrl} name={person.displayName} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{person.displayName}</p>
                      <p className="text-xs ft-muted">
                        @{person.username}
                        {person.country ? ` · ${person.country}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs ft-muted">{timeAgo(person.subscribedAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm ft-muted">No subscribers yet.</p>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-semibold">By country</h2>
            {data?.byCountry.length ? (
              <ul className="space-y-2 text-sm">
                {data.byCountry.map((row) => (
                  <li key={row.country} className="flex justify-between">
                    <span>{row.country}</span>
                    <span className="tabular-nums ft-muted">{formatCount(row.count)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm ft-muted">Not enough data yet.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
