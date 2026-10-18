import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import endpoints from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { apiErrorMessage } from '@/services/api';

/**
 * Reward configuration: platform-wide limits that cap what creators can promise.
 * Stored as a real PlatformSetting and applied server-side by validation rules.
 */
export function AdminRewardConfigPage() {
  useDocumentTitle('Reward configuration');
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => endpoints.admin.settings(),
  });

  const [maxRewardPerParticipant, setMaxRewardPerParticipant] = useState(5000);
  const [maxRewardPool, setMaxRewardPool] = useState(100000);
  const [maxRecipients, setMaxRecipients] = useState(100000);
  const [signupBonus, setSignupBonus] = useState(100);

  useEffect(() => {
    const limits = (data?.defaults?.economy_limits ?? {}) as Record<string, number>;
    const saved = (data?.items ?? []).find((s) => s.key === 'economy_limits')?.value as
      | Record<string, number>
      | undefined;
    const merged = { ...limits, ...(saved ?? {}) };
    setMaxRewardPerParticipant(merged.MAX_REWARD_PER_PARTICIPANT ?? 5000);
    setMaxRewardPool(merged.MAX_REWARD_POOL_PER_ACTIVITY ?? 100000);
    setSignupBonus(merged.SIGNUP_BONUS ?? 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      endpoints.admin.updateSetting({
        key: 'economy_limits',
        value: {
          // Preserve limits configured elsewhere (e.g. entry fees) — merge, never clobber.
          ...((data?.defaults?.economy_limits ?? {}) as object),
          ...(((data?.items ?? []).find((s) => s.key === 'economy_limits')?.value ?? {}) as object),
          MAX_REWARD_PER_PARTICIPANT: maxRewardPerParticipant,
          MAX_REWARD_POOL_PER_ACTIVITY: maxRewardPool,
          SIGNUP_BONUS: signupBonus,
        },
        description: 'Platform reward limits',
      }),
    onSuccess: () => {
      toast.success('Reward limits saved');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not save settings')),
  });

  return (
    <div>
      <PageHeader
        title="Reward configuration"
        description="Platform guardrails for QCoin rewards. Creator reward settings are validated against these limits."
      />

      {isLoading ? (
        <SkeletonList count={1} />
      ) : isError ? (
        <ErrorState
          title="Could not load configuration"
          description={apiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Reward limits" subtitle="Hard caps enforced when creators configure rewards." />
            <CardBody className="space-y-4">
              <Input
                label="Max reward per participant (QCoins)"
                type="number"
                min={0}
                max={5000}
                value={maxRewardPerParticipant}
                onChange={(e) => setMaxRewardPerParticipant(Number(e.target.value))}
              />
              <Input
                label="Max reward pool per quiz/poll (QCoins)"
                type="number"
                min={0}
                value={maxRewardPool}
                onChange={(e) => setMaxRewardPool(Number(e.target.value))}
                hint="Reward × expected recipients cannot exceed this."
              />
              <Input
                label="Signup bonus (QCoins)"
                type="number"
                min={0}
                value={signupBonus}
                onChange={(e) => setSignupBonus(Number(e.target.value))}
                hint="Granted once per new account (0 disables it)."
              />
              <Button onClick={() => save.mutate()} loading={save.isPending} icon={<Save className="h-4 w-4" />}>
                Save limits
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="How rewards work" subtitle="Documented rules applied by the server." />
            <CardBody>
              <ul className="space-y-3 text-sm text-body">
                <li className="rounded-lg border border-line px-4 py-3">
                  <strong className="text-heading">Quiz rewards</strong> are paid only after a server-verified pass
                  (or top-percent finish). Attempts pending manual review earn nothing until reviewed.
                </li>
                <li className="rounded-lg border border-line px-4 py-3">
                  <strong className="text-heading">Poll rewards</strong> are participation-based. An opinion poll has
                  no correct answer, so option choice never affects eligibility.
                </li>
                <li className="rounded-lg border border-line px-4 py-3">
                  <strong className="text-heading">Anti-farming</strong>: payouts are idempotent per attempt/vote, and
                  suspicious reward velocity is flagged in Suspicious Transactions for manual review.
                </li>
                <li className="rounded-lg border border-line px-4 py-3">
                  <strong className="text-heading">Cancellations</strong>: when content is rejected or unpublished
                  after fees were charged, entry fees are refunded automatically and rewards owed are reviewed.
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

export default AdminRewardConfigPage;
