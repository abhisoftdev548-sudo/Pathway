import { Link } from 'react-router-dom';
import endpoints, { type QuizAdminDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Badge, Td, STATUS_LABELS, statusTone } from '@/components/ui/Data';
import { AdminTablePage } from '@/features/admin/AdminShared';
import { formatDate, formatNumber } from '@/utils/format';

/** All quizzes (every status) with moderation access. */
export function AdminQuizzesPage() {
  useDocumentTitle('All quizzes');

  return (
    <AdminTablePage<QuizAdminDto>
      title="All quizzes"
      description="Every quiz on the platform regardless of status."
      queryKey={['admin', 'quizzes']}
      fetcher={(params) => endpoints.quizzes.moderation({ ...params, status: (params.status as string) ?? 'ALL' })}
      searchPlaceholder="Search quizzes…"
      statusOptions={[
        { value: 'DRAFT', label: 'Draft' },
        { value: 'PENDING_REVIEW', label: 'Pending review' },
        { value: 'APPROVED', label: 'Published' },
        { value: 'CHANGES_REQUESTED', label: 'Changes requested' },
        { value: 'REJECTED', label: 'Rejected' },
        { value: 'UNPUBLISHED', label: 'Unpublished' },
        { value: 'ARCHIVED', label: 'Archived' },
      ]}
      head={['Title', 'Creator', 'Status', 'Attempts', 'Updated', '']}
      renderRow={(quiz) => (
        <tr key={quiz._id} className="hover:bg-zinc-50/70">
          <Td className="font-medium text-zinc-900">{quiz.title}</Td>
          <Td className="text-zinc-500">{quiz.creator?.name ?? '—'}</Td>
          <Td>
            <Badge tone={statusTone(quiz.status)}>{quiz.status ? STATUS_LABELS[quiz.status] : ''}</Badge>
          </Td>
          <Td>{formatNumber(quiz.stats?.attemptsCount ?? 0)}</Td>
          <Td className="text-zinc-500">{formatDate(quiz.updatedAt)}</Td>
          <Td>
            <Link to="/admin/quiz-approvals" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Review
            </Link>
          </Td>
        </tr>
      )}
      emptyTitle="No quizzes found"
      emptyDescription="Quizzes matching your filters will appear here."
    />
  );
}

export default AdminQuizzesPage;
