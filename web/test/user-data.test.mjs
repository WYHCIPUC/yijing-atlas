import assert from 'node:assert/strict';
import test from 'node:test';
import { createAchievementState } from '../js/achievement-engine.js';
import { USER_DATA_KEYS, exportUserData, importUserData, parseUserData } from '../js/user-data.js';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('导出仅包含项目数据并可重新导入', () => {
  const source = storage({
    'yijing.study.v1': '{"l1-1":true}',
    'yijing-learning-record-v2': '{"version":2,"lessons":{},"spotChecks":[],"exams":[],"oralReviews":[]}',
    'yijing-learning-review-config-v1': '{"endpoint":"/api/learning-review"}',
    unrelated: 'secret',
  });
  const snapshot = exportUserData(source);
  assert.equal(snapshot.format, 'yijing-atlas-user-data');
  assert.deepEqual(snapshot.data['yijing.study.v1'], { 'l1-1': true });
  assert.equal(snapshot.data['yijing-learning-record-v2'].version, 2);
  assert.equal(snapshot.data['yijing-learning-review-config-v1'].endpoint, '/api/learning-review');
  assert.equal(snapshot.data.unrelated, undefined);

  const target = storage();
  importUserData(snapshot, target);
  assert.equal(target.getItem('yijing.study.v1'), '{"l1-1":true}');
});

test('解析会拒绝损坏、超限或未知版本的备份', () => {
  assert.throws(() => parseUserData('{broken'), /有效的 JSON/);
  assert.throws(() => parseUserData(JSON.stringify({ format: 'other', version: 1, data: {} })), /不受支持/);
  assert.throws(() => parseUserData(JSON.stringify({
    format: 'yijing-atlas-user-data', version: 1, data: { 'yijing-quiz-wrong': {} },
  })), /数据类型无效/);
  assert.throws(() => parseUserData('x'.repeat(1024 * 1024 + 1)), /超过 1 MB/);
});

test('导入忽略未知键并按 null 删除已知键', () => {
  const target = storage({ 'yijing-notes': '{"1":"旧笔记"}', unrelated: 'keep' });
  importUserData({
    format: 'yijing-atlas-user-data',
    version: 1,
    data: { 'yijing-notes': null, unrelated: 'replace' },
  }, target);
  assert.equal(target.getItem('yijing-notes'), null);
  assert.equal(target.getItem('unrelated'), 'keep');
});

test('坏复习卡在写入前被拒绝且不会覆盖旧数据', () => {
  const previous = JSON.stringify({
    '111111': {
      code: '111111', stage: 1, due: 1, introducedAt: 1,
      lapses: 0, reps: 1, lastReview: 1,
    },
  });
  const target = storage({ 'yijing-review-cards': previous });
  assert.throws(() => importUserData({
    format: 'yijing-atlas-user-data',
    version: 1,
    data: { 'yijing-review-cards': { '111111': 'bad' } },
  }, target), /yijing-review-cards/);
  assert.equal(target.getItem('yijing-review-cards'), previous);
});

test('通用备份包含成就状态并可完整往返', () => {
  const state = createAchievementState();
  const source = storage({ 'yijing.achievements.v1': JSON.stringify(state) });
  const snapshot = exportUserData(source);
  assert.deepEqual(snapshot.data['yijing.achievements.v1'], state);

  const target = storage();
  importUserData(snapshot, target);
  assert.deepEqual(JSON.parse(target.getItem('yijing.achievements.v1')), state);
});

test('正式考评ID随备份往返，旧备份缺字段仍合法', () => {
  const key = 'yijing-learning-record-v2';
  const record = { version: 2, lessons: { 'l1-1': { attempts: 1, bestScore: 1 } }, spotChecks: [], exams: [], oralReviews: [], processedAssessmentIds: ['one', 'x'.repeat(120)] };
  const source = storage({ [key]: JSON.stringify(record) });
  const target = storage();
  importUserData(parseUserData(JSON.stringify(exportUserData(source))), target);
  assert.deepEqual(JSON.parse(target.getItem(key)), record);
  delete record.processedAssessmentIds;
  assert.doesNotThrow(() => importUserData({ format: 'yijing-atlas-user-data', version: 1, data: { [key]: record } }, target));
});

test('导入拒绝损坏考评ID并定位具体字段或元素，拒绝前不写其他键', () => {
  const key = 'yijing-learning-record-v2';
  const previous = JSON.stringify({ version: 2, lessons: { 'l1-1': { attempts: 4 } }, spotChecks: [], exams: [], oralReviews: [] });
  for (const [ids, suffix] of [[null, ''], ['bad', ''], [[''], '[0]'], [['  '], '[0]'], [['a', 'a'], '[1]'], [['x'.repeat(121)], '[0]'], [[1], '[0]']]) {
    const target = storage({ [key]: previous, 'yijing.study.v1': '{"old":true}' });
    const snapshot = { format: 'yijing-atlas-user-data', version: 1, data: {
      'yijing.study.v1': { incoming: true }, [key]: { ...JSON.parse(previous), processedAssessmentIds: ids },
    } };
    assert.throws(() => parseUserData(JSON.stringify(snapshot)), (error) => error.message.includes(`${key}.processedAssessmentIds${suffix}`));
    assert.throws(() => importUserData(snapshot, target), (error) => error.message.includes(`${key}.processedAssessmentIds${suffix}`));
    assert.equal(target.getItem(key), previous);
    assert.equal(target.getItem('yijing.study.v1'), '{"old":true}');
  }
});

function weakRecord(overrides = {}) {
  const at = '2026-10-25T03:00:00.000Z';
  const entry = {
    questionId: 'theory-yinyang-name', questionVersion: 'curriculum-v1', sourceKind: 'course',
    lessonId: 'l1-1', questionType: 'recall', targetCode: null, termId: null,
    firstWrongAt: at, lastWrongAt: at, lastSessionId: 'first', wrongCount: 1,
    status: 'due', lastReviewedAt: null, resolvedAt: null, ...overrides,
  };
  return {
    version: 2, lessons: { 'l1-1': { attempts: 1, bestScore: 0 } }, spotChecks: [], exams: [], oralReviews: [],
    processedAssessmentIds: ['first'], weakQuestions: { [entry.questionId]: entry },
  };
}

function weakSnapshot(record) {
  return { format: 'yijing-atlas-user-data', version: 1, data: { 'yijing-learning-record-v2': record } };
}

test('课程弱项按原十一键备份往返，合法历史版本与来源定位不被重写', () => {
  const key = 'yijing-learning-record-v2';
  assert.equal(USER_DATA_KEYS.length, 11);
  for (const entry of [
    {}, { questionId: 'removed-question', questionVersion: 'future-v2', lessonId: 'removed-course', termId: 'removed-term' },
    { sourceKind: 'quiz', lessonId: null, questionType: 'name', targetCode: '111111' },
    { sourceKind: 'almanac', lessonId: 'l5-1', questionType: 'name-to-meaning', termId: 'term-old' },
    { status: 'resolved', resolvedAt: '2026-10-26T03:00:00.000Z' },
  ]) {
    const record = weakRecord(entry);
    const source = storage({ [key]: JSON.stringify(record) });
    const target = storage();
    importUserData(parseUserData(JSON.stringify(exportUserData(source))), target);
    assert.deepEqual(JSON.parse(target.getItem(key)), record);
  }
});

test('非法弱项逐字段定位，导入校验完成前不写任何其他键', () => {
  const key = 'yijing-learning-record-v2';
  const id = 'theory-yinyang-name';
  const cases = [
    [null, 'weakQuestions'], [[], 'weakQuestions'], ['bad', 'weakQuestions'],
    [{ [id]: null }, `weakQuestions[${id}]`],
    ...[
      ['questionId', 'different'], ['questionId', 'q'.repeat(161)],
      ['questionVersion', ''], ['questionVersion', ' '], ['questionVersion', 1], ['questionVersion', 'v'.repeat(121)],
      ['sourceKind', 'unknown'], ['lessonId', null], ['lessonId', ' '], ['questionType', 'name'],
      ['targetCode', '111'], ['targetCode', 111111], ['termId', ''], ['termId', 1],
      ['firstWrongAt', 'yesterday'], ['lastWrongAt', '2026-10-25'], ['lastSessionId', ' '], ['lastSessionId', 's'.repeat(121)],
      ['wrongCount', 0], ['wrongCount', 1.5], ['wrongCount', Number.MAX_SAFE_INTEGER + 1],
      ['status', 'done'], ['lastReviewedAt', 'bad'], ['resolvedAt', 'bad'],
    ].map(([field, value]) => [
      { [id]: { ...weakRecord().weakQuestions[id], [field]: value } }, `weakQuestions[${id}].${field}`,
    ]),
    [{ [id]: { ...weakRecord().weakQuestions[id], status: 'resolved', resolvedAt: null } }, `weakQuestions[${id}].resolvedAt`],
  ];
  for (const [weakQuestions, path] of cases) {
    const previous = JSON.stringify(weakRecord());
    const target = storage({ [key]: previous, 'yijing.study.v1': '{"old":true}' });
    const snapshot = weakSnapshot({ ...weakRecord(), weakQuestions });
    snapshot.data['yijing.study.v1'] = { incoming: true };
    const matches = (error) => error.message.includes(`${key}.${path}`);
    assert.throws(() => parseUserData(JSON.stringify(snapshot)), matches, path);
    assert.throws(() => importUserData(snapshot, target), matches, path);
    assert.equal(target.getItem(key), previous);
    assert.equal(target.getItem('yijing.study.v1'), '{"old":true}');
  }
});

test('旧备份缺弱项合法，学习键按缺失保留、null删除和整键替换恢复', () => {
  const key = 'yijing-learning-record-v2';
  const target = storage({ [key]: JSON.stringify(weakRecord()) });
  const original = target.getItem(key);
  importUserData({ format: 'yijing-atlas-user-data', version: 1, data: {} }, target);
  assert.equal(target.getItem(key), original);
  const old = weakRecord();
  delete old.weakQuestions;
  importUserData(weakSnapshot(old), target);
  assert.equal(JSON.parse(target.getItem(key)).weakQuestions, undefined);
  importUserData(weakSnapshot(null), target);
  assert.equal(target.getItem(key), null);
});

test('导入写失败回滚旧成绩和弱项，其他键也恢复', () => {
  const key = 'yijing-learning-record-v2';
  const previous = JSON.stringify(weakRecord());
  const target = storage({ [key]: previous, 'yijing.study.v1': '{"old":true}' });
  const setItem = target.setItem;
  let blocked = true;
  target.setItem = (name, value) => {
    if (name === key && blocked) { blocked = false; throw new Error('quota'); }
    setItem(name, value);
  };
  const snapshot = weakSnapshot(weakRecord({ wrongCount: 2 }));
  snapshot.data['yijing.study.v1'] = { incoming: true };
  assert.throws(() => importUserData(snapshot, target), /导入失败/);
  assert.equal(target.getItem(key), previous);
  assert.equal(target.getItem('yijing.study.v1'), '{"old":true}');
});

const backupResume = (overrides = {}) => ({
  lessonId: 'l1-1', section: 'read', scrollTop: 125.5, updatedAt: '2026-10-25T08:00:00.000Z', ...overrides,
});

test('续读位置沿原十一键备份往返，旧缺字段和 null 位置兼容', () => {
  const key = 'yijing-learning-record-v2';
  assert.equal(USER_DATA_KEYS.length, 11);
  for (const resume of [undefined, null, backupResume()]) {
    const record = { ...weakRecord(), ...(resume === undefined ? {} : { resume }) };
    const source = storage({ [key]: JSON.stringify(record) });
    const target = storage();
    importUserData(parseUserData(JSON.stringify(exportUserData(source))), target);
    assert.deepEqual(JSON.parse(target.getItem(key)), record);
  }
});

test('非法续读在导入前报告具体路径，不覆盖成绩、旧位置或其他键', () => {
  const key = 'yijing-learning-record-v2';
  const previous = JSON.stringify({ ...weakRecord(), resume: backupResume() });
  const cases = [
    [[], 'resume'], ['bad', 'resume'],
    ...[['lessonId', 'retired-course'], ['lessonId', null], ['section', 'quiz'], ['section', null],
      ['scrollTop', -1], ['scrollTop', 10_000_001], ['scrollTop', '125'], ['scrollTop', NaN], ['scrollTop', Infinity],
      ['updatedAt', '2026-10-25'], ['updatedAt', 'bad'], ['updatedAt', null],
    ].map(([field, value]) => [backupResume({ [field]: value }), `resume.${field}`]),
  ];
  for (const [resume, path] of cases) {
    const target = storage({ [key]: previous, 'yijing.study.v1': '{"old":true}' });
    const snapshot = weakSnapshot({ ...weakRecord(), resume });
    snapshot.data['yijing.study.v1'] = { incoming: true };
    const matches = (error) => error.message.includes(`${key}.${path}`);
    assert.throws(() => parseUserData(JSON.stringify(snapshot)), matches, path);
    assert.throws(() => importUserData(snapshot, target), matches, path);
    assert.equal(target.getItem(key), previous);
    assert.equal(target.getItem('yijing.study.v1'), '{"old":true}');
  }
});

test('含续读的备份写入失败尝试回滚原位置、成绩、弱项和其他键', () => {
  const key = 'yijing-learning-record-v2';
  const previous = JSON.stringify({ ...weakRecord(), resume: backupResume() });
  const target = storage({ [key]: previous, 'yijing.study.v1': '{"old":true}' });
  const originalSet = target.setItem;
  let blocked = true;
  target.setItem = (name, value) => {
    if (name === key && blocked) { blocked = false; throw new Error('quota'); }
    originalSet(name, value);
  };
  const snapshot = weakSnapshot({ ...weakRecord({ wrongCount: 2 }), resume: backupResume({ section: 'apply', scrollTop: 0 }) });
  snapshot.data['yijing.study.v1'] = { incoming: true };
  assert.throws(() => importUserData(snapshot, target), /导入失败/);
  assert.equal(target.getItem(key), previous);
  assert.equal(target.getItem('yijing.study.v1'), '{"old":true}');
});

function quizAttemptRecord() {
  const reference = {
    sourceKind: 'quiz', questionId: 'quiz:opposite:111111', questionVersion: 'quiz-v1',
    questionType: 'opposite', targetCode: '111111', termId: null, lessonId: null,
  };
  return {
    ...weakRecord(), resume: backupResume(),
    quizAttempts: {
      'quiz-review-1': {
        attemptId: 'quiz-review-1', reference, correct: true, mode: 'review',
        at: '2026-10-25T09:00:00.000Z', weakOutcome: 'resolved',
        recoveredFrom: { attemptId: 'quiz-wrong-1', at: '2026-10-25T08:00:00.000Z' },
      },
    },
  };
}

test('自由测验回执与统计按原十一键往返，旧缺字段保持兼容', () => {
  const record = quizAttemptRecord();
  const stats = { total: 2, correct: 1, attempts: {
    'quiz-wrong-1': { questionId: 'quiz:opposite:111111', correct: false },
    'quiz-review-1': { questionId: 'quiz:opposite:111111', correct: true },
  } };
  const source = storage({
    'yijing-learning-record-v2': JSON.stringify(record),
    'yijing-quiz-stats': JSON.stringify(stats), 'yijing-quiz-wrong': '["000000"]',
  });
  const target = storage();
  importUserData(parseUserData(JSON.stringify(exportUserData(source))), target);
  assert.equal(USER_DATA_KEYS.length, 11);
  assert.deepEqual(JSON.parse(target.getItem('yijing-learning-record-v2')), record);
  assert.deepEqual(JSON.parse(target.getItem('yijing-quiz-stats')), stats);
  assert.equal(target.getItem('yijing-quiz-wrong'), '["000000"]');
  const old = weakRecord();
  importUserData(weakSnapshot(old), target);
  assert.equal(JSON.parse(target.getItem('yijing-learning-record-v2')).quizAttempts, undefined);
  assert.deepEqual(JSON.parse(target.getItem('yijing-quiz-stats')), stats);
});

test('坏自由回执导入报告字段位置，验证前不写其他键', () => {
  const key = 'yijing-learning-record-v2';
  const valid = quizAttemptRecord();
  const original = JSON.stringify(valid);
  const receipt = valid.quizAttempts['quiz-review-1'];
  const cases = [
    [null, 'quizAttempts'], [[], 'quizAttempts'],
    [{ other: receipt }, 'quizAttempts[other].attemptId'],
    [{ 'quiz-review-1': { ...receipt, mode: 'course' } }, 'quizAttempts[quiz-review-1].mode'],
    [{ 'quiz-review-1': { ...receipt, recoveredFrom: null } }, 'quizAttempts[quiz-review-1].recoveredFrom'],
    [{ 'quiz-review-1': { ...receipt, recoveredFrom: { attemptId: '', at: receipt.at } } }, 'quizAttempts[quiz-review-1].recoveredFrom.attemptId'],
  ];
  for (const [quizAttempts, path] of cases) {
    const target = storage({ [key]: original, 'yijing.study.v1': '{"old":true}' });
    const snapshot = weakSnapshot({ ...valid, quizAttempts });
    snapshot.data['yijing.study.v1'] = { incoming: true };
    const match = (error) => error.message.includes(`${key}.${path}`);
    assert.throws(() => parseUserData(JSON.stringify(snapshot)), match, path);
    assert.throws(() => importUserData(snapshot, target), match, path);
    assert.equal(target.getItem(key), original);
    assert.equal(target.getItem('yijing.study.v1'), '{"old":true}');
  }
});

test('坏测验统计attempts导入使用引擎字段路径且保持旧值', () => {
  const key = 'yijing-quiz-stats';
  const cases = [
    [null, 'attempts'], [[], 'attempts'],
    [{ a: { questionId: '', correct: false } }, 'attempts[a].questionId'],
    [{ a: { questionId: 'quiz:name:111111', correct: 'false' } }, 'attempts[a].correct'],
  ];
  for (const [attempts, path] of cases) {
    const target = storage({ [key]: '{"total":3,"correct":1}' });
    const snapshot = { format: 'yijing-atlas-user-data', version: 1,
      data: { [key]: { total: 3, correct: 1, attempts } } };
    const match = (error) => error.message.includes(`${key}.${path}`);
    assert.throws(() => parseUserData(JSON.stringify(snapshot)), match, path);
    assert.throws(() => importUserData(snapshot, target), match, path);
    assert.equal(target.getItem(key), '{"total":3,"correct":1}');
  }
});

test('导入回执后续键写失败仍尝试回滚学习与统计两套原证据', () => {
  const key = 'yijing-learning-record-v2';
  const original = JSON.stringify(quizAttemptRecord());
  const originalStats = '{"total":3,"correct":1}';
  const target = storage({ [key]: original, 'yijing-quiz-stats': originalStats });
  const setItem = target.setItem;
  let blocked = true;
  target.setItem = (name, value) => {
    if (name === 'yijing-learning-review-config-v1' && blocked) { blocked = false; throw new Error('quota'); }
    setItem(name, value);
  };
  const incoming = quizAttemptRecord();
  incoming.quizAttempts = {};
  const snapshot = weakSnapshot(incoming);
  snapshot.data['yijing-quiz-stats'] = { total: 0, correct: 0, attempts: {} };
  snapshot.data['yijing-learning-review-config-v1'] = { endpoint: '/api/review' };
  assert.throws(() => importUserData(snapshot, target), /导入失败/);
  assert.equal(target.getItem(key), original);
  assert.equal(target.getItem('yijing-quiz-stats'), originalStats);
});
