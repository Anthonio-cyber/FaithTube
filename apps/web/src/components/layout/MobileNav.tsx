import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { MOBILE_NAV } from './navigation';
import { cx } from '@/lib/format';

/**
 * Mobile bottom navigation. The "Create" action sits in the centre as a raised
 * gold control — the platform's own shape, not a copy of another app's bar.
 */
export function MobileNav() {
  const { user } = useAuth();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/10 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden dark:border-white/10 dark:bg-navy-deep/95"
    >
      <ul className="flex items-stretch justify-around">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const isCreate = item.label === 'Create';
          const to = item.requiresAuth && !user ? '/signin' : item.to;

          if (isCreate) {
            return (
              <li key={item.to} className="flex items-center px-1">
                <NavLink
                  to={to}
                  aria-label="Upload a video"
                  className="-mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gilt text-navy shadow-lift transition active:scale-95"
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden>
                    <path d="M12 6v12M6 12h12" />
                  </svg>
                </NavLink>
              </li>
            );
          }

          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'flex flex-col items-center gap-0.5 py-2 text-[0.62rem] font-medium transition',
                    isActive ? 'text-gold-deep dark:text-gold-soft' : 'text-navy/55 dark:text-cream/55',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-[1.35rem] w-[1.35rem]" />
                    <span>{item.label}</span>
                    <span
                      className={cx('h-0.5 w-5 rounded-full transition-colors', isActive ? 'bg-gold' : 'bg-transparent')}
                      aria-hidden
                    />
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
