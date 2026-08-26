import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VideoSource, VideoSummary } from '@faithtube/shared';

/** The clips feed carries playable sources so scrolling never waits on a fetch. */
type Clip = VideoSummary & { sources: VideoSource[] };
import { api } from '@/lib/api';
import { formatCount } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { ReportDialog } from '@/components/moderation/ReportDialog';
import { Avatar, EmptyState } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { IconClips, IconComment, IconFlag, IconLike, IconSave, IconShare } from '@/components/ui/Icons';

/**
 * Faith Clips — the vertical short-form feed.
 *
 * One clip fills the viewport and an IntersectionObserver decides which is
 * "current", so only that one plays. Every clip has passed the same moderation
 * as a full-length video.
 */
export default function ClipsPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [activeIndex, setActiveIndex] = useState(0);
  const [reportTarget, setReportTarget] = useState<Clip | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['clips'],
    queryFn: () => api<{ items: Clip[] }>('/discover/clips', { query: { limit: 20 } }),
  });

  const clips = data?.items ?? [];

  const like = useMutation({
    mutationFn: (id: string) => api(`/videos/${id}/like`, { method: 'POST', body: { value: 1 } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clips'] }),
    onError: () => push('Sign in to react to clips.', 'warning'),
  });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setActiveIndex(Number((entry.target as HTMLElement).dataset.index));
          }
        }
      },
      { root: node, threshold: [0.6] },
    );
    node.querySelectorAll('[data-index]').forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [clips.length]);

  if (!isLoading && !clips.length) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <EmptyState
          icon={<IconClips className="h-8 w-8" />}
          title="No Faith Clips yet"
          description="Short vertical videos appear here once creators upload them and they pass review."
        />
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="ft-no-scrollbar h-[calc(100vh-3.5rem)] snap-y snap-mandatory overflow-y-scroll bg-navy-deep sm:h-[calc(100vh-4rem)]"
      >
        {clips.map((clip, index) => (
          <section
            key={clip.id}
            data-index={index}
            className="relative flex h-full snap-start items-center justify-center px-2 py-3"
            aria-label={clip.title}
          >
            <div className="relative h-full max-h-[calc(100vh-6rem)] w-full max-w-[26rem]">
              {Math.abs(index - activeIndex) <= 1 ? (
                <VideoPlayer
                  sources={clip.sources}
                  poster={clip.thumbnailUrl}
                  title={clip.title}
                  categorySlug={clip.categorySlug}
                  vertical
                  autoPlay={index === activeIndex}
                />
              ) : (
                <div className="h-full w-full rounded-2xl bg-navy-soft" />
              )}

              <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/85 to-transparent p-4 pt-16">
                <div className="pointer-events-auto flex items-end gap-4">
                  <div className="min-w-0 flex-1 text-cream">
                    <Link to={`/channel/${clip.channel.handle}`} className="flex items-center gap-2">
                      <Avatar src={clip.channel.avatarUrl} name={clip.channel.name} size={30} />
                      <span className="truncate text-sm font-medium">{clip.channel.name}</span>
                    </Link>
                    <h2 className="mt-2 ft-line-clamp-2 text-sm leading-snug">{clip.title}</h2>
                    <p className="mt-1 text-xs text-cream/55">{formatCount(clip.viewCount)} views</p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-3">
                    <ClipAction icon={<IconLike />} label={formatCount(clip.likeCount)} onClick={() => like.mutate(clip.id)} />
                    <ClipAction icon={<IconComment />} label="" onClick={() => push('Open the full video to comment.', 'info')} />
                    <ClipAction
                      icon={<IconSave />}
                      label=""
                      onClick={() =>
                        user
                          ? void api(`/videos/${clip.id}/save`, { method: 'POST' }).then(() => push('Saved.', 'success'))
                          : push('Sign in to save clips.', 'warning')
                      }
                    />
                    <ClipAction
                      icon={<IconShare />}
                      label=""
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(`${window.location.origin}/watch/${clip.slug}`)
                          .then(() => push('Link copied.', 'success'))
                          .catch(() => undefined);
                      }}
                    />
                    <ClipAction icon={<IconFlag />} label="" onClick={() => setReportTarget(clip)} />
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <ReportDialog
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        targetType="VIDEO"
        targetId={reportTarget?.id ?? ''}
        targetLabel={reportTarget?.title ?? ''}
      />
    </>
  );
}

function ClipAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 text-cream transition active:scale-90">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">{icon}</span>
      {label ? <span className="text-[0.68rem] font-medium">{label}</span> : null}
    </button>
  );
}

export { Button };
