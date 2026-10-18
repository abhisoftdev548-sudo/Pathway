import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Code2,
  Eye,
  FileCheck2,
  Layers,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, Badge, Button, Card, Checkbox, Dialog, DialogContent, DialogFooter, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, EmptyState, Field, Input, Select, Skeleton, Textarea } from '@/components/ui';
import { ErrorBlock, TaskTypeBadge } from '@/components/common';
import { apiDelete, apiGet, apiPatch, apiPost, fieldErrors, getApiError } from '@/lib/api';
import { cn, formatMinutes } from '@/lib/utils';
import type { AdminIssue } from '@/lib/types';

interface AdminResource { title: string; url: string; type: string; verified?: boolean }
interface AdminQuizQuestion { question: string; options: string[]; correctOptionIndex: number; explanation: string }
interface AdminCodingExercise {
  problemStatement: string;
  examples: { input: string; output: string; explanation: string }[];
  constraints: string[];
  hints: string[];
  solutionExplanation: string;
  starterCode: string;
  selfVerified: boolean;
}
interface AdminTask {
  id: string;
  roadmapId: string;
  moduleId: string;
  topicId: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  estimatedDuration: number;
  learningObjectives: string[];
  instructions: string;
  acceptanceCriteria: string[];
  resources: AdminResource[];
  prerequisites: string[];
  quizQuestions: AdminQuizQuestion[];
  codingExercise: AdminCodingExercise | null;
  published: boolean;
  archivedAt: string | null;
  order: number;
}
interface AdminTopic {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  order: number;
  estimatedDuration: number;
  learningOutcomes: string[];
  prerequisites: string[];
  resources: AdminResource[];
  published: boolean;
  archivedAt: string | null;
  tasks: AdminTask[];
}
interface AdminModule {
  id: string;
  title: string;
  description: string;
  order: number;
  learningOutcomes: string[];
  prerequisiteModuleIds: string[];
  published: boolean;
  archivedAt: string | null;
  topics: AdminTopic[];
}
interface AdminCurriculumResponse {
  roadmap: { id: string; title: string; slug: string; category: string; difficulty: string; published: boolean; archivedAt: string | null; version: number; tagline: string; description: string };
  modules: AdminModule[];
  validation: { errors: number; warnings: number; issues: AdminIssue[] };
  publishedCounts: { modules: number; topics: number; tasks: number };
}

function lines(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function parseResources(value: string): AdminResource[] {
  return lines(value).flatMap((line) => {
    const [title, url, type] = line.split('|').map((part) => part.trim());
    if (!title || !url) return [];
    return [{ title, url, type: type || 'article', verified: false }];
  });
}

function resourcesToText(resources: AdminResource[]): string {
  return resources.map((resource) => `${resource.title} | ${resource.url} | ${resource.type}`).join('\n');
}

function parseQuiz(value: string): AdminQuizQuestion[] {
  return lines(value).flatMap((line) => {
    const parts = line.split('|').map((part) => part.trim());
    if (parts.length < 4) return [];
    const correct = Number(parts[parts.length - 1]);
    const question = parts[0];
    const options = parts.slice(1, -1);
    return [{ question, options, correctOptionIndex: Number.isFinite(correct) ? correct : 0, explanation: '' }];
  });
}

function quizToText(questions: AdminQuizQuestion[]): string {
  return questions.map((question) => [question.question, ...question.options, String(question.correctOptionIndex)].join(' | ')).join('\n');
}

function parseExamples(value: string) {
  return lines(value).flatMap((line) => {
    const [input, output, explanation] = line.split('|').map((part) => part.trim());
    if (!input || !output) return [];
    return [{ input, output, explanation: explanation ?? '' }];
  });
}

/* ── Dialogs ─────────────────────────────────────────────────────────────── */

function ModuleDialog({ initial, open, onOpenChange, onSubmit, pending }: { initial?: AdminModule | null; open: boolean; onOpenChange: (open: boolean) => void; onSubmit: (body: Record<string, unknown>) => void; pending: boolean }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [outcomes, setOutcomes] = useState((initial?.learningOutcomes ?? []).join('\n'));
  const [published, setPublished] = useState(initial?.published ?? true);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={initial ? 'Edit module' : 'New module'} description="Modules group topics into a coherent stage. Order is managed separately with move actions.">
        <div className="space-y-4">
          <Field label="Title" htmlFor="module-title"><Input id="module-title" value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
          <Field label="Description" htmlFor="module-description"><Textarea id="module-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <Field label="Learning outcomes" htmlFor="module-outcomes" hint="One per line"><Textarea id="module-outcomes" rows={3} value={outcomes} onChange={(event) => setOutcomes(event.target.value)} /></Field>
          <Checkbox checked={published} onChange={setPublished} label="Published" description="Unpublished modules are hidden from learners; existing progress is preserved." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={pending} disabled={title.trim().length < 3} onClick={() => onSubmit({ title: title.trim(), description: description.trim(), learningOutcomes: lines(outcomes), published })}>{initial ? 'Save module' : 'Add module'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TopicDialog({ initial, open, onOpenChange, onSubmit, pending }: { initial?: AdminTopic | null; open: boolean; onOpenChange: (open: boolean) => void; onSubmit: (body: Record<string, unknown>) => void; pending: boolean }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [duration, setDuration] = useState(initial?.estimatedDuration ?? 60);
  const [outcomes, setOutcomes] = useState((initial?.learningOutcomes ?? []).join('\n'));
  const [resources, setResources] = useState(resourcesToText(initial?.resources ?? []));
  const [published, setPublished] = useState(initial?.published ?? true);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={initial ? 'Edit topic' : 'New topic'} description="Topics hold the tasks learners actually complete." size="lg">
        <div className="space-y-4">
          <Field label="Title" htmlFor="topic-title"><Input id="topic-title" value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
          <Field label="Description" htmlFor="topic-description"><Textarea id="topic-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Estimated minutes" htmlFor="topic-duration"><Input id="topic-duration" type="number" min={5} max={2000} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></Field>
            <div className="flex items-end"><Checkbox checked={published} onChange={setPublished} label="Published" className="w-full" /></div>
          </div>
          <Field label="Learning outcomes" htmlFor="topic-outcomes" hint="One per line"><Textarea id="topic-outcomes" rows={3} value={outcomes} onChange={(event) => setOutcomes(event.target.value)} /></Field>
          <Field label="Resources" htmlFor="topic-resources" hint="Title | URL | type (one per line)"><Textarea id="topic-resources" rows={3} value={resources} onChange={(event) => setResources(event.target.value)} placeholder="MDN — Arrays | https://developer.mozilla.org/… | documentation" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            loading={pending}
            disabled={title.trim().length < 3 || parseResources(resources).length !== lines(resources).length}
            onClick={() => onSubmit({ title: title.trim(), description: description.trim(), estimatedDuration: duration, learningOutcomes: lines(outcomes), resources: parseResources(resources), published })}
          >
            {initial ? 'Save topic' : 'Add topic'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({ initial, open, onOpenChange, onSubmit, pending }: { initial?: AdminTask | null; open: boolean; onOpenChange: (open: boolean) => void; onSubmit: (body: Record<string, unknown>) => void; pending: boolean }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState(initial?.type ?? 'learn');
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? 'beginner');
  const [duration, setDuration] = useState(initial?.estimatedDuration ?? 20);
  const [objectives, setObjectives] = useState((initial?.learningObjectives ?? []).join('\n'));
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');
  const [criteria, setCriteria] = useState((initial?.acceptanceCriteria ?? []).join('\n'));
  const [resources, setResources] = useState(resourcesToText(initial?.resources ?? []));
  const [quiz, setQuiz] = useState(quizToText(initial?.quizQuestions ?? []));
  const [hasCoding, setHasCoding] = useState(Boolean(initial?.codingExercise));
  const [problem, setProblem] = useState(initial?.codingExercise?.problemStatement ?? '');
  const [examples, setExamples] = useState((initial?.codingExercise?.examples ?? []).map((example) => `${example.input} | ${example.output} | ${example.explanation}`).join('\n'));
  const [constraints, setConstraints] = useState((initial?.codingExercise?.constraints ?? []).join('\n'));
  const [hints, setHints] = useState((initial?.codingExercise?.hints ?? []).join('\n'));
  const [starter, setStarter] = useState(initial?.codingExercise?.starterCode ?? '');
  const [solution, setSolution] = useState(initial?.codingExercise?.solutionExplanation ?? '');
  const [published, setPublished] = useState(initial?.published ?? true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={initial ? 'Edit task' : 'New task'} description="Tasks are the unit of completion. Published tasks appear in existing enrollments without resetting progress." size="xl">
        <div className="space-y-4">
          <Field label="Title" htmlFor="task-title"><Input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
          <Field label="Description" htmlFor="task-description" hint="20–5000 characters"><Textarea id="task-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type" htmlFor="task-type">
              <Select id="task-type" value={type} onChange={(event) => setType(event.target.value)}>
                {['learn', 'practice', 'code', 'quiz', 'project', 'revision', 'assessment'].map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
            </Field>
            <Field label="Difficulty" htmlFor="task-difficulty">
              <Select id="task-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                {['beginner', 'intermediate', 'advanced'].map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
            </Field>
            <Field label="Minutes" htmlFor="task-duration"><Input id="task-duration" type="number" min={1} max={600} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Learning objectives" htmlFor="task-objectives" hint="One per line"><Textarea id="task-objectives" rows={3} value={objectives} onChange={(event) => setObjectives(event.target.value)} /></Field>
            <Field label="Acceptance criteria" htmlFor="task-criteria" hint="One per line"><Textarea id="task-criteria" rows={3} value={criteria} onChange={(event) => setCriteria(event.target.value)} /></Field>
          </div>
          <Field label="Instructions" htmlFor="task-instructions"><Textarea id="task-instructions" rows={5} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></Field>
          <Field label="Resources" htmlFor="task-resources" hint="Title | URL | type"><Textarea id="task-resources" rows={2} value={resources} onChange={(event) => setResources(event.target.value)} /></Field>
          <Field label="Quiz questions" htmlFor="task-quiz" hint="Question | option A | option B | correct index (one per line)">
            <Textarea id="task-quiz" rows={3} value={quiz} onChange={(event) => setQuiz(event.target.value)} placeholder="What is a closure? | A function with its scope | A CSS rule | 0" />
          </Field>
          <Checkbox checked={hasCoding} onChange={setHasCoding} label="Include coding exercise" description="Adds a problem statement, examples and a hidden solution explanation." />
          {hasCoding ? (
            <div className="space-y-4 rounded-xl border border-line bg-canvas/40 p-4">
              <Field label="Problem statement" htmlFor="task-problem"><Textarea id="task-problem" rows={3} value={problem} onChange={(event) => setProblem(event.target.value)} /></Field>
              <Field label="Examples" htmlFor="task-examples" hint="Input | Output | Explanation"><Textarea id="task-examples" rows={2} value={examples} onChange={(event) => setExamples(event.target.value)} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Constraints" htmlFor="task-constraints" hint="One per line"><Textarea id="task-constraints" rows={2} value={constraints} onChange={(event) => setConstraints(event.target.value)} /></Field>
                <Field label="Hints" htmlFor="task-hints" hint="One per line"><Textarea id="task-hints" rows={2} value={hints} onChange={(event) => setHints(event.target.value)} /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Starter code" htmlFor="task-starter"><Textarea id="task-starter" rows={3} value={starter} onChange={(event) => setStarter(event.target.value)} className="font-mono text-xs" /></Field>
                <Field label="Solution explanation" htmlFor="task-solution"><Textarea id="task-solution" rows={3} value={solution} onChange={(event) => setSolution(event.target.value)} /></Field>
              </div>
            </div>
          ) : null}
          <Checkbox checked={published} onChange={setPublished} label="Published" description="Unpublished tasks are excluded from progress denominators." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            loading={pending}
            disabled={title.trim().length < 4 || description.trim().length < 20}
            onClick={() =>
              onSubmit({
                title: title.trim(),
                description: description.trim(),
                type,
                difficulty,
                estimatedDuration: duration,
                learningObjectives: lines(objectives),
                instructions: instructions.trim(),
                acceptanceCriteria: lines(criteria),
                resources: parseResources(resources),
                quizQuestions: parseQuiz(quiz),
                codingExercise: hasCoding
                  ? {
                      problemStatement: problem.trim(),
                      examples: parseExamples(examples),
                      constraints: lines(constraints),
                      hints: lines(hints),
                      starterCode: starter,
                      solutionExplanation: solution.trim(),
                      selfVerified: true,
                    }
                  : null,
                published,
              })
            }
          >
            {initial ? 'Save task' : 'Add task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export function AdminCurriculum() {
  const { roadmapId = '' } = useParams();
  const queryClient = useQueryClient();
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [moduleOpen, setModuleOpen] = useState(false);
  const [moduleEditing, setModuleEditing] = useState<AdminModule | null>(null);
  const [topicOpen, setTopicOpen] = useState(false);
  const [topicEditing, setTopicEditing] = useState<AdminTopic | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskEditing, setTaskEditing] = useState<AdminTask | null>(null);
  const [taskTopicId, setTaskTopicId] = useState<string | null>(null);
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({});

  const query = useQuery({
    queryKey: ['admin', 'curriculum', roadmapId],
    queryFn: () => apiGet<AdminCurriculumResponse>(`/admin/roadmaps/${roadmapId}/curriculum`),
    enabled: Boolean(roadmapId),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
    void queryClient.invalidateQueries({ queryKey: ['roadmaps'] });
  };

  const request = useMutation({
    mutationFn: ({ method, path, body }: { method: 'post' | 'patch' | 'delete'; path: string; body?: unknown }) =>
      method === 'post' ? apiPost(path, body) : method === 'patch' ? apiPatch(path, body) : apiDelete(path),
    onSuccess: (data) => {
      const message = (data as { message?: string })?.message;
      toast.success(message ?? 'Curriculum updated');
      refresh();
    },
    onError: (error) => {
      const parsed = getApiError(error);
      toast.error(parsed.message, { description: Object.values(fieldErrors(parsed.details))[0] });
    },
  });

  const data = query.data;
  const modules = useMemo(() => (data?.modules ?? []).filter((module) => showArchived || !module.archivedAt), [data, showArchived]);
  const selectedModule = modules.find((module) => module.id === selectedModuleId) ?? modules[0];

  if (query.isLoading) {
    return <div className="space-y-5"><Skeleton className="h-28 w-full" /><div className="grid gap-5 lg:grid-cols-[280px_1fr]"><Skeleton className="h-[600px]" /><Skeleton className="h-[600px]" /></div></div>;
  }
  if (query.isError || !data) return <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />;

  const { roadmap, validation, publishedCounts } = data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <Link to="/admin/roadmaps" className="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="size-3.5" /> Roadmaps</Link>
        <span aria-hidden>/</span>
        <span className="truncate text-ink/70">{roadmap.title}</span>
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={roadmap.published ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-canvas text-muted ring-line'}>{roadmap.published ? 'Published' : 'Draft'}</Badge>
            {roadmap.archivedAt ? <Badge tone="bg-rose-50 text-rose-700 ring-rose-200">Archived</Badge> : null}
            <Badge tone="bg-canvas text-ink/70 ring-line">v{roadmap.version}</Badge>
            <Badge tone={validation.errors > 0 ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}><ShieldCheck className="size-3" /> {validation.errors} errors · {validation.warnings} warnings</Badge>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{roadmap.title}</h1>
          <p className="mt-1 text-xs text-muted">{roadmap.category} · {roadmap.difficulty} · {publishedCounts.modules} published modules · {publishedCounts.topics} topics · {publishedCounts.tasks} tasks</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to={`/admin/roadmaps/${roadmap.id}/preview`}><Eye /> Preview</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/admin/validation"><ShieldCheck /> Validation</Link></Button>
          {roadmap.published ? (
            <Button variant="outline" size="sm" onClick={() => request.mutate({ method: 'post', path: `/admin/roadmaps/${roadmap.id}/unpublish` })}><XCircle /> Unpublish</Button>
          ) : (
            <Button size="sm" onClick={() => request.mutate({ method: 'post', path: `/admin/roadmaps/${roadmap.id}/publish` })}><UploadCloud /> Publish roadmap</Button>
          )}
        </div>
      </div>

      {validation.issues.length > 0 ? (
        <Alert tone={validation.errors > 0 ? 'danger' : 'warning'} title={`${validation.errors} error(s), ${validation.warnings} warning(s)`}>
          <ul className="mt-1 space-y-1 text-xs">
            {validation.issues.slice(0, 4).map((issue, index) => <li key={`${issue.code}-${index}`}>• {issue.message}</li>)}
          </ul>
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Modules</p>
            <Button size="icon-sm" variant="outline" aria-label="Add module" onClick={() => { setModuleEditing(null); setModuleOpen(true); }}><Plus /></Button>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-muted">
            <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="size-3.5 rounded border-line accent-[rgb(var(--brand))]" />
            Show archived
          </label>
          <div className="space-y-1.5">
            {modules.map((module, index) => {
              const active = module.id === selectedModule?.id;
              const tasks = module.topics.reduce((sum, topic) => sum + topic.tasks.filter((task) => !task.archivedAt).length, 0);
              return (
                <div key={module.id} className={cn('rounded-xl border transition', active ? 'border-brand/30 bg-brand-soft/50' : 'border-transparent hover:border-line')}>
                  <button onClick={() => setSelectedModuleId(module.id)} className="flex w-full items-start gap-2 px-2.5 py-2 text-left">
                    <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold', active ? 'bg-brand text-white' : 'bg-canvas text-muted ring-1 ring-inset ring-line')}>{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-xs font-semibold', active ? 'text-brand-deep' : 'text-ink/80')}>{module.title}</span>
                      <span className="mt-0.5 block text-[10px] text-muted">{module.topics.length} topics · {tasks} tasks {module.published ? '' : '· draft'}{module.archivedAt ? ' · archived' : ''}</span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0">
          {!selectedModule ? (
            <EmptyState icon={<Layers className="size-6" />} title="No modules yet" description="Add the first module, then topics and tasks. A roadmap needs one published module, topic and task to publish." action={<Button onClick={() => { setModuleEditing(null); setModuleOpen(true); }}><Plus /> Add module</Button>} />
          ) : (
            <div className="space-y-4">
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="bg-canvas text-ink/70 ring-line">Module {selectedModule.order}</Badge>
                      <Badge tone={selectedModule.published ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-canvas text-muted ring-line'}>{selectedModule.published ? 'Published' : 'Draft'}</Badge>
                      {selectedModule.archivedAt ? <Badge tone="bg-rose-50 text-rose-700 ring-rose-200">Archived</Badge> : null}
                    </div>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">{selectedModule.title}</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{selectedModule.description || 'No description yet.'}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label="Move module up" onClick={() => request.mutate({ method: 'post', path: `/admin/modules/${selectedModule.id}/move`, body: { direction: 'up' } })}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Move module down" onClick={() => request.mutate({ method: 'post', path: `/admin/modules/${selectedModule.id}/move`, body: { direction: 'down' } })}><ArrowDown /></Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Module actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => { setModuleEditing(selectedModule); setModuleOpen(true); }}><Pencil /> Edit module</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => request.mutate({ method: 'patch', path: `/admin/modules/${selectedModule.id}`, body: { published: !selectedModule.published } })}>
                          {selectedModule.published ? <XCircle /> : <UploadCloud />}
                          {selectedModule.published ? 'Unpublish module' : 'Publish module'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => { setTopicEditing(null); setTopicOpen(true); }}><Plus /> Add topic</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {selectedModule.archivedAt ? (
                          <DropdownMenuItem onSelect={() => request.mutate({ method: 'post', path: `/admin/modules/${selectedModule.id}/restore` })}><RefreshCcw /> Restore</DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem className="text-rose-700" onSelect={() => request.mutate({ method: 'delete', path: `/admin/modules/${selectedModule.id}` })}><Archive /> Archive module</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {selectedModule.learningOutcomes.length > 0 ? (
                  <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                    {selectedModule.learningOutcomes.map((outcome) => <li key={outcome} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted"><CheckCircle2 className="mt-0.5 size-3 shrink-0 text-emerald-600" /> {outcome}</li>)}
                  </ul>
                ) : null}
              </Card>

              <div className="space-y-3">
                {selectedModule.topics.length === 0 ? (
                  <EmptyState icon={<BookOpen className="size-6" />} title="This module has no topics" description="Add a topic, then at least one learn, practice and apply task so learners have a complete loop." action={<Button size="sm" onClick={() => { setTopicEditing(null); setTopicOpen(true); }}><Plus /> Add topic</Button>} />
                ) : (
                  selectedModule.topics
                    .filter((topic) => showArchived || !topic.archivedAt)
                    .map((topic) => {
                      const open = openTopics[topic.id] ?? true;
                      return (
                        <Card key={topic.id} className="overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-3">
                            <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpenTopics((current) => ({ ...current, [topic.id]: !open }))} aria-expanded={open}>
                              <ChevronDown className={cn('size-4 shrink-0 text-muted transition', open && 'rotate-180')} />
                              <span className="min-w-0">
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <span className="truncate text-sm font-semibold text-ink">{topic.title}</span>
                                  <Badge tone={topic.published ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-canvas text-muted ring-line'}>{topic.published ? 'Published' : 'Draft'}</Badge>
                                  {topic.archivedAt ? <Badge tone="bg-rose-50 text-rose-700 ring-rose-200">Archived</Badge> : null}
                                </span>
                                <span className="mt-0.5 block text-[10px] text-muted">{topic.tasks.length} tasks · {formatMinutes(topic.estimatedDuration)}</span>
                              </span>
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${topic.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onSelect={() => { setTopicEditing(topic); setTopicOpen(true); }}><Pencil /> Edit topic</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => request.mutate({ method: 'patch', path: `/admin/topics/${topic.id}`, body: { published: !topic.published } })}>
                                  {topic.published ? 'Unpublish topic' : 'Publish topic'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => { setTaskEditing(null); setTaskTopicId(topic.id); setTaskOpen(true); }}><Plus /> Add task</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => request.mutate({ method: 'post', path: `/admin/topics/${topic.id}/move`, body: { direction: 'up' } })}><ArrowUp /> Move up</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => request.mutate({ method: 'post', path: `/admin/topics/${topic.id}/move`, body: { direction: 'down' } })}><ArrowDown /> Move down</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {topic.archivedAt ? (
                                  <DropdownMenuItem onSelect={() => request.mutate({ method: 'post', path: `/admin/topics/${topic.id}/restore` })}><RefreshCcw /> Restore</DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem className="text-rose-700" onSelect={() => request.mutate({ method: 'delete', path: `/admin/topics/${topic.id}` })}><Archive /> Archive topic</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {open ? (
                            <div className="border-t border-line/70 bg-canvas/20 px-4 py-3">
                              {topic.description ? <p className="mb-2 text-xs leading-relaxed text-muted">{topic.description}</p> : null}
                              <div className="space-y-1.5">
                                {topic.tasks.length === 0 ? (
                                  <p className="rounded-lg bg-surface p-3 text-xs text-muted">No tasks. <button className="font-medium text-brand hover:underline" onClick={() => { setTaskEditing(null); setTaskTopicId(topic.id); setTaskOpen(true); }}>Add the first task</button>.</p>
                                ) : (
                                  topic.tasks.filter((task) => showArchived || !task.archivedAt).map((task) => (
                                    <div key={task.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/70 bg-surface px-3 py-2">
                                      <span className="flex size-6 items-center justify-center rounded-md bg-canvas text-muted">{task.type === 'code' ? <Code2 className="size-3" /> : task.type === 'quiz' ? <FileCheck2 className="size-3" /> : <ListChecks className="size-3" />}</span>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-medium text-ink">{task.title}</p>
                                        <p className="text-[10px] text-muted">{formatMinutes(task.estimatedDuration)} · {task.difficulty} {task.prerequisites.length > 0 ? `· ${task.prerequisites.length} prereq` : ''}</p>
                                      </div>
                                      <TaskTypeBadge type={task.type as never} />
                                      {task.published ? <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200">Published</Badge> : <Badge tone="bg-canvas text-muted ring-line">Draft</Badge>}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${task.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                          <DropdownMenuItem onSelect={() => { setTaskEditing(task); setTaskTopicId(topic.id); setTaskOpen(true); }}><Pencil /> Edit task</DropdownMenuItem>
                                          {task.published ? (
                                            <DropdownMenuItem onSelect={() => request.mutate({ method: 'post', path: `/admin/tasks/${task.id}/unpublish` })}><XCircle /> Unpublish</DropdownMenuItem>
                                          ) : (
                                            <DropdownMenuItem onSelect={() => request.mutate({ method: 'post', path: `/admin/tasks/${task.id}/publish` })}><UploadCloud /> Publish</DropdownMenuItem>
                                          )}
                                          <DropdownMenuItem onSelect={() => request.mutate({ method: 'post', path: `/admin/tasks/${task.id}/move`, body: { direction: 'up' } })}><ArrowUp /> Move up</DropdownMenuItem>
                                          <DropdownMenuItem onSelect={() => request.mutate({ method: 'post', path: `/admin/tasks/${task.id}/move`, body: { direction: 'down' } })}><ArrowDown /> Move down</DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          {task.archivedAt ? (
                                            <DropdownMenuItem onSelect={() => request.mutate({ method: 'post', path: `/admin/tasks/${task.id}/restore` })}><RefreshCcw /> Restore</DropdownMenuItem>
                                          ) : (
                                            <DropdownMenuItem className="text-rose-700" onSelect={() => request.mutate({ method: 'delete', path: `/admin/tasks/${task.id}` })}><Trash2 /> Archive task</DropdownMenuItem>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          ) : null}
                        </Card>
                      );
                    })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {moduleOpen ? (
        <ModuleDialog
          key={moduleEditing?.id ?? 'new-module'}
          open={moduleOpen}
          onOpenChange={setModuleOpen}
          initial={moduleEditing}
          pending={request.isPending}
          onSubmit={(body) => {
            if (moduleEditing) {
              request.mutate({ method: 'patch', path: `/admin/modules/${moduleEditing.id}`, body }, { onSuccess: () => setModuleOpen(false) });
            } else {
              request.mutate({ method: 'post', path: `/admin/roadmaps/${roadmapId}/modules`, body }, { onSuccess: () => setModuleOpen(false) });
            }
          }}
        />
      ) : null}

      {topicOpen ? (
        <TopicDialog
          key={topicEditing?.id ?? `new-topic-${selectedModule?.id}`}
          open={topicOpen}
          onOpenChange={setTopicOpen}
          initial={topicEditing}
          pending={request.isPending}
          onSubmit={(body) => {
            if (topicEditing) {
              request.mutate({ method: 'patch', path: `/admin/topics/${topicEditing.id}`, body }, { onSuccess: () => setTopicOpen(false) });
            } else if (selectedModule) {
              request.mutate({ method: 'post', path: `/admin/modules/${selectedModule.id}/topics`, body }, { onSuccess: () => setTopicOpen(false) });
            }
          }}
        />
      ) : null}

      {taskOpen && taskTopicId ? (
        <TaskDialog
          key={taskEditing?.id ?? `new-task-${taskTopicId}`}
          open={taskOpen}
          onOpenChange={setTaskOpen}
          initial={taskEditing}
          pending={request.isPending}
          onSubmit={(body) => {
            if (taskEditing) {
              request.mutate({ method: 'patch', path: `/admin/tasks/${taskEditing.id}`, body }, { onSuccess: () => setTaskOpen(false) });
            } else {
              request.mutate({ method: 'post', path: `/admin/topics/${taskTopicId}/tasks`, body }, { onSuccess: () => setTaskOpen(false) });
            }
          }}
        />
      ) : null}
    </div>
  );
}

/* ── Preview ─────────────────────────────────────────────────────────────── */

export function AdminPreview() {
  const { roadmapId = '' } = useParams();
  const [showArchived, setShowArchived] = useState(true);
  const query = useQuery({
    queryKey: ['admin', 'preview', roadmapId],
    queryFn: () => apiGet<AdminCurriculumResponse & { notice: string }>(`/admin/roadmaps/${roadmapId}/preview`),
    enabled: Boolean(roadmapId),
  });

  if (query.isLoading) return <div className="space-y-5"><Skeleton className="h-24 w-full" /><Skeleton className="h-96" /></div>;
  if (query.isError || !query.data) return <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />;

  const { roadmap, modules, validation, publishedCounts, notice } = query.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <Link to="/admin/roadmaps" className="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="size-3.5" /> Roadmaps</Link>
        <span aria-hidden>/</span>
        <Link to={`/admin/roadmaps/${roadmap.id}/curriculum`} className="hover:text-ink">{roadmap.title}</Link>
        <span aria-hidden>/</span>
        <span className="text-ink/70">Preview</span>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="bg-brand-soft text-brand-deep ring-brand/20">Admin preview</Badge>
          <Badge tone={roadmap.published ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-canvas text-muted ring-line'}>{roadmap.published ? 'Published' : 'Draft'}</Badge>
          <Badge tone="bg-canvas text-ink/70 ring-line">{publishedCounts.modules} of {modules.length} modules published</Badge>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{roadmap.title}</h1>
        <p className="mt-1 text-sm text-muted">{roadmap.tagline || roadmap.description}</p>
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">{notice}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline"><Link to={`/admin/roadmaps/${roadmap.id}/curriculum`}><Pencil /> Back to editor</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to={`/roadmaps/${roadmap.slug}`}><Eye /> Learner view</Link></Button>
          <label className="ml-auto flex items-center gap-2 text-[11px] text-muted">
            <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="size-3.5 rounded border-line accent-[rgb(var(--brand))]" />
            Include archived
          </label>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          {modules.filter((module) => showArchived || (!module.archivedAt && module.published)).map((module) => (
            <Card key={module.id} className={cn('p-5', (!module.published || module.archivedAt) && 'border-dashed opacity-80')}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="bg-canvas text-ink/70 ring-line">Module {module.order}</Badge>
                {!module.published ? <Badge tone="bg-canvas text-muted ring-line">Draft</Badge> : null}
                {module.archivedAt ? <Badge tone="bg-rose-50 text-rose-700 ring-rose-200">Archived</Badge> : null}
              </div>
              <h2 className="mt-1.5 text-base font-semibold text-ink">{module.title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted">{module.description}</p>
              <div className="mt-3 space-y-2">
                {module.topics.filter((topic) => showArchived || (!topic.archivedAt && topic.published)).map((topic) => (
                  <div key={topic.id} className="rounded-xl border border-line/70 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-xs font-semibold text-ink">{topic.title}</p>
                      <span className="text-[10px] text-muted">{formatMinutes(topic.estimatedDuration)}</span>
                      {!topic.published ? <Badge tone="bg-canvas text-muted ring-line">Draft</Badge> : null}
                      {topic.archivedAt ? <Badge tone="bg-rose-50 text-rose-700 ring-rose-200">Archived</Badge> : null}
                    </div>
                    <div className="mt-2 space-y-1">
                      {topic.tasks.filter((task) => showArchived || (!task.archivedAt && task.published)).map((task) => (
                        <div key={task.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-canvas/50 px-2 py-1.5">
                          <TaskTypeBadge type={task.type as never} />
                          <span className="min-w-0 flex-1 truncate text-[11px] text-ink/80">{task.title}</span>
                          <span className="text-[10px] text-muted">{formatMinutes(task.estimatedDuration)}</span>
                          {!task.published ? <Badge tone="bg-canvas text-muted ring-line">Draft</Badge> : null}
                          {task.archivedAt ? <Badge tone="bg-rose-50 text-rose-700 ring-rose-200">Archived</Badge> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><ShieldCheck className="size-4 text-brand" /> Validation</h2>
            <div className="mt-2 space-y-1.5 text-xs text-muted">
              <p className="flex justify-between"><span>Errors</span><span className="font-semibold text-rose-700">{validation.errors}</span></p>
              <p className="flex justify-between"><span>Warnings</span><span className="font-semibold text-amber-700">{validation.warnings}</span></p>
              <p className="flex justify-between"><span>Published tasks</span><span className="font-semibold text-ink">{publishedCounts.tasks}</span></p>
            </div>
            {validation.issues.length > 0 ? (
              <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
                {validation.issues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`} className="rounded-lg bg-canvas/70 p-2 text-[10px] leading-relaxed text-muted">
                    <span className={cn('font-semibold uppercase', issue.severity === 'error' ? 'text-rose-700' : issue.severity === 'warning' ? 'text-amber-700' : 'text-sky-700')}>{issue.severity}</span> · {issue.message}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-[10px] text-emerald-800">No issues detected in this curriculum.</p>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
