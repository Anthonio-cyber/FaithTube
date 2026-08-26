import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { VideoSummary } from '@faithtube/shared';
import { api } from '@/lib/api';
import { useConfig } from '@/context/ConfigContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { VideoCard } from '@/components/video/VideoCard';
import { Card, EmptyState, Skeleton } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { IconBook, IconSearch, IconSparkle } from '@/components/ui/Icons';

interface Verse {
  reference: string;
  text: string;
  topics: string[];
}

interface BibleResponse {
  query: string;
  scripture: {
    translation: { id: string; name: string; publicDomain: boolean };
    verses: Verse[];
    matchedTopics: string[];
  };
  aiSummary: { text: string; model: string; disclaimer: string } | null;
  videos: VideoSummary[];
  sermonsOnThesePassages: VideoSummary[];
}

const EXAMPLES = [
  'What does the Bible say about forgiveness?',
  'Romans 8',
  'Verses about anxiety and worry',
  'How should I pray?',
  'Psalm 23',
  'What does Scripture say about money?',
];

/**
 * Bible Search.
 *
 * The design keeps Scripture and AI commentary visibly separate: passages sit in
 * their own card with the translation named, and any generated explanation is
 * boxed, labelled, and carries its disclaimer. Nothing generated is ever styled
 * to look like the Bible text.
 */
export default function BibleSearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [draft, setDraft] = useState(q);
  const { features } = useConfig();

  const { data, isLoading } = useQuery({
    queryKey: ['bible', q],
    queryFn: () => api<BibleResponse>('/search/bible', { query: { q } }),
    enabled: q.trim().length > 1,
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (draft.trim()) setParams({ q: draft.trim() });
  }

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <PageHeader
        eyebrow="Ministry"
        title="Bible Search"
        description="Ask a question in your own words, or name a passage. You will get the Scripture itself, alongside teaching from FaithTube creators on it."
      />

      <form onSubmit={submit} role="search" className="mb-8">
        <label htmlFor="bible-query" className="sr-only">
          Ask a question or name a passage
        </label>
        <div className="relative">
          <IconBook className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gold-deep dark:text-gold-soft" />
          <input
            id="bible-query"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What does the Bible say about…"
            className="h-14 w-full rounded-2xl bg-white pl-12 pr-28 text-[0.95rem] ring-1 ring-navy/12 transition focus:ring-2 focus:ring-gold dark:bg-navy-soft dark:ring-white/12"
          />
          <Button type="submit" variant="gold" className="absolute right-2 top-2 !h-10">
            <IconSearch className="h-4 w-4" />
            Search
          </Button>
        </div>
      </form>

      {!q ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide ft-muted">Try one of these</h2>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setDraft(example);
                  setParams({ q: example });
                }}
                className="rounded-full bg-navy/[0.05] px-4 py-2 text-sm transition hover:bg-navy/[0.1] dark:bg-white/[0.06] dark:hover:bg-white/[0.12]"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-8">
          {data?.scripture.verses.length ? (
            <section aria-label="Scripture">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg font-semibold">Scripture</h2>
                <span className="text-xs ft-muted">
                  {data.scripture.translation.name}
                  {data.scripture.translation.publicDomain ? ' · public domain' : ''}
                </span>
              </div>
              <div className="space-y-3">
                {data.scripture.verses.map((verse) => (
                  <Card key={verse.reference} className="!bg-cream !p-5 ring-gold/25 dark:!bg-navy-soft">
                    <p className="font-display text-sm font-semibold text-gold-deep dark:text-gold-soft">
                      {verse.reference}
                    </p>
                    <p className="mt-2 font-display text-[1.05rem] leading-relaxed">{verse.text}</p>
                  </Card>
                ))}
              </div>
            </section>
          ) : (
            <EmptyState
              title="No passage matched that"
              description="Try naming a book and chapter, like “Philippians 4”, or asking about a topic such as forgiveness, fear or prayer."
            />
          )}

          {data?.aiSummary ? (
            <section aria-label="AI explanation">
              <div className="rounded-2xl border-2 border-dashed border-plum/30 bg-plum/[0.04] p-5">
                <div className="mb-2 flex items-center gap-2">
                  <IconSparkle className="h-4 w-4 text-plum dark:text-purple-300" />
                  <h2 className="text-sm font-semibold text-plum dark:text-purple-300">
                    AI-generated explanation — not Scripture
                  </h2>
                </div>
                <p className="ft-prose whitespace-pre-wrap">{data.aiSummary.text}</p>
                <p className="mt-3 border-t border-plum/20 pt-3 text-xs leading-relaxed ft-muted">
                  {data.aiSummary.disclaimer}
                </p>
              </div>
            </section>
          ) : q && !features.aiModeration ? (
            <p className="rounded-xl bg-navy/[0.04] px-4 py-3 text-xs ft-muted dark:bg-white/[0.04]">
              AI-assisted explanations are not enabled on this deployment. The Scripture above and the teaching below
              come from the platform itself.
            </p>
          ) : null}

          {data?.sermonsOnThesePassages.length ? (
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold">Teaching on these passages</h2>
              <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                {data.sermonsOnThesePassages.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            </section>
          ) : null}

          {data?.videos.length ? (
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold">Related videos</h2>
              <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                {data.videos.slice(0, 9).map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
