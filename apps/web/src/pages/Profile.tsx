import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input, Label, Textarea } from '../components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function Profile() {
  const { user, setUser } = useAuth(); const { toast } = useToast();
  const [displayName, setDisplayName] = useState(''); const [bio, setBio] = useState(''); const [avatar, setAvatar] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) { setDisplayName(user.displayName); setBio(user.bio || ''); setAvatar(user.avatar || ''); } }, [user]);
  const save = async (e: any) => {
    e.preventDefault(); setBusy(true);
    try { const { data } = await api.patch('/api/me', { displayName, bio, avatar }); setUser(data.user); toast('Profile updated'); }
    catch (err) { toast(errMsg(err), 'error'); } finally { setBusy(false); }
  };
  return <div className="mx-auto max-w-2xl">
    <h1 className="text-2xl font-extrabold text-navy-950 sm:text-3xl">Your profile</h1>
    <p className="mt-1 text-sm text-slate-500">Your display name, avatar and bio appear on your public creator page. Your email is never shown publicly, and your role cannot be changed here.</p>
    <form onSubmit={save} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <div><Label>Display name</Label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} required minLength={2} /></div>
      <div><Label>Email (private)</Label><Input value={user?.email || ''} disabled /></div>
      <div><Label>Avatar URL (optional)</Label><Input value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="https://…" /></div>
      <div><Label>Bio</Label><Textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={500} placeholder="Tell learners what you create quizzes about…" /></div>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy}><Save className="h-4 w-4" />{busy ? 'Saving…' : 'Save profile'}</Button>
        {user && <Link className="text-sm font-bold text-brand-600" to={`/creators/${user.id}`}>View my public creator page →</Link>}
        {user?.role === 'admin' && <span className="rounded-full bg-navy-950 px-3 py-1 text-xs font-bold text-white">Administrator</span>}
      </div>
    </form>
  </div>;
}
