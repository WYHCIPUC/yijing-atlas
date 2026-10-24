import { getLesson } from './learning-curriculum.js';
import { isPlainObject, readJson, writeJson } from './storage.js';

const ACTIVITY_KEY = 'yijing-activity-v1';
const MAX_ACTIVITY_DAYS = 400;
const LEARNING_RECORD_KEY = 'yijing-learning-record-v2';
const LEGACY_STUDY_KEY = 'yijing.study.v1';
const MAX_ASSESSMENT_HISTORY = 80;
const COURSE_QUESTION_VERSION = 'curriculum-v1';
const QUESTION_METADATA_FIELDS = ['questionVersion', 'questionType', 'targetCode', 'termId'];

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isActivity(value) {
  return isPlainObject(value) && Array.isArray(value.days) && value.days.every(isDateKey);
}

export function loadActivity(storage) {
  const activity = readJson(ACTIVITY_KEY, { days: [] }, isActivity, storage);
  return { days: [...new Set(activity.days)].sort() };
}

export function recordActivity(now = new Date(), storage) {
  const activity = loadActivity(storage);
  const today = localDateKey(now);
  const days = [...new Set([...activity.days, today])].sort().slice(-MAX_ACTIVITY_DAYS);
  const result = writeJson(ACTIVITY_KEY, { days }, storage);
  return { days, saved: result.ok };
}

export function calculateStreak(days, now = new Date()) {
  const available = new Set((Array.isArray(days) ? days : []).filter(isDateKey));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!available.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (available.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getActivityKey() {
  return ACTIVITY_KEY;
}

function emptyLearningRecord() {
  return {
    version: 2,
    lessons: {},
    spotChecks: [],
    exams: [],
    oralReviews: [],
  };
}

function isAttempt(value) {
  return isPlainObject(value) && typeof value.at === 'string' &&
    Number.isInteger(value.correct) && Number.isInteger(value.total) &&
    value.correct >= 0 && value.total > 0 && value.correct <= value.total;
}

function isSessionReceipt(value) {
  return isPlainObject(value) && typeof value.sessionId === 'string' && Boolean(value.sessionId) &&
    ['lesson', 'spot', 'exam'].includes(value.kind) && isAttempt(value) &&
    (value.kind !== 'lesson' || typeof value.lessonId === 'string');
}

function isAssessmentId(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 120;
}

export function getAssessmentIdsError(value) {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return 'processedAssessmentIds';
  const seen = new Set();
  for (let index = 0; index < value.length; index += 1) {
    if (!isAssessmentId(value[index]) || seen.has(value[index])) return `processedAssessmentIds[${index}]`;
    seen.add(value[index]);
  }
  return null;
}

function isReferenceId(value, maxLength = Infinity) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isIsoTime(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value));
}

function getQuestionReferenceError(value) {
  if (!isReferenceId(value.questionId, 160)) return 'questionId';
  if (!isReferenceId(value.questionVersion, 120)) return 'questionVersion';
  if (!['course', 'quiz', 'almanac'].includes(value.sourceKind)) return 'sourceKind';
  if (value.lessonId !== null && !isReferenceId(value.lessonId)) return 'lessonId';
  if (value.sourceKind === 'course' && value.lessonId === null) return 'lessonId';
  if (!isReferenceId(value.questionType)) return 'questionType';
  if (value.questionVersion === COURSE_QUESTION_VERSION && value.sourceKind === 'course' &&
      !['recall', 'evidence'].includes(value.questionType)) return 'questionType';
  if (value.sourceKind === 'quiz' && !['opposite', 'reversed', 'interlocking', 'name'].includes(value.questionType)) return 'questionType';
  if (value.targetCode !== null && (typeof value.targetCode !== 'string' || !/^[01]{6}$/.test(value.targetCode))) return 'targetCode';
  if (value.sourceKind === 'quiz' && value.targetCode === null) return 'targetCode';
  if (value.termId !== null && !isReferenceId(value.termId)) return 'termId';
  if (value.sourceKind === 'almanac' && value.termId === null) return 'termId';
  return null;
}

export function getWeakQuestionsError(value) {
  if (value === undefined) return null;
  if (!isPlainObject(value)) return 'weakQuestions';
  for (const [questionId, entry] of Object.entries(value)) {
    const path = `weakQuestions[${questionId}]`;
    if (!isPlainObject(entry)) return path;
    if (entry.questionId !== questionId) return `${path}.questionId`;
    const referenceError = getQuestionReferenceError(entry);
    if (referenceError) return `${path}.${referenceError}`;
    if (!isIsoTime(entry.firstWrongAt)) return `${path}.firstWrongAt`;
    if (!isIsoTime(entry.lastWrongAt)) return `${path}.lastWrongAt`;
    if (!isAssessmentId(entry.lastSessionId)) return `${path}.lastSessionId`;
    if (!Number.isSafeInteger(entry.wrongCount) || entry.wrongCount <= 0) return `${path}.wrongCount`;
    if (!['due', 'reviewed', 'resolved'].includes(entry.status)) return `${path}.status`;
    if (entry.lastReviewedAt !== null && !isIsoTime(entry.lastReviewedAt)) return `${path}.lastReviewedAt`;
    if (entry.resolvedAt !== null && !isIsoTime(entry.resolvedAt)) return `${path}.resolvedAt`;
    if (entry.status === 'resolved' && entry.resolvedAt === null) return `${path}.resolvedAt`;
  }
  return null;
}

export function getCourseWeakQuestions(record, { includeResolved = false } = {}) {
  const weakQuestions = record?.weakQuestions;
  if (!weakQuestions || getWeakQuestionsError(weakQuestions)) return [];
  return Object.values(weakQuestions)
    .filter((entry) => entry.sourceKind === 'course' && (includeResolved || entry.status !== 'resolved'))
    .map((entry) => ({ ...entry }))
    .sort((a, b) => Date.parse(b.lastWrongAt) - Date.parse(a.lastWrongAt) ||
      (a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0));
}

function isLearningRecordBase(value) {
  return isPlainObject(value) && value.version === 2 && isPlainObject(value.lessons) &&
    Array.isArray(value.spotChecks) && Array.isArray(value.exams) && Array.isArray(value.oralReviews) &&
    Object.values(value.lessons).every((lesson) => isPlainObject(lesson)) &&
    (value.assessmentSessions === undefined ||
      (Array.isArray(value.assessmentSessions) && value.assessmentSessions.every(isSessionReceipt))) &&
    value.spotChecks.every(isAttempt) && value.exams.every(isAttempt) &&
    value.oralReviews.every((review) => isPlainObject(review) && typeof review.at === 'string' &&
      typeof review.lessonId === 'string' && Number.isFinite(review.score));
}

export function isLearningRecord(value) {
  return isLearningRecordBase(value) && getAssessmentIdsError(value.processedAssessmentIds) === null &&
    getWeakQuestionsError(value.weakQuestions) === null;
}

function migrateLegacyRecord(storage) {
  const legacy = readJson(
    LEGACY_STUDY_KEY,
    {},
    (value) => isPlainObject(value) && Object.values(value).every((done) => typeof done === 'boolean'),
    storage,
  );
  const viewedAt = new Date(0).toISOString();
  const lessons = Object.fromEntries(
    Object.entries(legacy).filter(([, done]) => done).map(([lessonId]) => [lessonId, { viewedAt }]),
  );
  return { ...emptyLearningRecord(), lessons };
}

export function loadLearningRecord(storage) {
  const fallback = migrateLegacyRecord(storage);
  const record = readJson(LEARNING_RECORD_KEY, fallback, isLearningRecordBase, storage);
  // 损坏的新增字段仍保留原成绩供阅读，写入口会拒绝，不能空回退后覆盖它。
  if (getAssessmentIdsError(record.processedAssessmentIds) || getWeakQuestionsError(record.weakQuestions)) return record;
  const receiptIds = (record.assessmentSessions || []).map((item) => item.sessionId).filter(isAssessmentId);
  if (!receiptIds.length) return record;
  return { ...record, processedAssessmentIds: [...new Set([...(record.processedAssessmentIds || []), ...receiptIds])] };
}

export function saveLearningRecord(record, storage) {
  return isLearningRecord(record) && writeJson(LEARNING_RECORD_KEY, record, storage).ok;
}

export function markLessonViewed(lessonId, now = new Date(), storage) {
  if (typeof lessonId !== 'string' || !lessonId) return { record: loadLearningRecord(storage), saved: false };
  const record = loadLearningRecord(storage);
  record.lessons[lessonId] = {
    ...record.lessons[lessonId],
    viewedAt: record.lessons[lessonId]?.viewedAt || now.toISOString(),
    lastStudiedAt: now.toISOString(),
  };
  return { record, saved: saveLearningRecord(record, storage) };
}

function normalizeResults(results) {
  return Array.isArray(results) ? results.filter((result) =>
    typeof result?.lessonId === 'string' && typeof result?.correct === 'boolean',
  ).map((result) => ({
    lessonId: result.lessonId,
    correct: result.correct,
    ...(typeof result.questionId === 'string' ? { questionId: result.questionId } : {}),
    ...(hasQuestionMetadata(result) ? {
      questionVersion: result.questionVersion, questionType: result.questionType,
      targetCode: result.targetCode, termId: result.termId,
    } : {}),
  })) : [];
}

function hasQuestionMetadata(result) {
  return isPlainObject(result) && QUESTION_METADATA_FIELDS.some((field) => Object.hasOwn(result, field));
}

function hasValidCourseReferences(kind, assessment) {
  const seen = new Map();
  return !Array.isArray(assessment.results) || assessment.results.every((result) => {
    if (!hasQuestionMetadata(result)) return true;
    if (!isAssessmentId(assessment.sessionId) || typeof result.correct !== 'boolean' ||
        result.questionVersion !== COURSE_QUESTION_VERSION ||
        getQuestionReferenceError({ ...result, sourceKind: 'course' }) || !getLesson(result.lessonId) ||
        (kind === 'lesson' && result.lessonId !== assessment.lessonId)) return false;
    const previous = seen.get(result.questionId);
    if (previous && ['lessonId', 'correct', ...QUESTION_METADATA_FIELDS]
      .some((field) => previous[field] !== result[field])) return false;
    seen.set(result.questionId, result);
    return true;
  });
}

function updateCourseWeakQuestions(record, results, sessionId, at) {
  for (const result of results) {
    if (!hasQuestionMetadata(result)) continue;
    const reference = {
      questionId: result.questionId, questionVersion: result.questionVersion, sourceKind: 'course',
      lessonId: result.lessonId, questionType: result.questionType,
      targetCode: result.targetCode, termId: result.termId,
    };
    const previous = record.weakQuestions && Object.hasOwn(record.weakQuestions, result.questionId)
      ? record.weakQuestions[result.questionId] : null;
    // 同 ID 的旧版本或不同来源保留原证据，不能用新题意覆盖或纠正。
    if (previous && (previous.lastSessionId === sessionId ||
        Object.entries(reference).some(([key, value]) => previous[key] !== value))) continue;
    if (result.correct && !previous) continue;
    const next = result.correct ? {
      ...previous, status: 'resolved', lastSessionId: sessionId, lastReviewedAt: at, resolvedAt: at,
    } : {
      ...reference, firstWrongAt: previous?.firstWrongAt || at, lastWrongAt: at,
      lastSessionId: sessionId, wrongCount: (previous?.wrongCount || 0) + 1,
      status: 'due', lastReviewedAt: previous?.lastReviewedAt || null, resolvedAt: null,
    };
    record.weakQuestions = { ...record.weakQuestions, [result.questionId]: next };
  }
}

export function recordLearningAssessment(kind, assessment, now = new Date(), storage) {
  if (!['lesson', 'spot', 'exam'].includes(kind) || !assessment ||
      !Number.isInteger(assessment.correct) || !Number.isInteger(assessment.total) ||
      assessment.total <= 0 || assessment.correct < 0 || assessment.correct > assessment.total ||
      (assessment.sessionId !== undefined && !isAssessmentId(assessment.sessionId)) ||
      (assessment.kind !== undefined && assessment.kind !== kind)) {
    return { record: loadLearningRecord(storage), saved: false };
  }
  const record = loadLearningRecord(storage);
  if (!isLearningRecord(record)) return { record, saved: false };
  const receipt = assessment.sessionId && record.assessmentSessions?.find((item) => item.sessionId === assessment.sessionId);
  if (assessment.sessionId && record.processedAssessmentIds?.includes(assessment.sessionId)) {
    const matches = receipt && receipt.kind === kind && (kind !== 'lesson' || receipt.lessonId === assessment.lessonId);
    return { record, saved: true, duplicate: true, entry: matches ? receipt : null, evidenceMissing: !matches };
  }
  if (!hasValidCourseReferences(kind, assessment)) return { record, saved: false };
  const entry = {
    at: now.toISOString(),
    correct: assessment.correct,
    total: assessment.total,
    results: normalizeResults(assessment.results),
    ...(assessment.sessionId ? { sessionId: assessment.sessionId } : {}),
  };
  if (kind === 'lesson' && typeof assessment.lessonId === 'string') {
    const previous = record.lessons[assessment.lessonId] || {};
    const bestScore = Math.max(previous.bestScore || 0, assessment.correct / assessment.total);
    const hasSessions = record.assessmentSessions?.some((item) => item.kind === 'lesson' && item.lessonId === assessment.lessonId);
    const hasMissingEvidence = record.processedAssessmentIds?.some((id) => !record.assessmentSessions?.some((item) => item.sessionId === id));
    const legacyAssessment = assessment.sessionId && !hasSessions && !hasMissingEvidence && previous.attempts > 0 &&
      Number.isFinite(previous.bestScore) && (previous.lastStudiedAt || previous.viewedAt)
      ? { score: previous.bestScore, at: previous.lastStudiedAt || previous.viewedAt }
      : previous.legacyAssessment;
    record.lessons[assessment.lessonId] = {
      ...previous,
      viewedAt: previous.viewedAt || entry.at,
      lastStudiedAt: entry.at,
      attempts: (previous.attempts || 0) + 1,
      bestScore,
      ...(legacyAssessment ? { legacyAssessment } : {}),
    };
  } else if (kind === 'spot') {
    record.spotChecks = [...record.spotChecks, entry].slice(-MAX_ASSESSMENT_HISTORY);
  } else if (kind === 'exam' && typeof assessment.levelId === 'string') {
    record.exams = [...record.exams, { ...entry, levelId: assessment.levelId }]
      .slice(-MAX_ASSESSMENT_HISTORY);
  } else {
    return { record, saved: false };
  }
  if (assessment.sessionId) {
    record.processedAssessmentIds = [...(record.processedAssessmentIds || []), assessment.sessionId];
    record.assessmentSessions = [...(record.assessmentSessions || []), {
      sessionId: assessment.sessionId, kind, at: entry.at,
      correct: entry.correct, total: entry.total,
      ...(kind === 'lesson' ? { lessonId: assessment.lessonId } : {}),
    }];
    updateCourseWeakQuestions(record, entry.results, assessment.sessionId, entry.at);
  }
  return { record, saved: saveLearningRecord(record, storage), duplicate: false, entry };
}

export function recordOralReview(lessonId, score, mode, now = new Date(), storage) {
  if (typeof lessonId !== 'string' || !Number.isFinite(score) || score < 0 || score > 100 ||
      !['ai', 'self'].includes(mode)) {
    return { record: loadLearningRecord(storage), saved: false };
  }
  const record = loadLearningRecord(storage);
  record.oralReviews = [...record.oralReviews, {
    lessonId,
    score: Math.round(score),
    mode,
    at: now.toISOString(),
  }].slice(-MAX_ASSESSMENT_HISTORY);
  return { record, saved: saveLearningRecord(record, storage) };
}

function resultAccuracy(entries, lessonId) {
  const results = entries.flatMap((entry) => entry.results || [])
    .filter((result) => result.lessonId === lessonId);
  if (!results.length) return 0;
  return results.filter((result) => result.correct).length / results.length;
}

export function calculateLessonMastery(record, lessonId) {
  const lesson = record?.lessons?.[lessonId] || {};
  const viewed = lesson.viewedAt ? 10 : 0;
  const quiz = Math.max(0, Math.min(1, lesson.bestScore || 0)) * 35;
  const spot = resultAccuracy(record?.spotChecks || [], lessonId) * 20;
  const exam = resultAccuracy(record?.exams || [], lessonId) * 20;
  const oralScores = (record?.oralReviews || []).filter((item) => item.lessonId === lessonId)
    .map((item) => item.score);
  const oral = (oralScores.length ? Math.max(...oralScores) / 100 : 0) * 15;
  return Math.round(viewed + quiz + spot + exam + oral);
}

export function getLearningRank(mastery) {
  if (mastery >= 80) return { id: 'tongda', label: '通达', hint: '能综合辨析并迁移应用' };
  if (mastery >= 60) return { id: 'mingbian', label: '明辨', hint: '核心概念已较稳定' };
  if (mastery >= 40) return { id: 'xidu', label: '习读', hint: '正在形成知识关联' };
  if (mastery >= 20) return { id: 'mengxue', label: '蒙学', hint: '已开始建立基础印象' };
  return { id: 'chuwen', label: '初闻', hint: '从一课日课开始' };
}

export function summarizeLearning(record, lessons) {
  const list = Array.isArray(lessons) ? lessons : [];
  const masteryByLesson = Object.fromEntries(list.map((lesson) => [
    lesson.id,
    calculateLessonMastery(record, lesson.id),
  ]));
  const viewed = list.filter((lesson) => record?.lessons?.[lesson.id]?.viewedAt).length;
  const checked = list.filter((lesson) => (record?.lessons?.[lesson.id]?.attempts || 0) > 0).length;
  const mastery = list.length
    ? Math.round(Object.values(masteryByLesson).reduce((sum, value) => sum + value, 0) / list.length)
    : 0;
  return {
    total: list.length,
    viewed,
    checked,
    mastery,
    rank: getLearningRank(mastery),
    masteryByLesson,
  };
}

export function getLearningRecordKey() {
  return LEARNING_RECORD_KEY;
}
