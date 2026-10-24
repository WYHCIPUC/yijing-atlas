import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateLessonMastery,
  calculateStreak,
  getActivityKey,
  getLearningRank,
  getLearningRecordKey,
  loadActivity,
  loadLearningRecord,
  markLessonViewed,
  recordActivity,
  recordLearningAssessment,
  recordOralReview,
  summarizeLearning,
} from '../js/learning-progress.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('记录学习日并计算包含今天的连续天数', () => {
  const storage = createStorage();
  recordActivity(new Date(2026, 7, 4, 12), storage);
  recordActivity(new Date(2026, 7, 5, 12), storage);
  const result = recordActivity(new Date(2026, 7, 6, 12), storage);
  assert.equal(result.saved, true);
  assert.equal(calculateStreak(result.days, new Date(2026, 7, 6, 20)), 3);
  assert.equal(calculateStreak(result.days, new Date(2026, 7, 7, 8)), 3);
  assert.equal(calculateStreak(result.days, new Date(2026, 7, 8, 8)), 0);
});

test('活动记录去重、损坏回退和失败写入可感知', () => {
  const key = getActivityKey();
  const storage = createStorage({ [key]: '{broken' });
  assert.deepEqual(loadActivity(storage), { days: [] });
  recordActivity(new Date(2026, 0, 1), storage);
  recordActivity(new Date(2026, 0, 1), storage);
  assert.deepEqual(loadActivity(storage).days, ['2026-01-01']);
  const failing = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.equal(recordActivity(new Date(2026, 0, 1), failing).saved, false);
});

test('旧版学习进度迁移为已浏览，并写入新版课程记录', () => {
  const storage = createStorage({ 'yijing.study.v1': JSON.stringify({ 'l1-1': true, 'l1-2': false }) });
  const migrated = loadLearningRecord(storage);
  assert.ok(migrated.lessons['l1-1'].viewedAt);
  assert.equal(migrated.lessons['l1-2'], undefined);
  const result = markLessonViewed('l1-2', new Date('2026-08-07T08:00:00.000Z'), storage);
  assert.equal(result.saved, true);
  assert.equal(loadLearningRecord(storage).lessons['l1-2'].lastStudiedAt, '2026-08-07T08:00:00.000Z');
  assert.equal(getLearningRecordKey(), 'yijing-learning-record-v2');
});

test('小试、抽查、复讲和阶段考评共同形成掌握度', () => {
  const storage = createStorage();
  const now = new Date('2026-08-07T08:00:00.000Z');
  markLessonViewed('l1-1', now, storage);
  recordLearningAssessment('lesson', {
    lessonId: 'l1-1', correct: 2, total: 3,
    results: [{ lessonId: 'l1-1', correct: true }],
  }, now, storage);
  recordLearningAssessment('spot', {
    correct: 1, total: 2,
    results: [{ lessonId: 'l1-1', correct: true }, { lessonId: 'l1-1', correct: false }],
  }, now, storage);
  recordLearningAssessment('exam', {
    levelId: 'L1', correct: 1, total: 1,
    results: [{ lessonId: 'l1-1', correct: true }],
  }, now, storage);
  recordOralReview('l1-1', 80, 'self', now, storage);
  const record = loadLearningRecord(storage);
  assert.equal(calculateLessonMastery(record, 'l1-1'), 75);
  const summary = summarizeLearning(record, [{ id: 'l1-1' }, { id: 'l1-2' }]);
  assert.equal(summary.viewed, 1);
  assert.equal(summary.checked, 1);
  assert.equal(summary.mastery, 38);
  assert.equal(summary.rank.label, '蒙学');
});

test('学习记录拒绝无效评定，学阶覆盖全部阈值', () => {
  const storage = createStorage();
  assert.equal(recordLearningAssessment('lesson', { lessonId: 'l1-1', correct: 2, total: 1 }, new Date(), storage).saved, false);
  assert.equal(recordLearningAssessment('exam', { correct: 0, total: 1 }, new Date(), storage).saved, false);
  assert.equal(recordOralReview('l1-1', 101, 'self', new Date(), storage).saved, false);
  assert.deepEqual([0, 20, 40, 60, 80].map((score) => getLearningRank(score).label),
    ['初闻', '蒙学', '习读', '明辨', '通达']);
});

test('同一session重复保存只计一次，下一轮相同成绩仍独立计入', () => {
  for (const kind of ['lesson', 'spot', 'exam']) {
    const storage = createStorage();
    const assessment = {
      sessionId: `${kind}-first`, kind, lessonId: 'l1-1', levelId: 'L1', correct: 1, total: 1,
      results: [{ questionId: 'q1', lessonId: 'l1-1', correct: true }],
    };
    const first = recordLearningAssessment(kind, assessment, new Date('2026-08-07T08:00:00Z'), storage);
    const duplicate = recordLearningAssessment(kind, assessment, new Date('2026-08-07T08:01:00Z'), storage);
    assert.equal(first.saved, true);
    assert.equal(duplicate.saved, true);
    assert.equal(duplicate.duplicate, true);
    assert.deepEqual(duplicate.record, first.record);
    recordLearningAssessment(kind, { ...assessment, sessionId: `${kind}-second` }, new Date('2026-08-07T08:02:00Z'), storage);
    const record = loadLearningRecord(storage);
    if (kind === 'lesson') assert.equal(record.lessons['l1-1'].attempts, 2);
    else {
      const history = kind === 'spot' ? record.spotChecks : record.exams;
      assert.equal(history.length, 2);
      assert.equal(history[0].sessionId, assessment.sessionId);
      assert.equal(history[0].results[0].questionId, 'q1');
    }
  }
});

test('保存失败后原session重试只增加一次，旧记录读取不补造session', () => {
  const storage = createStorage();
  const setItem = storage.setItem;
  let blocked = true;
  storage.setItem = (key, value) => {
    if (blocked) throw new Error('quota');
    return setItem(key, value);
  };
  const assessment = {
    sessionId: 'retry-round', lessonId: 'l1-1', correct: 1, total: 1,
    results: [{ questionId: 'q1', lessonId: 'l1-1', correct: true }],
  };
  assert.equal(recordLearningAssessment('lesson', assessment, new Date('2026-08-07T08:00:00Z'), storage).saved, false);
  assert.equal(loadLearningRecord(storage).lessons['l1-1'], undefined);
  blocked = false;
  assert.equal(recordLearningAssessment('lesson', assessment, new Date('2026-08-07T08:01:00Z'), storage).saved, true);
  assert.equal(recordLearningAssessment('lesson', assessment, new Date('2026-08-07T08:02:00Z'), storage).duplicate, true);
  assert.equal(loadLearningRecord(storage).lessons['l1-1'].attempts, 1);

  const oldRecord = { version: 2, lessons: { 'l1-1': { attempts: 2, bestScore: 0.5 } }, spotChecks: [], exams: [], oralReviews: [] };
  const oldStorage = createStorage({ [getLearningRecordKey()]: JSON.stringify(oldRecord) });
  assert.deepEqual(loadLearningRecord(oldStorage), oldRecord);
});
