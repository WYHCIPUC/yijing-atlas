import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateStreak, getActivityKey, loadActivity, recordActivity } from '../js/learning-progress.js';

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
