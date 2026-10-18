import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, PenSquare, Plus, Send, Trash2 } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { fmtDate } from '../lib/utils';
import { StatusBadge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, EmptyState, Skeleton } from '../components/ui/misc';
import { Select } from '../components/ui/input';
import { useToast } from '../contexts/ToastContext';

export default function MyQuizzes() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); const [deleting, setDeleting] = useState<any>(null);
  const load = useCallback(async () => {
    try { const { data } = await api.get('/api/me/quizzes'); setItems(data.items); }
    catch (e) { toast(errMsg(e), 'error'); } finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  const shown = useMemo(() => filter === 'ALL' ? items : items.filter(q => q.status === filter), [items, filter]);

  const quickSubmit = async (quiz: any) => {
    try {
      const resubmit = ['CHANGES_REQUESTED', 'REJECTED'].includes(quiz.status);
      await api.post(`/api/me/quizzes/${quiz.id}/${resubmit ? 'resubmit' : 'submit'}`);
      toast('Submitted for moderation'); load();
    } catch (e: any) {
      const errs = e?.response?.data?.error?.details?.errors;
      toast(errs?.[0] ? `Not ready: ${errs[0]} Open the editor to see all issues.` : errMsg(e), 'error');
    }
  };
  const del = async () => {
    try { const { data } = await api.delete(`/api/me/quizzes/${deleting.id}`); toast(data.archived ? 'Quiz archived (attempt history preserved)' : 'Quiz deleted'); setDeleting(null); load(); }
    catch (e) { toast(errMsg(e), 'error'); }
  };

  return <div>
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="inline-flex items-center gap-2 text-2xl font-extrabold text-navy-950 sm:text-3xl"><PenSquare className="h-7 w-7 text-brand-600" />My quizzes</h1>
      <div className="ml-auto flex gap-2">
        <Select aria-label="Filter by status" className="w-52" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="ALL">All statuses</option><option value="DRAFT">Drafts</option><option value="PENDING_REVIEW">Pending review</option>
          <option value="APPROVED">Approved / live</option><option value="CHANGES_REQUESTED">Changes requested</option><option value="REJECTED">Rejected</option><option value="UNPUBLISHED">Unpublished</option>
        </Select>
        <Link to="/quizzes/new"><Button><Plus className="h-4 w-4" />New quiz</Button></Link>
      </div>
    </div>
    {loading ? <div className="mt-6 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}</div>
      : shown.length === 0 ? <div className="mt-6"><EmptyState icon={<PenSquare className="h-6 w-6" />} title={items.length ? 'No quizzes with that status' : 'You have not created a quiz yet'} description="Share what you know — build a quiz, get it reviewed, and publish it for the community."><Link to="/quizzes/new"><Button><Plus className="h-4 w-4" />Create your first quiz</Button></Link></EmptyState></div>
      : <div className="mt-6 space-y-3">{shown.map(quiz => (
        <article key={quiz.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-56 flex-1">
              <h2 className="text-lg font-bold text-navy-950">{quiz.title || '(untitled draft)'}</h2>
              <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{quiz.description}</p>
              <p className="mt-2 text-xs text-slate-400">v{quiz.versionNumber} · {quiz.questionCount} questions · {quiz.totalPoints} pts · {quiz.attemptsCount} attempts · updated {fmtDate(quiz.updatedAt)}</p>
            </div>
            <StatusBadge status={quiz.status} isLive={quiz.isLive} hasPending={quiz.hasPending} />
          </div>
          {['CHANGES_REQUESTED', 'REJECTED'].includes(quiz.status) && quiz.latestFeedback && <p className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-900"><strong>Admin feedback:</strong> {quiz.latestFeedback}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/quizzes/${quiz.id}/edit`}><Button size="sm"><PenSquare className="h-3.5 w-3.5" />{quiz.hasPending ? 'View submission' : 'Edit'}</Button></Link>
            {!quiz.hasPending && quiz.hasDraft && <Button size="sm" variant="soft" onClick={() => quickSubmit(quiz)}><Send className="h-3.5 w-3.5" />{['CHANGES_REQUESTED', 'REJECTED'].includes(quiz.status) ? 'Resubmit' : 'Submit for approval'}</Button>}
            {quiz.isLive && <Link to={`/quizzes/${quiz.slug}`}><Button size="sm" variant="outline"><Eye className="h-3.5 w-3.5" />View public page</Button></Link>}
            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setDeleting(quiz)}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
          </div>
        </article>))}</div>}
    <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete this quiz?">
      <p className="text-sm text-slate-600">“{deleting?.title}”{deleting?.attemptsCount > 0 ? ' has submitted attempts, so it will be archived and hidden instead of permanently deleted — learners keep their history.' : ' will be permanently deleted.'}</p>
      <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" onClick={del}>{deleting?.attemptsCount > 0 ? 'Archive quiz' : 'Delete quiz'}</Button></div>
    </Dialog>
  </div>;
}
