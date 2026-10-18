import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { AppShell } from './components/layout/AppShell';
import { FullPageLoader } from './components/ui/States';
import { EmptyState } from './components/ui/States';
import { Button } from './components/ui/Button';
import { useAuth } from './lib/auth';

// Eagerly loaded: everything reachable without signing in.
import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';

/**
 * Route components are exported by name. `React.lazy` wants a default export,
 * so this adapts a named export without adding a redundant default to every
 * page module.
 */
function lazyNamed<M, K extends keyof M>(name: K, loader: () => Promise<M>) {
  return lazy(() => loader().then((module) => ({ default: module[name] as unknown as ComponentType })));
}

// Lazily loaded so the first paint stays small.
const UserOverview = lazyNamed('UserOverview', () => import('./pages/app/UserOverview'));
const QuizBrowse = lazyNamed('QuizBrowse', () => import('./pages/app/QuizBrowse'));
const QuizDetail = lazyNamed('QuizDetail', () => import('./pages/app/QuizDetail'));
const QuizTake = lazyNamed('QuizTake', () => import('./pages/app/QuizTake'));
const AttemptResult = lazyNamed('AttemptResult', () => import('./pages/app/AttemptResult'));
const QuizBuilder = lazyNamed('QuizBuilder', () => import('./pages/app/QuizBuilder'));
const PollBrowse = lazyNamed('PollBrowse', () => import('./pages/app/PollBrowse'));
const PollDetail = lazyNamed('PollDetail', () => import('./pages/app/PollDetail'));
const PollComposer = lazyNamed('PollComposer', () => import('./pages/app/PollComposer'));
const MyAttempts = lazyNamed('MyAttempts', () => import('./pages/app/MyAttempts'));
const MyContent = lazyNamed('MyContent', () => import('./pages/app/MyContent'));
const WalletPage = lazyNamed('WalletPage', () => import('./pages/app/WalletPage'));
const MyRatings = lazyNamed('MyRatings', () => import('./pages/app/MyRatings'));
const AchievementsPage = lazyNamed('AchievementsPage', () => import('./pages/app/AchievementsPage'));
const NotificationsPage = lazyNamed('NotificationsPage', () => import('./pages/app/NotificationsPage'));
const ProfilePage = lazyNamed('ProfilePage', () => import('./pages/app/ProfilePage'));
const SettingsPage = lazyNamed('SettingsPage', () => import('./pages/app/SettingsPage'));
const SupportPage = lazyNamed('SupportPage', () => import('./pages/app/SupportPage'));
const LeaderboardsPage = lazyNamed('LeaderboardsPage', () => import('./pages/app/LeaderboardsPage'));
const CreatorOverview = lazyNamed('CreatorOverview', () => import('./pages/creator/CreatorOverview'));
const CreatorContent = lazyNamed('CreatorContent', () => import('./pages/creator/CreatorContent'));
const CreatorFeedback = lazyNamed('CreatorFeedback', () => import('./pages/creator/CreatorFeedback'));
const CreatorAnalytics = lazyNamed('CreatorAnalytics', () => import('./pages/creator/CreatorAnalytics'));

const AdminOverview = lazyNamed('AdminOverview', () => import('./pages/admin/AdminOverview'));
const AdminAnalytics = lazyNamed('AdminAnalytics', () => import('./pages/admin/AdminAnalytics'));
const AdminActivity = lazyNamed('AdminActivity', () => import('./pages/admin/AdminActivity'));
const AdminContentList = lazyNamed('AdminContentList', () => import('./pages/admin/AdminContentList'));
const AdminContentReview = lazyNamed('AdminContentReview', () => import('./pages/admin/AdminContentReview'));
const AdminCategories = lazyNamed('AdminCategories', () => import('./pages/admin/AdminCategories'));
const AdminTaxonomy = lazyNamed('AdminTaxonomy', () => import('./pages/admin/AdminTaxonomy'));
const AdminUsers = lazyNamed('AdminUsers', () => import('./pages/admin/AdminUsers'));
const AdminUserDetail = lazyNamed('AdminUserDetail', () => import('./pages/admin/AdminUserDetail'));
const AdminRoles = lazyNamed('AdminRoles', () => import('./pages/admin/AdminRoles'));
const AdminQueue = lazyNamed('AdminQueue', () => import('./pages/admin/AdminQueue'));
const AdminReportedContent = lazyNamed('AdminReportedContent', () => import('./pages/admin/AdminReportedContent'));
const AdminReports = lazyNamed('AdminReports', () => import('./pages/admin/AdminReports'));
const AdminModerationHistory = lazyNamed('AdminModerationHistory', () => import('./pages/admin/AdminModerationHistory'));
const AdminAppeals = lazyNamed('AdminAppeals', () => import('./pages/admin/AdminAppeals'));
const AdminQcoinOverview = lazyNamed('AdminQcoinOverview', () => import('./pages/admin/AdminQcoinOverview'));
const AdminTransactions = lazyNamed('AdminTransactions', () => import('./pages/admin/AdminTransactions'));
const AdminRefunds = lazyNamed('AdminRefunds', () => import('./pages/admin/AdminRefunds'));
const AdminRewardDisputes = lazyNamed('AdminRewardDisputes', () => import('./pages/admin/AdminRewardDisputes'));
const AdminAnomalies = lazyNamed('AdminAnomalies', () => import('./pages/admin/AdminAnomalies'));
const AdminReconciliation = lazyNamed('AdminReconciliation', () => import('./pages/admin/AdminReconciliation'));
const AdminAdjustments = lazyNamed('AdminAdjustments', () => import('./pages/admin/AdminAdjustments'));
const AdminRatings = lazyNamed('AdminRatings', () => import('./pages/admin/AdminRatings'));
const AdminRatingDisputes = lazyNamed('AdminRatingDisputes', () => import('./pages/admin/AdminRatingDisputes'));
const AdminReputation = lazyNamed('AdminReputation', () => import('./pages/admin/AdminReputation'));
const AdminRatingAbuse = lazyNamed('AdminRatingAbuse', () => import('./pages/admin/AdminRatingAbuse'));
const AdminConfigPage = lazyNamed('AdminConfigPage', () => import('./pages/admin/AdminConfigPage'));
const AdminExport = lazyNamed('AdminExport', () => import('./pages/admin/AdminExport'));
const AdminAuditLogs = lazy(() => import('./pages/admin/AdminAudit').then((m) => ({ default: m.AdminAuditLogs })));
const AdminQcoinAudit = lazy(() => import('./pages/admin/AdminAudit').then((m) => ({ default: m.AdminQcoinAudit })));
const AdminSecurityEvents = lazy(() => import('./pages/admin/AdminAudit').then((m) => ({ default: m.AdminSecurityEvents })));
const AdminHealth = lazyNamed('AdminHealth', () => import('./pages/admin/AdminHealth'));
const AdminJobs = lazyNamed('AdminJobs', () => import('./pages/admin/AdminJobs'));
const AdminErrors = lazyNamed('AdminErrors', () => import('./pages/admin/AdminErrors'));
const AdminDiagnostics = lazyNamed('AdminDiagnostics', () => import('./pages/admin/AdminDiagnostics'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.isAdmin) {
    return (
      <AppShell mode="user">
        <EmptyState
          icon={<ShieldAlert className="h-4 w-4" />}
          title="Administrator access required"
          description="Your account does not have the administrator role. If you believe this is wrong, contact a platform administrator."
          action={
            <Button to="/app" variant="secondary" size="sm">
              Back to dashboard
            </Button>
          }
        />
      </AppShell>
    );
  }
  return <>{children}</>;
}

function RequireCreator({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user?.isCreator) {
    return (
      <EmptyState
        title="Creator tools unlock after your first submission"
        description="Create a quiz or a poll and submit it for review. Creator analytics and submission tracking will appear here."
        action={
          <Button to="/app/quizzes/new" size="sm">
            Create a quiz
          </Button>
        }
      />
    );
  }
  return <>{children}</>;
}

export function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          element={
            <RequireAuth>
              <AppShell mode="user" />
            </RequireAuth>
          }
        >
          <Route path="/app" element={<UserOverview />} />
          <Route path="/app/quizzes" element={<QuizBrowse />} />
          <Route path="/app/quizzes/new" element={<QuizBuilder />} />
          <Route path="/app/quizzes/:id/edit" element={<QuizBuilder />} />
          <Route path="/app/quizzes/:id/take" element={<QuizTake />} />
          <Route path="/app/quizzes/:id" element={<QuizDetail />} />
          <Route path="/app/attempts" element={<MyAttempts />} />
          <Route path="/app/attempts/:id" element={<AttemptResult />} />
          <Route path="/app/my-quizzes" element={<MyContent />} />
          <Route path="/app/my-polls" element={<MyContent />} />
          <Route path="/app/polls" element={<PollBrowse />} />
          <Route path="/app/polls/new" element={<PollComposer />} />
          <Route path="/app/polls/:id/edit" element={<PollComposer />} />
          <Route path="/app/polls/:id" element={<PollDetail />} />
          <Route path="/app/leaderboards" element={<LeaderboardsPage />} />
          <Route path="/app/wallet" element={<WalletPage />} />
          <Route path="/app/ratings" element={<MyRatings />} />
          <Route path="/app/achievements" element={<AchievementsPage />} />
          <Route path="/app/notifications" element={<NotificationsPage />} />
          <Route path="/app/profile" element={<ProfilePage />} />
          <Route path="/app/settings" element={<SettingsPage />} />
          <Route path="/app/support" element={<SupportPage />} />
          <Route
            path="/app/creator"
            element={
              <RequireCreator>
                <CreatorOverview />
              </RequireCreator>
            }
          />
          <Route
            path="/app/creator/quizzes"
            element={
              <RequireCreator>
                <CreatorContent />
              </RequireCreator>
            }
          />
          <Route
            path="/app/creator/polls"
            element={
              <RequireCreator>
                <CreatorContent />
              </RequireCreator>
            }
          />
          <Route
            path="/app/creator/drafts"
            element={
              <RequireCreator>
                <CreatorContent />
              </RequireCreator>
            }
          />
          <Route
            path="/app/creator/pending"
            element={
              <RequireCreator>
                <CreatorContent />
              </RequireCreator>
            }
          />
          <Route
            path="/app/creator/changes"
            element={
              <RequireCreator>
                <CreatorContent />
              </RequireCreator>
            }
          />
          <Route
            path="/app/creator/feedback"
            element={
              <RequireCreator>
                <CreatorFeedback />
              </RequireCreator>
            }
          />
          <Route
            path="/app/creator/analytics"
            element={
              <RequireCreator>
                <CreatorAnalytics />
              </RequireCreator>
            }
          />
        </Route>

        <Route
          element={
            <RequireAdmin>
              <AppShell mode="admin" />
            </RequireAdmin>
          }
        >
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/activity" element={<AdminActivity />} />
          <Route path="/admin/quizzes" element={<AdminContentList />} />
          <Route path="/admin/quizzes/:id" element={<AdminContentReview />} />
          <Route path="/admin/polls" element={<AdminContentList />} />
          <Route path="/admin/polls/:id" element={<AdminContentReview />} />
          <Route path="/admin/categories" element={<AdminCategories />} />
          <Route path="/admin/taxonomy" element={<AdminTaxonomy />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/users/:id" element={<AdminUserDetail />} />
          <Route path="/admin/roles" element={<AdminRoles />} />
          <Route path="/admin/moderation/queue" element={<AdminQueue />} />
          <Route path="/admin/moderation/reported" element={<AdminReportedContent />} />
          <Route path="/admin/moderation/reported-reviews" element={<AdminReports />} />
          <Route path="/admin/moderation/reported-users" element={<AdminReports />} />
          <Route path="/admin/moderation/history" element={<AdminModerationHistory />} />
          <Route path="/admin/moderation/appeals" element={<AdminAppeals />} />
          <Route path="/admin/qcoin" element={<AdminQcoinOverview />} />
          <Route path="/admin/qcoin/transactions" element={<AdminTransactions />} />
          <Route path="/admin/qcoin/refunds" element={<AdminRefunds />} />
          <Route path="/admin/qcoin/disputes" element={<AdminRewardDisputes />} />
          <Route path="/admin/qcoin/anomalies" element={<AdminAnomalies />} />
          <Route path="/admin/qcoin/reconciliation" element={<AdminReconciliation />} />
          <Route path="/admin/qcoin/adjustments" element={<AdminAdjustments />} />
          <Route path="/admin/ratings" element={<AdminRatings />} />
          <Route path="/admin/ratings/disputes" element={<AdminRatingDisputes />} />
          <Route path="/admin/ratings/reputation" element={<AdminReputation />} />
          <Route path="/admin/ratings/abuse" element={<AdminRatingAbuse />} />
          <Route path="/admin/config/:key" element={<AdminConfigPage />} />
          <Route path="/admin/reports/user-reports" element={<AdminReports />} />
          <Route path="/admin/reports/content-reports" element={<AdminReports />} />
          <Route path="/admin/reports/security" element={<AdminSecurityEvents />} />
          <Route path="/admin/reports/audit" element={<AdminAuditLogs />} />
          <Route path="/admin/reports/qcoin-audit" element={<AdminQcoinAudit />} />
          <Route path="/admin/reports/export" element={<AdminExport />} />
          <Route path="/admin/system/health" element={<AdminHealth />} />
          <Route path="/admin/system/jobs" element={<AdminJobs />} />
          <Route path="/admin/system/errors" element={<AdminErrors />} />
          <Route path="/admin/system/diagnostics" element={<AdminDiagnostics />} />
          <Route path="/admin/profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
