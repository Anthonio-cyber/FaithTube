import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { cx } from '@/lib/format';

export function AppShell() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Watch and Clips give the video the full width; the rail navigation would
  // only crowd them.
  const immersive = location.pathname.startsWith('/watch') || location.pathname.startsWith('/clips');

  useEffect(() => {
    setDrawerOpen(false);
    // Route changes return focus to the top of the document for screen readers.
    document.getElementById('ft-main')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <a href="#ft-main" className="ft-sr-only z-[100] rounded-md bg-navy px-4 py-2 text-cream focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>

      <TopBar onToggleSidebar={() => (window.innerWidth >= 1024 ? setCollapsed((v) => !v) : setDrawerOpen(true))} />

      <div className="flex">
        {!immersive ? (
          <aside
            className={cx(
              'sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 overflow-y-auto border-r border-navy/8 lg:block sm:top-16 sm:h-[calc(100vh-4rem)] dark:border-white/8',
              collapsed ? 'w-[5.5rem]' : 'w-64',
            )}
          >
            <Sidebar collapsed={collapsed} />
          </aside>
        ) : null}

        {/* Mobile drawer */}
        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-navy-deep/50" onClick={() => setDrawerOpen(false)} aria-hidden />
            <div className="absolute inset-y-0 left-0 w-72 animate-fade-up overflow-y-auto bg-cream shadow-lift dark:bg-navy-deep">
              <div className="p-3">
                <Sidebar onNavigate={() => setDrawerOpen(false)} />
              </div>
            </div>
          </div>
        ) : null}

        <main
          id="ft-main"
          tabIndex={-1}
          className={cx('min-w-0 flex-1 pb-24 outline-none lg:pb-10', immersive ? '' : 'px-3 pt-4 sm:px-5 lg:px-7')}
        >
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
