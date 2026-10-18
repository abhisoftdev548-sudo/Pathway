import { Link } from 'react-router-dom';
import endpoints, { type PollAdminDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Badge, Td, STATUS_LABELS, statusTone } from '@/components/ui/Data';
import { AdminTablePage } from '@/features/admin/AdminShared';
import { formatDate, formatNumber } from '@/utils/format';

/** All polls (every status) with moderation access. */
export function AdminPollsPage() {
  useDocumentTitle('All polls');

  return (
    <AdminTablePage<PollAdminDto>
      title="All polls"
      description="Every poll on the platform regardless of status."
      queryKey={['admin', 'polls']}
      fetcher={(params) => endpoints.polls.moderation({ ...params, status: (params.status as string) ?? 'ALL' })}
      searchPlaceholder="Search polls…"
      statusOptions={[
        { value: 'DRAFT', label: 'Draft' },
        { value: 'PENDING_REVIEW', label: 'Pending review' },
        { value: 'APPROVED', label: 'Published' },
        { value: 'CHANGES_REQUESTED', label: 'Changes requested' },
        { value: 'REJECTED', label: 'Rejected' },
        { value: 'UNPUBLISHED', label: 'Unpublished' },
        { value: 'ARCHIVED', label: 'Archived' },
      ]}
      head={['Title', 'Creator', 'Status', 'Voters', 'Ends', '']}
      renderRow={(poll) => (
        <tr key={poll._id} className="hover:bg-surface-muted/70">
          <Td className="font-medium text-heading">{poll.title}</Td>
          <Td className="text-body">{poll.creator?.name ?? '—'}</Td>
          <Td>
            <Badge tone={statusTone(poll.status)}>{poll.status ? STATUS_LABELS[poll.status] : ''}</Badge>
          </Td>
          <Td>{formatNumber(poll.stats?.uniqueVoters ?? 0)}</Td>
          <Td className="text-body">{formatDate(poll.endsAt)}</Td>
          <Td>
            <Link to="/admin/poll-approvals" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Review
            </Link>
          </Td>
        </tr>
      )}
      emptyTitle="No polls found"
      emptyDescription="Polls matching your filters will appear here."
    />
  );
}

export default AdminPollsPage;
