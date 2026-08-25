import {
  ABILITY_DIMENSIONS,
  ACHIEVEMENT_CATALOG,
  GROWTH_RANKS,
} from './achievement-catalog.js';
import { isPlainObject } from './storage.js';

export const ACHIEVEMENT_STATE_VERSION = 1;

const EVENT_TYPES = new Set([
  'lesson.completed',
  'lesson.assessed',
  'review.completed',
  'quiz.recovered',
  'hexagram.read',
  'relation.examined',
  'divination.analysis.submitted',
  'divination.analysis.revised',
  'boundary.acknowledged',
]);
const EVENT_OUTCOMES = new Set(['completed', 'passed', 'failed', 'recovered']);
const METADATA_KEYS = new Set([
  'source',
  'topic',
  'assessmentType',
  'deep',
  'hexagramCode',
  'relationType',
  'reviewKind',
  'cited',
  'boundaryAcknowledged',
  'totalScore',
  'changingLinesCorrect',
  'dimensions',
  'examPart',
]);
const EVENT_KEYS = new Set([
  'type',
  'subjectId',
  'score',
  'outcome',
  'occurredAt',
  'idempotencyKey',
  'metadata',
]);
const ANALYSIS_DIMENSIONS = ['identification', 'imagery', 'citation', 'reasoning', 'boundary'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unique(values) {
  return [...new Set(values)];
}

function emptyMetrics() {
  return {
    completedLessons: [],
    lessonScores: {},
    topicScores: {},
    trigramRounds: [],
    hexagramsRead: [],
    relationsExamined: [],
    reviewDays: [],
    reviewedHexagrams: [],
    quizRecoveries: [],
    sequenceExams: [],
    analyses: {},
    boundedSubjects: [],
    comprehensivePassed: false,
  };
}

export function createAchievementState() {
  return {
    version: ACHIEVEMENT_STATE_VERSION,
    processedKeys: [],
    metrics: emptyMetrics(),
    achievements: {},
  };
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAnalysis(value) {
  return isPlainObject(value) && typeof value.subjectId === 'string' &&
    typeof value.occurredAt === 'string' && !Number.isNaN(Date.parse(value.occurredAt)) &&
    Number.isFinite(value.totalScore) &&
    value.totalScore >= 0 && value.totalScore <= 100 &&
    typeof value.changingLinesCorrect === 'boolean' && typeof value.cited === 'boolean' &&
    typeof value.bounded === 'boolean' && isPlainObject(value.dimensions) &&
    Object.keys(value.dimensions).every((id) => ANALYSIS_DIMENSIONS.includes(id)) &&
    ANALYSIS_DIMENSIONS.every((id) => Number.isFinite(value.dimensions[id]) &&
      value.dimensions[id] >= 0 && value.dimensions[id] <= 20);
}

function isScoreMap(value) {
  return isPlainObject(value) && Object.values(value).every((score) =>
    Number.isFinite(score) && score >= 0 && score <= 1,
  );
}

function isAchievementEntry(id, entry) {
  return ACHIEVEMENT_CATALOG.some((achievement) => achievement.id === id) &&
    isPlainObject(entry) && typeof entry.unlockedAt === 'string' && !Number.isNaN(Date.parse(entry.unlockedAt)) &&
    isPlainObject(entry.evidence) && Object.keys(entry.evidence).every((key) => ['current', 'target'].includes(key)) &&
    Number.isFinite(entry.evidence.current) && Number.isFinite(entry.evidence.target) &&
    entry.evidence.current >= entry.evidence.target && entry.evidence.target > 0;
}

export function isAchievementState(value) {
  if (!isPlainObject(value) || value.version !== ACHIEVEMENT_STATE_VERSION ||
      !isStringArray(value.processedKeys) || !isPlainObject(value.metrics) ||
      !isPlainObject(value.achievements)) return false;
  const metrics = value.metrics;
  const arrays = [
    metrics.completedLessons,
    metrics.trigramRounds,
    metrics.hexagramsRead,
    metrics.relationsExamined,
    metrics.reviewDays,
    metrics.reviewedHexagrams,
    metrics.quizRecoveries,
    metrics.sequenceExams,
    metrics.boundedSubjects,
  ];
  if (!arrays.every(isStringArray) || !isScoreMap(metrics.lessonScores) || !isScoreMap(metrics.topicScores) ||
      !isPlainObject(metrics.analyses) || !Object.values(metrics.analyses).every(isAnalysis) ||
      typeof metrics.comprehensivePassed !== 'boolean') return false;
  return Object.entries(value.achievements).every(([id, entry]) => isAchievementEntry(id, entry));
}

function normalizeDate(source) {
  const date = source instanceof Date ? source : new Date(source);
  if (Number.isNaN(date.getTime())) throw new TypeError('进度事件时间无效');
  return date.toISOString();
}

function validateMetadata(metadata) {
  if (metadata === undefined) return true;
  if (!isPlainObject(metadata) || Object.keys(metadata).some((key) => !METADATA_KEYS.has(key))) return false;
  const stringKeys = ['source', 'topic', 'assessmentType', 'relationType', 'reviewKind'];
  if (stringKeys.some((key) => metadata[key] !== undefined &&
      (typeof metadata[key] !== 'string' || !metadata[key] || metadata[key].length > 160))) return false;
  const booleanKeys = ['deep', 'cited', 'boundaryAcknowledged', 'changingLinesCorrect'];
  if (booleanKeys.some((key) => metadata[key] !== undefined && typeof metadata[key] !== 'boolean')) return false;
  if (metadata.hexagramCode !== undefined && !/^[01]{6}$/.test(metadata.hexagramCode)) return false;
  if (metadata.examPart !== undefined && !['upper', 'lower'].includes(metadata.examPart)) return false;
  if (metadata.totalScore !== undefined &&
      (!Number.isFinite(metadata.totalScore) || metadata.totalScore < 0 || metadata.totalScore > 100)) return false;
  if (metadata.dimensions !== undefined) {
    if (!isPlainObject(metadata.dimensions) || Object.keys(metadata.dimensions).some((key) => !ANALYSIS_DIMENSIONS.includes(key)) ||
        !ANALYSIS_DIMENSIONS.every((id) => Number.isFinite(metadata.dimensions[id]) &&
          metadata.dimensions[id] >= 0 && metadata.dimensions[id] <= 20)) return false;
  }
  return true;
}

export function isProgressEvent(event) {
  if (!isPlainObject(event) || Object.keys(event).some((key) => !EVENT_KEYS.has(key)) || !EVENT_TYPES.has(event.type) ||
      typeof event.subjectId !== 'string' || !event.subjectId || event.subjectId.length > 128 ||
      typeof event.idempotencyKey !== 'string' || !event.idempotencyKey || event.idempotencyKey.length > 240 ||
      typeof event.occurredAt !== 'string' || Number.isNaN(Date.parse(event.occurredAt)) ||
      (event.score !== undefined && (!Number.isFinite(event.score) || event.score < 0 || event.score > 1)) ||
      (event.outcome !== undefined && !EVENT_OUTCOMES.has(event.outcome)) ||
      !validateMetadata(event.metadata)) return false;
  if (event.type === 'lesson.assessed' && !Number.isFinite(event.score)) return false;
  if (event.type.startsWith('divination.analysis.')) {
    return Number.isFinite(event.metadata?.totalScore) && event.metadata.totalScore >= 0 &&
      event.metadata.totalScore <= 100 && isPlainObject(event.metadata.dimensions);
  }
  return true;
}

export function createProgressEvent(input, options = {}) {
  const now = options.now || (() => new Date());
  const occurredAt = input?.occurredAt ? normalizeDate(input.occurredAt) : normalizeDate(now());
  let generatedKey = input?.idempotencyKey;
  if (!generatedKey) {
    const random = options.random || Math.random;
    const randomValue = Number(random());
    if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
      throw new TypeError('随机源必须返回大于等于 0 且小于 1 的数');
    }
    generatedKey = `${input?.type}:${input?.subjectId}:${occurredAt}:${randomValue.toString(36).slice(2, 10)}`;
  }
  const event = {
    ...input,
    occurredAt,
    idempotencyKey: input?.idempotencyKey || generatedKey,
    metadata: input?.metadata ? clone(input.metadata) : {},
  };
  if (!isProgressEvent(event)) throw new TypeError('进度事件格式无效');
  return event;
}

function addUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

function updateMetrics(metrics, event) {
  const metadata = event.metadata || {};
  if (event.type === 'lesson.completed') {
    addUnique(metrics.completedLessons, event.subjectId);
  } else if (event.type === 'lesson.assessed') {
    metrics.lessonScores[event.subjectId] = Math.max(metrics.lessonScores[event.subjectId] || 0, event.score);
    if (metadata.topic) {
      metrics.topicScores[metadata.topic] = Math.max(metrics.topicScores[metadata.topic] || 0, event.score);
    }
    if (metadata.topic === 'eight-trigrams' && event.score >= 0.8) addUnique(metrics.trigramRounds, event.idempotencyKey);
    if (metadata.assessmentType === 'sequence-exam' && event.outcome === 'passed' &&
        ['upper', 'lower'].includes(metadata.examPart)) addUnique(metrics.sequenceExams, metadata.examPart);
    if (metadata.assessmentType === 'comprehensive-exam' && event.outcome === 'passed') {
      metrics.comprehensivePassed = true;
    }
  } else if (event.type === 'review.completed') {
    addUnique(metrics.reviewDays, event.occurredAt.slice(0, 10));
    if (/^[01]{6}$/.test(metadata.hexagramCode || event.subjectId)) {
      addUnique(metrics.reviewedHexagrams, metadata.hexagramCode || event.subjectId);
    }
  } else if (event.type === 'quiz.recovered') {
    addUnique(metrics.quizRecoveries, event.subjectId);
  } else if (event.type === 'hexagram.read') {
    if (metadata.deep === true && /^[01]{6}$/.test(event.subjectId)) addUnique(metrics.hexagramsRead, event.subjectId);
  } else if (event.type === 'relation.examined') {
    addUnique(metrics.relationsExamined, event.subjectId);
  } else if (event.type.startsWith('divination.analysis.')) {
    const previous = metrics.analyses[event.subjectId];
    const candidate = {
      subjectId: event.subjectId,
      occurredAt: event.occurredAt,
      totalScore: metadata.totalScore,
      changingLinesCorrect: metadata.changingLinesCorrect === true,
      cited: metadata.cited === true,
      bounded: metadata.boundaryAcknowledged === true,
      dimensions: clone(metadata.dimensions),
    };
    if (!previous || candidate.totalScore >= previous.totalScore) metrics.analyses[event.subjectId] = candidate;
  } else if (event.type === 'boundary.acknowledged') {
    addUnique(metrics.boundedSubjects, event.subjectId);
  }
}

function spacedReviewCount(days) {
  const sorted = unique(days).sort();
  let best = 0;
  for (let start = 0; start < sorted.length; start += 1) {
    const startTime = Date.parse(`${sorted[start]}T00:00:00.000Z`);
    const count = sorted.slice(start).filter((day) =>
      Date.parse(`${day}T00:00:00.000Z`) - startTime <= 6 * 86400000,
    ).length;
    best = Math.max(best, count);
  }
  return best;
}

function achievementValue(id, metrics) {
  const analyses = Object.values(metrics.analyses);
  const bounded = unique([
    ...metrics.boundedSubjects,
    ...analyses.filter((analysis) => analysis.bounded).map((analysis) => analysis.subjectId),
  ]).length;
  const values = {
    'first-lesson': metrics.completedLessons.includes('l1-1') && (metrics.lessonScores['l1-1'] || 0) >= 0.6 ? 1 : 0,
    'yin-yang': Math.round((metrics.topicScores['yin-yang'] || 0) * 100),
    'eight-trigrams': metrics.trigramRounds.length,
    'star-path': metrics.relationsExamined.length ? metrics.hexagramsRead.length : 0,
    sequence: metrics.sequenceExams.length,
    'spaced-review': spacedReviewCount(metrics.reviewDays),
    'error-recovery': metrics.quizRecoveries.length,
    'changing-lines': analyses.filter((analysis) => analysis.changingLinesCorrect).length,
    'cited-reading': analyses.filter((analysis) => analysis.cited).length,
    'reasoned-reading': analyses.filter((analysis) => analysis.totalScore >= 75).length,
    'bounded-reading': bounded,
    'complete-atlas': metrics.comprehensivePassed && metrics.reviewedHexagrams.length >= 64
      ? metrics.hexagramsRead.length : 0,
  };
  return values[id] || 0;
}

function unlockAchievements(state, unlockedAt) {
  const unlocked = [];
  for (const achievement of ACHIEVEMENT_CATALOG) {
    const current = achievementValue(achievement.id, state.metrics);
    if (!state.achievements[achievement.id] && current >= achievement.target) {
      state.achievements[achievement.id] = {
        unlockedAt,
        evidence: { current, target: achievement.target },
      };
      unlocked.push(achievement);
    }
  }
  return unlocked;
}

export function applyProgressEvent(currentState, event, options = {}) {
  if (!isProgressEvent(event)) throw new TypeError('进度事件格式无效');
  const state = isAchievementState(currentState) ? clone(currentState) : createAchievementState();
  if (state.processedKeys.includes(event.idempotencyKey)) {
    return { state, accepted: false, duplicate: true, unlocked: [] };
  }
  state.processedKeys.push(event.idempotencyKey);
  updateMetrics(state.metrics, event);
  const now = options.now || (() => new Date());
  const unlocked = unlockAchievements(state, normalizeDate(now()));
  return { state, accepted: true, duplicate: false, unlocked };
}

export function applyProgressEvents(currentState, events, options = {}) {
  let state = isAchievementState(currentState) ? clone(currentState) : createAchievementState();
  const unlocked = [];
  let accepted = 0;
  for (const event of Array.isArray(events) ? events : []) {
    if (!isProgressEvent(event)) continue;
    const result = applyProgressEvent(state, event, options);
    state = result.state;
    if (result.accepted) accepted += 1;
    unlocked.push(...result.unlocked);
  }
  return { state, accepted, unlocked };
}

function averageDimension(analyses, id) {
  if (!analyses.length) return 0;
  return analyses.reduce((sum, analysis) => sum + analysis.dimensions[id], 0) / analyses.length * 5;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateAbilities(state) {
  const metrics = isAchievementState(state) ? state.metrics : emptyMetrics();
  const analyses = Object.values(metrics.analyses);
  const passedLessons = Object.values(metrics.lessonScores).filter((score) => score >= 0.8).length;
  const reasoned = analyses.filter((analysis) => analysis.totalScore >= 75).length;
  const bounded = unique([...metrics.boundedSubjects, ...analyses.filter((item) => item.bounded).map((item) => item.subjectId)]).length;
  const eventScores = {
    recognition: passedLessons * 4 + metrics.trigramRounds.length * 10 + metrics.hexagramsRead.length * 0.8,
    classics: passedLessons * 4 + metrics.hexagramsRead.length * 0.5 + analyses.filter((item) => item.cited).length * 10,
    change: metrics.relationsExamined.length * 4 + analyses.filter((item) => item.changingLinesCorrect).length * 14,
    discernment: metrics.quizRecoveries.length * 4 + reasoned * 10 + bounded * 6,
    expression: 0,
  };
  const analysisMap = {
    recognition: 'identification',
    classics: 'citation',
    change: 'imagery',
    discernment: 'boundary',
    expression: 'reasoning',
  };
  return Object.fromEntries(ABILITY_DIMENSIONS.map((dimension) => [
    dimension.id,
    clampScore(Math.max(eventScores[dimension.id], averageDimension(analyses, analysisMap[dimension.id]))),
  ]));
}

export function summarizeAchievements(state) {
  const safeState = isAchievementState(state) ? state : createAchievementState();
  const abilities = calculateAbilities(safeState);
  const abilityAverage = Math.round(Object.values(abilities).reduce((sum, score) => sum + score, 0) / ABILITY_DIMENSIONS.length);
  const unlockedCount = Object.keys(safeState.achievements).length;
  const analyses = Object.keys(safeState.metrics.analyses).length;
  const hexagrams = safeState.metrics.hexagramsRead.length;
  const rank = [...GROWTH_RANKS].reverse().find((candidate) =>
    unlockedCount >= candidate.minAchievements && abilityAverage >= candidate.minAbility &&
    analyses >= candidate.minAnalyses && hexagrams >= candidate.minHexagrams,
  ) || GROWTH_RANKS[0];
  return {
    unlockedCount,
    totalAchievements: ACHIEVEMENT_CATALOG.length,
    abilities,
    abilityAverage,
    rank,
    achievements: ACHIEVEMENT_CATALOG.map((achievement) => ({
      ...achievement,
      current: achievementValue(achievement.id, safeState.metrics),
      unlocked: Boolean(safeState.achievements[achievement.id]),
      unlockedAt: safeState.achievements[achievement.id]?.unlockedAt || null,
    })),
  };
}

export function migrateAchievementState(value, options = {}) {
  if (isAchievementState(value)) return clone(value);
  if (isPlainObject(value) && value.version === 0 && Array.isArray(value.events)) {
    return applyProgressEvents(createAchievementState(), value.events, options).state;
  }
  return createAchievementState();
}
