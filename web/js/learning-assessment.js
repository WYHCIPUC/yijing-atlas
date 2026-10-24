import { LEARNING_LESSONS } from './learning-curriculum.js';
import { getCourseWeakQuestions, getLearningResumeError, getQuizWeakQuestions } from './learning-progress.js';
import { isReviewCards } from './review-engine.js';

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

// Presentation task only: selecting a recommendation never changes learning data.
export function recommendLearningTask(record, {
  reviewCards = {}, wrongCodes = [], now = Date.now(), lessons = LEARNING_LESSONS,
} = {}) {
  const available = Array.isArray(lessons) ? lessons.filter((lesson) => lesson?.id) : [];
  const order = new Map(available.map((lesson, index) => [lesson.id, index]));
  const resume = record?.resume;
  const invalidResume = resume != null && (getLearningResumeError(resume) || !order.has(resume.lessonId));
  const task = (value) => invalidResume ? {
    ...value, notice: '上次阅读位置已失效，已按当前进度推荐；原有学习成绩仍保留。',
  } : value;
  if (resume && !invalidResume) {
    return task({ type: 'resume', subject: resume.lessonId, resume: { ...resume },
      reason: '这门课程已开始，尚未完成本轮小试；继续上次阅读位置。' });
  }

  const timestamp = now instanceof Date ? now.getTime() : now;
  const due = Object.entries(reviewCards || {}).filter(([code, card]) =>
    isReviewCards({ [code]: card }) && (card.reps > 0 || Number.isFinite(card.introducedAt)) &&
    Number.isFinite(timestamp) && card.due <= timestamp,
  ).map(([, card]) => card).sort((a, b) => a.due - b.due || a.code.localeCompare(b.code));
  if (due.length) {
    return task({ type: 'review', subject: due[0].code, count: due.length,
      reason: `有${due.length}项卦卡已到复习时间，先温故再学新课。` });
  }

  const courseWeak = getCourseWeakQuestions(record).filter((entry) => order.has(entry.lessonId))
    .sort((a, b) => Date.parse(b.lastWrongAt) - Date.parse(a.lastWrongAt) ||
      order.get(a.lessonId) - order.get(b.lessonId) || a.questionId.localeCompare(b.questionId));
  // Stable sorting retains the existing course order for equal timestamps,
  // followed by the quiz query's deterministic question-ID order.
  const quizWeak = getQuizWeakQuestions(record);
  const weak = [...courseWeak, ...quizWeak]
    .sort((a, b) => Date.parse(b.lastWrongAt) - Date.parse(a.lastWrongAt));
  if (weak.length) {
    return task({ type: weak[0].sourceKind === 'course' ? 'course-weak' : 'quiz-question',
      subject: weak[0].questionId, question: { ...weak[0] }, count: weak.length,
      reason: `有${weak.length}项${quizWeak.length ? '' : '课程'}薄弱题待回练，先检验最近答错的知识点。` });
  }
  // The legacy wrong book contains codes, not original question IDs or dates.
  const codes = [...new Set((Array.isArray(wrongCodes) ? wrongCodes : [])
    .filter((code) => typeof code === 'string' && /^[01]{6}$/.test(code)))].sort();
  if (codes.length) {
    return task({ type: 'quiz-weak', subject: codes[0], count: codes.length,
      reason: `有${codes.length}卦的测验错题待温习；进入错题模式重新练习。` });
  }

  const unviewed = available.find((lesson) => !record?.lessons?.[lesson.id]?.viewedAt);
  if (unviewed) {
    return task({ type: 'lesson', subject: unviewed.id, reason: '目前没有待续课程或待练任务，按课程序学习下一课。' });
  }
  const studiedAt = (lesson) => {
    const progress = record?.lessons?.[lesson.id];
    const date = Date.parse(progress?.lastStudiedAt || progress?.viewedAt || '');
    return Number.isFinite(date) ? date : 0;
  };
  const recent = [...available].sort((a, b) => studiedAt(b) - studiedAt(a) || order.get(a.id) - order.get(b.id))[0];
  if (recent) {
    return task({ type: 'oral', subject: recent.id, reason: '已浏览全部课程，试着复讲最近学习的一课，检验能否说清依据。' });
  }
  return task({ type: 'empty', subject: null, reason: '当前没有可用课程或待练任务。' });
}
