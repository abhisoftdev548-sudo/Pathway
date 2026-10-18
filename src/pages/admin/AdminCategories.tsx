import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Grid2x2, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Panel, Badge } from '@/components/ui/Primitives';
import { Button, IconButton } from '@/components/ui/Button';
import { TextInput, TextArea, Select } from '@/components/ui/Field';
import { Modal, ConfirmDialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/States';
import { formatDate, formatNumber } from '@/lib/format';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  parent_id: string | null;
  parent_name: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  quiz_count: number;
  poll_count: number;
}

export function AdminCategories() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', parentId: '', sortOrder: '0' });

  const query = useQuery<{ items: Category[] }>({
    queryKey: qk.adminCategories,
    queryFn: () => api.get('/admin/content/categories'),
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        slug: form.slug || slugify(form.name),
        description: form.description,
        parentId: form.parentId || null,
        sortOrder: Number(form.sortOrder) || 0,
      };
      return editing === 'new' ? api.post('/admin/content/categories', payload) : api.patch(`/admin/content/categories/${(editing as Category).id}`, payload);
    },
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: qk.adminCategories });
      queryClient.invalidateQueries({ queryKey: qk.bootstrap });
      toast.success('Category saved.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save the category.'),
  });

  const toggle = useMutation({
    mutationFn: (id: string) => api.post(`/admin/content/categories/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.adminCategories });
      queryClient.invalidateQueries({ queryKey: qk.bootstrap });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/admin/content/categories/${id}`),
    onSuccess: () => {
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: qk.adminCategories });
      toast.success('Category deleted.');
    },
    onError: (err) => {
      setConfirmDelete(null);
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the category.');
    },
  });

  const openEditor = (category: Category | 'new') => {
    setEditing(category);
    if (category === 'new') {
      setForm({ name: '', slug: '', description: '', parentId: '', sortOrder: '0' });
    } else {
      setForm({
        name: category.name,
        slug: category.slug,
        description: category.description,
        parentId: category.parent_id ?? '',
        sortOrder: String(category.sort_order),
      });
    }
  };

  const items = query.data?.items ?? [];
  const roots = items.filter((c) => !c.parent_id);
  const childrenOf = (parentId: string) => items.filter((c) => c.parent_id === parentId);

  return (
    <>
      <PageHeading
        title="Categories and subcategories"
        description="Organise quizzes and polls. Deactivating a category hides it from filters without deleting content."
        actions={
          <Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openEditor('new')}>
            New category
          </Button>
        }
      />

      {query.isLoading ? (
        <Panel>
          <LoadingBlock rows={4} />
        </Panel>
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Grid2x2 className="h-4 w-4" />}
          title="No categories configured"
          description="Create categories so players can filter quizzes and polls. Categories are optional for creators."
          action={
            <Button size="sm" variant="primary" onClick={() => openEditor('new')}>
              Create the first category
            </Button>
          }
        />
      ) : (
        <Panel bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {roots.map((category) => (
              <li key={category.id}>
                <CategoryRow
                  category={category}
                  depth={0}
                  onEdit={() => openEditor(category)}
                  onDelete={() => setConfirmDelete(category)}
                  onToggle={() => toggle.mutate(category.id)}
                />
                {childrenOf(category.id).map((child) => (
                  <CategoryRow
                    key={child.id}
                    category={child}
                    depth={1}
                    onEdit={() => openEditor(child)}
                    onDelete={() => setConfirmDelete(child)}
                    onToggle={() => toggle.mutate(child.id)}
                  />
                ))}
              </li>
            ))}
            {items.filter((c) => c.parent_id && !items.some((p) => p.id === c.parent_id)).map((orphan) => (
              <CategoryRow
                key={orphan.id}
                category={orphan}
                depth={0}
                onEdit={() => openEditor(orphan)}
                onDelete={() => setConfirmDelete(orphan)}
                onToggle={() => toggle.mutate(orphan.id)}
              />
            ))}
          </ul>
        </Panel>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New category' : 'Edit category'}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={save.isPending} disabled={!form.name.trim()} onClick={() => save.mutate()}>
              Save category
            </Button>
          </>
        }
      >
        <TextInput
          label="Name"
          required
          value={form.name}
          onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
        />
        <TextInput
          className="mt-3"
          label="Slug"
          value={form.slug}
          onChange={(event) => setForm((f) => ({ ...f, slug: event.target.value }))}
          hint="Used in URLs and filters. Lowercase letters, numbers and hyphens."
        />
        <TextArea
          className="mt-3"
          label="Description"
          rows={3}
          value={form.description}
          onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Select
            label="Parent category"
            value={form.parentId}
            onChange={(event) => setForm((f) => ({ ...f, parentId: event.target.value }))}
            options={[
              { value: '', label: 'None (top level)' },
              ...items
                .filter((c) => c.id !== (editing !== 'new' && editing ? editing.id : ''))
                .map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <TextInput
            label="Sort order"
            type="number"
            min={0}
            value={form.sortOrder}
            onChange={(event) => setForm((f) => ({ ...f, sortOrder: event.target.value }))}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete this category?"
        description="Categories that are in use cannot be deleted. Deactivate instead if content is attached."
        confirmLabel="Delete category"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => confirmDelete && remove.mutate(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}

function CategoryRow({
  category,
  depth,
  onEdit,
  onDelete,
  onToggle,
}: {
  category: Category;
  depth: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
      style={depth ? { paddingLeft: `${16 + depth * 24}px` } : undefined}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {depth > 0 && <span className="text-ink-faint">└</span>}
          <span className="text-[13px] font-medium text-ink">{category.name}</span>
          <span className="font-mono text-2xs text-ink-faint">{category.slug}</span>
          {!category.is_active && <Badge tone="neutral">Inactive</Badge>}
        </div>
        {category.description && <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{category.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-2xs text-ink-faint">
          {formatNumber(category.quiz_count)} quizzes · {formatNumber(category.poll_count)} polls
        </span>
        <Button size="sm" variant="ghost" onClick={onToggle}>
          {category.is_active ? 'Deactivate' : 'Activate'}
        </Button>
        <IconButton label="Edit category" icon={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit} />
        <IconButton label="Delete category" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={onDelete} />
      </div>
    </div>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export { formatDate };
