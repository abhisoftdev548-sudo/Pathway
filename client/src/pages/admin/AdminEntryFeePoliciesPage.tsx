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

/** Entry-fee policies: platform caps and documented refund behavior. */
export function AdminEntryFeePoliciesPage() {
  useDocumentTitle('Entry fee policies');
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => endpoints.admin.settings(),
  });

  const [maxEntryFee, setMaxEntryFee] = useState(1000);

  useEffect(() => {
    const limits = (data?.defaults?.economy_limits ?? {}) as Record<string, number>;
    const saved = (data?.items ?? []).find((s) => s.key === 'economy_limits')?.value as
      | Record<string, number>
      | undefined;
    setMaxEntryFee((saved ?? limits).MAX_ENTRY_FEE ?? 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      endpoints.admin.updateSetting({
        key: 'economy_limits',
        value: {
          ...((data?.items ?? []).find((s) => s.key === 'economy_limits')?.value as object),
          ...((data?.defaults?.economy_limits ?? {}) as object),
          MAX_ENTRY_FEE: maxEntryFee,
        },
        description: 'Platform entry fee limits',
      }),
    onSuccess: () => {
      toast.success('Entry fee policy saved');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not save policy')),
  });

  return (
    <div>
      <PageHeader
        title="Entry fee policies"
        description="Limits and refund rules for optional QCoin entry fees."
      />

      {isLoading ? (
        <SkeletonList count={1} />
      ) : isError ? (
        <ErrorState
          title="Could not load policy"
          description={apiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Fee limits" />
            <CardBody className="space-y-4">
              <Input
                label="Maximum entry fee (QCoins)"
                type="number"
                min={0}
                max={10000}
                value={maxEntryFee}
                onChange={(e) => setMaxEntryFee(Number(e.target.value))}
                hint="Creators cannot configure an entry fee above this value."
              />
              <Button onClick={() => save.mutate()} loading={save.isPending} icon={<Save className="h-4 w-4" />}>
                Save policy
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Refund rules (enforced by the server)" />
            <CardBody>
              <ul className="space-y-3 text-sm text-zinc-600">
                <li className="rounded-lg border border-zinc-100 px-4 py-3">
                  <strong className="text-zinc-900">Abandoned attempts</strong> — a charged fee is refunded when an
                  attempt is abandoned before submission.
                </li>
                <li className="rounded-lg border border-zinc-100 px-4 py-3">
                  <strong className="text-zinc-900">Platform cancellations</strong> — rejecting or unpublishing content
                  after fees were charged triggers automatic refunds.
                </li>
                <li className="rounded-lg border border-zinc-100 px-4 py-3">
                  <strong className="text-zinc-900">Completed participation</strong> — fees for completed attempts and
                  votes are not refundable without an admin decision.
                </li>
                <li className="rounded-lg border border-zinc-100 px-4 py-3">
                  <strong className="text-zinc-900">Suspicious activity</strong> — flagged accounts cannot receive
                  automatic refunds; each case is reviewed manually.
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

export default AdminEntryFeePoliciesPage;
