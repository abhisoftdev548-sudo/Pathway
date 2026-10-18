import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, ShieldCheck, Trophy } from 'lucide-react';
import endpoints from '@/services/endpoints';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { Avatar, Badge, RatingStars, StatCard } from '@/components/ui/Data';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Form';
import { formatDate, formatNumber } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

/** Own profile: edit identity fields + summary of real platform standing. */
export function ProfilePage() {
  useDocumentTitle('My profile');
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saving, setSaving] = useState(false);

  const { data: reputation } = useQuery({
    queryKey: ['reputation', user?._id],
    queryFn: () => endpoints.ratings.reputation(user!._id),
    enabled: Boolean(user?._id),
  });

  const saveMutation = useMutation({
    mutationFn: () => endpoints.users.updateMe({ name, bio }),
    onSuccess: async () => {
      await refreshUser();
      void queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      toast.success('Profile updated');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not update profile')),
    onSettled: () => setSaving(false),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    saveMutation.mutate();
  };

  return (
    <div>
      <PageHeader title="My profile" description="How you appear to the rest of the community." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Profile details" />
            <CardBody>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar name={user?.name ?? 'User'} src={user?.avatar?.url} size="lg" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900">Profile photo</p>
                    <p className="text-xs text-zinc-500">
                      Optional. Image storage requires a Cloudinary-enabled deployment.
                    </p>
                  </div>
                </div>
                <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
                <Textarea
                  label="Bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell the community a little about yourself…"
                  maxLength={500}
                />
                <div className="flex items-center gap-3">
                  <Button type="submit" loading={saving}>
                    Save changes
                  </Button>
                  <Link to="/settings">
                    <Button variant="ghost" type="button">
                      Account settings
                    </Button>
                  </Link>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Reputation" subtitle="Community feedback on your published content." />
            <CardBody>
              {reputation && reputation.community.count + reputation.adminQuality.count + reputation.publishedCount > 0 ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-zinc-500">Community rating</p>
                    <div className="mt-1 flex items-center gap-2">
                      <RatingStars value={reputation.community.score} count={reputation.community.count} size="md" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Admin quality rating</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-900">
                      {reputation.adminQuality.score !== null
                        ? reputation.adminQuality.score.toFixed(1)
                        : 'Not rated yet'}
                    </p>
                    {reputation.adminQuality.count > 0 && (
                      <p className="text-xs text-zinc-400">{reputation.adminQuality.count} moderation reviews</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Published content</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-900">{formatNumber(reputation.publishedCount)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  Reputation data appears after your first published content receives feedback.
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody>
              <div className="flex items-center gap-4">
                <Avatar name={user?.name ?? 'User'} src={user?.avatar?.url} size="lg" />
                <div>
                  <p className="text-base font-semibold text-zinc-900">{user?.name}</p>
                  <p className="text-sm text-zinc-500">{user?.email}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    {user?.role === 'ADMIN' && (
                      <Badge tone="brand">
                        <ShieldCheck className="h-3 w-3" /> Admin
                      </Badge>
                    )}
                    <Badge>{user?.status}</Badge>
                  </div>
                </div>
              </div>
              <dl className="mt-5 space-y-2 border-t border-zinc-100 pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Joined</dt>
                  <dd className="font-medium text-zinc-900">{formatDate(user?.createdAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">QCoin balance</dt>
                  <dd className="font-medium text-zinc-900">{formatNumber(user?.wallet?.balance ?? 0)}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <div className="grid gap-4">
            <StatCard
              label="Total earned"
              value={formatNumber(user?.wallet?.totalEarned ?? 0)}
              icon={<Coins className="h-5 w-5" />}
              tone="success"
            />
            <StatCard
              label="Leaderboard standing"
              value={
                <Link to="/leaderboards" className="text-brand-600 hover:text-brand-700">
                  View boards
                </Link>
              }
              icon={<Trophy className="h-5 w-5" />}
              tone="brand"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
