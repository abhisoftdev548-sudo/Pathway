import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  ExternalLink,
  Eye,
  FileCheck2,
  Flag,
  Lightbulb,
  ListChecks,
  Lock,
  MessageSquareText,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  Terminal,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, Badge, Button, Card, Dialog, DialogContent, DialogFooter, Field, Input, Select, Skeleton, Textarea } from '@/components/ui';
import { DifficultyBadge, ErrorBlock, ProgressRing, TaskTypeBadge } from '@/components/common';
import { apiGet, apiPatch, apiPost, fieldErrors, getApiError } from '@/lib/api';
import { cn, formatMinutes, taskTypeMeta } from '@/lib/utils';
import type { Task, TaskType } from '@/lib/types';

interface Submission {
  id: string;
  taskId: string;
  kind: string;
  language: string;
  content: string;
  notes: string;
  selfVerified: boolean;
  createdAt: string;
}

interface TaskDetailResponse {
  task: Task;
  enrollment: { id: string; status: string; learningPace: string };
  roadmap: { id: string; title: string; slug: string };
  module: { id: string; title: string };
  topic: { id: string; title: string };
  submissions: Submission[];
}

interface QuizReview {
  score: number;
  total: number;
  message: string;
  review: {
    question: string;
    options: string[];
    selectedOptionIndex: number;
    correctOptionIndex: number;
    correct: boolean;
    explanation: string;
  }[];
}

const languages = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'sql', label: 'SQL' },
  { value: 'pseudo', label: 'Pseudocode' },
];

export function TaskView() {
  const { taskId = '', enrollmentId } = useParams();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['me', 'task', taskId],
    queryFn: () => apiGet<TaskDetailResponse>(`/me/tasks/${taskId}`),
    enabled: Boolean(taskId),
  });

  const [notes, setNotes] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizReview, setQuizReview] = useState<QuizReview | null>(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [selfVerified, setSelfVerified] = useState(false);
  const [hintsShown, setHintsShown] = useState(0);
  const [solution, setSolution] = useState('');
  const [reopenOpen, setReopenOpen] = useState(false);

  const task = query.data?.task;

  // Sync local editor state once data arrives.
  if (task && !notesLoaded) {
    setNotes(task.privateNotes ?? '');
    setDuration(task.actualDuration || task.estimatedDuration);
    setCode(task.codingExercise?.starterCode ?? '');
    setNotesLoaded(true);
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['me', 'task', taskId] });
    void queryClient.invalidateQueries({ queryKey: ['me', 'workspace'] });
    void queryClient.invalidateQueries({ queryKey: ['me', 'dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['me', 'roadmaps'] });
    void queryClient.invalidateQueries({ queryKey: ['me', 'achievements'] });
    void queryClient.invalidateQueries({ queryKey: ['me', 'tasks'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const saveProgress = useMutation({
    mutationFn: () => apiPatch(`/me/tasks/${taskId}/progress`, { privateNotes: notes, actualDuration: duration, ...(selfVerified ? { selfVerified } : {}) }),
    onSuccess: () => {
      toast.success('Progress saved');
      invalidate();
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  const complete = useMutation({
    mutationFn: () =>
      apiPost<{ nextTask?: Task | null; summary?: unknown; alreadyCompleted?: boolean }>(`/me/tasks/${taskId}/complete`, {
        actualDuration: duration,
        ...(quizReview ? { quizAnswers: Object.keys(answers).map((key) => answers[Number(key)]) } : {}),
      }),
    onSuccess: (data) => {
      toast.success(data.alreadyCompleted ? 'Task was already complete' : 'Task completed', {
        description: data.nextTask ? `Next up: ${data.nextTask.title}` : 'Your plan has been recalculated.',
      });
      invalidate();
    },
    onError: (error) => {
      const parsed = getApiError(error);
      toast.error(parsed.message, { description: Object.values(fieldErrors(parsed.details))[0] });
    },
  });

  const reopen = useMutation({
    mutationFn: () => apiPost(`/me/tasks/${taskId}/reopen`, {}),
    onSuccess: () => {
      toast.success('Task reopened', { description: 'Progress was recalculated. Your completion history is preserved.' });
      setReopenOpen(false);
      invalidate();
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  const submitQuiz = useMutation({
    mutationFn: () => apiPost<QuizReview>(`/me/tasks/${taskId}/quiz-attempt`, { answers: task!.quizQuestions.map((_, index) => answers[index]) }),
    onSuccess: (data) => {
      setQuizReview(data);
      invalidate();
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  const saveSolution = useMutation({
    mutationFn: () => apiPost<{ submission: Submission }>(`/me/tasks/${taskId}/submissions`, { content: code, language, notes: submissionNotes, selfVerified }),
    onSuccess: () => {
      toast.success('Solution saved', { description: selfVerified ? 'Marked as self-verified — the solution explanation is now unlocked.' : 'Saved to your submission history.' });
      invalidate();
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  const revealSolution = useMutation({
    mutationFn: () => apiGet<{ solutionExplanation: string }>(`/me/tasks/${taskId}/solution`),
    onSuccess: (data) => setSolution(data.solutionExplanation),
    onError: (error) => toast.error(getApiError(error).message),
  });

  const allAnswered = task ? task.quizQuestions.every((_, index) => answers[index] !== undefined) : false;
  const isCompleted = task?.status === 'completed';
  const locked = Boolean(task?.locked);
  const typeMeta = task ? taskTypeMeta[task.type as TaskType] ?? taskTypeMeta.practice : null;
  const verified = selfVerified || Boolean(query.data?.submissions.some((submission) => submission.selfVerified));

  const backHref = useMemo(() => {
    if (!query.data) return '/my-roadmaps';
    const id = enrollmentId ?? query.data.enrollment.id;
    return `/workspace/${id}/modules/${query.data.module.id}`;
  }, [query.data, enrollmentId]);

  if (query.isLoading) {
    return <div className="space-y-5"><Skeleton className="h-8 w-64" /><Skeleton className="h-36 w-full" /><div className="grid gap-5 lg:grid-cols-[1fr_340px]"><Skeleton className="h-[520px]" /><Skeleton className="h-80" /></div></div>;
  }
  if (query.isError || !query.data || !task) {
    return <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />;
  }

  const { roadmap, module: taskModule, topic, submissions } = query.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <Link to="/my-roadmaps" className="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="size-3.5" /> My roadmaps</Link>
        <ChevronRight className="size-3" />
        <Link to={`/workspace/${query.data.enrollment.id}/modules/${taskModule.id}`} className="truncate hover:text-ink">{taskModule.title}</Link>
        <ChevronRight className="size-3" />
        <span className="truncate text-ink/70">{topic.title}</span>
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-line bg-surface p-5 sm:flex-row sm:items-start sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <TaskTypeBadge type={task.type} />
            <DifficultyBadge difficulty={task.difficulty} />
            {task.status === 'completed' ? <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200"><CheckCircle2 className="size-3" /> Completed</Badge> : task.status === 'in_progress' ? <Badge tone="bg-amber-50 text-amber-800 ring-amber-200">In progress</Badge> : null}
            {locked ? <Badge tone="bg-canvas text-muted ring-line"><Lock className="size-3" /> Locked</Badge> : null}
          </div>
          <h1 className="mt-2.5 text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">{task.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" /> {formatMinutes(task.estimatedDuration)}</span>
            <span>{roadmap.title}</span>
            <span>{taskModule.title}</span>
            {task.completedAt ? <span className="text-emerald-700">Completed {new Date(task.completedAt).toLocaleDateString()}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm"><Link to={backHref}><ArrowLeft /> Back</Link></Button>
          {isCompleted ? (
            <Button variant="outline" size="sm" onClick={() => setReopenOpen(true)}><RotateCcw /> Reopen task</Button>
          ) : (
            <Button size="sm" disabled={locked} loading={complete.isPending} onClick={() => complete.mutate()}>
              <CheckCircle2 /> Mark complete
            </Button>
          )}
        </div>
      </div>

      {locked ? (
        <Alert tone="warning" title="This task is locked">
          {task.lockReason ?? 'Complete the prerequisite tasks to unlock this one.'} Prerequisites: {task.prerequisiteIds.length > 0 ? 'earlier tasks in this topic and module.' : 'none listed.'}
        </Alert>
      ) : null}

      {isCompleted ? (
        <Alert tone="success" title="You've completed this task">
          Completed {task.completedAt ? new Date(task.completedAt).toLocaleString() : ''}{task.actualDuration ? ` · ${formatMinutes(task.actualDuration)} recorded` : ''}. Reopening recalculates progress while keeping this history.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className={cn('flex size-9 items-center justify-center rounded-xl', typeMeta?.tone ?? 'bg-brand-soft text-brand-deep')}>
                {task.type === 'code' ? <Code2 className="size-4.5" /> : <BookOpen className="size-4.5" />}
              </span>
              <div>
                <h2 className="text-sm font-semibold text-ink">Overview</h2>
                <p className="text-[11px] text-muted">{typeMeta?.label ?? task.type} task · {task.difficulty}</p>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-[1.8] text-ink/80">{task.description}</p>

            {task.learningObjectives.length > 0 ? (
              <div className="mt-5">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Target className="size-3.5" /> Learning objectives</h3>
                <ul className="mt-2 space-y-1.5">
                  {task.learningObjectives.map((objective) => (
                    <li key={objective} className="flex items-start gap-2 text-sm leading-relaxed text-ink/75"><Check className="mt-1 size-3.5 shrink-0 text-brand" /> {objective}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><ListChecks className="size-4 text-brand" /> Instructions</h2>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-[1.85] text-ink/80">{task.instructions}</div>
          </Card>

          {task.codingExercise ? (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line/70 bg-ink px-5 py-3.5 text-white">
                <div className="flex items-center gap-2">
                  <Terminal className="size-4 text-emerald-400" />
                  <p className="text-sm font-semibold">Coding exercise</p>
                </div>
                <Badge tone="bg-white/10 text-white ring-white/20">Self-verified</Badge>
              </div>
              <div className="space-y-5 p-5">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Problem statement</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink/80">{task.codingExercise.problemStatement}</p>
                </div>
                {task.codingExercise.examples.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Examples</h3>
                    <div className="mt-2 space-y-2">
                      {task.codingExercise.examples.map((example, index) => (
                        <div key={index} className="rounded-xl border border-line bg-canvas/60 p-3 font-mono text-[11px] leading-relaxed">
                          <p className="text-muted">Input: <span className="text-ink">{example.input}</span></p>
                          <p className="mt-0.5 text-muted">Output: <span className="text-ink">{example.output}</span></p>
                          {example.explanation ? <p className="mt-1 font-sans text-[11px] text-muted">{example.explanation}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {task.codingExercise.constraints.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Constraints</h3>
                    <ul className="mt-2 space-y-1">
                      {task.codingExercise.constraints.map((constraint) => (
                        <li key={constraint} className="flex items-start gap-2 text-xs leading-relaxed text-muted"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" /> {constraint}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {task.codingExercise.hints.length > 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                    <div className="flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900"><Lightbulb className="size-3.5" /> Hints</p>
                      <span className="text-[11px] text-amber-800">{hintsShown} of {task.codingExercise.hints.length} revealed</span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {task.codingExercise.hints.slice(0, hintsShown).map((hint, index) => (
                        <p key={index} className="flex items-start gap-2 text-xs leading-relaxed text-amber-900/90"><span className="font-mono">{index + 1}.</span> {hint}</p>
                      ))}
                    </div>
                    {hintsShown < task.codingExercise.hints.length ? (
                      <Button size="sm" variant="outline" className="mt-3 border-amber-300 bg-surface text-amber-900" onClick={() => setHintsShown((value) => value + 1)}>
                        <Lightbulb /> Reveal hint {hintsShown + 1}
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-ink">Your solution</h3>
                    <Select value={language} onChange={(event) => setLanguage(event.target.value)} className="h-8 w-40 text-xs" aria-label="Language">
                      {languages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </Select>
                  </div>
                  <Textarea
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    rows={12}
                    spellCheck={false}
                    placeholder={task.codingExercise.starterCode || 'Write your solution here…'}
                    className="mt-2 font-mono text-[12px] leading-relaxed"
                    aria-label="Solution code"
                  />
                  <div className="mt-2">
                    <Input value={submissionNotes} onChange={(event) => setSubmissionNotes(event.target.value)} placeholder="Notes: complexity, edge cases, what you learned…" className="text-xs" />
                  </div>
                  <label className="mt-3 flex items-start gap-2 rounded-xl bg-canvas/70 p-3 text-xs leading-relaxed text-muted">
                    <input type="checkbox" checked={selfVerified} onChange={(event) => setSelfVerified(event.target.checked)} className="mt-0.5 size-4 rounded border-line accent-[rgb(var(--brand))]" />
                    <span><span className="font-medium text-ink">I ran my solution against the examples and edge cases.</span> Checking this unlocks the solution explanation.</span>
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" loading={saveSolution.isPending} disabled={!code.trim() || locked} onClick={() => saveSolution.mutate()}><Send /> Save solution</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!verified || Boolean(solution) || revealSolution.isPending}
                      loading={revealSolution.isPending}
                      onClick={() => revealSolution.mutate()}
                    >
                      <Eye /> Show solution explanation
                    </Button>
                    {!verified ? <span className="self-center text-[11px] text-muted">Self-verify a submission to unlock.</span> : null}
                  </div>
                  {solution ? (
                    <div className="mt-3 rounded-xl border border-brand/20 bg-brand-soft/40 p-4">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-deep"><Sparkles className="size-3.5" /> Solution explanation</p>
                      <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-ink/80">{solution}</p>
                    </div>
                  ) : null}
                </div>

                {submissions.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Submission history <span className="text-xs font-normal text-muted">({submissions.length})</span></h3>
                    <div className="mt-2 space-y-2">
                      {submissions.map((submission) => (
                        <details key={submission.id} className="rounded-xl border border-line bg-surface">
                          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-xs">
                            <Badge tone={submission.selfVerified ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-canvas text-ink/70 ring-line'}>
                              {submission.selfVerified ? 'Self-verified' : 'Saved'}
                            </Badge>
                            <span className="font-medium text-ink">{submission.language}</span>
                            <span className="text-muted">{new Date(submission.createdAt).toLocaleString()}</span>
                          </summary>
                          {submission.notes ? <p className="border-t border-line/70 px-3 py-2 text-xs text-muted">{submission.notes}</p> : null}
                          <pre className="overflow-x-auto border-t border-line/70 bg-canvas/60 p-3 font-mono text-[11px] leading-relaxed text-ink/80">{submission.content}</pre>
                        </details>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          {task.quizQuestions.length > 0 ? (
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><FileCheck2 className="size-4 text-brand" /> Knowledge check</h2>
                <Badge tone="bg-canvas text-ink/70 ring-line">{task.quizQuestions.length} questions</Badge>
              </div>
              <div className="mt-4 space-y-5">
                {task.quizQuestions.map((question, questionIndex) => {
                  const review = quizReview?.review[questionIndex];
                  return (
                    <div key={questionIndex}>
                      <p className="text-sm font-medium leading-relaxed text-ink">{questionIndex + 1}. {question.question}</p>
                      <div className="mt-2 space-y-1.5">
                        {question.options.map((option, optionIndex) => {
                          const selected = answers[questionIndex] === optionIndex;
                          const showCorrect = review && optionIndex === review.correctOptionIndex;
                          const showWrong = review && selected && !review.correct;
                          return (
                            <button
                              key={optionIndex}
                              type="button"
                              disabled={Boolean(quizReview) || locked}
                              onClick={() => setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))}
                              className={cn(
                                'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition',
                                selected && !review ? 'border-brand bg-brand-soft/60 text-ink' : 'border-line bg-surface text-ink/80 hover:border-brand/30',
                                showCorrect && 'border-emerald-300 bg-emerald-50 text-emerald-900',
                                showWrong && 'border-rose-300 bg-rose-50 text-rose-900',
                                (quizReview || locked) && 'cursor-default',
                              )}
                            >
                              <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-1 ring-inset', selected || showCorrect ? 'bg-brand text-white ring-brand' : 'bg-canvas text-muted ring-line')}>
                                {showCorrect ? <Check className="size-3" /> : showWrong ? <X className="size-3" /> : String.fromCharCode(65 + optionIndex)}
                              </span>
                              <span className="flex-1">{option}</span>
                            </button>
                          );
                        })}
                      </div>
                      {review ? (
                        <p className={cn('mt-2 rounded-lg px-3 py-2 text-xs leading-relaxed', review.correct ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900')}>
                          {review.correct ? 'Correct. ' : `Not quite — the correct answer is “${review.options[review.correctOptionIndex]}”. `}
                          {review.explanation}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {quizReview ? (
                  <>
                    <Badge tone={quizReview.score === quizReview.total ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}>
                      Score: {quizReview.score} / {quizReview.total}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setQuizReview(null);
                        setAnswers({});
                      }}
                    >
                      <RotateCcw /> Try again
                    </Button>
                    {!isCompleted ? <Button size="sm" loading={complete.isPending} onClick={() => complete.mutate()}><CheckCircle2 /> Mark task complete</Button> : null}
                  </>
                ) : (
                  <>
                    <Button size="sm" disabled={!allAnswered || locked} loading={submitQuiz.isPending} onClick={() => submitQuiz.mutate()}><FileCheck2 /> Check answers</Button>
                    <span className="text-xs text-muted">{Object.keys(answers).length} of {task.quizQuestions.length} answered</span>
                  </>
                )}
              </div>
            </Card>
          ) : null}

          {task.acceptanceCriteria.length > 0 ? (
            <Card className="p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Flag className="size-4 text-brand" /> Definition of done</h2>
              <p className="mt-1 text-xs text-muted">Self-check each criterion honestly before marking the task complete.</p>
              <div className="mt-3 space-y-2">
                {task.acceptanceCriteria.map((criterion) => (
                  <label key={criterion} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line/70 px-3 py-2.5 text-sm leading-relaxed text-ink/80 transition hover:bg-canvas/50">
                    <input type="checkbox" className="mt-0.5 size-4 rounded border-line accent-[rgb(var(--brand))]" />
                    {criterion}
                  </label>
                ))}
              </div>
            </Card>
          ) : null}

          {task.resources.length > 0 ? (
            <Card className="p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><ExternalLink className="size-4 text-brand" /> Resources</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {task.resources.map((resource) => (
                  <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 transition hover:border-brand/30 hover:bg-canvas/40">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink group-hover:text-brand">{resource.title}</span>
                      <span className="text-[11px] capitalize text-muted">{resource.type}</span>
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-muted" />
                  </a>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Progress</h2>
              {isCompleted ? <ProgressRing value={100} size={40} /> : <span className="text-[11px] text-muted">Not complete</span>}
            </div>
            <div className="mt-4">
              <Field label="Minutes spent" htmlFor="task-duration" hint="1–1440">
                <Input id="task-duration" type="number" min={1} max={1440} value={duration} onChange={(event) => setDuration(Number(event.target.value))} disabled={locked} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Private notes" htmlFor="task-notes" hint="Only visible to you">
                <Textarea id="task-notes" rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What clicked? What's still unclear?" disabled={locked} />
              </Field>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" loading={saveProgress.isPending} disabled={locked} onClick={() => saveProgress.mutate()}>Save notes</Button>
            </div>
            <div className="mt-4 border-t border-line/70 pt-4">
              {isCompleted ? (
                <Button variant="outline" className="w-full" onClick={() => setReopenOpen(true)}><RotateCcw /> Reopen task</Button>
              ) : (
                <Button className="w-full" loading={complete.isPending} disabled={locked} onClick={() => complete.mutate()}><CheckCircle2 /> Mark complete</Button>
              )}
              <p className="mt-2 text-center text-[11px] leading-relaxed text-muted">
                Completing records your minutes, updates every percentage and keeps an audit entry. You can reopen later.
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><AlertTriangle className="size-3.5 text-accent" /> How completion counts</h3>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
              <li className="flex gap-1.5"><Check className="mt-0.5 size-3 shrink-0 text-emerald-600" /> Only published, non-archived tasks are eligible.</li>
              <li className="flex gap-1.5"><Check className="mt-0.5 size-3 shrink-0 text-emerald-600" /> Progress recalculates immediately on completion or reopen.</li>
              <li className="flex gap-1.5"><Check className="mt-0.5 size-3 shrink-0 text-emerald-600" /> Reopening keeps your history and timestamps.</li>
            </ul>
            <div className="mt-3">
              <p className="text-[11px] font-medium text-ink">Task metadata</p>
              <dl className="mt-1.5 space-y-1 text-[11px] text-muted">
                <div className="flex justify-between"><dt>Type</dt><dd className="capitalize text-ink/70">{task.type}</dd></div>
                <div className="flex justify-between"><dt>Difficulty</dt><dd className="capitalize text-ink/70">{task.difficulty}</dd></div>
                <div className="flex justify-between"><dt>Estimate</dt><dd className="text-ink/70">{formatMinutes(task.estimatedDuration)}</dd></div>
                <div className="flex justify-between"><dt>Prerequisites</dt><dd className="text-ink/70">{task.prerequisiteIds.length}</dd></div>
                <div className="flex justify-between"><dt>Attempts</dt><dd className="text-ink/70">{task.attemptCount}</dd></div>
              </dl>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-ink">Jump to</h3>
            <div className="mt-2 space-y-1">
              <Link to={backHref} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-canvas hover:text-ink"><MessageSquareText className="size-3.5" /> {taskModule.title}</Link>
              <Link to={`/workspace/${query.data.enrollment.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-canvas hover:text-ink"><ListChecks className="size-3.5" /> Full workspace</Link>
              <Link to={`/tasks?type=${task.type}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-canvas hover:text-ink"><Play className="size-3.5" /> All {task.type} tasks</Link>
              <Link to="/today" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-canvas hover:text-ink"><Target className="size-3.5" /> Today's plan</Link>
            </div>
          </Card>
        </aside>
      </div>

      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent title="Reopen this task?" description="The completion record stays in your history. Progress percentages update immediately, and any dependent tasks may re-lock.">
          <div className="rounded-xl bg-canvas/70 p-4 text-xs leading-relaxed text-muted">
            <p className="font-medium text-ink">{task.title}</p>
            <p className="mt-1">Completed {task.completedAt ? new Date(task.completedAt).toLocaleString() : 'previously'} · {formatMinutes(task.actualDuration || task.estimatedDuration)} recorded</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={reopen.isPending} onClick={() => reopen.mutate()}><RotateCcw /> Reopen task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
