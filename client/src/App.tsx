import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { AppShell } from '@/components/layout';
import { Spinner } from '@/components/ui';
import { Landing, Explore, RoadmapDetail, About } from '@/pages/public';
import { Login, Register, ForgotPassword, ResetPassword } from '@/pages/auth';
import { Dashboard } from '@/pages/dashboard';
import { MyRoadmaps } from '@/pages/my-roadmaps';
import { Workspace, ModuleView } from '@/pages/workspace';
import { TaskView } from '@/pages/task';
import { Today, AllTasks } from '@/pages/today';
import { CalendarPage, HistoryPage } from '@/pages/calendar';
import { AnalyticsPage } from '@/pages/analytics';
import { Achievements } from '@/pages/achievements';
import { Notifications } from '@/pages/notifications';
import { Profile } from '@/pages/profile';
import { AdminOverview, AdminRoadmaps } from '@/pages/admin';
import { AdminCurriculum, AdminPreview } from '@/pages/admin-curriculum';
import { AdminAnalytics, AdminValidation } from '@/pages/admin-insights';

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);
  return null;
}

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-brand text-white">
          <span className="size-4 animate-pulse rounded-full bg-white/80" />
        </span>
        <Spinner label="Loading your workspace" />
      </div>
    </div>
  );
}

function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <AppShell>{children}</AppShell>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/roadmaps/:slug" element={<RoadmapDetail />} />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
        <Route path="/reset-password" element={<GuestOnly><ResetPassword /></GuestOnly>} />

        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/my-roadmaps" element={<Protected><MyRoadmaps /></Protected>} />
        <Route path="/workspace/:enrollmentId" element={<Protected><Workspace /></Protected>} />
        <Route path="/workspace/:enrollmentId/modules/:moduleId" element={<Protected><ModuleView /></Protected>} />
        <Route path="/workspace/:enrollmentId/tasks/:taskId" element={<Protected><TaskView /></Protected>} />
        <Route path="/tasks/:taskId" element={<Protected><TaskView /></Protected>} />
        <Route path="/today" element={<Protected><Today /></Protected>} />
        <Route path="/tasks" element={<Protected><AllTasks /></Protected>} />
        <Route path="/calendar" element={<Protected><CalendarPage /></Protected>} />
        <Route path="/history" element={<Protected><HistoryPage /></Protected>} />
        <Route path="/analytics" element={<Protected><AnalyticsPage /></Protected>} />
        <Route path="/achievements" element={<Protected><Achievements /></Protected>} />
        <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />

        <Route path="/admin" element={<Protected admin><AdminOverview /></Protected>} />
        <Route path="/admin/roadmaps" element={<Protected admin><AdminRoadmaps /></Protected>} />
        <Route path="/admin/roadmaps/:roadmapId/curriculum" element={<Protected admin><AdminCurriculum /></Protected>} />
        <Route path="/admin/roadmaps/:roadmapId/preview" element={<Protected admin><AdminPreview /></Protected>} />
        <Route path="/admin/analytics" element={<Protected admin><AdminAnalytics /></Protected>} />
        <Route path="/admin/validation" element={<Protected admin><AdminValidation /></Protected>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
