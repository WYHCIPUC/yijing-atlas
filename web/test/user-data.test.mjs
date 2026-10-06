import assert from 'node:assert/strict';
import test from 'node:test';
import { createAchievementState } from '../js/achievement-engine.js';
import { exportUserData, importUserData, parseUserData } from '../js/user-data.js';

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
