// 一次测验的提交身份与分项保存。重试复用答案，只补未成功的写入。
import { allRelations } from './hexagram-utils.js';
import { isQuizStats, isWrongBook, loadStats, recordResult, removeWrong } from './quiz-engine.js';
import { getQuizAttemptsError, getWeakQuestionsError, isActivity, recordActivity, recordQuizAttempt } from './learning-progress.js';
import { addReviewCard, isReviewCards } from './review-engine.js';
import { createProgressEvent, isAchievementState, isProgressEvent } from './achievement-engine.js';
import { processAchievementEvent } from './achievement-storage.js';

const rounds = new WeakMap();
const fields = ['sourceKind', 'questionId', 'questionVersion', 'questionType', 'targetCode', 'termId', 'lessonId'];
const partNames = ['stats', 'weak', 'review', 'activity', 'achievement', 'legacy'];
let sequence = 0;

function currentReference(question) {
  const ref = question?.reference;
  if (!ref || ref.lessonId !== null || typeof ref.questionId !== 'string' || ref.questionId.length > 160) return null;
  if (ref.sourceKind === 'quiz') {
    if (!['opposite', 'reversed', 'interlocking', 'name'].includes(ref.questionType) ||
        ref.questionVersion !== 'quiz-v1' || !/^[01]{6}$/.test(ref.targetCode || '') || ref.termId !== null ||
        ref.questionId !== `quiz:${ref.questionType}:${ref.targetCode}` || question.type !== ref.questionType ||
        question.targetCode !== ref.targetCode) return null;
    const answer = ref.questionType === 'name' ? ref.targetCode : allRelations(ref.targetCode)[ref.questionType];
    if (question.answer !== answer) return null;
  } else if (ref.sourceKind === 'almanac') {
    if (!['name-to-meaning', 'meaning-to-name'].includes(ref.questionType) ||
        ref.questionVersion !== 'almanac-v1' || ref.targetCode !== null || typeof ref.termId !== 'string' ||
        !ref.termId.trim() || ref.termId.length > 120 ||
        ref.questionId !== `almanac:${ref.termId}:${ref.questionType}` || question.type !== 'almanac' ||
        question.answer !== ref.termId) return null;
  } else return null;
  return Object.fromEntries(fields.map(field => [field, ref[field]]));
}

export function createQuizAttempt(question, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return null;
  const { mode = 'random', now = new Date(), id } = options;
  const reference = currentReference(question);
  const candidates = Array.isArray(question?.candidates)
    ? question.candidates.map(item => question.type === 'almanac' ? item?.code : item) : null;
  if (!reference || !['random', 'review', 'legacy'].includes(mode) ||
      (mode === 'legacy' && reference.sourceKind !== 'quiz') || !(now instanceof Date) || !Number.isFinite(now.getTime()) ||
      !Array.isArray(candidates) || candidates.length < 4 || new Set(candidates).size !== candidates.length ||
      candidates.some(code => typeof code !== 'string' || !code) || !candidates.includes(question.answer)) return null;
  const attemptId = id ?? `quiz:${Date.now().toString(36)}:${++sequence}:${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  if (typeof attemptId !== 'string' || !attemptId.trim() || attemptId.length > 120) return null;
  const token = Object.freeze({ id: attemptId });
  rounds.set(token, { id: attemptId, reference, candidates: [...candidates], answer: question.answer,
    mode, at: new Date(now), picked: null, correct: null, recovery: null, changes: {}, stats: null, storage: null });
  return token;
}

function checkedStore(target, key, validate, run) {
  const raw = target.getItem(key);
  const value = raw === null ? null : JSON.parse(raw);
  if (raw !== null && !validate(value)) throw new Error('已有记录异常，请先备份核对');
  // 旧模块有安全回退读取；本轮固定已校验的原串，避免第二次读取失败后用空值覆盖。
  const snapshot = {
    getItem: requested => requested === key ? raw : target.getItem(requested),
    setItem: (requested, text) => target.setItem(requested, text),
    removeItem: requested => target.removeItem(requested),
  };
  return run(snapshot, value);
}

function resultFor(round, error = null) {
  const changes = Object.fromEntries(partNames.map(name => [name,
    { applicable: false, saved: true, ...round?.changes[name] }]));
  return {
    correct: round?.correct ?? null,
    saved: !error && partNames.every(name => !changes[name].applicable || changes[name].saved),
    stats: round?.stats ? { total: round.stats.total, correct: round.stats.correct } : { total: 0, correct: 0 },
    changes,
    recovery: round?.recovery ? structuredClone(round.recovery) : null,
    error: error || (changes.weak.outcome === 'reference-mismatch'
      ? '原错题版本不同，已保留原记录；本次不会标记为已纠正。' : null),
  };
}

function hasIdentityConflict(round, target) {
  // 只把可验证的已存身份当冲突；某一键不可读仍由其自己的保存步骤报告，其他键可独立重试。
  try {
    const stats = JSON.parse(target.getItem('yijing-quiz-stats'));
    const receipt = stats?.attempts && Object.hasOwn(stats.attempts, round.id) ? stats.attempts[round.id] : null;
    const questionId = round.mode === 'legacy' ? `legacy:${round.reference.targetCode}` : round.reference.questionId;
    if (isQuizStats(stats) && receipt && (receipt.correct !== round.correct || receipt.questionId !== questionId)) return true;
  } catch { /* The statistics writer reports unreadable data without replacing it. */ }
  try {
    const record = JSON.parse(target.getItem('yijing-learning-record-v2'));
    const receipt = record?.quizAttempts && Object.hasOwn(record.quizAttempts, round.id) ? record.quizAttempts[round.id] : null;
    if (!getQuizAttemptsError(record?.quizAttempts) && receipt &&
        (receipt.correct !== round.correct || receipt.mode !== round.mode ||
          fields.some(field => receipt.reference[field] !== round.reference[field]))) return true;
    if (!receipt && !getWeakQuestionsError(record?.weakQuestions) &&
        Object.values(record?.weakQuestions || {}).some(item => item.lastSessionId === round.id)) return true;
  } catch { /* The learning writer reports unreadable data without replacing it. */ }
  return false;
}

export function submitQuizAttempt(token, pickedCode, options = {}) {
  const round = token && rounds.get(token);
  if (!options || typeof options !== 'object' || Array.isArray(options)) return resultFor(round, '保存参数无效，请重新进入测验。');
  const { storage } = options;
  if (!round || !round.candidates.includes(pickedCode)) return resultFor(round, '本次作答无效，请重新进入测验。');
  if (round.picked !== null && round.picked !== pickedCode) return resultFor(round, '本轮答案已提交；重试不能更换答案。');
  round.picked = pickedCode;
  round.correct = pickedCode === round.answer;
  let target;
  try {
    target = storage || globalThis.localStorage;
    if (!target) throw new Error('storage unavailable');
  } catch {
    return resultFor(round, '本地存储暂不可用，答案仍保留，可重试保存。');
  }
  if (round.storage && target !== round.storage) return resultFor(round, '保存环境已变化，请返回原测验环境重试。');
  round.storage = target;
  if (!round.stats) round.stats = loadStats(target);
  if (hasIdentityConflict(round, target)) return resultFor(round, '提交标识与已有作答冲突，未保存新的记录；请重新进入测验。');
  const save = (name, applicable, operation) => {
    if (!applicable || round.changes[name]?.saved) return;
    try {
      const value = operation();
      round.changes[name] = { applicable: true, saved: value.saved === true,
        ...(value.duplicate !== undefined ? { duplicate: value.duplicate } : {}),
        ...(value.added !== undefined ? { added: value.added } : {}),
        ...(value.entry ? { outcome: value.entry.weakOutcome } : {}) };
      if (name === 'stats') round.stats = value;
      if (name === 'weak' && value.saved) round.recovery = value.recovery;
    } catch {
      round.changes[name] = { applicable: true, saved: false };
    }
  };
  save('stats', true, () => recordResult(round.correct, target, { attemptId: round.id,
    questionId: round.mode === 'legacy' ? `legacy:${round.reference.targetCode}` : round.reference.questionId }));
  save('weak', round.mode !== 'legacy', () => recordQuizAttempt({ attemptId: round.id,
    reference: round.reference, correct: round.correct, mode: round.mode }, round.at, target));
  save('review', !round.correct && round.reference.sourceKind === 'quiz', () =>
    checkedStore(target, 'yijing-review-cards', isReviewCards, checked => addReviewCard(round.reference.targetCode, checked)));
  save('activity', true, () => checkedStore(target, 'yijing-activity-v1', isActivity, (checked, value) => {
    const day = `${round.at.getFullYear()}-${String(round.at.getMonth() + 1).padStart(2, '0')}-${String(round.at.getDate()).padStart(2, '0')}`;
    return value?.days.includes(day) ? { saved: true } : recordActivity(round.at, checked);
  }));
  save('legacy', round.mode === 'legacy' && round.correct, () =>
    checkedStore(target, 'yijing-quiz-wrong', isWrongBook, checked => ({ saved: removeWrong(round.reference.targetCode, checked) })));
  save('achievement', Boolean(round.recovery), () => checkedStore(target, 'yijing.achievements.v1',
    value => isAchievementState(value) || (value?.version === 0 && Array.isArray(value.events) && value.events.every(isProgressEvent)),
    checked => processAchievementEvent(createProgressEvent({
      type: 'quiz.recovered', subjectId: round.recovery.reference.questionId.length <= 128
        ? round.recovery.reference.questionId
        : `alm:${round.recovery.reference.questionType === 'name-to-meaning' ? 'n' : 'm'}:${round.recovery.reference.termId}`,
      outcome: 'recovered',
      occurredAt: round.recovery.reviewedAt, idempotencyKey: `quiz:recovered:${round.recovery.reviewAttemptId}`,
      metadata: { source: 'quiz-weak-questions', reviewKind: 'targeted',
        ...(round.recovery.reference.targetCode ? { hexagramCode: round.recovery.reference.targetCode } : {}) },
    }), { storage: checked })));
  const result = resultFor(round);
  if (!result.saved) result.error = '部分学习记录未能保存，可重试未完成部分；已保存的记录不会重复累计。';
  return result;
}
