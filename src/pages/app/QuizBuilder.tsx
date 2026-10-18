import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  GripVertical,
  Info,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useBootstrap } from '@/lib/bootstrap';
import { useToast } from '@/components/ui/Toast';
import { Button, IconButton } from '@/components/ui/Button';
import { TextInput, TextArea, Select, Switch } from '@/components/ui/Field';
import { Badge, Panel, Separator } from '@/components/ui/Primitives';
import { ErrorState, FullPageLoader, InlineError, LoadingBlock } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/cn';

interface BuilderOption {
  body: string;
  isCorrect: boolean;
}

interface BuilderQuestion {
  prompt: string;
  type: 'single' | 'multiple' | 'true_false';
  points: number;
  explanation: string;
  options: BuilderOption[];
}

interface QuizDraft {
  title: string;
  summary: string;
  description: string;
  categoryId: string | null;
  difficultyId: string | null;
  tags: string[];
  entryFee: number;
  rewardCoins: number;
  passingScore: number;
  timeLimitMinutes: number | null;
  maxAttempts: number;
  shuffleQuestions: boolean;
  showExplanations: boolean;
  visibility: 'public' | 'unlisted';
  questions: BuilderQuestion[];
}

const EMPTY_QUESTION: BuilderQuestion = {
  prompt: '',
  type: 'single',
  points: 1,
  explanation: '',
  options: [
    { body: '', isCorrect: true },
    { body: '', isCorrect: false },
  ],
};

const EMPTY_DRAFT: QuizDraft = {
  title: '',
  summary: '',
  description: '',
  categoryId: null,
  difficultyId: null,
  tags: [],
  entryFee: 0,
  rewardCoins: 0,
  passingScore: 60,
  timeLimitMinutes: null,
  maxAttempts: 1,
  shuffleQuestions: false,
  showExplanations: true,
  visibility: 'public',
  questions: [structuredClone(EMPTY_QUESTION)],
};

const STEPS = ['Details', 'Questions', 'Rules and rewards', 'Review'] as const;

interface LoadedQuiz {
  id: string;
  title: string;
  summary: string;
  description: string;
  category_id: string | null;
  difficulty_id: string | null;
  status: string;
  entry_fee: number;
  reward_coins: number;
  passing_score: number;
  time_limit_seconds: number | null;
  max_attempts: number;
  shuffle_questions: boolean;
  show_explanations: boolean;
  visibility: string;
  review_notes: string | null;
  tags: { id: string; name: string }[];
  questions: {
    prompt: string;
    type: 'single' | 'multiple' | 'true_false';
    points: number;
    explanation: string;
    options: { body: string; isCorrect: boolean }[];
  }[];
}

export function QuizBuilder() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { categories, difficulties, tags, rules } = useBootstrap();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<QuizDraft>(structuredClone(EMPTY_DRAFT));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [changeNote, setChangeNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const quizQuery = useQuery<{ quiz: LoadedQuiz }>({
    queryKey: qk.quiz(id ?? ''),
    queryFn: () => api.get(`/quizzes/${id}/preview`),
    enabled: isEditing,
  });

  useEffect(() => {
    if (!quizQuery.data) return;
    const quiz = quizQuery.data.quiz;
    setDraft({
      title: quiz.title,
      summary: quiz.summary,
      description: quiz.description,
      categoryId: quiz.category_id,
      difficultyId: quiz.difficulty_id,
      tags: quiz.tags.map((t) => t.id),
      entryFee: quiz.entry_fee,
      rewardCoins: quiz.reward_coins,
      passingScore: quiz.passing_score,
      timeLimitMinutes: quiz.time_limit_seconds ? Math.round(quiz.time_limit_seconds / 60) : null,
      maxAttempts: quiz.max_attempts,
      shuffleQuestions: quiz.shuffle_questions,
      showExplanations: quiz.show_explanations,
      visibility: quiz.visibility === 'unlisted' ? 'unlisted' : 'public',
      questions: quiz.questions.length
        ? quiz.questions.map((q) => ({
            prompt: q.prompt,
            type: q.type,
            points: q.points,
            explanation: q.explanation,
            options: q.options.length ? q.options : structuredClone(EMPTY_QUESTION.options),
          }))
        : [structuredClone(EMPTY_QUESTION)],
    });
  }, [quizQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...draft,
        tags: draft.tags,
        timeLimitMinutes: draft.timeLimitMinutes || null,
      };
      if (isEditing) {
        return api.patch<{ quiz: { id: string } }>(`/quizzes/${id}`, payload);
      }
      return api.post<{ id: string }>('/quizzes', payload);
    },
    onSuccess: (result) => {
      setErrors({});
      const newId = 'id' in result ? result.id : undefined;
      queryClient.invalidateQueries();
      toast.success('Quiz saved as a draft.');
      if (!isEditing && newId) navigate(`/app/quizzes/${newId}/edit`, { replace: true });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error('Could not save the quiz.');
      }
    },
  });

  const submitForReview = useMutation({
    mutationFn: async () => {
      await save.mutateAsync();
      return api.post(`/quizzes/${id}/submit`, { changeNote });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Submitted for review. A moderator will review it shortly.');
      navigate('/app/my-quizzes');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not submit the quiz.'),
  });

  const patch = (updates: Partial<QuizDraft>) => setDraft((current) => ({ ...current, ...updates }));

  const updateQuestion = (index: number, updates: Partial<BuilderQuestion>) =>
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((q, i) => (i === index ? { ...q, ...updates } : q)),
    }));

  const quizRules = rules.quiz as Record<string, number>;
  const minQuestions = Number(quizRules.min_questions ?? 3);
  const maxEntryFee = Number(quizRules.max_entry_fee ?? 100);
  const maxReward = Number(quizRules.max_reward_coins ?? 500);

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (draft.title.trim().length < 5) issues.push('Add a title of at least 5 characters.');
    if (draft.questions.length < minQuestions) issues.push(`Add at least ${minQuestions} questions.`);
    if (draft.entryFee > maxEntryFee) issues.push(`Entry fee cannot exceed ${maxEntryFee} QCoin.`);
    if (draft.rewardCoins > maxReward) issues.push(`Reward cannot exceed ${maxReward} QCoin.`);
    draft.questions.forEach((question, index) => {
      if (question.prompt.trim().length < 3) issues.push(`Question ${index + 1} needs a prompt.`);
      if (question.options.filter((o) => o.body.trim()).length < 2) {
        issues.push(`Question ${index + 1} needs at least two options.`);
      }
      const correct = question.options.filter((o) => o.isCorrect && o.body.trim()).length;
      if (question.type !== 'multiple' && correct !== 1) {
        issues.push(`Question ${index + 1} needs exactly one correct answer.`);
      }
      if (question.type === 'multiple' && correct < 1) {
        issues.push(`Question ${index + 1} needs at least one correct answer.`);
      }
    });
    return issues;
  }, [draft, minQuestions, maxEntryFee, maxReward]);

  if (isEditing && quizQuery.isLoading) return <FullPageLoader />;
  if (isEditing && quizQuery.error) return <ErrorState error={quizQuery.error} onRetry={() => quizQuery.refetch()} />;

  const status = quizQuery.data?.quiz.status;
  const locked = status === 'pending_review' || status === 'approved';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button to={isEditing ? '/app/my-quizzes' : '/app/quizzes'} variant="ghost" size="sm" icon={<ArrowLeft className="h-3.5 w-3.5" />}>
            {isEditing ? 'My quizzes' : 'Explore quizzes'}
          </Button>
          <h1 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-ink">
            {isEditing ? 'Edit quiz' : 'Create a quiz'}
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {status ? `Current status: ${status.replace(/_/g, ' ')}` : 'Drafts are private until you submit them for review.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={save.isPending}
            disabled={locked}
            onClick={() => save.mutate()}
          >
            Save draft
          </Button>
          {isEditing && (
            <Button
              variant="primary"
              size="sm"
              icon={<Send className="h-3.5 w-3.5" />}
              disabled={locked || validation.length > 0}
              loading={submitForReview.isPending}
              onClick={() => submitForReview.mutate()}
            >
              {status === 'changes_requested' || status === 'rejected' ? 'Resubmit for review' : 'Submit for review'}
            </Button>
          )}
        </div>
      </div>

      {locked && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800">
            This quiz is locked while it is under review or published. Unpublish it from My Quizzes to make changes.
          </p>
        </div>
      )}

      {quizQuery.data?.quiz.review_notes && (status === 'changes_requested' || status === 'rejected') && (
        <div className="mb-4 rounded-md border border-line bg-canvas px-3 py-2">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">Reviewer notes</p>
          <p className="mt-1 text-[13px] text-ink">{quizQuery.data.quiz.review_notes}</p>
        </div>
      )}

      <div className="mb-5 flex items-center gap-1.5">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors',
              index === step ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-muted hover:bg-canvas hover:text-ink',
            )}
          >
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-full text-[10px]',
                index === step ? 'bg-brand-600 text-white' : 'bg-line text-ink-muted',
              )}
            >
              {index + 1}
            </span>
            {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <Panel title="Quiz details">
          <div className="space-y-4">
            <TextInput
              label="Title"
              required
              value={draft.title}
              error={errors.title}
              maxLength={120}
              onChange={(event) => patch({ title: event.target.value })}
              placeholder="e.g. Everyday Physics"
            />
            <TextInput
              label="Short summary"
              value={draft.summary}
              error={errors.summary}
              maxLength={200}
              onChange={(event) => patch({ summary: event.target.value })}
              hint="One line shown on quiz cards."
            />
            <TextArea
              label="Description"
              rows={4}
              value={draft.description}
              error={errors.description}
              onChange={(event) => patch({ description: event.target.value })}
              hint="Optional longer description shown on the quiz page."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Category"
                value={draft.categoryId ?? ''}
                onChange={(event) => patch({ categoryId: event.target.value || null })}
                options={[{ value: '', label: 'No category' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              />
              <Select
                label="Difficulty"
                value={draft.difficultyId ?? ''}
                onChange={(event) => patch({ difficultyId: event.target.value || null })}
                options={[{ value: '', label: 'Not set' }, ...difficulties.map((d) => ({ value: d.id, label: d.name }))]}
              />
            </div>
            <div>
              <p className="label">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.length === 0 && <p className="text-xs text-ink-muted">No tags have been created by an administrator yet.</p>}
                {tags.map((tag) => {
                  const active = draft.tags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() =>
                        patch({
                          tags: active ? draft.tags.filter((t) => t !== tag.id) : [...draft.tags, tag.id],
                        })
                      }
                      className={cn(
                        'rounded border px-2 py-1 text-xs transition-colors',
                        active
                          ? 'border-brand-300 bg-brand-50 text-brand-700'
                          : 'border-line bg-white text-ink-soft hover:bg-canvas',
                      )}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
              {errors.tags && <p className="hint text-red-600">{errors.tags}</p>}
            </div>
          </div>
        </Panel>
      )}

      {step === 1 && (
        <div className="space-y-3">
          {draft.questions.map((question, index) => (
            <Panel
              key={index}
              title={`Question ${index + 1}`}
              description={
                question.type === 'multiple'
                  ? 'Multiple answers are correct.'
                  : 'Exactly one answer is correct.'
              }
              actions={
                draft.questions.length > 1 ? (
                  <IconButton
                    label={`Delete question ${index + 1}`}
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setConfirmDelete(index)}
                  />
                ) : undefined
              }
            >
              <div className="space-y-3">
                <TextInput
                  label="Question"
                  required
                  value={question.prompt}
                  onChange={(event) => updateQuestion(index, { prompt: event.target.value })}
                  placeholder="What would you like to ask?"
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Select
                    label="Type"
                    value={question.type}
                    onChange={(event) => updateQuestion(index, { type: event.target.value as BuilderQuestion['type'] })}
                    options={[
                      { value: 'single', label: 'Single answer' },
                      { value: 'multiple', label: 'Multiple answers' },
                      { value: 'true_false', label: 'True / false' },
                    ]}
                  />
                  <TextInput
                    label="Points"
                    type="number"
                    min={1}
                    max={20}
                    value={String(question.points)}
                    onChange={(event) => updateQuestion(index, { points: Number(event.target.value) })}
                  />
                  <div className="flex items-end pb-1">
                    <span className="text-xs text-ink-muted">
                      {question.options.filter((o) => o.isCorrect).length} marked correct
                    </span>
                  </div>
                </div>

                <div>
                  <p className="label">Options</p>
                  <div className="space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <GripVertical className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                        <input
                          className="input flex-1"
                          value={option.body}
                          placeholder={`Option ${optionIndex + 1}`}
                          onChange={(event) =>
                            updateQuestion(index, {
                              options: question.options.map((o, i) =>
                                i === optionIndex ? { ...o, body: event.target.value } : o,
                              ),
                            })
                          }
                        />
                        <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">
                          <input
                            type={question.type === 'multiple' ? 'checkbox' : 'radio'}
                            name={`correct-${index}`}
                            checked={option.isCorrect}
                            onChange={() =>
                              updateQuestion(index, {
                                options: question.options.map((o, i) =>
                                  question.type === 'multiple'
                                    ? i === optionIndex
                                      ? { ...o, isCorrect: !o.isCorrect }
                                      : o
                                    : { ...o, isCorrect: i === optionIndex },
                                ),
                              })
                            }
                            className="h-3.5 w-3.5 accent-brand-600"
                          />
                          Correct
                        </label>
                        {question.options.length > 2 && (
                          <IconButton
                            label="Remove option"
                            icon={<Trash2 className="h-3.5 w-3.5" />}
                            onClick={() =>
                              updateQuestion(index, { options: question.options.filter((_, i) => i !== optionIndex) })
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  {question.options.length < 6 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() =>
                        updateQuestion(index, { options: [...question.options, { body: '', isCorrect: false }] })
                      }
                    >
                      Add option
                    </Button>
                  )}
                </div>

                <TextArea
                  label="Explanation"
                  rows={2}
                  value={question.explanation}
                  onChange={(event) => updateQuestion(index, { explanation: event.target.value })}
                  hint="Shown after an attempt when explanations are enabled."
                />
              </div>
            </Panel>
          ))}

          <Button
            variant="secondary"
            block
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setDraft((current) => ({ ...current, questions: [...current.questions, structuredClone(EMPTY_QUESTION)] }))}
          >
            Add question
          </Button>
        </div>
      )}

      {step === 2 && (
        <Panel title="Rules and rewards">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="Entry fee (QCoin)"
                type="number"
                min={0}
                max={maxEntryFee}
                value={String(draft.entryFee)}
                error={errors.entryFee}
                hint={`Players pay this to start. Maximum ${maxEntryFee}.`}
                onChange={(event) => patch({ entryFee: Number(event.target.value) })}
              />
              <TextInput
                label="Reward on pass (QCoin)"
                type="number"
                min={0}
                max={maxReward}
                value={String(draft.rewardCoins)}
                error={errors.rewardCoins}
                hint={`Paid when a player reaches the pass mark. Maximum ${maxReward}.`}
                onChange={(event) => patch({ rewardCoins: Number(event.target.value) })}
              />
              <TextInput
                label="Passing score (%)"
                type="number"
                min={0}
                max={100}
                value={String(draft.passingScore)}
                error={errors.passingScore}
                onChange={(event) => patch({ passingScore: Number(event.target.value) })}
              />
              <TextInput
                label="Time limit (minutes)"
                type="number"
                min={1}
                value={draft.timeLimitMinutes === null ? '' : String(draft.timeLimitMinutes)}
                error={errors.timeLimitMinutes}
                hint="Leave empty for no limit."
                onChange={(event) => patch({ timeLimitMinutes: event.target.value ? Number(event.target.value) : null })}
              />
              <TextInput
                label="Attempts allowed per player"
                type="number"
                min={1}
                value={String(draft.maxAttempts)}
                error={errors.maxAttempts}
                onChange={(event) => patch({ maxAttempts: Number(event.target.value) })}
              />
              <Select
                label="Visibility"
                value={draft.visibility}
                onChange={(event) => patch({ visibility: event.target.value as 'public' | 'unlisted' })}
                options={[
                  { value: 'public', label: 'Public — listed in Explore' },
                  { value: 'unlisted', label: 'Unlisted — reachable by link only' },
                ]}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <Switch
                checked={draft.shuffleQuestions}
                onChange={(next) => patch({ shuffleQuestions: next })}
                label="Shuffle question order"
                hint="Each attempt presents questions in a different order."
              />
              <Switch
                checked={draft.showExplanations}
                onChange={(next) => patch({ showExplanations: next })}
                label="Show explanations after submission"
                hint="Players see your explanation for each question in their result."
              />
            </div>
          </div>
        </Panel>
      )}

      {step === 3 && (
        <Panel title="Review before submitting">
          <div className="space-y-4">
            <div>
              <h3 className="text-[13px] font-semibold text-ink">{draft.title || 'Untitled quiz'}</h3>
              <p className="mt-0.5 text-[13px] text-ink-muted">{draft.summary || 'No summary provided.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral">{draft.questions.length} questions</Badge>
              <Badge tone="neutral">Pass {draft.passingScore}%</Badge>
              <Badge tone={draft.entryFee > 0 ? 'neutral' : 'success'}>
                {draft.entryFee > 0 ? `${draft.entryFee} QCoin entry` : 'Free'}
              </Badge>
              {draft.rewardCoins > 0 && <Badge tone="brand">{draft.rewardCoins} QCoin reward</Badge>}
              <Badge tone="neutral">{draft.visibility}</Badge>
            </div>

            {validation.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Fix before submitting
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-amber-900">
                  {validation.map((issue) => (
                    <li key={issue}>· {issue}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <Check className="h-3.5 w-3.5" />
                Everything checks out. You can submit this quiz for moderation.
              </div>
            )}

            {isEditing && (
              <TextArea
                label="Change note (optional)"
                rows={2}
                value={changeNote}
                onChange={(event) => setChangeNote(event.target.value)}
                hint="Recorded in the moderation history so reviewers can compare versions."
              />
            )}

            {!isEditing && (
              <p className="text-[13px] text-ink-muted">
                Save the draft first, then submit it for review from the edit screen.
              </p>
            )}
          </div>
        </Panel>
      )}

      {Object.keys(errors).length > 0 && (
        <div className="mt-4">
          <InlineError message="Some fields need attention. Check the highlighted inputs." />
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <Button variant="secondary" size="md" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <Button variant="secondary" size="md" disabled={step === STEPS.length - 1} onClick={() => setStep((s) => s + 1)}>
          Next
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete this question?"
        description="The question and its options will be removed from the draft. Save the draft to keep the change."
        confirmLabel="Delete question"
        tone="danger"
        onConfirm={() => {
          if (confirmDelete !== null) {
            setDraft((current) => ({ ...current, questions: current.questions.filter((_, i) => i !== confirmDelete) }));
          }
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
