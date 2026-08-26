import { NavLink } from 'react-router-dom';
import { hasRole } from '@faithtube/shared';
import { useAuth } from '@/context/AuthContext';
import { cx } from '@/lib/format';
import { CREATOR_ITEMS, NAV_GROUPS, PROFILE_ITEMS, STAFF_ITEMS, type NavItem } from './navigation';
import { LinkButton } from '@/components/ui/Button';

export function Sidebar({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { user } = useAuth();

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.requiresAuth || user),
  })).filter((group) => group.items.length);

  return (
    <nav aria-label="Main" className={cx('flex h-full flex-col gap-1 overflow-y-auto pb-6', collapsed ? 'px-1.5' : 'px-3')}>
      {groups.map((group) => (
        <div key={group.id} className="pb-1.5">
          {!collapsed ? (
            <h2 className="px-3 pb-1 pt-3.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-navy/40 dark:text-cream/40">
              {group.label}
            </h2>
          ) : (
            <div className="my-2 border-t border-navy/10 dark:border-white/10" />
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <SidebarLink item={item} collapsed={collapsed} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}

      {user && hasRole(user.role, 'CREATOR') ? (
        <Section label="Studio" collapsed={collapsed} items={CREATOR_ITEMS} onNavigate={onNavigate} />
      ) : null}
      {user && hasRole(user.role, 'MODERATOR') ? (
        <Section label="Staff" collapsed={collapsed} items={STAFF_ITEMS} onNavigate={onNavigate} />
      ) : null}
      <Section label="Account" collapsed={collapsed} items={PROFILE_ITEMS.filter((i) => !i.requiresAuth || user)} onNavigate={onNavigate} />

      {!collapsed ? (
        <div className="mt-4 px-3">
          {!user ? (
            <div className="rounded-2xl bg-navy p-4 text-cream dark:bg-white/[0.06]">
              <p className="font-display text-sm font-semibold">Join FaithTube</p>
              <p className="mt-1 text-xs text-cream/70">
                Subscribe to channels, build playlists and keep your place in every teaching.
              </p>
              <LinkButton to="/signin" variant="gold" size="sm" className="mt-3 w-full">
                Sign in
              </LinkButton>
            </div>
          ) : null}

          <div className="mt-5 space-y-2 px-1 text-[0.7rem] leading-relaxed text-navy/45 dark:text-cream/40">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <NavLink to="/about" className="hover:underline">About</NavLink>
              <NavLink to="/content-policy" className="hover:underline">Content Policy</NavLink>
              <NavLink to="/help" className="hover:underline">Help</NavLink>
              <NavLink to="/privacy" className="hover:underline">Privacy</NavLink>
              <NavLink to="/terms" className="hover:underline">Terms</NavLink>
            </div>
            <p className="pt-1">Every Video. Christ-Centered.</p>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

function Section({
  label,
  items,
  collapsed,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  if (!items.length) return null;
  return (
    <div className="pb-1.5">
      {!collapsed ? (
        <h2 className="px-3 pb-1 pt-3.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-navy/40 dark:text-cream/40">
          {label}
        </h2>
      ) : (
        <div className="my-2 border-t border-navy/10 dark:border-white/10" />
      )}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <SidebarLink item={item} collapsed={collapsed} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidebarLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed?: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cx(
          'flex items-center rounded-xl text-sm font-medium transition',
          collapsed ? 'flex-col gap-1 px-1 py-2.5 text-[0.6rem]' : 'gap-3 px-3 py-2',
          isActive
            ? 'bg-gold/12 text-gold-deep dark:bg-gold/15 dark:text-gold-soft'
            : 'text-navy/70 hover:bg-navy/[0.05] hover:text-navy dark:text-cream/70 dark:hover:bg-white/[0.06] dark:hover:text-cream',
        )
      }
      title={collapsed ? item.label : undefined}
    >
      <Icon className={collapsed ? 'h-5 w-5' : 'h-[1.15rem] w-[1.15rem]'} />
      <span className={collapsed ? 'text-center leading-tight' : ''}>{item.label}</span>
    </NavLink>
  );
}
