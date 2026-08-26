import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar, Card, EmptyState } from '@/components/ui';
import { LinkButton } from '@/components/ui/Button';

/**
 * The Connect → Community view: updates from every channel the viewer follows,
 * gathered into one feed rather than scattered across channel pages.
 */
export default function CommunityPage() {
  const { user } = useAuth();

  const { data: subscriptions } = useQuery({
    queryKey: ['my-subscriptions'],
    queryFn: () => api<{ items: Array<{ id: string; handle: string; name: string; avatarUrl: string | null }> }>('/channels/me/subscriptions'),
    enabled: Boolean(user),
  });

  const channels = subscriptions?.items ?? [];

  const { data: posts } = useQuery({
    queryKey: ['community-feed', channels.map((channel) => channel.handle).join(',')],
    queryFn: async () => {
      // The API serves community posts per channel; the combined feed is
      // assembled here so a channel page and this view stay consistent.
      const results = await Promise.all(
        channels.slice(0, 12).map(async (channel) => {
          const data = await api<{ items: Array<{ id: string; type: string; body: string; scriptureRef: string | null; createdAt: string }> }>(
            `/community/${channel.handle}`,
          ).catch(() => ({ items: [] }));
          return data.items.map((post) => ({ ...post, channel }));
        }),
      );
      return results.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40);
    },
    enabled: channels.length > 0,
  });

  if (!user) {
    return (
      <div className="py-16">
        <EmptyState
          title="Sign in to see your community"
          description="Posts from the channels you follow gather here."
          action={
            <LinkButton to="/signin" variant="gold">
              Sign in
            </LinkButton>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Connect" title="Community" description="Updates, questions, polls and verses from the channels you follow." />

      {posts?.length ? (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <Link to={`/channel/${post.channel.handle}?tab=community`} className="flex items-center gap-2.5">
                <Avatar src={post.channel.avatarUrl} name={post.channel.name} size={34} />
                <div>
                  <p className="text-sm font-medium">{post.channel.name}</p>
                  <p className="text-xs ft-muted">{timeAgo(post.createdAt)}</p>
                </div>
              </Link>
              {post.scriptureRef ? (
                <p className="mt-3 text-sm font-medium text-gold-deep dark:text-gold-soft">{post.scriptureRef}</p>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{post.body}</p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nothing here yet"
          description={
            channels.length
              ? 'The channels you follow have not posted any community updates.'
              : 'Follow some channels and their community posts will appear here.'
          }
          action={
            <LinkButton to="/categories" variant="outline" size="sm">
              Find channels
            </LinkButton>
          }
        />
      )}
    </div>
  );
}
