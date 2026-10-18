import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Compass, FilterX, Search, SlidersHorizontal } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import type { QuizCard as QC } from '../lib/types';
import { QUESTION_TYPE_LABELS } from '../lib/utils';
import QuizCard from '../components/QuizCard';
import { Button } from '../components/ui/button';
import { Input, Label, Select } from '../components/ui/input';
import { EmptyState, Skeleton } from '../components/ui/misc';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const LIMIT = 9;
export default function Explore() {
  const { user } = useAuth(); const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<QC[]>([]);
  const [total, setTotal] = useState(0); const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<any>(null);
  const [showMobile, setShowMobile] = useState(false);

  const f = useMemo(() => ({
    q: params.get('q') || '', categoryId: params.get('categoryId') || '', subcategoryId: params.get('subcategoryId') || '',
    difficulty: params.get('difficulty') || '', language: params.get('language') || '', questionType: params.get('questionType') || '',
    tags: params.get('tags') || '', maxDuration: params.get('maxDuration') || '', minQuestions: params.get('minQuestions') || '',
    sort: params.get('sort') || 'newest', page: Number(params.get('page') || 1),
  }), [params]);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => v ? next.set(k, v) : next.delete(k));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => { api.get('/api/quizzes/filters').then(r => setFilters(r.data)).catch(() => {}); }, []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query: any = { ...f, limit: LIMIT };
      Object.keys(query).forEach(k => { if (query[k] === '' || query[k] == null) delete query[k]; });
      const { data } = await api.get('/api/quizzes', { params: query });
      setItems(data.items); setTotal(data.pagination.total); setPages(data.pagination.pages);
    } catch (e) { toast(errMsg(e), 'error'); }
    finally { setLoading(false); }
  }, [f, toast]);
  useEffect(() => { load(); }, [load]);

  const subcats = (filters?.subcategories || []).filter((s: any) => !f.categoryId || s.parentCategoryId === f.categoryId);
  const activeChips: { label: string; clear: () => void }[] = [];
  if (f.q) activeChips.push({ label: `"${f.q}"`, clear: () => set({ q: '' }) });
  if (f.categoryId) activeChips.push({ label: filters?.categories?.find((c: any) => c.id === f.categoryId)?.name || 'Category', clear: () => set({ categoryId: '', subcategoryId: '' }) });
  if (f.subcategoryId) activeChips.push({ label: filters?.subcategories?.find((c: any) => c.id === f.subcategoryId)?.name || 'Subcategory', clear: () => set({ subcategoryId: '' }) });
  if (f.difficulty) activeChips.push({ label: f.difficulty, clear: () => set({ difficulty: '' }) });
  if (f.language) activeChips.push({ label: f.language, clear: () => set({ language: '' }) });
  if (f.questionType) activeChips.push({ label: QUESTION_TYPE_LABELS[f.questionType] || f.questionType, clear: () => set({ questionType: '' }) });
  if (f.tags) activeChips.push({ label: `Tags: ${f.tags}`, clear: () => set({ tags: '' }) });
  if (f.maxDuration) activeChips.push({ label: `≤ ${f.maxDuration} min`, clear: () => set({ maxDuration: '' }) });
  if (f.minQuestions) activeChips.push({ label: `≥ ${f.minQuestions} questions`, clear: () => set({ minQuestions: '' }) });

  const toggleBookmark = async (qz: QC) => {
    if (!user) return toast('Log in to bookmark quizzes', 'info');
    try {
      if (qz.isBookmarked) await api.delete(`/api/quizzes/${qz.id}/bookmark`); else await api.post(`/api/quizzes/${qz.id}/bookmark`);
      setItems(xs => xs.map(x => x.id === qz.id ? { ...x, isBookmarked: !x.isBookmarked } : x));
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  const filterPanel = <div className="space-y-4">
    <div><Label htmlFor="fs-search">Search</Label>
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input id="fs-search" className="pl-9" placeholder="Title, description, tags…" defaultValue={f.q} key={f.q} onKeyDown={e => { if (e.key === 'Enter') set({ q: (e.target as HTMLInputElement).value }); }} onBlur={e => set({ q: e.target.value })} /></div>
      <p className="mt-1 text-[11px] text-slate-400">Press Enter to search.</p></div>
    <div><Label htmlFor="fs-cat">Category</Label><Select id="fs-cat" value={f.categoryId} onChange={e => set({ categoryId: e.target.value, subcategoryId: '' })}>
      <option value="">All categories</option>{(filters?.categories || []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.quizCount})</option>)}</Select></div>
    <div><Label htmlFor="fs-sub">Subcategory</Label><Select id="fs-sub" value={f.subcategoryId} onChange={e => set({ subcategoryId: e.target.value })} disabled={!subcats.length}>
      <option value="">All subcategories</option>{subcats.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.quizCount})</option>)}</Select></div>
    <div><Label htmlFor="fs-diff">Difficulty</Label><Select id="fs-diff" value={f.difficulty} onChange={e => set({ difficulty: e.target.value })}>
      <option value="">Any difficulty</option>{(filters?.difficulties || ['Beginner', 'Intermediate', 'Advanced']).map((d: string) => <option key={d}>{d}</option>)}</Select></div>
    <div><Label htmlFor="fs-lang">Language</Label><Select id="fs-lang" value={f.language} onChange={e => set({ language: e.target.value })}>
      <option value="">Any language</option>{(filters?.languages || []).map((d: string) => <option key={d}>{d}</option>)}</Select></div>
    <div><Label htmlFor="fs-type">Contains question type</Label><Select id="fs-type" value={f.questionType} onChange={e => set({ questionType: e.target.value })}>
      <option value="">Any type</option>{(filters?.questionTypes || []).map((t: string) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t] || t}</option>)}</Select></div>
    <div><Label htmlFor="fs-tags">Topic tags (comma-separated)</Label>
      <Input id="fs-tags" placeholder="e.g. closures, async" defaultValue={f.tags} key={f.tags} onKeyDown={e => { if (e.key === 'Enter') set({ tags: (e.target as HTMLInputElement).value }); }} onBlur={e => set({ tags: e.target.value })} />
      {(filters?.tags?.length || 0) > 0 && <div className="mt-2 flex flex-wrap gap-1">{filters.tags.slice(0, 12).map((t: string) => <button key={t} onClick={() => set({ tags: t })} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700">{t}</button>)}</div>}</div>
    <div className="grid grid-cols-2 gap-3">
      <div><Label htmlFor="fs-dur">Max duration</Label><Select id="fs-dur" value={f.maxDuration} onChange={e => set({ maxDuration: e.target.value })}>
        <option value="">Any</option><option value="10">≤ 10 min</option><option value="15">≤ 15 min</option><option value="30">≤ 30 min</option></Select></div>
      <div><Label htmlFor="fs-minq">Min questions</Label><Select id="fs-minq" value={f.minQuestions} onChange={e => set({ minQuestions: e.target.value })}>
        <option value="">Any</option><option value="5">5+</option><option value="10">10+</option></Select></div>
    </div>
    {activeChips.length > 0 && <Button type="button" variant="outline" className="w-full" onClick={() => setParams({})}><FilterX className="h-4 w-4" />Clear all filters</Button>}
  </div>;

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="inline-flex items-center gap-2 text-2xl font-extrabold text-navy-950 sm:text-3xl"><Compass className="h-7 w-7 text-brand-600" />Quiz explorer</h1>
      <p className="mt-1 text-sm text-slate-500">{total} published {total === 1 ? 'quiz' : 'quizzes'} — combine filters, e.g. intermediate JavaScript with multiple-choice questions in English.</p></div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" className="lg:hidden" onClick={() => setShowMobile(s => !s)}><SlidersHorizontal className="h-4 w-4" />Filters</Button>
        <Select aria-label="Sort quizzes" className="w-48" value={f.sort} onChange={e => set({ sort: e.target.value })}>
          <option value="newest">Newest</option><option value="most_attempted">Most attempted</option><option value="rating">Highest rated</option><option value="popular">Most popular</option>
        </Select>
      </div>
    </div>
    {activeChips.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
      <span className="text-xs font-bold text-slate-500">ACTIVE:</span>
      {activeChips.map(c => <button key={c.label} onClick={c.clear} className="inline-flex items-center gap-1 rounded-full bg-navy-950 px-3 py-1 text-xs font-semibold text-white hover:bg-navy-800">{c.label} ✕</button>)}
    </div>}
    {showMobile && <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 lg:hidden">{filterPanel}</div>}
    <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="hidden self-start rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-24 lg:block" aria-label="Filters">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-navy-950"><SlidersHorizontal className="h-4 w-4" />Filters</h2>{filterPanel}
      </aside>
      <section aria-label="Results">
        {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-72" />)}</div>
          : items.length === 0 ? <EmptyState icon={<Compass className="h-6 w-6" />} title="No quizzes match those filters" description="Try removing a filter or two. New community quizzes are published after moderation, so check back soon."><Button onClick={() => setParams({})}><FilterX className="h-4 w-4" />Clear all filters</Button></EmptyState>
          : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map(q => <QuizCard key={q.id} quiz={q} onToggleBookmark={toggleBookmark} />)}</div>}
        {pages > 1 && <div className="mt-6 flex items-center justify-center gap-2" aria-label="Pagination">
          <Button variant="outline" size="sm" disabled={f.page <= 1} onClick={() => set({ page: String(f.page - 1) })}>← Prev</Button>
          <span className="text-sm font-semibold text-slate-600">Page {f.page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={f.page >= pages} onClick={() => set({ page: String(f.page + 1) })}>Next →</Button>
        </div>}
      </section>
    </div>
  </div>;
}
