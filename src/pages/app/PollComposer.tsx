import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Info, Plus, Send, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useBootstrap } from '@/lib/bootstrap';
import { useToast } from '@/components/ui/Toast';
import { Button, IconButton } from '@/components/ui/Button';
import { TextInput, TextArea, Select, Switch } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Primitives';
import { ErrorState, FullPageLoader, InlineError } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';

interface LoadedPoll {
  id: string;
  question: string;
  description: string;
  category_id: string | null;
  status: string;
  allow_multiple: boolean;
  is_anonymous: boolean;
  visibility: string;
  closes_at: string | null;
  review_notes: string | null;
  options: { body: string }[];
}

interface Draft {
  question: string;
  description: string;
  categoryId: string | null;
  allowMultiple: boolean;
  isAnonymous: boolean;
  visibility: 'public' | 'unlisted';
  closesInDays: number | null;
  options: string[];
}

const EMPTY: Draft = {
  question: '',
  description: '',
  categoryId: null,
  allowMultiple: false,
  isAnonymous: false,
  visibility: 'public',
  closesInDays: 7,
  options: ['', ''],
};

export function PollComposer() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { categories, rules } = useBootstrap();

  const [draft, setDraft] = useState<Draft>(structuredClone(EMPTY));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const pollQuery = useQuery<{ poll: LoadedPoll }>({
    queryKey: qk.poll(id ?? ''),
    queryFn: () => api.get(`/polls/${id}`),
    enabled: isEditing,
  });

  useEffect(() => {
    if (!pollQuery.data) return;
    const poll = pollQuery.data.poll;
    const days = poll.closes_at
      ? Math.max(1, Math.round((new Date(poll.closes_at).getTime() - Date.now()) / 86400000))
      : null;
    setDraft({
      question: poll.question,
      description: poll.description,
      categoryId: poll.category_id,
      allowMultiple: poll.allow_multiple,
      isAnonymous: poll.is_anonymous,
      visibility: poll.visibility === 'unlisted' ? 'unlisted' : 'public',
      closesInDays: days,
      options: poll.options.map((o) => o.body),
    });
  }, [pollQuery.data]);

  const save = useMutation({
    mutationFn: () => (isEditing ? api.patch(`/polls/${id}`, draft) : api.post<{ id: string }>('/polls', draft)),
    onSuccess: (result) => {
      setErrors({});
      queryClient.invalidateQueries();
      toast.success('Poll saved as a draft.');
      if (!isEditing && result && typeof result === 'object' && 'id' in result) {
        navigate(`/app/polls/${(result as { id: string }).id}/edit`, { replace: true });
      }
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error('Could not save the poll.');
      }
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      await save.mutateAsync();
      return api.post(`/polls/${id}/submit`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Submitted for review.');
      navigate('/app/my-polls');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not submit the poll.'),
  });

  if (isEditing && pollQuery.isLoading) return <FullPageLoader />;
  if (isEditing && pollQuery.error) return <ErrorState error={pollQuery.error} onRetry={() => pollQuery.refetch()} />;

  const status = pollQuery.data?.poll.status;
  const locked = status === 'pending_review' || status === 'published';
  const pollRules = rules.poll as Record<string, number>;
  const maxDuration = Number(pollRules.max_duration_days ?? 90);
  const minOptions = Number(pollRules.min_options ?? 2);
  const filled = draft.options.filter((o) => o.trim());

  const issues: string[] = [];
  if (draft.question.trim().length < 8) issues.push('Write a question of at least 8 characters.');
  if (filled.length < minOptions) issues.push(`Provide at least ${minOptions} options.`);
  if (new Set(filled.map((o) => o.toLowerCase())).size !== filled.length) issues.push('Each option must be different.');
  if (draft.closesInDays && draft.closesInDays > maxDuration) issues.push(`A poll can run for at most ${maxDuration} days.`);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button to={isEditing ? '/app/my-polls' : '/app/polls'} variant="ghost" size="sm" icon={<ArrowLeft className="h-3.5 w-3.5" />}>
            {isEditing ? 'My polls' : 'Explore polls'}
          </Button>
          <h1 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-ink">{isEditing ? 'Edit poll' : 'Create a poll'}</h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {status ? `Current status: ${status.replace(/_/g, ' ')}` : 'Polls are private until you submit them for review.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" loading={save.isPending} disabled={locked} onClick={() => save.mutate()}>
            Save draft
          </Button>
          {isEditing && (
            <Button
              variant="primary"
              size="sm"
              icon={<Send className="h-3.5 w-3.5" />}
              disabled={locked || issues.length > 0}
              loading={submit.isPending}
              onClick={() => submit.mutate()}
            >
              {status === 'changes_requested' || status === 'rejected' ? 'Resubmit' : 'Submit for review'}
            </Button>
          )}
        </div>
      </div>

      {locked && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800">This poll is locked while it is under review or published.</p>
        </div>
      )}

      {pollQuery.data?.poll.review_notes && (status === 'changes_requested' || status === 'rejected') && (
        <div className="mb-4 rounded-md border border-line bg-canvas px-3 py-2">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">Reviewer notes</p>
          <p className="mt-1 text-[13px] text-ink">{pollQuery.data.poll.review_notes}</p>
        </div>
      )}

      <Panel title="Poll">
        <div className="space-y-4">
          <TextInput
            label="Question"
            required
            value={draft.question}
            error={errors.question}
            maxLength={160}
            onChange={(event) => setDraft((d) => ({ ...d, question: event.target.value }))}
            placeholder="e.g. Which topic should we cover next?"
          />
          <TextArea
            label="Description"
            rows={3}
            value={draft.description}
            error={errors.description}
            onChange={(event) => setDraft((d) => ({ ...d, description: event.target.value }))}
            hint="Optional context shown above the options."
          />

          <div>
            <p className="label">Options</p>
            <div className="space-y-2">
              {draft.options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <TextInput
                    className="flex-1"
                    value={option}
                    placeholder={`Option ${index + 1}`}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, options: d.options.map((o, i) => (i === index ? event.target.value : o)) }))
                    }
                  />
                  {draft.options.length > 2 && (
                    <IconButton label="Remove option" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setConfirmDelete(index)} />
                  )}
                </div>
              ))}
            </div>
            {draft.options.length < 8 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setDraft((d) => ({ ...d, options: [...d.options, ''] }))}
              >
                Add option
              </Button>
            )}
            {errors.options && <p className="hint text-red-600">{errors.options}</p>}
          </div>
        </div>
      </Panel>

      <Panel title="Settings" className="mt-4">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Category"
              value={draft.categoryId ?? ''}
              onChange={(event) => setDraft((d) => ({ ...d, categoryId: event.target.value || null }))}
              options={[{ value: '', label: 'No category' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <TextInput
              label="Closes after (days)"
              type="number"
              min={1}
              max={maxDuration}
              value={draft.closesInDays === null ? '' : String(draft.closesInDays)}
              error={errors.closesInDays}
              hint={`Leave empty for no closing date. Maximum ${maxDuration} days.`}
              onChange={(event) =>
                setDraft((d) => ({ ...d, closesInDays: event.target.value ? Number(event.target.value) : null }))
              }
            />
          </div>
          <Select
            label="Visibility"
            value={draft.visibility}
            onChange={(event) => setDraft((d) => ({ ...d, visibility: event.target.value as 'public' | 'unlisted' }))}
            options={[
              { value: 'public', label: 'Public — listed in Explore' },
              { value: 'unlisted', label: 'Unlisted — reachable by link only' },
            ]}
          />
          <Switch
            checked={draft.allowMultiple}
            onChange={(next) => setDraft((d) => ({ ...d, allowMultiple: next }))}
            label="Allow multiple choices"
            hint="Voters can select more than one option."
          />
          <Switch
            checked={draft.isAnonymous}
            onChange={(next) => setDraft((d) => ({ ...d, isAnonymous: next }))}
            label="Anonymous poll"
            hint="Individual vote choices are not surfaced on the results view."
          />
        </div>

        {issues.length > 0 && (
          <div className="mt-4">
            <InlineError message={`Before submitting: ${issues[0]}`} />
          </div>
        )}
      </Panel>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Remove this option?"
        description="The option will be removed from the draft. Existing votes for it would be discarded on save."
        confirmLabel="Remove option"
        tone="danger"
        onConfirm={() => {
          if (confirmDelete !== null) setDraft((d) => ({ ...d, options: d.options.filter((_, i) => i !== confirmDelete) }));
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
