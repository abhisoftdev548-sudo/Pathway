import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Send, X } from 'lucide-react';
import endpoints, { type PollAdminDto } from '@/services/endpoints';
import { apiErrorMessage } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { Input, Select, Switch, Textarea } from '@/components/ui/Form';

let optionSeq = 0;
function newOptionId() {
  optionSeq += 1;
  return `o${optionSeq}_${Date.now().toString(36)}`;
}

/** Poll builder: title, question, options, timing, anonymity, and economy rules. */
export function PollBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  useDocumentTitle(id ? 'Edit poll' : 'New poll');

  const isEdit = Boolean(id);

  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [votingType, setVotingType] = useState<'SINGLE' | 'MULTIPLE'>('SINGLE');
  const [options, setOptions] = useState<{ id: string; text: string }[]>([
    { id: newOptionId(), text: '' },
    { id: newOptionId(), text: '' },
  ]);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [resultsVisibility, setResultsVisibility] = useState('AFTER_VOTE');
  const [entryFee, setEntryFee] = useState(0);
  const [reward, setReward] = useState(0);
  const [rewardMode, setRewardMode] = useState('ALL_PARTICIPANTS');
  const [maxRewardRecipients, setMaxRewardRecipients] = useState(0);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [changeNote, setChangeNote] = useState('');

  const detailQuery = useQuery({
    queryKey: ['poll-admin', id],
    queryFn: () => endpoints.polls.get(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    const poll = detailQuery.data?.poll as PollAdminDto | undefined;
    if (!poll) return;
    setTitle(poll.title ?? '');
    setQuestion(poll.question ?? '');
    setDescription(poll.description ?? '');
    setVotingType((poll.votingType as 'SINGLE' | 'MULTIPLE') ?? 'SINGLE');
    setOptions((poll.options ?? []).map((o: { id: string; text: string }) => ({ id: o.id, text: o.text })));
    setStartsAt(toLocalInput(poll.startsAt));
    setEndsAt(toLocalInput(poll.endsAt));
    setAnonymous(Boolean(poll.anonymous));
    setResultsVisibility(poll.resultsVisibility ?? 'AFTER_VOTE');
    setEntryFee(poll.entryFee ?? 0);
    setReward(poll.reward ?? 0);
    setRewardMode(poll.rewardMode ?? 'ALL_PARTICIPANTS');
    setMaxRewardRecipients(poll.maxRewardRecipients ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQuery.data?.poll]);

  const buildPayload = () => ({
    title,
    question,
    description,
    votingType,
    options: options.filter((o) => o.text.trim()).map((o) => ({ ...o, text: o.text.trim() })),
    startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
    endsAt: new Date(endsAt).toISOString(),
    anonymous,
    resultsVisibility,
    entryFee: Number(entryFee) || 0,
    reward: Number(reward) || 0,
    rewardMode,
    maxRewardRecipients: Number(maxRewardRecipients) || 0,
  });

  const validate = (): string | null => {
    if (title.trim().length < 3) return 'Give your poll a title of at least 3 characters.';
    if (question.trim().length < 3) return 'Write the poll question.';
    const filled = options.filter((o) => o.text.trim());
    if (filled.length < 2) return 'A poll needs at least two options.';
    if (!endsAt) return 'Set an end time for voting.';
    if (startsAt && new Date(endsAt) <= new Date(startsAt)) return 'End time must be after the start time.';
    if (!isEdit && new Date(endsAt) <= new Date()) return 'End time must be in the future.';
    return null;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) return endpoints.polls.update(id!, buildPayload());
      return endpoints.polls.create(buildPayload() as never);
    },
    onSuccess: (result) => {
      toast.success('Draft saved');
      void queryClient.invalidateQueries({ queryKey: ['polls', 'mine'] });
      if (!isEdit && result.poll?._id) {
        navigate(`/creator/polls/${result.poll._id}/edit`, { replace: true });
      }
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not save poll')),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        await endpoints.polls.update(id!, buildPayload());
        return endpoints.polls.submit(id!, changeNote || 'Submitted for review');
      }
      const created = await endpoints.polls.create(buildPayload() as never);
      return endpoints.polls.submit(created.poll._id, changeNote || 'Submitted for review');
    },
    onSuccess: () => {
      toast.success('Submitted for review');
      void queryClient.invalidateQueries({ queryKey: ['polls', 'mine'] });
      navigate('/creator/pending');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not submit poll')),
  });

  const onSaveDraft = () => {
    if (title.trim().length < 3) {
      toast.error('Give your poll a title first');
      return;
    }
    saveMutation.mutate();
  };

  const onSubmit = () => {
    const problem = validate();
    if (problem) {
      toast.error('Fix before submitting', problem);
      return;
    }
    setConfirmSubmit(true);
  };

  if (detailQuery.isLoading) return <SkeletonList count={2} />;
  if (detailQuery.isError && isEdit) {
    return (
      <ErrorState
        title="Could not load poll"
        description={apiErrorMessage(detailQuery.error)}
        action={<Button onClick={() => navigate('/my/polls')}>Back to my polls</Button>}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit poll' : 'Create a poll'}
        description="Ask the community something — voting rules and rewards are fully configurable."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onSaveDraft} loading={saveMutation.isPending} icon={<Save className="h-4 w-4" />}>
              Save draft
            </Button>
            <Button onClick={onSubmit} icon={<Send className="h-4 w-4" />}>
              Submit for review
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Poll content" />
            <CardBody className="space-y-4">
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
              <Textarea
                label="Question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
                maxLength={1000}
                placeholder="What do you want to ask?"
              />
              <Textarea
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={4000}
              />

              <div>
                <p className="field-label">Options</p>
                <div className="space-y-2">
                  {options.map((option, i) => (
                    <div key={option.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={option.text}
                        onChange={(e) => {
                          const next = options.map((o, j) => (j === i ? { ...o, text: e.target.value } : o));
                          setOptions(next);
                        }}
                        className="field-input"
                        placeholder={`Option ${i + 1}`}
                        maxLength={500}
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setOptions(options.filter((_, j) => j !== i))}
                          className="rounded p-1.5 text-muted hover:bg-surface-muted hover:text-danger"
                          aria-label="Remove option"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {options.length < 10 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setOptions([...options, { id: newOptionId(), text: '' }])}
                    icon={<Plus className="h-4 w-4" />}
                  >
                    Add option
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Voting rules" />
            <CardBody className="space-y-4">
              <Select
                label="Voting type"
                value={votingType}
                onChange={(e) => setVotingType(e.target.value as 'SINGLE' | 'MULTIPLE')}
              >
                <option value="SINGLE">Single choice</option>
                <option value="MULTIPLE">Multiple choice</option>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Starts at (optional)"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
                <Input label="Ends at" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
              </div>
              <Switch
                label="Anonymous voting"
                description="Voter identities are never shown, even to you."
                checked={anonymous}
                onChange={setAnonymous}
              />
              <Select
                label="Results visibility"
                value={resultsVisibility}
                onChange={(e) => setResultsVisibility(e.target.value)}
              >
                <option value="AFTER_VOTE">After a user votes</option>
                <option value="AFTER_END">After voting closes</option>
                <option value="PUBLIC">Always public</option>
              </Select>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Economy (optional)" subtitle="Entry fees and rewards are independent." />
            <CardBody className="space-y-4">
              <Input
                label="Entry fee (QCoins)"
                type="number"
                min={0}
                max={1000}
                value={entryFee}
                onChange={(e) => setEntryFee(Number(e.target.value))}
              />
              <Input
                label="Reward (QCoins)"
                type="number"
                min={0}
                max={5000}
                value={reward}
                onChange={(e) => setReward(Number(e.target.value))}
                hint="Poll rewards are participation-based — never option-based."
              />
              {reward > 0 && (
                <>
                  <Select label="Reward mode" value={rewardMode} onChange={(e) => setRewardMode(e.target.value)}>
                    <option value="ALL_PARTICIPANTS">All participants</option>
                    <option value="FIRST_N">First N participants</option>
                    <option value="RANDOM_DRAW">Random draw at poll end</option>
                  </Select>
                  {(rewardMode === 'FIRST_N' || rewardMode === 'RANDOM_DRAW') && (
                    <Input
                      label={rewardMode === 'FIRST_N' ? 'Reward first N voters' : 'Number of draw winners'}
                      type="number"
                      min={1}
                      value={maxRewardRecipients || ''}
                      onChange={(e) => setMaxRewardRecipients(Number(e.target.value))}
                    />
                  )}
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Note for moderators" />
            <CardBody>
              <Textarea
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Context for the review (optional)"
                maxLength={500}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={() => {
          setConfirmSubmit(false);
          submitMutation.mutate();
        }}
        title="Submit poll for review?"
        message="A moderator will verify the poll before it opens for voting. You'll be notified of the decision."
        confirmLabel="Submit"
        loading={submitMutation.isPending}
      />
    </div>
  );
}

function toLocalInput(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default PollBuilderPage;
