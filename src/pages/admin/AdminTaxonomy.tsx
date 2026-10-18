import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Grid2x2, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Panel, Badge, Tabs } from '@/components/ui/Primitives';
import { Button, IconButton } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/States';
import { formatNumber } from '@/lib/format';

interface Tag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  usage_count: number;
}

interface Difficulty {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  usage_count: number;
}

export function AdminTaxonomy() {
  const [tab, setTab] = useState('tags');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tagForm, setTagForm] = useState({ name: '', slug: '' });
  const [levelForm, setLevelForm] = useState({ name: '', slug: '', sortOrder: '0' });
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'tag' | 'difficulty'; id: string; label: string } | null>(null);

  const tags = useQuery<{ items: Tag[] }>({ queryKey: qk.adminTags, queryFn: () => api.get('/admin/content/tags') });
  const difficulties = useQuery<{ items: Difficulty[] }>({
    queryKey: qk.adminDifficulties,
    queryFn: () => api.get('/admin/content/difficulties'),
  });

  const createTag = useMutation({
    mutationFn: () =>
      api.post('/admin/content/tags', { name: tagForm.name, slug: tagForm.slug || slugify(tagForm.name) }),
    onSuccess: () => {
      setTagForm({ name: '', slug: '' });
      queryClient.invalidateQueries({ queryKey: qk.adminTags });
      queryClient.invalidateQueries({ queryKey: qk.bootstrap });
      toast.success('Tag created.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not create the tag.'),
  });

  const createLevel = useMutation({
    mutationFn: () =>
      api.post('/admin/content/difficulties', {
        name: levelForm.name,
        slug: levelForm.slug || slugify(levelForm.name),
        sortOrder: Number(levelForm.sortOrder) || 0,
      }),
    onSuccess: () => {
      setLevelForm({ name: '', slug: '', sortOrder: '0' });
      queryClient.invalidateQueries({ queryKey: qk.adminDifficulties });
      queryClient.invalidateQueries({ queryKey: qk.bootstrap });
      toast.success('Difficulty level created.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not create the level.'),
  });

  const remove = useMutation({
    mutationFn: ({ kind, id }: { kind: 'tag' | 'difficulty'; id: string }) =>
      api.del(`/admin/content/${kind === 'tag' ? 'tags' : 'difficulties'}/${id}`),
    onSuccess: () => {
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: qk.adminTags });
      queryClient.invalidateQueries({ queryKey: qk.adminDifficulties });
      queryClient.invalidateQueries({ queryKey: qk.bootstrap });
      toast.success('Removed.');
    },
    onError: (err) => {
      setConfirmDelete(null);
      toast.error(err instanceof ApiError ? err.message : 'Could not remove it.');
    },
  });

  return (
    <>
      <PageHeading
        title="Tags and difficulty settings"
        description="Tags help players filter quizzes. Difficulty levels are optional labels set by creators."
      />

      <Tabs
        className="mb-4"
        tabs={[
          { id: 'tags', label: 'Tags', count: tags.data?.items.length ?? 0 },
          { id: 'difficulties', label: 'Difficulty levels', count: difficulties.data?.items.length ?? 0 },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'tags' ? (
        <>
          <Panel title="Add a tag">
            <div className="flex flex-wrap items-end gap-2">
              <TextInput
                wrapperClassName="w-56"
                label="Name"
                value={tagForm.name}
                onChange={(event) => setTagForm((f) => ({ ...f, name: event.target.value }))}
                placeholder="e.g. quick"
              />
              <TextInput
                wrapperClassName="w-56"
                label="Slug"
                value={tagForm.slug}
                onChange={(event) => setTagForm((f) => ({ ...f, slug: event.target.value }))}
                placeholder="auto-generated if blank"
              />
              <Button
                variant="primary"
                size="md"
                icon={<Plus className="h-3.5 w-3.5" />}
                loading={createTag.isPending}
                disabled={!tagForm.name.trim()}
                onClick={() => createTag.mutate()}
              >
                Add tag
              </Button>
            </div>
          </Panel>

          <Panel title="Existing tags" className="mt-4" bodyClassName="p-0">
            {tags.isLoading ? (
              <div className="p-4">
                <LoadingBlock rows={3} />
              </div>
            ) : tags.error ? (
              <div className="p-4">
                <ErrorState error={tags.error} onRetry={() => tags.refetch()} compact />
              </div>
            ) : !tags.data?.items.length ? (
              <div className="p-4">
                <EmptyState
                  compact
                  icon={<Grid2x2 className="h-4 w-4" />}
                  title="No tags yet"
                  description="Add tags so creators can label their quizzes and players can filter by them."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {tags.data.items.map((tag) => (
                  <li key={tag.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <span className="text-[13px] font-medium text-ink">{tag.name}</span>
                      <span className="ml-2 font-mono text-2xs text-ink-faint">{tag.slug}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone="neutral">{formatNumber(tag.usage_count)} quiz(s)</Badge>
                      <IconButton
                        label={`Delete tag ${tag.name}`}
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => setConfirmDelete({ kind: 'tag', id: tag.id, label: tag.name })}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      ) : (
        <>
          <Panel title="Add a difficulty level">
            <div className="flex flex-wrap items-end gap-2">
              <TextInput
                wrapperClassName="w-48"
                label="Name"
                value={levelForm.name}
                onChange={(event) => setLevelForm((f) => ({ ...f, name: event.target.value }))}
                placeholder="e.g. Intermediate"
              />
              <TextInput
                wrapperClassName="w-48"
                label="Slug"
                value={levelForm.slug}
                onChange={(event) => setLevelForm((f) => ({ ...f, slug: event.target.value }))}
                placeholder="auto-generated if blank"
              />
              <TextInput
                wrapperClassName="w-32"
                label="Sort order"
                type="number"
                min={0}
                value={levelForm.sortOrder}
                onChange={(event) => setLevelForm((f) => ({ ...f, sortOrder: event.target.value }))}
              />
              <Button
                variant="primary"
                size="md"
                icon={<Plus className="h-3.5 w-3.5" />}
                loading={createLevel.isPending}
                disabled={!levelForm.name.trim()}
                onClick={() => createLevel.mutate()}
              >
                Add level
              </Button>
            </div>
          </Panel>

          <Panel title="Difficulty levels" className="mt-4" bodyClassName="p-0">
            {difficulties.isLoading ? (
              <div className="p-4">
                <LoadingBlock rows={3} />
              </div>
            ) : difficulties.error ? (
              <div className="p-4">
                <ErrorState error={difficulties.error} onRetry={() => difficulties.refetch()} compact />
              </div>
            ) : !difficulties.data?.items.length ? (
              <div className="p-4">
                <EmptyState
                  compact
                  icon={<Grid2x2 className="h-4 w-4" />}
                  title="No difficulty levels yet"
                  description="Add levels such as Beginner, Intermediate and Advanced for creators to choose from."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {difficulties.data.items.map((level) => (
                  <li key={level.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <span className="text-[13px] font-medium text-ink">{level.name}</span>
                      <span className="ml-2 font-mono text-2xs text-ink-faint">{level.slug}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone="neutral">order {level.sort_order}</Badge>
                      <Badge tone="neutral">{formatNumber(level.usage_count)} quiz(s)</Badge>
                      <IconButton
                        label={`Delete level ${level.name}`}
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => setConfirmDelete({ kind: 'difficulty', id: level.id, label: level.name })}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Remove ${confirmDelete?.label}?`}
        description={
          confirmDelete?.kind === 'difficulty'
            ? 'Levels still used by quizzes cannot be removed. Reassign those quizzes first.'
            : 'The tag will be removed from any quizzes that use it.'
        }
        confirmLabel="Remove"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => confirmDelete && remove.mutate({ kind: confirmDelete.kind, id: confirmDelete.id })}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}
