import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Tags, Trash2 } from 'lucide-react';
import endpoints, { type CategoryDto, type TagDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import { Badge, Table, Td } from '@/components/ui/Data';
import { Card, CardBody, CardHeader, EmptyState, ErrorState, PageHeader, SkeletonTable } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { ConfirmDialog } from '@/features/admin/AdminShared';
import { formatNumber } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

/** Category & tag management for content classification. */
export function AdminCategoriesPage() {
  useDocumentTitle('Categories & tags');
  const toast = useToast();
  const queryClient = useQueryClient();

  const [newCategory, setNewCategory] = useState('');
  const [newTag, setNewTag] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'category' | 'tag'; id: string; name: string } | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => endpoints.admin.categories(),
  });

  const createCategory = useMutation({
    mutationFn: () => endpoints.admin.createCategory({ name: newCategory }),
    onSuccess: () => {
      toast.success('Category created');
      setNewCategory('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not create category')),
  });

  const createTag = useMutation({
    mutationFn: () => endpoints.admin.createTag({ name: newTag }),
    onSuccess: () => {
      toast.success('Tag created');
      setNewTag('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not create tag')),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteTarget?.kind === 'category'
        ? endpoints.admin.deleteCategory(deleteTarget.id)
        : endpoints.admin.deleteTag(deleteTarget!.id),
    onSuccess: () => {
      toast.success('Deleted');
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not delete')),
  });

  return (
    <div>
      <PageHeader
        title="Categories & tags"
        description="Classification used by quizzes and polls across the platform."
      />

      {isError ? (
        <ErrorState
          title="Could not load categories"
          description={apiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Categories */}
          <Card>
            <CardHeader
              title="Categories"
              subtitle={`${data?.categories.length ?? 0} defined`}
              actions={
                <div className="flex items-center gap-2">
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="New category name"
                    className="w-40"
                  />
                  <Button
                    size="sm"
                    onClick={() => createCategory.mutate()}
                    disabled={newCategory.trim().length < 2}
                    loading={createCategory.isPending}
                    icon={<Plus className="h-4 w-4" />}
                  >
                    Add
                  </Button>
                </div>
              }
            />
            {isLoading ? (
              <SkeletonTable rows={4} cols={3} />
            ) : (data?.categories ?? []).length === 0 ? (
              <EmptyState title="No categories yet" description="Create the first category above." className="py-8" />
            ) : (
              <Table head={['Name', 'Active', '']}>
                {(data?.categories ?? []).map((category: CategoryDto) => (
                  <tr key={category._id} className="hover:bg-surface-muted/70">
                    <Td>
                      <p className="font-medium text-heading">{category.name}</p>
                      {category.description && <p className="text-xs text-muted">{category.description}</p>}
                    </Td>
                    <Td>
                      <Badge tone={category.isActive !== false ? 'success' : 'neutral'}>
                        {category.isActive !== false ? 'Active' : 'Disabled'}
                      </Badge>
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({ kind: 'category', id: category._id, name: category.name })
                        }
                        className="rounded p-1.5 text-muted hover:bg-surface-muted hover:text-danger"
                        aria-label={`Delete ${category.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader
              title="Tags"
              subtitle={`${data?.tags.length ?? 0} defined`}
              actions={
                <div className="flex items-center gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="New tag name"
                    className="w-40"
                  />
                  <Button
                    size="sm"
                    onClick={() => createTag.mutate()}
                    disabled={newTag.trim().length < 1}
                    loading={createTag.isPending}
                    icon={<Plus className="h-4 w-4" />}
                  >
                    Add
                  </Button>
                </div>
              }
            />
            {isLoading ? (
              <SkeletonTable rows={4} cols={3} />
            ) : (data?.tags ?? []).length === 0 ? (
              <EmptyState
                icon={<Tags className="h-6 w-6" />}
                title="No tags yet"
                description="Tags become useful as creators add them to content."
                className="py-8"
              />
            ) : (
              <Table head={['Name', 'Usage', '']}>
                {(data?.tags ?? []).map((tag: TagDto) => (
                  <tr key={tag._id} className="hover:bg-surface-muted/70">
                    <Td className="font-medium text-heading">{tag.name}</Td>
                    <Td>{formatNumber(tag.usageCount ?? 0)}</Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ kind: 'tag', id: tag._id, name: tag.name })}
                        className="rounded p-1.5 text-muted hover:bg-surface-muted hover:text-danger"
                        aria-label={`Delete ${tag.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        destructive
        title={`Delete ${deleteTarget?.kind ?? 'item'}?`}
        message={`"${deleteTarget?.name}" will be removed permanently. Content already using it keeps its label.`}
        confirmLabel="Delete"
      />
    </div>
  );
}

export default AdminCategoriesPage;
