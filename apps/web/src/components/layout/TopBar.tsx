import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { hasRole } from '@faithtube/shared';
import { api } from '@/lib/api';
import { cx } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Wordmark } from '@/components/brand/Logo';
import { Avatar } from '@/components/ui';
import { Button, LinkButton } from '@/components/ui/Button';
import {
  IconBell,
  IconBook,
  IconChart,
  IconClose,
  IconMenu,
  IconMoon,
  IconPremium,
  IconSearch,
  IconSettings,
  IconShield,
  IconSun,
  IconUpload,
} from '@/components/ui/Icons';

export function TopBar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { user, signOut } = useAuth();
  const { resolved, setTheme } = useTheme();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: notifications } = useQuery({
    queryKey: ['notifications-badge'],
    queryFn: () => api<{ unreadCount: number }>('/notifications', { query: { limit: 1 } }),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });

  // Type-ahead against real titles, channels and categories.
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const data = await api<{ items: string[] }>('/search/suggest', { query: { q: query.trim() } });
        setSuggestions(data.items);
      } catch {
        setSuggestions([]);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSuggestions([]);
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // "/" focuses search, the way a keyboard-first user expects.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(target.tagName) && !target.isContentEditable) {
        event.preventDefault();
        setSearchOpen(true);
        window.setTimeout(() => document.getElementById('ft-search-input')?.focus(), 20);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    setSuggestions([]);
    setSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-navy/8 bg-cream/90 backdrop-blur-md dark:border-white/8 dark:bg-navy-deep/90">
      <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4 lg:px-6">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
          className="hidden rounded-xl p-2 text-navy/70 transition hover:bg-navy/5 lg:block dark:text-cream/70 dark:hover:bg-white/5"
        >
          <IconMenu className="h-5 w-5" />
        </button>

        <Link to="/" className="shrink-0" aria-label="FaithTube home">
          <Wordmark className="text-navy dark:text-cream" />
        </Link>

        <form
          ref={searchRef}
          onSubmit={submit}
          role="search"
          className={cx(
            'relative mx-auto w-full max-w-2xl',
            searchOpen ? 'absolute inset-x-3 top-2 z-50 sm:static sm:inset-auto' : 'hidden sm:block',
          )}
        >
          <label htmlFor="ft-search-input" className="sr-only">
            Search FaithTube
          </label>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-[1.15rem] w-[1.15rem] -translate-y-1/2 text-navy/40 dark:text-cream/40" />
            <input
              id="ft-search-input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sermons, Scripture, channels…"
              autoComplete="off"
              className="h-10 w-full rounded-full bg-white pl-11 pr-24 text-sm ring-1 ring-navy/12 transition placeholder:text-navy/35 focus:ring-2 focus:ring-gold dark:bg-navy-soft dark:ring-white/12 dark:placeholder:text-cream/35"
            />
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <Link
                to="/bible"
                title="Bible Search — ask a question and get Scripture with it"
                className="hidden rounded-full p-1.5 text-gold-deep transition hover:bg-gold/10 sm:block dark:text-gold-soft"
              >
                <IconBook className="h-[1.15rem] w-[1.15rem]" />
                <span className="sr-only">Bible Search</span>
              </Link>
              <button type="submit" className="rounded-full bg-navy px-3 py-1.5 text-xs font-medium text-cream dark:bg-white/15">
                Search
              </button>
            </div>
          </div>

          {suggestions.length ? (
            <ul className="absolute inset-x-0 top-12 z-50 overflow-hidden rounded-xl bg-white py-1 shadow-lift ring-1 ring-navy/10 dark:bg-navy-soft dark:ring-white/10">
              {suggestions.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery(item);
                      setSuggestions([]);
                      navigate(`/search?q=${encodeURIComponent(item)}`);
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition hover:bg-navy/[0.04] dark:hover:bg-white/5"
                  >
                    <IconSearch className="h-4 w-4 shrink-0 text-navy/35 dark:text-cream/35" />
                    <span className="truncate">{item}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </form>

        <button
          type="button"
          onClick={() => setSearchOpen((value) => !value)}
          aria-label={searchOpen ? 'Close search' : 'Search'}
          className="ml-auto rounded-xl p-2 text-navy/70 transition hover:bg-navy/5 sm:hidden dark:text-cream/70"
        >
          {searchOpen ? <IconClose className="h-5 w-5" /> : <IconSearch className="h-5 w-5" />}
        </button>

        <div className="flex shrink-0 items-center gap-1 sm:ml-0">
          <button
            type="button"
            onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
            aria-label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="hidden rounded-xl p-2 text-navy/70 transition hover:bg-navy/5 sm:block dark:text-cream/70 dark:hover:bg-white/5"
          >
            {resolved === 'dark' ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />}
          </button>

          {user ? (
            <>
              <Link
                to="/upload"
                className="hidden rounded-xl p-2 text-navy/70 transition hover:bg-navy/5 sm:block dark:text-cream/70 dark:hover:bg-white/5"
                aria-label="Upload a video"
                title="Upload"
              >
                <IconUpload className="h-5 w-5" />
              </Link>

              <Link
                to="/notifications"
                className="relative rounded-xl p-2 text-navy/70 transition hover:bg-navy/5 dark:text-cream/70 dark:hover:bg-white/5"
                aria-label={
                  notifications?.unreadCount
                    ? `Notifications, ${notifications.unreadCount} unread`
                    : 'Notifications'
                }
              >
                <IconBell className="h-5 w-5" />
                {notifications?.unreadCount ? (
                  <span className="absolute right-1 top-1 min-w-[1.05rem] rounded-full bg-danger px-1 text-center text-[0.6rem] font-bold leading-[1.05rem] text-white">
                    {notifications.unreadCount > 9 ? '9+' : notifications.unreadCount}
                  </span>
                ) : null}
              </Link>

              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((value) => !value)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="ml-1 rounded-full ring-2 ring-transparent transition hover:ring-gold/40"
                >
                  <Avatar src={user.avatarUrl} name={user.displayName} size={32} />
                  <span className="sr-only">Account menu</span>
                </button>

                {menuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-2xl bg-white py-1.5 shadow-lift ring-1 ring-navy/10 dark:bg-navy-soft dark:ring-white/10"
                  >
                    <div className="flex items-center gap-3 border-b border-navy/8 px-4 py-3 dark:border-white/8">
                      <Avatar src={user.avatarUrl} name={user.displayName} size={40} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{user.displayName}</p>
                        <p className="truncate text-xs ft-muted">@{user.username}</p>
                        {user.isPremium ? (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[0.65rem] font-medium text-gold-deep dark:text-gold-soft">
                            <IconPremium className="h-3 w-3" /> Premium
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <MenuLink to={`/u/${user.username}`} icon={<IconSettings className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                      Your profile
                    </MenuLink>
                    {user.channelHandle ? (
                      <MenuLink to={`/channel/${user.channelHandle}`} icon={<IconChart className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                        Your channel
                      </MenuLink>
                    ) : null}
                    <MenuLink to="/studio" icon={<IconChart className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                      Creator Studio
                    </MenuLink>
                    {hasRole(user.role, 'MODERATOR') ? (
                      <MenuLink to="/admin" icon={<IconShield className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                        Moderation Center
                      </MenuLink>
                    ) : null}
                    <MenuLink to="/premium" icon={<IconPremium className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                      {user.isPremium ? 'Manage Premium' : 'Get Premium'}
                    </MenuLink>
                    <MenuLink to="/settings" icon={<IconSettings className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                      Settings
                    </MenuLink>

                    <div className="mt-1 border-t border-navy/8 pt-1 dark:border-white/8">
                      <button
                        type="button"
                        onClick={async () => {
                          setMenuOpen(false);
                          await signOut();
                          navigate('/');
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-danger transition hover:bg-danger/5"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <LinkButton to="/signin" variant="outline" size="sm" className="hidden sm:inline-flex">
                Sign in
              </LinkButton>
              <LinkButton to="/signup" variant="gold" size="sm">
                Join
              </LinkButton>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuLink({
  to,
  icon,
  children,
  onClick,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2 text-sm transition hover:bg-navy/[0.04] dark:hover:bg-white/5"
    >
      <span className="text-navy/50 dark:text-cream/50">{icon}</span>
      {children}
    </Link>
  );
}

export { Button };
