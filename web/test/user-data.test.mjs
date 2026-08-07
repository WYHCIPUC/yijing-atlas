import assert from 'node:assert/strict';
import test from 'node:test';
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
    unrelated: 'secret',
  });
  const snapshot = exportUserData(source);
  assert.equal(snapshot.format, 'yijing-atlas-user-data');
  assert.deepEqual(snapshot.data['yijing.study.v1'], { 'l1-1': true });
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
