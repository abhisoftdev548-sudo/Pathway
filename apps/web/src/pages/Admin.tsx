import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, CheckCircle2, ClipboardList, Flag, FolderTree, History, LayoutDashboard, Plus, RotateCcw, ShieldCheck, Trash2, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, errMsg } from '../lib/api';
import { fmtDate } from '../lib/utils';
import { StatusBadge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input, Label, Select, Textarea } from '../components/ui/input';
import { Dialog, EmptyState, Skeleton } from '../components/ui/misc';
import { useToast } from '../contexts/ToastContext';

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'queue', label: 'Moderation queue', icon: ClipboardList },
  { key: 'quizzes', label: 'All quizzes', icon: ShieldCheck },
  { key: 'categories', label: 'Categories', icon: FolderTree },
  { key: 'reports', label: 'Reports', icon: Flag },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'logs', label: 'Audit log', icon: History },
] as const;

export default function Admin() {
  const { toast } = useToast();
  const [tab, setTab] = useState<string>('overview');
  const [dash, setDash] = useState<any>(null); const [queue, setQueue] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]); const [cats, setCats] = useState<any>({ categories: [], subcategories: [] });
  const [reports, setReports] = useState<any[]>([]); const [users, setUsers] = useState<any[]>([]); const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [catForm, setCatForm] = useState({ name: '', description: '', parentCategoryId: '' });
  const [unpublishing, setUnpublishing] = useState<any>(null); const [unpubReason, setUnpubReason] = useState('');

  const load = useCallback(async () => {
    try {
      const [d, q, all, c, r, u, l] = await Promise.all([
        api.get('/api/admin/dashboard'), api.get('/api/admin/submissions'), api.get('/api/admin/quizzes'),
        api.get('/api/categories'), api.get('/api/admin/reports'), api.get('/api/admin/users'), api.get('/api/admin/moderation-logs'),
      ]);
      setDash(d.data); setQueue(q.data.items); setQuizzes(all.data.items); setCats(c.data); setReports(r.data.items); setUsers(u.data.items); setLogs(l.data.items);
    } catch (e) { toast(errMsg(e), 'error'); } finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<any>, msg: string) => { try { await fn(); toast(msg); load(); } catch (e) { toast(errMsg(e), 'error'); } };

  if (loading) return <div className="space-y-4"><Skeleton className="h-20" /><div className="grid gap-4 sm:grid-cols-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}</div></div>;
  const c = dash.counts;

  return <div>
    <h1 className="inline-flex items-center gap-2 text-2xl font-extrabold text-navy-950 sm:text-3xl"><ShieldCheck className="h-7 w-7 text-brand-600" />Admin dashboard</h1>
    <p className="mt-1 text-sm text-slate-500">Moderation, categories, reports and the full audit trail. Every action is recorded with the acting administrator.</p>
    <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Admin sections">
      {TABS.map(t => <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold ${tab === t.key ? 'bg-navy-950 text-white' : 'border border-slate-200 bg-white text-navy-900 hover:bg-slate-50'}`}>
        <t.icon className="h-4 w-4" />{t.label}{t.key === 'queue' && c.pending > 0 && <span className="ml-1 rounded-full bg-amber-400 px-1.5 text-[11px] font-extrabold text-navy-950">{c.pending}</span>}{t.key === 'reports' && c.reportsOpen > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[11px] font-extrabold text-white">{c.reportsOpen}</span>}</button>)}
    </div>

    {tab === 'overview' && <div className="mt-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        {[['Pending review', c.pending], ['Published (live)', c.approved], ['Rejected', c.rejected], ['Changes requested', c.changesRequested], ['Drafts', c.drafts], ['Open reports', c.reportsOpen], ['Users', c.users], ['Total attempts', c.totalAttempts]].map(([label, v]) => (
          <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-4 text-center"><div className="text-2xl font-extrabold text-navy-950">{v as number}</div><div className="text-[11px] font-semibold text-slate-500">{label as string}</div></div>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_380px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Publishing statistics">
          <h2 className="font-bold">Quiz pipeline (live counts)</h2>
          <div className="mt-4 h-52"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={[{ name: 'Pending', n: c.pending }, { name: 'Live', n: c.approved }, { name: 'Changes', n: c.changesRequested }, { name: 'Rejected', n: c.rejected }, { name: 'Drafts', n: c.drafts }, { name: 'Unpublished', n: c.unpublished }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="n" name="Quizzes" fill="#4a47c4" radius={[6, 6, 0, 0]} /></BarChart>
          </ResponsiveContainer></div>
          <p className="text-xs text-slate-400">Derived from current moderation state; {c.moderationActions} moderation actions logged in total.</p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Recent submissions">
          <h2 className="font-bold">Waiting for review</h2>
          <div className="mt-3 space-y-2">{dash.recentSubmissions.length === 0 ? <p className="text-sm text-slate-500">The queue is clear. 🎉</p> : dash.recentSubmissions.map((s: any) => (
            <Link key={s.quizId} to={`/admin/submissions/${s.quizId}`} className="block rounded-xl bg-slate-50 px-3 py-2.5 text-sm hover:bg-brand-50">
              <span className="font-bold text-navy-950">{s.title}</span>{s.isRevision && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">REVISION v{s.versionNumber}</span>}
              <span className="block text-xs text-slate-400">by {s.creator?.displayName} · {s.category} · {s.questionCount} questions · {fmtDate(s.updatedAt)}</span></Link>))}
          </div>
        </section>
      </div>
    </div>}

    {tab === 'queue' && <div className="mt-6 space-y-3">
      {queue.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="Moderation queue is clear" description="New submissions appear here, oldest first, so no creator waits unfairly." />
        : queue.map((s: any, i: number) => <div key={s.quizId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-extrabold text-amber-800">{i + 1}</span>
          <div className="min-w-56 flex-1"><h2 className="font-bold text-navy-950">{s.title}</h2>
            <p className="text-xs text-slate-400">by {s.creator?.displayName} · {s.category} · {s.difficulty} · {s.language} · {s.questionCount} questions · submitted {fmtDate(s.updatedAt)}{s.isRevision ? ' · revision of a live quiz (old version stays public)' : ''}</p></div>
          <Link to={`/admin/submissions/${s.quizId}`}><Button>Review submission</Button></Link>
        </div>)}
    </div>}

    {tab === 'quizzes' && <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
        <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Quiz</th><th className="px-4 py-3">Creator</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3" /></tr></thead>
        <tbody>{quizzes.map(quiz => <tr key={quiz.id} className="border-b border-slate-50 last:border-0">
          <td className="px-4 py-3 font-bold">{quiz.title}<span className="block text-[11px] font-normal text-slate-400">{quiz.questionCount} questions · updated {fmtDate(quiz.updatedAt)}</span></td>
          <td className="px-4 py-3">{quiz.creator?.displayName}</td>
          <td className="px-4 py-3"><StatusBadge status={quiz.status} isLive={quiz.isLive} hasPending={quiz.hasPending} /></td>
          <td className="px-4 py-3">{quiz.attemptsCount}</td>
          <td className="px-4 py-3 text-right whitespace-nowrap">
            <Link to={`/admin/submissions/${quiz.id}`} className="mr-3 font-bold text-brand-600">Inspect</Link>
            {quiz.isLive ? <button className="font-bold text-red-600" onClick={() => { setUnpublishing(quiz); setUnpubReason(''); }}><Ban className="mr-1 inline h-4 w-4" />Unpublish</button>
              : quiz.status === 'UNPUBLISHED' && <button className="font-bold text-emerald-700" onClick={() => act(() => api.post(`/api/admin/quizzes/${quiz.id}/restore`), 'Quiz restored and public again')}><RotateCcw className="mr-1 inline h-4 w-4" />Restore</button>}
          </td></tr>)}
        </tbody></table></div>
    </div>}

    {tab === 'categories' && <div className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
      <form className="space-y-3 self-start rounded-2xl border border-slate-200 bg-white p-5" onSubmit={e => { e.preventDefault(); act(async () => { await api.post('/api/admin/categories', { name: catForm.name, description: catForm.description, parentCategoryId: catForm.parentCategoryId || null }); setCatForm({ name: '', description: '', parentCategoryId: '' }); }, 'Category created'); }}>
        <h2 className="font-bold">Add category / subcategory</h2>
        <div><Label>Name *</Label><Input required value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} placeholder="e.g. Machine Learning" /></div>
        <div><Label>Parent (leave empty for top-level)</Label><Select value={catForm.parentCategoryId} onChange={e => setCatForm({ ...catForm, parentCategoryId: e.target.value })}>
          <option value="">Top-level category</option>{cats.categories.map((ct: any) => <option key={ct.id} value={ct.id}>{ct.name}</option>)}</Select></div>
        <div><Label>Description</Label><Textarea value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} rows={2} /></div>
        <Button className="w-full"><Plus className="h-4 w-4" />Create category</Button>
        <p className="text-xs text-slate-400">New categories immediately become selectable in the quiz builder. Explorer filters only show categories that contain published quizzes.</p>
      </form>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold">Categories ({cats.categories.length}) · Subcategories ({cats.subcategories.length})</h2>
        <div className="mt-3 space-y-1.5 max-h-[560px] overflow-y-auto pr-1">{cats.categories.map((ct: any) => (
          <div key={ct.id}>
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="font-bold flex-1">{ct.name}</span>
              <span className="text-[11px] text-slate-400">{ct.slug}</span>
              <button aria-label={`Delete ${ct.name}`} className="text-red-500" onClick={() => act(() => api.delete(`/api/admin/categories/${ct.id}`), 'Category removed (or deactivated if in use)')}><Trash2 className="h-4 w-4" /></button></div>
            {cats.subcategories.filter((s: any) => s.parentCategoryId === ct.id).map((s: any) => (
              <div key={s.id} className="ml-5 flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600"><span className="flex-1">↳ {s.name}</span>
                <button aria-label={`Delete ${s.name}`} className="text-red-500" onClick={() => act(() => api.delete(`/api/admin/categories/${s.id}`), 'Subcategory removed')}><Trash2 className="h-4 w-4" /></button></div>))}
          </div>))}
        </div>
      </div>
    </div>}

    {tab === 'reports' && <div className="mt-6 space-y-3">
      {reports.length === 0 ? <EmptyState icon={<Flag className="h-6 w-6" />} title="No reports" description="Learner reports about inaccurate or inappropriate quizzes land here." />
        : reports.map(r => <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{r.quizTitle}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${r.status === 'open' ? 'bg-red-100 text-red-700' : r.status === 'reviewed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{r.status}</span>
            <span className="ml-auto text-xs text-slate-400">reported by {r.reporterName} · {fmtDate(r.createdAt)}</span></div>
          <p className="mt-2 text-sm"><strong>{r.reason}</strong>{r.details ? ` — ${r.details}` : ''}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to={`/admin/submissions/${r.quizId}`}><Button size="sm" variant="outline">Inspect quiz</Button></Link>
            {r.quizSlug && <Link to={`/quizzes/${r.quizSlug}`}><Button size="sm" variant="ghost">Public page</Button></Link>}
            {r.status === 'open' && <>
              <Button size="sm" variant="soft" onClick={() => act(() => api.patch(`/api/admin/reports/${r.id}`, { status: 'reviewed' }), 'Marked reviewed')}>Mark reviewed</Button>
              <Button size="sm" variant="ghost" onClick={() => act(() => api.patch(`/api/admin/reports/${r.id}`, { status: 'dismissed' }), 'Report dismissed')}>Dismiss</Button>
              <Button size="sm" variant="destructive" onClick={() => { setUnpublishing({ id: r.quizId, title: r.quizTitle }); setUnpubReason('Reported content'); }}>Unpublish quiz</Button>
            </>}
          </div>
        </div>)}
    </div>}

    {tab === 'users' && <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
        <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Quizzes</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3" /></tr></thead>
        <tbody>{users.map(u => <tr key={u.id} className="border-b border-slate-50 last:border-0">
          <td className="px-4 py-3 font-bold">{u.displayName}<span className="block text-[11px] font-normal text-slate-400">{u.email} (visible to admins only)</span></td>
          <td className="px-4 py-3 capitalize">{u.role}</td><td className="px-4 py-3">{u.quizCount}</td><td className="px-4 py-3">{fmtDate(u.createdAt)}</td>
          <td className="px-4 py-3 text-right">{u.role !== 'admin' && (u.isSuspended
            ? <button className="font-bold text-emerald-700" onClick={() => act(() => api.patch(`/api/admin/users/${u.id}`, { isSuspended: false }), 'User restored')}>Restore access</button>
            : <button className="font-bold text-red-600" onClick={() => act(() => api.patch(`/api/admin/users/${u.id}`, { isSuspended: true }), 'User suspended — they can no longer log in or submit')}>Suspend</button>)}
            {u.isSuspended && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">SUSPENDED</span>}
          </td></tr>)}</tbody>
      </table></div>
    </div>}

    {tab === 'logs' && <div className="mt-6 space-y-2">
      {logs.length === 0 ? <EmptyState title="No moderation actions yet" description="Submissions, approvals, rejections, change requests, unpublishes and restores are recorded here." />
        : logs.map(l => <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <span className="rounded-full bg-navy-950 px-2.5 py-0.5 text-[11px] font-bold uppercase text-white">{l.action.replace('_', ' ')}</span>
          <span className="font-bold">{l.quizTitle}</span>
          <span className="text-slate-500">{l.previousStatus} → {l.newStatus}</span>
          <span className="ml-auto text-xs text-slate-400">by {l.adminName} · {new Date(l.createdAt).toLocaleString()}</span>
          {l.feedback && <span className="w-full text-sm text-slate-600">“{l.feedback}”</span>}
        </div>)}
    </div>}

    <Dialog open={!!unpublishing} onClose={() => setUnpublishing(null)} title="Unpublish this quiz?">
      <p className="text-sm text-slate-600">“{unpublishing?.title}” disappears from discovery immediately and no new attempts can start. Existing attempt records are preserved, and you can restore it later.</p>
      <div className="mt-3"><Label>Reason (sent to the creator)</Label><Textarea value={unpubReason} onChange={e => setUnpubReason(e.target.value)} placeholder="Why is this being unpublished?" /></div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setUnpublishing(null)}>Cancel</Button>
        <Button variant="destructive" onClick={() => { act(() => api.post(`/api/admin/quizzes/${unpublishing.id}/unpublish`, { feedback: unpubReason }), 'Quiz unpublished'); setUnpublishing(null); }}>Unpublish now</Button></div>
    </Dialog>
  </div>;
}
