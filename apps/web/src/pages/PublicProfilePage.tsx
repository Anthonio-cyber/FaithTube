import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatCount, formatDate } from '@/lib/format';
import { api } from '@/lib/api';
import { Avatar, Badge, Card, EmptyState } from '@/components/ui';

export default function PublicProfilePage() {
  const { username = '' } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['profile', username],
    queryFn: () =>
      api<{
        user: {
          id: string;
          displayName: string;
          username: string;
          avatarUrl: string | null;
          bio: string | null;
          email: string | null;
          isPremium: boolean;
          createdAt: string;
          channel: { id: string; handle: string; name: string; avatarUrl: string | null; subscriberCount: number } | null;
        };
        playlists: Array<{ id: string; title: string; itemCount: number }>;
      }>(`/users/${username}`),
  });

  if (isLoading) return <div className="py-20 text-center text-sm ft-muted">Loading profile…</div>;
  if (!data) return <EmptyState title="No such person" description="This profile may have been closed." />;

  const { user, playlists } = data;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <Avatar src={user.avatarUrl} name={user.displayName} size={88} />
        <div>
          <h1 className="flex flex-wrap items-center justify-center gap-2 font-display text-2xl font-semibold sm:justify-start">
            {user.displayName}
            {user.isPremium ? <Badge tone="gold">Premium</Badge> : null}
          </h1>
          <p className="mt-1 text-sm ft-muted">
            @{user.username} · joined {formatDate(user.createdAt)}
          </p>
          {user.bio ? <p className="mt-2 max-w-xl text-sm leading-relaxed">{user.bio}</p> : null}
          {/* Shown only when this person chose to make it public. */}
          {user.email ? <p className="mt-1 text-sm ft-muted">{user.email}</p> : null}
        </div>
      </div>

      {user.channel ? (
        <Card className="mb-6">
          <h2 className="mb-3 font-display text-base font-semibold">Channel</h2>
          <Link to={`/channel/${user.channel.handle}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-navy/[0.04] dark:hover:bg-white/5">
            <Avatar src={user.channel.avatarUrl} name={user.channel.name} size={44} />
            <div>
              <p className="font-medium">{user.channel.name}</p>
              <p className="text-sm ft-muted">{formatCount(user.channel.subscriberCount)} subscribers</p>
            </div>
          </Link>
        </Card>
      ) : null}

      {playlists.length ? (
        <Card>
          <h2 className="mb-3 font-display text-base font-semibold">Public playlists</h2>
          <ul className="space-y-1">
            {playlists.map((playlist) => (
              <li key={playlist.id}>
                <Link to={`/playlists/${playlist.id}`} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition hover:bg-navy/[0.04] dark:hover:bg-white/5">
                  <span>{playlist.title}</span>
                  <span className="text-xs ft-muted">{playlist.itemCount} videos</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
