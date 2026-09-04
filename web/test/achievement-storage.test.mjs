import assert from 'node:assert/strict';
import test from 'node:test';
import { createAchievementState, createProgressEvent } from '../js/achievement-engine.js';
import {
  exportAchievementData,
  getAchievementStorageKey,
  importAchievementData,
  loadAchievementState,
  parseAchievementData,
  processAchievementEvent,
  saveAchievementState,
} from '../js/achievement-storage.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

const now = () => new Date('2026-08-20T08:00:00.000Z');

function lessonEvent() {
  return createProgressEvent({
    type: 'lesson.completed',
    subjectId: 'l1-1',
    idempotencyKey: 'lesson:1',
  }, { now, random: () => 0.2 });
}

test('损坏、缺失和旧版状态均安全加载', () => {
  const key = getAchievementStorageKey();
  assert.equal(key, 'yijing.achievements.v1');
  assert.deepEqual(loadAchievementState(createStorage()), createAchievementState());
  assert.deepEqual(loadAchievementState(createStorage({ [key]: '{broken' })), createAchievementState());
  const legacy = { version: 0, events: [lessonEvent()] };
  const migrated = loadAchievementState(createStorage({ [key]: JSON.stringify(legacy) }), { now });
  assert.deepEqual(migrated.metrics.completedLessons, ['l1-1']);
  const previous = globalThis.localStorage;
  delete globalThis.localStorage;
  try {
    assert.deepEqual(loadAchievementState(), createAchievementState());
  } finally {
    globalThis.localStorage = previous;
  }
});

test('事件处理可持久化且重复提交不重复写入', () => {
  const storage = createStorage();
  const first = processAchievementEvent(lessonEvent(), { storage, now });
  const duplicate = processAchievementEvent(lessonEvent(), { storage, now });
  assert.equal(first.accepted, true);
  assert.equal(first.saved, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.saved, true);
  assert.equal(loadAchievementState(storage).processedKeys.length, 1);
});

test('写入失败与非法状态返回明确结果', () => {
  const failing = {
    getItem: () => null,
    setItem: () => { throw new Error('quota'); },
  };
  const result = processAchievementEvent(lessonEvent(), { storage: failing, now });
  assert.equal(result.accepted, true);
  assert.equal(result.saved, false);
  assert.match(result.error.message, /quota/);
  assert.equal(saveAchievementState({ broken: true }, failing).ok, false);
});

test('成就数据可导出、解析并导入另一存储', () => {
  const source = createStorage();
  processAchievementEvent(lessonEvent(), { storage: source, now });
  const snapshot = exportAchievementData(source, { now });
  assert.equal(snapshot.exportedAt, '2026-08-20T08:00:00.000Z');
  const parsed = parseAchievementData(JSON.stringify(snapshot));
  const target = createStorage();
  const imported = importAchievementData(parsed, target);
  assert.deepEqual(imported, snapshot.state);
  assert.throws(() => parseAchievementData('{broken'), /有效的 JSON/);
  assert.throws(() => parseAchievementData(JSON.stringify({ version: 1 })), /格式或版本/);
  assert.throws(() => parseAchievementData('x'.repeat(512 * 1024 + 1)), /512 KB/);
  assert.throws(() => importAchievementData(snapshot, {
    getItem: () => null,
    setItem: () => { throw new Error('blocked'); },
  }), /导入失败/);
});
