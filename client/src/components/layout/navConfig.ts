import {
  LayoutDashboard, Compass, ListChecks, FileText, ClipboardList, Trophy, Wallet, Star,
  Award, Bell, User, Settings, HelpCircle, PenLine, BarChart3, Inbox, History,
  ShieldAlert, Users, ShieldCheck, Tags, Flag, Coins, RotateCcw, Activity, ScrollText,
  SlidersHorizontal, Wrench, Megaphone, GraduationCap, Vote, Gauge, FileEdit, Clock,
  MessageSquareWarning, LineChart, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Highlight when the route starts with this path. */
  match?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const userNav: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Discover',
    items: [
      { label: 'Explore Quizzes', to: '/explore/quizzes', icon: Compass },
      { label: 'Explore Polls', to: '/explore/polls', icon: Vote },
      { label: 'Leaderboards', to: '/leaderboards', icon: Trophy },
    ],
  },
  {
    title: 'My Activity',
    items: [
      { label: 'My Attempts', to: '/attempts', icon: ListChecks },
      { label: 'My Quizzes', to: '/my/quizzes', icon: FileText },
      { label: 'My Polls', to: '/my/polls', icon: ClipboardList },
      { label: 'Ratings & Reviews', to: '/ratings', icon: Star },
      { label: 'Achievements', to: '/achievements', icon: Award },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'QCoin Wallet', to: '/wallet', icon: Wallet },
      { label: 'Notifications', to: '/notifications', icon: Bell },
      { label: 'My Profile', to: '/profile', icon: User },
      { label: 'Settings', to: '/settings', icon: Settings },
      { label: 'Help & Support', to: '/help', icon: HelpCircle },
    ],
  },
];

export const creatorNav: NavSection[] = [
  {
    title: 'Creator Studio',
    items: [
      { label: 'Creator Overview', to: '/creator', icon: Gauge },
      { label: 'Drafts', to: '/creator/drafts', icon: FileEdit },
      { label: 'Pending Reviews', to: '/creator/pending', icon: Clock },
      { label: 'Changes Requested', to: '/creator/changes-requested', icon: MessageSquareWarning },
    ],
  },
  {
    title: 'Published',
    items: [
      { label: 'My Published Quizzes', to: '/creator/quizzes', icon: GraduationCap },
      { label: 'My Published Polls', to: '/creator/polls', icon: Vote },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Ratings & Feedback', to: '/creator/feedback', icon: Star },
      { label: 'Creator Analytics', to: '/creator/analytics', icon: LineChart },
    ],
  },
  {
    title: 'Create',
    items: [
      { label: 'New Quiz', to: '/creator/quizzes/new', icon: PenLine },
      { label: 'New Poll', to: '/creator/polls/new', icon: PenLine },
    ],
  },
];

export const adminNav: NavSection[] = [
  {
    title: 'Admin',
    items: [
      { label: 'Admin Overview', to: '/admin', icon: ShieldCheck },
      { label: 'Platform Analytics', to: '/admin/analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Moderation',
    items: [
      { label: 'Quiz Approvals', to: '/admin/quiz-approvals', icon: GraduationCap },
      { label: 'Poll Approvals', to: '/admin/poll-approvals', icon: Vote },
      { label: 'All Quizzes', to: '/admin/quizzes', icon: FileText },
      { label: 'All Polls', to: '/admin/polls', icon: ClipboardList },
      { label: 'Content Reports', to: '/admin/content-reports', icon: Flag },
      { label: 'User Reports', to: '/admin/user-reports', icon: ShieldAlert },
      { label: 'Moderation History', to: '/admin/moderation-history', icon: History },
      { label: 'Admin Quality Ratings', to: '/admin/quality-ratings', icon: Star },
    ],
  },
  {
    title: 'Users',
    items: [
      { label: 'All Users', to: '/admin/users', icon: Users },
      { label: 'User Management', to: '/admin/user-management', icon: SlidersHorizontal },
    ],
  },
  {
    title: 'QCoin Economy',
    items: [
      { label: 'QCoin Ledger', to: '/admin/ledger', icon: Coins },
      { label: 'Reward Configuration', to: '/admin/rewards', icon: Award },
      { label: 'Entry Fee Policies', to: '/admin/entry-fees', icon: Wallet },
      { label: 'Refund Requests', to: '/admin/refunds', icon: RotateCcw },
      { label: 'Suspicious Transactions', to: '/admin/suspicious', icon: Activity },
    ],
  },
  {
    title: 'Platform',
    items: [
      { label: 'Categories & Tags', to: '/admin/categories', icon: Tags },
      { label: 'Notification Management', to: '/admin/notifications', icon: Megaphone },
      { label: 'Platform Settings', to: '/admin/settings', icon: Settings },
      { label: 'Audit Logs', to: '/admin/audit-logs', icon: ScrollText },
      { label: 'System Diagnostics', to: '/admin/diagnostics', icon: Wrench },
    ],
  },
];

export function allNavSections(role: 'USER' | 'ADMIN' | null | undefined): NavSection[] {
  if (role === 'ADMIN') return [...adminNav];
  return [...userNav, ...creatorNav];
}
