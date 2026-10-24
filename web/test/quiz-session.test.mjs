import assert from 'node:assert/strict';
import test from 'node:test';
import { generateQuestion, generateAlmanacQuestion, loadStats } from '../js/quiz-engine.js';
import { loadLearningRecord, recordQuizAttempt } from '../js/learning-progress.js';
import { loadAchievementState } from '../js/achievement-storage.js';

let session = {};
try { session = await import('../js/quiz-session.js'); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const hexagrams = Array.from({ length: 64 }, (_, index) => ({
  binaryCode: index.toString(2).padStart(6, '0'), name: `卦${index}`, fullName: `卦名${index}`,
}));
const terms = Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, name: `术语${i}`, meaning: `释义${i}`, category: '测试' }));
const question = () => ({ ...generateQuestion(hexagrams, 'opposite', '111111'),
  candidates: ['000000', '111111', '101010', '010101'] });
const at = new Date('2026-10-25T01:00:00Z');
const keys = { stats: 'yijing-quiz-stats', weak: 'yijing-learning-record-v2', review: 'yijing-review-cards',
  activity: 'yijing-activity-v1', achievement: 'yijing.achievements.v1', legacy: 'yijing-quiz-wrong' };
function store() {
  const values = new Map(); const writes = new Map(); const blocked = new Set(); const unreadable = new Set();
  return { values, writes, blocked, unreadable,
    getItem(key) { if (unreadable.has(key)) throw new Error('read blocked'); return values.get(key) ?? null; },
    setItem(key, value) { if (blocked.has(key)) throw new Error('quota'); values.set(key, String(value)); writes.set(key, (writes.get(key) || 0) + 1); },
    removeItem(key) { if (blocked.has(key)) throw new Error('quota'); values.delete(key); writes.set(key, (writes.get(key) || 0) + 1); },
  };
}
function attempt(q = question(), mode = 'random', id = 'current') {
  assert.equal(typeof session.createQuizAttempt, 'function', 'the round coordinator is implemented');
  return session.createQuizAttempt(q, { mode, id, now: at });
}
function wrong(storage, q = question(), id = 'wrong') {
  const result = recordQuizAttempt({ attemptId: id, reference: q.reference, correct: false, mode: 'random' }, at, storage);
  assert.equal(result.saved, true);
}
const submit = (token, answer, storage) => session.submitQuizAttempt(token, answer, { storage });

test('one wrong round stores a concrete rule, one card and activity without a legacy summary', () => {
  const storage = store(); const token = attempt();
  const first = submit(token, '111111', storage);
  assert.equal(first.correct, false); assert.equal(first.saved, true);
  assert.equal(loadStats(storage).total, 1);
  assert.equal(loadLearningRecord(storage).weakQuestions[question().reference.questionId].wrongCount, 1);
  assert.equal(first.changes.review.saved, true); assert.equal(first.changes.legacy.applicable, false);
  const writes = [...storage.writes];
  assert.equal(submit(token, '111111', storage).saved, true);
  assert.deepEqual([...storage.writes], writes);
  assert.equal(storage.values.has(keys.legacy), false);
});

test('correct answer to another rule or random repetition does not clear the original weakness', () => {
  const storage = store(); wrong(storage);
  const name = generateQuestion(hexagrams, 'name', '111111');
  const other = submit(attempt(name, 'review', 'other'), name.answer, storage);
  assert.equal(other.recovery, null);
  const random = submit(attempt(question(), 'random', 'random'), '000000', storage);
  assert.equal(random.recovery, null);
  assert.equal(loadLearningRecord(storage).weakQuestions[question().reference.questionId].status, 'due');
  assert.deepEqual(loadAchievementState(storage).metrics.quizRecoveries, []);
});

test('matching almanac direction resolves with stored wrong/review evidence and no hexagram card', () => {
  const storage = store();
  const q = generateAlmanacQuestion(terms, { termId: 't0', direction: 'name-to-meaning' });
  wrong(storage, q);
  const other = generateAlmanacQuestion(terms, { termId: 't0', direction: 'meaning-to-name' });
  assert.equal(submit(attempt(other, 'review', 'other'), other.answer, storage).recovery, null);
  const result = submit(attempt(q, 'review'), q.answer, storage);
  assert.equal(result.saved, true); assert.equal(result.recovery.wrongAttemptId, 'wrong');
  assert.equal(result.recovery.reviewAttemptId, 'current');
  assert.equal(result.changes.review.applicable, false);
  assert.equal(storage.values.has(keys.review), false);
  assert.deepEqual(loadAchievementState(storage).metrics.quizRecoveries, [q.reference.questionId]);
});

for (const part of Object.keys(keys)) {
  test(`${part} failure retries that part without re-saving successful effects`, () => {
    const storage = store(); const q = question();
    let mode = 'random'; let answer = '111111';
    if (part === 'achievement') { wrong(storage); mode = 'review'; answer = q.answer; }
    if (part === 'legacy') { storage.values.set(keys.legacy, '["111111"]'); mode = 'legacy'; answer = q.answer; }
    storage.blocked.add(keys[part]);
    const token = attempt(q, mode); const failed = submit(token, answer, storage);
    assert.equal(failed.saved, false); assert.equal(failed.changes[part].saved, false);
    const successful = new Map(storage.writes);
    storage.blocked.clear();
    const recovered = submit(token, answer, storage);
    assert.equal(recovered.saved, true); assert.equal(recovered.changes[part].saved, true);
    for (const [key, count] of successful) assert.equal(storage.writes.get(key), count, key);
    const writes = [...storage.writes]; submit(token, answer, storage);
    assert.deepEqual([...storage.writes], writes);
    assert.equal(loadStats(storage).total, 1);
  });
}

test('failed weakness persistence cannot emit recovery; retry emits only after the receipt is saved', () => {
  const storage = store(); wrong(storage); storage.blocked.add(keys.weak);
  const token = attempt(question(), 'review');
  const first = submit(token, '000000', storage);
  assert.equal(first.recovery, null); assert.equal(first.changes.achievement.applicable, false);
  assert.equal(storage.values.has(keys.achievement), false);
  storage.blocked.clear();
  assert.equal(submit(token, '000000', storage).changes.achievement.saved, true);
  assert.equal(loadAchievementState(storage).metrics.quizRecoveries.length, 1);
});

test('legacy answer only clears its summary and never fabricates concrete recovery', () => {
  const storage = store(); storage.values.set(keys.legacy, '["111111","000000"]');
  const result = submit(attempt(question(), 'legacy'), '000000', storage);
  assert.equal(result.saved, true); assert.equal(result.recovery, null);
  assert.equal(result.changes.weak.applicable, false); assert.equal(result.changes.achievement.applicable, false);
  assert.deepEqual(JSON.parse(storage.values.get(keys.legacy)), ['000000']);
  assert.equal(storage.values.has(keys.weak), false);
});

test('unreadable and malformed supporting stores are not overwritten', () => {
  for (const part of ['review', 'activity', 'achievement', 'legacy']) {
    for (const unreadable of [true, false]) {
      const storage = store();
      const mode = part === 'legacy' ? 'legacy' : part === 'achievement' ? 'review' : 'random';
      if (part === 'achievement') wrong(storage);
      storage.values.set(keys[part], '{broken');
      if (unreadable) storage.unreadable.add(keys[part]);
      const result = submit(attempt(question(), mode), mode === 'random' ? '111111' : '000000', storage);
      assert.equal(result.changes[part].saved, false, part);
      assert.equal(storage.values.get(keys[part]), '{broken');
      assert.equal(storage.writes.get(keys[part]) || 0, 0);
    }
  }
});

test('invalid options and answers do not write; a round locks the first valid answer and copies its question', () => {
  const storage = store(); const q = question(); const token = attempt(q);
  q.answer = '111111'; q.reference.questionType = 'name';
  assert.equal(submit(token, 'invalid', storage).saved, false); assert.equal(storage.writes.size, 0);
  assert.equal(submit(token, '000000', storage).correct, true);
  const writes = [...storage.writes];
  assert.equal(submit(token, '111111', storage).saved, false);
  assert.deepEqual([...storage.writes], writes);
  assert.equal(session.createQuizAttempt(null), null);
  assert.equal(session.createQuizAttempt(question(), { mode: 'invalid' }), null);
  assert.equal(session.createQuizAttempt({ ...question(), reference: { ...question().reference, questionVersion: 'old' } }), null);
});

test('stored duplicate recovery uses its original receipt after a new mistake', () => {
  const storage = store(); wrong(storage);
  const first = submit(attempt(question(), 'review'), '000000', storage);
  wrong(storage, question(), 'later-wrong');
  const replay = submit(attempt(question(), 'review'), '000000', storage);
  assert.deepEqual(replay.recovery, first.recovery);
  assert.equal(loadStats(storage).total, 1);
  assert.equal(loadLearningRecord(storage).weakQuestions[question().reference.questionId].status, 'due');
  assert.equal(loadAchievementState(storage).metrics.quizRecoveries.length, 1);
});

test('an ID bound to a different stored question rejects all new effects', () => {
  const storage = store();
  submit(attempt(), '111111', storage);
  const other = { ...generateQuestion(hexagrams, 'name', '101010'),
    candidates: ['000000', '111111', '101010', '010101'] };
  const before = [...storage.values];
  assert.equal(submit(attempt(other), '000000', storage).saved, false);
  assert.deepEqual([...storage.values], before);
});

test('malformed question options return a safe invalid attempt', () => {
  assert.equal(session.createQuizAttempt({ ...question(), candidates: {} }), null);
  assert.equal(session.createQuizAttempt(question(), null), null);
  assert.equal(session.createQuizAttempt(question(), { now: new Date('invalid') }), null);
  assert.equal(session.submitQuizAttempt(attempt(), '000000', null).saved, false);
});

test('old same-ID weakness without a receipt does not fabricate statistics or other effects', () => {
  for (const correct of [true, false]) {
    const storage = store(); wrong(storage, question(), 'current');
    const record = loadLearningRecord(storage); delete record.quizAttempts;
    storage.values.set(keys.weak, JSON.stringify(record)); storage.writes.clear();
    const before = [...storage.values];
    assert.equal(submit(attempt(question(), 'review'), correct ? '000000' : '111111', storage).saved, false);
    assert.deepEqual([...storage.values], before); assert.equal(storage.writes.size, 0);
  }
});

test('inherited object names are not treated as existing attempt receipts', () => {
  const storage = store(); submit(attempt(question(), 'random', 'other'), '111111', storage);
  for (const id of ['__proto__', 'constructor', 'toString']) {
    assert.equal(submit(attempt(question(), 'review', id), '000000', storage).saved, true, id);
    assert.equal(Object.hasOwn(loadStats(storage).attempts, id), true);
    assert.equal(Object.hasOwn(loadLearningRecord(storage).quizAttempts, id), true);
  }
});

test('accepted long term IDs can save both directions of recovery without exceeding event limits', () => {
  const storage = store(); const termId = 't'.repeat(120);
  const data = [{ id: termId, name: '长标识术语', category: '测试', meaning: '长标识仍可精确回练。' }, ...terms];
  for (const [index, direction] of ['name-to-meaning', 'meaning-to-name'].entries()) {
    const q = generateAlmanacQuestion(data, { termId, direction });
    assert.ok(q.reference.questionId.length > 128);
    wrong(storage, q, `long-wrong-${index}`);
    const token = attempt(q, 'review', `long-review-${index}`);
    const result = submit(token, termId, storage);
    assert.equal(result.saved, true);
    assert.equal(result.recovery.reference.questionId, q.reference.questionId);
    assert.equal(submit(token, termId, storage).saved, true);
  }
  const recoveries = loadAchievementState(storage).metrics.quizRecoveries;
  assert.equal(recoveries.length, 2);
  assert.equal(new Set(recoveries).size, 2);
  assert.ok(recoveries.every(id => id.length <= 128));
});
