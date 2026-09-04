import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDivinationHistory,
  clearDivinationHistory,
  getDivinationHistoryKey,
  getLegacyDivinationHistoryKey,
  loadDivinationHistory,
} from '../js/divination-history.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('占筮记录按新到旧保存并可清空', () => {
  const storage = createStorage();
  const yaos = Array.from({ length: 6 }, () => ({
    value: 1, isYang: true, changing: false, name: '少阳', coins: [3, 2, 2],
  }));
  const first = addDivinationHistory({
    type: 'coin', primaryCode: '111111', changedCode: null, yaos,
    readingPolicyId: 'zhu-xi-qimeng-v1',
    interpretation: { method: '金钱卦', basis: '无变爻，以本卦卦辞断之。', focus: [], prompts: [] },
  }, storage, new Date('2026-08-06T01:00:00Z'));
  assert.equal(first.saved, true);
  addDivinationHistory({
    type: 'meihua', primaryCode: '000000', changedCode: '100000',
    cast: { method: 'number', primaryCode: '000000', changedCode: '100000', changingPos: 1, source: '上数 1，下数 2' },
  }, storage, new Date('2026-08-06T02:00:00Z'));
  const items = loadDivinationHistory(storage);
  assert.deepEqual(items.map((item) => item.primaryCode), ['000000', '111111']);
  assert.equal(items[1].version, 2);
  assert.equal(items[1].yaos.length, 6);
  assert.equal(items[1].privacy.questionStored, false);
  assert.equal(items[1].readingPolicyId, 'zhu-xi-qimeng-v1');
  assert.equal(clearDivinationHistory(storage), true);
  assert.deepEqual(loadDivinationHistory(storage), []);
});

test('旧版记录保留并明确标记为仅有卦象摘要', () => {
  const legacy = [{
    id: 'old-1', createdAt: '2026-08-05T01:00:00.000Z', type: 'coin',
    primaryCode: '111111', changedCode: '000000', changingPos: null, summary: '乾 → 坤',
  }];
  const storage = createStorage({ [getLegacyDivinationHistoryKey()]: JSON.stringify(legacy) });
  const item = loadDivinationHistory(storage)[0];
  assert.equal(item.version, 1);
  assert.equal(item.legacySummaryOnly, true);
  assert.deepEqual(item.changingPositions, []);
});

test('非法历史、非法卦码和写入失败安全处理', () => {
  const storage = createStorage({ [getDivinationHistoryKey()]: '[{"bad":true}]' });
  assert.deepEqual(loadDivinationHistory(storage), []);
  assert.equal(addDivinationHistory({ primaryCode: 'bad' }, storage).saved, false);
  const failing = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.equal(addDivinationHistory({ type: 'coin', primaryCode: '111111' }, failing).saved, false);
});
