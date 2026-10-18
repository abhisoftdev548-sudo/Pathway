import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import endpoints from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import { Table, Td } from '@/components/ui/Data';
import { Card, CardBody, CardHeader, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Form';
import { formatDateTime } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

/** Platform settings: key/value operational configuration with audit trail. */
export function AdminSettingsPage() {
  useDocumentTitle('Platform settings');
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => endpoints.admin.settings(),
  });

  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');

  const [editValue, setEditValue] = useState('');
  const [editKey, setEditKey] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        parsed = value;
      }
      return endpoints.admin.updateSetting({ key, value: parsed, description });
    },
    onSuccess: () => {
      toast.success('Setting saved');
      setKey('');
      setValue('');
      setDescription('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not save setting')),
  });

  const updateExisting = useMutation({
    mutationFn: () => {
      const current = (data?.items ?? []).find((s) => s.key === editKey);
      let parsed: unknown;
      try {
        parsed = JSON.parse(editValue);
      } catch {
        parsed = editValue;
      }
      return endpoints.admin.updateSetting({
        key: editKey!,
        value: parsed,
        description: current?.description ?? '',
      });
    },
    onSuccess: () => {
      toast.success('Setting updated');
      setEditKey(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not update setting')),
  });

  useEffect(() => {
    if (editKey) {
      const current = (data?.items ?? []).find((s) => s.key === editKey);
      setEditValue(JSON.stringify(current?.value ?? '', null, 2));
    }
  }, [editKey, data]);

  return (
    <div>
      <PageHeader
        title="Platform settings"
        description="Operational key/value configuration. Every change is written to the audit log."
      />

      {isLoading ? (
        <SkeletonList count={1} />
      ) : isError ? (
        <ErrorState
          title="Could not load settings"
          description={apiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Current settings" subtitle={`${(data?.items ?? []).length} configured keys`} />
            {(data?.items ?? []).length === 0 ? (
              <CardBody>
                <p className="text-sm text-body">
                  No custom settings yet — platform defaults are in use. Reward and fee limits can be managed from
                  their dedicated pages.
                </p>
              </CardBody>
            ) : (
              <Table head={['Key', 'Value', 'Updated', '']}>
                {(data?.items ?? []).map((setting) => (
                  <tr key={setting.key} className="hover:bg-surface-muted/70">
                    <Td>
                      <p className="font-medium text-heading">{setting.key}</p>
                      {setting.description && <p className="text-xs text-muted">{setting.description}</p>}
                    </Td>
                    <Td>
                      {editKey === setting.key ? (
                        <Textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="min-h-[100px] font-mono text-xs"
                        />
                      ) : (
                        <span className="block max-w-[220px] truncate font-mono text-xs text-body">
                          {JSON.stringify(setting.value)}
                        </span>
                      )}
                    </Td>
                    <Td className="text-body">{formatDateTime(setting.updatedAt)}</Td>
                    <Td>
                      {editKey === setting.key ? (
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={() => updateExisting.mutate()} loading={updateExisting.isPending}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditKey(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setEditKey(setting.key)}>
                          Edit
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title="Add or replace a setting" />
            <CardBody className="space-y-4">
              <Input label="Key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. quiz_rules" />
              <Textarea
                label="Value (JSON or plain text)"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="min-h-[120px] font-mono text-xs"
                placeholder='{"maxQuestions": 100}'
              />
              <Input
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
              />
              <Button
                onClick={() => save.mutate()}
                loading={save.isPending}
                disabled={key.trim().length < 2}
                icon={<Save className="h-4 w-4" />}
              >
                Save setting
              </Button>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

export default AdminSettingsPage;
