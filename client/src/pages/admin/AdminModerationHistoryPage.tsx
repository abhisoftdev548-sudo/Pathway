import endpoints, { type AdminReviewDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Badge, Td } from '@/components/ui/Data';
import { AdminTablePage } from '@/features/admin/AdminShared';
import { formatDate } from '@/utils/format';

/** Full moderation history — every decision stays queryable (never erased). */
export function AdminModerationHistoryPage() {
  useDocumentTitle('Moderation history');

  return (
    <AdminTablePage<AdminReviewDto>
      title="Moderation history"
      description="Every moderation decision with reviewer, notes, and quality rating."
      queryKey={['admin', 'moderation-history']}
      fetcher={(params) => endpoints.admin.moderationHistory(params)}
      statusOptions={[
        { value: 'QUIZ', label: 'Quizzes' },
        { value: 'POLL', label: 'Polls' },
      ]}
      head={['Action', 'Content', 'Reviewer', 'Quality', 'Notes', 'When']}
      renderRow={(review) => (
        <tr key={review._id} className="hover:bg-surface-muted/70">
          <Td>
            <Badge
              tone={
                review.action === 'APPROVE'
                  ? 'success'
                  : review.action === 'REJECT'
                    ? 'danger'
                    : review.action === 'QUALITY_RATE'
                      ? 'brand'
                      : 'warning'
              }
            >
              {review.action}
            </Badge>
          </Td>
          <Td className="text-body">
            {review.targetType} · {review.targetId.slice(-6)} (v{review.versionNumber ?? 1})
          </Td>
          <Td className="text-body">{review.reviewer?.name ?? '—'}</Td>
          <Td>{review.qualityRating ? `${review.qualityRating}/5` : '—'}</Td>
          <Td className="max-w-[240px] truncate text-body">{review.notes || '—'}</Td>
          <Td className="text-body">{formatDate(review.createdAt)}</Td>
        </tr>
      )}
      emptyTitle="No moderation actions yet"
      emptyDescription="Every approve/reject/change decision will be recorded here permanently."
    />
  );
}

export default AdminModerationHistoryPage;
