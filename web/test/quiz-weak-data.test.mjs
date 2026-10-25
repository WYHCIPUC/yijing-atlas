import assert from 'node:assert/strict';
import test from 'node:test';
import * as progress from '../js/learning-progress.js';

const KEY = 'yijing-learning-record-v2';
const firstAt = '2026-10-25T08:00:00.000Z';
const secondAt = '2026-10-25T09:00:00.000Z';
const thirdAt = '2026-10-25T10:00:00.000Z';
const quizReference = (type = 'opposite', code = '111111') => ({
  sourceKind: 'quiz', questionId: `quiz:${type}:${code}`, questionVersion: 'quiz-v1',
  questionType: type, targetCode: code, termId: null, lessonId: null,
});
const almanacReference = (direction = 'name-to-meaning', termId = 'jianchu-jian') => ({
  sourceKind: 'almanac', questionId: `almanac:${termId}:${direction}`, questionVersion: 'almanac-v1',
  questionType: direction, targetCode: null, termId, lessonId: null,
});
const attempt = (attemptId, overrides = {}) => ({
  attemptId, reference: quizReference(), correct: false, mode: 'random', ...overrides,
});
const baseRecord = () => ({
  version: 2, lessons: { 'l1-1': { viewedAt: firstAt, attempts: 3, bestScore: 0.75 } },
  spotChecks: [], exams: [], oralReviews: [],
  resume: { lessonId: 'l1-1', section: 'read', scrollTop: 125.5, updatedAt: firstAt },
  processedAssessmentIds: ['old-course'],
});
const receipt = (overrides = {}) => ({
  attemptId: 'wrong-1', reference: quizReference(), correct: false, mode: 'random', at: firstAt,
  weakOutcome: 'added', recoveredFrom: null, ...overrides,
});
const weakEntry = (reference = quizReference(), overrides = {}) => ({
  ...reference, firstWrongAt: firstAt, lastWrongAt: firstAt, lastSessionId: 'wrong-1',
  wrongCount: 1, status: 'due', lastReviewedAt: null, resolvedAt: null, ...overrides,
});
function storage(record = baseRecord()) {
  const values = new Map([[KEY, JSON.stringify(record)], ['yijing-quiz-wrong', '["000000"]']]);
  return {
    writes: [], blocked: false,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (this.blocked) throw new Error('quota');
      this.writes.push(key);
      values.set(key, String(value));
    },
    removeItem: (key) => values.delete(key),
  };
}
function api(name) {
  assert.equal(typeof progress[name], 'function', `${name} 尚未实现`);
  return progress[name];
}
function save(target, input, at = firstAt) {
  return api('recordQuizAttempt')(input, new Date(at), target);
}
const read = (target) => JSON.parse(target.getItem(KEY));

test('自由测验错误与独立回执同键保存，保留课程、位置和旧码摘要', () => {
  const target = storage();
  const before = read(target);
  const result = save(target, attempt('wrong-1'));
  assert.equal(result.saved, true);
  assert.equal(result.duplicate, false);
  assert.deepEqual(result.entry, receipt());
  assert.equal(result.recovery, null);
  assert.deepEqual(read(target).weakQuestions[quizReference().questionId], weakEntry());
  assert.deepEqual(read(target).quizAttempts, { 'wrong-1': receipt() });
  assert.deepEqual({ ...read(target), weakQuestions: undefined, quizAttempts: undefined },
    { ...before, weakQuestions: undefined, quizAttempts: undefined });
  assert.deepEqual(target.writes, [KEY]);
  assert.equal(target.getItem('yijing-quiz-wrong'), '["000000"]');
});

test('只有原规则明确回练才纠正，随机正确和同卦其他题不清原错误', () => {
  const target = storage();
  save(target, attempt('wrong-1'));
  for (const [id, reference, mode] of [
    ['random-right', quizReference(), 'random'],
    ['other-rule', quizReference('name'), 'review'],
    ['other-target', quizReference('opposite', '000000'), 'review'],
  ]) {
    const result = save(target, attempt(id, { reference, correct: true, mode }), secondAt);
    assert.equal(result.saved, true);
    assert.equal(result.entry.weakOutcome, 'unchanged');
    assert.equal(result.recovery, null);
    assert.deepEqual(read(target).weakQuestions[quizReference().questionId], weakEntry());
  }
  const result = save(target, attempt('review-1', { correct: true, mode: 'review' }), secondAt);
  assert.equal(result.entry.weakOutcome, 'resolved');
  assert.deepEqual(result.recovery, {
    reference: quizReference(), wrongAttemptId: 'wrong-1', wrongAt: firstAt,
    reviewAttemptId: 'review-1', reviewedAt: secondAt,
  });
  assert.equal(read(target).weakQuestions[quizReference().questionId].status, 'resolved');
  assert.equal(read(target).weakQuestions[quizReference().questionId].lastReviewedAt, secondAt);
});

test('重复成功回执零写并保留原恢复证据，后续再次答错也不重推旧恢复', () => {
  const target = storage();
  save(target, attempt('wrong-1'));
  const input = attempt('review-1', { correct: true, mode: 'review' });
  const resolved = save(target, input, secondAt);
  const count = target.writes.length;
  const duplicate = save(target, input, thirdAt);
  assert.equal(duplicate.saved, true);
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.entry, resolved.entry);
  assert.deepEqual(duplicate.recovery, resolved.recovery);
  assert.equal(target.writes.length, count);
  save(target, attempt('wrong-2'), thirdAt);
  const beforeRetry = target.getItem(KEY);
  const again = save(target, input, thirdAt);
  assert.deepEqual(again.recovery, resolved.recovery);
  assert.equal(target.getItem(KEY), beforeRetry);
  const weak = read(target).weakQuestions[quizReference().questionId];
  assert.equal(weak.status, 'due');
  assert.equal(weak.wrongCount, 2);
  assert.equal(weak.firstWrongAt, firstAt);
  assert.equal(weak.lastReviewedAt, secondAt);
  assert.equal(weak.resolvedAt, null);
});

test('同attempt改变答案、模式或任何公开引用均拒绝，不返回恢复证据', () => {
  const target = storage();
  save(target, attempt('same'));
  const before = target.getItem(KEY);
  for (const input of [
    attempt('same', { correct: true }), attempt('same', { mode: 'review' }),
    attempt('same', { reference: quizReference('name') }),
    attempt('same', { reference: almanacReference() }),
  ]) {
    const result = save(target, input, secondAt);
    assert.equal(result.saved, false);
    assert.equal(result.duplicate, false);
    assert.equal(result.entry, null);
    assert.equal(result.recovery, null);
    assert.equal(target.getItem(KEY), before);
  }
  assert.equal(target.writes.length, 1);
});

test('旧弱项含相同attempt但无回执时保留缺证据状态，不重复累计或补造恢复', () => {
  for (const correct of [false, true]) {
    const entry = weakEntry();
    const original = { ...baseRecord(), weakQuestions: { [entry.questionId]: entry } };
    const target = storage(original);
    const result = save(target, attempt('wrong-1', { correct, mode: 'review' }), secondAt);
    assert.equal(result.saved, false);
    assert.equal(result.entry, null);
    assert.equal(result.recovery, null);
    assert.deepEqual(read(target), original);
    assert.equal(target.writes.length, 0);
  }
});

test('测验写入口读取异常或基础记录损坏时拒写，不用空回退覆盖旧数据', () => {
  for (const failure of ['getItem', 'json', 'base', 'non-string']) {
    const target = storage();
    const getItem = target.getItem;
    if (failure === 'json') target.setItem(KEY, '{broken-json');
    if (failure === 'base') target.setItem(KEY, '{"version":2,"lessons":{"old":{"attempts":7}}}');
    const original = getItem(KEY);
    target.writes.length = 0;
    target.getItem = (key) => {
      if (key === KEY && failure === 'getItem') throw new Error('read denied');
      if (key === KEY && failure === 'non-string') return undefined;
      return getItem(key);
    };
    const result = save(target, attempt('read-failure'));
    assert.equal(result.saved, false, failure);
    assert.equal(result.entry, null);
    assert.equal(result.recovery, null);
    assert.equal(getItem(KEY), original);
    assert.equal(target.writes.length, 0);
  }
});

test('仅新学习键确实缺失才迁移旧浏览，旧源读取失败或损坏也拒写', () => {
  for (const failure of [null, 'getItem', 'json', 'schema']) {
    const target = storage();
    target.removeItem(KEY);
    target.setItem('yijing.study.v1', failure === 'json' ? '{bad' :
      failure === 'schema' ? '{"l1-1":"yes"}' : '{"l1-1":true,"l1-2":false}');
    target.writes.length = 0;
    const getItem = target.getItem;
    target.getItem = (key) => {
      if (failure === 'getItem' && key === 'yijing.study.v1') throw new Error('legacy denied');
      return getItem(key);
    };
    const result = save(target, attempt('migration'));
    assert.equal(result.saved, failure === null, String(failure));
    if (failure) {
      assert.equal(getItem(KEY), null);
      assert.equal(target.writes.length, 0);
    } else {
      assert.deepEqual(read(target).lessons, { 'l1-1': { viewedAt: new Date(0).toISOString() } });
      assert.equal(target.writes.length, 1);
    }
  }
  const firstUse = storage();
  firstUse.removeItem(KEY);
  assert.equal(save(firstUse, attempt('new-user')).saved, true);
});

test('不可用的localStorage getter不会抛出或伪报成功', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
    const result = api('recordQuizAttempt')(attempt('denied'), new Date(firstAt));
    assert.equal(result.saved, false);
    assert.equal(result.entry, null);
    assert.equal(result.recovery, null);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('配额失败不保存候选或恢复证据，同attempt恢复后仅保存一次', () => {
  const target = storage();
  const before = read(target);
  target.blocked = true;
  const failure = save(target, attempt('wrong-1'));
  assert.equal(failure.saved, false);
  assert.deepEqual(failure.record, before);
  assert.equal(failure.entry, null);
  assert.equal(failure.recovery, null);
  assert.deepEqual(read(target), before);
  target.blocked = false;
  save(target, attempt('wrong-1'));
  const wrongRecord = read(target);
  target.blocked = true;
  const input = attempt('review-1', { correct: true, mode: 'review' });
  const failedReview = save(target, input, secondAt);
  assert.equal(failedReview.saved, false);
  assert.deepEqual(failedReview.record, wrongRecord);
  assert.equal(failedReview.recovery, null);
  target.blocked = false;
  const savedReview = save(target, input, secondAt);
  assert.equal(savedReview.saved, true);
  assert.equal(savedReview.recovery.wrongAttemptId, 'wrong-1');
  assert.equal(save(target, input, thirdAt).duplicate, true);
  assert.equal(target.writes.length, 2);
});

test('黄历两种提问方向独立回练且不生成卦码', () => {
  const target = storage();
  const forward = almanacReference();
  const reverse = almanacReference('meaning-to-name');
  save(target, attempt('term-forward', { reference: forward }));
  save(target, attempt('term-reverse', { reference: reverse }));
  const result = save(target, attempt('term-review', { reference: forward, correct: true, mode: 'review' }), secondAt);
  assert.equal(result.recovery.reference.targetCode, null);
  assert.equal(read(target).weakQuestions[forward.questionId].status, 'resolved');
  assert.equal(read(target).weakQuestions[reverse.questionId].status, 'due');
  assert.deepEqual(target.writes, [KEY, KEY, KEY]);
  assert.equal(target.getItem('yijing-review-cards'), null);
});

test('旧同ID不同版本或引用保留，回执说明引用冲突且不冒充纠正', () => {
  for (const change of [
    { questionVersion: 'quiz-old' }, { questionType: 'name' }, { targetCode: '000000' },
    { lessonId: 'l1-1' }, { termId: 'old-term' },
    { sourceKind: 'almanac', termId: 'old-term' },
  ]) {
    for (const correct of [true, false]) {
      const entry = weakEntry(quizReference(), change);
      const target = storage({ ...baseRecord(), weakQuestions: { [entry.questionId]: entry } });
      const result = save(target, attempt('new-attempt', { correct, mode: 'review' }), secondAt);
      assert.equal(result.saved, true);
      assert.equal(result.entry.weakOutcome, 'reference-mismatch');
      assert.equal(result.recovery, null);
      assert.deepEqual(read(target).weakQuestions[entry.questionId], entry);
    }
  }
});

test('待回练查询只读排序，按来源过滤并保留明确resolved开关', () => {
  const entries = [
    weakEntry(quizReference('name'), { lastWrongAt: secondAt }),
    weakEntry(almanacReference(), { status: 'reviewed', lastWrongAt: secondAt }),
    weakEntry(quizReference(), { status: 'resolved', resolvedAt: secondAt }),
    weakEntry({ sourceKind: 'course', questionId: 'old-course-question', questionVersion: 'old',
      questionType: 'recall', targetCode: null, termId: null, lessonId: 'l1-1' }),
  ];
  const record = { ...baseRecord(), weakQuestions: Object.fromEntries(entries.map((entry) => [entry.questionId, entry])) };
  const before = structuredClone(record);
  const get = api('getQuizWeakQuestions');
  assert.deepEqual(get(record).map((entry) => entry.questionId), [entries[1].questionId, entries[0].questionId]);
  assert.equal(get(record, { sourceKind: 'quiz' }).length, 1);
  assert.equal(get(record, { sourceKind: 'almanac' }).length, 1);
  assert.equal(get(record, { includeResolved: true }).length, 3);
  assert.deepEqual(get(record, { sourceKind: 'course' }), []);
  get(record)[0].status = 'resolved';
  assert.deepEqual(record, before);
  assert.deepEqual(get({ ...record, weakQuestions: null }), []);
});

test('旧缺回执兼容，损坏回执加载保留旧成绩但所有写入口拒绝覆盖', () => {
  assert.equal(progress.isLearningRecord(baseRecord()), true);
  for (const quizAttempts of [null, [], { bad: receipt() }, { 'wrong-1': receipt({ correct: 'false' }) }]) {
    const record = { ...baseRecord(), quizAttempts };
    assert.equal(progress.isLearningRecord(record), false);
    const target = storage(record);
    assert.deepEqual(progress.loadLearningRecord(target), record);
    assert.equal(progress.markLessonViewed('l1-2', new Date(secondAt), target).saved, false);
    assert.equal(progress.saveLearningResume({ lessonId: 'l1-1', section: 'apply', scrollTop: 1 }, new Date(secondAt), target).saved, false);
    assert.equal(save(target, attempt('new')).saved, false);
    assert.deepEqual(read(target), record);
    assert.equal(target.writes.length, 0);
  }
});

test('新引用严格检查规范ID与版本，不存未知字段、题干、答案或私文', () => {
  const target = storage();
  const invalid = [
    attempt(''), attempt(' '.repeat(3)), attempt('x'.repeat(121)), attempt('bad', { correct: 1 }),
    attempt('bad', { mode: 'lesson' }), attempt('bad', { reference: null }),
    ...[{ questionVersion: 'quiz-old' }, { questionId: 'other-id' }, { lessonId: 'l1-1' },
      { termId: 'bad' }, { targetCode: null }, { sourceKind: 'course' }, { questionType: 'other' },
    ].map((change) => attempt('bad', { reference: { ...quizReference(), ...change } })),
    ...[{ questionVersion: 'almanac-old' }, { targetCode: '111111' }, { termId: '' },
      { questionType: 'other' }, { lessonId: 'l1-1' },
    ].map((change) => attempt('bad', { reference: { ...almanacReference(), ...change } })),
  ];
  for (const input of invalid) assert.equal(save(target, input).saved, false);
  assert.equal(api('recordQuizAttempt')(attempt('bad-time'), new Date('bad'), target).saved, false);
  assert.equal(target.writes.length, 0);
  const result = save(target, attempt('clean', { answer: 'private', note: 'private',
    reference: { ...quizReference(), question: 'private', options: ['private'] } }));
  assert.equal(result.saved, true);
  assert.equal(target.getItem(KEY).includes('private'), false);
  assert.deepEqual(result.entry.reference, quizReference());
});

test('回执校验定位字段，恢复事实必须与正确回练和原错误标识一致', () => {
  const validate = api('getQuizAttemptsError');
  assert.equal(validate(undefined), null);
  assert.equal(validate({}), null);
  assert.equal(validate({ 'wrong-1': receipt() }), null);
  const cases = [
    [null, 'quizAttempts'], [[], 'quizAttempts'],
    [{ alias: receipt() }, 'quizAttempts[alias].attemptId'],
    ...[
      ['reference', null, 'reference'], ['correct', 1, 'correct'], ['mode', 'other', 'mode'],
      ['at', 'yesterday', 'at'], ['weakOutcome', 'other', 'weakOutcome'],
      ['recoveredFrom', { attemptId: 'earlier', at: firstAt }, 'recoveredFrom'],
    ].map(([field, value, path]) => [{ 'wrong-1': receipt({ [field]: value }) }, `quizAttempts[wrong-1].${path}`]),
    [{ 'wrong-1': receipt({ reference: { ...quizReference(), questionId: 'bad' } }) }, 'quizAttempts[wrong-1].reference.questionId'],
    [{ 'wrong-1': receipt({ weakOutcome: 'resolved', correct: true, mode: 'review' }) }, 'quizAttempts[wrong-1].recoveredFrom'],
  ];
  for (const [value, path] of cases) assert.equal(validate(value), path);
  const recovered = receipt({ correct: true, mode: 'review', weakOutcome: 'resolved',
    recoveredFrom: { attemptId: 'older', at: firstAt } });
  assert.equal(validate({ 'wrong-1': recovered }), null);
  assert.equal(validate({ 'wrong-1': { ...recovered, mode: 'random' } }), 'quizAttempts[wrong-1].weakOutcome');
  assert.equal(validate({ 'wrong-1': { ...recovered, recoveredFrom: { attemptId: 'wrong-1', at: firstAt } } }),
    'quizAttempts[wrong-1].recoveredFrom.attemptId');
  assert.equal(validate({ 'wrong-1': { ...recovered, recoveredFrom: { attemptId: 'older', at: 'bad' } } }),
    'quizAttempts[wrong-1].recoveredFrom.at');
  assert.equal(validate({ 'wrong-1': receipt({ correct: true }) }), 'quizAttempts[wrong-1].weakOutcome');
  assert.equal(validate({ 'wrong-1': receipt({ weakOutcome: 'unchanged' }) }), 'quizAttempts[wrong-1].weakOutcome');
  const historical = receipt({ reference: { ...quizReference(), questionVersion: 'quiz-older' } });
  assert.equal(validate({ 'wrong-1': historical }), null);
});

test('reviewed可纠正但已resolved不重复造新恢复，首次正确不创建弱项', () => {
  const entry = weakEntry(quizReference(), { status: 'reviewed' });
  const target = storage({ ...baseRecord(), weakQuestions: { [entry.questionId]: entry } });
  assert.equal(save(target, attempt('reviewed', { correct: true, mode: 'review' }), secondAt).entry.weakOutcome, 'resolved');
  const next = save(target, attempt('resolved-again', { correct: true, mode: 'review' }), thirdAt);
  assert.equal(next.entry.weakOutcome, 'unchanged');
  assert.equal(next.recovery, null);
  const clean = storage();
  assert.equal(save(clean, attempt('first-correct', { correct: true, mode: 'review' })).saved, true);
  assert.equal(read(clean).weakQuestions, undefined);
});

test('课程历史80条截断不裁自由测验回执，任意旧attempt重复仍零写', () => {
  const target = storage();
  save(target, attempt('wrong-1'));
  for (let index = 0; index < 81; index += 1) {
    const result = progress.recordLearningAssessment('spot', {
      sessionId: `course-${index}`, correct: 0, total: 1, results: [],
    }, new Date(secondAt), target);
    assert.equal(result.saved, true);
  }
  assert.equal(read(target).spotChecks.length, 80);
  const count = target.writes.length;
  assert.equal(save(target, attempt('wrong-1')).duplicate, true);
  assert.equal(target.writes.length, count);
  assert.equal(read(target).weakQuestions[quizReference().questionId].wrongCount, 1);
});

test('安全整数溢出拒写，特殊attempt键不污染原型且可稳定判重', () => {
  const entry = weakEntry(quizReference(), { wrongCount: Number.MAX_SAFE_INTEGER });
  const target = storage({ ...baseRecord(), weakQuestions: { [entry.questionId]: entry } });
  assert.equal(save(target, attempt('overflow')).saved, false);
  assert.equal(target.writes.length, 0);
  const safe = storage();
  assert.equal(save(safe, attempt('__proto__')).saved, true);
  assert.equal(Object.hasOwn(read(safe).quizAttempts, '__proto__'), true);
  assert.equal(save(safe, attempt('__proto__')).duplicate, true);
  assert.equal(safe.writes.length, 1);
  assert.equal({}.correct, undefined);
});
