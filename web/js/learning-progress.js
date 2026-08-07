import { isPlainObject, readJson, writeJson } from './storage.js';

const ACTIVITY_KEY = 'yijing-activity-v1';
const MAX_ACTIVITY_DAYS = 400;
const LEARNING_RECORD_KEY = 'yijing-learning-record-v2';
const LEGACY_STUDY_KEY = 'yijing.study.v1';
const MAX_ASSESSMENT_HISTORY = 80;

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isActivity(value) {
  return value && Array.isArray(value.days) && value.days.every(isDateKey);
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

function isLearningRecord(value) {
  return isPlainObject(value) && value.version === 2 && isPlainObject(value.lessons) &&
    Array.isArray(value.spotChecks) && Array.isArray(value.exams) && Array.isArray(value.oralReviews) &&
    Object.values(value.lessons).every((lesson) => isPlainObject(lesson)) &&
    value.spotChecks.every(isAttempt) && value.exams.every(isAttempt) &&
    value.oralReviews.every((review) => isPlainObject(review) && typeof review.at === 'string' &&
      typeof review.lessonId === 'string' && Number.isFinite(review.score));
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
  return readJson(LEARNING_RECORD_KEY, fallback, isLearningRecord, storage);
}

export function saveLearningRecord(record, storage) {
  return writeJson(LEARNING_RECORD_KEY, record, storage).ok;
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
  ).map((result) => ({ lessonId: result.lessonId, correct: result.correct })) : [];
}

export function recordLearningAssessment(kind, assessment, now = new Date(), storage) {
  if (!['lesson', 'spot', 'exam'].includes(kind) || !assessment ||
      !Number.isInteger(assessment.correct) || !Number.isInteger(assessment.total) ||
      assessment.total <= 0 || assessment.correct < 0 || assessment.correct > assessment.total) {
    return { record: loadLearningRecord(storage), saved: false };
  }
  const record = loadLearningRecord(storage);
  const entry = {
    at: now.toISOString(),
    correct: assessment.correct,
    total: assessment.total,
    results: normalizeResults(assessment.results),
  };
  if (kind === 'lesson' && typeof assessment.lessonId === 'string') {
    const previous = record.lessons[assessment.lessonId] || {};
    const bestScore = Math.max(previous.bestScore || 0, assessment.correct / assessment.total);
    record.lessons[assessment.lessonId] = {
      ...previous,
      viewedAt: previous.viewedAt || entry.at,
      lastStudiedAt: entry.at,
      attempts: (previous.attempts || 0) + 1,
      bestScore,
    };
  } else if (kind === 'spot') {
    record.spotChecks = [...record.spotChecks, entry].slice(-MAX_ASSESSMENT_HISTORY);
  } else if (kind === 'exam' && typeof assessment.levelId === 'string') {
    record.exams = [...record.exams, { ...entry, levelId: assessment.levelId }]
      .slice(-MAX_ASSESSMENT_HISTORY);
  } else {
    return { record, saved: false };
  }
  return { record, saved: saveLearningRecord(record, storage) };
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
