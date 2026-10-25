import assert from 'node:assert/strict';
import test from 'node:test';
import { loadReviewCards } from '../js/review-engine.js';
import { loadAchievementState } from '../js/achievement-storage.js';

let api = {};
try { api = await import('../js/review-session.js'); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const keys = { card: 'yijing-review-cards', activity: 'yijing-activity-v1', achievement: 'yijing.achievements.v1' };
const at = new Date('2026-10-25T01:00:00Z');
const later = new Date('2026-10-27T02:00:00Z');
const card = () => ({ code: '111111', stage: 2, due: 100, introducedAt: 10, lapses: 0, reps: 2, lastReview: 50 });
function store() {
  const values = new Map([[keys.card, JSON.stringify({ '111111': card() })]]);
  const writes = new Map(), blocked = new Set(), unreadable = new Set();
  return { values, writes, blocked, unreadable,
    getItem(key) { if (unreadable.has(key)) throw new Error('read blocked'); return values.get(key) ?? null; },
    setItem(key, value) { if (blocked.has(key)) throw new Error('quota'); values.set(key, String(value)); writes.set(key, (writes.get(key) || 0) + 1); },
  };
}
function attempt(snapshot = card()) {
  assert.equal(typeof api.createReviewAttempt, 'function', 'review round coordinator exists');
  return api.createReviewAttempt(snapshot);
}
const submit = (token, rating, storage, now = at) => api.submitReviewAttempt(token, rating, { storage, now });

test('same token saves one card/activity/event, returns independent snapshots and new round can advance', () => {
  const storage = store(), original = card(), token = attempt(original);
  original.stage = 7;
  const first = submit(token, 2, storage);
  assert.equal(first.saved, true); assert.equal(first.rating, 2); assert.equal(first.reviewedAt, at.getTime());
  assert.equal(first.previousCard.stage, 2); assert.equal(first.card.stage, 3); assert.equal(first.card.reps, 3);
  assert.equal(first.card.due, at.getTime() + 4 * 86400000);
  const writes = [...storage.writes]; first.card.stage = 0;
  assert.equal(submit(token, 2, storage, later).card.stage, 3);
  assert.deepEqual([...storage.writes], writes);
  const next = submit(attempt(loadReviewCards(storage)['111111']), 2, storage, later);
  assert.equal(next.saved, true); assert.equal(next.card.reps, 4);
  assert.equal(loadAchievementState(storage).processedKeys.filter(key => key.startsWith('review:')).length, 2);
  assert.deepEqual(new Set(storage.values.keys()), new Set(Object.values(keys)));
});

for (const part of Object.keys(keys)) {
  test(`${part} failure retries only unsaved effects with original rating and time`, () => {
    const storage = store(), token = attempt(); storage.blocked.add(keys[part]);
    const first = submit(token, 1, storage);
    assert.equal(first.saved, false); assert.equal(first.changes[part].saved, false);
    if (part === 'card') {
      assert.equal(loadReviewCards(storage)['111111'].reps, 2);
      assert.equal(storage.values.has(keys.activity), false); assert.equal(storage.values.has(keys.achievement), false);
    }
    const writes = new Map(storage.writes); storage.blocked.clear();
    const retry = submit(token, 1, storage, later);
    assert.equal(retry.saved, true); assert.equal(retry.reviewedAt, at.getTime());
    assert.equal(retry.card.reps, 3); assert.equal(retry.card.stage, 2);
    assert.equal(retry.card.due, at.getTime() + 2 * 86400000);
    for (const [key, count] of writes) assert.equal(storage.writes.get(key), count, key);
    const after = [...storage.writes]; assert.equal(submit(token, 1, storage).saved, true);
    assert.deepEqual([...storage.writes], after);
    assert.equal(loadAchievementState(storage).processedKeys.filter(key => key.startsWith('review:')).length, 1);
  });
}

test('rating and time validate before locking; changed rating after first valid submit cannot write', () => {
  const storage = store(), token = attempt();
  for (const value of [-1, 3, '2', null, undefined, NaN]) assert.equal(submit(token, value, storage).errorCode, 'invalid-rating');
  for (const now of [null, 1, new Date('invalid')]) assert.equal(submit(token, 2, storage, now).errorCode, 'invalid-time');
  assert.equal(storage.writes.size, 0);
  storage.blocked.add(keys.card); assert.equal(submit(token, 0, storage).saved, false); storage.blocked.clear();
  assert.equal(submit(token, 2, storage).errorCode, 'rating-locked'); assert.equal(storage.writes.size, 0);
  assert.equal(submit(token, 0, storage, later).card.lastReview, at.getTime());
});

test('forged tokens, invalid snapshots and storage changes are rejected', () => {
  const storage = store(); attempt();
  for (const value of [null, {}, { ...card(), code: 'bad' }, { ...card(), reps: -1 }]) assert.equal(api.createReviewAttempt(value), null);
  assert.equal(submit({}, 2, storage).errorCode, 'invalid-attempt');
  const token = attempt(); storage.blocked.add(keys.activity); assert.equal(submit(token, 2, storage).saved, false);
  assert.equal(submit(token, 2, store()).errorCode, 'storage-changed');
  assert.equal(api.submitReviewAttempt(token, 2, null).errorCode, 'invalid-options');
});

test('unreadable or malformed card collection never replaces existing data or emits evidence', () => {
  for (const raw of ['{broken', '{"111111":{"code":"111111"}}']) {
    const storage = store(), token = attempt(); storage.values.set(keys.card, raw);
    const result = submit(token, 2, storage);
    assert.equal(result.saved, false); assert.equal(storage.values.get(keys.card), raw); assert.equal(storage.writes.size, 0);
  }
  const storage = store(), token = attempt(); storage.unreadable.add(keys.card);
  assert.equal(submit(token, 2, storage).errorCode, 'card-read-failed'); assert.equal(storage.writes.size, 0);
  storage.unreadable.clear(); assert.equal(submit(token, 2, storage, later).reviewedAt, at.getTime());
});

test('missing current card and same-card snapshot conflicts reject without adding evidence', () => {
  for (const value of [{}, { '111111': { ...card(), reps: 9 } }]) {
    const storage = store(), token = attempt(); storage.values.set(keys.card, JSON.stringify(value));
    const result = submit(token, 2, storage);
    assert.equal(result.errorCode, value['111111'] ? 'card-conflict' : 'card-missing');
    assert.equal(storage.writes.size, 0);
  }
});

test('retry merges latest other cards but never overwrites a changed current card', () => {
  const storage = store(), token = attempt(); storage.blocked.add(keys.card); submit(token, 2, storage);
  const other = { ...card(), code: '000000', stage: 5 };
  storage.values.set(keys.card, JSON.stringify({ '111111': card(), '000000': other })); storage.blocked.clear();
  assert.equal(submit(token, 2, storage).saved, true); assert.deepEqual(loadReviewCards(storage)['000000'], other);
  const second = attempt(loadReviewCards(storage)['111111']); storage.blocked.add(keys.card); submit(second, 2, storage);
  const changed = loadReviewCards(storage); changed['111111'].stage = 7;
  storage.values.set(keys.card, JSON.stringify(changed)); storage.blocked.clear();
  assert.equal(submit(second, 2, storage).errorCode, 'card-conflict');
  assert.deepEqual(loadReviewCards(storage), changed);
});

test('corrupt activity and achievement are preserved, then only their failed part is retried', () => {
  for (const part of ['activity', 'achievement']) {
    const storage = store(), token = attempt(); storage.values.set(keys[part], '{broken');
    const first = submit(token, 2, storage);
    assert.equal(first.saved, false); assert.equal(first.changes.card.saved, true);
    assert.equal(first.changes[part].saved, false); assert.equal(storage.values.get(keys[part]), '{broken');
    const writes = new Map(storage.writes); storage.values.delete(keys[part]);
    assert.equal(submit(token, 2, storage, later).saved, true);
    for (const [key, count] of writes) assert.equal(storage.writes.get(key), count);
  }
});

test('already recorded activity day does not need a new write; legacy card without introducedAt remains usable', () => {
  const storage = store(), legacy = card(); delete legacy.introducedAt;
  storage.values.set(keys.card, JSON.stringify({ '111111': legacy }));
  const day = `${at.getFullYear()}-${String(at.getMonth()+1).padStart(2,'0')}-${String(at.getDate()).padStart(2,'0')}`;
  storage.values.set(keys.activity, JSON.stringify({ days: [day] })); storage.blocked.add(keys.activity);
  assert.equal(submit(attempt(legacy), 2, storage).saved, true);
  assert.equal(storage.writes.has(keys.activity), false);
});

test('two supporting failures can recover independently without resaving the card or the recovered part', () => {
  const storage = store(), token = attempt(); storage.blocked.add(keys.activity); storage.blocked.add(keys.achievement);
  const first = submit(token, 2, storage);
  assert.equal(first.changes.card.saved, true); assert.equal(first.changes.activity.saved, false); assert.equal(first.changes.achievement.saved, false);
  storage.blocked.delete(keys.activity); const second = submit(token, 2, storage, later);
  assert.equal(second.saved, false); assert.equal(second.changes.activity.saved, true);
  const writes = new Map(storage.writes); storage.blocked.clear();
  assert.equal(submit(token, 2, storage, later).saved, true);
  assert.equal(storage.writes.get(keys.card), writes.get(keys.card));
  assert.equal(storage.writes.get(keys.activity), writes.get(keys.activity));
});

test('late supporting retry preserves a newer completed review card', () => {
  const storage = store(), old = attempt(); storage.blocked.add(keys.activity);
  assert.equal(submit(old, 2, storage).saved, false); storage.blocked.clear();
  assert.equal(submit(attempt(loadReviewCards(storage)['111111']), 2, storage, later).saved, true);
  const newest = storage.values.get(keys.card), cardWrites = storage.writes.get(keys.card);
  assert.equal(submit(old, 2, storage, later).saved, true);
  assert.equal(storage.values.get(keys.card), newest); assert.equal(storage.writes.get(keys.card), cardWrites);
  assert.equal(loadAchievementState(storage).processedKeys.filter(key => key.startsWith('review:')).length, 2);
});

test('a single validated raw read protects supporting writers from a later fallback read', () => {
  const storage = store(), originalGet = storage.getItem.bind(storage), reads = new Map();
  storage.getItem = key => {
    reads.set(key, (reads.get(key) || 0) + 1);
    if (reads.get(key) > 1) throw new Error('second read blocked');
    return originalGet(key);
  };
  assert.equal(submit(attempt(), 2, storage).saved, true);
  for (const key of Object.values(keys)) assert.equal(reads.get(key), 1, key);
});

test('supporting read failures preserve data and can retry without repeating successful writes', () => {
  for (const part of ['activity', 'achievement']) {
    const storage = store(), token = attempt(); storage.unreadable.add(keys[part]);
    const first = submit(token, 2, storage);
    assert.equal(first.changes[part].errorCode, 'read-failed'); assert.equal(first.saved, false);
    const writes = new Map(storage.writes); storage.unreadable.clear();
    assert.equal(submit(token, 2, storage).saved, true);
    for (const [key, count] of writes) assert.equal(storage.writes.get(key), count);
  }
});

test('unavailable default storage keeps the original submitted time for an explicit retry', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
  try {
    const token = attempt(), moment = new Date(at);
    assert.equal(api.submitReviewAttempt(token, 1, { now: moment }).errorCode, 'storage-unavailable');
    moment.setUTCDate(28);
    const result = submit(token, 1, store(), later);
    assert.equal(result.saved, true); assert.equal(result.reviewedAt, at.getTime());
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
