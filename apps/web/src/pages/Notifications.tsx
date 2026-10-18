import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { fmtDate } from '../lib/utils';
import { Button } from '../components/ui/button';
import { EmptyState, Skeleton } from '../components/ui/misc';
import { useToast } from '../contexts/ToastContext';

export default function Notifications() {
  const { toast } = useToast(); const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { try { const { data } = await api.get('/api/me/notifications'); setItems(data.items); } catch (e) { toast(errMsg(e), 'error'); } finally { setLoading(false); } }, [toast]);
  useEffect(() => { load(); }, [load]);
  const markAll = async () => { await api.patch('/api/me/notifications/read'); load(); toast('All notifications marked as read'); };
  return <div className="mx-auto max-w-3xl">
    <div className="flex items-center gap-3"><h1 className="inline-flex items-center gap-2 text-2xl font-extrabold text-navy-950 sm:text-3xl"><Bell className="h-7 w-7 text-brand-600" />Notifications</h1>
      {items.some(n => !n.read) && <Button className="ml-auto" variant="outline" size="sm" onClick={markAll}><CheckCheck className="h-4 w-4" />Mark all read</Button>}</div>
    {loading ? <div className="mt-6 space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20" />)}</div>
      : items.length === 0 ? <div className="mt-6"><EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications" description="When an administrator approves, rejects or requests changes on one of your quizzes, you will hear about it here." /></div>
      : <div className="mt-6 space-y-3">{items.map(n => (
        <div key={n.id} className={`rounded-2xl border p-5 ${n.read ? 'border-slate-200 bg-white' : 'border-brand-200 bg-brand-50/50'}`}>
          <p className="text-sm font-medium leading-relaxed text-navy-950">{n.message}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-slate-400"><span>{new Date(n.createdAt).toLocaleString()}</span><span>· {fmtDate(n.createdAt)}</span>
            {n.quizId && <Link className="font-bold text-brand-600" to={`/quizzes/${n.quizId}/edit`}>Open quiz →</Link>}{!n.read && <span className="ml-auto rounded-full bg-brand-600 px-2 py-0.5 font-bold text-white">New</span>}</div>
        </div>))}</div>}
  </div>;
}
