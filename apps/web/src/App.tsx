import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout, { AdminOnly, Protected } from './components/Layout';
import Landing from './pages/Landing';
import Explore from './pages/Explore';
import QuizDetail from './pages/QuizDetail';
import Attempt from './pages/Attempt';
const Results = lazy(() => import('./pages/Results'));
import { ForgotPassword, Login, Register, ResetPassword } from './pages/AuthPages';
const Builder = lazy(() => import('./pages/Builder'));
import MyQuizzes from './pages/MyQuizzes';
const Dashboard = lazy(() => import('./pages/Dashboard'));
import History from './pages/History';
import CreatorProfile from './pages/CreatorProfile';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
const Admin = lazy(() => import('./pages/Admin'));
const ModerationReview = lazy(() => import('./pages/ModerationReview'));

export default function App() {
  return <Suspense fallback={<div className="py-20 text-center text-sm text-slate-500">Loading…</div>}><Routes>
    <Route element={<Layout />}>
      <Route index element={<Landing />} />
      <Route path="explore" element={<Explore />} />
      <Route path="quizzes/:slug" element={<QuizDetail />} />
      <Route path="creators/:id" element={<CreatorProfile />} />
      <Route path="login" element={<Login />} />
      <Route path="register" element={<Register />} />
      <Route path="forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password" element={<ResetPassword />} />
      <Route path="dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="my-quizzes" element={<Protected><MyQuizzes /></Protected>} />
      <Route path="quizzes/new" element={<Protected><Builder /></Protected>} />
      <Route path="quizzes/:id/edit" element={<Protected><Builder /></Protected>} />
      <Route path="attempts/:attemptId" element={<Protected><Attempt /></Protected>} />
      <Route path="attempts/:attemptId/results" element={<Protected><Results /></Protected>} />
      <Route path="history" element={<Protected><History /></Protected>} />
      <Route path="notifications" element={<Protected><Notifications /></Protected>} />
      <Route path="profile" element={<Protected><Profile /></Protected>} />
      <Route path="admin" element={<AdminOnly><Admin /></AdminOnly>} />
      <Route path="admin/submissions/:quizId" element={<AdminOnly><ModerationReview /></AdminOnly>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes></Suspense>;
}
