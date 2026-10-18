import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowUp, ArrowDown, Copy, Eye, GripVertical, Plus, Save, Send, Trash2, X,
} from 'lucide-react';
import endpoints, { type QuestionDto, type QuizAdminDto } from '@/services/endpoints';
import { apiErrorMessage } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Data';
import { Card, CardBody, CardHeader, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Modal, ConfirmDialog } from '@/components/ui/Overlay';
import { Input, Select, Textarea, Checkbox, Switch } from '@/components/ui/Form';
import {
  CONTENT_STATUS,
  DIFFICULTY_LABELS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
} from '@/utils/constants';
import { cn } from '@/utils/cn';

type QuestionType = (typeof QUESTION_TYPES)[keyof typeof QUESTION_TYPES];

let questionSeq = 0;
function newQuestion(type: QuestionType): QuestionDto {
  questionSeq += 1;
  const base: QuestionDto = {
    id: `q_${Date.now().toString(36)}_${questionSeq}`,
    type,
    text: '',
    points: 1,
    hint: '',
    explanation: '',
    options: [],
    correctAnswers: [],
  };
  if (type === QUESTION_TYPES.SINGLE_CHOICE || type === QUESTION_TYPES.MULTIPLE_CHOICE) {
    base.options = [
      { id: 'o1', text: '', isCorrect: type === QUESTION_TYPES.SINGLE_CHOICE },
      { id: 'o2', text: '', isCorrect: false },
    ];
  }
  if (type === QUESTION_TYPES.TRUE_FALSE) {
    base.correctBoolean = true;
  }
  if (type === QUESTION_TYPES.SHORT_ANSWER) {
    base.evaluationRules = { mode: 'KEYWORDS', keywords: [{ text: '', weight: 1 }], minMatches: 1, passRatio: 0.7, caseSensitive: false, flagForReviewOnFail: false };
  }
  return base;
}

/**
 * Quiz builder: create/edit a quiz draft with all five question types,
 * validation, preview, save-draft, and submit-for-review.
 */
export function QuizBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  useDocumentTitle(id ? 'Edit quiz' : 'New quiz');

  const isEdit = Boolean(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [tags, setTags] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(0);
  const [passingScore, setPassingScore] = useState(50);
  const [entryFee, setEntryFee] = useState(0);
  const [reward, setReward] = useState(0);
  const [rewardMode, setRewardMode] = useState('ALL_PASSERS');
  const [topPercent, setTopPercent] = useState(20);
  const [attemptsAllowed, setAttemptsAllowed] = useState(1);
  const [questions, setQuestions] = useState<QuestionDto[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [changeNote, setChangeNote] = useState('');

  const detailQuery = useQuery({
    queryKey: ['quiz-detail', id],
    queryFn: () => endpoints.quizzes.detail(id!),
    enabled: isEdit,
  });

  // Hydrate the form from the server draft once.
  useEffect(() => {
    const quiz = detailQuery.data?.quiz as QuizAdminDto | undefined;
    if (!quiz) return;
    setTitle(quiz.title ?? '');
    setDescription(quiz.description ?? '');
    setDifficulty(quiz.difficulty ?? 'MEDIUM');
    setTags((quiz.tags ?? []).join(', '));
    setTimeLimitMinutes(quiz.timeLimitMinutes ?? 0);
    setPassingScore(quiz.passingScore ?? 50);
    setEntryFee(quiz.entryFee ?? 0);
    setReward(quiz.reward ?? 0);
    setRewardMode(quiz.rewardMode ?? 'ALL_PASSERS');
    setTopPercent(quiz.topPercent ?? 20);
    setAttemptsAllowed(quiz.attemptsAllowed ?? 1);
    setQuestions((quiz.questions ?? []).map((q) => ({ ...q })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQuery.data]);

  const buildPayload = () => ({
    title,
    description,
    difficulty,
    tags: tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 15),
    timeLimitMinutes: Number(timeLimitMinutes) || 0,
    passingScore: Number(passingScore),
    entryFee: Number(entryFee) || 0,
    reward: Number(reward) || 0,
    rewardMode,
    topPercent: Number(topPercent),
    attemptsAllowed: Number(attemptsAllowed),
    questions: questions.map((q) => ({
      ...q,
      points: Number(q.points) || 1,
      options: (q.options ?? []).map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text),
    })),
  });

  const validate = (): string | null => {
    if (title.trim().length < 3) return 'Give your quiz a title of at least 3 characters.';
    for (const q of questions) {
      if (!q.text.trim()) return 'Every question needs its text.';
      if (q.type === QUESTION_TYPES.SINGLE_CHOICE || q.type === QUESTION_TYPES.MULTIPLE_CHOICE) {
        const options = (q.options ?? []).filter((o) => o.text.trim());
        if (options.length < 2) return `Question "${q.text.slice(0, 30)}" needs at least 2 options.`;
        const correct = options.filter((o) => o.isCorrect).length;
        if (q.type === QUESTION_TYPES.SINGLE_CHOICE && correct !== 1)
          return `Single-choice question "${q.text.slice(0, 30)}" needs exactly one correct option.`;
        if (q.type === QUESTION_TYPES.MULTIPLE_CHOICE && correct < 1)
          return `Multiple-choice question "${q.text.slice(0, 30)}" needs at least one correct option.`;
      }
      if (q.type === QUESTION_TYPES.FILL_BLANK && (q.correctAnswers ?? []).filter(Boolean).length === 0)
        return `Fill-in question "${q.text.slice(0, 30)}" needs accepted answers.`;
      if (
        q.type === QUESTION_TYPES.SHORT_ANSWER &&
        q.evaluationRules?.mode !== 'MANUAL' &&
        (q.evaluationRules?.keywords ?? []).filter((k) => k.text.trim()).length === 0
      )
        return `Short-answer question "${q.text.slice(0, 30)}" needs keyword rules (or MANUAL mode).`;
    }
    return null;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (isEdit) return endpoints.quizzes.update(id!, { ...payload, changeNote });
      return endpoints.quizzes.create(payload as never);
    },
    onSuccess: (result) => {
      toast.success('Draft saved');
      void queryClient.invalidateQueries({ queryKey: ['quizzes', 'mine'] });
      if (!isEdit && result.quiz?._id) {
        navigate(`/creator/quizzes/${result.quiz._id}/edit`, { replace: true });
      }
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not save draft')),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        await endpoints.quizzes.update(id!, { ...buildPayload(), changeNote });
        return endpoints.quizzes.submit(id!, changeNote || 'Submitted for review');
      }
      const created = await endpoints.quizzes.create(buildPayload() as never);
      return endpoints.quizzes.submit(created.quiz._id, changeNote || 'Submitted for review');
    },
    onSuccess: () => {
      toast.success('Submitted for review', 'A moderator will take a look shortly.');
      void queryClient.invalidateQueries({ queryKey: ['quizzes', 'mine'] });
      navigate('/creator/pending');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not submit')),
  });

  const onSaveDraft = () => {
    const problem = validate();
    if (problem && questions.length > 0) {
      toast.error('Check your questions', problem);
      return;
    }
    saveMutation.mutate();
  };

  const onSubmit = () => {
    const problem = validate();
    if (problem) {
      toast.error('Fix before submitting', problem);
      return;
    }
    if (questions.length === 0) {
      toast.error('Add at least one question before submitting');
      return;
    }
    setConfirmSubmit(true);
  };

  const updateQuestion = (index: number, patch: Partial<QuestionDto>) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const moveQuestion = (index: number, delta: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const duplicateQuestion = (index: number) => {
    setQuestions((prev) => {
      const copy = { ...prev[index], id: `q_${Date.now().toString(36)}` };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
    toast.success('Question duplicated');
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  if (detailQuery.isLoading) return <SkeletonList count={2} />;
  if (detailQuery.isError && isEdit) {
    return (
      <ErrorState
        title="Could not load quiz"
        description={apiErrorMessage(detailQuery.error)}
        action={<Button onClick={() => navigate('/my/quizzes')}>Back to my quizzes</Button>}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit quiz' : 'Create a quiz'}
        description={
          isEdit
            ? 'Update your draft, then resubmit for review.'
            : 'Build questions, save a draft anytime, and submit when ready.'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(true)} icon={<Eye className="h-4 w-4" />}>
              Preview
            </Button>
            <Button variant="outline" onClick={onSaveDraft} loading={saveMutation.isPending} icon={<Save className="h-4 w-4" />}>
              Save draft
            </Button>
            <Button onClick={onSubmit} icon={<Send className="h-4 w-4" />}>
              Submit for review
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Basics" />
            <CardBody className="space-y-4">
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
              <Textarea
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={4000}
                placeholder="What is this quiz about?"
              />
              <Select label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Input
                label="Tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                hint="Comma-separated, e.g. science, biology"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Rules & economy" subtitle="Entry fees and rewards are both optional." />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Time limit (min)"
                  type="number"
                  min={0}
                  max={600}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                  hint="0 = untimed"
                />
                <Input
                  label="Passing score (%)"
                  type="number"
                  min={0}
                  max={100}
                  value={passingScore}
                  onChange={(e) => setPassingScore(Number(e.target.value))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Entry fee (QCoins)"
                  type="number"
                  min={0}
                  max={1000}
                  value={entryFee}
                  onChange={(e) => setEntryFee(Number(e.target.value))}
                />
                <Input
                  label="Reward (QCoins)"
                  type="number"
                  min={0}
                  max={5000}
                  value={reward}
                  onChange={(e) => setReward(Number(e.target.value))}
                />
              </div>
              {reward > 0 && (
                <>
                  <Select label="Reward mode" value={rewardMode} onChange={(e) => setRewardMode(e.target.value)}>
                    <option value="ALL_PASSERS">Everyone who passes</option>
                    <option value="TOP_PERCENT">Top performers only</option>
                  </Select>
                  {rewardMode === 'TOP_PERCENT' && (
                    <Input
                      label="Top percent"
                      type="number"
                      min={1}
                      max={100}
                      value={topPercent}
                      onChange={(e) => setTopPercent(Number(e.target.value))}
                    />
                  )}
                </>
              )}
              <Input
                label="Attempts allowed per user"
                type="number"
                min={1}
                max={20}
                value={attemptsAllowed}
                onChange={(e) => setAttemptsAllowed(Number(e.target.value))}
              />
              <div className="rounded-lg bg-background px-3 py-2.5 text-xs text-body">
                {entryFee > 0 || reward > 0 ? (
                  <>
                    This quiz is <strong>{entryFee > 0 ? 'paid entry' : 'free entry'}</strong> with{' '}
                    <strong>{reward > 0 ? `a ${reward} QCoin reward` : 'no reward'}</strong>.
                  </>
                ) : (
                  <>Free entry, no reward — pure participation.</>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Resubmission note" subtitle="Visible to moderators reviewing your changes." />
            <CardBody>
              <Textarea
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="What changed since the last version?"
                maxLength={500}
              />
            </CardBody>
          </Card>
        </div>

        {/* Questions */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Questions ({questions.length})
            </h2>
            <Select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  setQuestions((prev) => [...prev, newQuestion(e.target.value as QuestionType)]);
                  e.target.value = '';
                }
              }}
              className="w-56"
              aria-label="Add question"
            >
              <option value="">+ Add question type…</option>
              {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          {questions.length === 0 && (
            <Card>
              <CardBody className="py-10 text-center">
                <p className="text-sm text-body">
                  No questions yet. Add your first question using the dropdown above.
                </p>
              </CardBody>
            </Card>
          )}

          <AnimatePresence initial={false}>
            {questions.map((question, index) => (
              <motion.div
                key={question.id}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <Card>
                  <CardHeader
                    title={
                      <span className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted" />
                        <Badge tone="info">
                          {QUESTION_TYPE_LABELS[question.type as keyof typeof QUESTION_TYPE_LABELS] ?? question.type}
                        </Badge>
                        <span className="text-heading">Question {index + 1}</span>
                      </span>
                    }
                    actions={
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => moveQuestion(index, -1)} disabled={index === 0} aria-label="Move up">
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveQuestion(index, 1)}
                          disabled={index === questions.length - 1}
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => duplicateQuestion(index)} aria-label="Duplicate">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeQuestion(index)} aria-label="Delete">
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    }
                  />
                  <CardBody className="space-y-4">
                    <Textarea
                      label="Question text"
                      value={question.text}
                      onChange={(e) => updateQuestion(index, { text: e.target.value })}
                      required
                      maxLength={2000}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Points"
                        type="number"
                        min={1}
                        max={100}
                        value={question.points}
                        onChange={(e) => updateQuestion(index, { points: Number(e.target.value) })}
                      />
                      <Input
                        label="Hint (optional)"
                        value={question.hint ?? ''}
                        onChange={(e) => updateQuestion(index, { hint: e.target.value })}
                      />
                    </div>

                    <QuestionEditor question={question} onChange={(patch) => updateQuestion(index, patch)} />

                    <Input
                      label="Explanation (shown after submission)"
                      value={question.explanation ?? ''}
                      onChange={(e) => updateQuestion(index, { explanation: e.target.value })}
                      maxLength={2000}
                    />
                  </CardBody>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Preview modal */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Quiz preview"
        description="How participants will see the questions."
        size="xl"
      >
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-heading">{title || 'Untitled quiz'}</h3>
            {description && <p className="mt-1 text-sm text-body">{description}</p>}
            <p className="mt-2 text-xs text-muted">
              {questions.length} questions · passing score {passingScore}%
              {timeLimitMinutes > 0 ? ` · ${timeLimitMinutes} minute limit` : ''}
            </p>
          </div>
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-lg border border-line p-4">
              <p className="text-sm font-medium text-heading">
                {i + 1}. {q.text || <em className="text-muted">(empty question)</em>}
              </p>
              {(q.type === QUESTION_TYPES.SINGLE_CHOICE || q.type === QUESTION_TYPES.MULTIPLE_CHOICE) && (
                <ul className="mt-2 space-y-1">
                  {(q.options ?? []).filter((o) => o.text).map((o) => (
                    <li key={o.id} className="text-sm text-body">
                      • {o.text}
                    </li>
                  ))}
                </ul>
              )}
              {q.type === QUESTION_TYPES.TRUE_FALSE && (
                <p className="mt-2 text-sm text-body">True / False</p>
              )}
              {q.type === QUESTION_TYPES.FILL_BLANK && (
                <p className="mt-2 text-sm italic text-body">Short text answer</p>
              )}
              {q.type === QUESTION_TYPES.SHORT_ANSWER && (
                <p className="mt-2 text-sm italic text-body">Long text answer</p>
              )}
            </div>
          ))}
          {questions.length === 0 && <p className="text-sm text-muted">No questions to preview yet.</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={() => {
          setConfirmSubmit(false);
          submitMutation.mutate();
        }}
        title="Submit for review?"
        message={
          <div className="space-y-2">
            <p>
              Your quiz will be locked while moderators check the questions and answer keys. You&apos;ll be notified
              when a decision is made.
            </p>
            <Input
              label="Note for moderators (optional)"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="Anything they should know?"
            />
          </div>
        }
        confirmLabel="Submit"
        loading={submitMutation.isPending}
      />
    </div>
  );
}

/** Per-type answer configuration (correct options, accepted answers, keyword rules). */
function QuestionEditor({
  question,
  onChange,
}: {
  question: QuestionDto;
  onChange: (patch: Partial<QuestionDto>) => void;
}) {
  const type = question.type;

  if (type === QUESTION_TYPES.SINGLE_CHOICE || type === QUESTION_TYPES.MULTIPLE_CHOICE) {
    const options = question.options ?? [];
    const single = type === QUESTION_TYPES.SINGLE_CHOICE;
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="field-label">Options {single ? '(select the correct one)' : '(select all correct)'}</p>
        <div className="space-y-2">
          {options.map((option, i) => (
            <div key={option.id} className="flex items-center gap-2">
              <input
                type={single ? 'radio' : 'checkbox'}
                name={`correct-${question.id}`}
                checked={Boolean(option.isCorrect)}
                onChange={(e) => {
                  const next = options.map((o, j) =>
                    single
                      ? { ...o, isCorrect: j === i ? e.target.checked : false }
                      : j === i
                        ? { ...o, isCorrect: e.target.checked }
                        : o
                  );
                  onChange({ options: next });
                }}
                className={single ? 'h-4 w-4 border-line-strong text-brand-600' : 'h-4 w-4 rounded border-line-strong text-brand-600'}
                aria-label={`Mark option ${i + 1} correct`}
              />
              <input
                type="text"
                value={option.text}
                onChange={(e) => {
                  const next = options.map((o, j) => (j === i ? { ...o, text: e.target.value } : o));
                  onChange({ options: next });
                }}
                className="field-input"
                placeholder={`Option ${i + 1}`}
                maxLength={500}
              />
              <button
                type="button"
                onClick={() => onChange({ options: options.filter((_, j) => j !== i) })}
                className="rounded p-1.5 text-muted hover:bg-surface-muted hover:text-danger"
                aria-label="Remove option"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 border border-gray-300 text-brand-600 hover:bg-gray-100"
          onClick={() =>
            onChange({
              options: [...options, { id: `o${options.length + 1}_${Date.now().toString(36)}`, text: '', isCorrect: false }],
            })
          }
          icon={<Plus className="h-4 w-4" />}
        >
          Add option
        </Button>
      </div>
    );
  }

  if (type === QUESTION_TYPES.TRUE_FALSE) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="field-label">Correct answer</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onChange({ correctBoolean: true })}
            className={cn(
              'flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-200',
              question.correctBoolean === true
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-300 bg-white text-zinc-600 hover:border-brand-300 hover:bg-gray-100'
            )}
          >
            True
          </button>
          <button
            type="button"
            onClick={() => onChange({ correctBoolean: false })}
            className={cn(
              'flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-200',
              question.correctBoolean === false
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-300 bg-white text-zinc-600 hover:border-brand-300 hover:bg-gray-100'
            )}
          >
            False
          </button>
        </div>
      </div>
    );
  }

  if (type === QUESTION_TYPES.FILL_BLANK) {
    const answers = question.correctAnswers ?? [];
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="field-label">Accepted answers (any match is correct)</p>
        <div className="space-y-2">
          {answers.map((answer, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={answer}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  onChange({ correctAnswers: next });
                }}
                className="field-input"
                placeholder={`Accepted answer ${i + 1}`}
              />
              <button
                type="button"
                onClick={() => onChange({ correctAnswers: answers.filter((_, j) => j !== i) })}
                className="rounded p-1.5 text-muted hover:bg-surface-muted hover:text-danger"
                aria-label="Remove answer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 border border-gray-300 text-brand-600 hover:bg-gray-100"
          onClick={() => onChange({ correctAnswers: [...answers, ''] })}
          icon={<Plus className="h-4 w-4" />}
        >
          Add accepted answer
        </Button>
        <div className="mt-3">
          <Checkbox
            label="Case sensitive"
            checked={Boolean(question.evaluationRules?.caseSensitive)}
            onChange={(e) =>
              onChange({
                evaluationRules: {
                  mode: 'KEYWORDS',
                  keywords: question.evaluationRules?.keywords ?? [],
                  minMatches: 1,
                  passRatio: 0.7,
                  caseSensitive: e.target.checked,
                  flagForReviewOnFail: false,
                },
              })
            }
          />
        </div>
      </div>
    );
  }

  if (type === QUESTION_TYPES.SHORT_ANSWER) {
    const rules = question.evaluationRules ?? {
      mode: 'KEYWORDS' as const,
      keywords: [],
      minMatches: 1,
      passRatio: 0.7,
      caseSensitive: false,
      flagForReviewOnFail: false,
    };
    const manual = rules.mode === 'MANUAL';
    return (
      <div className="space-y-3">
        <Switch
          label="Manual review mode"
          description="Off: keyword grading. On: answers are flagged for a human to grade."
          checked={manual}
          onChange={(next) => onChange({ evaluationRules: { ...rules, mode: next ? 'MANUAL' : 'KEYWORDS' } })}
        />
        {!manual && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="field-label">
              Keyword rules — answers matching enough weighted keywords pass automatically
            </p>
            <div className="space-y-2">
              {(rules.keywords ?? []).map((keyword, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={keyword.text}
                    onChange={(e) => {
                      const next = [...(rules.keywords ?? [])];
                      next[i] = { ...next[i], text: e.target.value };
                      onChange({ evaluationRules: { ...rules, keywords: next } });
                    }}
                    className="field-input"
                    placeholder={`Keyword ${i + 1}`}
                  />
                  <input
                    type="number"
                    value={keyword.weight}
                    min={1}
                    max={100}
                    onChange={(e) => {
                      const next = [...(rules.keywords ?? [])];
                      next[i] = { ...next[i], weight: Number(e.target.value) };
                      onChange({ evaluationRules: { ...rules, keywords: next } });
                    }}
                    className="field-input w-20"
                    aria-label="Weight"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ evaluationRules: { ...rules, keywords: (rules.keywords ?? []).filter((_, j) => j !== i) } })
                    }
                    className="rounded p-1.5 text-muted hover:bg-surface-muted hover:text-danger"
                    aria-label="Remove keyword"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 border border-gray-300 text-brand-600 hover:bg-gray-100"
              onClick={() =>
                onChange({
                  evaluationRules: { ...rules, keywords: [...(rules.keywords ?? []), { text: '', weight: 1 }] },
                })
              }
              icon={<Plus className="h-4 w-4" />}
            >
              Add keyword
            </Button>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Input
                label="Min keyword matches"
                type="number"
                min={1}
                value={rules.minMatches ?? 1}
                onChange={(e) => onChange({ evaluationRules: { ...rules, minMatches: Number(e.target.value) } })}
              />
              <Input
                label="Pass ratio (0–1)"
                type="number"
                step="0.1"
                min={0}
                max={1}
                value={rules.passRatio ?? 0.7}
                onChange={(e) => onChange({ evaluationRules: { ...rules, passRatio: Number(e.target.value) } })}
                hint="Fraction of total keyword weight required to pass."
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default QuizBuilderPage;
