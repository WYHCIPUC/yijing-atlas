import { LEARNING_LESSONS } from './learning-curriculum.js';

let sessionSequence = 0;

function createSessionId() {
  return globalThis.crypto?.randomUUID?.() || `assessment-${Date.now()}-${++sessionSequence}`;
}

function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function diversify(questions, count, random) {
  const byLesson = new Map();
  shuffle(questions, random).forEach((item) => {
    if (!byLesson.has(item.lessonId)) byLesson.set(item.lessonId, []);
    byLesson.get(item.lessonId).push(item);
  });
  const picked = [];
  let round = 0;
  const groups = shuffle([...byLesson.values()], random);
  while (picked.length < count && groups.some((group) => group[round])) {
    groups.forEach((group) => {
      if (picked.length < count && group[round]) picked.push(group[round]);
    });
    round += 1;
  }
  return picked;
}

function withShuffledOptions(questions, random) {
  return questions.map((item) => ({ ...item, options: shuffle(item.options, random) }));
}

export function createAssessmentSession(kind, questionBank, options = {}) {
  const random = options.random || Math.random;
  const count = Number.isInteger(options.count) && options.count > 0 ? options.count :
    (kind === 'lesson' ? 3 : kind === 'spot' ? 5 : 10);
  let available = Array.isArray(questionBank) ? questionBank : [];

  if (kind === 'lesson') {
    available = available.filter((item) => item.lessonId === options.lessonId);
  } else if (kind === 'exam') {
    available = available.filter((item) => item.levelId === options.levelId);
  } else if (kind === 'spot') {
    const viewedIds = Object.entries(options.record?.lessons || {})
      .filter(([, value]) => value?.viewedAt)
      .map(([lessonId]) => lessonId);
    available = available.filter((item) => viewedIds.includes(item.lessonId));
  } else {
    return null;
  }

  if (!available.length) return null;
  let requiredQuestion = null;
  if (options.requiredQuestionId !== undefined || options.requiredQuestionVersion !== undefined) {
    if (kind !== 'lesson' || typeof options.requiredQuestionId !== 'string' || !options.requiredQuestionId.trim()) return null;
    requiredQuestion = available.find((item) => item.id === options.requiredQuestionId);
    if (!requiredQuestion || (options.requiredQuestionVersion !== undefined &&
        (typeof options.requiredQuestionVersion !== 'string' || !options.requiredQuestionVersion ||
         requiredQuestion.questionVersion !== options.requiredQuestionVersion))) return null;
  }
  const selected = kind === 'lesson'
    ? shuffle(available, random).slice(0, count)
    : diversify(available, count, random);
  // Keep the usual draw and its size; replace only the final slot when the
  // requested source question was not drawn. Invalid references never fall back.
  if (requiredQuestion && !selected.some((item) => item.id === requiredQuestion.id)) selected[selected.length - 1] = requiredQuestion;
  const levelId = options.levelId || LEARNING_LESSONS.find((lesson) => lesson.id === options.lessonId)?.levelId;
  return {
    id: createSessionId(),
    kind,
    lessonId: options.lessonId || null,
    levelId: levelId || null,
    questions: withShuffledOptions(selected, random),
  };
}

export function gradeAssessment(session, answers) {
  const questions = session?.questions || [];
  if (!session?.id || !questions.length || !answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const questionIds = new Set(questions.map((item) => item.id));
  if (Object.keys(answers).some((id) => !questionIds.has(id)) || questions.some((item) =>
    !Object.hasOwn(answers, item.id) || !item.options.some((option) => option.value === answers[item.id]),
  )) return null;
  const picked = answers;
  const results = questions.map((item) => ({
    questionId: item.id,
    lessonId: item.lessonId,
    picked: picked[item.id] ?? null,
    answer: item.answer,
    correct: picked[item.id] === item.answer,
    ...(['questionVersion', 'targetCode', 'termId'].some((key) => Object.hasOwn(item, key)) ? {
      questionVersion: item.questionVersion,
      questionType: item.kind,
      targetCode: item.targetCode,
      termId: item.termId,
    } : {}),
  }));
  return {
    sessionId: session.id,
    kind: session?.kind,
    lessonId: session?.lessonId || null,
    levelId: session?.levelId || null,
    correct: results.filter((item) => item.correct).length,
    total: results.length,
    results,
  };
}

export function recommendLesson(record, lessons = LEARNING_LESSONS) {
  const unviewed = lessons.find((lesson) => !record?.lessons?.[lesson.id]?.viewedAt);
  if (unviewed) return unviewed;
  return [...lessons].sort((left, right) => {
    const leftScore = record.lessons[left.id]?.bestScore || 0;
    const rightScore = record.lessons[right.id]?.bestScore || 0;
    const scoreDifference = leftScore - rightScore;
    if (scoreDifference) return scoreDifference;
    return String(record.lessons[left.id]?.lastStudiedAt || '')
      .localeCompare(String(record.lessons[right.id]?.lastStudiedAt || ''));
  })[0] || null;
}
