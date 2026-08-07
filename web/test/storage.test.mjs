import assert from 'node:assert/strict';
import test from 'node:test';
import { isPlainObject, readJson, removeStored, writeJson } from '../js/storage.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('安全 JSON 读写、删除和结构判断', () => {
  const storage = createStorage();
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(writeJson('key', { ok: true }, storage).ok, true);
  assert.deepEqual(readJson('key', {}, isPlainObject, storage), { ok: true });
  storage.setItem('plain', '42');
  assert.equal(readJson('plain', 0, undefined, storage), 42);
  assert.equal(removeStored('key', storage).ok, true);
  assert.equal(readJson('key', 'fallback', () => true, storage), 'fallback');
});

test('损坏、类型不符、无存储和异常均安全回退', () => {
  const broken = createStorage({ broken: '{nope', wrong: '[]' });
  assert.deepEqual(readJson('broken', {}, isPlainObject, broken), {});
  assert.deepEqual(readJson('wrong', {}, isPlainObject, broken), {});
  const failing = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('quota'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  assert.deepEqual(readJson('key', [], Array.isArray, failing), []);
  assert.equal(writeJson('key', {}, failing).ok, false);
  assert.equal(removeStored('key', failing).ok, false);
  const previous = globalThis.localStorage;
  delete globalThis.localStorage;
  try {
    assert.equal(writeJson('key', {}).ok, false);
    assert.equal(removeStored('key').ok, false);
  } finally {
    globalThis.localStorage = previous;
  }
});
