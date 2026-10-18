import bcrypt from 'bcryptjs';
import type { Store } from './store.js';
import type { Question, QuizAttempt } from '../types.js';
import { id, now, slugify } from '../lib/utils.js';
import { scoreAttempt } from '../lib/scoring.js';

const CATEGORIES = [
  'Programming', 'JavaScript', 'Java', 'C++', 'Data Structures and Algorithms', 'Computer Fundamentals',
  'Computer Networking', 'Backend Development', 'Frontend Development', 'Web Development', 'Databases',
  'Operating Systems', 'Software Engineering', 'Mathematics', 'Science', 'General Knowledge',
  'English and Grammar', 'Aptitude and Reasoning', 'Interview Preparation', 'Competitive Exams',
  'Cybersecurity', 'Artificial Intelligence', 'Other',
];
const SUBS: [string, string][] = [
  ['JavaScript', 'ES6+ and DOM'], ['Data Structures and Algorithms', 'Arrays and Strings'],
  ['Data Structures and Algorithms', 'Trees and Graphs'], ['Backend Development', 'Node.js APIs'],
  ['General Knowledge', 'Geography'], ['Databases', 'SQL'],
];
let oid = 0; let qid = 0;
const opt = (text: string) => ({ id: `o${++oid}`, text });
function q(partial: Partial<Question> & Pick<Question, 'type' | 'text' | 'explanation'>): Question {
  return {
    id: `q${++qid}`, options: [], correctOptionIds: [], acceptedAnswers: [], caseInsensitive: true,
    hint: '', imageUrl: '', codeSnippet: null, difficulty: 'Beginner', marks: 1, topicTag: '',
    order: 0, allowPartialCredit: false, ...partial,
  };
}
function choice(text: string, explanation: string, options: string[], correctIdx: number[], extra: Partial<Question> = {}) {
  const opts = options.map(opt);
  return q({ type: correctIdx.length > 1 || extra.type === 'multiple_choice' ? 'multiple_choice' : 'single_choice', text, explanation, options: opts, correctOptionIds: correctIdx.map(i => opts[i].id), ...extra });
}
function tf(text: string, explanation: string, correctTrue: boolean, extra: Partial<Question> = {}) {
  const opts = [opt('True'), opt('False')];
  return q({ type: 'True_false', text, explanation, options: opts, correctOptionIds: [opts[correctTrue ? 0 : 1].id], ...extra });
}

export const SEED_ACCOUNTS = {
  admin: { email: 'admin@quizsphere.local', password: 'Admin@123' },
  creator: { email: 'maya@example.com', password: 'Creator@123' },
  learner: { email: 'arjun@example.com', password: 'Learner@123' },
};

export async function seedIfEmpty(store: Store) {
  if ((await store.users.count()) > 0) return;
  const t0 = now();
  const hash = (p: string) => bcrypt.hash(p, 10);
  const admin = await store.users.insert({ id: id(), displayName: 'QuizSphere Admin', email: SEED_ACCOUNTS.admin.email, passwordHash: await hash(SEED_ACCOUNTS.admin.password), role: 'admin', bio: 'Platform administrator', isSuspended: false, createdAt: t0, updatedAt: t0 });
  const maya = await store.users.insert({ id: id(), displayName: 'Maya Verma', email: SEED_ACCOUNTS.creator.email, passwordHash: await hash(SEED_ACCOUNTS.creator.password), role: 'user', bio: 'Software engineer who loves turning tricky concepts into friendly quizzes.', isSuspended: false, createdAt: t0, updatedAt: t0 });
  const rohan = await store.users.insert({ id: id(), displayName: 'Rohan Mehta', email: 'rohan@example.com', passwordHash: await hash('Creator@123'), role: 'user', bio: 'CS educator and trivia nerd.', isSuspended: false, createdAt: t0, updatedAt: t0 });
  const arjun = await store.users.insert({ id: id(), displayName: 'Arjun Sharma', email: SEED_ACCOUNTS.learner.email, passwordHash: await hash(SEED_ACCOUNTS.learner.password), role: 'user', bio: '', isSuspended: false, createdAt: t0, updatedAt: t0 });

  const catByName = new Map<string, string>();
  for (const name of CATEGORIES) {
    const c = await store.categories.insert({ id: id(), name, slug: slugify(name), description: `${name} quizzes`, parentCategoryId: null, isActive: true, createdAt: t0, updatedAt: t0 });
    catByName.set(name, c.id);
  }
  const subByName = new Map<string, string>();
  for (const [parent, name] of SUBS) {
    const c = await store.categories.insert({ id: id(), name, slug: slugify(name), description: '', parentCategoryId: catByName.get(parent)!, isActive: true, createdAt: t0, updatedAt: t0 });
    subByName.set(name, c.id);
  }

  async function makeQuiz(args: {
    title: string; description: string; creatorId: string; category: string; subcategory?: string;
    tags: string[]; difficulty: 'Beginner' | 'Intermediate' | 'Advanced'; language?: string;
    estimatedDuration: number; timeLimit?: number | null; questions: Question[];
    state: 'published' | 'pending' | 'draft' | 'Changes requested'; daysAgo?: number;
    settings?: any;
  }) {
    const days = args.daysAgo || 0;
    const created = new Date(Date.now() - days * 86400000).toISOString();
    const quizId = id(); const versionId = id();
    const questions = args.questions.map((qq, i) => ({ ...qq, order: i }));
    const total = questions.reduce((s, x) => s + x.marks, 0);
    const isPub = args.state === 'published'; const isPend = args.state === 'pending';
    await store.versions.insert({
      id: versionId, quizId, versionNumber: 1,
      state: isPub ? 'published' : isPend ? 'pending' : args.state === 'Changes requested' ? 'returned' : 'draft',
      metadata: {
        title: args.title, description: args.description, coverImage: '', categoryId: catByName.get(args.category)!,
        subcategoryId: args.subcategory ? subByName.get(args.subcategory)! : null, tags: args.tags,
        difficulty: args.difficulty, language: args.language || 'English', estimatedDuration: args.estimatedDuration,
        timeLimit: args.timeLimit ?? null,
        settings: args.settings || { explanationMode: 'after_submission', shuffleQuestions: false, shuffleOptions: false, showScoreImmediately: true },
      },
      questions, totalPoints: total, createdBy: args.creatorId, createdAt: created, updatedAt: created,
    });
    const quiz = await store.quizzes.insert({
      id: quizId, slug: slugify(args.title), creatorId: args.creatorId,
      status: isPub ? 'APPROVED' : isPend ? 'PENDING_REVIEW' : args.state === 'Changes requested' ? 'CHANGES_REQUESTED' : 'DRAFT',
      draftVersionId: args.state === 'draft' || args.state === 'Changes requested' ? versionId : null,
      pendingVersionId: isPend ? versionId : null,
      currentPublishedVersionId: isPub ? versionId : null, isLive: isPub,
      nextVersionNumber: 2, attemptsCount: 0, ratingAvg: 0, ratingCount: 0,
      latestFeedback: args.state === 'Changes requested' ? 'Please add a worked example to the scheduling question explanation and fix the typo in question 3, then resubmit.' : '',
      publishedAt: isPub ? created : null, createdAt: created, updatedAt: created,
    });
    if (isPend) await store.moderationLogs.insert({ id: id(), quizId, quizVersionId: versionId, adminId: args.creatorId, action: 'submit', previousStatus: 'DRAFT', newStatus: 'PENDING_REVIEW', feedback: '', createdAt: created });
    if (args.state === 'Changes requested') {
      await store.moderationLogs.insert({ id: id(), quizId, quizVersionId: versionId, adminId: args.creatorId, action: 'submit', previousStatus: 'DRAFT', newStatus: 'PENDING_REVIEW', feedback: '', createdAt: created });
      await store.moderationLogs.insert({ id: id(), quizId, quizVersionId: versionId, adminId: admin.id, action: 'request_changes', previousStatus: 'PENDING_REVIEW', newStatus: 'CHANGES_REQUESTED', feedback: quiz.latestFeedback!, createdAt: created });
      await store.notifications.insert({ id: id(), userId: args.creatorId, type: 'changes_requested', message: `Changes requested for "${args.title}": ${quiz.latestFeedback}`, quizId, read: false, createdAt: created });
    }
    return { quiz, versionId, questions };
  }

  const js = await makeQuiz({
    title: 'JavaScript Fundamentals', creatorId: maya.id, category: 'JavaScript', subcategory: 'ES6+ and DOM',
    description: 'Variables, arrow functions, closures, arrays and async basics — the JavaScript every web developer uses daily. Mixed question types with a code snippet.',
    tags: ['javascript', 'es6', 'closures', 'async'], difficulty: 'Beginner', estimatedDuration: 12, timeLimit: 10, state: 'published', daysAgo: 9,
    questions: [
      choice('Which keyword declares a block-scoped variable that can be reassigned?', 'let is block-scoped and reassignable. const is also block-scoped but cannot be reassigned, and var is function-scoped.', ['var', 'let', 'const', 'static'], [1], { topicTag: 'variables' }),
      choice('Which of these are primitive types in JavaScript? (Select all that apply)', 'string, number, boolean, null, undefined, bigint and symbol are primitives. Objects (including arrays) are not primitives.', ['string', 'array', 'boolean', 'object', 'bigint'], [0, 2, 4], { type: 'multiple_choice', topicTag: 'types', marks: 2, hint: 'There are three correct answers.' }),
      tf('An arrow function has its own `this` binding.', 'Arrow functions do not create their own `this`; they capture it lexically from the surrounding scope.', false, { topicTag: 'functions' }),
      q({ type: 'fill_blank', text: 'The array method that returns a new array with elements that pass a test is called _____.', explanation: 'Array.prototype.filter() returns a new array containing only elements for which the callback returns truthy.', acceptedAnswers: ['filter', 'filter()', 'Array.prototype.filter'], marks: 2, topicTag: 'arrays', hint: 'It starts with the letter f.' }),
      choice('What does this code print?', 'The function returned by makeCounter captures the variable `n` by closure, so its value persists between calls: first call prints 1, second prints 2.', ['1 1', '1 2', '0 1', 'undefined'], [1], { topicTag: 'closures', difficulty: 'Intermediate', marks: 2, codeSnippet: { language: 'javascript', code: 'function makeCounter() {\n  let n = 0;\n  return () => ++n;\n}\nconst c = makeCounter();\nconsole.log(c(), c());' } }),
      q({ type: 'short_answer', text: 'In your own words, what problem do Promises solve compared with nested callbacks? (Self-assessed: compare your answer with the explanation after submitting.)', explanation: 'Good answers mention: deeply nested callbacks ("callback hell") are hard to read and error-handle; Promises flatten async flows with .then() chains, give a single .catch() path, and compose with Promise.all etc. This question is not auto-graded.', marks: 3, topicTag: 'async', difficulty: 'Intermediate' }),
    ],
  });

  await makeQuiz({
    title: 'DSA: Arrays and Complexity', creatorId: maya.id, category: 'Data Structures and Algorithms', subcategory: 'Arrays and Strings',
    description: 'Big-O basics, array operations and classic patterns like two pointers and prefix sums. Great interview warm-up.',
    tags: ['dsa', 'big-o', 'arrays', 'interviews'], difficulty: 'Intermediate', estimatedDuration: 15, state: 'published', daysAgo: 6,
    settings: { explanationMode: 'immediate', shuffleQuestions: false, shuffleOptions: true, showScoreImmediately: true },
    questions: [
      choice('What is the time complexity of accessing an element by index in an array?', 'Arrays store elements contiguously, so index access is O(1).', ['O(n)', 'O(log n)', 'O(1)', 'O(n log n)'], [2], { topicTag: 'big-o' }),
      choice('Which operations on a dynamic array are typically O(n)? (Select all that apply)', 'Inserting or deleting in the middle shifts elements (O(n)). Appending to the end is amortized O(1), and index reads are O(1).', ['Insert in the middle', 'Read by index', 'Delete from the middle', 'Append to the end'], [0, 2], { type: 'multiple_choice', marks: 2, topicTag: 'arrays', allowPartialCredit: true }),
      tf('Binary search requires the input array to be sorted.', 'True — binary search halves the search space based on ordering, so the array must be sorted first.', true, { topicTag: 'searching' }),
      q({ type: 'fill_blank', text: 'The technique using two indices moving towards each other in a sorted array is called the _____ technique.', explanation: '"Two pointers" is the standard name (also spelled two-pointer).', acceptedAnswers: ['two pointers', 'two-pointer', 'two pointer'], marks: 2, topicTag: 'patterns' }),
      choice('What is the worst-case time complexity of quicksort?', 'With consistently bad pivots (e.g., sorted input with first-element pivot) quicksort degrades to O(n²); its average case is O(n log n).', ['O(n log n)', 'O(n²)', 'O(n)', 'O(log n)'], [1], { topicTag: 'sorting', difficulty: 'Advanced', marks: 2 }),
    ],
  });

  await makeQuiz({
    title: 'Computer Networking Essentials', creatorId: rohan.id, category: 'Computer Networking',
    description: 'TCP vs UDP, DNS, HTTP status codes and the OSI layers you actually meet in interviews and exams.',
    tags: ['networking', 'tcp', 'dns', 'http'], difficulty: 'Beginner', estimatedDuration: 10, state: 'published', daysAgo: 4,
    questions: [
      choice('Which protocol guarantees ordered, reliable delivery?', 'TCP provides reliable, ordered delivery with retransmission and flow control. UDP does not.', ['UDP', 'IP', 'TCP', 'ICMP'], [2]),
      tf('DNS translates domain names into IP addresses.', 'True — that is the core job of the Domain Name System.', true),
      choice('An HTTP 404 response means…', '404 Not Found means the server could not find the requested resource. 500 is a server error; 301 is a permanent redirect.', ['Server error', 'Resource not found', 'Redirect', 'Unauthorized'], [1], { topicTag: 'http' }),
      q({ type: 'fill_blank', text: 'The default port number for HTTPS is _____.', explanation: 'HTTPS runs on port 443 by default (HTTP uses 80).', acceptedAnswers: ['443'], topicTag: 'http' }),
      choice('Which layer of the OSI model handles routing between networks?', 'The Network layer (Layer 3) handles logical addressing and routing, e.g., IP.', ['Data Link', 'Network', 'Transport', 'Session'], [1], { difficulty: 'Intermediate' }),
    ],
  });

  const gk = await makeQuiz({
    title: 'General Knowledge Sprint', creatorId: rohan.id, category: 'General Knowledge', subcategory: 'Geography',
    description: 'A fast mixed bag of geography and world facts. Race the 5-minute timer!',
    tags: ['geography', 'world', 'trivia'], difficulty: 'Beginner', estimatedDuration: 6, timeLimit: 5, state: 'published', daysAgo: 2,
    questions: [
      choice('Which is the longest river in the world?', 'The Nile (about 6,650 km) is generally considered the longest, slightly ahead of the Amazon.', ['Amazon', 'Nile', 'Yangtze', 'Mississippi'], [1]),
      choice('Which of these countries are in South America? (Select all that apply)', 'Peru and Chile are in South America; Mexico is in North America and Spain is in Europe.', ['Peru', 'Mexico', 'Chile', 'Spain'], [0, 2], { type: 'multiple_choice', marks: 2 }),
      tf('Australia is both a country and a continent.', 'True — Australia is the only country that occupies an entire continent.', true),
      q({ type: 'fill_blank', text: 'The capital of Japan is _____.', explanation: 'Tokyo has been Japan\'s capital since 1868.', acceptedAnswers: ['Tokyo'], topicTag: 'capitals' }),
      choice('Mount Everest sits on the border of Nepal and which other country?', 'Everest straddles the Nepal–China (Tibet) border.', ['India', 'Bhutan', 'China', 'Pakistan'], [2]),
    ],
  });

  await makeQuiz({
    title: 'English Grammar Practice', creatorId: maya.id, category: 'English and Grammar',
    description: 'Tenses, articles and subject–verb agreement with a fill-in-the-blank finisher.',
    tags: ['grammar', 'tenses', 'english'], difficulty: 'Beginner', estimatedDuration: 8, state: 'published', daysAgo: 1,
    questions: [
      choice('Choose the correct sentence.', 'With a singular subject ("team" as a unit) the verb is "has". "Their/there/they\'re" errors break the other options.', ['The team have won their match.', 'The team has won its match.', 'The team has won there match.', 'The team have won there match.'], [1]),
      tf('"Its" (without an apostrophe) shows possession.', 'True — "its" is possessive; "it\'s" is a contraction of "it is".', true),
      q({ type: 'fill_blank', text: 'She has been studying English _____ 2019. (Use since or for)', explanation: 'Use "since" with a specific point in time (2019) and "for" with a duration (for five years).', acceptedAnswers: ['since'], topicTag: 'prepositions' }),
      choice('Which word is an adverb?', '"Quickly" modifies a verb, so it is an adverb. "Quick" is an adjective, "quickness" a noun.', ['Quick', 'Quickness', 'Quickly', 'Quicken'], [2]),
    ],
  });

  await makeQuiz({
    title: 'Python Basics for Beginners', creatorId: maya.id, category: 'Programming',
    description: 'Print, variables, lists and loops — your first steps with Python, checked with auto-graded questions.',
    tags: ['python', 'beginners'], difficulty: 'Beginner', estimatedDuration: 10, state: 'pending', daysAgo: 0,
    questions: [
      choice('Which function displays output in Python?', 'print() writes to standard output.', ['echo()', 'print()', 'console.log()', 'output()'], [1]),
      q({ type: 'fill_blank', text: 'In Python, a comment starts with the _____ symbol.', explanation: 'Lines starting with # are comments.', acceptedAnswers: ['#', 'hash', 'pound'] }),
      tf('Python lists are immutable.', 'False — lists are mutable; tuples are the immutable sequence type.', false),
    ],
  });

  await makeQuiz({
    title: 'Operating Systems Concepts', creatorId: maya.id, category: 'Operating Systems',
    description: 'Processes, threads, scheduling and memory management fundamentals.',
    tags: ['os', 'processes', 'scheduling'], difficulty: 'Intermediate', estimatedDuration: 14, state: 'Changes requested', daysAgo: 3,
    questions: [
      choice('Which scheduling algorithm can cause starvation?', 'Shortest Job First can starve long processes if short ones keep arriving.', ['Round Robin', 'FCFS', 'Shortest Job First', 'None of these'], [2]),
      tf('A thread shares the address space of its process.', 'True — threads in a process share code, heap and files, but have private stacks.', true),
      choice('Virtual memory allows a system to…', 'Virtual memory lets processes use more address space than physical RAM via paging to disk.', ['Run without RAM', 'Use disk as an extension of RAM', 'Skip page tables', 'Avoid context switches'], [1]),
    ],
  });

  await makeQuiz({
    title: 'SQL Joins Workshop (Draft)', creatorId: maya.id, category: 'Databases', subcategory: 'SQL',
    description: 'Work in progress draft on INNER, LEFT and FULL joins.',
    tags: ['sql', 'joins'], difficulty: 'Intermediate', estimatedDuration: 12, state: 'draft', daysAgo: 0,
    questions: [
      q({ type: 'single_choice', text: 'An INNER JOIN returns…', explanation: '', options: [opt('Matching rows only'), opt('All rows')], correctOptionIds: [] }),
    ],
  });

  // Arjun's submitted attempts (realistic, scored by the same engine the API uses)
  async function seedAttempt(quizRes: { quiz: any; versionId: string; questions: Question[] }, answers: Record<number, { selected?: number[]; text?: string }>, daysAgo: number, rating?: number) {
    const started = new Date(Date.now() - daysAgo * 86400000);
    const responses = quizRes.questions.map((qq, i) => ({
      questionId: qq.id,
      selectedOptionIds: (answers[i]?.selected || []).map(ix => qq.options[ix]?.id).filter(Boolean),
      textAnswer: answers[i]?.text || '',
    }));
    const scored = scoreAttempt(quizRes.questions, responses as any);
    const attempt: QuizAttempt = {
      id: id(), userId: arjun.id, quizId: quizRes.quiz.id, quizVersionId: quizRes.versionId,
      responses: responses as any, displayedQuestionOrder: quizRes.questions.map(x => x.id),
      displayedOptionOrders: Object.fromEntries(quizRes.questions.map(x => [x.id, x.options.map(o => o.id)])),
      status: 'submitted', ...scored, startedAt: started.toISOString(),
      submittedAt: new Date(started.getTime() + 8 * 60000).toISOString(), timeTaken: 480,
      createdAt: started.toISOString(), updatedAt: started.toISOString(),
    };
    await store.attempts.insert(attempt);
    const quiz = await store.quizzes.byId(quizRes.quiz.id);
    if (quiz) await store.quizzes.update(quiz.id, { attemptsCount: quiz.attemptsCount + 1 });
    if (rating) {
      const t = now();
      await store.ratings.insert({ id: id(), userId: arjun.id, quizId: quizRes.quiz.id, rating, createdAt: t, updatedAt: t });
      await store.quizzes.update(quizRes.quiz.id, { ratingAvg: rating, ratingCount: 1 });
    }
    return attempt;
  }
  await seedAttempt(js as any, { 0: { selected: [1] }, 1: { selected: [0, 2] }, 2: { selected: [1] }, 3: { text: 'filter' }, 4: { selected: [1] }, 5: { text: 'Promises avoid deeply nested callbacks and make error handling cleaner.' } }, 2, 5);
  await seedAttempt(gk as any, { 0: { selected: [1] }, 1: { selected: [0, 2] }, 2: { selected: [0] }, 3: { text: 'tokyo' }, 4: { selected: [2] } }, 1, 4);
  await store.bookmarks.insert({ id: id(), userId: arjun.id, quizId: js.quiz.id, createdAt: t0 });
  console.log('[seed] demo data created (admin / creator / learner accounts — see README)');
}
