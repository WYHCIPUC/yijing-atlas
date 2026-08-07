import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDivinationHistory,
  clearDivinationHistory,
  getDivinationHistoryKey,
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
  const first = addDivinationHistory({ type: 'coin', primaryCode: '111111', changedCode: null }, storage, new Date('2026-08-06T01:00:00Z'));
  assert.equal(first.saved, true);
  addDivinationHistory({ type: 'meihua', primaryCode: '000000', changedCode: '100000', changingPos: 1 }, storage, new Date('2026-08-06T02:00:00Z'));
  assert.deepEqual(loadDivinationHistory(storage).map((item) => item.primaryCode), ['000000', '111111']);
  assert.equal(clearDivinationHistory(storage), true);
  assert.deepEqual(loadDivinationHistory(storage), []);
});

test('非法历史、非法卦码和写入失败安全处理', () => {
  const storage = createStorage({ [getDivinationHistoryKey()]: '[{"bad":true}]' });
  assert.deepEqual(loadDivinationHistory(storage), []);
  assert.equal(addDivinationHistory({ primaryCode: 'bad' }, storage).saved, false);
  const failing = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.equal(addDivinationHistory({ type: 'coin', primaryCode: '111111' }, failing).saved, false);
});
