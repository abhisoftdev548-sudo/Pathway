import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { LandingLayout } from '@/layouts/LandingLayout';
import { ForbiddenState, InlineSpinner } from '@/components/ui/Feedback';

// Public
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from '@/features/auth/AuthForms';
import { ExploreQuizzesPage } from '@/pages/ExploreQuizzesPage';
import { ExplorePollsPage } from '@/pages/ExplorePollsPage';
import { QuizDetailPage } from '@/pages/QuizDetailPage';
import { QuizAttemptPage } from '@/pages/QuizAttemptPage';
import { AttemptResultPage } from '@/pages/AttemptResultPage';
import { PollDetailPage } from '@/pages/PollDetailPage';
import { LeaderboardsPage } from '@/pages/LeaderboardsPage';
import { PublicProfilePage } from '@/pages/PublicProfilePage';
import { HelpPage } from '@/pages/HelpPage';

// User workspace
import { DashboardPage } from '@/pages/DashboardPage';
import { MyAttemptsPage } from '@/pages/MyAttemptsPage';
import { MyQuizzesPage } from '@/pages/MyQuizzesPage';
import { MyPollsPage } from '@/pages/MyPollsPage';
import { WalletPage } from '@/pages/WalletPage';
import { RatingsReviewsPage } from '@/pages/RatingsReviewsPage';
import { AchievementsPage } from '@/pages/AchievementsPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SettingsPage } from '@/pages/SettingsPage';

// Creator
import { CreatorOverviewPage } from '@/pages/creator/CreatorOverviewPage';
import { CreatorQuizzesPage } from '@/pages/creator/CreatorQuizzesPage';
import { CreatorPollsPage } from '@/pages/creator/CreatorPollsPage';
import { CreatorDraftsPage } from '@/pages/creator/CreatorDraftsPage';
import { CreatorPendingPage } from '@/pages/creator/CreatorPendingPage';
import { CreatorChangesPage } from '@/pages/creator/CreatorChangesPage';
import { CreatorFeedbackPage } from '@/pages/creator/CreatorFeedbackPage';
import { CreatorAnalyticsPage } from '@/pages/creator/CreatorAnalyticsPage';
import { QuizBuilderPage } from '@/pages/creator/QuizBuilderPage';
import { PollBuilderPage } from '@/pages/creator/PollBuilderPage';

// Admin
import { AdminOverviewPage } from '@/pages/admin/AdminOverviewPage';
import { AdminAnalyticsPage } from '@/pages/admin/AdminAnalyticsPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminUserManagementPage } from '@/pages/admin/AdminUserManagementPage';
import { AdminUserDetailPage } from '@/pages/admin/AdminUserDetailPage';
import { AdminQuizzesPage } from '@/pages/admin/AdminQuizzesPage';
import { AdminQuizApprovalsPage } from '@/pages/admin/AdminQuizApprovalsPage';
import { AdminPollsPage } from '@/pages/admin/AdminPollsPage';
import { AdminPollApprovalsPage } from '@/pages/admin/AdminPollApprovalsPage';
import { AdminCategoriesPage } from '@/pages/admin/AdminCategoriesPage';
import { AdminContentReportsPage } from '@/pages/admin/AdminContentReportsPage';
import { AdminUserReportsPage } from '@/pages/admin/AdminUserReportsPage';
import { AdminModerationHistoryPage } from '@/pages/admin/AdminModerationHistoryPage';
import { AdminQualityRatingsPage } from '@/pages/admin/AdminQualityRatingsPage';
import { AdminLedgerPage } from '@/pages/admin/AdminLedgerPage';
import { AdminRewardConfigPage } from '@/pages/admin/AdminRewardConfigPage';
import { AdminEntryFeePoliciesPage } from '@/pages/admin/AdminEntryFeePoliciesPage';
import { AdminRefundRequestsPage } from '@/pages/admin/AdminRefundRequestsPage';
import { AdminSuspiciousPage } from '@/pages/admin/AdminSuspiciousPage';
import { AdminAuditLogsPage } from '@/pages/admin/AdminAuditLogsPage';
import { AdminNotificationsPage } from '@/pages/admin/AdminNotificationsPage';
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';
import { AdminDiagnosticsPage } from '@/pages/admin/AdminDiagnosticsPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <InlineSpinner />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <InlineSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <ForbiddenState description="This workspace is restricted to platform administrators." />
      </div>
    );
  }
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<LandingLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/leaderboards" element={<LeaderboardsPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/users/:id" element={<PublicProfilePage />} />
      </Route>

      <Route element={<AppLayout />}>
        {/* Discover + participate (auth required to take part; browse is public below) */}
        <Route path="/explore/quizzes" element={<ExploreQuizzesPage />} />
        <Route path="/explore/polls" element={<ExplorePollsPage />} />
        <Route path="/quizzes/:slug" element={<QuizDetailPage />} />
        <Route path="/polls/:slug" element={<PollDetailPage />} />
        <Route
          path="/quizzes/:slug/attempt"
          element={
            <RequireAuth>
              <QuizAttemptPage />
            </RequireAuth>
          }
        />
        <Route
          path="/attempts/:attemptId"
          element={
            <RequireAuth>
              <AttemptResultPage />
            </RequireAuth>
          }
        />

        {/* User workspace */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/attempts"
          element={
            <RequireAuth>
              <MyAttemptsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/my/quizzes"
          element={
            <RequireAuth>
              <MyQuizzesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/my/polls"
          element={
            <RequireAuth>
              <MyPollsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/wallet"
          element={
            <RequireAuth>
              <WalletPage />
            </RequireAuth>
          }
        />
        <Route
          path="/ratings"
          element={
            <RequireAuth>
              <RatingsReviewsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/achievements"
          element={
            <RequireAuth>
              <AchievementsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />

        {/* Creator studio */}
        <Route
          path="/creator"
          element={
            <RequireAuth>
              <CreatorOverviewPage />
            </RequireAuth>
          }
        />
        <Route
          path="/creator/quizzes"
          element={
            <RequireAuth>
              <CreatorQuizzesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/creator/polls"
          element={
            <RequireAuth>
              <CreatorPollsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/creator/drafts"
          element={
            <RequireAuth>
              <CreatorDraftsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/creator/pending"
          element={
            <RequireAuth>
              <CreatorPendingPage />
            </RequireAuth>
          }
        />
        <Route
          path="/creator/changes-requested"
          element={
            <RequireAuth>
              <CreatorChangesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/creator/feedback"
          element={
            <RequireAuth>
              <CreatorFeedbackPage />
            </RequireAuth>
          }
        />
        <Route
          path="/creator/analytics"
          element={
            <RequireAuth>
              <CreatorAnalyticsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/creator/quizzes/new"
          element={
            <RequireAuth>
              <QuizBuilderPage />
            </RequireAuth>
          }
        />
        <Route
          path="/creator/quizzes/:id/edit"
          element={
            <RequireAuth>
              <QuizBuilderPage />
            </RequireAuth>
          }
        />
        <Route
          path="/creator/polls/new"
          element={
            <RequireAuth>
              <PollBuilderPage />
            </RequireAuth>
          }
        />
        <Route
          path="/creator/polls/:id/edit"
          element={
            <RequireAuth>
              <PollBuilderPage />
            </RequireAuth>
          }
        />

        {/* Admin workspace */}
        <Route path="/admin" element={<RequireAdmin><AdminOverviewPage /></RequireAdmin>} />
        <Route path="/admin/analytics" element={<RequireAdmin><AdminAnalyticsPage /></RequireAdmin>} />
        <Route path="/admin/users" element={<RequireAdmin><AdminUsersPage /></RequireAdmin>} />
        <Route path="/admin/user-management" element={<RequireAdmin><AdminUserManagementPage /></RequireAdmin>} />
        <Route path="/admin/users/:id" element={<RequireAdmin><AdminUserDetailPage /></RequireAdmin>} />
        <Route path="/admin/quizzes" element={<RequireAdmin><AdminQuizzesPage /></RequireAdmin>} />
        <Route path="/admin/quiz-approvals" element={<RequireAdmin><AdminQuizApprovalsPage /></RequireAdmin>} />
        <Route path="/admin/polls" element={<RequireAdmin><AdminPollsPage /></RequireAdmin>} />
        <Route path="/admin/poll-approvals" element={<RequireAdmin><AdminPollApprovalsPage /></RequireAdmin>} />
        <Route path="/admin/categories" element={<RequireAdmin><AdminCategoriesPage /></RequireAdmin>} />
        <Route path="/admin/content-reports" element={<RequireAdmin><AdminContentReportsPage /></RequireAdmin>} />
        <Route path="/admin/user-reports" element={<RequireAdmin><AdminUserReportsPage /></RequireAdmin>} />
        <Route path="/admin/moderation-history" element={<RequireAdmin><AdminModerationHistoryPage /></RequireAdmin>} />
        <Route path="/admin/quality-ratings" element={<RequireAdmin><AdminQualityRatingsPage /></RequireAdmin>} />
        <Route path="/admin/ledger" element={<RequireAdmin><AdminLedgerPage /></RequireAdmin>} />
        <Route path="/admin/rewards" element={<RequireAdmin><AdminRewardConfigPage /></RequireAdmin>} />
        <Route path="/admin/entry-fees" element={<RequireAdmin><AdminEntryFeePoliciesPage /></RequireAdmin>} />
        <Route path="/admin/refunds" element={<RequireAdmin><AdminRefundRequestsPage /></RequireAdmin>} />
        <Route path="/admin/suspicious" element={<RequireAdmin><AdminSuspiciousPage /></RequireAdmin>} />
        <Route path="/admin/audit-logs" element={<RequireAdmin><AdminAuditLogsPage /></RequireAdmin>} />
        <Route path="/admin/notifications" element={<RequireAdmin><AdminNotificationsPage /></RequireAdmin>} />
        <Route path="/admin/settings" element={<RequireAdmin><AdminSettingsPage /></RequireAdmin>} />
        <Route path="/admin/diagnostics" element={<RequireAdmin><AdminDiagnosticsPage /></RequireAdmin>} />
      </Route>

      {/* Auth pages */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route
        path="*"
        element={
          <div className="mx-auto max-w-2xl py-24 text-center">
            <h1 className="text-2xl font-semibold text-heading">Page not found</h1>
            <p className="mt-2 text-body">The page you are looking for does not exist.</p>
            <a href="/" className="mt-6 inline-block text-brand-600 hover:text-brand-700">
              Return home
            </a>
          </div>
        }
      />
    </Routes>
  );
}

export default AppRoutes;
