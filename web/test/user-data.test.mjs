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
