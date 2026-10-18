import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bell,
  BookOpen,
  ClipboardList,
  Coins,
  FileEdit,
  FileText,
  Gauge,
  Grid2x2,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  MessageSquareQuote,
  Settings,
  ShieldCheck,
  Star,
  Trophy,
  User,
  Users,
  Vote,
  Wallet,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Ending to match for the active route. Defaults to `to`. */
  match?: string[];
  adminOnly?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const USER_NAV: NavGroup[] = [
  {
    id: 'main',
    label: 'Overview',
    items: [
      { label: 'Overview', to: '/app', icon: LayoutDashboard, match: ['/app'] },
    ],
  },
  {
    id: 'discover',
    label: 'Discover',
    items: [
      { label: 'Explore Quizzes', to: '/app/quizzes', icon: BookOpen },
      { label: 'Explore Polls', to: '/app/polls', icon: Vote },
      { label: 'Leaderboards', to: '/app/leaderboards', icon: Trophy },
    ],
  },
  {
    id: 'mine',
    label: 'Your activity',
    items: [
      { label: 'My Quiz Attempts', to: '/app/attempts', icon: ListChecks },
      { label: 'My Quizzes', to: '/app/my-quizzes', icon: FileText },
      { label: 'My Polls', to: '/app/my-polls', icon: Megaphone },
      { label: 'My QCoin Wallet', to: '/app/wallet', icon: Wallet },
      { label: 'Ratings and Reviews', to: '/app/ratings', icon: Star },
      { label: 'Achievements', to: '/app/achievements', icon: Trophy },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      { label: 'Notifications', to: '/app/notifications', icon: Bell },
      { label: 'My Profile', to: '/app/profile', icon: User },
      { label: 'Settings', to: '/app/settings', icon: Settings },
      { label: 'Help and Support', to: '/app/support', icon: HelpCircle },
    ],
  },
];

export const CREATOR_NAV: NavGroup[] = [
  {
    id: 'creator',
    label: 'Creator',
    items: [
      { label: 'Creator Overview', to: '/app/creator', icon: Gauge, match: ['/app/creator'] },
      { label: 'My Published Quizzes', to: '/app/creator/quizzes', icon: FileText },
      { label: 'My Published Polls', to: '/app/creator/polls', icon: Megaphone },
      { label: 'Drafts', to: '/app/creator/drafts', icon: FileEdit },
      { label: 'Pending Reviews', to: '/app/creator/pending', icon: ClipboardList },
      { label: 'Changes Requested', to: '/app/creator/changes', icon: MessageSquareQuote },
      { label: 'Ratings and Feedback', to: '/app/creator/feedback', icon: Star },
      { label: 'Creator Analytics', to: '/app/creator/analytics', icon: BarChart3 },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    items: [
      { label: 'Admin Overview', to: '/admin', icon: LayoutDashboard, match: ['/admin'] },
      { label: 'Platform Analytics', to: '/admin/analytics', icon: BarChart3 },
      { label: 'Recent Administrative Activity', to: '/admin/activity', icon: ClipboardList },
    ],
  },
  {
    id: 'content',
    label: 'Content management',
    items: [
      { label: 'All Quizzes', to: '/admin/quizzes', icon: FileText },
      { label: 'Pending Quiz Approvals', to: '/admin/quizzes?status=pending_review', icon: ListChecks, match: ['/admin/quizzes'] },
      { label: 'Approved Quizzes', to: '/admin/quizzes?status=approved', icon: FileText, match: ['/admin/quizzes'] },
      { label: 'Rejected Quizzes', to: '/admin/quizzes?status=rejected', icon: FileText, match: ['/admin/quizzes'] },
      { label: 'Drafts and Unpublished', to: '/admin/quizzes?status=unpublished', icon: FileEdit, match: ['/admin/quizzes'] },
      { label: 'All Polls', to: '/admin/polls', icon: Megaphone },
      { label: 'Pending Poll Approvals', to: '/admin/polls?status=pending_review', icon: ListChecks, match: ['/admin/polls'] },
      { label: 'Published Polls', to: '/admin/polls?status=published', icon: Megaphone, match: ['/admin/polls'] },
      { label: 'Categories and Subcategories', to: '/admin/categories', icon: Grid2x2 },
      { label: 'Tags and Difficulty Settings', to: '/admin/taxonomy', icon: Grid2x2 },
    ],
  },
  {
    id: 'users',
    label: 'User management',
    items: [
      { label: 'All Users', to: '/admin/users', icon: Users },
      { label: 'User Search and Filters', to: '/admin/users?view=search', icon: Users, match: ['/admin/users'] },
      { label: 'User Profiles and Activity', to: '/admin/users?sort=activity', icon: Users, match: ['/admin/users'] },
      { label: 'Account Verification', to: '/admin/users?status=pending_verification', icon: Users, match: ['/admin/users'] },
      { label: 'Suspended Users', to: '/admin/users?status=suspended', icon: Users, match: ['/admin/users'] },
      { label: 'Reported Users', to: '/admin/moderation/reported-users', icon: Users },
      { label: 'Role and Permission Management', to: '/admin/roles', icon: ShieldCheck },
    ],
  },
  {
    id: 'moderation',
    label: 'Moderation',
    items: [
      { label: 'Pending Reviews', to: '/admin/moderation/queue', icon: ClipboardList },
      { label: 'Reported Quizzes', to: '/admin/moderation/reported?type=quiz', icon: FileText, match: ['/admin/moderation/reported'] },
      { label: 'Reported Polls', to: '/admin/moderation/reported?type=poll', icon: Megaphone, match: ['/admin/moderation/reported'] },
      { label: 'Reported Reviews', to: '/admin/moderation/reported-reviews', icon: Star },
      { label: 'Moderation History', to: '/admin/moderation/history', icon: ClipboardList },
      { label: 'Appeals and Re-review Requests', to: '/admin/moderation/appeals', icon: MessageSquareQuote },
    ],
  },
  {
    id: 'qcoin',
    label: 'QCoin management',
    items: [
      { label: 'Wallet and Ledger Overview', to: '/admin/qcoin', icon: Coins, match: ['/admin/qcoin'] },
      { label: 'Transaction History', to: '/admin/qcoin/transactions', icon: Wallet },
      { label: 'Rewards Configuration', to: '/admin/config/reward_limits', icon: Settings },
      { label: 'Entry Fee Policies', to: '/admin/config/quiz_rules', icon: Settings },
      { label: 'Refund Requests', to: '/admin/qcoin/refunds', icon: Coins },
      { label: 'Reward Disputes', to: '/admin/qcoin/disputes', icon: Coins },
      { label: 'Suspicious Transactions', to: '/admin/qcoin/anomalies', icon: ShieldCheck },
      { label: 'Balance Reconciliation', to: '/admin/qcoin/reconciliation', icon: Coins },
      { label: 'Manual Adjustments', to: '/admin/qcoin/adjustments', icon: Coins },
    ],
  },
  {
    id: 'ratings',
    label: 'Ratings and reputation',
    items: [
      { label: 'Admin Quality Ratings', to: '/admin/ratings', icon: Star },
      { label: 'Rating Disputes', to: '/admin/ratings/disputes', icon: MessageSquareQuote },
      { label: 'Creator Reputation Overview', to: '/admin/ratings/reputation', icon: Users },
      { label: 'Rating Abuse Reports', to: '/admin/ratings/abuse', icon: ShieldCheck },
    ],
  },
  {
    id: 'config',
    label: 'Platform configuration',
    items: [
      { label: 'Quiz Rules and Limits', to: '/admin/config/quiz_rules', icon: Settings },
      { label: 'Poll Rules and Limits', to: '/admin/config/poll_rules', icon: Settings },
      { label: 'Reward Limits', to: '/admin/config/reward_limits', icon: Settings },
      { label: 'Content Guidelines', to: '/admin/config/content_guidelines', icon: Settings },
      { label: 'Feature Configuration', to: '/admin/config/feature_config', icon: Settings },
      { label: 'Notification Templates', to: '/admin/config/notification_templates', icon: Settings },
      { label: 'Maintenance and Operations', to: '/admin/config/maintenance', icon: Settings },
    ],
  },
  {
    id: 'reports',
    label: 'Reports and audit',
    items: [
      { label: 'User Reports', to: '/admin/reports/user-reports', icon: Users },
      { label: 'Content Reports', to: '/admin/reports/content-reports', icon: FileText },
      { label: 'Security Events', to: '/admin/reports/security', icon: ShieldCheck },
      { label: 'Admin Action Logs', to: '/admin/reports/audit', icon: ClipboardList },
      { label: 'QCoin Audit Logs', to: '/admin/reports/qcoin-audit', icon: Coins },
      { label: 'Exportable Reports', to: '/admin/reports/export', icon: FileText },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { label: 'API and Service Health', to: '/admin/system/health', icon: Gauge },
      { label: 'Background Job Status', to: '/admin/system/jobs', icon: ClipboardList },
      { label: 'Failed Job Review', to: '/admin/system/jobs?status=failed', icon: ClipboardList, match: ['/admin/system/jobs'] },
      { label: 'Application Error Monitoring', to: '/admin/system/errors', icon: ShieldCheck },
      { label: 'Database and Diagnostics', to: '/admin/system/diagnostics', icon: Gauge },
    ],
  },
];
