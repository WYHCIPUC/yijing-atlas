import assert from 'node:assert/strict';
import test from 'node:test';
import * as quiz from '../js/quiz-engine.js';

const hexagrams = Array.from({ length: 64 }, (_, index) => ({
  binaryCode: index.toString(2).padStart(6, '0'), name: `卦${index}`, fullName: `测试卦${index}`,
}));
const almanacTerms = Array.from({ length: 5 }, (_, index) => ({
  id: `term-${index}`, name: `术语${index}`, category: '测试', meaning: `完整释义${index}`,
}));
const state = { hexagrams, almanacTerms };
const reference = {
  sourceKind: 'quiz', questionId: 'quiz:opposite:111111', questionVersion: 'quiz-v1',
  questionType: 'opposite', targetCode: '111111', termId: null, lessonId: null,
};

for (const type of ['opposite', 'reversed', 'interlocking', 'name']) {
  test(`${type} generated reference identifies the actual rule and target`, () => {
    const question = quiz.generateQuestion(hexagrams, type, '111111');
    assert.deepEqual(question.reference, { ...reference, questionType: type, questionId: `quiz:${type}:111111` });
    const resolved = quiz.resolveQuizQuestion(state, question.reference);
    assert.equal(resolved.ok, true);
    assert.deepEqual(resolved.question.reference, question.reference);
    assert.equal(resolved.question.answer, question.answer);
  });
}

for (const direction of ['name-to-meaning', 'meaning-to-name']) {
  test(`almanac ${direction} returns a stable independent reference`, () => {
    const question = quiz.generateAlmanacQuestion(almanacTerms, { termId: 'term-3', direction });
    assert.deepEqual(question.reference, {
      sourceKind: 'almanac', questionId: `almanac:term-3:${direction}`, questionVersion: 'almanac-v1',
      questionType: direction, targetCode: null, termId: 'term-3', lessonId: null,
    });
    assert.equal(question.answer, 'term-3');
    assert.match(question.question, direction === 'name-to-meaning' ? /的含义是/ : /是哪个黄历术语/);
    const resolved = quiz.resolveQuizQuestion(state, question.reference);
    assert.equal(resolved.ok, true);
    assert.deepEqual(resolved.question.reference, question.reference);
  });
}

test('exact replay rejects changed versions, IDs, types and absent sources instead of random fallback', () => {
  for (const candidate of [null, { ...reference, questionVersion: 'quiz-old' },
    { ...reference, questionId: 'quiz:name:111111' }, { ...reference, targetCode: 'bad' },
    { ...reference, lessonId: 'l1-1' }, { ...reference, sourceKind: 'course' }]) {
    const result = quiz.resolveQuizQuestion(state, candidate);
    assert.equal(result.ok, false);
    assert.equal(typeof result.reason, 'string');
    assert.equal(result.question, undefined);
  }
  assert.equal(quiz.resolveQuizQuestion({ hexagrams: [] }, reference).ok, false);
  const term = quiz.generateAlmanacQuestion(almanacTerms, { termId: 'term-3', direction: 'name-to-meaning' });
  assert.equal(quiz.resolveQuizQuestion({ ...state, almanacTerms: almanacTerms.slice(0, 3) }, term.reference).ok, false);
});

test('unavailable inputs and insufficient choices produce a safe empty question', () => {
  assert.equal(quiz.generateQuestion([], 'name'), null);
  assert.equal(quiz.generateQuestion(hexagrams, 'unknown'), null);
  assert.equal(quiz.generateQuestion(hexagrams, 'name', 'absent'), null);
  assert.equal(quiz.generateQuestion(hexagrams.slice(0, 3), 'name'), null);
  assert.equal(quiz.generateAlmanacQuestion(almanacTerms, { termId: 'absent' }), null);
  assert.equal(quiz.generateAlmanacQuestion(almanacTerms, { direction: 'unknown' }), null);
});

function memoryStorage(seed) {
  const values = new Map(Object.entries(seed || {}));
  let writes = 0;
  return { values, get writes() { return writes; }, getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes++; values.set(key, String(value)); }, removeItem: key => values.delete(key) };
}

test('statistics use a stable attempt receipt and reject identity reuse with a different result', () => {
  const storage = memoryStorage();
  const options = { attemptId: 'attempt-1', questionId: reference.questionId };
  assert.equal(quiz.recordResult(false, storage, options).saved, true);
  const writes = storage.writes;
  const replay = quiz.recordResult(false, storage, options);
  assert.equal(replay.saved, true);
  assert.equal(replay.duplicate, true);
  assert.equal(storage.writes, writes);
  assert.equal(quiz.recordResult(true, storage, options).saved, false);
  assert.equal(quiz.recordResult(false, storage, { ...options, questionId: 'quiz:name:111111' }).saved, false);
  assert.equal(storage.writes, writes);
  assert.equal(quiz.loadStats(storage).total, 1);
  assert.equal(quiz.loadStats(storage).correct, 0);
});

test('a failed statistics write retries only once and preserves receipts through legacy calls', () => {
  const storage = memoryStorage();
  let blocked = true;
  const original = storage.setItem;
  storage.setItem = (...args) => { if (blocked) throw new Error('quota'); original(...args); };
  const options = { attemptId: 'attempt-2', questionId: reference.questionId };
  assert.equal(quiz.recordResult(true, storage, options).saved, false);
  assert.equal(quiz.loadStats(storage).total, 0);
  blocked = false;
  assert.equal(quiz.recordResult(true, storage, options).saved, true);
  quiz.recordResult(false, storage);
  assert.equal(quiz.recordResult(true, storage, options).duplicate, true);
  assert.equal(quiz.loadStats(storage).total, 2);
  assert.deepEqual(quiz.loadStats(storage).attempts['attempt-2'], { questionId: reference.questionId, correct: true });
});

test('damaged optional receipts preserve readable totals but block writes and expose field errors', () => {
  const data = { total: 8, correct: 5, attempts: { x: { questionId: 'quiz:name:111111', correct: 'yes' } } };
  const storage = memoryStorage({ 'yijing-quiz-stats': JSON.stringify(data) });
  assert.equal(quiz.loadStats(storage).total, 8);
  assert.equal(quiz.getQuizStatsError(data), 'attempts[x].correct');
  assert.equal(quiz.recordResult(false, storage, { attemptId: 'new', questionId: reference.questionId }).saved, false);
  assert.equal(storage.writes, 0);
  assert.equal(quiz.isQuizStats(data), false);
  assert.equal(quiz.getQuizStatsError({ total: 1, correct: 1 }), null);
  assert.equal(quiz.getQuizStatsError({ total: 1, correct: 1, attempts: [] }), 'attempts');
});

test('statistics read errors and invalid attempt metadata cannot overwrite existing records', () => {
  let writes = 0;
  const storage = { getItem() { throw new Error('read blocked'); }, setItem() { writes++; } };
  assert.equal(quiz.recordResult(true, storage, { attemptId: 'a', questionId: reference.questionId }).saved, false);
  assert.equal(writes, 0);
  const good = memoryStorage();
  for (const options of [{ attemptId: '', questionId: reference.questionId },
    { attemptId: 'a', questionId: '' }, { attemptId: 'a'.repeat(121), questionId: reference.questionId }]) {
    assert.equal(quiz.recordResult(true, good, options).saved, false);
  }
  assert.equal(good.writes, 0);
});

test('invalid optional arguments are rejected without a throw or statistics write', () => {
  const storage = memoryStorage();
  for (const options of [null, [], 'bad', 1]) {
    assert.equal(quiz.recordResult(true, storage, options).saved, false);
    assert.equal(quiz.generateAlmanacQuestion(almanacTerms, options), null);
  }
  assert.equal(storage.writes, 0);
});
