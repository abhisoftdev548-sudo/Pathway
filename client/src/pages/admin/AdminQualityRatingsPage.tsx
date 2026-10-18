import { Link } from 'react-router-dom';
import endpoints, { type QualityRatingDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Badge, Td } from '@/components/ui/Data';
import { AdminTablePage } from '@/features/admin/AdminShared';
import { formatDate } from '@/utils/format';

/** Admin quality ratings — kept distinct from community ratings everywhere. */
export function AdminQualityRatingsPage() {
  useDocumentTitle('Admin quality ratings');

  return (
    <AdminTablePage<QualityRatingDto>
      title="Admin quality ratings"
      description="Quality scores assigned by moderators during review. These never mix into community ratings."
      queryKey={['admin', 'quality-ratings']}
      fetcher={(params) => endpoints.admin.qualityRatings(params)}
      head={['Content', 'Type', 'Creator', 'Quality rating', 'Rated']}
      renderRow={(row) => (
        <tr key={`${row.targetType}-${row._id}`} className="hover:bg-zinc-50/70">
          <Td>
            <Link to={`/quizzes/${row.slug}`} className="font-medium text-zinc-900 hover:text-brand-700">
              {row.title}
            </Link>
          </Td>
          <Td>
            <Badge tone="info">{row.targetType}</Badge>
          </Td>
          <Td className="text-zinc-500">{row.creator?.name ?? '—'}</Td>
          <Td>
            <Badge tone="brand">
              {row.moderation?.adminQualityRating ?? '—'} / 5
            </Badge>
          </Td>
          <Td className="text-zinc-500">{formatDate(row.moderation?.lastReviewedAt)}</Td>
        </tr>
      )}
      emptyTitle="No quality ratings yet"
      emptyDescription="Moderators can assign a 1–5 quality rating while approving content."
    />
  );
}

export default AdminQualityRatingsPage;
