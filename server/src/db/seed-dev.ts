/**
 * DEVELOPMENT SEED SCRIPT — NOT FOR PRODUCTION USE.
 *
 * Populates a throwaway database with sample accounts and content so the UI
 * can be explored locally. It refuses to run when:
 *   - NODE_ENV is "production", or
 *   - QUIZSPHERE_DB points outside the local ./data directory, or
 *   - the database already contains accounts that are not seed accounts.
 *
 * Run with:  npm run db:seed:dev -- --confirm
 */
import { all, count, get, newId, nowIso, run, tx, closeDb } from './index.js';
import { migrate } from './migrate.js';
import { hashPassword } from '../lib/auth.js';
import { credit } from '../lib/wallet.js';
import { recordReview } from '../lib/content.js';
import { evaluate } from '../lib/achievements.js';

const args = new Set(process.argv.slice(2));

function guard() {
  if (!args.has('--confirm')) {
    console.error('Refusing to seed. Pass --confirm to acknowledge this is development-only data.');
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV=production.');
    process.exit(1);
  }
  const dbFile = process.env.QUIZSPHERE_DB ?? 'data/quizsphere.db';
  if (!dbFile.replace(/\\/g, '/').includes('data/')) {
    console.error(`Refusing to seed: database path "${dbFile}" is not a local development database.`);
    process.exit(1);
  }
}

const SEED_MARKER = '@dev.example';

function seed() {
  const existing = count('SELECT COUNT(*) AS t FROM users');
  const nonSeed = count('SELECT COUNT(*) AS t FROM users WHERE email NOT LIKE ?', `%${SEED_MARKER}`);
  if (existing > 0 && nonSeed > 0) {
    console.error(`Refusing to seed: ${nonSeed} real account(s) already exist in this database.`);
    process.exit(1);
  }

  migrate();
  const now = nowIso();
  const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

  // ---------------------------------------------------------------- taxonomy
  const categories = [
    ['Science', 'science', 'Physics, chemistry, biology and the natural world.'],
    ['History', 'history', 'Events, people and movements that shaped the world.'],
    ['Technology', 'technology', 'Software, hardware and the internet.'],
    ['Geography', 'geography', 'Places, maps and the physical world.'],
    ['Mathematics', 'mathematics', 'Numbers, logic and problem solving.'],
  ];
  const categoryIds: Record<string, string> = {};
  categories.forEach(([name, slug, description], index) => {
    const id = newId();
    categoryIds[slug] = id;
    run(
      'INSERT OR IGNORE INTO categories (id, name, slug, description, sort_order, is_active, created_at) VALUES (?,?,?,?,?,1,?)',
      id,
      name,
      slug,
      description,
      index,
      now,
    );
  });

  const levels: [string, string, number][] = [
    ['Beginner', 'beginner', 1],
    ['Intermediate', 'intermediate', 2],
    ['Advanced', 'advanced', 3],
  ];
  const difficultyIds: Record<string, string> = {};
  for (const [name, slug, order] of levels) {
    const id = newId();
    difficultyIds[slug] = id;
    run(
      'INSERT OR IGNORE INTO difficulty_levels (id, name, slug, sort_order) VALUES (?,?,?,?)',
      id,
      name,
      slug,
      order,
    );
  }

  const tagNames = ['quick', 'challenging', 'trivia', 'exam-prep', 'fun'];
  const tagIds: Record<string, string> = {};
  for (const name of tagNames) {
    const id = newId();
    tagIds[name] = id;
    run('INSERT OR IGNORE INTO tags (id, name, slug, created_at) VALUES (?,?,?,?)', id, name, name, now);
  }

  // ---------------------------------------------------------------- accounts
  const accounts: { email: string; username: string; displayName: string; role: string; daysAgo: number }[] = [
    { email: 'admin@dev.example', username: 'dev_admin', displayName: 'Avery Admin', role: 'admin', daysAgo: 60 },
    { email: 'creator@dev.example', username: 'dev_creator', displayName: 'Casey Creator', role: 'creator', daysAgo: 50 },
    { email: 'creator2@dev.example', username: 'dev_creator2', displayName: 'Riley Writer', role: 'creator', daysAgo: 42 },
    { email: 'player@dev.example', username: 'dev_player', displayName: 'Jordan Player', role: 'user', daysAgo: 30 },
    { email: 'player2@dev.example', username: 'dev_player2', displayName: 'Sam Solver', role: 'user', daysAgo: 22 },
    { email: 'player3@dev.example', username: 'dev_player3', displayName: 'Alex Quizzard', role: 'user', daysAgo: 14 },
  ];

  const ids: Record<string, string> = {};
  for (const account of accounts) {
    const id = newId();
    ids[account.username] = id;
    const created = isoDaysAgo(account.daysAgo);
    run(
      `INSERT OR IGNORE INTO users (id, email, username, display_name, password_hash, role, account_status,
                                    email_verified_at, bio, created_at, updated_at, last_active_at)
       VALUES (?,?,?,?,?,?,'active',?,?,?,?,?)`,
      id,
      account.email,
      account.username,
      account.displayName,
      hashPassword('devpassword123'),
      account.role,
      created,
      `Development ${account.role} account. Not a real person.`,
      created,
      now,
      isoDaysAgo(1),
    );
    const actual = get<{ id: string }>('SELECT id FROM users WHERE username = ?', account.username)!.id;
    ids[account.username] = actual;
    run('INSERT OR IGNORE INTO wallet_accounts (user_id, balance, updated_at) VALUES (?,0,?)', actual, now);
    credit({
      userId: actual,
      amount: 200,
      entryType: 'signup_bonus',
      description: 'Development funding',
      idempotencyKey: `seed_funding:${actual}`,
    });
  }

  const adminId = ids['dev_admin'];
  const creatorId = ids['dev_creator'];
  const creator2Id = ids['dev_creator2'];

  // ---------------------------------------------------------------- quizzes
  const quizSpecs: {
    title: string;
    summary: string;
    creator: string;
    category: string;
    difficulty: string;
    tags: string[];
    fee: number;
    reward: number;
    status: string;
    daysAgo: number;
    questions: { prompt: string; options: string[]; correct: number; explanation: string }[];
  }[] = [
    {
      title: 'Everyday Physics',
      summary: 'Ten questions on the physics you meet in daily life.',
      creator: 'dev_creator',
      category: 'science',
      difficulty: 'beginner',
      tags: ['quick', 'trivia'],
      fee: 0,
      reward: 12,
      status: 'approved',
      daysAgo: 28,
      questions: [
        { prompt: 'Why does a heavy object and a light object fall at the same rate in a vacuum?', options: ['Gravity acts equally on all masses', 'Air resistance is absent', 'Mass cancels out of the equations'], correct: 1, explanation: 'Without air resistance, acceleration due to gravity is independent of mass.' },
        { prompt: 'What unit measures force?', options: ['Joule', 'Newton', 'Watt'], correct: 1, explanation: 'One newton accelerates one kilogram at one metre per second squared.' },
        { prompt: 'Which surface reflects the most light?', options: ['Matte black paint', 'Polished silver', 'Rough wood'], correct: 1, explanation: 'Polished metals reflect specularly and absorb very little.' },
        { prompt: 'Boiling water at sea level happens at roughly what temperature?', options: ['80 °C', '100 °C', '120 °C'], correct: 1, explanation: 'At one atmosphere water boils at 100 °C.' },
      ],
    },
    {
      title: 'World History: The 20th Century',
      summary: 'Key events from 1900 to 1999.',
      creator: 'dev_creator',
      category: 'history',
      difficulty: 'intermediate',
      tags: ['exam-prep'],
      fee: 5,
      reward: 25,
      status: 'approved',
      daysAgo: 21,
      questions: [
        { prompt: 'In which year did the Berlin Wall fall?', options: ['1987', '1989', '1991'], correct: 1, explanation: 'The wall was opened on 9 November 1989.' },
        { prompt: 'Which treaty ended the First World War for Germany?', options: ['Treaty of Versailles', 'Treaty of Trianon', 'Treaty of Brest-Litovsk'], correct: 0, explanation: 'The Treaty of Versailles was signed in 1919.' },
        { prompt: 'Who was the first person to orbit the Earth?', options: ['Yuri Gagarin', 'Alan Shepard', 'John Glenn'], correct: 0, explanation: 'Gagarin orbited the Earth on 12 April 1961.' },
      ],
    },
    {
      title: 'JavaScript Fundamentals',
      summary: 'Scoping, types and async behaviour.',
      creator: 'dev_creator2',
      category: 'technology',
      difficulty: 'intermediate',
      tags: ['exam-prep', 'challenging'],
      fee: 0,
      reward: 15,
      status: 'approved',
      daysAgo: 12,
      questions: [
        { prompt: 'Which keyword declares a block-scoped variable?', options: ['var', 'let', 'function'], correct: 1, explanation: 'let and const are block scoped; var is function scoped.' },
        { prompt: 'What does typeof null return?', options: ['null', 'object', 'undefined'], correct: 1, explanation: 'A long-standing quirk: typeof null is "object".' },
        { prompt: 'Which method schedules a macrotask?', options: ['Promise.then', 'setTimeout', 'queueMicrotask'], correct: 1, explanation: 'setTimeout schedules a macrotask; promise callbacks are microtasks.' },
      ],
    },
    {
      title: 'Mental Arithmetic Sprint',
      summary: 'Fast arithmetic without a calculator.',
      creator: 'dev_creator2',
      category: 'mathematics',
      difficulty: 'beginner',
      tags: ['quick', 'fun'],
      fee: 2,
      reward: 10,
      status: 'pending_review',
      daysAgo: 4,
      questions: [
        { prompt: 'What is 17 × 4?', options: ['64', '68', '72'], correct: 1, explanation: '17 × 4 = 68.' },
        { prompt: 'What is 15% of 200?', options: ['20', '30', '35'], correct: 1, explanation: '15% of 200 is 30.' },
        { prompt: 'What is the square root of 144?', options: ['11', '12', '14'], correct: 1, explanation: '12 × 12 = 144.' },
      ],
    },
    {
      title: 'Rivers and Mountains',
      summary: 'Physical geography warm-up.',
      creator: 'dev_creator',
      category: 'geography',
      difficulty: 'beginner',
      tags: ['trivia'],
      fee: 0,
      reward: 8,
      status: 'changes_requested',
      daysAgo: 9,
      questions: [
        { prompt: 'Which is the longest river in South America?', options: ['Orinoco', 'Amazon', 'Paraná'], correct: 1, explanation: 'The Amazon is the longest by most measurements.' },
        { prompt: 'Which mountain range contains Mont Blanc?', options: ['The Alps', 'The Andes', 'The Rockies'], correct: 0, explanation: 'Mont Blanc sits in the Alps.' },
        { prompt: 'Which desert covers much of northern Africa?', options: ['Kalahari', 'Sahara', 'Atacama'], correct: 1, explanation: 'The Sahara is the largest hot desert.' },
      ],
    },
    {
      title: 'Advanced Data Structures',
      summary: 'Trees, heaps and graph traversal.',
      creator: 'dev_creator2',
      category: 'technology',
      difficulty: 'advanced',
      tags: ['challenging'],
      fee: 0,
      reward: 30,
      status: 'draft',
      daysAgo: 2,
      questions: [
        { prompt: 'What is the height of a balanced binary tree with n nodes?', options: ['O(1)', 'O(log n)', 'O(n)'], correct: 1, explanation: 'A balanced tree has logarithmic height.' },
        { prompt: 'Which traversal visits a node before its children?', options: ['Pre-order', 'In-order', 'Post-order'], correct: 0, explanation: 'Pre-order visits the node first.' },
        { prompt: 'A binary heap is usually stored as what?', options: ['A linked list', 'An array', 'A hash table'], correct: 1, explanation: 'Heaps map naturally onto arrays.' },
      ],
    },
  ];

  for (const spec of quizSpecs) {
    const id = newId();
    const created = isoDaysAgo(spec.daysAgo);
    const publishedAt = spec.status === 'approved' ? isoDaysAgo(spec.daysAgo - 1) : null;
    tx(() => {
      run(
        `INSERT INTO quizzes (id, creator_id, title, summary, description, category_id, difficulty_id, status,
                              entry_fee, reward_coins, passing_score, time_limit_seconds, max_attempts,
                              shuffle_questions, show_explanations, visibility, version, submitted_at, published_at,
                              reviewed_at, reviewed_by, review_notes, quality_rating, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL,3,0,1,'public',1,?,?,?,?,?,?,?,?)`,
        id,
        ids[spec.creator],
        spec.title,
        spec.summary,
        spec.summary,
        categoryIds[spec.category],
        difficultyIds[spec.difficulty],
        spec.status,
        spec.fee,
        spec.reward,
        60,
        spec.status === 'draft' ? null : created,
        publishedAt,
        ['approved', 'rejected', 'changes_requested'].includes(spec.status) ? created : null,
        ['approved', 'rejected', 'changes_requested'].includes(spec.status) ? adminId : null,
        spec.status === 'changes_requested' ? 'Please add one more question so the quiz meets the minimum length.' : null,
        spec.status === 'approved' ? 4 : null,
        created,
        now,
      );
      spec.questions.forEach((question, qi) => {
        const qid = newId();
        run(
          'INSERT INTO quiz_questions (id, quiz_id, position, prompt, question_type, points, explanation) VALUES (?,?,?,?,?,?,?)',
          qid,
          id,
          qi + 1,
          question.prompt,
          'single',
          1,
          question.explanation,
        );
        question.options.forEach((option, oi) => {
          run(
            'INSERT INTO quiz_options (id, question_id, position, body, is_correct) VALUES (?,?,?,?,?)',
            newId(),
            qid,
            oi + 1,
            option,
            oi === question.correct ? 1 : 0,
          );
        });
      });
      for (const tag of spec.tags) {
        run('INSERT OR IGNORE INTO quiz_tags (quiz_id, tag_id) VALUES (?,?)', id, tagIds[tag]);
      }
      if (spec.status !== 'draft') {
        recordReview({
          contentType: 'quiz',
          contentId: id,
          version: 1,
          reviewerId: adminId,
          decision:
            spec.status === 'approved'
              ? 'approved'
              : spec.status === 'changes_requested'
                ? 'changes_requested'
                : 'resubmitted',
          reason: spec.status === 'changes_requested' ? 'Needs one more question.' : null,
          notes: 'Development seed review.',
          qualityRating: spec.status === 'approved' ? 4 : null,
        });
      }
    });
  }

  // ---------------------------------------------------------------- polls
  const pollSpecs: {
    question: string;
    creator: string;
    category: string;
    options: string[];
    status: string;
    closesInDays: number | null;
    daysAgo: number;
  }[] = [
    { question: 'Which quiz topic should we add next?', creator: 'dev_creator', category: 'science', options: ['Astronomy', 'Chemistry', 'Human anatomy'], status: 'published', closesInDays: 14, daysAgo: 10 },
    { question: 'What is the hardest part of quiz design?', creator: 'dev_creator2', category: 'technology', options: ['Writing distractors', 'Balancing difficulty', 'Setting rewards'], status: 'published', closesInDays: 5, daysAgo: 6 },
    { question: 'Should polls allow multiple answers by default?', creator: 'dev_creator', category: 'technology', options: ['Yes, always', 'No, keep single choice', 'Let the creator decide'], status: 'published', closesInDays: null, daysAgo: 2 },
    { question: 'Which reward level feels fair for a five minute quiz?', creator: 'dev_creator2', category: 'mathematics', options: ['5 QCoin', '15 QCoin', '30 QCoin'], status: 'pending_review', closesInDays: 7, daysAgo: 1 },
    { question: 'How long should the default poll run for?', creator: 'dev_creator', category: 'geography', options: ['3 days', '7 days', '30 days'], status: 'draft', closesInDays: 7, daysAgo: 0 },
  ];

  for (const spec of pollSpecs) {
    const id = newId();
    const created = isoDaysAgo(spec.daysAgo);
    const publishedAt = spec.status === 'published' ? isoDaysAgo(spec.daysAgo) : null;
    tx(() => {
      run(
        `INSERT INTO polls (id, creator_id, question, description, category_id, status, allow_multiple, is_anonymous,
                            visibility, closes_at, version, submitted_at, published_at, reviewed_at, reviewed_by,
                            quality_rating, created_at, updated_at)
         VALUES (?,?,?,?,?,?,0,0,'public',?,1,?,?,?,?,?,?,?)`,
        id,
        ids[spec.creator],
        spec.question,
        'Development seed poll.',
        categoryIds[spec.category],
        spec.status,
        spec.closesInDays ? new Date(Date.now() + spec.closesInDays * 86400000).toISOString() : null,
        spec.status === 'draft' ? null : created,
        publishedAt,
        spec.status === 'published' ? created : null,
        spec.status === 'published' ? adminId : null,
        spec.status === 'published' ? 4 : null,
        created,
        now,
      );
      spec.options.forEach((option, index) => {
        run('INSERT INTO poll_options (id, poll_id, position, body) VALUES (?,?,?,?)', newId(), id, index + 1, option);
      });
    });
  }

  // ---------------------------------------------------------------- activity
  const published = all<{ id: string; entry_fee: number; reward_coins: number; passing_score: number }>(
    "SELECT id, entry_fee, reward_coins, passing_score FROM quizzes WHERE status = 'approved'",
  );
  const players = ['dev_player', 'dev_player2', 'dev_player3'];

  for (const quiz of published) {
    const questions = all<{ id: string }>(
      'SELECT id FROM quiz_questions WHERE quiz_id = ? ORDER BY position',
      quiz.id,
    );
    players.forEach((username, pi) => {
      const userId = ids[username];
      const attemptId = newId();
      const answers = questions.map(() => (pi === 0 ? 1 : Math.random() > 0.35 ? 1 : 0));
      const correctCount = answers.filter(Boolean).length;
      const scorePercent = Math.round((correctCount / questions.length) * 100);
      const passed = scorePercent >= quiz.passing_score ? 1 : 0;
      const submittedAt = isoDaysAgo(3 + pi);

      tx(() => {
        run(
          `INSERT INTO quiz_attempts (id, quiz_id, user_id, status, started_at, submitted_at, time_spent_seconds,
                                      question_count, correct_count, earned_points, possible_points, score_percent,
                                      passed, entry_fee_charged, reward_paid)
           VALUES (?,?,?,'submitted',?,?,?,?,?,?,?,?,?,?,?)`,
          attemptId,
          quiz.id,
          userId,
          new Date(new Date(submittedAt).getTime() - 240_000).toISOString(),
          submittedAt,
          240,
          questions.length,
          correctCount,
          correctCount,
          questions.length,
          scorePercent,
          passed,
          quiz.entry_fee,
          passed ? quiz.reward_coins + correctCount : correctCount,
        );
        questions.forEach((question, index) => {
          const correctOption = get<{ id: string }>(
            'SELECT id FROM quiz_options WHERE question_id = ? AND is_correct = 1 LIMIT 1',
            question.id,
          );
          run(
            'INSERT INTO attempt_answers (id, attempt_id, question_id, selected_json, is_correct, points_awarded) VALUES (?,?,?,?,?,?)',
            newId(),
            attemptId,
            question.id,
            JSON.stringify(answers[index] && correctOption ? [correctOption.id] : []),
            answers[index] ? 1 : 0,
            answers[index] ? 1 : 0,
          );
        });
        run('UPDATE quizzes SET total_attempts = total_attempts + 1 WHERE id = ?', quiz.id);
        const reward = passed ? quiz.reward_coins + correctCount : correctCount;
        if (reward > 0) {
          credit({
            userId,
            amount: reward,
            entryType: 'quiz_reward',
            description: `Development seed attempt reward`,
            referenceType: 'attempt',
            referenceId: attemptId,
            idempotencyKey: `seed_reward:${attemptId}`,
          });
        }
      });
    });
  }

  // Votes on published polls
  const publishedPolls = all<{ id: string }>("SELECT id FROM polls WHERE status = 'published'");
  publishedPolls.forEach((poll, index) => {
    const options = all<{ id: string }>('SELECT id FROM poll_options WHERE poll_id = ? ORDER BY position', poll.id);
    players.forEach((username, pi) => {
      const option = options[(index + pi) % options.length];
      run(
        'INSERT OR IGNORE INTO poll_votes (id, poll_id, option_id, user_id, created_at) VALUES (?,?,?,?,?)',
        newId(),
        poll.id,
        option.id,
        ids[username],
        isoDaysAgo(index + 1),
      );
    });
  });

  // Ratings on published content
  published.forEach((quiz, index) => {
    players.forEach((username, pi) => {
      run(
        `INSERT OR IGNORE INTO ratings (id, content_type, content_id, user_id, score, review_text, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?, 'published', ?, ?)`,
        newId(),
        'quiz',
        quiz.id,
        ids[username],
        Math.max(1, Math.min(5, 4 - ((index + pi) % 3))),
        pi === 0 ? 'Clear questions and the explanations actually teach you something.' : '',
        isoDaysAgo(index + 1),
        now,
      );
    });
  });

  // Notifications and achievements for the seeded players
  for (const username of players) {
    evaluate(ids[username]);
    run(
      `INSERT INTO notifications (id, user_id, kind, title, body, link, created_at) VALUES (?,?,?,?,?,?,?)`,
      newId(),
      ids[username],
      'system',
      'Welcome to QuizSphere',
      'This is a development notification generated by the seed script.',
      '/app',
      isoDaysAgo(2),
    );
  }
  evaluate(creatorId);
  evaluate(creator2Id);

  console.log('Development data seeded.');
  console.log('');
  console.log('  Admin    admin@dev.example     / devpassword123');
  console.log('  Creators creator@dev.example   / devpassword123');
  console.log('           creator2@dev.example  / devpassword123');
  console.log('  Players  player@dev.example    / devpassword123');
  console.log('           player2@dev.example   / devpassword123');
  console.log('           player3@dev.example   / devpassword123');
  console.log('');
  console.log('These are development-only accounts. Delete them with: npm run db:reset');
}

guard();
seed();
closeDb();
