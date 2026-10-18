import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send } from 'lucide-react';
import endpoints, { type TemplateDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { apiErrorMessage } from '@/services/api';

/** Notification management: broadcast announcements + reusable templates. */
export function AdminNotificationsPage() {
  useDocumentTitle('Notification management');
  const toast = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [audience, setAudience] = useState('');

  const [template, setTemplate] = useState<TemplateDto>({ key: '', title: '', body: '', link: '' });

  const templatesQuery = useQuery({
    queryKey: ['admin', 'templates'],
    queryFn: () => endpoints.admin.templates(),
  });

  const broadcast = useMutation({
    mutationFn: () =>
      endpoints.admin.broadcast({
        title,
        body: body || undefined,
        link: link || undefined,
        userRole: audience || undefined,
      }),
    onSuccess: (result) => {
      toast.success('Notification delivered', `${result.delivered} recipients`);
      setTitle('');
      setBody('');
      setLink('');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Broadcast failed')),
  });

  const saveTemplate = useMutation({
    mutationFn: () => endpoints.admin.saveTemplate(template),
    onSuccess: () => {
      toast.success('Template saved');
      setTemplate({ key: '', title: '', body: '', link: '' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'templates'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not save template')),
  });

  return (
    <div>
      <PageHeader
        title="Notification management"
        description="Send platform announcements and manage reusable notification templates."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Broadcast notification" subtitle="Delivered to real user accounts immediately." />
          <CardBody className="space-y-4">
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
            <Textarea label="Message" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} />
            <Input
              label="Link (optional)"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/help"
              maxLength={500}
            />
            <Select label="Audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="">All users</option>
              <option value="USER">Regular users only</option>
              <option value="ADMIN">Admins only</option>
            </Select>
            <Button
              onClick={() => broadcast.mutate()}
              loading={broadcast.isPending}
              disabled={title.trim().length < 3}
              icon={<Send className="h-4 w-4" />}
            >
              Send notification
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Templates" subtitle="Reusable message drafts for common announcements." />
          <CardBody className="space-y-4">
            {templatesQuery.isLoading ? (
              <SkeletonList count={1} />
            ) : templatesQuery.isError ? (
              <ErrorState
                title="Could not load templates"
                description={apiErrorMessage(templatesQuery.error)}
                action={<Button onClick={() => templatesQuery.refetch()}>Try again</Button>}
              />
            ) : (
              <>
                {(templatesQuery.data?.items ?? []).length > 0 && (
                  <div className="space-y-2">
                    {(templatesQuery.data?.items ?? []).map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTemplate(t)}
                        className="flex w-full items-center gap-3 rounded-lg border border-line px-4 py-2.5 text-left hover:border-brand-200 hover:bg-brand-50/40"
                      >
                        <Megaphone className="h-4 w-4 text-muted" />
                        <div>
                          <p className="text-sm font-medium text-heading">{t.title}</p>
                          <p className="text-xs text-muted">{t.key}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <Input
                  label="Template key"
                  value={template.key}
                  onChange={(e) => setTemplate({ ...template, key: e.target.value })}
                  placeholder="e.g. maintenance-window"
                />
                <Input
                  label="Template title"
                  value={template.title}
                  onChange={(e) => setTemplate({ ...template, title: e.target.value })}
                />
                <Textarea
                  label="Template message"
                  value={template.body ?? ''}
                  onChange={(e) => setTemplate({ ...template, body: e.target.value })}
                />
                <Button
                  variant="outline"
                  onClick={() => saveTemplate.mutate()}
                  loading={saveTemplate.isPending}
                  disabled={template.key.length < 2 || template.title.length < 3}
                >
                  Save template
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default AdminNotificationsPage;
