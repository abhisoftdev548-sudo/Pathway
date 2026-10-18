import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { PageHeading, Panel, Badge } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { ConfigForm, type FieldSpec } from '@/components/patterns/ConfigForm';
import { InlineError } from '@/components/ui/States';

interface Section {
  title: string;
  description: string;
  fields?: FieldSpec[];
}

const SECTIONS: Record<string, Section> = {
  quiz_rules: {
    title: 'Quiz rules and limits',
    description:
      'Constraints applied server-side when a quiz is created or submitted. The builder and the API both enforce these values.',
    fields: [
      { key: 'min_questions', kind: 'number', min: 1, max: 50, hint: 'A quiz with fewer questions is rejected on submission.' },
      { key: 'max_questions', kind: 'number', min: 1, max: 200 },
      { key: 'min_options_per_question', kind: 'number', min: 2, max: 6 },
      { key: 'max_options_per_question', kind: 'number', min: 2, max: 10 },
      { key: 'max_title_length', kind: 'number', min: 20, max: 300 },
      { key: 'max_entry_fee', kind: 'number', min: 0, hint: 'Entry fee policies: the largest fee a creator can charge.' },
      { key: 'max_reward_coins', kind: 'number', min: 0 },
      { key: 'default_passing_score', kind: 'number', min: 1, max: 100, hint: 'Used as the default when a creator builds a new quiz.' },
      { key: 'max_time_limit_minutes', kind: 'number', min: 1, max: 600 },
      { key: 'max_attempts_per_quiz', kind: 'number', min: 1, max: 50 },
      { key: 'require_approval', kind: 'boolean' },
    ],
  },
  poll_rules: {
    title: 'Poll rules and limits',
    description: 'Constraints applied when a poll is created or submitted for review.',
    fields: [
      { key: 'min_options', kind: 'number', min: 2, max: 4 },
      { key: 'max_options', kind: 'number', min: 2, max: 12 },
      { key: 'max_question_length', kind: 'number', min: 40, max: 400 },
      { key: 'max_duration_days', kind: 'number', min: 1, max: 365 },
      { key: 'allow_anonymous_by_default', kind: 'boolean' },
      { key: 'require_approval', kind: 'boolean' },
    ],
  },
  reward_limits: {
    title: 'Reward limits',
    description:
      'QCoin economics. These limits are enforced by the wallet when rewards are paid and when administrators make manual adjustments.',
    fields: [
      { key: 'daily_quiz_reward_cap', kind: 'number', min: 0 },
      { key: 'reward_per_correct_answer', kind: 'number', min: 0 },
      { key: 'welcome_bonus', kind: 'number', min: 0 },
      { key: 'max_entry_fee', kind: 'number', min: 0 },
      { key: 'max_reward_coins', kind: 'number', min: 0 },
      { key: 'refund_window_hours', kind: 'number', min: 0 },
      { key: 'max_manual_adjustment', kind: 'number', min: 1 },
    ],
  },
  content_guidelines: {
    title: 'Content guidelines',
    description: 'Shown to creators when they submit a quiz or poll, and used as the reference when a submission is rejected.',
    fields: [{ key: 'text', kind: 'textarea', label: 'Guidelines shown to creators' }],
  },
  feature_config: {
    title: 'Feature configuration',
    description: 'Turning a feature off hides it in the product and blocks its API. Disabled features never show fake content.',
    fields: [
      { key: 'quizzes_enabled', kind: 'boolean' },
      { key: 'polls_enabled', kind: 'boolean' },
      { key: 'ratings_enabled', kind: 'boolean' },
      { key: 'leaderboards_enabled', kind: 'boolean' },
      { key: 'wallet_enabled', kind: 'boolean' },
      { key: 'achievements_enabled', kind: 'boolean' },
      { key: 'notifications_enabled', kind: 'boolean' },
      { key: 'public_registration_enabled', kind: 'boolean' },
    ],
  },
  notification_templates: {
    title: 'Notification templates',
    description:
      'Message bodies used for system notifications. Placeholders such as {title}, {reason} and {amount} are replaced with real values at send time.',
  },
  maintenance: {
    title: 'Maintenance and operational settings',
    description:
      'When maintenance mode is on, ordinary users cannot create, submit or spend. Administrators keep full access so they can finish the work.',
    fields: [
      { key: 'enabled', kind: 'boolean', label: 'Maintenance mode enabled' },
      { key: 'message', kind: 'textarea', label: 'Message shown to users' },
    ],
  },
};

const ORDER = [
  'quiz_rules',
  'poll_rules',
  'reward_limits',
  'content_guidelines',
  'feature_config',
  'notification_templates',
  'maintenance',
];

export function AdminConfigPage() {
  const { key = '' } = useParams();
  const section = SECTIONS[key];

  if (!section) {
    return (
      <>
        <PageHeading title="Platform configuration" description="Pick the section you want to change." />
        <Panel>
          <InlineError message={`"${key}" is not a configuration section.`} />
          <Link to="/admin" className="mt-3 inline-block text-[13px] text-brand-700 hover:underline">
            Back to the admin overview
          </Link>
        </Panel>
      </>
    );
  }

  const isMaintenance = key === 'maintenance';

  return (
    <>
      <Link to="/admin" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Admin overview
      </Link>

      <PageHeading title={section.title} description={section.description} />

      {isMaintenance && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
          <p className="text-[13px] text-amber-900">
            Enabling maintenance mode blocks creation, submission and spending for everyone except administrators. In-progress
            quiz attempts stay open until their time limit expires.
          </p>
        </div>
      )}

      <ConfigForm settingKey={key} title={section.title} description={section.description} fields={section.fields} />

      <Panel className="mt-4" title="Other configuration sections">
        <div className="flex flex-wrap gap-2">
          {ORDER.filter((item) => item !== key).map((item) => (
            <Button key={item} to={`/admin/config/${item}`} size="sm" variant="secondary">
              {SECTIONS[item].title}
            </Button>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
          <Badge tone="neutral">Audited</Badge>
          Every change records which fields changed and who changed them.
        </p>
      </Panel>
    </>
  );
}
