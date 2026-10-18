import { Link } from 'react-router-dom';
import { Coins, HelpCircle, LifeBuoy, ShieldCheck, Vote, FileQuestion } from 'lucide-react';
import { useDocumentTitle } from '@/hooks';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';

/** Help & support: real explanations of how the platform works. */
export function HelpPage() {
  useDocumentTitle('Help & support');

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        title="Help & support"
        description="How QuizSphere works — quizzes, polls, moderation, and QCoins."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Getting started" />
          <CardBody className="space-y-4">
            <Faq
              icon={<FileQuestion className="h-5 w-5" />}
              question="How do I create a quiz?"
              answer="Open Creator Studio → New Quiz. Build questions, save a draft at any time, then submit for review. Moderators check correctness and quality before publication. If changes are needed, you'll get a note explaining exactly what to fix."
            />
            <Faq
              icon={<Vote className="h-5 w-5" />}
              question="How do polls work?"
              answer="Polls support single or multiple choice voting with fixed start and end times enforced on the server. Creators choose whether voting is anonymous and when results become visible. Only approved, open polls accept votes."
            />
            <Faq
              icon={<ShieldCheck className="h-5 w-5" />}
              question="Why is my content pending review?"
              answer="Every quiz and poll is reviewed by moderators before publication. This keeps answer keys correct and content appropriate. You can track status in Pending Reviews and respond to change requests from your workspace."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="QCoins" subtitle="Internal platform credits — no cash value." />
          <CardBody className="space-y-4">
            <Faq
              icon={<Coins className="h-5 w-5" />}
              question="What are QCoins?"
              answer="QCoins are internal credits used for optional entry fees and rewards. They cannot be withdrawn as cash or transferred between users. Every movement is recorded in an immutable ledger you can review in your wallet."
            />
            <Faq
              icon={<Coins className="h-5 w-5" />}
              question="When do I earn rewards?"
              answer="Quiz rewards are paid after a server-verified pass (or top-percent finish, if the creator configured that). Poll rewards are participation-based — an opinion poll never has a correct answer. Refunds follow documented rules for cancellations and abandoned attempts."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Need more help?" />
          <CardBody>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-body">
                If something looks wrong — a broken quiz, a dispute about rewards, or inappropriate content — report it
                from the relevant page, or reach out to the platform team.
              </p>
              <Link to="/explore/quizzes">
                <Button variant="outline" icon={<LifeBuoy className="h-4 w-4" />}>
                  Back to exploring
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Faq({
  icon,
  question,
  answer,
}: {
  icon: React.ReactNode;
  question: string;
  answer: string;
}) {
  return (
    <div className="flex gap-3.5">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-heading">{question}</p>
        <p className="mt-1 text-sm leading-relaxed text-body">{answer}</p>
      </div>
    </div>
  );
}

export default HelpPage;
