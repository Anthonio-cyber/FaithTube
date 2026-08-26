import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PublicUser } from '@faithtube/shared';
import { api, ApiError } from '@/lib/api';
import { cx, formatCount, timeAgo } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Avatar, Select } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { ReportDialog } from '@/components/moderation/ReportDialog';
import { IconFlag, IconLike } from '@/components/ui/Icons';

interface CommentItem {
  id: string;
  body: string;
  likeCount: number;
  replyCount: number;
  pinned: boolean;
  heartedByCreator: boolean;
  createdAt: string;
  editedAt: string | null;
  author: PublicUser;
  viewerLiked: boolean;
}

type Sort = 'top' | 'newest' | 'oldest';

export function CommentSection({ videoId, commentCount }: { videoId: string; commentCount: number }) {
  const { user } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<Sort>('top');
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<CommentItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['comments', videoId, sort],
    queryFn: () => api<{ items: CommentItem[]; nextCursor: string | null }>('/comments', { query: { videoId, sort } }),
  });

  const post = useMutation({
    mutationFn: (input: { body: string; parentId?: string }) =>
      api<{ comment: CommentItem | null; held?: boolean; message?: string }>('/comments', {
        method: 'POST',
        body: { videoId, ...input },
      }),
    onSuccess: (result) => {
      setBody('');
      setReplyTo(null);
      if (result.held) {
        // The classifier held or blocked it; say so plainly rather than
        // pretending the comment posted.
        push(result.message ?? 'Your comment is being reviewed.', 'warning');
      } else {
        void queryClient.invalidateQueries({ queryKey: ['comments', videoId] });
      }
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'Your comment could not be posted.', 'error'),
  });

  const like = useMutation({
    mutationFn: (id: string) => api(`/comments/${id}/like`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', videoId] }),
    onError: () => push('Sign in to react to comments.', 'warning'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/comments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      push('Comment deleted.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['comments', videoId] });
    },
  });

  const items = data?.items ?? [];

  return (
    <section aria-label="Comments">
      <div className="mb-4 flex items-center gap-4">
        <h2 className="font-display text-lg font-semibold">
          {formatCount(items.length || commentCount)} comment{(items.length || commentCount) === 1 ? '' : 's'}
        </h2>
        <Select
          value={sort}
          onChange={(event) => setSort(event.target.value as Sort)}
          aria-label="Sort comments"
          className="!h-8 !w-auto !py-0 !text-xs"
        >
          <option value="top">Top comments</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </Select>
      </div>

      {user ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (body.trim().length < 1) return;
            post.mutate({ body: body.trim(), parentId: replyTo ?? undefined });
          }}
          className="mb-6 flex gap-3"
        >
          <Avatar src={user.avatarUrl} name={user.displayName} size={38} />
          <div className="min-w-0 flex-1">
            {replyTo ? (
              <p className="mb-1.5 text-xs ft-muted">
                Replying to a comment ·{' '}
                <button type="button" onClick={() => setReplyTo(null)} className="font-medium text-gold-deep hover:underline dark:text-gold-soft">
                  cancel
                </button>
              </p>
            ) : null}
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={body ? 3 : 1}
              placeholder="Share an encouragement, a question, or what this taught you…"
              aria-label="Write a comment"
              className="w-full resize-none rounded-xl bg-white px-3.5 py-2.5 text-sm ring-1 ring-navy/12 transition focus:ring-2 focus:ring-gold dark:bg-navy-soft dark:ring-white/12"
            />
            {body ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[0.7rem] ft-muted">
                  Disagreement is welcome here. Personal attacks, spam and solicitation are not.
                </p>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setBody('')}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={post.isPending} disabled={!body.trim()}>
                    Comment
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="mb-6 rounded-xl bg-navy/[0.04] px-4 py-3 text-sm ft-muted dark:bg-white/[0.04]">
          <Link to="/signin" className="font-medium text-gold-deep hover:underline dark:text-gold-soft">
            Sign in
          </Link>{' '}
          to join the conversation.
        </p>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex gap-3">
              <div className="ft-skeleton h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="ft-skeleton h-3 w-32" />
                <div className="ft-skeleton h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length ? (
        <ul className="space-y-5">
          {items.map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              videoId={videoId}
              onLike={() => like.mutate(comment.id)}
              onReply={() => setReplyTo(comment.id)}
              onReport={() => setReportTarget(comment)}
              onDelete={comment.author.id === user?.id ? () => remove.mutate(comment.id) : undefined}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-navy/[0.03] px-4 py-8 text-center text-sm ft-muted dark:bg-white/[0.03]">
          No comments yet. Be the first to encourage this creator.
        </p>
      )}

      <ReportDialog
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        targetType="COMMENT"
        targetId={reportTarget?.id ?? ''}
        targetLabel={reportTarget?.body.slice(0, 80) ?? ''}
      />
    </section>
  );
}

function Comment({
  comment,
  videoId,
  onLike,
  onReply,
  onReport,
  onDelete,
}: {
  comment: CommentItem;
  videoId: string;
  onLike: () => void;
  onReply: () => void;
  onReport: () => void;
  onDelete?: () => void;
}) {
  const [showReplies, setShowReplies] = useState(false);

  const { data: replies } = useQuery({
    queryKey: ['comment-replies', comment.id],
    queryFn: () => api<{ items: CommentItem[] }>('/comments', { query: { videoId, parentId: comment.id, sort: 'oldest' } }),
    enabled: showReplies,
  });

  return (
    <li className="flex gap-3">
      <Link to={`/u/${comment.author.username}`} className="shrink-0">
        <Avatar src={comment.author.avatarUrl} name={comment.author.displayName} size={38} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {comment.pinned ? (
            <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-gold-deep dark:text-gold-soft">
              Pinned
            </span>
          ) : null}
          <Link to={`/u/${comment.author.username}`} className="text-sm font-medium hover:underline">
            {comment.author.displayName}
          </Link>
          {comment.author.isPremium ? (
            <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[0.6rem] font-semibold text-gold-deep dark:text-gold-soft">
              Premium
            </span>
          ) : null}
          <span className="text-xs ft-muted">
            {timeAgo(comment.createdAt)}
            {comment.editedAt ? ' · edited' : ''}
          </span>
          {comment.heartedByCreator ? (
            <span title="Hearted by the creator" aria-label="Hearted by the creator" className="text-danger">
              ♥
            </span>
          ) : null}
        </div>

        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{comment.body}</p>

        <div className="mt-1.5 flex items-center gap-1">
          <button
            type="button"
            onClick={onLike}
            aria-pressed={comment.viewerLiked}
            className={cx(
              'flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition hover:bg-navy/[0.06] dark:hover:bg-white/10',
              comment.viewerLiked && 'text-gold-deep dark:text-gold-soft',
            )}
          >
            <IconLike className="h-3.5 w-3.5" />
            {comment.likeCount || ''}
            <span className="sr-only">like this comment</span>
          </button>
          <button
            type="button"
            onClick={onReply}
            className="rounded-full px-2 py-1 text-xs font-medium transition hover:bg-navy/[0.06] dark:hover:bg-white/10"
          >
            Reply
          </button>
          <button
            type="button"
            onClick={onReport}
            aria-label="Report this comment"
            className="rounded-full px-2 py-1 text-xs transition hover:bg-navy/[0.06] dark:hover:bg-white/10"
          >
            <IconFlag className="h-3.5 w-3.5" />
          </button>
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-full px-2 py-1 text-xs text-danger transition hover:bg-danger/10"
            >
              Delete
            </button>
          ) : null}
        </div>

        {comment.replyCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowReplies((value) => !value)}
            className="mt-1.5 text-xs font-medium text-gold-deep hover:underline dark:text-gold-soft"
          >
            {showReplies ? 'Hide' : 'Show'} {comment.replyCount} repl{comment.replyCount === 1 ? 'y' : 'ies'}
          </button>
        ) : null}

        {showReplies && replies?.items.length ? (
          <ul className="mt-3 space-y-4 border-l-2 border-navy/8 pl-4 dark:border-white/8">
            {replies.items.map((reply) => (
              <li key={reply.id} className="flex gap-2.5">
                <Avatar src={reply.author.avatarUrl} name={reply.author.displayName} size={30} />
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{reply.author.displayName}</span>{' '}
                    <span className="text-xs ft-muted">{timeAgo(reply.createdAt)}</span>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{reply.body}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}
