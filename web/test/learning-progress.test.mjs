import assert from 'node:assert/strict';
import test from 'node:test';
import * as learningProgress from '../js/learning-progress.js';
import {
  calculateLessonMastery,
  calculateStreak,
  getActivityKey,
  getLearningRank,
  getLearningRecordKey,
  isLearningRecord,
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

test('正式考评ID与成绩原子保存，历史截断后仍能判重', () => {
  const storage = createStorage();
  const assessment = { correct: 1, total: 1, results: [] };
  for (let index = 0; index < 81; index += 1) {
    assert.equal(recordLearningAssessment('spot', { ...assessment, sessionId: `round-${index}` }, new Date(), storage).saved, true);
  }
  const record = loadLearningRecord(storage);
  assert.equal(record.spotChecks.length, 80);
  assert.equal(record.processedAssessmentIds.length, 81);
  assert.equal(record.processedAssessmentIds[0], 'round-0');
  assert.equal(recordLearningAssessment('spot', { ...assessment, sessionId: 'round-0' }, new Date(), storage).duplicate, true);
  assert.deepEqual(loadLearningRecord(storage), record);
});

test('只有已处理ID而没有成绩凭据时不重新计分或补造凭据', () => {
  const record = { version: 2, lessons: { 'l1-1': { attempts: 2, bestScore: 0.5 } }, spotChecks: [], exams: [], oralReviews: [], processedAssessmentIds: ['already'] };
  const storage = createStorage({ [getLearningRecordKey()]: JSON.stringify(record) });
  const before = storage.getItem(getLearningRecordKey());
  const result = recordLearningAssessment('lesson', { sessionId: 'already', lessonId: 'l1-1', correct: 1, total: 1 }, new Date(), storage);
  assert.equal(result.duplicate, true);
  assert.equal(result.saved, true);
  assert.equal(result.evidenceMissing, true);
  assert.equal(result.entry, null);
  assert.equal(storage.getItem(getLearningRecordKey()), before);
});

test('旧真实session凭据只迁移ID，不重计成绩；无字段旧记录保持兼容', () => {
  const receipt = { sessionId: 'existing', kind: 'lesson', lessonId: 'l1-1', at: '2026-10-25T00:00:00Z', correct: 1, total: 2 };
  const record = { version: 2, lessons: { 'l1-1': { attempts: 1, bestScore: 0.5 } }, spotChecks: [], exams: [], oralReviews: [], assessmentSessions: [receipt] };
  const storage = createStorage({ [getLearningRecordKey()]: JSON.stringify(record) });
  assert.deepEqual(loadLearningRecord(storage).processedAssessmentIds, ['existing']);
  assert.equal(JSON.parse(storage.getItem(getLearningRecordKey())).processedAssessmentIds, undefined, '读取不触发写回');
  const repeated = recordLearningAssessment('lesson', { sessionId: 'existing', lessonId: 'l1-1', correct: 2, total: 2 }, new Date(), storage);
  assert.equal(repeated.duplicate, true);
  assert.deepEqual(repeated.entry, receipt);
  assert.equal(repeated.record.lessons['l1-1'].attempts, 1);
  markLessonViewed('l1-2', new Date(), storage);
  assert.deepEqual(JSON.parse(storage.getItem(getLearningRecordKey())).processedAssessmentIds, ['existing']);
});

test('损坏的正式ID字段保留有效旧成绩且不允许后续写入覆盖', () => {
  for (const ids of [null, 'bad', [''], ['   '], ['a', 'a'], ['x'.repeat(121)], [42]]) {
    const record = { version: 2, lessons: { 'l1-1': { attempts: 3, bestScore: 1 } }, spotChecks: [], exams: [], oralReviews: [], processedAssessmentIds: ids };
    const raw = JSON.stringify(record);
    const storage = createStorage({ [getLearningRecordKey()]: raw });
    assert.equal(isLearningRecord(record), false);
    assert.equal(loadLearningRecord(storage).lessons['l1-1'].attempts, 3);
    assert.equal(markLessonViewed('l1-2', new Date(), storage).saved, false);
    assert.equal(recordLearningAssessment('lesson', { sessionId: 'new', lessonId: 'l1-1', correct: 1, total: 1 }, new Date(), storage).saved, false);
    assert.equal(recordOralReview('l1-1', 80, 'self', new Date(), storage).saved, false);
    assert.equal(storage.getItem(getLearningRecordKey()), raw);
  }
});

test('新考评拒绝非法ID，写失败不先消费ID', () => {
  const storage = createStorage();
  for (const sessionId of ['', ' ', 2, 'x'.repeat(121)]) {
    assert.equal(recordLearningAssessment('spot', { sessionId, correct: 1, total: 1 }, new Date(), storage).saved, false);
    assert.equal(storage.getItem(getLearningRecordKey()), null);
  }
  const originalSet = storage.setItem;
  storage.setItem = () => { throw new Error('quota'); };
  const assessment = { sessionId: 'x'.repeat(120), correct: 1, total: 1 };
  assert.equal(recordLearningAssessment('spot', assessment, new Date(), storage).saved, false);
  assert.equal(storage.getItem(getLearningRecordKey()), null);
  storage.setItem = originalSet;
  assert.equal(recordLearningAssessment('spot', assessment, new Date(), storage).saved, true);
  assert.deepEqual(loadLearningRecord(storage).processedAssessmentIds, [assessment.sessionId]);
  assert.equal(loadLearningRecord(storage).spotChecks.length, 1);
});

test('另一课程的真实旧成绩不因已迁移session而丢失兼容凭据', () => {
  const at = '2026-08-07T08:00:00.000Z';
  const storage = createStorage({ [getLearningRecordKey()]: JSON.stringify({
    version: 2, lessons: { 'l1-1': { viewedAt: at, lastStudiedAt: at, attempts: 1, bestScore: 1 } },
    spotChecks: [], exams: [], oralReviews: [],
  }) });
  recordLearningAssessment('lesson', { sessionId: 'other-lesson', lessonId: 'l1-2', correct: 1, total: 1 }, new Date(), storage);
  recordLearningAssessment('lesson', { sessionId: 'new-l1-1', lessonId: 'l1-1', correct: 0, total: 1 }, new Date(), storage);
  assert.deepEqual(loadLearningRecord(storage).lessons['l1-1'].legacyAssessment, { score: 1, at });
});

test('已处理ID对应其他范围的凭据时不能当作当前卷成绩', () => {
  const storage = createStorage();
  recordLearningAssessment('lesson', { sessionId: 'same-id', lessonId: 'l1-1', correct: 1, total: 1 }, new Date(), storage);
  const result = recordLearningAssessment('lesson', { sessionId: 'same-id', lessonId: 'l1-2', correct: 1, total: 1 }, new Date(), storage);
  assert.equal(result.duplicate, true);
  assert.equal(result.evidenceMissing, true);
  assert.equal(result.entry, null);
  assert.equal(result.record.lessons['l1-2'], undefined);
});

const weakAt = '2026-10-25T03:00:00.000Z';

function courseResult(overrides = {}) {
  return {
    questionId: 'theory-yinyang-name', lessonId: 'l1-1', correct: false,
    questionVersion: 'curriculum-v1', questionType: 'recall', targetCode: null, termId: null,
    ...overrides,
  };
}

function courseAssessment(sessionId, results = [courseResult()], overrides = {}) {
  return {
    sessionId, lessonId: 'l1-1', levelId: 'L1',
    correct: results.filter((result) => result.correct).length, total: results.length, results,
    ...overrides,
  };
}

function weakEntry(overrides = {}) {
  const { correct, ...reference } = courseResult();
  return {
    ...reference, sourceKind: 'course', firstWrongAt: weakAt, lastWrongAt: weakAt,
    lastSessionId: 'original', wrongCount: 1, status: 'due', lastReviewedAt: null, resolvedAt: null,
    ...overrides,
  };
}

function recordWithWeak(weakQuestions) {
  return {
    version: 2, lessons: { 'l1-1': { attempts: 2, bestScore: 0.5 } },
    spotChecks: [], exams: [], oralReviews: [], weakQuestions,
  };
}

test('三类正式交卷将成绩、ID、凭据和课程弱项一次写入，只保存公开引用', () => {
  for (const kind of ['lesson', 'spot', 'exam']) {
    const storage = createStorage();
    const writes = [];
    const setItem = storage.setItem;
    storage.setItem = (key, value) => { writes.push(key); setItem(key, value); };
    const results = [
      courseResult({ picked: 0, answer: 1, prompt: '不持久化题干', privateText: '不持久化私文' }),
      ...(kind === 'lesson' ? [] : [
        courseResult({ questionId: 'hex-111111-evidence', lessonId: 'l2-1', questionType: 'evidence', targetCode: '111111' }),
        courseResult({ questionId: 'term-jianchu-name', lessonId: 'l5-1', termId: 'jianchu' }),
      ]),
      courseResult({ questionId: 'never-wrong', correct: true }),
    ];
    const result = recordLearningAssessment(kind, courseAssessment(`${kind}-weak`, results), new Date(weakAt), storage);
    assert.equal(result.saved, true);
    assert.deepEqual(writes, [getLearningRecordKey()]);
    const saved = loadLearningRecord(storage);
    assert.deepEqual(saved.processedAssessmentIds, [`${kind}-weak`]);
    assert.equal(saved.assessmentSessions.length, 1);
    assert.deepEqual(saved.weakQuestions['theory-yinyang-name'], weakEntry({ lastSessionId: `${kind}-weak` }));
    assert.equal(saved.weakQuestions['never-wrong'], undefined);
    assert.equal(storage.getItem('yijing-review-cards'), null);
    assert.equal(storage.getItem('yijing.achievements.v1'), null);
    if (kind !== 'lesson') {
      assert.equal(saved.weakQuestions['hex-111111-evidence'].targetCode, '111111');
      assert.equal(saved.weakQuestions['term-jianchu-name'].termId, 'jianchu');
      const entry = (kind === 'spot' ? saved.spotChecks : saved.exams)[0];
      assert.deepEqual(entry.results[0], courseResult());
    }
  }
});

test('同题错误按新会话归并，只有同题同版本答对纠正，再错重新待练', () => {
  const storage = createStorage();
  const key = 'theory-yinyang-name';
  const submit = (id, day, results = [courseResult()]) => recordLearningAssessment(
    'lesson', courseAssessment(id, results), new Date(`2026-10-${day}T03:00:00.000Z`), storage,
  );
  submit('first', '25');
  submit('second', '26');
  const second = loadLearningRecord(storage);
  assert.equal(second.weakQuestions[key].wrongCount, 2);
  assert.equal(second.weakQuestions[key].firstWrongAt, weakAt);
  assert.equal(second.weakQuestions[key].lastWrongAt, '2026-10-26T03:00:00.000Z');
  assert.equal(submit('first', '27').duplicate, true);
  assert.deepEqual(loadLearningRecord(storage), second);
  submit('other-right', '27', [courseResult({ questionId: 'another-question', correct: true })]);
  assert.deepEqual(loadLearningRecord(storage).weakQuestions[key], second.weakQuestions[key]);
  markLessonViewed('l1-1', new Date('2026-10-27T04:00:00Z'), storage);
  assert.deepEqual(loadLearningRecord(storage).weakQuestions[key], second.weakQuestions[key], '打开课程不纠正');
  submit('correct', '28', [courseResult({ correct: true })]);
  const resolved = loadLearningRecord(storage).weakQuestions[key];
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.lastSessionId, 'correct');
  assert.equal(resolved.lastReviewedAt, '2026-10-28T03:00:00.000Z');
  assert.equal(resolved.resolvedAt, resolved.lastReviewedAt);
  assert.equal(resolved.wrongCount, 2);
  assert.equal(resolved.lastWrongAt, second.weakQuestions[key].lastWrongAt);
  submit('wrong-again', '29');
  const reopened = loadLearningRecord(storage).weakQuestions[key];
  assert.equal(reopened.status, 'due');
  assert.equal(reopened.resolvedAt, null);
  assert.equal(reopened.wrongCount, 3);
  assert.equal(reopened.lastReviewedAt, resolved.lastReviewedAt);
  assert.equal(reopened.firstWrongAt, weakAt);
});

test('不同版本、来源或定位不覆盖旧弱项；历史不存在题号仍可读', () => {
  for (const entry of [
    weakEntry({ questionVersion: 'curriculum-v0' }),
    weakEntry({ sourceKind: 'quiz', questionType: 'name', targetCode: '111111' }),
    weakEntry({ lessonId: 'retired-course' }),
    weakEntry({ questionType: 'evidence' }),
    weakEntry({ targetCode: '000000' }),
    weakEntry({ termId: 'retired-term' }),
  ]) {
    const storage = createStorage({ [getLearningRecordKey()]: JSON.stringify(recordWithWeak({ [entry.questionId]: entry })) });
    for (const correct of [true, false]) {
      assert.equal(recordLearningAssessment('lesson', courseAssessment(`new-${correct}`, [courseResult({ correct })]), new Date(), storage).saved, true);
      assert.deepEqual(loadLearningRecord(storage).weakQuestions[entry.questionId], entry);
    }
  }
  const historical = weakEntry({ questionId: 'removed-question', lessonId: 'retired-course', questionVersion: 'future-v2' });
  assert.equal(isLearningRecord(recordWithWeak({ [historical.questionId]: historical })), true);
});

test('旧结果、无凭据ID和旧凭据不按当前题卷补造弱项', () => {
  const storage = createStorage();
  const old = { questionId: 'theory-yinyang-name', lessonId: 'l1-1', correct: false };
  assert.equal(recordLearningAssessment('lesson', courseAssessment('old', [old]), new Date(), storage).saved, true);
  assert.equal(loadLearningRecord(storage).weakQuestions, undefined);
  assert.equal(recordLearningAssessment('lesson', courseAssessment('old'), new Date(), storage).duplicate, true);
  assert.equal(loadLearningRecord(storage).weakQuestions, undefined);
  const onlyId = { ...recordWithWeak(undefined), processedAssessmentIds: ['only-id'] };
  storage.setItem(getLearningRecordKey(), JSON.stringify(onlyId));
  const before = storage.getItem(getLearningRecordKey());
  const result = recordLearningAssessment('lesson', courseAssessment('only-id'), new Date(), storage);
  assert.equal(result.evidenceMissing, true);
  assert.equal(storage.getItem(getLearningRecordKey()), before);
});

test('弱项和成绩写入失败一起保留旧状态，同轮重试只入队或纠正一次', () => {
  const storage = createStorage();
  const setItem = storage.setItem;
  let fail = true;
  storage.setItem = (key, value) => { if (fail) throw new Error('quota'); setItem(key, value); };
  const wrong = courseAssessment('retry-wrong');
  assert.equal(recordLearningAssessment('lesson', wrong, new Date(weakAt), storage).saved, false);
  assert.equal(storage.getItem(getLearningRecordKey()), null);
  fail = false;
  assert.equal(recordLearningAssessment('lesson', wrong, new Date(weakAt), storage).saved, true);
  assert.equal(recordLearningAssessment('lesson', wrong, new Date(), storage).duplicate, true);
  const before = storage.getItem(getLearningRecordKey());
  const right = courseAssessment('retry-right', [courseResult({ correct: true })]);
  fail = true;
  assert.equal(recordLearningAssessment('lesson', right, new Date(), storage).saved, false);
  assert.equal(storage.getItem(getLearningRecordKey()), before);
  fail = false;
  assert.equal(recordLearningAssessment('lesson', right, new Date(), storage).saved, true);
  assert.equal(recordLearningAssessment('lesson', right, new Date(), storage).duplicate, true);
  const saved = loadLearningRecord(storage);
  assert.equal(saved.lessons['l1-1'].attempts, 2);
  assert.deepEqual(saved.processedAssessmentIds, ['retry-wrong', 'retry-right']);
  assert.equal(saved.weakQuestions['theory-yinyang-name'].wrongCount, 1);
  assert.equal(saved.weakQuestions['theory-yinyang-name'].status, 'resolved');
});

test('新逐题引用残缺或非法不消费会话，也不保存部分成绩', () => {
  for (const patch of [
    { questionId: '' }, { questionId: 'q'.repeat(161) }, { lessonId: ' ' },
    { questionVersion: undefined }, { questionVersion: 'curriculum-v0' },
    { questionType: 'name' }, { targetCode: '111' }, { targetCode: undefined },
    { termId: '' }, { termId: 1 }, { correct: 'false' },
  ]) {
    const storage = createStorage();
    const assessment = courseAssessment('invalid-reference', [courseResult(patch)], { correct: 0 });
    assert.equal(recordLearningAssessment('lesson', assessment, new Date(), storage).saved, false, JSON.stringify(patch));
    assert.equal(storage.getItem(getLearningRecordKey()), null);
  }
  const storage = createStorage();
  assert.equal(recordLearningAssessment('lesson', courseAssessment(undefined), new Date(), storage).saved, false);
  const partial = { questionId: 'old', lessonId: 'l1-1', correct: false, questionType: 'recall' };
  assert.equal(recordLearningAssessment('lesson', courseAssessment('partial', [partial]), new Date(), storage).saved, false);
});

test('损坏弱项不把有效旧成绩读取为空，所有写入口拒绝覆盖', () => {
  for (const weakQuestions of [null, [], 'bad', { q: weakEntry() }, { 'theory-yinyang-name': weakEntry({ wrongCount: 0 }) }]) {
    const record = recordWithWeak(weakQuestions);
    const raw = JSON.stringify(record);
    const storage = createStorage({ [getLearningRecordKey()]: raw });
    assert.equal(isLearningRecord(record), false);
    assert.equal(loadLearningRecord(storage).lessons['l1-1'].attempts, 2);
    assert.equal(markLessonViewed('l1-2', new Date(), storage).saved, false);
    assert.equal(recordLearningAssessment('lesson', courseAssessment('new'), new Date(), storage).saved, false);
    assert.equal(recordOralReview('l1-1', 80, 'self', new Date(), storage).saved, false);
    assert.equal(storage.getItem(getLearningRecordKey()), raw);
  }
});

test('弱项查询返回稳定的完整条目副本，默认待练并可包含纠正历史', () => {
  assert.equal(typeof learningProgress.getCourseWeakQuestions, 'function');
  assert.equal(typeof learningProgress.getWeakQuestionsError, 'function');
  const entries = [
    weakEntry({ questionId: 'z' }),
    weakEntry({ questionId: 'a', status: 'reviewed', lastReviewedAt: weakAt }),
    weakEntry({ questionId: 'recent', questionVersion: 'future-v2', lastWrongAt: '2026-10-26T03:00:00.000Z' }),
    weakEntry({ questionId: 'resolved', status: 'resolved', resolvedAt: weakAt }),
    weakEntry({ questionId: 'other-source', sourceKind: 'almanac', questionType: 'name-to-meaning', termId: 'old-term' }),
  ];
  const record = recordWithWeak(Object.fromEntries(entries.map((entry) => [entry.questionId, entry])));
  const before = JSON.stringify(record);
  const pending = learningProgress.getCourseWeakQuestions(record);
  assert.deepEqual(pending.map((entry) => entry.questionId), ['recent', 'a', 'z']);
  assert.deepEqual(pending[0], entries[2]);
  pending[0].wrongCount = 99;
  assert.equal(JSON.stringify(record), before);
  assert.equal(learningProgress.getCourseWeakQuestions(record, { includeResolved: true }).length, 4);
  assert.deepEqual(learningProgress.getCourseWeakQuestions({}), []);
  assert.deepEqual(learningProgress.getCourseWeakQuestions(recordWithWeak([])), []);
  assert.equal(learningProgress.getWeakQuestionsError(undefined), null);
  assert.equal(learningProgress.getWeakQuestionsError({ q: weakEntry() }), 'weakQuestions[q].questionId');
});

test('八十条成绩截断不丢弱项与去重证据，特殊题号不写入原型', () => {
  const storage = createStorage();
  const result = courseResult({ questionId: '__proto__' });
  for (let index = 0; index < 81; index += 1) {
    assert.equal(recordLearningAssessment('spot', courseAssessment(`weak-${index}`, [result]), new Date(weakAt), storage).saved, true);
  }
  const saved = loadLearningRecord(storage);
  assert.equal(saved.spotChecks.length, 80);
  assert.equal(Object.hasOwn(saved.weakQuestions, '__proto__'), true);
  assert.equal(saved.weakQuestions.__proto__.wrongCount, 81);
  assert.equal(recordLearningAssessment('spot', courseAssessment('weak-0', [result]), new Date(), storage).duplicate, true);
  assert.deepEqual(loadLearningRecord(storage), saved);
  assert.equal({}.wrongCount, undefined);
});

test('同一会话同题只增加一次，错误计数达到安全整数边界时拒绝整次保存', () => {
  const storage = createStorage();
  const repeated = courseAssessment('same-question', [courseResult(), courseResult()]);
  assert.equal(recordLearningAssessment('spot', repeated, new Date(weakAt), storage).saved, true);
  assert.equal(loadLearningRecord(storage).weakQuestions['theory-yinyang-name'].wrongCount, 1);
  const full = recordWithWeak({ 'theory-yinyang-name': weakEntry({ wrongCount: Number.MAX_SAFE_INTEGER }) });
  storage.setItem(getLearningRecordKey(), JSON.stringify(full));
  const before = storage.getItem(getLearningRecordKey());
  assert.equal(recordLearningAssessment('lesson', courseAssessment('overflow'), new Date(), storage).saved, false);
  assert.equal(storage.getItem(getLearningRecordKey()), before);
});

test('历史来源只校验非空类型，不擅自限制旧课程或术语标识长度', () => {
  const entry = weakEntry({
    questionId: 'q'.repeat(160), questionVersion: 'v'.repeat(120),
    lessonId: 'old-'.repeat(50), termId: 'term-'.repeat(40), questionType: 'old-type-'.repeat(20),
  });
  assert.equal(isLearningRecord(recordWithWeak({ [entry.questionId]: entry })), true);
});

test('新题引用必须属于存在的课程，小试不接受另一课结果，旧无元数据仍兼容', () => {
  for (const kind of ['lesson', 'spot', 'exam']) {
    const storage = createStorage();
    const assessment = courseAssessment(`missing-${kind}`, [courseResult({ lessonId: 'removed-course' })]);
    assert.equal(recordLearningAssessment(kind, assessment, new Date(), storage).saved, false);
    assert.equal(storage.getItem(getLearningRecordKey()), null);
  }
  const storage = createStorage();
  assert.equal(recordLearningAssessment('lesson', courseAssessment('other-course', [courseResult({ lessonId: 'l1-2' })]), new Date(), storage).saved, false);
  assert.equal(storage.getItem(getLearningRecordKey()), null);
  const old = { questionId: 'old', lessonId: 'removed-course', correct: false };
  assert.equal(recordLearningAssessment('lesson', courseAssessment('legacy', [old], { lessonId: 'removed-course' }), new Date(), storage).saved, true);
  assert.equal(loadLearningRecord(storage).weakQuestions, undefined);
});

test('同题的新引用或正确值冲突时拒绝整次写入，不依赖逐题数组顺序', () => {
  for (const patch of [
    { correct: true }, { lessonId: 'l1-2' }, { targetCode: '111111' }, { questionType: 'evidence' }, { termId: 'old-term' },
  ]) {
    for (const results of [[courseResult(), courseResult(patch)], [courseResult(patch), courseResult()]]) {
      const storage = createStorage();
      assert.equal(recordLearningAssessment('spot', courseAssessment('conflict', results), new Date(), storage).saved, false);
      assert.equal(storage.getItem(getLearningRecordKey()), null);
    }
  }
});
