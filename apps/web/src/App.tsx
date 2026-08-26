import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/Button';

// Route-level code splitting keeps the first paint small on a slow connection.
const HomePage = lazy(() => import('@/pages/HomePage'));
const WatchPage = lazy(() => import('@/pages/WatchPage'));
const SearchPage = lazy(() => import('@/pages/SearchPage'));
const BibleSearchPage = lazy(() => import('@/pages/BibleSearchPage'));
const ClipsPage = lazy(() => import('@/pages/ClipsPage'));
const ChannelPage = lazy(() => import('@/pages/ChannelPage'));
const UploadPage = lazy(() => import('@/pages/UploadPage'));
const PremiumPage = lazy(() => import('@/pages/PremiumPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const AuthPage = lazy(() => import('@/pages/AuthPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const GoogleCallbackPage = lazy(() => import('@/pages/GoogleCallbackPage'));
const PublicProfilePage = lazy(() => import('@/pages/PublicProfilePage'));
const CommunityPage = lazy(() => import('@/pages/CommunityPage'));
const StudioAnalyticsPage = lazy(() => import('@/pages/studio/StudioAnalyticsPage'));
const AdminModerationPage = lazy(() => import('@/pages/admin/AdminModerationPage'));

function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <Spinner className="h-6 w-6 text-gold" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Full-bleed routes without the app shell. */}
        <Route path="/signin" element={<AuthPage mode="signin" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/welcome" element={<OnboardingPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />

        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="/watch/:slug" element={<WatchPage />} />
          {/* /video/:id is kept as an alias so older links keep working. */}
          <Route path="/video/:slug" element={<WatchPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/bible" element={<BibleSearchPage />} />
          <Route path="/clips" element={<ClipsPage />} />
          <Route path="/shorts" element={<Navigate to="/clips" replace />} />
          <Route path="/trending" element={<TrendingRoute />} />
          <Route path="/categories" element={<CategoriesRoute />} />
          <Route path="/categories/:slug" element={<CategoryRoute />} />
          <Route path="/channel/:handle" element={<ChannelPage />} />
          <Route path="/u/:username" element={<PublicProfilePage />} />
          <Route path="/live" element={<LiveRoute />} />
          <Route path="/live/:id" element={<LiveStreamRoute />} />

          <Route path="/library" element={<LibraryRoute />} />
          <Route path="/history" element={<HistoryRoute />} />
          <Route path="/playlists" element={<PlaylistsRoute />} />
          <Route path="/playlists/:id" element={<PlaylistDetailRoute />} />
          <Route path="/subscriptions" element={<SubscriptionsRoute />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/notifications" element={<NotificationsRoute />} />

          <Route path="/upload" element={<UploadPage />} />
          <Route path="/studio" element={<StudioRoute />} />
          <Route path="/studio/videos" element={<StudioVideosRoute />} />
          <Route path="/studio/videos/:id" element={<StudioVideoDetailRoute />} />
          <Route path="/studio/analytics" element={<StudioAnalyticsPage />} />
          <Route path="/studio/comments" element={<StudioCommentsRoute />} />
          <Route path="/studio/community" element={<StudioCommunityRoute />} />
          <Route path="/studio/audience" element={<StudioAudienceRoute />} />

          <Route path="/premium" element={<PremiumPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:section" element={<SettingsPage />} />

          <Route path="/admin" element={<AdminLayoutRoute />}>
            <Route index element={<AdminOverviewRoute />} />
            <Route path="moderation" element={<AdminModerationPage />} />
            <Route path="reports" element={<AdminModerationPage />} />
            <Route path="appeals" element={<AdminModerationPage />} />
            <Route path="users" element={<AdminUsersRoute />} />
            <Route path="settings" element={<AdminSettingsRoute />} />
            <Route path="audit" element={<AdminAuditRoute />} />
          </Route>

          <Route path="/about" element={<AboutRoute />} />
          <Route path="/content-policy" element={<ContentPolicyRoute />} />
          <Route path="/privacy" element={<PrivacyRoute />} />
          <Route path="/terms" element={<TermsRoute />} />
          <Route path="/help" element={<HelpRoute />} />

          <Route path="*" element={<NotFoundRoute />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

// Named-export pages are wrapped so they can still be code-split individually.
const CategoriesModule = lazy(() => import('@/pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })));
const CategoryModule = lazy(() => import('@/pages/CategoriesPage').then((m) => ({ default: m.CategoryPage })));
const TrendingModule = lazy(() => import('@/pages/CategoriesPage').then((m) => ({ default: m.TrendingPage })));
const LiveModule = lazy(() => import('@/pages/LivePage').then((m) => ({ default: m.LivePage })));
const LiveStreamModule = lazy(() => import('@/pages/LivePage').then((m) => ({ default: m.LiveStreamPage })));
const LibraryModule = lazy(() => import('@/pages/LibraryPages').then((m) => ({ default: m.LibraryPage })));
const HistoryModule = lazy(() => import('@/pages/LibraryPages').then((m) => ({ default: m.HistoryPage })));
const PlaylistsModule = lazy(() => import('@/pages/LibraryPages').then((m) => ({ default: m.PlaylistsPage })));
const PlaylistDetailModule = lazy(() => import('@/pages/LibraryPages').then((m) => ({ default: m.PlaylistDetailPage })));
const SubscriptionsModule = lazy(() => import('@/pages/LibraryPages').then((m) => ({ default: m.SubscriptionsPage })));
const NotificationsModule = lazy(() => import('@/pages/LibraryPages').then((m) => ({ default: m.NotificationsPage })));
const StudioModule = lazy(() => import('@/pages/studio/StudioPage').then((m) => ({ default: m.StudioPage })));
const StudioVideosModule = lazy(() => import('@/pages/studio/StudioPage').then((m) => ({ default: m.StudioVideosPage })));
const StudioVideoDetailModule = lazy(() => import('@/pages/studio/StudioPage').then((m) => ({ default: m.StudioVideoDetailPage })));
const StudioCommentsModule = lazy(() => import('@/pages/studio/StudioMiscPages').then((m) => ({ default: m.StudioCommentsPage })));
const StudioCommunityModule = lazy(() => import('@/pages/studio/StudioMiscPages').then((m) => ({ default: m.StudioCommunityPage })));
const StudioAudienceModule = lazy(() => import('@/pages/studio/StudioMiscPages').then((m) => ({ default: m.StudioAudiencePage })));
const AdminLayoutModule = lazy(() => import('@/pages/admin/AdminPages').then((m) => ({ default: m.AdminLayout })));
const AdminOverviewModule = lazy(() => import('@/pages/admin/AdminPages').then((m) => ({ default: m.AdminOverviewPage })));
const AdminUsersModule = lazy(() => import('@/pages/admin/AdminPages').then((m) => ({ default: m.AdminUsersPage })));
const AdminSettingsModule = lazy(() => import('@/pages/admin/AdminPages').then((m) => ({ default: m.AdminSettingsPage })));
const AdminAuditModule = lazy(() => import('@/pages/admin/AdminPages').then((m) => ({ default: m.AdminAuditPage })));
const AboutModule = lazy(() => import('@/pages/StaticPages').then((m) => ({ default: m.AboutPage })));
const ContentPolicyModule = lazy(() => import('@/pages/StaticPages').then((m) => ({ default: m.ContentPolicyPage })));
const PrivacyModule = lazy(() => import('@/pages/StaticPages').then((m) => ({ default: m.PrivacyPage })));
const TermsModule = lazy(() => import('@/pages/StaticPages').then((m) => ({ default: m.TermsPage })));
const HelpModule = lazy(() => import('@/pages/StaticPages').then((m) => ({ default: m.HelpPage })));
const NotFoundModule = lazy(() => import('@/pages/StaticPages').then((m) => ({ default: m.NotFoundPage })));

const CategoriesRoute = () => <CategoriesModule />;
const CategoryRoute = () => <CategoryModule />;
const TrendingRoute = () => <TrendingModule />;
const LiveRoute = () => <LiveModule />;
const LiveStreamRoute = () => <LiveStreamModule />;
const LibraryRoute = () => <LibraryModule />;
const HistoryRoute = () => <HistoryModule />;
const PlaylistsRoute = () => <PlaylistsModule />;
const PlaylistDetailRoute = () => <PlaylistDetailModule />;
const SubscriptionsRoute = () => <SubscriptionsModule />;
const NotificationsRoute = () => <NotificationsModule />;
const StudioRoute = () => <StudioModule />;
const StudioVideosRoute = () => <StudioVideosModule />;
const StudioVideoDetailRoute = () => <StudioVideoDetailModule />;
const StudioCommentsRoute = () => <StudioCommentsModule />;
const StudioCommunityRoute = () => <StudioCommunityModule />;
const StudioAudienceRoute = () => <StudioAudienceModule />;
const AdminLayoutRoute = () => <AdminLayoutModule />;
const AdminOverviewRoute = () => <AdminOverviewModule />;
const AdminUsersRoute = () => <AdminUsersModule />;
const AdminSettingsRoute = () => <AdminSettingsModule />;
const AdminAuditRoute = () => <AdminAuditModule />;
const AboutRoute = () => <AboutModule />;
const ContentPolicyRoute = () => <ContentPolicyModule />;
const PrivacyRoute = () => <PrivacyModule />;
const TermsRoute = () => <TermsModule />;
const HelpRoute = () => <HelpModule />;
const NotFoundRoute = () => <NotFoundModule />;
