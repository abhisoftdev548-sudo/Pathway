import { useQuery } from '@tanstack/react-query';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import endpoints from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Card, CardBody, CardHeader, ErrorState, PageHeader, SkeletonList, EmptyState } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Data';
import { useState } from 'react';
import { formatNumber } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

/** Platform analytics — time-series charts from real database events. */
export function AdminAnalyticsPage() {
  useDocumentTitle('Platform analytics');
  const [series, setSeries] = useState<'activity' | 'economy'>('activity');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: () => endpoints.admin.analytics(),
    refetchInterval: 120000,
  });

  const activityData = (data?.timeseries.attempts ?? []).map((row, i) => ({
    date: row._id,
    attempts: row.count,
    votes: data?.timeseries.votes[i]?._id === row._id ? data.timeseries.votes[i].count : 0,
  }));

  const economyData = (data?.timeseries.transactions ?? []).map((row) => ({
    date: row._id,
    credits: row.credits,
    debits: row.debits,
  }));

  const usersData = (data?.timeseries.users ?? []).map((row) => ({ date: row._id, users: row.count }));

  const hasActivity = activityData.length > 0 && activityData.some((r) => r.attempts > 0 || r.votes > 0);
  const hasEconomy = economyData.length > 0 && economyData.some((r) => r.credits > 0 || r.debits > 0);
  const hasUsers = usersData.length > 0 && usersData.some((r) => r.users > 0);

  return (
    <div>
      <PageHeader
        title="Platform analytics"
        description="Last 30 days of genuine platform activity — charts appear only where real data exists."
      />

      <div className="mb-6">
        <Tabs
          items={[
            { key: 'activity', label: 'Activity' },
            { key: 'economy', label: 'QCoin economy' },
          ]}
          active={series}
          onChange={(key) => setSeries(key as 'activity' | 'economy')}
        />
      </div>

      {isLoading ? (
        <SkeletonList count={2} />
      ) : isError ? (
        <ErrorState
          title="Could not load analytics"
          description={apiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : (
        <div className="space-y-6">
          {series === 'activity' && (
            <>
              <Card>
                <CardHeader title="Attempts & votes" subtitle="Daily quiz attempts and poll votes." />
                <CardBody>
                  {hasActivity ? (
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={activityData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                          <defs>
                            <linearGradient id="attemptsFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Area type="monotone" dataKey="attempts" stroke="#6366f1" fill="url(#attemptsFill)" />
                          <Area type="monotone" dataKey="votes" stroke="#10b981" fill="transparent" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState
                      title="No activity in the last 30 days"
                      description="This chart will appear once quiz attempts and votes are recorded."
                      className="py-10"
                    />
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="New registrations" subtitle="Daily account sign-ups." />
                <CardBody>
                  {hasUsers ? (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={usersData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                          <Bar dataKey="users" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState
                      title="No new registrations"
                      description="Sign-ups in the last 30 days will be charted here."
                      className="py-10"
                    />
                  )}
                </CardBody>
              </Card>
            </>
          )}

          {series === 'economy' && (
            <Card>
              <CardHeader title="QCoin movement" subtitle="Daily credits and debits in the ledger." />
              <CardBody>
                {hasEconomy ? (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={economyData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} width={40} />
                        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="credits" fill="#10b981" radius={[6, 6, 0, 0]} name="Credits" />
                        <Bar dataKey="debits" fill="#f43f5e" radius={[6, 6, 0, 0]} name="Debits" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState
                    title="No QCoin movement"
                    description="Ledger activity in the last 30 days will be charted here."
                    className="py-10"
                  />
                )}
              </CardBody>
            </Card>
          )}

          {/* Status distribution — real counts */}
          {(data?.quizStatuses ?? []).length > 0 && (
            <Card>
              <CardHeader title="Content by status" />
              <CardBody>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Quizzes</p>
                    <ul className="space-y-1.5">
                      {(data?.quizStatuses ?? []).map((row) => (
                        <li key={row._id} className="flex justify-between text-sm">
                          <span className="text-zinc-600">{row._id.toLowerCase().replace('_', ' ')}</span>
                          <span className="font-medium text-zinc-900">{formatNumber(row.count)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Polls</p>
                    <ul className="space-y-1.5">
                      {(data?.pollStatuses ?? []).map((row) => (
                        <li key={row._id} className="flex justify-between text-sm">
                          <span className="text-zinc-600">{row._id.toLowerCase().replace('_', ' ')}</span>
                          <span className="font-medium text-zinc-900">{formatNumber(row.count)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminAnalyticsPage;
