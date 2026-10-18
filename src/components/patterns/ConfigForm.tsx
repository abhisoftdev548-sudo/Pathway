import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextInput, TextArea, Switch, Select } from '@/components/ui/Field';
import { Panel, Badge } from '@/components/ui/Primitives';
import { InlineError, InlineSuccess, LoadingBlock } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queries';
import { titleCase } from '@/lib/format';

type Value = string | number | boolean;

interface ConfigResponse {
  key: string;
  value: Record<string, Value>;
  defaults: Record<string, Value>;
}

export interface FieldSpec {
  key: string;
  label?: string;
  hint?: string;
  kind?: 'number' | 'text' | 'textarea' | 'boolean';
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
}

const KNOWN_LABELS: Record<string, string> = {
  min_questions: 'Minimum questions per quiz',
  max_questions: 'Maximum questions per quiz',
  min_options_per_question: 'Minimum options per question',
  max_options_per_question: 'Maximum options per question',
  max_title_length: 'Maximum title length',
  max_entry_fee: 'Maximum entry fee (QCoin)',
  max_reward_coins: 'Maximum reward (QCoin)',
  default_passing_score: 'Default passing score (%)',
  max_time_limit_minutes: 'Maximum time limit (minutes)',
  max_attempts_per_quiz: 'Maximum attempts per quiz',
  require_approval: 'Require moderation approval',
  min_options: 'Minimum options',
  max_options: 'Maximum options',
  max_question_length: 'Maximum question length',
  max_duration_days: 'Maximum poll duration (days)',
  allow_anonymous_by_default: 'Anonymous polls by default',
  daily_quiz_reward_cap: 'Daily reward cap per player (QCoin)',
  reward_per_correct_answer: 'Reward per correct answer (QCoin)',
  welcome_bonus: 'Welcome bonus for new accounts (QCoin)',
  refund_window_hours: 'Refund request window (hours)',
  max_manual_adjustment: 'Maximum single manual adjustment (QCoin)',
  quizzes_enabled: 'Quizzes',
  polls_enabled: 'Polls',
  ratings_enabled: 'Ratings and reviews',
  leaderboards_enabled: 'Leaderboards',
  public_registration_enabled: 'Public registration',
  wallet_enabled: 'QCoin wallet',
  achievements_enabled: 'Achievements',
  notifications_enabled: 'Notifications',
  text: 'Content guidelines shown to creators',
  enabled: 'Maintenance mode enabled',
  message: 'Message shown to users',
};

const KNOWN_HINTS: Record<string, string> = {
  require_approval: 'When off, submissions publish immediately without moderation.',
  public_registration_enabled: 'When off, no new accounts can be created.',
  max_manual_adjustment: 'Administrators cannot adjust a balance by more than this in one action.',
  daily_quiz_reward_cap: 'Total quiz rewards a single player can earn per day.',
  welcome_bonus: 'Granted once when an account is created. Set to 0 to disable.',
  refund_window_hours: 'Players can only request a refund within this window after completing a quiz.',
};

function labelFor(key: string): string {
  return KNOWN_LABELS[key] ?? titleCase(key);
}

/**
 * Generic settings editor. Renders booleans as switches, numbers as number
 * inputs, everything else as text. Notification templates are edited as a
 * key/value list of template strings.
 */
export function ConfigForm({
  settingKey,
  title,
  description,
  fields,
}: {
  settingKey: string;
  title: string;
  description?: string;
  fields?: FieldSpec[];
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, Value>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const query = useQuery<ConfigResponse>({
    queryKey: qk.adminConfigKey(settingKey),
    queryFn: () => api.get<ConfigResponse>(`/admin/config/${settingKey}`),
  });

  useEffect(() => {
    if (query.data) setDraft(query.data.value);
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => api.put<{ value: Record<string, Value> }>(`/admin/config/${settingKey}`, { value: draft }),
    onSuccess: (result) => {
      setDraft(result.value);
      setError(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3500);
      queryClient.invalidateQueries({ queryKey: qk.adminConfig });
      queryClient.invalidateQueries({ queryKey: qk.bootstrap });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Could not save these settings.');
    },
  });

  const reset = useMutation({
    mutationFn: () => api.post(`/admin/config/${settingKey}/reset`),
    onSuccess: () => {
      setConfirmReset(false);
      query.refetch();
      queryClient.invalidateQueries({ queryKey: qk.adminConfig });
    },
  });

  if (query.isLoading) {
    return (
      <Panel title={title} description={description}>
        <LoadingBlock rows={5} />
      </Panel>
    );
  }

  if (query.error) {
    return (
      <Panel title={title}>
        <InlineError message={query.error instanceof ApiError ? query.error.message : 'Could not load these settings.'} />
      </Panel>
    );
  }

  const entries = Object.entries(draft);
  const isTemplates = settingKey === 'notification_templates';

  const setValue = (key: string, value: Value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const dirty = JSON.stringify(draft) !== JSON.stringify(query.data?.value ?? {});

  return (
    <Panel
      title={title}
      description={description}
      actions={
        <>
          <Button variant="ghost" size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => setConfirmReset(true)}>
            Reset to defaults
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Save className="h-3.5 w-3.5" />}
            loading={save.isPending}
            disabled={!dirty}
            onClick={() => save.mutate()}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <InlineError message={error} />}
        {saved && <InlineSuccess message="Settings saved." />}

        {entries.length === 0 && (
          <p className="text-[13px] text-ink-muted">No values are configured for this section yet.</p>
        )}

        {entries.map(([key, value]) => {
          const spec = fields?.find((f) => f.key === key);
          const kind = spec?.kind ?? inferKind(key, value);
          const label = spec?.label ?? labelFor(key);
          const hint = spec?.hint ?? KNOWN_HINTS[key];

          if (kind === 'boolean') {
            return (
              <div key={key} className="border-b border-line pb-3 last:border-0 last:pb-0">
                <Switch
                  checked={Boolean(value)}
                  onChange={(next) => setValue(key, next)}
                  label={label}
                  hint={hint}
                />
              </div>
            );
          }

          if (kind === 'number') {
            return (
              <div key={key} className="max-w-xs">
                <TextInput
                  label={label}
                  hint={hint}
                  type="number"
                  min={spec?.min ?? 0}
                  max={spec?.max}
                  value={String(value)}
                  onChange={(event) => setValue(key, Number(event.target.value))}
                />
              </div>
            );
          }

          if (kind === 'textarea' || (isTemplates && typeof value === 'string')) {
            return (
              <TextArea
                key={key}
                label={isTemplates ? labelFor(key) : label}
                hint={isTemplates ? 'Placeholders: {title}, {reason}, {amount}' : hint}
                rows={isTemplates ? 2 : 5}
                value={String(value)}
                onChange={(event) => setValue(key, event.target.value)}
              />
            );
          }

          return (
            <div key={key} className="max-w-xl">
              <TextInput
                label={label}
                hint={hint}
                value={String(value)}
                onChange={(event) => setValue(key, event.target.value)}
              />
            </div>
          );
        })}

        {dirty && (
          <div className="flex items-center gap-2 border-t border-line pt-3">
            <Badge tone="warning">Unsaved changes</Badge>
            <button type="button" className="text-xs text-ink-muted hover:text-ink" onClick={() => setDraft(query.data?.value ?? {})}>
              Discard
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset to defaults?"
        description="Every value in this section returns to its default. This is recorded in the audit log."
        confirmLabel="Reset settings"
        tone="danger"
        loading={reset.isPending}
        onConfirm={() => reset.mutate()}
        onCancel={() => setConfirmReset(false)}
      />
    </Panel>
  );
}

function inferKind(key: string, value: Value): 'number' | 'text' | 'textarea' | 'boolean' {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (key === 'text' || key === 'message') return 'textarea';
  return 'text';
}

export { Select };
